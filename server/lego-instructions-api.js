import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

const PORT = Number(process.env.LEGO_INSTRUCTIONS_API_PORT) || 3050

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'LEGO Instructions API',
    port: PORT,
    timestamp: new Date().toISOString()
  })
})

app.get('/api/lego-instructions', async (req, res) => {
  const { setNum } = req.query

  console.log('[LEGO Instructions API] 요청 받음:', { setNum, query: req.query })

  if (!setNum) {
    console.error('[LEGO Instructions API] setNum이 없습니다')
    return res.status(400).json({ 
      success: false,
      error: 'setNum is required' 
    })
  }

  try {
    // 세트 번호에서 하이픈 제거 (메인 번호만 사용)
    const mainSetNum = String(setNum).split('-')[0].trim()
    console.log('[LEGO Instructions API] 처리할 세트 번호:', { original: setNum, main: mainSetNum })
    
    // 레고 공식 웹사이트 설명서 페이지 URL (en-au 우선)
    const locales = ['en-au', 'en-us', 'ko-kr', 'en-gb']
    let instructions = []
    
    for (const locale of locales) {
      try {
        const url = `https://www.lego.com/${locale}/service/buildinginstructions/${mainSetNum}`
        console.log(`[LEGO Instructions API] Locale ${locale} 시도: ${url}`)
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        })

        console.log(`[LEGO Instructions API] Locale ${locale} 응답:`, response.status, response.statusText)

        if (!response.ok) {
          console.warn(`[LEGO Instructions API] Locale ${locale} 실패: ${response.status}`)
          continue
        }

        const html = await response.text()
        console.log(`[LEGO Instructions API] Locale ${locale} HTML 길이:`, html.length)
        
        // HTML 샘플 출력 (처음 2000자)
        console.log(`[LEGO Instructions API] Locale ${locale} HTML 샘플:`, html.substring(0, 2000))
        
        // JSON 데이터 추출 시도 (window.__INITIAL_STATE__ 또는 유사한 패턴)
        const jsonStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/s)
        if (jsonStateMatch) {
          try {
            const stateData = JSON.parse(jsonStateMatch[1])
            // 상태 데이터에서 설명서 정보 추출
            if (stateData?.instructions || stateData?.buildingInstructions) {
              const instructionList = stateData.instructions || stateData.buildingInstructions
              if (Array.isArray(instructionList) && instructionList.length > 0) {
                for (const inst of instructionList) {
                  instructions.push({
                    title: inst.title || inst.name || `Building Instructions ${mainSetNum}`,
                    description: inst.description || null,
                    url: inst.url || inst.pdfUrl || url,
                    thumbnail: inst.thumbnail || inst.image || null,
                    source: 'LEGO.com',
                    locale: locale
                  })
                }
                if (instructions.length > 0) break
              }
            }
          } catch (e) {
            // JSON 파싱 실패 시 무시
          }
        }

        // JSON-LD 스크립트 태그에서 설명서 데이터 추출 시도
        const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gs)
        for (const jsonLdMatch of jsonLdMatches) {
          try {
            const jsonData = JSON.parse(jsonLdMatch[1])
            const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData]
            for (const item of dataArray) {
              if (item['@type'] === 'HowTo' || item['@type'] === 'CreativeWork' || 
                  item.name?.toLowerCase().includes('instruction') ||
                  item.url?.includes('buildinginstructions')) {
                instructions.push({
                  title: item.name || `Building Instructions ${mainSetNum}`,
                  description: item.description || null,
                  url: item.url || url,
                  thumbnail: item.image || (typeof item.image === 'object' ? item.image.url : null) || null,
                  source: 'LEGO.com',
                  locale: locale
                })
              }
            }
          } catch (e) {
            // JSON 파싱 실패 시 무시
          }
        }

        // 1단계: 다운로드 버튼 찾기 (가장 정확한 방법)
        // download, Download, 다운로드 등의 텍스트가 있는 버튼/링크 찾기
        const downloadButtons = []
        try {
          const downloadButtonPatterns = [
            /<a[^>]*(?:class|id)=["'][^"']*(?:download|button)[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>.*?(?:download|Download|다운로드)/gis,
            /<button[^>]*(?:class|id)=["'][^"']*(?:download|button)[^"']*["'][^>]*>.*?(?:download|Download|다운로드)/gis,
            /<a[^>]*href=["']([^"']*\.pdf[^"']*)["'][^>]*>.*?(?:download|Download|다운로드)/gis,
            /<a[^>]*href=["']([^"']*\/cdn\/product-assets[^"']*)["'][^>]*>/gi
          ]
          
          for (let i = 0; i < downloadButtonPatterns.length; i++) {
            const pattern = downloadButtonPatterns[i]
            try {
              // matchAll이 실패할 수 있으므로 try-catch로 감싸기
              let matches
              try {
                matches = [...html.matchAll(pattern)]
              } catch (matchErr) {
                console.warn(`[LEGO Instructions API] 패턴 ${i} matchAll 에러:`, matchErr.message)
                continue
              }
              
              matches.forEach(match => {
                try {
                  if (match && match[1] && (match[1].includes('.pdf') || match[1].includes('product-assets'))) {
                    downloadButtons.push(match[1])
                  }
                } catch (matchProcessErr) {
                  console.warn(`[LEGO Instructions API] 매치 처리 에러:`, matchProcessErr.message)
                }
              })
            } catch (patternErr) {
              console.warn(`[LEGO Instructions API] 패턴 ${i} 처리 에러:`, patternErr.message)
            }
          }
          console.log(`[LEGO Instructions API] Locale ${locale} 다운로드 버튼 발견:`, downloadButtons.length, '개')
          if (downloadButtons.length > 0) {
            console.log(`[LEGO Instructions API] Locale ${locale} 다운로드 버튼 URL들:`, downloadButtons.slice(0, 5))
          }
        } catch (downloadErr) {
          console.error(`[LEGO Instructions API] 다운로드 버튼 검색 에러:`, downloadErr.message)
        }
        
        // 2단계: 레고 설명서 PDF URL 패턴: /cdn/product-assets/product.bi.core.pdf/{숫자}.pdf
        // 다양한 위치에서 찾기: href, src, data-*, JavaScript 변수, JSON 등
        const legoPdfUrlRegex = /https?:\/\/[^"'\s<>]*\/cdn\/product-assets\/product\.bi\.core\.pdf\/(\d+)\.pdf/gi
        const legoPdfMatches = [...html.matchAll(legoPdfUrlRegex)]
        console.log(`[LEGO Instructions API] Locale ${locale} 절대 URL 매칭:`, legoPdfMatches.length, '개')
        
        // 상대 경로도 찾기 (href, src, data-* 등 다양한 속성)
        const legoPdfRelativeRegex = /["'](\/cdn\/product-assets\/product\.bi\.core\.pdf\/(\d+)\.pdf)["']/gi
        const legoPdfRelativeMatches = [...html.matchAll(legoPdfRelativeRegex)]
        console.log(`[LEGO Instructions API] Locale ${locale} 상대 경로 매칭:`, legoPdfRelativeMatches.length, '개')
        
        // JavaScript 변수나 JSON 데이터에서 찾기
        const legoPdfJsRegex = /(?:url|href|src|pdfUrl|downloadUrl|fileUrl)[:=]\s*["']([^"']*\/cdn\/product-assets\/product\.bi\.core\.pdf\/(\d+)\.pdf)["']/gi
        const legoPdfJsMatches = [...html.matchAll(legoPdfJsRegex)]
        console.log(`[LEGO Instructions API] Locale ${locale} JS 변수 매칭:`, legoPdfJsMatches.length, '개')
        
        // data-* 속성에서 찾기 (data-url, data-href, data-pdf-url 등)
        const legoPdfDataRegex = /data-(?:url|href|pdf|download|file)=["']([^"']*\/cdn\/product-assets\/product\.bi\.core\.pdf\/(\d+)\.pdf)["']/gi
        const legoPdfDataMatches = [...html.matchAll(legoPdfDataRegex)]
        console.log(`[LEGO Instructions API] Locale ${locale} data-* 속성 매칭:`, legoPdfDataMatches.length, '개')
        
        // 더 넓은 패턴: product.bi.core.pdf가 포함된 모든 URL
        const broadPdfRegex = /(https?:\/\/[^"'\s<>]*\/cdn\/product-assets\/[^"'\s<>]*\.pdf)/gi
        const broadPdfMatches = [...html.matchAll(broadPdfRegex)]
        console.log(`[LEGO Instructions API] Locale ${locale} 넓은 패턴 매칭:`, broadPdfMatches.length, '개')
        if (broadPdfMatches.length > 0) {
          console.log(`[LEGO Instructions API] Locale ${locale} 발견된 PDF URL들:`, broadPdfMatches.map(m => m[1]).slice(0, 5))
        }
        
        // 모든 PDF URL 수집
        const pdfUrls = new Map()
        
        // 다운로드 버튼에서 직접 추출 (우선순위 1)
        for (const buttonUrl of downloadButtons) {
          const fullUrl = buttonUrl.startsWith('http') ? buttonUrl : `https://www.lego.com${buttonUrl.startsWith('/') ? '' : '/'}${buttonUrl}`
          // PDF ID 추출
          const pdfIdMatch = fullUrl.match(/product\.bi\.core\.pdf\/(\d+)\.pdf/)
          if (pdfIdMatch) {
            const pdfId = pdfIdMatch[1]
            pdfUrls.set(pdfId, fullUrl)
            console.log(`[LEGO Instructions API] 다운로드 버튼에서 발견: PDF ID ${pdfId} -> ${fullUrl}`)
          } else if (fullUrl.includes('.pdf')) {
            // PDF ID를 추출할 수 없지만 PDF 파일인 경우
            const tempId = `temp-${Date.now()}-${pdfUrls.size}`
            pdfUrls.set(tempId, fullUrl)
            console.log(`[LEGO Instructions API] 다운로드 버튼에서 발견 (ID 없음): ${fullUrl}`)
          }
        }
        
        // 절대 URL 찾기
        for (const match of legoPdfMatches) {
          const fullUrl = match[0]
          const pdfId = match[1]
          if (fullUrl && pdfId && !pdfUrls.has(pdfId)) {
            pdfUrls.set(pdfId, fullUrl)
          }
        }
        
        // 상대 경로 찾기
        for (const match of legoPdfRelativeMatches) {
          const relativePath = match[1]
          const pdfId = match[2]
          if (relativePath && pdfId && !pdfUrls.has(pdfId)) {
            const fullUrl = `https://www.lego.com${relativePath}`
            pdfUrls.set(pdfId, fullUrl)
          }
        }
        
        // JavaScript 변수/JSON에서 찾기
        for (const match of legoPdfJsMatches) {
          const path = match[1]
          const pdfId = match[2]
          if (path && pdfId && !pdfUrls.has(pdfId)) {
            const fullUrl = path.startsWith('http') ? path : `https://www.lego.com${path.startsWith('/') ? '' : '/'}${path}`
            pdfUrls.set(pdfId, fullUrl)
          }
        }
        
        // data-* 속성에서 찾기
        for (const match of legoPdfDataMatches) {
          const path = match[1]
          const pdfId = match[2]
          if (path && pdfId && !pdfUrls.has(pdfId)) {
            const fullUrl = path.startsWith('http') ? path : `https://www.lego.com${path.startsWith('/') ? '' : '/'}${path}`
            pdfUrls.set(pdfId, fullUrl)
          }
        }
        
        // 넓은 패턴에서 추출
        for (const match of broadPdfMatches) {
          const url = match[1]
          const pdfIdMatch = url.match(/product\.bi\.core\.pdf\/(\d+)\.pdf/)
          if (pdfIdMatch) {
            const pdfId = pdfIdMatch[1]
            if (!pdfUrls.has(pdfId)) {
              pdfUrls.set(pdfId, url)
            }
          }
        }
        
        console.log(`[LEGO Instructions] 찾은 PDF URL 개수: ${pdfUrls.size}`)
        for (const [pdfId, url] of pdfUrls.entries()) {
          console.log(`[LEGO Instructions] PDF ID ${pdfId}: ${url}`)
        }
        
        // 설명서 카드/섹션에서 정보 추출 (제목, 썸네일 등)
        const instructionCardRegex = /<div[^>]*class=["'][^"']*instruction[^"']*["'][^>]*>(.*?)<\/div>/gis
        const cardMatches = [...html.matchAll(instructionCardRegex)]
        console.log(`[LEGO Instructions API] Locale ${locale} 설명서 카드 매칭:`, cardMatches.length, '개')
        
        // building instructions 관련 모든 링크 찾기
        const allInstructionLinks = [...html.matchAll(/<a[^>]*href=["']([^"']*buildinginstructions?[^"']*)["'][^>]*>/gi)]
        console.log(`[LEGO Instructions API] Locale ${locale} building instructions 링크:`, allInstructionLinks.length, '개')
        if (allInstructionLinks.length > 0) {
          console.log(`[LEGO Instructions API] Locale ${locale} 발견된 링크들:`, allInstructionLinks.map(m => m[1]).slice(0, 5))
        }
        
        const instructionCards = []
        for (const cardMatch of cardMatches) {
          const cardHtml = cardMatch[1]
          
          // 링크 추출
          const linkMatch = cardHtml.match(/<a[^>]*href=["']([^"']+)["'][^>]*>/i)
          if (linkMatch) {
            const href = linkMatch[1]
            const fullUrl = href.startsWith('http') ? href : `https://www.lego.com${href.startsWith('/') ? '' : '/'}${href}`
            
            // PDF ID 추출
            const pdfIdMatch = fullUrl.match(/product\.bi\.core\.pdf\/(\d+)\.pdf/)
            const pdfId = pdfIdMatch ? pdfIdMatch[1] : null
            
            // 제목 추출
            const titleMatch = cardHtml.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i) || 
                              cardHtml.match(/<span[^>]*class=["'][^"']*title[^"']*["'][^>]*>(.*?)<\/span>/i) ||
                              cardHtml.match(/<p[^>]*class=["'][^"']*title[^"']*["'][^>]*>(.*?)<\/p>/i)
            const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : null
            
            // 썸네일 추출
            const imgMatch = cardHtml.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i)
            let thumbnail = null
            if (imgMatch) {
              thumbnail = imgMatch[1].startsWith('http') ? imgMatch[1] : `https://www.lego.com${imgMatch[1].startsWith('/') ? '' : '/'}${imgMatch[1]}`
            }
            
            if (pdfId || fullUrl.includes('buildinginstructions') || fullUrl.includes('instruction')) {
              instructionCards.push({
                pdfId,
                url: fullUrl,
                title,
                thumbnail
              })
            }
          }
        }
        
        // PDF URL과 카드 정보 매칭
        let instructionIndex = 1
        for (const [pdfId, pdfUrl] of pdfUrls.entries()) {
          // 해당 PDF ID를 가진 카드 찾기
          const card = instructionCards.find(c => c.pdfId === pdfId)
          
          instructions.push({
            title: card?.title || `Building Instructions ${mainSetNum} - Part ${instructionIndex}`,
            description: null,
            url: pdfUrl,
            thumbnail: card?.thumbnail || null,
            source: 'LEGO.com',
            locale: locale
          })
          instructionIndex++
        }
        
        // PDF URL을 찾지 못했지만 카드가 있는 경우
        if (pdfUrls.size === 0 && instructionCards.length > 0) {
          for (const card of instructionCards) {
            if (card.url && (card.url.includes('buildinginstructions') || card.url.includes('instruction'))) {
              instructions.push({
                title: card.title || `Building Instructions ${mainSetNum}`,
                description: null,
                url: card.url,
                thumbnail: card.thumbnail || null,
                source: 'LEGO.com',
                locale: locale
              })
            }
          }
        }
        
        // 일반 PDF 링크도 찾기 (fallback)
        const generalPdfRegex = /href=["']([^"']*buildinginstructions[^"']*\.pdf[^"']*)["']/gi
        const generalPdfMatches = [...html.matchAll(generalPdfRegex)]
        for (const pdfMatch of generalPdfMatches) {
          const pdfUrl = pdfMatch[1].startsWith('http') ? pdfMatch[1] : `https://www.lego.com${pdfMatch[1].startsWith('/') ? '' : '/'}${pdfMatch[1]}`
          // 이미 추가된 URL이 아닌 경우만 추가
          if (!Array.from(pdfUrls.values()).some(url => url === pdfUrl)) {
            instructions.push({
              title: `Building Instructions PDF ${mainSetNum}`,
              description: null,
              url: pdfUrl,
              thumbnail: null,
              source: 'LEGO.com',
              locale: locale
            })
          }
        }

        // 성공적으로 데이터를 찾았으면 다음 locale 시도하지 않음
        if (instructions.length > 0) {
          console.log(`[LEGO Instructions API] Locale ${locale}에서 ${instructions.length}개 설명서 발견, 다음 locale 시도 중단`)
          break
        } else {
          console.log(`[LEGO Instructions API] Locale ${locale}에서 설명서를 찾지 못함`)
        }
      } catch (err) {
        console.error(`[LEGO Instructions API] Locale ${locale} 예외 발생:`, err.message)
        console.error(`[LEGO Instructions API] 에러 스택:`, err.stack)
        continue
      }
    }
    
    console.log(`[LEGO Instructions API] 모든 locale 시도 완료. 총 ${instructions.length}개 설명서 발견`)

    // 중복 제거 (URL 기준)
    const uniqueInstructions = []
    const seenUrls = new Set()
    for (const instruction of instructions) {
      if (!seenUrls.has(instruction.url)) {
        seenUrls.add(instruction.url)
        uniqueInstructions.push(instruction)
      } else {
        console.log(`[LEGO Instructions API] 중복 URL 제거: ${instruction.url}`)
      }
    }

    console.log(`[LEGO Instructions API] 최종 결과: ${uniqueInstructions.length}개 설명서 (중복 제거 후)`)
    console.log('[LEGO Instructions API] 최종 설명서 목록:', uniqueInstructions.map(i => ({ title: i.title, url: i.url })))

    return res.status(200).json({
      success: true,
      setNum: mainSetNum,
      count: uniqueInstructions.length,
      results: uniqueInstructions
    })
  } catch (error) {
    console.error('[LEGO Instructions API] 전체 오류:', error)
    console.error('[LEGO Instructions API] 에러 타입:', error.constructor.name)
    console.error('[LEGO Instructions API] 에러 메시지:', error.message)
    console.error('[LEGO Instructions API] 에러 스택:', error.stack)
    
    // 에러 응답 전에 로그 출력
    const errorResponse = {
      success: false,
      error: error.message || '설명서를 가져오는데 실패했습니다.',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }
    console.error('[LEGO Instructions API] 에러 응답:', errorResponse)
    
    return res.status(500).json(errorResponse)
  }
})

app.listen(PORT, () => {
  console.log(`[LEGO Instructions API] 서버 시작: http://localhost:${PORT}`)
})


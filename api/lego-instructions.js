export default async function handler(req, res) {
  // Connect 스타일 res 객체를 Express 스타일로 변환
  if (!res.status) {
    res.status = (code) => {
      res.statusCode = code
      return res
    }
  }
  if (!res.json) {
    res.json = (data) => {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(data))
    }
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { setNum } = req.query || {}

  if (!setNum) {
    return res.status(400).json({ error: 'setNum is required' })
  }

  try {
    // 세트 번호에서 하이픈 제거 (메인 번호만 사용)
    const mainSetNum = String(setNum).split('-')[0].trim()
    
    // 레고 공식 웹사이트 설명서 페이지 URL (en-au 우선)
    const locales = ['en-au', 'en-us', 'ko-kr', 'en-gb']
    let instructions = []
    
    for (const locale of locales) {
      try {
        const url = `https://www.lego.com/${locale}/service/buildinginstructions/${mainSetNum}`
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        })

        if (!response.ok) {
          continue
        }

        const html = await response.text()
        
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

        // 1단계: 다운로드 버튼 찾기
        const downloadButtons = []
        try {
          const downloadButtonPatterns = [
            /<a[^>]*(?:class|id)=["'][^"']*(?:download|button)[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>.*?(?:download|Download|다운로드)/gis,
            /<a[^>]*href=["']([^"']*\.pdf[^"']*)["'][^>]*>.*?(?:download|Download|다운로드)/gis,
            /<a[^>]*href=["']([^"']*\/cdn\/product-assets[^"']*)["'][^>]*>/gi
          ]
          
          for (const pattern of downloadButtonPatterns) {
            try {
              const matches = [...html.matchAll(pattern)]
              matches.forEach(match => {
                if (match && match[1] && (match[1].includes('.pdf') || match[1].includes('product-assets'))) {
                  downloadButtons.push(match[1])
                }
              })
            } catch (err) {
              // 패턴 매칭 실패 무시
            }
          }
        } catch (err) {
          // 다운로드 버튼 검색 실패 무시
        }
        
        // 2단계: 레고 설명서 PDF URL 패턴 찾기
        const legoPdfUrlRegex = /https?:\/\/[^"'\s<>]*\/cdn\/product-assets\/product\.bi\.core\.pdf\/(\d+)\.pdf/gi
        const legoPdfMatches = [...html.matchAll(legoPdfUrlRegex)]
        
        const legoPdfRelativeRegex = /["'](\/cdn\/product-assets\/product\.bi\.core\.pdf\/(\d+)\.pdf)["']/gi
        const legoPdfRelativeMatches = [...html.matchAll(legoPdfRelativeRegex)]
        
        const legoPdfJsRegex = /(?:url|href|src|pdfUrl|downloadUrl|fileUrl)[:=]\s*["']([^"']*\/cdn\/product-assets\/product\.bi\.core\.pdf\/(\d+)\.pdf)["']/gi
        const legoPdfJsMatches = [...html.matchAll(legoPdfJsRegex)]
        
        const broadPdfRegex = /(https?:\/\/[^"'\s<>]*\/cdn\/product-assets\/[^"'\s<>]*\.pdf)/gi
        const broadPdfMatches = [...html.matchAll(broadPdfRegex)]
        
        // 모든 PDF URL 수집
        const pdfUrls = new Map()
        
        for (const buttonUrl of downloadButtons) {
          const fullUrl = buttonUrl.startsWith('http') ? buttonUrl : `https://www.lego.com${buttonUrl.startsWith('/') ? '' : '/'}${buttonUrl}`
          const pdfIdMatch = fullUrl.match(/product\.bi\.core\.pdf\/(\d+)\.pdf/)
          if (pdfIdMatch) {
            const pdfId = pdfIdMatch[1]
            pdfUrls.set(pdfId, fullUrl)
          } else if (fullUrl.includes('.pdf')) {
            const tempId = `temp-${Date.now()}-${pdfUrls.size}`
            pdfUrls.set(tempId, fullUrl)
          }
        }
        
        for (const match of legoPdfMatches) {
          const fullUrl = match[0]
          const pdfId = match[1]
          if (fullUrl && pdfId && !pdfUrls.has(pdfId)) {
            pdfUrls.set(pdfId, fullUrl)
          }
        }
        
        for (const match of legoPdfRelativeMatches) {
          const relativePath = match[1]
          const pdfId = match[2]
          if (relativePath && pdfId && !pdfUrls.has(pdfId)) {
            const fullUrl = `https://www.lego.com${relativePath}`
            pdfUrls.set(pdfId, fullUrl)
          }
        }
        
        for (const match of legoPdfJsMatches) {
          const path = match[1]
          const pdfId = match[2]
          if (path && pdfId && !pdfUrls.has(pdfId)) {
            const fullUrl = path.startsWith('http') ? path : `https://www.lego.com${path.startsWith('/') ? '' : '/'}${path}`
            pdfUrls.set(pdfId, fullUrl)
          }
        }
        
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
        
        // 설명서 카드/섹션에서 정보 추출 (제목, 썸네일 등)
        const instructionCardRegex = /<div[^>]*class=["'][^"']*instruction[^"']*["'][^>]*>(.*?)<\/div>/gis
        const cardMatches = [...html.matchAll(instructionCardRegex)]
        
        const instructionCards = []
        for (const cardMatch of cardMatches) {
          const cardHtml = cardMatch[1]
          
          const linkMatch = cardHtml.match(/<a[^>]*href=["']([^"']+)["'][^>]*>/i)
          if (linkMatch) {
            const href = linkMatch[1]
              const fullUrl = href.startsWith('http') ? href : `https://www.lego.com${href.startsWith('/') ? '' : '/'}${href}`
              
            const pdfIdMatch = fullUrl.match(/product\.bi\.core\.pdf\/(\d+)\.pdf/)
            const pdfId = pdfIdMatch ? pdfIdMatch[1] : null
            
              const titleMatch = cardHtml.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i) || 
                              cardHtml.match(/<span[^>]*class=["'][^"']*title[^"']*["'][^>]*>(.*?)<\/span>/i) ||
                              cardHtml.match(/<p[^>]*class=["'][^"']*title[^"']*["'][^>]*>(.*?)<\/p>/i)
            const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : null
              
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
          break
        }
      } catch (err) {
        console.error(`[LEGO Instructions] Locale ${locale} 실패:`, err.message)
        continue
      }
    }

    // 중복 제거 (URL 기준)
    const uniqueInstructions = []
    const seenUrls = new Set()
    for (const instruction of instructions) {
      if (!seenUrls.has(instruction.url)) {
        seenUrls.add(instruction.url)
        uniqueInstructions.push(instruction)
      }
    }

    return res.status(200).json({
      success: true,
      setNum: mainSetNum,
      count: uniqueInstructions.length,
      results: uniqueInstructions
    })
  } catch (error) {
    console.error('[LEGO Instructions] 오류:', error)
    return res.status(500).json({
      success: false,
      error: error.message || '설명서를 가져오는데 실패했습니다.'
    })
  }
}


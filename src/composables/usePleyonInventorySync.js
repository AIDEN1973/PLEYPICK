import { ref } from 'vue'
import { useSupabase } from './useSupabase'
import { useRebrickable } from './useRebrickable'
import { useDatabase } from './useDatabase'
import { useImageManager } from './useImageManager'

export function usePleyonInventorySync() {
  const { supabase } = useSupabase()
  const { getSet, getSetParts, getElement } = useRebrickable()
  const { 
    saveLegoSet, 
    saveLegoPart, 
    saveLegoColor, 
    saveSetPart, 
    checkSetExists 
  } = useDatabase()
  const { processRebrickableImage, saveImageMetadata } = useImageManager()
  
  const syncing = ref(false)
  const syncProgress = ref(0)
  const syncStatus = ref('')
  const error = ref(null)

  // 세트의 부품 정보가 브릭박스에 있는지 확인
  const checkSetPartsExist = async (setNum) => {
    try {
      // 1. 세트가 브릭박스에 있는지 확인
      const existingSet = await checkSetExists(setNum)
      if (!existingSet) {
        return { setExists: false, partsExist: false }
      }

      // 2. 세트의 부품 정보가 있는지 확인
      const { data: setParts, error: partsError } = await supabase
        .from('set_parts')
        .select('id')
        .eq('set_id', existingSet.id)
        .limit(1)

      if (partsError) {
        console.error('[PleyonSync] 부품 정보 확인 오류:', partsError)
        return { setExists: true, partsExist: false }
      }

      return {
        setExists: true,
        partsExist: setParts && setParts.length > 0
      }
    } catch (err) {
      console.error('[PleyonSync] 세트 부품 정보 확인 실패:', err)
      return { setExists: false, partsExist: false }
    }
  }

  // 세트의 부품 정보를 Rebrickable API에서 가져와서 브릭박스에 등록
  const syncSetParts = async (setNum, skipLLMAnalysis = true) => {
    try {
      syncing.value = true
      error.value = null
      syncProgress.value = 0
      syncStatus.value = `세트 ${setNum} 정보 조회 중...`

      // 1. Rebrickable에서 세트 정보 가져오기 (여러 변형 시도)
      let setInfo
      let actualSetNum = setNum // 실제로 찾은 세트 번호
      try {
        setInfo = await getSet(setNum)
        // getSet이 정규화된 세트 번호를 반환했을 수 있으므로 setInfo.set_num 사용
        if (setInfo && setInfo.set_num) {
          actualSetNum = setInfo.set_num
          console.log(`[PleyonSync] 세트 찾음: ${setNum} → ${actualSetNum}`)
        }
      } catch (err) {
        if (err.message && (err.message.includes('404') || err.message.includes('찾을 수 없습니다'))) {
          throw new Error(`세트 ${setNum}이(가) Rebrickable에 존재하지 않습니다. 세트 번호를 확인해주세요.`)
        }
        throw new Error(`세트 ${setNum} 정보를 가져오는 중 오류가 발생했습니다: ${err.message}`)
      }
      
      if (!setInfo) {
        throw new Error(`세트 ${setNum} 정보를 가져올 수 없습니다.`)
      }

      syncProgress.value = 10
      syncStatus.value = `세트 정보 저장 중...`

      // 2. 세트 정보 저장
      const savedSet = await saveLegoSet({
        set_num: setInfo.set_num,
        name: setInfo.name,
        year: setInfo.year,
        theme_id: setInfo.theme_id,
        num_parts: setInfo.num_parts,
        set_img_url: setInfo.set_img_url,
        set_url: setInfo.set_url,
        last_modified_date: setInfo.last_modified_dt
      })

      syncProgress.value = 20
      syncStatus.value = `부품 정보 조회 중...`

      // 3. 부품 정보 가져오기 (실제 찾은 세트 번호 사용)
      const partsResponse = await getSetParts(actualSetNum)
      const parts = partsResponse.results || []

      if (parts.length === 0) {
        throw new Error(`세트 ${setNum}의 부품 정보를 가져올 수 없습니다.`)
      }

      syncProgress.value = 30
      syncStatus.value = `부품 정보 저장 중... (0/${parts.length})`

      // 4. 부품 정보 저장
      for (let i = 0; i < parts.length; i++) {
        const partData = parts[i]
        
        try {
          // 부품 정보 저장
          const savedPart = await saveLegoPart(partData.part)
          
          // element_id가 있으면 Rebrickable API에서 정확한 색상 정보 가져오기 (set_parts 저장 전)
          let effectiveColorId = partData.color.id
          let elementData = null
          
          if (partData.element_id) {
            try {
              elementData = await getElement(partData.element_id)
              
              // Element ID는 색상 정보를 포함하므로, API에서 가져온 색상 정보를 사용
              if (elementData?.color?.id) {
                effectiveColorId = elementData.color.id
                console.log(`✅ element_id ${partData.element_id}의 실제 색상: ${elementData.color.name} (ID: ${effectiveColorId})`)
                
                // 색상 불일치 감지 및 경고
                if (effectiveColorId !== partData.color.id) {
                  console.warn(`⚠️ 색상 불일치 감지: partData.color.id=${partData.color.id}, elementData.color.id=${effectiveColorId}`)
                  console.warn(`⚠️ element_id 기반 색상(${effectiveColorId})을 사용합니다.`)
                }
              }
            } catch (elementErr) {
              console.warn(`[PleyonSync] element_id ${partData.element_id} 색상 조회 실패:`, elementErr)
              // 실패 시 원본 색상 사용
            }
          }
          
          // 색상 정보 저장 (effectiveColorId 사용)
          const colorToSave = elementData?.color || partData.color
          const savedColor = await saveLegoColor(colorToSave)
          
          // 세트-부품 관계 저장 (effectiveColorId 사용 - 핵심 수정)
          await saveSetPart(
            savedSet.id,
            savedPart.part_num,
            effectiveColorId,   // element_id 기반 색상 사용 (핵심 수정)
            partData.quantity,
            partData.is_spare || false,
            partData.element_id,
            partData.num_sets || 1
          )

          // 4.5. 부품 이미지 저장 (new-lego 페이지와 동일한 로직)
          if (partData?.part?.part_img_url) {
            try {
              // element_id 우선 사용 (가장 정확한 색상 매칭)
              let imageUrl = null
              let imageSource = 'unknown'
              
              // elementData가 이미 조회되었으면 재사용
              if (elementData) {
                if (elementData?.element_img_url) {
                  imageUrl = elementData.element_img_url
                  imageSource = 'element_id'
                } else if (elementData?.part_img_url) {
                  imageUrl = elementData.part_img_url
                  imageSource = 'element_id_part_img'
                }
              } else if (partData.element_id) {
                // elementData가 없으면 다시 조회
                try {
                  elementData = await getElement(partData.element_id)
                  
                  if (elementData?.element_img_url) {
                    imageUrl = elementData.element_img_url
                    imageSource = 'element_id'
                  } else if (elementData?.part_img_url) {
                    imageUrl = elementData.part_img_url
                    imageSource = 'element_id_part_img'
                  }
                } catch (elementErr) {
                  console.warn(`[PleyonSync] element_id ${partData.element_id} 이미지 조회 실패:`, elementErr)
                }
              }
              
              // element_id 실패 시 part_img_url 사용 (fallback)
              if (!imageUrl) {
                imageUrl = partData.part.part_img_url
                imageSource = 'part_num'
              }
              
              // URL 검증: element_id와 URL의 element_id가 일치하는지 확인 (경고만, 계속 진행)
              if (partData.element_id && imageUrl.includes('/elements/')) {
                const urlElementIdMatch = imageUrl.match(/\/elements\/(\d+)\.jpg/)
                if (urlElementIdMatch) {
                  const urlElementId = urlElementIdMatch[1]
                  if (urlElementId !== String(partData.element_id)) {
                    console.warn(`⚠️ URL 불일치: 요청 element_id=${partData.element_id}, URL의 element_id=${urlElementId}`)
                    console.warn(`⚠️ Rebrickable API가 다른 element_id의 URL을 반환했습니다. API 응답을 신뢰하고 계속 진행합니다.`)
                    console.warn(`⚠️ URL: ${imageUrl}`)
                    // API가 반환한 URL을 신뢰하고 계속 진행 (요청한 element_id는 그대로 사용)
                  }
                }
              }
              
              // processRebrickableImage 사용 (element_id 기반 파일명 생성 및 중복 검사 포함)
              const imageResult = await processRebrickableImage(
                imageUrl,
                partData.part.part_num,
                effectiveColorId,
                { elementId: partData.element_id || null, imageSource }
              )
              
              // 이미지 메타데이터 저장
              if (imageResult.uploadedUrl) {
                await saveImageMetadata({
                  original_url: imageUrl,
                  supabase_url: imageResult.uploadedUrl,
                  file_path: imageResult.path,
                  file_name: imageResult.filename,
                  part_num: partData.part.part_num,
                  color_id: effectiveColorId,
                  element_id: partData.element_id || null,
                  set_num: actualSetNum
                })
                console.log(`[PleyonSync] 부품 이미지 저장 완료: ${partData.part.part_num}`)
              }
            } catch (imageError) {
              console.warn(`[PleyonSync] 부품 ${partData.part.part_num} 이미지 저장 실패:`, imageError)
              // 이미지 저장 실패해도 계속 진행
            }
          }

          syncProgress.value = 30 + Math.floor((i + 1) / parts.length * 70)
          syncStatus.value = `부품 정보 저장 중... (${i + 1}/${parts.length})`
        } catch (partError) {
          console.error(`[PleyonSync] 부품 ${partData.part.part_num} 저장 실패:`, partError)
          // 개별 부품 저장 실패해도 계속 진행
        }
      }

      syncProgress.value = 100
      syncStatus.value = `완료: ${parts.length}개 부품 등록됨`
      
      return {
        success: true,
        setNum,
        partsCount: parts.length
      }
    } catch (err) {
      error.value = err.message
      syncStatus.value = `오류: ${err.message}`
      throw err
    } finally {
      syncing.value = false
    }
  }

  // 여러 세트의 부품 정보를 일괄 동기화
  const syncMultipleSets = async (setNums, skipLLMAnalysis = true) => {
    const results = []
    const total = setNums.length

    for (let i = 0; i < setNums.length; i++) {
      const setNum = setNums[i]
      try {
        syncStatus.value = `동기화 중... (${i + 1}/${total}): ${setNum}`
        const result = await syncSetParts(setNum, skipLLMAnalysis)
        results.push({ setNum, success: true, ...result })
      } catch (err) {
        console.error(`[PleyonSync] 세트 ${setNum} 동기화 실패:`, err)
        results.push({ setNum, success: false, error: err.message })
      }
    }

    return results
  }

  // 플레이온 인벤토리에서 부품 정보가 없는 세트 목록 확인
  const checkInventorySetsPartsStatus = async (inventory) => {
    const statusList = []
    
    for (const item of inventory) {
      const legoSet = item.lego_sets
      if (!legoSet) continue

      const setNum = Array.isArray(legoSet) 
        ? (legoSet[0]?.number || null)
        : (legoSet.number || null)

      if (!setNum) continue

      const status = await checkSetPartsExist(setNum)
      statusList.push({
        setNum,
        setInfo: legoSet,
        ...status
      })
    }

    return statusList
  }

  return {
    syncing,
    syncProgress,
    syncStatus,
    error,
    checkSetPartsExist,
    syncSetParts,
    syncMultipleSets,
    checkInventorySetsPartsStatus
  }
}


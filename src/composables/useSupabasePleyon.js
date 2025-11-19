// 플레이온 Supabase REST API 직접 호출 (Realtime 구독 없이 폴링 방식 사용)
const pleyonSupabaseUrl = import.meta.env.VITE_PLEYON_SUPABASE_URL || 'https://sywkefjwagkddzqarylf.supabase.co'
const pleyonSupabaseKey = import.meta.env.VITE_PLEYON_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5d2tlZmp3YWdrZGR6cWFyeWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxOTA4NjksImV4cCI6MjA2MTc2Njg2OX0.iYg_CO658830li0cUWVOtI1bZsFQwp2tI7nUMinUPyw'

// REST API 직접 호출 헬퍼
const pleyonApiCall = async (endpoint, options = {}) => {
  const url = `${pleyonSupabaseUrl}/rest/v1/${endpoint}`
  const headers = {
    'apikey': pleyonSupabaseKey,
    'Authorization': `Bearer ${pleyonSupabaseKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...options.headers
  }

  const response = await fetch(url, {
    ...options,
    headers
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || `API 호출 실패: ${response.status}`)
  }

  return response.json()
}

export function useSupabasePleyon() {
  const getStoreInfoByEmail = async (email) => {
    try {
      const profileUrl = `profiles?email=eq.${encodeURIComponent(email)}&select=id,email,role,store_id`
      const profiles = await pleyonApiCall(profileUrl)
      const profile = Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : null

      if (!profile || !profile.store_id) {
        return null
      }

      const storeUrl = `stores?id=eq.${profile.store_id}&is_active=eq.true&select=id,name,store_owner_id,store_owner_name,owner_phone,store_phone,address,is_active`
      const stores = await pleyonApiCall(storeUrl)
      const store = Array.isArray(stores) && stores.length > 0 ? stores[0] : null

      if (!store) {
        return null
      }

      const storeUserUrl = `store_users?user_id=eq.${profile.id}&store_id=eq.${store.id}&select=role`
      const storeUsers = await pleyonApiCall(storeUserUrl)
      const storeUser = Array.isArray(storeUsers) && storeUsers.length > 0 ? storeUsers[0] : null

      const role = storeUser?.role || profile.role || 'manager'
      console.log('[Pleyon] 매장 사용자 역할:', {
        email: email,
        storeUserRole: storeUser?.role,
        profileRole: profile.role,
        finalRole: role
      })

      return {
        profile,
        store,
        storeUserRole: role
      }
    } catch (err) {
      console.error('[Pleyon] 매장 정보 조회 오류:', err)
      return null
    }
  }

  const getStoreInventory = async (storeId) => {
    try {
      const inventoryUrl = `lego_inventory?store_id=eq.${storeId}&is_store_display=eq.true&deleted_at=is.null&select=id,quantity,assigned_size,assigned_grade,assigned_fee,is_store_display,lego_set_id,lego_sets:lego_set_id(id,number,name,series,part_count,age_range)`
      const inventory = await pleyonApiCall(inventoryUrl)

      if (!Array.isArray(inventory)) {
        console.log('[Pleyon] 인벤토리 결과가 배열이 아님:', inventory)
        return []
      }

      const processedInventory = inventory.map(item => {
        let legoSet = null
        if (item.lego_sets) {
          if (Array.isArray(item.lego_sets) && item.lego_sets.length > 0) {
            legoSet = item.lego_sets[0]
          } else if (!Array.isArray(item.lego_sets)) {
            legoSet = item.lego_sets
          }
        }
        
        return {
          ...item,
          lego_sets: legoSet
        }
      })

      console.log('[Pleyon] 처리된 인벤토리 샘플:', processedInventory.slice(0, 2))
      return processedInventory
    } catch (err) {
      console.error('[Pleyon] 인벤토리 조회 오류:', err)
      return []
    }
  }

  // Pleyon Realtime 구독: lego_inventory 테이블 변경 감지
  // 임시로 폴링 방식으로 구현 (Supabase 클라이언트 초기화 오류 우회)
  const subscribeToInventoryChanges = (storeId, onInsert, onUpdate, onDelete) => {
    console.warn('[Pleyon] Realtime 구독 대신 폴링 방식 사용 (30초 간격)')
    
    let pollingInterval = null
    let lastInventory = []
    
    const checkInventoryChanges = async () => {
      try {
        const currentInventory = await getStoreInventory(storeId)
        
        if (lastInventory.length === 0) {
          // 첫 로드
          lastInventory = currentInventory
          return
        }
        
        // 변경 감지 (단순 비교)
        if (JSON.stringify(currentInventory) !== JSON.stringify(lastInventory)) {
          console.log('[Pleyon] 인벤토리 변경 감지 (폴링)')
          
          // INSERT 감지
          const newItems = currentInventory.filter(curr => 
            !lastInventory.find(last => last.id === curr.id)
          )
          newItems.forEach(item => {
            if (onInsert) onInsert(item)
          })
          
          // UPDATE 감지
          currentInventory.forEach(curr => {
            const old = lastInventory.find(last => last.id === curr.id)
            if (old && JSON.stringify(curr) !== JSON.stringify(old)) {
              if (onUpdate) onUpdate(curr, old)
            }
          })
          
          // DELETE 감지
          const deletedItems = lastInventory.filter(last => 
            !currentInventory.find(curr => curr.id === last.id)
          )
          deletedItems.forEach(item => {
            if (onDelete) onDelete(item)
          })
          
          lastInventory = currentInventory
        }
      } catch (err) {
        console.error('[Pleyon] 폴링 중 오류:', err)
      }
    }
    
    // 초기 로드
    getStoreInventory(storeId).then(inventory => {
      lastInventory = inventory
    })
    
    // 30초마다 폴링
    pollingInterval = setInterval(checkInventoryChanges, 30000)
    
    return {
      unsubscribe: () => {
        if (pollingInterval) {
          clearInterval(pollingInterval)
          pollingInterval = null
          console.log('[Pleyon] 폴링 중지')
        }
      }
    }
  }

  return {
    getStoreInfoByEmail,
    getStoreInventory,
    subscribeToInventoryChanges
  }
}


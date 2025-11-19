// 플레이온 Supabase REST API 직접 호출 (GoTrueClient 경고 방지)
// 동적 import로 변경하여 빌드 시점 오류 방지

const pleyonSupabaseUrl = import.meta.env.VITE_PLEYON_SUPABASE_URL || 'https://sywkefjwagkddzqarylf.supabase.co'
const pleyonSupabaseKey = import.meta.env.VITE_PLEYON_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5d2tlZmp3YWdrZGR6cWFyeWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxOTA4NjksImV4cCI6MjA2MTc2Njg2OX0.iYg_CO658830li0cUWVOtI1bZsFQwp2tI7nUMinUPyw'

// Pleyon Supabase 클라이언트 (Realtime 구독용, custom storage 사용)
let pleyonSupabaseClient = null
const getPleyonSupabaseClient = async () => {
  if (!pleyonSupabaseClient && typeof window !== 'undefined') {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      pleyonSupabaseClient = createClient(pleyonSupabaseUrl, pleyonSupabaseKey, {
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        },
        auth: {
          storage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {}
          }
        }
      })
    } catch (error) {
      console.error('[Pleyon] Supabase 클라이언트 초기화 실패:', error)
    }
  }
  return pleyonSupabaseClient
}

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
      // 클라이언트 초기화 대기
      await getPleyonSupabaseClient()
      
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
      // 클라이언트 초기화 대기
      await getPleyonSupabaseClient()
      
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
  const subscribeToInventoryChanges = (storeId, onInsert, onUpdate, onDelete) => {
    let channel = null
    
    const setupSubscription = async () => {
      const client = await getPleyonSupabaseClient()
      if (!client) {
        console.error('[Pleyon] Supabase 클라이언트를 초기화할 수 없습니다')
        return
      }
      if (channel) {
        client.removeChannel(channel)
      }
      
      channel = client
        .channel(`pleyon_inventory_${storeId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'lego_inventory',
            filter: `store_id=eq.${storeId}`
          },
          (payload) => {
            console.log('[Pleyon] 인벤토리 신규 등록 감지:', payload.new)
            if (onInsert) onInsert(payload.new)
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'lego_inventory',
            filter: `store_id=eq.${storeId}`
          },
          (payload) => {
            console.log('[Pleyon] 인벤토리 업데이트 감지:', payload.new)
            if (onUpdate) onUpdate(payload.new, payload.old)
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'lego_inventory',
            filter: `store_id=eq.${storeId}`
          },
          (payload) => {
            console.log('[Pleyon] 인벤토리 삭제 감지:', payload.old)
            if (onDelete) onDelete(payload.old)
          }
        )
        .subscribe((status) => {
          console.log(`[Pleyon] Realtime 구독 상태: ${status}`)
          if (status === 'SUBSCRIBED') {
            console.log('[Pleyon] 인벤토리 변경사항 실시간 구독 시작')
          } else if (status === 'CHANNEL_ERROR') {
            console.error('[Pleyon] Realtime 구독 오류, 재연결 시도...')
            setTimeout(setupSubscription, 5000)
          }
        })
    }
    
    setupSubscription()
    
    return {
      unsubscribe: () => {
        if (channel) {
          client.removeChannel(channel)
          channel = null
          console.log('[Pleyon] Realtime 구독 해제')
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


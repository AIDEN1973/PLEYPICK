<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <h1>대시보드</h1>
      <p>안녕하세요, {{ user?.email }}님!</p>
    </div>
    
    <div class="dashboard-content">
      <div class="stats-grid">
        <div class="stat-card">
          <h3>총 사용자</h3>
          <p class="stat-number">{{ userCount }}</p>
        </div>
        <div class="stat-card">
          <h3>활성 세션</h3>
          <p class="stat-number">{{ isOnline ? '온라인' : '오프라인' }}</p>
        </div>
        <div class="stat-card">
          <h3>마지막 로그인</h3>
          <p class="stat-number">{{ formatDate(user?.last_sign_in_at) }}</p>
        </div>
      </div>
      
      <div class="actions-grid">
        <div class="action-card">
          <h3>신규 레고 등록</h3>
          <p>Rebrickable API를 통해 새로운 레고 세트를 검색하고 등록하세요.</p>
          <router-link to="/new-lego" class="btn btn-primary">신규 등록</router-link>
        </div>
        <div class="action-card">
          <h3>저장된 레고 관리</h3>
          <p>데이터베이스에 저장된 레고 세트들을 관리하세요.</p>
          <router-link to="/saved-lego" class="btn btn-secondary">저장된 레고</router-link>
        </div>
        <div class="action-card">
          <h3>실시간 부품 검수</h3>
          <p>AI 기반 실시간 부품 검수 시스템을 사용하세요.</p>
          <router-link to="/detection" class="btn btn-success">검수 시작</router-link>
        </div>
        <div class="action-card">
          <h3>통합 비전 검수</h3>
          <p>마스터 DB와 통합된 최적화된 비전 검수 시스템을 사용하세요.</p>
          <router-link to="/integrated-vision" class="btn btn-info">통합 검수</router-link>
        </div>
        <div class="action-card">
          <h3>마스터 데이터 구축</h3>
          <p>Rebrickable API에서 부품을 수집하고 LLM으로 분석하여 마스터 데이터베이스를 구축하세요.</p>
          <router-link to="/master-builder" class="btn btn-warning">데이터 구축</router-link>
        </div>
        <div class="action-card">
          <h3>합성 데이터셋 생성</h3>
          <p>LDraw 3D 모델을 Blender로 렌더링하여 AI 학습용 대규모 합성 데이터셋을 자동 생성하세요.</p>
          <router-link to="/synthetic-dataset" class="btn btn-purple">합성 데이터셋</router-link>
        </div>
        <div class="action-card">
          <h3>시스템 모니터링</h3>
          <p>전체 시스템 상태, 파이프라인, AI 워커, 품질 지표, 테스트 결과를 종합적으로 모니터링하세요.</p>
          <router-link to="/system-monitoring" class="btn btn-info">시스템 모니터링</router-link>
        </div>
        <div class="action-card">
          <h3>프로필 관리</h3>
          <p>사용자 정보를 확인하고 수정하세요.</p>
          <button class="btn btn-secondary">프로필 보기</button>
        </div>
      </div>
      
      <div v-if="storeInfo && storeInfo.store" class="store-info">
        <h3>매장 정보</h3>
        <div class="info-grid">
          <div class="info-item">
            <label>매장명:</label>
            <span>{{ storeInfo.store.name }}</span>
          </div>
          <div class="info-item">
            <label>주소:</label>
            <span>{{ storeInfo.store.address || '정보 없음' }}</span>
          </div>
          <div class="info-item">
            <label>연락처:</label>
            <span>{{ storeInfo.store.store_phone || storeInfo.store.owner_phone || '정보 없음' }}</span>
          </div>
          <div class="info-item">
            <label>역할:</label>
            <span>{{ storeInfo.storeUserRole }}</span>
          </div>
        </div>
      </div>

      <div v-if="storeInfo && storeInfo.store" class="inventory-section">
        <h3>레고 인벤토리 <span v-if="inventory && inventory.length > 0">({{ inventory.length }}개)</span></h3>
        <div v-if="loadingInventory" class="loading">로딩 중...</div>
        <template v-else>
          <div v-if="!inventory || inventory.length === 0" class="empty-inventory">
            등록된 레고 세트가 없습니다.
          </div>
          <div v-else-if="inventory && inventory.length > 0" class="inventory-grid">
            <div v-for="item in inventory" :key="item.id || `inventory-${item.lego_set_id}`" class="inventory-item">
              <div class="inventory-header">
                <h4>{{ getLegoSetName(item) }}</h4>
                <span class="quantity">수량: {{ item.quantity || 0 }}</span>
              </div>
              <div class="inventory-details">
                <div class="detail-item">
                  <label>세트 번호:</label>
                  <span>{{ getLegoSetField(item, 'number') || '-' }}</span>
                </div>
                <div class="detail-item">
                  <label>시리즈:</label>
                  <span>{{ getLegoSetField(item, 'series') || '-' }}</span>
                </div>
                <div class="detail-item">
                  <label>부품 수:</label>
                  <span>{{ getLegoSetField(item, 'part_count') || '-' }}</span>
                </div>
                <div class="detail-item">
                  <label>사용 연령:</label>
                  <span>{{ getLegoSetField(item, 'age_range') || '-' }}</span>
                </div>
                <div v-if="item.assigned_size" class="detail-item">
                  <label>크기:</label>
                  <span>{{ item.assigned_size }}</span>
                </div>
                <div v-if="item.assigned_grade" class="detail-item">
                  <label>등급:</label>
                  <span>{{ item.assigned_grade }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
      
      <div v-else-if="user" class="inventory-section">
        <h3>레고 인벤토리</h3>
        <div class="empty-inventory">
          매장 정보를 불러오는 중이거나 플레이온에 등록되지 않은 계정입니다.
        </div>
      </div>

      <div class="user-info">
        <h3>사용자 정보</h3>
        <div class="info-grid">
          <div class="info-item">
            <label>이메일:</label>
            <span>{{ user?.email }}</span>
          </div>
          <div class="info-item">
            <label>사용자 ID:</label>
            <span>{{ user?.id }}</span>
          </div>
          <div class="info-item">
            <label>가입일:</label>
            <span>{{ formatDate(user?.created_at) }}</span>
          </div>
          <div class="info-item">
            <label>이메일 확인:</label>
            <span :class="{ 'verified': user?.email_confirmed_at, 'unverified': !user?.email_confirmed_at }">
              {{ user?.email_confirmed_at ? '확인됨' : '미확인' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useSupabase } from '../composables/useSupabase'
import { useSupabasePleyon } from '../composables/useSupabasePleyon'

export default {
  name: 'Dashboard',
  setup() {
    const { user, supabase, loading: userLoading } = useSupabase()
    const { getStoreInfoByEmail, getStoreInventory, subscribeToInventoryChanges } = useSupabasePleyon()
    const userCount = ref(0)
    const isOnline = ref(navigator.onLine)
    const storeInfo = ref(null)
    const inventory = ref([])
    const loadingInventory = ref(false)
    let inventorySubscription = null

    const formatDate = (dateString) => {
      if (!dateString) return '정보 없음'
      return new Date(dateString).toLocaleString('ko-KR')
    }

    const getLegoSetName = (item) => {
      if (!item.lego_sets) return '이름 없음'
      if (Array.isArray(item.lego_sets) && item.lego_sets.length > 0) {
        return item.lego_sets[0].name || '이름 없음'
      }
      if (!Array.isArray(item.lego_sets)) {
        return item.lego_sets.name || '이름 없음'
      }
      return '이름 없음'
    }

    const getLegoSetField = (item, field) => {
      if (!item.lego_sets) return null
      if (Array.isArray(item.lego_sets) && item.lego_sets.length > 0) {
        return item.lego_sets[0][field]
      }
      if (!Array.isArray(item.lego_sets)) {
        return item.lego_sets[field]
      }
      return null
    }

    // 브릭박스 DB에 인벤토리 동기화 저장 (별도 테이블 사용)
    const syncInventoryToBrickbox = async (storeId, inventoryData) => {
      try {
        console.log('[Dashboard] 브릭박스 DB에 인벤토리 동기화 시작:', inventoryData.length, '개')
        
        if (!inventoryData || inventoryData.length === 0) {
          console.log('[Dashboard] 동기화할 인벤토리가 없습니다.')
          return
        }
        
        // 각 인벤토리 항목을 store_inventory 테이블에 upsert
        const inventoryItems = inventoryData.map(item => {
          const legoSet = item.lego_sets
          const legoSetNumber = legoSet?.number || null
          
          // lego_set_num으로 lego_sets 테이블에서 id 조회
          let legoSetId = null
          if (legoSetNumber) {
            // 나중에 조회하도록 처리
          }
          
          return {
            store_id: storeId,
            pleyon_inventory_id: item.id,
            lego_set_num: legoSetNumber,
            quantity: item.quantity || 1,
            assigned_size: item.assigned_size || null,
            assigned_grade: item.assigned_grade || null,
            assigned_fee: item.assigned_fee || null,
            is_store_display: item.is_store_display !== false,
            pleyon_data: {
              lego_set_id: item.lego_set_id,
              lego_set: legoSet ? {
                id: legoSet.id,
                number: legoSet.number,
                name: legoSet.name,
                series: legoSet.series,
                part_count: legoSet.part_count,
                age_range: legoSet.age_range
              } : null
            },
            synced_at: new Date().toISOString(),
            last_updated_at: new Date().toISOString()
          }
        })
        
        // lego_set_num으로 lego_sets 테이블에서 id 조회
        const setNumbers = inventoryItems
          .map(item => item.lego_set_num)
          .filter(Boolean)
        
        if (setNumbers.length > 0) {
          const { data: legoSets, error: setsError } = await supabase
            .from('lego_sets')
            .select('id, set_num')
            .in('set_num', setNumbers)
          
          if (!setsError && legoSets) {
            const setNumToIdMap = new Map(legoSets.map(set => [set.set_num, set.id]))
            inventoryItems.forEach(item => {
              if (item.lego_set_num && setNumToIdMap.has(item.lego_set_num)) {
                item.lego_set_id = setNumToIdMap.get(item.lego_set_num)
              }
            })
          }
        }
        
        // 배치로 upsert (최대 100개씩)
        const batchSize = 100
        let successCount = 0
        let errorCount = 0
        
        for (let i = 0; i < inventoryItems.length; i += batchSize) {
          const batch = inventoryItems.slice(i, i + batchSize)
          
          const { data, error } = await supabase
            .from('store_inventory')
            .upsert(batch, {
              onConflict: 'store_id,pleyon_inventory_id',
              ignoreDuplicates: false
            })
            .select()
          
          if (error) {
            console.error(`[Dashboard] 인벤토리 배치 ${i / batchSize + 1} 저장 실패:`, error)
            errorCount += batch.length
          } else {
            successCount += batch.length
            console.log(`[Dashboard] 인벤토리 배치 ${i / batchSize + 1} 저장 완료: ${batch.length}개`)
          }
        }
        
        console.log(`[Dashboard] 브릭박스 DB 인벤토리 동기화 완료: 성공 ${successCount}개, 실패 ${errorCount}개`)
      } catch (err) {
        console.error('[Dashboard] 브릭박스 DB 인벤토리 동기화 중 오류:', err)
      }
    }

    const loadStoreInventory = async () => {
      if (!user.value) {
        console.log('[Dashboard] 사용자 정보 없음')
        return
      }

      loadingInventory.value = true
      try {
        console.log('[Dashboard] 매장 정보 조회 시작:', user.value.email)
        const storeData = await getStoreInfoByEmail(user.value.email)
        console.log('[Dashboard] 매장 정보 조회 결과:', storeData)
        
        if (storeData && storeData.store) {
          storeInfo.value = storeData

          const { store } = storeData
          const { error: storeSyncError } = await supabase
            .from('stores')
            .upsert({
              id: store.id,
              name: store.name,
              location: store.address || null,
              contact: store.store_phone || store.owner_phone || null,
              status: store.is_active ? 'active' : 'inactive',
              config: {
                pleyon_store_id: store.id,
                owner_name: store.store_owner_name,
                owner_phone: store.owner_phone
              },
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'id'
            })

          if (storeSyncError) {
            console.error('[Dashboard] 매장 정보 동기화 실패:', storeSyncError)
          } else {
            console.log('[Dashboard] 매장 정보 동기화 완료')
            
            // 관리자 확인
            const { data: adminData } = await supabase
              .from('admin_users')
              .select('id, role, is_active, email')
              .eq('email', user.value.email)
              .eq('is_active', true)
              .maybeSingle()

            const isAdmin = adminData && (adminData.role === 'admin' || adminData.role === 'super_admin')
            
            // users 테이블 업데이트
            const updateData = {
              store_id: store.id,
              updated_at: new Date().toISOString()
            }
            
            // 관리자가 아니면 role 업데이트, 관리자면 role은 admin 유지
            if (!isAdmin) {
              updateData.role = storeData.storeUserRole === 'owner' ? 'store_owner' : 'store_manager'
            } else {
              updateData.role = 'admin'
            }

            const { error: userUpdateError } = await supabase
              .from('users')
              .update(updateData)
              .eq('id', user.value.id)

            if (userUpdateError) {
              console.error('[Dashboard] 사용자 정보 업데이트 실패:', userUpdateError)
            } else {
              console.log('[Dashboard] 사용자 정보 업데이트 완료 (role:', updateData.role, ')')
            }
          }

          console.log('[Dashboard] 인벤토리 조회 시작:', store.id)
          const inventoryData = await getStoreInventory(store.id)
          console.log('[Dashboard] 인벤토리 조회 결과:', inventoryData)
          console.log('[Dashboard] 인벤토리 개수:', inventoryData?.length || 0)
          if (inventoryData && inventoryData.length > 0) {
            console.log('[Dashboard] 첫 번째 인벤토리 아이템 샘플:', JSON.stringify(inventoryData[0], null, 2))
            console.log('[Dashboard] 첫 번째 아이템의 lego_sets:', inventoryData[0].lego_sets)
          }
          inventory.value = inventoryData || []
          console.log('[Dashboard] inventory.value 설정 완료:', inventory.value.length)
          console.log('[Dashboard] storeInfo.value 상태:', storeInfo.value)
          console.log('[Dashboard] inventory.value 상태:', inventory.value)
          
          // 브릭박스 DB에 인벤토리 동기화 저장
          await syncInventoryToBrickbox(store.id, inventoryData || [])
          
          // Pleyon Realtime 구독 시작
          if (inventorySubscription) {
            try {
              inventorySubscription.unsubscribe()
            } catch (err) {
              console.error('[Dashboard] 기존 구독 해제 실패:', err)
            }
          }
          
          try {
            inventorySubscription = subscribeToInventoryChanges(
              store.id,
              // INSERT: 신규 인벤토리 등록
              async (newItem) => {
                console.log('[Dashboard] 신규 인벤토리 감지, 동기화 중...', newItem)
                const updatedInventory = await getStoreInventory(store.id)
                inventory.value = updatedInventory || []
                await syncInventoryToBrickbox(store.id, updatedInventory || [])
              },
              // UPDATE: 인벤토리 업데이트
              async (newItem, oldItem) => {
                console.log('[Dashboard] 인벤토리 업데이트 감지, 동기화 중...', newItem)
                const updatedInventory = await getStoreInventory(store.id)
                inventory.value = updatedInventory || []
                await syncInventoryToBrickbox(store.id, updatedInventory || [])
              },
              // DELETE: 인벤토리 삭제
              async (oldItem) => {
                console.log('[Dashboard] 인벤토리 삭제 감지, 동기화 중...', oldItem)
                const updatedInventory = await getStoreInventory(store.id)
                inventory.value = updatedInventory || []
                await syncInventoryToBrickbox(store.id, updatedInventory || [])
              }
            )
          } catch (err) {
            console.error('[Dashboard] Realtime 구독 설정 실패:', err)
            // 구독 실패해도 인벤토리는 표시
          }
        } else {
          console.log('[Dashboard] 매장 정보 없음 - 플레이온에 등록되지 않은 계정일 수 있습니다.')
          storeInfo.value = null
          inventory.value = []
        }
      } catch (err) {
        console.error('[Dashboard] 인벤토리 로드 실패:', err)
        storeInfo.value = null
        inventory.value = []
      } finally {
        loadingInventory.value = false
      }
    }

    watch(user, async (newUser) => {
      if (newUser && !userLoading.value) {
        console.log('[Dashboard] watch user - 사용자 확인:', newUser.email)
        await loadStoreInventory()
        console.log('[Dashboard] watch user - 인벤토리 로드 완료, storeInfo:', storeInfo.value)
        console.log('[Dashboard] watch user - inventory:', inventory.value)
      }
    }, { immediate: true })

    onMounted(async () => {
      window.addEventListener('online', () => isOnline.value = true)
      window.addEventListener('offline', () => isOnline.value = false)
      
      userCount.value = 0

      if (!userLoading.value && user.value) {
        console.log('[Dashboard] onMounted - 사용자 확인:', user.value.email)
        await loadStoreInventory()
        console.log('[Dashboard] onMounted - 인벤토리 로드 완료, storeInfo:', storeInfo.value)
        console.log('[Dashboard] onMounted - inventory:', inventory.value)
      } else if (userLoading.value) {
        console.log('[Dashboard] onMounted - 사용자 로딩 중...')
      } else {
        console.log('[Dashboard] onMounted - 사용자 없음')
      }
    })

    onUnmounted(() => {
      // Realtime 구독 해제
      if (inventorySubscription) {
        inventorySubscription.unsubscribe()
        inventorySubscription = null
        console.log('[Dashboard] Realtime 구독 해제 완료')
      }
    })

    return {
      user,
      userCount,
      isOnline,
      formatDate,
      storeInfo,
      inventory,
      loadingInventory,
      getLegoSetName,
      getLegoSetField
    }
  }
}
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  text-align: center;
  margin-bottom: 3rem;
}

.dashboard-header h1 {
  font-size: 2.5rem;
  color: #333;
  margin-bottom: 0.5rem;
}

.dashboard-header p {
  color: #666;
  font-size: 1.1rem;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  text-align: center;
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-5px);
}

.stat-card h3 {
  color: #666;
  font-size: 1rem;
  margin-bottom: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: 700;
  color: #333;
  margin: 0;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.action-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.action-card:hover {
  transform: translateY(-5px);
}

.action-card h3 {
  color: #333;
  margin-bottom: 1rem;
  font-size: 1.3rem;
}

.action-card p {
  color: #666;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.user-info {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.user-info h3 {
  color: #333;
  margin-bottom: 1.5rem;
  font-size: 1.3rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-item label {
  font-weight: 600;
  color: #666;
  font-size: 0.9rem;
}

.info-item span {
  color: #333;
  font-family: monospace;
  background: #f8f9fa;
  padding: 0.5rem;
  border-radius: 6px;
  word-break: break-all;
}

.store-info {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
}

.store-info h3 {
  color: #333;
  margin-bottom: 1.5rem;
  font-size: 1.3rem;
}

.inventory-section {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  margin-bottom: 2rem;
}

.inventory-section h3 {
  color: #333;
  margin-bottom: 1.5rem;
  font-size: 1.3rem;
}

.loading, .empty-inventory {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.inventory-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.inventory-item {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #e1e5e9;
}

.inventory-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e1e5e9;
}

.inventory-header h4 {
  margin: 0;
  color: #333;
  font-size: 1.1rem;
}

.quantity {
  background: #667eea;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
}

.inventory-details {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-item label {
  font-size: 0.85rem;
  color: #666;
  font-weight: 500;
}

.detail-item span {
  color: #333;
  font-size: 0.95rem;
}

.verified {
  color: #28a745 !important;
}

.unverified {
  color: #dc3545 !important;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-block;
  text-align: center;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: #f8f9fa;
  color: #333;
  border: 2px solid #e1e5e9;
}

.btn-secondary:hover {
  background: #e9ecef;
}

.btn-success {
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  color: white;
}

.btn-success:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(40, 167, 69, 0.4);
}

.btn-info {
  background: linear-gradient(135deg, #17a2b8 0%, #6f42c1 100%);
  color: white;
}

.btn-info:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(23, 162, 184, 0.4);
}

.btn-warning {
  background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%);
  color: white;
}

.btn-warning:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(255, 193, 7, 0.4);
}

.btn-purple {
  background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%);
  color: white;
}

.btn-purple:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(111, 66, 193, 0.4);
}

@media (max-width: 768px) {
  .dashboard-header h1 {
    font-size: 2rem;
  }
  
  .stats-grid,
  .actions-grid {
    grid-template-columns: 1fr;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>

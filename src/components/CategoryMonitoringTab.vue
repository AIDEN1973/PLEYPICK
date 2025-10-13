<template>
  <div class="category-monitoring-tab">
    <!-- 헤더 -->
    <div class="header-section">
      <div class="title-group">
        <h2>📊 카테고리 모니터링</h2>
        <p class="description">Unknown 카테고리 로그 분석 및 분기별 검토</p>
      </div>
      <div class="action-buttons">
        <button @click="refreshData" class="btn-refresh" :disabled="loading">
          <span v-if="loading">🔄 로딩 중...</span>
          <span v-else>🔄 새로고침</span>
        </button>
        <button @click="generateReport" class="btn-report" :disabled="loading">
          📈 분기 리포트 생성
        </button>
      </div>
    </div>

    <!-- 통계 카드 -->
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-icon">🔍</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.unique_shapes || 0 }}</div>
          <div class="stat-label">Unknown 형태</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📦</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.unique_parts || 0 }}</div>
          <div class="stat-label">Unknown 부품</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🎯</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.total_detections || 0 }}</div>
          <div class="stat-label">총 검출 횟수</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📅</div>
        <div class="stat-content">
          <div class="stat-value">{{ quarterlyStats.high_priority || 0 }}</div>
          <div class="stat-label">HIGH Priority</div>
        </div>
      </div>
    </div>

    <!-- 탭 선택 -->
    <div class="sub-tabs">
      <button 
        :class="['sub-tab', { active: subTab === 'summary' }]"
        @click="subTab = 'summary'"
      >
        📊 요약
      </button>
      <button 
        :class="['sub-tab', { active: subTab === 'detail' }]"
        @click="subTab = 'detail'"
      >
        📋 상세
      </button>
      <button 
        :class="['sub-tab', { active: subTab === 'report' }]"
        @click="subTab = 'report'"
      >
        📈 분기 리포트
      </button>
      <button 
        :class="['sub-tab', { active: subTab === 'categories' }]"
        @click="subTab = 'categories'"
      >
        🏷️ 등록된 카테고리
      </button>
    </div>

    <!-- 탭 콘텐츠 -->
    <div class="tab-content">
      <!-- 요약 탭 -->
      <div v-if="subTab === 'summary'" class="summary-content">
        <h3>Unknown 카테고리 요약 (10회 이상 검출)</h3>
        <div v-if="loading" class="loading">로딩 중...</div>
        <div v-else-if="unknownSummary.length === 0" class="empty-state">
          ✅ Unknown 카테고리가 없습니다!
        </div>
        <div v-else class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Shape Tag</th>
                <th>부품 수</th>
                <th>총 검출</th>
                <th>평균 검출/부품</th>
                <th>첫 발견</th>
                <th>최근 발견</th>
                <th>샘플 부품명</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in unknownSummary" :key="item.shape_tag">
                <td class="shape-tag">{{ item.shape_tag }}</td>
                <td class="text-center">{{ item.unique_parts_count }}</td>
                <td class="text-center">
                  <span :class="getPriorityBadge(item.total_detections)">
                    {{ item.total_detections }}
                  </span>
                </td>
                <td class="text-center">{{ item.avg_detections_per_part?.toFixed(1) }}</td>
                <td class="text-small">{{ formatDate(item.first_seen) }}</td>
                <td class="text-small">{{ formatDate(item.last_seen) }}</td>
                <td class="text-small">
                  <div class="sample-names">
                    {{ item.sample_part_names?.slice(0, 2).join(', ') }}
                    <span v-if="item.sample_part_names?.length > 2">...</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 상세 탭 -->
      <div v-if="subTab === 'detail'" class="detail-content">
        <h3>부품별 상세 정보</h3>
        <div v-if="loading" class="loading">로딩 중...</div>
        <div v-else-if="unknownDetails.length === 0" class="empty-state">
          ✅ Unknown 부품이 없습니다!
        </div>
        <div v-else class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Part ID</th>
                <th>부품명</th>
                <th>Shape Tag</th>
                <th>검출 횟수</th>
                <th>첫 발견</th>
                <th>최근 발견</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in unknownDetails.slice(0, 50)" :key="item.part_id">
                <td class="part-id">{{ item.part_id }}</td>
                <td class="part-name">{{ item.part_name || '-' }}</td>
                <td class="shape-tag">{{ item.shape_tag }}</td>
                <td class="text-center">{{ item.detected_count }}</td>
                <td class="text-small">{{ formatDate(item.first_detected_at) }}</td>
                <td class="text-small">{{ formatDate(item.last_detected_at) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="unknownDetails.length > 50" class="pagination-info">
            상위 50개만 표시 중 (전체: {{ unknownDetails.length }}개)
          </div>
        </div>
      </div>

      <!-- 분기 리포트 탭 -->
      <div v-if="subTab === 'report'" class="report-content">
        <h3>분기별 검토 리포트</h3>
        <div class="report-filters">
          <label>
            최소 검출 횟수:
            <input v-model.number="reportMinDetections" type="number" min="1" max="1000" />
          </label>
          <button @click="generateReport" class="btn-primary" :disabled="loading">
            리포트 생성
          </button>
        </div>

        <div v-if="loading" class="loading">리포트 생성 중...</div>
        <div v-else-if="quarterlyReport.length === 0" class="empty-state">
          리포트를 생성하려면 버튼을 클릭하세요.
        </div>
        <div v-else class="report-results">
          <div class="report-summary">
            <h4>📊 요약</h4>
            <ul>
              <li>🔴 HIGH Priority: {{ quarterlyStats.high_priority }}개 (100+ 검출)</li>
              <li>🟡 MEDIUM Priority: {{ quarterlyStats.medium_priority }}개 (50-99 검출)</li>
              <li>🟢 LOW Priority: {{ quarterlyStats.low_priority }}개 ({{ reportMinDetections }}-49 검출)</li>
            </ul>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Shape Tag</th>
                  <th>부품 수</th>
                  <th>총 검출</th>
                  <th>첫 발견</th>
                  <th>최근 발견</th>
                  <th>권장 사항</th>
                  <th>샘플 부품</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in quarterlyReport" :key="item.shape_tag">
                  <td class="shape-tag">{{ item.shape_tag }}</td>
                  <td class="text-center">{{ item.parts_count }}</td>
                  <td class="text-center">
                    <span :class="getPriorityBadge(item.total_detections)">
                      {{ item.total_detections }}
                    </span>
                  </td>
                  <td class="text-small">{{ formatDate(item.first_seen) }}</td>
                  <td class="text-small">{{ formatDate(item.last_seen) }}</td>
                  <td class="recommendation">{{ item.recommendation }}</td>
                  <td class="text-small">
                    <div class="sample-names">
                      {{ item.sample_parts?.slice(0, 2).join(', ') }}
                      <span v-if="item.sample_parts?.length > 2">...</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="report-actions">
            <h4>💡 다음 단계</h4>
            <p>HIGH priority 카테고리를 검토하고 필요시 추가하세요:</p>
            <pre class="sql-template">
-- 카테고리 추가 템플릿
INSERT INTO part_categories (id, code, display_name, display_name_ko, category_type, sort_order)
VALUES (30, 'new_category', 'New Category', '신규 카테고리', 'shape', 30);

-- 기존 부품 마이그레이션
UPDATE parts_master_features
SET part_category = 30, shape_tag = 'new_category'
WHERE shape_tag = 'unknown' AND LOWER(part_name) LIKE '%new_category%';

-- 로그 정리
SELECT cleanup_resolved_category_logs('new_category');
            </pre>
          </div>
        </div>
      </div>

      <!-- 등록된 카테고리 탭 -->
      <div v-if="subTab === 'categories'" class="categories-content">
        <div class="categories-header">
          <h3>등록된 카테고리 ({{ registeredCategories.length }}개)</h3>
          <button @click="showAddCategoryForm = true" class="btn-add">
            ➕ 신규 카테고리 추가
          </button>
        </div>

        <!-- 신규 카테고리 추가 폼 -->
        <div v-if="showAddCategoryForm" class="add-category-form">
          <h4>새 카테고리 추가</h4>
          <div class="form-grid">
            <div class="form-field">
              <label>ID (30-98) *</label>
              <input v-model.number="newCategory.id" type="number" min="30" max="98" placeholder="30" />
              <small>30-98 범위 (1-29: 기본, 99: unknown)</small>
            </div>
            <div class="form-field">
              <label>Code *</label>
              <input v-model="newCategory.code" type="text" placeholder="connector" />
              <small>영문 소문자, 언더스코어(_) 사용</small>
            </div>
            <div class="form-field">
              <label>표시명 (영문) *</label>
              <input v-model="newCategory.display_name" type="text" placeholder="Connector" />
            </div>
            <div class="form-field">
              <label>한글명</label>
              <input v-model="newCategory.display_name_ko" type="text" placeholder="연결부" />
            </div>
            <div class="form-field">
              <label>타입 *</label>
              <select v-model="newCategory.category_type">
                <option value="shape">shape (형태)</option>
                <option value="special">special (특수)</option>
              </select>
            </div>
            <div class="form-field">
              <label>정렬 순서</label>
              <input v-model.number="newCategory.sort_order" type="number" :placeholder="newCategory.id" />
              <small>미입력시 ID와 동일</small>
            </div>
            <div class="form-field full-width">
              <label>설명</label>
              <textarea v-model="newCategory.description" placeholder="선택사항" rows="2"></textarea>
            </div>
          </div>
          <div class="form-actions">
            <button @click="addCategory" class="btn-primary" :disabled="!isFormValid || loading">
              ✅ 추가
            </button>
            <button @click="cancelAddCategory" class="btn-cancel" :disabled="loading">
              취소
            </button>
          </div>
        </div>

        <div v-if="loading" class="loading">로딩 중...</div>
        <div v-else class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Code</th>
                <th>표시명</th>
                <th>한글명</th>
                <th>타입</th>
                <th>부품 수</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="cat in registeredCategories" :key="cat.id">
                <td class="text-center">{{ cat.id }}</td>
                <td class="code">{{ cat.code }}</td>
                <td>{{ cat.display_name }}</td>
                <td>{{ cat.display_name_ko }}</td>
                <td class="text-center">{{ cat.category_type }}</td>
                <td class="text-center">{{ cat.parts_count || 0 }}</td>
                <td class="text-center">
                  <span :class="['status-badge', cat.is_active ? 'active' : 'inactive']">
                    {{ cat.is_active ? '활성' : '비활성' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../composables/useSupabase'

const loading = ref(false)
const subTab = ref('summary')

// 데이터
const unknownSummary = ref([])
const unknownDetails = ref([])
const quarterlyReport = ref([])
const registeredCategories = ref([])
const stats = ref({})

// 리포트 설정
const reportMinDetections = ref(10)

// 신규 카테고리 추가
const showAddCategoryForm = ref(false)
const newCategory = ref({
  id: null,
  code: '',
  display_name: '',
  display_name_ko: '',
  category_type: 'shape',
  sort_order: null,
  description: ''
})

// 폼 유효성 검사
const isFormValid = computed(() => {
  const cat = newCategory.value
  return (
    cat.id >= 30 && cat.id <= 98 &&
    cat.code && cat.code.trim().length > 0 &&
    cat.display_name && cat.display_name.trim().length > 0 &&
    cat.category_type
  )
})

// 분기별 통계
const quarterlyStats = computed(() => {
  const high = quarterlyReport.value.filter(r => r.total_detections >= 100).length
  const medium = quarterlyReport.value.filter(r => r.total_detections >= 50 && r.total_detections < 100).length
  const low = quarterlyReport.value.filter(r => r.total_detections < 50).length
  return { high_priority: high, medium_priority: medium, low_priority: low }
})

// ✅ 최적화: 데이터 로드 병렬화
async function loadData() {
  loading.value = true
  try {
    // ✅ 3개의 쿼리를 병렬로 실행 (Promise.all 사용)
    const [summaryResult, detailsResult, categoriesResult] = await Promise.all([
      // 요약 조회
      supabase
        .from('v_unknown_categories_summary')
        .select('*'),
      
      // 상세 조회
      supabase
        .from('v_unknown_parts_detail')
        .select('*')
        .limit(100),
      
      // 등록된 카테고리 조회
      supabase
        .from('v_part_categories_stats')
        .select('*')
        .order('sort_order', { ascending: true })
    ])

    // 결과 할당
    const summary = summaryResult.data
    unknownSummary.value = summary || []
    unknownDetails.value = detailsResult.data || []
    registeredCategories.value = categoriesResult.data || []

    // 통계 계산
    if (summary && summary.length > 0) {
      stats.value = {
        unique_shapes: summary.length,
        unique_parts: summary.reduce((sum, s) => sum + (s.unique_parts_count || 0), 0),
        total_detections: summary.reduce((sum, s) => sum + (s.total_detections || 0), 0)
      }
    } else {
      stats.value = { unique_shapes: 0, unique_parts: 0, total_detections: 0 }
    }
  } catch (error) {
    console.error('데이터 로드 실패:', error)
    alert('데이터 로드 중 오류가 발생했습니다.')
  } finally {
    loading.value = false
  }
}

// 분기 리포트 생성
async function generateReport() {
  loading.value = true
  try {
    const { data, error } = await supabase.rpc('generate_category_review_report', {
      p_min_detections: reportMinDetections.value,
      p_date_from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() // 90일
    })

    if (error) throw error
    quarterlyReport.value = data || []
    subTab.value = 'report'
  } catch (error) {
    console.error('리포트 생성 실패:', error)
    alert('리포트 생성 중 오류가 발생했습니다.')
  } finally {
    loading.value = false
  }
}

// 새로고침
async function refreshData() {
  await loadData()
}

// Priority 뱃지
function getPriorityBadge(count) {
  if (count >= 100) return 'badge-high'
  if (count >= 50) return 'badge-medium'
  return 'badge-low'
}

// 날짜 포맷
function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// 신규 카테고리 추가
async function addCategory() {
  if (!isFormValid.value) {
    alert('필수 항목을 모두 입력해주세요.')
    return
  }

  loading.value = true
  try {
    const cat = newCategory.value
    const { error } = await supabase
      .from('part_categories')
      .insert({
        id: cat.id,
        code: cat.code.trim().toLowerCase(),
        display_name: cat.display_name.trim(),
        display_name_ko: cat.display_name_ko?.trim() || null,
        category_type: cat.category_type,
        sort_order: cat.sort_order || cat.id,
        description: cat.description?.trim() || null,
        is_active: true
      })

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        alert('이미 존재하는 ID 또는 Code입니다.')
      } else {
        throw error
      }
      return
    }

    alert('✅ 카테고리가 추가되었습니다!')
    
    // 폼 초기화 및 닫기
    cancelAddCategory()
    
    // 데이터 새로고침
    await loadData()
    
    // useMasterPartsPreprocessing의 캐시도 새로고침하도록 안내
    console.info('💡 새 카테고리 반영을 위해 페이지를 새로고침하세요.')
  } catch (error) {
    console.error('카테고리 추가 실패:', error)
    alert(`카테고리 추가 실패: ${error.message}`)
  } finally {
    loading.value = false
  }
}

// 카테고리 추가 취소
function cancelAddCategory() {
  showAddCategoryForm.value = false
  newCategory.value = {
    id: null,
    code: '',
    display_name: '',
    display_name_ko: '',
    category_type: 'shape',
    sort_order: null,
    description: ''
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.category-monitoring-tab {
  padding: 1.5rem;
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.title-group h2 {
  font-size: 1.5rem;
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.description {
  color: #7f8c8d;
  font-size: 0.95rem;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-refresh,
.btn-report,
.btn-primary {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-refresh {
  background: #3498db;
  color: white;
}

.btn-refresh:hover:not(:disabled) {
  background: #2980b9;
}

.btn-report {
  background: #27ae60;
  color: white;
}

.btn-report:hover:not(:disabled) {
  background: #229954;
}

.btn-primary {
  background: #e67e22;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #d35400;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 통계 카드 */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  gap: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.stat-icon {
  font-size: 2.5rem;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: #2c3e50;
}

.stat-label {
  color: #7f8c8d;
  font-size: 0.9rem;
  margin-top: 0.25rem;
}

/* 서브 탭 */
.sub-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #ecf0f1;
}

.sub-tab {
  padding: 0.75rem 1.5rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.95rem;
  color: #7f8c8d;
  border-bottom: 3px solid transparent;
  transition: all 0.2s;
}

.sub-tab:hover {
  color: #2c3e50;
}

.sub-tab.active {
  color: #3498db;
  border-bottom-color: #3498db;
  font-weight: 600;
}

/* 테이블 */
.table-container {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #ecf0f1;
}

.data-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
}

.data-table tr:hover {
  background: #f8f9fa;
}

.text-center {
  text-align: center !important;
}

.text-small {
  font-size: 0.85rem;
  color: #7f8c8d;
}

.shape-tag {
  font-family: 'Courier New', monospace;
  background: #f0f0f0;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.9rem;
}

.part-id,
.code {
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  color: #e67e22;
}

.sample-names {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 뱃지 */
.badge-high,
.badge-medium,
.badge-low {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.badge-high {
  background: #fee;
  color: #c00;
}

.badge-medium {
  background: #ffeaa7;
  color: #d63031;
}

.badge-low {
  background: #d4edda;
  color: #155724;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.status-badge.active {
  background: #d4edda;
  color: #155724;
}

.status-badge.inactive {
  background: #f8d7da;
  color: #721c24;
}

/* 로딩 & 빈 상태 */
.loading,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #7f8c8d;
  font-size: 1.1rem;
}

.pagination-info {
  text-align: center;
  padding: 1rem;
  color: #7f8c8d;
  font-size: 0.9rem;
  background: #f8f9fa;
}

/* 리포트 */
.report-filters {
  margin-bottom: 1.5rem;
  display: flex;
  gap: 1rem;
  align-items: center;
}

.report-filters label {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.report-filters input {
  width: 100px;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.report-summary {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.report-summary h4 {
  margin-bottom: 1rem;
  color: #2c3e50;
}

.report-summary ul {
  list-style: none;
  padding: 0;
}

.report-summary li {
  padding: 0.5rem 0;
  font-size: 1rem;
}

.recommendation {
  font-size: 0.85rem;
  font-weight: 600;
}

.report-actions {
  background: #fff3cd;
  padding: 1.5rem;
  border-radius: 8px;
  margin-top: 1.5rem;
}

.report-actions h4 {
  margin-bottom: 0.5rem;
  color: #856404;
}

.sql-template {
  background: #2c3e50;
  color: #ecf0f1;
  padding: 1rem;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 0.9rem;
  margin-top: 1rem;
}

/* 카테고리 헤더 */
.categories-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.categories-header h3 {
  margin: 0;
}

.btn-add {
  padding: 0.6rem 1.2rem;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-add:hover {
  background: #229954;
}

/* 신규 카테고리 추가 폼 */
.add-category-form {
  background: #f8f9fa;
  border: 2px solid #3498db;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.add-category-form h4 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #2c3e50;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
}

.form-field.full-width {
  grid-column: 1 / -1;
}

.form-field label {
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: #2c3e50;
  font-size: 0.9rem;
}

.form-field input,
.form-field select,
.form-field textarea {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

.form-field input:focus,
.form-field select:focus,
.form-field textarea:focus {
  outline: none;
  border-color: #3498db;
}

.form-field small {
  margin-top: 0.25rem;
  color: #7f8c8d;
  font-size: 0.75rem;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 0.6rem 1.2rem;
  background: #95a5a6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-cancel:hover:not(:disabled) {
  background: #7f8c8d;
}
</style>


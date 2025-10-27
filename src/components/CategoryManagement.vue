<template>
  <div class="category-management">
    <div class="header">
      <h2>카테고리 관리</h2>
      <div class="actions">
        <button @click="refreshCategories" :disabled="loading" class="btn-primary">
          {{ loading ? '로딩 중...' : '새로고침' }}
        </button>
        <button @click="showAddForm = true" class="btn-secondary">
          새 카테고리 추가
        </button>
      </div>
    </div>

    <!-- 카테고리 목록 -->
    <div class="categories-section">
      <h3>활성 카테고리 ({{ categories.length }}개)</h3>
      <div class="category-grid">
        <div 
          v-for="category in categories" 
          :key="category.id"
          class="category-card"
          :class="`type-${category.category_type}`"
        >
          <div class="category-header">
            <span class="code">{{ category.code }}</span>
            <span class="type">{{ category.category_type }}</span>
          </div>
          <div class="category-names">
            <div class="display-name">{{ category.display_name }}</div>
            <div class="display-name-ko">{{ category.display_name_ko }}</div>
          </div>
          <div class="category-meta">
            <span class="sort-order">순서: {{ category.sort_order }}</span>
            <span class="status" :class="{ active: category.is_active }">
              {{ category.is_active ? '활성' : '비활성' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 승인 대기 카테고리 -->
    <div v-if="pendingCategories.length > 0" class="pending-section">
      <h3>승인 대기 카테고리 ({{ pendingCategories.length }}개)</h3>
      <div class="pending-grid">
        <div 
          v-for="category in pendingCategories" 
          :key="category.id"
          class="pending-card"
        >
          <div class="pending-header">
            <span class="code">{{ category.code }}</span>
            <span class="type">{{ category.category_type }}</span>
          </div>
          <div class="pending-names">
            <div class="display-name">{{ category.display_name }}</div>
            <div class="display-name-ko">{{ category.display_name_ko }}</div>
          </div>
          <div class="pending-actions">
            <button @click="approveCategory(category.id)" class="btn-approve">
              승인
            </button>
            <button @click="openRejectDialog(category)" class="btn-reject">
              거부
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 새 카테고리 추가 폼 -->
    <div v-if="showAddForm" class="add-form-overlay" @click="closeAddForm">
      <div class="add-form" @click.stop>
        <h3>새 카테고리 추가</h3>
        <form @submit.prevent="addNewCategory">
          <div class="form-group">
            <label>코드 (영문)</label>
            <input v-model="newCategory.code" required placeholder="예: new_shape" />
          </div>
          <div class="form-group">
            <label>영문명</label>
            <input v-model="newCategory.display_name" required placeholder="예: New Shape" />
          </div>
          <div class="form-group">
            <label>한글명</label>
            <input v-model="newCategory.display_name_ko" required placeholder="예: 새로운 형태" />
          </div>
          <div class="form-group">
            <label>카테고리 타입</label>
            <select v-model="newCategory.category_type" required>
              <option value="shape">Shape (형태)</option>
              <option value="function">Function (기능)</option>
              <option value="connection">Connection (연결)</option>
              <option value="color">Color (색상)</option>
            </select>
          </div>
          <div class="form-group">
            <label>설명</label>
            <textarea v-model="newCategory.description" placeholder="카테고리 설명"></textarea>
          </div>
          <div class="form-actions">
            <button type="submit" :disabled="loading" class="btn-primary">
              {{ loading ? '추가 중...' : '추가' }}
            </button>
            <button type="button" @click="closeAddForm" class="btn-secondary">
              취소
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 거부 다이얼로그 -->
    <div v-if="showRejectDialog" class="reject-dialog-overlay" @click="closeRejectDialog">
      <div class="reject-dialog" @click.stop>
        <h3>카테고리 거부</h3>
        <p>거부 사유를 입력하세요:</p>
        <textarea v-model="rejectReason" placeholder="거부 사유를 입력하세요..."></textarea>
        <div class="dialog-actions">
          <button @click="confirmReject" class="btn-reject">거부</button>
          <button @click="closeRejectDialog" class="btn-secondary">취소</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useCategoryManagement } from '@/composables/useCategoryManagement'

const {
  loading,
  error,
  categories,
  pendingCategories,
  fetchCategories,
  suggestNewCategory,
  approveCategory: approveCategoryAPI,
  rejectCategory: rejectCategoryAPI
} = useCategoryManagement()

const showAddForm = ref(false)
const showRejectDialog = ref(false)
const selectedCategory = ref(null)
const rejectReason = ref('')

const newCategory = ref({
  code: '',
  display_name: '',
  display_name_ko: '',
  category_type: 'shape',
  description: ''
})

onMounted(() => {
  fetchCategories()
})

const refreshCategories = () => {
  fetchCategories()
}

const addNewCategory = async () => {
  try {
    await suggestNewCategory(newCategory.value)
    showAddForm.value = false
    newCategory.value = {
      code: '',
      display_name: '',
      display_name_ko: '',
      category_type: 'shape',
      description: ''
    }
    await fetchCategories()
  } catch (err) {
    console.error('카테고리 추가 실패:', err)
  }
}

const closeAddForm = () => {
  showAddForm.value = false
}

const approveCategory = async (categoryId) => {
  try {
    await approveCategoryAPI(categoryId)
    await fetchCategories()
  } catch (err) {
    console.error('카테고리 승인 실패:', err)
  }
}

const openRejectDialog = (category) => {
  selectedCategory.value = category
  showRejectDialog.value = true
  rejectReason.value = ''
}

const closeRejectDialog = () => {
  showRejectDialog.value = false
  selectedCategory.value = null
  rejectReason.value = ''
}

const confirmReject = async () => {
  if (!selectedCategory.value) return
  
  try {
    await rejectCategoryAPI(selectedCategory.value.id, rejectReason.value)
    await fetchCategories()
    closeRejectDialog()
  } catch (err) {
    console.error('카테고리 거부 실패:', err)
  }
}
</script>

<style scoped>
.category-management {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.actions {
  display: flex;
  gap: 10px;
}

.btn-primary, .btn-secondary, .btn-approve, .btn-reject {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-approve {
  background: #28a745;
  color: white;
}

.btn-reject {
  background: #dc3545;
  color: white;
}

.category-grid, .pending-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.category-card, .pending-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.category-card.type-shape {
  border-left: 4px solid #007bff;
}

.category-card.type-function {
  border-left: 4px solid #28a745;
}

.category-card.type-connection {
  border-left: 4px solid #ffc107;
}

.category-card.type-color {
  border-left: 4px solid #dc3545;
}

.category-header, .pending-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.code {
  font-weight: bold;
  font-family: monospace;
  background: #f8f9fa;
  padding: 2px 6px;
  border-radius: 3px;
}

.type {
  font-size: 12px;
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 3px;
}

.category-names, .pending-names {
  margin-bottom: 10px;
}

.display-name {
  font-weight: 500;
  margin-bottom: 5px;
}

.display-name-ko {
  color: #666;
  font-size: 14px;
}

.category-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666;
}

.status.active {
  color: #28a745;
  font-weight: bold;
}

.pending-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.add-form-overlay, .reject-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.add-form, .reject-dialog {
  background: white;
  padding: 30px;
  border-radius: 8px;
  width: 500px;
  max-height: 80vh;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-group textarea {
  height: 80px;
  resize: vertical;
}

.form-actions, .dialog-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>

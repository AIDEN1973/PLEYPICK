<template>
  <!-- 디버깅: 모달 컴포넌트 렌더링 확인 -->
  <div v-if="show" style="position: fixed; top: 50px; right: 10px; background: blue; color: white; padding: 10px; z-index: 10001;">
    모달 컴포넌트 렌더링됨: show={{ show }}, setNum={{ setNum }}
  </div>
  <div v-if="show" class="sync-modal-overlay" @click.self="handleCancel">
    <div class="sync-modal-container">
      <div class="sync-modal-header">
        <h3>레고 부품 정보 등록</h3>
        <button class="sync-modal-close" @click="handleCancel" :disabled="syncing">×</button>
      </div>
      
      <div class="sync-modal-body">
        <!-- 확인 단계 -->
        <div v-if="!syncing && !completed && !error" class="sync-confirm-step">
          <div class="sync-info">
            <p>세트 <strong>{{ setNum }}</strong>의 부품 정보가 등록되어 있지 않습니다.</p>
            <p>Rebrickable API에서 부품 정보를 가져와 등록하시겠습니까?</p>
          </div>
          <div class="sync-actions">
            <button class="sync-btn sync-btn-primary" @click="handleConfirm">
              등록하기
            </button>
            <button class="sync-btn sync-btn-secondary" @click="handleCancel">
              취소
            </button>
          </div>
        </div>

        <!-- 진행 중 단계 -->
        <div v-if="syncing" class="sync-progress-step">
          <div class="sync-progress-info">
            <div class="sync-status-text">{{ syncStatus }}</div>
            <div class="sync-progress-bar">
              <div 
                class="sync-progress-fill" 
                :style="{ width: `${syncProgress}%` }"
              ></div>
            </div>
            <div class="sync-progress-text">{{ syncProgress }}%</div>
          </div>
        </div>

        <!-- 완료 단계 -->
        <div v-if="completed && !syncing" class="sync-complete-step">
          <div class="sync-complete-icon">✓</div>
          <div class="sync-complete-message">
            <p>부품 정보 등록이 완료되었습니다.</p>
            <p v-if="partsCount > 0">{{ partsCount }}개의 부품이 등록되었습니다.</p>
          </div>
          <button class="sync-btn sync-btn-primary" @click="handleClose">
            확인
          </button>
        </div>

        <!-- 오류 단계 -->
        <div v-if="error && !syncing" class="sync-error-step">
          <div class="sync-error-icon">✗</div>
          <div class="sync-error-message">
            <p>부품 정보 등록 중 오류가 발생했습니다.</p>
            <p class="error-detail">{{ error }}</p>
            <p v-if="error.includes('404') || error.includes('존재하지 않')" class="error-hint">
              세트 번호를 확인하거나 다른 세트 번호를 시도해주세요.
            </p>
          </div>
          <div class="sync-actions">
            <button class="sync-btn sync-btn-primary" @click="handleRetry">
              다시 시도
            </button>
            <button class="sync-btn sync-btn-secondary" @click="handleCancel">
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue'

export default {
  name: 'SetPartsSyncModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    setNum: {
      type: String,
      required: false,
      default: ''
    },
    syncing: {
      type: Boolean,
      default: false
    },
    syncProgress: {
      type: Number,
      default: 0
    },
    syncStatus: {
      type: String,
      default: ''
    },
    completed: {
      type: Boolean,
      default: false
    },
    partsCount: {
      type: Number,
      default: 0
    },
    error: {
      type: String,
      default: null
    }
  },
  emits: ['confirm', 'cancel', 'close', 'retry'],
  setup(props, { emit }) {
    watch(() => props.show, (newVal) => {
      console.log('[SetPartsSyncModal] show prop 변경:', newVal, {
        syncing: props.syncing,
        completed: props.completed,
        error: props.error,
        setNum: props.setNum
      })
    }, { immediate: true })

    const handleConfirm = () => {
      console.log('[SetPartsSyncModal] 확인 버튼 클릭')
      emit('confirm')
    }

    const handleCancel = () => {
      if (!props.syncing) {
        console.log('[SetPartsSyncModal] 취소 버튼 클릭')
        emit('cancel')
      }
    }

    const handleClose = () => {
      console.log('[SetPartsSyncModal] 닫기 버튼 클릭')
      emit('close')
    }

    const handleRetry = () => {
      console.log('[SetPartsSyncModal] 재시도 버튼 클릭')
      emit('retry')
    }

    return {
      handleConfirm,
      handleCancel,
      handleClose,
      handleRetry
    }
  }
}
</script>

<style scoped>
.sync-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.sync-modal-container {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.sync-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.sync-modal-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}

.sync-modal-close {
  background: none;
  border: none;
  font-size: 28px;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.sync-modal-close:hover:not(:disabled) {
  background-color: #f3f4f6;
}

.sync-modal-close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sync-modal-body {
  padding: 24px;
}

.sync-confirm-step {
  text-align: center;
}

.sync-info {
  margin-bottom: 24px;
}

.sync-info p {
  margin: 8px 0;
  color: #4b5563;
  line-height: 1.6;
}

.sync-info strong {
  color: #1f2937;
  font-weight: 600;
}

.sync-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.sync-btn {
  padding: 10px 24px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.sync-btn-primary {
  background-color: #3b82f6;
  color: white;
}

.sync-btn-primary:hover {
  background-color: #2563eb;
}

.sync-btn-secondary {
  background-color: #f3f4f6;
  color: #4b5563;
}

.sync-btn-secondary:hover {
  background-color: #e5e7eb;
}

.sync-progress-step {
  text-align: center;
}

.sync-progress-info {
  margin-bottom: 24px;
}

.sync-status-text {
  margin-bottom: 16px;
  color: #4b5563;
  font-size: 14px;
}

.sync-progress-bar {
  width: 100%;
  height: 8px;
  background-color: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.sync-progress-fill {
  height: 100%;
  background-color: #3b82f6;
  transition: width 0.3s ease;
  border-radius: 4px;
}

.sync-progress-text {
  font-size: 12px;
  color: #6b7280;
}

.sync-complete-step {
  text-align: center;
}

.sync-complete-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  background-color: #10b981;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: bold;
}

.sync-complete-message {
  margin-bottom: 24px;
}

.sync-complete-message p {
  margin: 8px 0;
  color: #4b5563;
  line-height: 1.6;
}

.sync-error-step {
  text-align: center;
}

.sync-error-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  background-color: #ef4444;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: bold;
}

.sync-error-message {
  margin-bottom: 24px;
}

.sync-error-message p {
  margin: 8px 0;
  color: #4b5563;
  line-height: 1.6;
}

.error-detail {
  color: #ef4444;
  font-size: 14px;
  margin-top: 8px;
  font-weight: 500;
}

.error-hint {
  color: #6b7280;
  font-size: 13px;
  margin-top: 8px;
  font-style: italic;
}
</style>


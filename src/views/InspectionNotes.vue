<template>
  <div class="inspection-notes-page">
    <div class="page-header">
      <h1>검수노트</h1>
      <p>세트별 특이사항을 기록하고 관리할 수 있습니다.</p>
    </div>

    <div class="notes-content">
      <div class="notes-controls">
        <div class="set-selector">
          <label for="set-select">세트선택</label>
          <select
            id="set-select"
            v-model="selectedSetId"
            @change="loadNotes"
            class="set-select"
          >
            <option value="">전체세트</option>
            <option
              v-for="set in availableSets"
              :key="set.id"
              :value="set.id"
            >
              {{ set.name }} ({{ set.set_num }})
            </option>
          </select>
        </div>

        <div class="note-type-filter">
          <label>노트유형</label>
          <div class="filter-buttons">
            <button
              v-for="type in noteTypes"
              :key="type.value"
              @click="noteTypeFilter = type.value"
              :class="['filter-btn', { active: noteTypeFilter === type.value }]"
            >
              {{ type.label }}
            </button>
          </div>
        </div>
      </div>

      <div class="notes-main">
        <div class="notes-list-section">
          <div class="section-header">
            <h3>노트목록</h3>
            <span class="notes-count">{{ filteredNotes.length }}건</span>
          </div>

          <div v-if="loading" class="loading-state">
            <span>로딩 중...</span>
          </div>

          <div v-else-if="error" class="error-state">
            <span>{{ error }}</span>
          </div>

          <div v-else-if="filteredNotes.length === 0" class="empty-state">
            <p>등록된 노트가 없습니다</p>
          </div>

          <div v-else class="notes-list">
            <div
              v-for="note in filteredNotes"
              :key="note.id"
              class="note-item"
            >
              <div class="note-item-header">
                <div class="note-meta">
                  <span class="note-type" :class="`type-${note.note_type}`">
                    {{ noteTypeLabel(note.note_type) }}
                  </span>
                  <span class="note-set">{{ formatSetDisplay(note.set_num, note.theme_name, note.set_name) }}</span>
                  <span v-if="note.part_id" class="note-part">부품: {{ note.part_id }}</span>
                </div>
                <div class="note-actions">
                  <button
                    @click="editNote(note)"
                    class="btn-icon"
                    title="수정"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </button>
                  <button
                    @click="deleteNote(note.id)"
                    class="btn-icon btn-danger"
                    title="삭제"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="note-item-body">
                <p class="note-text">{{ note.note_text }}</p>
              </div>
              <div class="note-item-footer">
                <span class="note-date">{{ formatDate(note.created_at) }}</span>
                <span class="note-author">{{ note.created_by_email || formatUserId(note.created_by) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="note-form-section">
          <div class="section-header">
            <h3>{{ editingNote ? '노트수정' : '노트추가' }}</h3>
          </div>

          <form @submit.prevent="submitNote" class="note-form">
            <div class="form-row">
              <label for="form-set">세트</label>
              <select
                id="form-set"
                v-model="noteForm.set_id"
                required
                class="form-select"
              >
                <option value="">세트를 선택하세요</option>
                <option
                  v-for="set in availableSets"
                  :key="set.id"
                  :value="set.id"
                >
                  {{ set.display_name }}
                </option>
              </select>
            </div>

            <div class="form-row">
              <label for="form-type">유형</label>
              <select
                id="form-type"
                v-model="noteForm.note_type"
                required
                class="form-select"
              >
                <option
                  v-for="type in noteTypes"
                  :key="type.value"
                  :value="type.value"
                >
                  {{ type.label }}
                </option>
              </select>
            </div>

            <div class="form-row">
              <label for="form-part">대상 부품 (선택)</label>
              <input
                id="form-part"
                v-model="noteForm.part_id"
                type="text"
                placeholder="부품 ID (예: 3001)"
                class="form-input"
              />
            </div>

            <div class="form-row">
              <label for="form-text">내용</label>
              <textarea
                id="form-text"
                v-model="noteForm.note_text"
                required
                rows="5"
                placeholder="검수 시 참고할 내용을 입력하세요"
                class="form-textarea"
              ></textarea>
            </div>

            <div class="form-actions">
              <button
                v-if="editingNote"
                @click="cancelEdit"
                type="button"
                class="btn-secondary"
              >
                취소
              </button>
              <button type="submit" class="btn-primary">
                {{ editingNote ? '수정' : '추가' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useSupabase } from '../composables/useSupabase'
import { useInspectionSession } from '../composables/useInspectionSession'
import { formatSetDisplay, fetchSetMetadata } from '../utils/setDisplay'

export default {
  name: 'InspectionNotes',
  setup() {
    const { supabase, user } = useSupabase()
    const { addSetNote, deleteSetNote } = useInspectionSession()

    const loading = ref(false)
    const error = ref(null)
    const availableSets = ref([])
    const setMetadataMap = ref(new Map())
    const notes = ref([])
    const selectedSetId = ref('')
    const noteTypeFilter = ref('all')
    const editingNote = ref(null)

    const noteTypes = [
      { value: 'general', label: '일반' },
      { value: 'tip', label: '검수팁' },
      { value: 'caution', label: '주의' },
      { value: 'missing_frequent', label: '자주누락' }
    ]

    const noteForm = ref({
      set_id: '',
      note_type: 'general',
      part_id: '',
      note_text: ''
    })

    const filteredNotes = computed(() => {
      let filtered = [...notes.value]

      if (selectedSetId.value) {
        filtered = filtered.filter(note => note.set_id === selectedSetId.value)
      }

      if (noteTypeFilter.value !== 'all') {
        filtered = filtered.filter(note => note.note_type === noteTypeFilter.value)
      }

      return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    })

    const ensureSetMetadata = async (setIds) => {
      const uniqueIds = Array.from(new Set((setIds || []).filter(Boolean)))
      const missingIds = uniqueIds.filter(id => !setMetadataMap.value.has(id))

      if (missingIds.length === 0) return

      const metadata = await fetchSetMetadata(supabase, missingIds)
      metadata.forEach((meta, id) => {
        setMetadataMap.value.set(id, {
          set_name: meta.set_name || '세트명 없음',
          set_num: meta.set_num || '',
          theme_name: meta.theme_name || null
        })
      })
    }

    const loadAvailableSets = async () => {
      try {
        const { data, error: err } = await supabase
          .from('lego_sets')
          .select('id, name, set_num, theme_id')
          .order('name')
          .limit(200)

        if (err) throw err
        const themeIds = [...new Set((data || []).map(set => set.theme_id).filter(Boolean))]
        let themeMap = new Map()

        if (themeIds.length > 0) {
          const { data: themesData, error: themesError } = await supabase
            .from('lego_themes')
            .select('theme_id, name')
            .in('theme_id', themeIds)

          if (themesError) throw themesError
          themeMap = new Map((themesData || []).map(theme => [theme.theme_id, theme.name]))
        }

        availableSets.value = (data || []).map(set => {
          const themeName = set.theme_id ? (themeMap.get(set.theme_id) || null) : null
          const meta = {
            set_name: set.name || '세트명 없음',
            set_num: set.set_num || '',
            theme_name: themeName
          }
          setMetadataMap.value.set(set.id, meta)
          return {
            id: set.id,
            name: meta.set_name,
            set_num: meta.set_num,
            theme_name: meta.theme_name,
            display_name: formatSetDisplay(meta.set_num, meta.theme_name, meta.set_name)
          }
        })
      } catch (err) {
        console.error('세트 목록 로드 실패:', err)
        error.value = '세트 목록을 불러오는데 실패했습니다'
      }
    }

    const loadNotes = async () => {
      if (!selectedSetId.value) {
        await loadAllNotes()
        return
      }

      try {
        loading.value = true
        const { data, error: err } = await supabase
          .from('set_inspection_notes')
          .select(`
            *,
            lego_sets:set_id (
              name
            )
          `)
          .eq('set_id', selectedSetId.value)
          .order('created_at', { ascending: false })

        if (err) throw err

        const userIds = [...new Set((data || []).map(note => note.created_by).filter(Boolean))]
        const userEmailsMap = await loadUserEmails(userIds)

        const setIds = (data || []).map(note => note.set_id).filter(Boolean)
        await ensureSetMetadata(setIds)

        notes.value = (data || []).map(note => {
          const meta = setMetadataMap.value.get(note.set_id) || {}
          return {
            ...note,
            created_by_email: userEmailsMap.get(note.created_by) || null,
            set_name: meta.set_name || note.lego_sets?.name || null,
            set_num: meta.set_num || null,
            theme_name: meta.theme_name || null
          }
        })
      } catch (err) {
        console.error('노트 로드 실패:', err)
        error.value = '노트를 불러오는데 실패했습니다'
      } finally {
        loading.value = false
      }
    }

    const loadUserEmails = async (userIds) => {
      if (!userIds || userIds.length === 0) return new Map()

      try {
        const { data: adminUsers, error: adminError } = await supabase
          .from('admin_users')
          .select('id, email')
          .in('id', userIds)

        const emailMap = new Map()
        if (adminUsers && !adminError) {
          adminUsers.forEach(admin => {
            emailMap.set(admin.id, admin.email)
          })
        }

        return emailMap
      } catch (err) {
        console.warn('사용자 이메일 로드 실패:', err)
        return new Map()
      }
    }

    const loadAllNotes = async () => {
      if (!user.value) return

      try {
        loading.value = true
        const { data, error: err } = await supabase
          .from('set_inspection_notes')
          .select(`
            *,
            lego_sets:set_id (
              name
            )
          `)
          .order('created_at', { ascending: false })
          .limit(500)

        if (err) throw err

        const userIds = [...new Set((data || []).map(note => note.created_by).filter(Boolean))]
        const userEmailsMap = await loadUserEmails(userIds)

        const setIds = (data || []).map(note => note.set_id).filter(Boolean)
        await ensureSetMetadata(setIds)

        notes.value = (data || []).map(note => {
          const meta = setMetadataMap.value.get(note.set_id) || {}
          return {
            ...note,
            created_by_email: userEmailsMap.get(note.created_by) || null,
            set_name: meta.set_name || note.lego_sets?.name || null,
            set_num: meta.set_num || null,
            theme_name: meta.theme_name || null
          }
        })
      } catch (err) {
        console.error('전체 노트 로드 실패:', err)
        error.value = '노트를 불러오는데 실패했습니다'
      } finally {
        loading.value = false
      }
    }

    const formatUserId = (userId) => {
      if (!userId) return '작성자'
      return '작성자'
    }

    const getSetName = (setId) => {
      if (!setId) return '세트명 없음'
      const meta = setMetadataMap.value.get(setId)
      if (!meta) return '세트명 없음'
      return formatSetDisplay(meta.set_num, meta.theme_name, meta.set_name || '세트명 없음')
    }

    const noteTypeLabel = (type) => {
      return noteTypes.find(nt => nt.value === type)?.label || '일반'
    }

    const submitNote = async () => {
      if (!noteForm.value.set_id || !noteForm.value.note_text.trim()) return

      try {
        if (editingNote.value) {
          const { error: err } = await supabase
            .from('set_inspection_notes')
            .update({
              note_type: noteForm.value.note_type,
              part_id: noteForm.value.part_id || null,
              note_text: noteForm.value.note_text.trim(),
              updated_at: new Date().toISOString()
            })
            .eq('id', editingNote.value.id)

          if (err) throw err
        } else {
          await addSetNote({
            setId: noteForm.value.set_id,
            noteType: noteForm.value.note_type,
            noteText: noteForm.value.note_text.trim(),
            partId: noteForm.value.part_id || null
          })
        }

        noteForm.value = {
          set_id: selectedSetId.value || '',
          note_type: 'general',
          part_id: '',
          note_text: ''
        }
        editingNote.value = null

        await loadNotes()
      } catch (err) {
        console.error('노트 저장 실패:', err)
        error.value = '노트를 저장하는데 실패했습니다'
      }
    }

    const editNote = (note) => {
      editingNote.value = note
      noteForm.value = {
        set_id: note.set_id,
        note_type: note.note_type,
        part_id: note.part_id || '',
        note_text: note.note_text
      }
    }

    const cancelEdit = () => {
      editingNote.value = null
      noteForm.value = {
        set_id: selectedSetId.value || '',
        note_type: 'general',
        part_id: '',
        note_text: ''
      }
    }

    const deleteNote = async (noteId) => {
      if (!confirm('노트를 삭제하시겠습니까?')) return

      try {
        await deleteSetNote({ noteId })
        await loadNotes()
      } catch (err) {
        console.error('노트 삭제 실패:', err)
        error.value = '노트를 삭제하는데 실패했습니다'
      }
    }

    const formatDate = (dateString) => {
      if (!dateString) return '-'
      return new Date(dateString).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    onMounted(async () => {
      await loadAvailableSets()
      await loadAllNotes()
    })

    return {
      loading,
      error,
      availableSets,
      selectedSetId,
      noteTypeFilter,
      editingNote,
      noteTypes,
      noteForm,
      filteredNotes,
      getSetName,
      noteTypeLabel,
      loadNotes,
      submitNote,
      editNote,
      cancelEdit,
      deleteNote,
      formatDate,
      formatUserId,
      formatSetDisplay
    }
  }
}
</script>

<style scoped>
.inspection-notes-page {
  min-height: 100vh;
  background: #f9fafb;
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
  text-align: center;
}

.page-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.5rem 0;
  text-align: center;
}

.page-header p {
  font-size: 1rem;
  color: #6b7280;
  margin: 0;
  text-align: center;
}

.notes-content {
  max-width: 1400px;
  margin: 0 auto;
}

.notes-controls {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: flex-end;
}

.set-selector,
.note-type-filter {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-width: 200px;
}

.set-selector label,
.note-type-filter label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.set-select {
  padding: 0.625rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #1f2937;
  font-size: 0.875rem;
}

.filter-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 0.5rem 1rem;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-btn:hover {
  background: #f3f4f6;
}

.filter-btn.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
}

.notes-main {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 1.5rem;
}

.notes-list-section,
.note-form-section {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.section-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.notes-count {
  font-size: 0.875rem;
  color: #6b7280;
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 3rem 2rem;
  color: #6b7280;
}

.notes-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.note-item {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 1rem;
  background: #f9fafb;
  transition: all 0.2s ease;
}

.note-item:hover {
  border-color: #d1d5db;
  background: #ffffff;
}

.note-item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.note-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  flex: 1;
}

.note-type {
  padding: 0.375rem 0.875rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  border: 1px solid transparent;
}

.note-type.type-general {
  background: #f3f4f6;
  color: #374151;
  border-color: #d1d5db;
}

.note-type.type-tip {
  background: #dbeafe;
  color: #1e40af;
  border-color: #93c5fd;
}

.note-type.type-caution {
  background: #fef3c7;
  color: #92400e;
  border-color: #fcd34d;
}

.note-type.type-missing_frequent {
  background: #fee2e2;
  color: #991b1b;
  border-color: #fca5a5;
}

.note-set,
.note-part {
  font-size: 0.8125rem;
  color: #374151;
  padding: 0.375rem 0.75rem;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-weight: 500;
}

.note-actions {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.btn-icon {
  padding: 0.5rem;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #6b7280;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
}

.btn-icon:hover {
  background: #f3f4f6;
  color: #2563eb;
  border-color: #2563eb;
}

.btn-icon.btn-danger {
  border-color: #e5e7eb;
}

.btn-icon.btn-danger:hover {
  background: #fee2e2;
  color: #dc2626;
  border-color: #ef4444;
}

.note-item-body {
  margin-bottom: 0.75rem;
}

.note-text {
  font-size: 0.9375rem;
  color: #1f2937;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
}

.note-item-footer {
  display: flex;
  justify-content: space-between;
  font-size: 0.8125rem;
  color: #6b7280;
}

.note-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-row label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.form-select,
.form-input,
.form-textarea {
  padding: 0.625rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #1f2937;
  font-size: 0.875rem;
  font-family: inherit;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.form-select:focus,
.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 120px;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.btn-primary,
.btn-secondary {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-primary {
  background: #2563eb;
  color: #ffffff;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

@media (max-width: 1024px) {
  .notes-main {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .inspection-notes-page {
    padding: 1rem;
  }

  .notes-controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .notes-main {
    grid-template-columns: 1fr !important;
  }
  
  .notes-list-section,
  .note-form-section {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }
  
  .note-item {
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow: hidden;
  }
  
  .note-item-header {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .note-meta {
    flex: 1;
    min-width: 0;
  }
  
  .note-actions {
    flex-shrink: 0;
  }

  .page-header {
    margin-bottom: 1rem;
  }

  .page-header h1 {
    font-size: 1.25rem !important;
  }

  .page-header p {
    font-size: 0.875rem !important;
  }

  /* 본문 폰트 사이즈 조정 */
  .note-text {
    font-size: 0.875rem !important;
    word-break: break-word;
    overflow-wrap: break-word;
  }

  .section-header h3 {
    font-size: 1rem !important;
  }

  .notes-count {
    font-size: 0.8125rem !important;
  }

  .note-type {
    font-size: 0.75rem !important;
    font-weight: 600 !important;
  }

  .note-set,
  .note-part {
    font-size: 0.8125rem !important;
    word-break: break-word;
    white-space: normal;
  }

  .note-item-footer {
    font-size: 0.8125rem !important;
  }

  .form-select,
  .form-input,
  .form-textarea {
    font-size: 0.875rem !important;
  }

  .btn-primary,
  .btn-secondary {
    font-size: 0.875rem !important;
  }

  .set-select label,
  .note-type-filter label,
  .form-row label {
    font-size: 0.8125rem !important;
  }
  
  .set-select {
    font-size: 0.875rem !important;
  }
  
  .filter-btn {
    font-size: 0.875rem !important;
  }
}
</style>


import { createClient } from '@supabase/supabase-js'
import { ref } from 'vue'

// 원래 코드 복원: 환경 변수는 모듈 레벨에서 가져오기
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk'

// 원래 코드 복원: CORS 및 Storage 접근을 위한 추가 옵션
const supabaseOptions = {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
}

// 싱글톤 패턴으로 Supabase 클라이언트 생성
let supabaseInstance = null

const getSupabaseClient = () => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseKey, supabaseOptions)
  }
  return supabaseInstance
}

// 원래 코드 복원: 모듈 레벨에서 즉시 초기화
export const supabase = getSupabaseClient()

export function useSupabase() {
  const user = ref(null)
  const loading = ref(true)

  // supabase 클라이언트가 초기화되었는지 확인
  if (!supabase) {
    console.error('[ERROR] Supabase 클라이언트가 초기화되지 않았습니다.')
    loading.value = false
    return {
      supabase: null,
      user,
      loading,
      signUp: async () => ({ data: null, error: { message: 'Supabase 클라이언트가 초기화되지 않았습니다.' } }),
      signIn: async () => ({ data: null, error: { message: 'Supabase 클라이언트가 초기화되지 않았습니다.' } }),
      signOut: async () => ({ error: { message: 'Supabase 클라이언트가 초기화되지 않았습니다.' } })
    }
  }

  // 현재 세션 확인
  supabase.auth.getSession().then(({ data: { session } }) => {
    user.value = session?.user ?? null
    loading.value = false
  }).catch((error) => {
    console.error('[ERROR] 세션 확인 실패:', error)
    loading.value = false
  })

  // 인증 상태 변경 감지
  supabase.auth.onAuthStateChange((_event, session) => {
    user.value = session?.user ?? null
    loading.value = false
  })

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })
    return { data, error }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  return {
    supabase,
    user,
    loading,
    signUp,
    signIn,
    signOut
  }
}

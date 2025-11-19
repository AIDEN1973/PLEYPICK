import { createClient } from '@supabase/supabase-js'
import { ref } from 'vue'

// 환경 변수 가져오기
const getSupabaseConfig = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 
    (import.meta.env.PROD ? null : 'https://npferbxuxocbfnfbpcnz.supabase.co')
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 
    (import.meta.env.PROD ? null : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk')

  // 프로덕션 모드에서 환경 변수 검증
  if (import.meta.env.PROD && (!supabaseUrl || !supabaseKey)) {
    console.error('[ERROR] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required in production mode')
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다. 프로덕션 모드에서는 필수입니다.')
  }

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL 또는 Key가 설정되지 않았습니다.')
  }

  return { supabaseUrl, supabaseKey }
}

// 싱글톤 패턴으로 Supabase 클라이언트 생성 (지연 초기화)
let supabaseInstance = null

const getSupabaseClient = () => {
  if (!supabaseInstance) {
    const { supabaseUrl, supabaseKey } = getSupabaseConfig()
    
    // Supabase 클라이언트 옵션 (최소한의 옵션만 사용)
    const supabaseOptions = {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    }
    
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseKey, supabaseOptions)
    } catch (error) {
      console.error('[ERROR] Supabase 클라이언트 생성 실패:', error)
      throw new Error(`Supabase 클라이언트 초기화 실패: ${error.message}`)
    }
  }
  return supabaseInstance
}

// 클라이언트 초기화 (안전한 방식)
let supabaseExport = null

try {
  supabaseExport = getSupabaseClient()
} catch (error) {
  console.error('[ERROR] Supabase 초기화 실패:', error)
  // 개발 모드에서는 fallback 사용
  if (!import.meta.env.PROD) {
    try {
      const fallbackUrl = 'https://npferbxuxocbfnfbpcnz.supabase.co'
      const fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk'
      supabaseExport = createClient(fallbackUrl, fallbackKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      })
      console.warn('[WARNING] Fallback Supabase 클라이언트 사용')
    } catch (fallbackError) {
      console.error('[ERROR] Fallback 클라이언트 생성도 실패:', fallbackError)
    }
  }
}

export const supabase = supabaseExport

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

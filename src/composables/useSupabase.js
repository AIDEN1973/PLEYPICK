import { createClient } from '@supabase/supabase-js'
import { ref } from 'vue'

// 환경 변수 가져오기 (프로덕션 빌드 시 Vercel에서 주입됨)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (import.meta.env.PROD ? null : 'https://npferbxuxocbfnfbpcnz.supabase.co')
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (import.meta.env.PROD ? null : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk')

// 프로덕션 빌드 디버깅
if (import.meta.env.PROD) {
  console.log('[DEBUG] Environment check:', {
    VITE_SUPABASE_URL: supabaseUrl ? 'Present' : 'Missing',
    VITE_SUPABASE_ANON_KEY: supabaseKey ? 'Present' : 'Missing',
    allEnvKeys: Object.keys(import.meta.env).filter(k => k.startsWith('VITE_'))
  })
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('[ERROR] Supabase 환경 변수가 설정되지 않았습니다.')
    console.error('[ERROR] VITE_SUPABASE_URL:', supabaseUrl ? 'Present' : 'Missing')
    console.error('[ERROR] VITE_SUPABASE_ANON_KEY:', supabaseKey ? 'Present' : 'Missing')
  }
}

// Supabase 클라이언트 생성 (원래 방식: 모듈 레벨에서 즉시 초기화)
let supabaseInstance = null

try {
  if (supabaseUrl && supabaseKey) {
    // 옵션 없이 기본값만 사용 (useSupabasePleyon과 동일한 방식)
    supabaseInstance = createClient(supabaseUrl, supabaseKey)
  } else {
    console.warn('[WARN] Supabase URL or Key is missing, client not initialized')
  }
} catch (error) {
  console.error('[ERROR] Supabase 클라이언트 초기화 실패:', error)
  // 초기화 실패해도 앱이 크래시되지 않도록 null 유지
}

export const supabase = supabaseInstance

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

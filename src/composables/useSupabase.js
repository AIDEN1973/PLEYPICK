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

// Supabase 클라이언트 런타임 초기화 (빌드 시점이 아닌 실행 시점)
let supabaseInstance = null

const getSupabaseClient = async () => {
  if (!supabaseInstance) {
    // 브라우저 환경에서만 Supabase 클라이언트 생성
    if (typeof window !== 'undefined') {
      try {
        // 전역 변수에서만 로드 (CDN 스크립트, 동적 import 제거)
        // 동적 import는 번들링 시점에 분석되어 vendor 청크에 포함될 수 있음
        if (window.supabase && window.supabase.createClient && supabaseUrl && supabaseKey) {
          const createClient = window.supabase.createClient
          supabaseInstance = createClient(supabaseUrl, supabaseKey)
          console.log('[DEBUG] Supabase 클라이언트 런타임 초기화 성공 (CDN)')
        } else {
          console.warn('[WARN] window.supabase.createClient 또는 URL/Key가 없습니다. CDN 스크립트가 로드되었는지 확인하세요.')
        }
      } catch (error) {
        console.error('[ERROR] Supabase 클라이언트 초기화 실패:', error)
      }
    }
  }
  return supabaseInstance
}

// 동기 접근을 위한 Proxy (비동기 초기화 래핑)
export const supabase = new Proxy({}, {
  get(target, prop) {
    if (prop === 'then') {
      // Promise로 사용될 때
      return undefined
    }
    
    // 이미 초기화된 경우
    if (supabaseInstance) {
      const value = supabaseInstance[prop]
      if (typeof value === 'function') {
        return value.bind(supabaseInstance)
      }
      return value
    }
    
    // 아직 초기화 안된 경우 - 초기화 트리거
    getSupabaseClient().then(client => {
      if (!client) {
        console.error('[ERROR] Supabase 클라이언트를 초기화할 수 없습니다')
      }
    })
    
    // 임시로 에러 방지용 객체 반환
    if (prop === 'auth') {
      return {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: null } })
      }
    }
    
    return undefined
  }
})

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

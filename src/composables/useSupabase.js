import { createClient } from '@supabase/supabase-js'
import { ref } from 'vue'

const baseSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
const supabaseUrl = baseSupabaseUrl
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk'

const devProxyPath = import.meta.env.VITE_SUPABASE_PROXY_PATH || ''
const shouldProxyRest = import.meta.env.DEV && !!devProxyPath

const proxyFetch = async (input, init) => {
  const resolveUrl = (resource) => (typeof resource === 'string' ? resource : resource.url)
  const originalUrl = resolveUrl(input)

  if (shouldProxyRest && originalUrl?.startsWith(`${baseSupabaseUrl}/rest/v1`)) {
    const rewrittenUrl = originalUrl.replace(baseSupabaseUrl, devProxyPath)
    if (typeof input === 'string') {
      return fetch(rewrittenUrl, init)
    }
    const clonedRequest = new Request(rewrittenUrl, input)
    return fetch(clonedRequest, init)
  }

  return fetch(input, init)
}

// CORS 및 Storage 접근을 위한 추가 옵션
const supabaseOptions = {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  },
  global: {
    headers: {
      // 필요 시 사용자 정의 헤더를 추가하되, CORS 응답 헤더는 요청에 포함하지 않는다. // 🔧 수정됨
    },
    fetch: shouldProxyRest ? proxyFetch : undefined
  }
}

// 싱글톤 패턴으로 Supabase 클라이언트 생성
let supabaseInstance = null

const getSupabaseClient = () => {
  if (!supabaseInstance) {
    console.log('[BrickBox Supabase] 클라이언트 초기화 시작')
    console.log('[BrickBox Supabase] URL:', supabaseUrl)
    console.log('[BrickBox Supabase] Options:', JSON.stringify(supabaseOptions, null, 2))
    
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseKey, supabaseOptions)
      console.log('[BrickBox Supabase] 클라이언트 초기화 성공')
      console.log('[BrickBox Supabase] 클라이언트 타입:', typeof supabaseInstance)
      console.log('[BrickBox Supabase] 클라이언트 키:', Object.keys(supabaseInstance || {}).slice(0, 10))
    } catch (err) {
      console.error('[BrickBox Supabase] 클라이언트 초기화 실패:', err)
      console.error('[BrickBox Supabase] 오류 메시지:', err.message)
      console.error('[BrickBox Supabase] 오류 스택:', err.stack)
      throw err
    }
  }
  return supabaseInstance
}

console.log('[BrickBox Supabase] 모듈 로드 시작')
export const supabase = getSupabaseClient()
console.log('[BrickBox Supabase] 모듈 로드 완료')

export function useSupabase() {
  const user = ref(null)
  const loading = ref(true)

  // 현재 세션 확인
  supabase.auth.getSession().then(({ data: { session } }) => {
    user.value = session?.user ?? null
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
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      return { error }
    } catch (error) {
      // 403 오류 등이 발생해도 에러 반환 (호출자가 처리)
      console.warn('로그아웃 API 오류:', error)
      return { error }
    }
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

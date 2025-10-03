import { createClient } from '@supabase/supabase-js'
import { ref, onMounted } from 'vue'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk'

export const supabase = createClient(supabaseUrl, supabaseKey)

export function useSupabase() {
  const user = ref(null)
  const loading = ref(true)

  onMounted(() => {
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

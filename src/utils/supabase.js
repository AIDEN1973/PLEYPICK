// useSupabase composable을 재사용하여 중복 인스턴스 방지
import { useSupabase } from '../composables/useSupabase.js'

// 싱글톤 인스턴스 가져오기
const { supabase } = useSupabase()

export const getSupabaseClient = () => supabase

// 기본 export로도 사용 가능
export default getSupabaseClient

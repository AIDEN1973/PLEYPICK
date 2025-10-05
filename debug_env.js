// 환경 변수 디버깅 스크립트
console.log('🔍 Environment Variables Debug:')
console.log('VITE_OPENAI_API_KEY:', process.env.VITE_OPENAI_API_KEY ? 'Present' : 'Missing')
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? 'Present' : 'Missing')
console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? 'Present' : 'Missing')
console.log('VITE_REBRICKABLE_API_KEY:', process.env.VITE_REBRICKABLE_API_KEY ? 'Present' : 'Missing')

console.log('\n📋 All VITE_ environment variables:')
Object.keys(process.env)
  .filter(key => key.startsWith('VITE_'))
  .forEach(key => {
    console.log(`${key}: ${process.env[key] ? 'Present' : 'Missing'}`)
  })
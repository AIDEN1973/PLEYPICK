// 환경 변수 디버깅 스크립트 (통합 환경변수 관리 시스템 사용)

// 통합 환경변수 관리 시스템 사용
try {
    // ES 모듈 방식으로 로드
    const { envManager, applyEnv, getSupabaseConfig, getApiKeys } = await import('./scripts/env_manager.mjs');
    
    // 환경변수 적용
    applyEnv();
    console.log('통합 환경변수 관리 시스템을 사용합니다.');
    
    // Supabase 설정 확인
    const supabaseConfig = getSupabaseConfig();
    console.log('\n🔍 Supabase 설정:');
    console.log('URL:', supabaseConfig.url ? 'Present' : 'Missing');
    console.log('Anon Key:', supabaseConfig.anon_key ? 'Present' : 'Missing');
    console.log('Service Role:', supabaseConfig.service_role ? 'Present' : 'Missing');
    
    // API 키 확인
    const apiKeys = getApiKeys();
    console.log('\n🔑 API 키:');
    console.log('OpenAI:', apiKeys.openai ? 'Present' : 'Missing');
    console.log('Rebrickable:', apiKeys.rebrickable ? 'Present' : 'Missing');
    
    // 전체 설정 표시
    console.log('\n📋 전체 환경 설정:');
    envManager.showConfig();
    
} catch (error) {
    console.log('통합 환경변수 관리 시스템을 사용할 수 없습니다. 기본 방식을 사용합니다.');
    console.error('Error:', error.message);
    
    // 폴백: 기존 방식
    console.log('\n🔍 Environment Variables Debug:')
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
}
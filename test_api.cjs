const fetch = require('node-fetch');

async function testAPI() {
  try {
    console.log('🔍 API 테스트 시작...');
    
    // 1. 부품 상태 확인
    console.log('\n1. 부품 상태 확인 API 테스트');
    const statusResponse = await fetch('http://localhost:5003/api/synthetic/part-status/6335317');
    const statusData = await statusResponse.json();
    
    console.log('부품 상태:', JSON.stringify(statusData, null, 2));
    
    // 2. 데이터베이스 복구 API 테스트 (이미 복구되어 있으므로 중복 등록 방지)
    console.log('\n2. 데이터베이스 복구 API 테스트');
    const repairResponse = await fetch('http://localhost:5003/api/synthetic/repair-database', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        partId: '6335317',
        expectedImageCount: 200
      })
    });
    
    const repairData = await repairResponse.json();
    console.log('복구 결과:', JSON.stringify(repairData, null, 2));
    
  } catch (error) {
    console.error('❌ API 테스트 실패:', error.message);
  }
}

testAPI();

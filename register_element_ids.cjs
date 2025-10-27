const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://npferbxuxocbfnfbpcnz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3NDk4NSwiZXhwIjoyMDc1MDUwOTg1fQ.pPWhWrb4QBC-DT4dd6Y1p-LlHNd9UTKef3SHEXUDp00'
);

async function registerElementIds() {
  try {
    console.log('🔧 엘리먼트 ID 등록 시작...\n');
    
    // 등록할 엘리먼트 ID들
    const elementIds = [
      {
        element_id: '6211342',
        part_name: 'LEGO Element 6211342',
        category: 'Unknown',
        color: 'Unknown',
        part_id: '6211342' // 엘리먼트 ID를 부품 ID로도 사용
      },
      {
        element_id: '6335317',
        part_name: 'LEGO Element 6335317',
        category: 'Unknown',
        color: 'Unknown',
        part_id: '6335317' // 엘리먼트 ID를 부품 ID로도 사용
      }
    ];
    
    for (const element of elementIds) {
      console.log(`📝 ${element.element_id} 등록 중...`);
      
      // 기존 데이터 확인
      const { data: existing, error: checkError } = await supabase
        .from('parts_master')
        .select('part_id, element_id')
        .eq('element_id', element.element_id)
        .limit(1);
      
      if (checkError) {
        console.error(`❌ ${element.element_id} 확인 실패:`, checkError);
        continue;
      }
      
      if (existing && existing.length > 0) {
        console.log(`✅ ${element.element_id} 이미 등록됨`);
        continue;
      }
      
      // 새 엘리먼트 ID 등록
      const { data, error } = await supabase
        .from('parts_master')
        .insert([element]);
      
      if (error) {
        console.error(`❌ ${element.element_id} 등록 실패:`, error);
      } else {
        console.log(`✅ ${element.element_id} 등록 완료`);
      }
    }
    
    console.log('\n🔍 등록 결과 확인...');
    
    // 등록 결과 확인
    for (const element of elementIds) {
      const { data, error } = await supabase
        .from('parts_master')
        .select('part_id, part_name, element_id')
        .eq('element_id', element.element_id);
      
      if (error) {
        console.error(`❌ ${element.element_id} 확인 실패:`, error);
      } else {
        console.log(`✅ ${element.element_id} 확인됨:`, data[0]);
      }
    }
    
    console.log('\n🎉 엘리먼트 ID 등록 완료!');
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

registerElementIds();

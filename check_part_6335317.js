const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL, 
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkPartData() {
  console.log('=== 부품 6335317 데이터 확인 ===');
  
  // 1. parts_master에서 부품 존재 확인
  const { data: partData, error: partError } = await supabase
    .from('parts_master')
    .select('*')
    .eq('part_id', '6335317')
    .limit(1);
  
  if (partError) {
    console.log('❌ parts_master 조회 실패:', partError.message);
  } else if (!partData || partData.length === 0) {
    console.log('❌ parts_master에 부품 6335317이 없습니다');
  } else {
    console.log('✅ parts_master에 부품 존재:', partData[0]);
  }
  
  // 2. synthetic_dataset에서 이미지 확인
  const { data: imageData, error: imageError } = await supabase
    .from('synthetic_dataset')
    .select('*')
    .eq('part_id', '6335317');
  
  if (imageError) {
    console.log('❌ synthetic_dataset 조회 실패:', imageError.message);
  } else {
    console.log('📊 synthetic_dataset 이미지 수:', imageData?.length || 0);
    if (imageData && imageData.length > 0) {
      console.log('📋 이미지 상태별 분포:');
      const statusCount = {};
      imageData.forEach(img => {
        statusCount[img.status] = (statusCount[img.status] || 0) + 1;
      });
      console.log(statusCount);
      
      // uploaded 상태 이미지만 확인
      const uploadedImages = imageData.filter(img => img.status === 'uploaded');
      console.log('✅ uploaded 상태 이미지 수:', uploadedImages.length);
    }
  }
  
  // 3. set_parts에서 엘리먼트 ID 확인
  const { data: elementData, error: elementError } = await supabase
    .from('set_parts')
    .select('element_id, part_id, lego_parts(name), lego_colors(name)')
    .eq('part_id', '6335317')
    .limit(5);
  
  if (elementError) {
    console.log('❌ set_parts 조회 실패:', elementError.message);
  } else {
    console.log('🔗 set_parts 연결된 엘리먼트 ID 수:', elementData?.length || 0);
    if (elementData && elementData.length > 0) {
      console.log('📋 엘리먼트 ID 목록:');
      elementData.forEach(el => {
        console.log(`  - ${el.element_id}: ${el.lego_parts?.name} (${el.lego_colors?.name})`);
      });
    }
  }
}

checkPartData().catch(console.error);

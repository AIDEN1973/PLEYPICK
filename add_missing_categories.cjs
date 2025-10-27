const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://npferbxuxocbfnfbpcnz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addMissingCategories() {
  console.log('Adding missing categories...');
  
  // 누락된 19개 카테고리
  const missingCategories = [
    {id: 14, code: 'baseplate', display_name: 'Baseplate', display_name_ko: '베이스플레이트', category_type: 'shape', sort_order: 14, is_active: true},
    {id: 15, code: 'corner', display_name: 'Corner', display_name_ko: '코너', category_type: 'shape', sort_order: 15, is_active: true},
    {id: 22, code: 'technic_pin', display_name: 'Technic Pin', display_name_ko: '테크닉 핀', category_type: 'shape', sort_order: 22, is_active: true},
    {id: 23, code: 'technic_beam', display_name: 'Technic Beam', display_name_ko: '테크닉 빔', category_type: 'shape', sort_order: 23, is_active: true},
    {id: 30, code: 'electronics', display_name: 'Electronics', display_name_ko: '전자 부품', category_type: 'shape', sort_order: 30, is_active: true},
    {id: 31, code: 'mechanical', display_name: 'Mechanical', display_name_ko: '기계 부품', category_type: 'shape', sort_order: 31, is_active: true},
    {id: 32, code: 'minifig_head', display_name: 'Minifig Head', display_name_ko: '미니피그 머리', category_type: 'shape', sort_order: 32, is_active: true},
    {id: 33, code: 'minifig_torso', display_name: 'Minifig Torso', display_name_ko: '미니피그 몸통', category_type: 'shape', sort_order: 33, is_active: true},
    {id: 34, code: 'minifig_leg', display_name: 'Minifig Leg', display_name_ko: '미니피그 다리', category_type: 'shape', sort_order: 34, is_active: true},
    {id: 35, code: 'minifig_accessory', display_name: 'Minifig Accessory', display_name_ko: '미니피그 액세서리', category_type: 'shape', sort_order: 35, is_active: true},
    {id: 37, code: 'minifig', display_name: 'Minifig', display_name_ko: '미니피그', category_type: 'shape', sort_order: 37, is_active: true},
    {id: 40, code: 'animals', display_name: 'Animals', display_name_ko: '동물', category_type: 'shape', sort_order: 40, is_active: true},
    {id: 41, code: 'plants', display_name: 'Plants', display_name_ko: '식물', category_type: 'shape', sort_order: 41, is_active: true},
    {id: 43, code: 'decal', display_name: 'Decal', display_name_ko: '데칼', category_type: 'shape', sort_order: 43, is_active: true},
    {id: 45, code: 'printed_part', display_name: 'Printed Part', display_name_ko: '인쇄 부품', category_type: 'shape', sort_order: 45, is_active: true},
    {id: 46, code: 'transparent', display_name: 'Transparent', display_name_ko: '투명 부품', category_type: 'shape', sort_order: 46, is_active: true},
    {id: 47, code: 'tools', display_name: 'Tools', display_name_ko: '도구', category_type: 'shape', sort_order: 47, is_active: true},
    {id: 48, code: 'containers', display_name: 'Containers', display_name_ko: '용기', category_type: 'shape', sort_order: 48, is_active: true},
    {id: 49, code: 'energy_effects', display_name: 'Energy Effects', display_name_ko: '에너지 효과', category_type: 'shape', sort_order: 49, is_active: true},
    {id: 50, code: 'magnets', display_name: 'Magnets', display_name_ko: '자석', category_type: 'shape', sort_order: 50, is_active: true},
    {id: 51, code: 'tubes_hoses', display_name: 'Tubes/Hoses', display_name_ko: '튜브/호스', category_type: 'shape', sort_order: 51, is_active: true},
    {id: 53, code: 'duplo', display_name: 'Duplo', display_name_ko: '듀플로', category_type: 'shape', sort_order: 53, is_active: true}
  ];
  
  console.log('Adding', missingCategories.length, 'missing categories...');
  
  const { data, error } = await supabase
    .from('part_categories')
    .insert(missingCategories);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Successfully added missing categories!');
  
  // 최종 확인
  const { data: finalData } = await supabase
    .from('part_categories')
    .select('id, code, display_name, is_active')
    .order('id');
  
  const activeCount = finalData.filter(cat => cat.is_active).length;
  console.log('Final active categories:', activeCount);
  
  if (activeCount === 55) {
    console.log('All 55 categories registered!');
  } else {
    console.log('Still missing', (55 - activeCount), 'categories.');
  }
}

addMissingCategories().catch(console.error);

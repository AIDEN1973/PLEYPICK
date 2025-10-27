const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://npferbxuxocbfnfbpcnz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findMissingCategories() {
  console.log('Finding missing 2 categories...');
  
  // 55개 필수 카테고리 정의
  const requiredCategories = [
    // 기본 조립 (21개)
    {id: 1, code: 'plate'}, {id: 2, code: 'brick'}, {id: 3, code: 'tile'}, {id: 4, code: 'slope'}, {id: 5, code: 'panel'},
    {id: 6, code: 'wedge'}, {id: 7, code: 'cylinder'}, {id: 8, code: 'cone'}, {id: 9, code: 'arch'}, {id: 10, code: 'round'},
    {id: 11, code: 'dish'}, {id: 12, code: 'roof'}, {id: 13, code: 'inverted'}, {id: 14, code: 'baseplate'}, {id: 15, code: 'corner'},
    {id: 16, code: 'hinge'}, {id: 17, code: 'clip'}, {id: 18, code: 'bar'}, {id: 19, code: 'fence'}, {id: 20, code: 'door'}, {id: 21, code: 'window'},
    
    // 테크닉 (10개)
    {id: 22, code: 'technic_pin'}, {id: 23, code: 'technic_beam'}, {id: 24, code: 'gear'}, {id: 25, code: 'axle'}, {id: 26, code: 'wheel'},
    {id: 27, code: 'tire'}, {id: 28, code: 'propeller'}, {id: 29, code: 'chain'}, {id: 30, code: 'electronics'}, {id: 31, code: 'mechanical'},
    
    // 미니피그 (6개)
    {id: 32, code: 'minifig_head'}, {id: 33, code: 'minifig_torso'}, {id: 34, code: 'minifig_leg'}, {id: 35, code: 'minifig_accessory'},
    {id: 36, code: 'minifig_part'}, {id: 37, code: 'minifig'},
    
    // 생물/자연 (4개)
    {id: 38, code: 'animal_figure'}, {id: 39, code: 'plant_leaf'}, {id: 40, code: 'animals'}, {id: 41, code: 'plants'},
    
    // 액세서리 (10개)
    {id: 42, code: 'sticker'}, {id: 43, code: 'decal'}, {id: 44, code: 'accessory'}, {id: 45, code: 'printed_part'},
    {id: 46, code: 'transparent'}, {id: 47, code: 'tools'}, {id: 48, code: 'containers'}, {id: 49, code: 'energy_effects'},
    {id: 50, code: 'magnets'}, {id: 51, code: 'tubes_hoses'},
    
    // 레거시 (4개)
    {id: 52, code: 'technic'}, {id: 53, code: 'duplo'}, {id: 54, code: 'misc_shape'}, {id: 99, code: 'unknown'}
  ];
  
  // 현재 등록된 카테고리 조회
  const { data: existingCategories } = await supabase
    .from('part_categories')
    .select('id, code')
    .eq('is_active', true);
  
  const existingCodes = new Set(existingCategories.map(cat => cat.code));
  const existingIds = new Set(existingCategories.map(cat => cat.id));
  
  console.log('Current categories:', existingCategories.length);
  console.log('Required categories:', requiredCategories.length);
  
  // 누락된 카테고리 찾기
  const missing = requiredCategories.filter(req => 
    !existingCodes.has(req.code) && !existingIds.has(req.id)
  );
  
  console.log('Missing categories:', missing.length);
  missing.forEach(cat => {
    console.log(`  ${cat.id}: ${cat.code}`);
  });
  
  // 그룹별 분석
  const groups = {
    '기본 조립': requiredCategories.filter(cat => cat.id >= 1 && cat.id <= 21),
    '테크닉': requiredCategories.filter(cat => cat.id >= 22 && cat.id <= 31),
    '미니피그': requiredCategories.filter(cat => cat.id >= 32 && cat.id <= 37),
    '생물/자연': requiredCategories.filter(cat => cat.id >= 38 && cat.id <= 41),
    '액세서리': requiredCategories.filter(cat => cat.id >= 42 && cat.id <= 51),
    '레거시': requiredCategories.filter(cat => cat.id >= 52 && cat.id <= 54 || cat.id === 99)
  };
  
  console.log('\nGroup analysis:');
  Object.entries(groups).forEach(([groupName, categories]) => {
    const existing = categories.filter(cat => existingCodes.has(cat.code) || existingIds.has(cat.id));
    const missing = categories.filter(cat => !existingCodes.has(cat.code) && !existingIds.has(cat.id));
    console.log(`  ${groupName}: ${existing.length}/${categories.length} (missing: ${missing.length})`);
    if (missing.length > 0) {
      missing.forEach(cat => console.log(`    - ${cat.id}: ${cat.code}`));
    }
  });
}

findMissingCategories().catch(console.error);

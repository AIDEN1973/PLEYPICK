const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://npferbxuxocbfnfbpcnz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeIds() {
  console.log('Analyzing category IDs...');
  
  const { data: categories } = await supabase
    .from('part_categories')
    .select('id, code, display_name')
    .eq('is_active', true)
    .order('id');
  
  console.log('Current categories by ID:');
  categories.forEach(cat => {
    console.log(`  ${cat.id}: ${cat.code} (${cat.display_name})`);
  });
  
  // ID 범위별 분석
  const ranges = [
    { name: '1-21 (기본 조립)', min: 1, max: 21 },
    { name: '22-31 (테크닉)', min: 22, max: 31 },
    { name: '32-37 (미니피그)', min: 32, max: 37 },
    { name: '38-41 (생물/자연)', min: 38, max: 41 },
    { name: '42-51 (액세서리)', min: 42, max: 51 },
    { name: '52-54,99 (레거시)', min: 52, max: 99 }
  ];
  
  console.log('\nID range analysis:');
  ranges.forEach(range => {
    const inRange = categories.filter(cat => 
      (range.min <= cat.id && cat.id <= range.max) || 
      (range.name.includes('레거시') && cat.id === 99)
    );
    console.log(`  ${range.name}: ${inRange.length} categories`);
    inRange.forEach(cat => console.log(`    ${cat.id}: ${cat.code}`));
  });
  
  // 누락된 ID 찾기
  const allRequiredIds = [];
  for (let i = 1; i <= 21; i++) allRequiredIds.push(i);
  for (let i = 22; i <= 31; i++) allRequiredIds.push(i);
  for (let i = 32; i <= 37; i++) allRequiredIds.push(i);
  for (let i = 38; i <= 41; i++) allRequiredIds.push(i);
  for (let i = 42; i <= 51; i++) allRequiredIds.push(i);
  for (let i = 52; i <= 54; i++) allRequiredIds.push(i);
  allRequiredIds.push(99);
  
  const existingIds = new Set(categories.map(cat => cat.id));
  const missingIds = allRequiredIds.filter(id => !existingIds.has(id));
  
  console.log(`\nTotal required IDs: ${allRequiredIds.length}`);
  console.log(`Existing IDs: ${existingIds.size}`);
  console.log(`Missing IDs: ${missingIds.length}`);
  
  if (missingIds.length > 0) {
    console.log('Missing IDs:', missingIds);
  }
}

analyzeIds().catch(console.error);

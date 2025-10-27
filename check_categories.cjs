const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://npferbxuxocbfnfbpcnz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCategories() {
  console.log('Checking current categories...');
  
  const { data, error } = await supabase
    .from('part_categories')
    .select('id, code, display_name, is_active')
    .order('id');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Current categories:', data.length);
  console.log('Categories:');
  data.forEach(cat => {
    console.log('  ' + cat.id + ': ' + cat.code + ' (' + cat.display_name + ') - ' + (cat.is_active ? 'active' : 'inactive'));
  });
  
  const activeCount = data.filter(cat => cat.is_active).length;
  console.log('Active categories:', activeCount);
  
  if (activeCount === 55) {
    console.log('All 55 categories registered!');
  } else {
    console.log('Missing ' + (55 - activeCount) + ' categories.');
  }
}

checkCategories().catch(console.error);

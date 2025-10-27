const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://npferbxuxocbfnfbpcnz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3NDk4NSwiZXhwIjoyMDc1MDUwOTg1fQ.pPWhWrb4QBC-DT4dd6Y1p-LlHNd9UTKef3SHEXUDp00'
);

async function checkSyncStatus() {
  try {
    console.log('🔍 Synthetic 폴더 동기화 상태 확인 중...\n');
    
    // synthetic 폴더 구조 확인
    const { data: syntheticFolders, error: folderError } = await supabase.storage
      .from('lego-synthetic')
      .list('synthetic');
    
    if (folderError) {
      console.error('❌ 폴더 목록 조회 실패:', folderError);
      return;
    }
    
    console.log('📁 Synthetic 폴더 구조:');
    syntheticFolders.forEach(folder => {
      console.log(`  - ${folder.name}`);
    });
    
    // 6211342 폴더 파일 수 확인
    const { data: files6211342, error: filesError } = await supabase.storage
      .from('lego-synthetic')
      .list('synthetic/6211342');
    
    if (filesError) {
      console.error('❌ 6211342 폴더 파일 조회 실패:', filesError);
      return;
    }
    
    const webpFiles = files6211342.filter(f => f.name.endsWith('.webp'));
    console.log(`\n📊 6211342 폴더 통계:`);
    console.log(`  - 전체 파일: ${files6211342.length}개`);
    console.log(`  - WebP 파일: ${webpFiles.length}개`);
    
    if (webpFiles.length > 0) {
      console.log(`\n🖼️ WebP 파일 예시:`);
      webpFiles.slice(0, 5).forEach(f => console.log(`  - ${f.name}`));
    }
    
    // 6335317 폴더도 확인
    const { data: files6335317 } = await supabase.storage
      .from('lego-synthetic')
      .list('synthetic/6335317');
    
    if (files6335317) {
      const webpFiles6335317 = files6335317.filter(f => f.name.endsWith('.webp'));
      console.log(`\n📊 6335317 폴더 통계:`);
      console.log(`  - 전체 파일: ${files6335317.length}개`);
      console.log(`  - WebP 파일: ${webpFiles6335317.length}개`);
    }
    
    console.log('\n✅ 동기화 상태 확인 완료');
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

checkSyncStatus();

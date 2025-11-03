const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './config/synthetic_dataset.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE
);

async function checkStorageStructure() {
  console.log('=== Supabase Storage 폴더 구조 확인 ===');
  
  try {
    // 루트 폴더 목록 조회
    const { data: rootFolders, error: rootError } = await supabase.storage
      .from('lego-synthetic')
      .list('', { limit: 100 });
    
    if (rootError) {
      console.log('❌ 루트 폴더 조회 실패:', rootError.message);
      return;
    }
    
    console.log('📁 루트 폴더 목록:');
    rootFolders.forEach(folder => {
      console.log('  -', folder.name, '(type:', folder.metadata?.mimetype || 'folder', ')');
    });
    
    // synthetic 폴더가 있는지 확인
    const syntheticFolder = rootFolders.find(f => f.name === 'synthetic');
    if (syntheticFolder) {
      console.log('\n📁 synthetic 폴더 내용:');
      const { data: syntheticContents, error: syntheticError } = await supabase.storage
        .from('lego-synthetic')
        .list('synthetic', { limit: 100 });
      
      if (syntheticError) {
        console.log('❌ synthetic 폴더 조회 실패:', syntheticError.message);
      } else {
        syntheticContents.forEach(item => {
          console.log('  -', item.name, '(type:', item.metadata?.mimetype || 'folder', ')');
        });
        
        // elementId 폴더들 확인 (6335317 등)
        const elementFolders = syntheticContents.filter(item => 
          item.name.match(/^\d+$/) && !item.metadata?.mimetype
        );
        
        if (elementFolders.length > 0) {
          console.log('\n📁 elementId 폴더들:');
          for (const elementFolder of elementFolders.slice(0, 3)) { // 최대 3개만 확인
            console.log('\n  📁', elementFolder.name, '폴더 내용:');
            const { data: elementContents, error: elementError } = await supabase.storage
              .from('lego-synthetic')
              .list('synthetic/' + elementFolder.name, { limit: 100 });
            
            if (elementError) {
              console.log('    ❌ 조회 실패:', elementError.message);
            } else {
              elementContents.forEach(file => {
                const fileType = file.metadata?.mimetype || 'unknown';
                const isWebP = fileType.includes('webp');
                const isTxt = file.name.endsWith('.txt');
                console.log('    -', file.name, '(type:', fileType, isWebP ? '✅' : isTxt ? '✅' : '❌', ')');
              });
            }
          }
        }
      }
    } else {
      console.log('❌ synthetic 폴더를 찾을 수 없습니다.');
    }
    
  } catch (error) {
    console.log('💥 오류 발생:', error.message);
  }
}

checkStorageStructure().catch(console.error);

/**
 * 수동 업로드 API 서버
 * 실패한 렌더링 파일들을 수동으로 Supabase에 업로드
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { createClient } = require('@supabase/supabase-js');
const fsSync = require('fs');

const app = express();

// 포트 관리 시스템에서 포트 가져오기
let PORT;
try {
  // 포트 설정 파일에서 읽기
  const portConfigPath = path.join(__dirname, '..', '.port-config.json');
  if (fsSync.existsSync(portConfigPath)) {
    const portConfig = JSON.parse(fsSync.readFileSync(portConfigPath, 'utf8'));
    PORT = portConfig.manualUploadApi;
    console.log(`📄 포트 설정 파일에서 읽기: ${PORT}`);
  } else {
    console.log('📄 포트 설정 파일 없음, 기본값 사용');
  }
} catch (error) {
  console.warn('⚠️ 포트 설정 파일 읽기 실패, 기본값 사용:', error.message);
}

// 기본값 설정
PORT = PORT || process.env.MANUAL_UPLOAD_PORT || 3030;

// Supabase 클라이언트 설정
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE || process.env.VITE_SUPABASE_ANON_KEY;

console.log('🔍 환경 변수 확인:');
console.log(`  - SUPABASE_URL: ${supabaseUrl ? '설정됨' : '없음'}`);
console.log(`  - SUPABASE_KEY: ${supabaseKey ? '설정됨' : '없음'}`);

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.');
  console.error('필요한 환경 변수: VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_ROLE 또는 VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 파일 업로드 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'temp', 'manual_uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB 제한
  }
});

// 실패한 업로드 목록 조회
app.get('/api/manual-upload/failed-uploads', async (req, res) => {
  try {
    const trackingFile = path.join(__dirname, '..', 'scripts', 'failed_uploads.json');
    
    try {
      const data = await fs.readFile(trackingFile, 'utf8');
      const failedUploads = JSON.parse(data);
      
      // 상태별 필터링
      const status = req.query.status;
      const filteredUploads = status 
        ? failedUploads.filter(upload => upload.status === status)
        : failedUploads;
      
      res.json({
        success: true,
        data: filteredUploads,
        total: filteredUploads.length
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.json({
          success: true,
          data: [],
          total: 0,
          message: 'No failed uploads found'
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Failed to get failed uploads:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 실패 이벤트 기록 (스크립트에서 호출)
app.post('/api/manual-upload/failed-uploads', async (req, res) => {
  try {
    const trackingFile = path.join(__dirname, '..', 'scripts', 'failed_uploads.json');
    const body = req.body || {};
    const required = ['part_id', 'element_id', 'unique_id', 'error_reason'];
    for (const k of required) {
      if (!body[k]) {
        return res.status(400).json({ success: false, error: `Missing field: ${k}` });
      }
    }

    // 기존 목록 읽기
    let entries = [];
    try {
      const data = await fs.readFile(trackingFile, 'utf8');
      entries = JSON.parse(data);
    } catch (e) {
      entries = [];
    }

    const nowIso = new Date().toISOString();
    const entry = {
      id: `${body.element_id}_${body.unique_id}_${Date.now()}`,
      part_id: body.part_id,
      element_id: body.element_id,
      unique_id: body.unique_id,
      status: body.status || 'failed',
      failed_at: nowIso,
      error_reason: body.error_reason,
      retry_count: body.retry_count || 0,
      local_paths: body.local_paths || {},
    };

    entries.push(entry);
    await fs.writeFile(trackingFile, JSON.stringify(entries, null, 2));

    res.json({ success: true, data: entry });
  } catch (error) {
    console.error('Failed to write failed upload:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 실패한 업로드 통계 조회
app.get('/api/manual-upload/statistics', async (req, res) => {
  try {
    const trackingFile = path.join(__dirname, '..', 'scripts', 'failed_uploads.json');
    
    try {
      const data = await fs.readFile(trackingFile, 'utf8');
      const failedUploads = JSON.parse(data);
      
      const statistics = {
        total: failedUploads.length,
        by_status: {}
      };
      
      failedUploads.forEach(upload => {
        const status = upload.status || 'unknown';
        statistics.by_status[status] = (statistics.by_status[status] || 0) + 1;
      });
      
      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.json({
          success: true,
          data: {
            total: 0,
            by_status: {}
          }
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Failed to get statistics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 단일 파일 수동 업로드
app.post('/api/manual-upload/upload-file', upload.single('file'), async (req, res) => {
  try {
    const { entryId, fileType, elementId, uniqueId } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }
    
    if (!entryId || !fileType || !elementId || !uniqueId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: entryId, fileType, elementId, uniqueId'
      });
    }
    
    // 파일 읽기
    const fileBuffer = await fs.readFile(req.file.path);
    
    // Supabase 경로 생성
    const supabasePath = `synthetic/${elementId}/${uniqueId}${fileType === 'e2_metadata' ? '_e2' : ''}.${getFileExtension(fileType)}`;
    
    // Supabase 업로드
    const result = await supabase.storage
      .from('lego-synthetic')
      .upload(supabasePath, fileBuffer, {
        contentType: getContentType(fileType),
        upsert: true,
        cacheControl: 'public, max-age=31536000'
      });
    
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    // 임시 파일 삭제
    await fs.unlink(req.file.path);
    
    res.json({
      success: true,
      data: {
        entryId,
        fileType,
        supabasePath,
        publicUrl: supabase.storage.from('lego-synthetic').getPublicUrl(supabasePath).data.publicUrl
      }
    });
    
  } catch (error) {
    console.error('Manual upload failed:', error);
    
    // 임시 파일 정리
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('Failed to cleanup temp file:', cleanupError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 전체 항목 재업로드
app.post('/api/manual-upload/retry-entry', async (req, res) => {
  try {
    const { entryId } = req.body;
    
    if (!entryId) {
      return res.status(400).json({
        success: false,
        error: 'Missing entryId'
      });
    }
    
    // 추적 파일에서 항목 조회
    const trackingFile = path.join(__dirname, '..', 'scripts', 'failed_uploads.json');
    const data = await fs.readFile(trackingFile, 'utf8');
    const failedUploads = JSON.parse(data);
    
    const entry = failedUploads.find(upload => upload.id === entryId);
    if (!entry) {
      return res.status(404).json({
        success: false,
        error: 'Entry not found'
      });
    }
    
    // 로컬 파일 존재 확인
    const localPaths = entry.local_paths;
    const missingFiles = [];
    
    for (const [fileType, localPath] of Object.entries(localPaths)) {
      try {
        await fs.access(localPath);
      } catch (error) {
        missingFiles.push({ fileType, localPath });
      }
    }
    
    if (missingFiles.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Some local files are missing',
        missingFiles
      });
    }
    
    // 파일별 업로드 시도
    const uploadResults = [];
    
    for (const [fileType, localPath] of Object.entries(localPaths)) {
      try {
        const fileBuffer = await fs.readFile(localPath);
        const supabasePath = entry.supabase_paths[fileType];
        
        const result = await supabase.storage
          .from('lego-synthetic')
          .upload(supabasePath, fileBuffer, {
            contentType: getContentType(fileType),
            upsert: true,
            cacheControl: 'public, max-age=31536000'
          });
        
        if (result.error) {
          uploadResults.push({
            fileType,
            success: false,
            error: result.error.message
          });
        } else {
          uploadResults.push({
            fileType,
            success: true,
            supabasePath,
            publicUrl: supabase.storage.from('lego-synthetic').getPublicUrl(supabasePath).data.publicUrl
          });
        }
      } catch (error) {
        uploadResults.push({
          fileType,
          success: false,
          error: error.message
        });
      }
    }
    
    // 성공한 파일 수
    const successCount = uploadResults.filter(result => result.success).length;
    const totalCount = uploadResults.length;
    
    // 추적 파일 업데이트
    if (successCount === totalCount) {
      // 모든 파일 업로드 성공
      const updatedUploads = failedUploads.map(upload => 
        upload.id === entryId 
          ? { ...upload, status: 'success', success_at: new Date().toISOString() }
          : upload
      );
      
      await fs.writeFile(trackingFile, JSON.stringify(updatedUploads, null, 2));
    } else {
      // 일부 실패
      const updatedUploads = failedUploads.map(upload => 
        upload.id === entryId 
          ? { ...upload, status: 'partial_success', retry_results: uploadResults }
          : upload
      );
      
      await fs.writeFile(trackingFile, JSON.stringify(updatedUploads, null, 2));
    }
    
    res.json({
      success: true,
      data: {
        entryId,
        uploadResults,
        successCount,
        totalCount,
        allSuccessful: successCount === totalCount
      }
    });
    
  } catch (error) {
    console.error('Retry entry failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 항목 상태 업데이트
app.put('/api/manual-upload/update-status', async (req, res) => {
  try {
    const { entryId, status, note } = req.body;
    
    if (!entryId || !status) {
      return res.status(400).json({
        success: false,
        error: 'Missing entryId or status'
      });
    }
    
    const trackingFile = path.join(__dirname, '..', 'scripts', 'failed_uploads.json');
    const data = await fs.readFile(trackingFile, 'utf8');
    const failedUploads = JSON.parse(data);
    
    const entryIndex = failedUploads.findIndex(upload => upload.id === entryId);
    if (entryIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Entry not found'
      });
    }
    
    // 상태 업데이트
    failedUploads[entryIndex].status = status;
    failedUploads[entryIndex].updated_at = new Date().toISOString();
    
    if (note) {
      failedUploads[entryIndex].note = note;
    }
    
    await fs.writeFile(trackingFile, JSON.stringify(failedUploads, null, 2));
    
    res.json({
      success: true,
      data: {
        entryId,
        status,
        updated_at: failedUploads[entryIndex].updated_at
      }
    });
    
  } catch (error) {
    console.error('Update status failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 항목 삭제
app.delete('/api/manual-upload/delete-entry', async (req, res) => {
  try {
    const { entryId } = req.body;
    
    if (!entryId) {
      return res.status(400).json({
        success: false,
        error: 'Missing entryId'
      });
    }
    
    const trackingFile = path.join(__dirname, '..', 'scripts', 'failed_uploads.json');
    const data = await fs.readFile(trackingFile, 'utf8');
    const failedUploads = JSON.parse(data);
    
    const filteredUploads = failedUploads.filter(upload => upload.id !== entryId);
    
    if (filteredUploads.length === failedUploads.length) {
      return res.status(404).json({
        success: false,
        error: 'Entry not found'
      });
    }
    
    await fs.writeFile(trackingFile, JSON.stringify(filteredUploads, null, 2));
    
    res.json({
      success: true,
      data: {
        entryId,
        deleted: true
      }
    });
    
  } catch (error) {
    console.error('Delete entry failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 헬퍼 함수들
function getFileExtension(fileType) {
  const extensions = {
    'image': 'webp',
    'annotation': 'txt',
    'metadata': 'json',
    'e2_metadata': 'json'
  };
  return extensions[fileType] || 'bin';
}

function getContentType(fileType) {
  const contentTypes = {
    'image': 'image/webp',
    'annotation': 'text/plain',
    'metadata': 'application/json',
    'e2_metadata': 'application/json'
  };
  return contentTypes[fileType] || 'application/octet-stream';
}

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 Manual Upload API server running on port ${PORT}`);
  console.log(`📁 Tracking file: ${path.join(__dirname, '..', 'scripts', 'failed_uploads.json')}`);
});

module.exports = app;

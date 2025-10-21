const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

/**
 * 렌더링 최적화 진단 API
 * POST /api/render-optimization/audit
 */
router.post('/audit', async (req, res) => {
  try {
    const {
      glob = 'output/synthetic/dataset_synthetic/images/train/*/*.json',
      baseline_sec = 4.0,
      auto_baseline = true,
      quality_simulation = true,
      group_by = 'shape_tag',
      max_files = 0,
      workers = 8
    } = req.body;

    console.log('렌더링 최적화 진단 요청:', { glob, baseline_sec, auto_baseline, quality_simulation, group_by });

    // Python 스크립트 실행
    const scriptPath = path.join(__dirname, '..', 'scripts', 'render_optimize_audit_enhanced.py');
    const args = [
      '--glob', glob,
      '--baseline-sec', baseline_sec.toString(),
      '--report', 'json'
    ];

    if (auto_baseline) {
      args.push('--auto-baseline');
    }

    if (quality_simulation) {
      args.push('--quality-simulation');
    }

    if (group_by) {
      args.push('--group-by', group_by);
    }

    if (max_files > 0) {
      args.push('--max-files', max_files.toString());
    }

    args.push('--workers', workers.toString());

    console.log('Python 스크립트 실행:', scriptPath, args);

    const pythonProcess = spawn('python', [scriptPath, ...args], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          console.log('진단 완료:', result.files, '개 파일 분석');
          res.json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
          });
        } catch (parseError) {
          console.error('JSON 파싱 오류:', parseError);
          console.error('stdout:', stdout);
          res.status(500).json({
            success: false,
            error: '결과 파싱 실패',
            details: parseError.message,
            stdout: stdout.substring(0, 500)
          });
        }
      } else {
        console.error('Python 스크립트 실행 실패:', code);
        console.error('stderr:', stderr);
        res.status(500).json({
          success: false,
          error: '진단 스크립트 실행 실패',
          details: stderr,
          code: code
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Python 프로세스 오류:', error);
      res.status(500).json({
        success: false,
        error: 'Python 프로세스 시작 실패',
        details: error.message
      });
    });

  } catch (error) {
    console.error('API 오류:', error);
    res.status(500).json({
      success: false,
      error: '서버 오류',
      details: error.message
    });
  }
});

/**
 * 렌더링 최적화 히스토리 조회
 * GET /api/render-optimization/history
 */
router.get('/history', async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;
    
    // 실제 구현에서는 Supabase에서 히스토리 조회
    // 여기서는 더미 데이터 반환
    const history = [
      {
        id: 1,
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        files: 24,
        baseline_sec: 4.0,
        max_speedup: 8.07,
        recommendations_applied: 3
      },
      {
        id: 2,
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        files: 18,
        baseline_sec: 3.8,
        max_speedup: 6.2,
        recommendations_applied: 2
      }
    ];

    res.json({
      success: true,
      data: history.slice(offset, offset + parseInt(limit)),
      total: history.length
    });

  } catch (error) {
    console.error('히스토리 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '히스토리 조회 실패',
      details: error.message
    });
  }
});

/**
 * 최적화 권장사항 적용
 * POST /api/render-optimization/apply
 */
router.post('/apply', async (req, res) => {
  try {
    const { 
      scenario, 
      target_samples, 
      gpu_enabled, 
      cache_enabled,
      parallel_workers 
    } = req.body;

    console.log('최적화 적용 요청:', { scenario, target_samples, gpu_enabled, cache_enabled, parallel_workers });

    // 실제 구현에서는 렌더링 설정 업데이트
    // 여기서는 시뮬레이션 결과 반환
    const result = {
      success: true,
      applied_changes: {
        samples: target_samples,
        gpu_enabled: gpu_enabled,
        cache_enabled: cache_enabled,
        parallel_workers: parallel_workers
      },
      estimated_improvement: {
        speedup: scenario === 'once_render_low' ? 3.44 : 1.50,
        quality_impact: 'low'
      },
      timestamp: new Date().toISOString()
    };

    res.json(result);

  } catch (error) {
    console.error('최적화 적용 오류:', error);
    res.status(500).json({
      success: false,
      error: '최적화 적용 실패',
      details: error.message
    });
  }
});

/**
 * 실시간 렌더링 상태 모니터링
 * GET /api/render-optimization/status
 */
router.get('/status', async (req, res) => {
  try {
    // 실제 구현에서는 현재 렌더링 작업 상태 조회
    const status = {
      active_jobs: 2,
      completed_today: 156,
      average_time: 2.3,
      gpu_utilization: 85,
      memory_usage: 67,
      last_optimization: new Date(Date.now() - 3600000).toISOString()
    };

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('상태 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '상태 조회 실패',
      details: error.message
    });
  }
});

/**
 * 렌더링 품질 메트릭 조회
 * GET /api/render-optimization/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const { period = '24h' } = req.query;
    
    // 실제 구현에서는 시계열 데이터 조회
    const metrics = {
      ssim_trend: [
        { timestamp: new Date(Date.now() - 86400000).toISOString(), value: 0.95 },
        { timestamp: new Date(Date.now() - 43200000).toISOString(), value: 0.96 },
        { timestamp: new Date(Date.now()).toISOString(), value: 0.97 }
      ],
      snr_trend: [
        { timestamp: new Date(Date.now() - 86400000).toISOString(), value: 32.1 },
        { timestamp: new Date(Date.now() - 43200000).toISOString(), value: 33.2 },
        { timestamp: new Date(Date.now()).toISOString(), value: 34.5 }
      ],
      render_time_trend: [
        { timestamp: new Date(Date.now() - 86400000).toISOString(), value: 4.2 },
        { timestamp: new Date(Date.now() - 43200000).toISOString(), value: 3.8 },
        { timestamp: new Date(Date.now()).toISOString(), value: 2.1 }
      ]
    };

    res.json({
      success: true,
      data: metrics,
      period: period
    });

  } catch (error) {
    console.error('메트릭 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '메트릭 조회 실패',
      details: error.message
    });
  }
});

module.exports = router;

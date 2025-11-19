import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// [FIX] 수정됨: Vercel 빌드에서 './src/config/env.js' 경로 해석 실패 대응
// vite.config.js 내부에 최소 헬퍼 구현해 외부 모듈 의존 제거
const DEFAULT_PORTS = {
  frontend: 3000,
  aiApi: 3005,
  webpApi: 3004,
  trainingApi: 3010,
  syntheticApi: 3011,
  manualUploadApi: 3030,
  monitoring: 3040,
  semanticVectorApi: 3022,
  inspectionApi: 3045,
  legoInstructionsApi: 3050,
}

function getIntegratedConfig(mode) {
  const env = process.env || {}
  const toInt = (v, d) => {
    const n = parseInt(v, 10)
    return Number.isFinite(n) ? n : d
  }
  const ports = {
    ...DEFAULT_PORTS,
    frontend: 3000,
    aiApi: toInt(env.VITE_PORT_AI_API, DEFAULT_PORTS.aiApi),
    webpApi: toInt(env.VITE_PORT_WEBP_API, DEFAULT_PORTS.webpApi),
    trainingApi: toInt(env.VITE_PORT_TRAINING_API, DEFAULT_PORTS.trainingApi),
    syntheticApi: toInt(env.VITE_PORT_SYNTHETIC_API, DEFAULT_PORTS.syntheticApi),
    manualUploadApi: toInt(env.VITE_PORT_MANUAL_UPLOAD_API, DEFAULT_PORTS.manualUploadApi),
    monitoring: toInt(env.VITE_PORT_MONITORING, DEFAULT_PORTS.monitoring),
    semanticVectorApi: toInt(env.VITE_PORT_SEMANTIC_VECTOR_API, DEFAULT_PORTS.semanticVectorApi),
    inspectionApi: toInt(env.VITE_PORT_INSPECTION_API, DEFAULT_PORTS.inspectionApi),
    legoInstructionsApi: toInt(env.VITE_PORT_LEGO_INSTRUCTIONS_API, DEFAULT_PORTS.legoInstructionsApi),
  }
  return {
    ports,
    env,
    mode,
    isDevelopment: mode === 'development',
    isProduction: mode === 'production',
  }
}

function validateConfig(config) {
  const required = ['frontend', 'aiApi', 'webpApi', 'syntheticApi', 'trainingApi']
  const missing = required.filter((k) => !config.ports[k])
  if (missing.length) {
    console.error('[ERROR] 필수 포트 설정 누락:', missing.join(', ')) // [FIX] 수정됨
    return false
  }
  const invalid = Object.entries(config.ports)
    .filter(([, port]) => port < 1024 || port > 65535)
    .map(([name]) => name)
  if (invalid.length) {
    console.error('[ERROR] 잘못된 포트 범위:', invalid.join(', ')) // [FIX] 수정됨
    return false
  }
  console.log('[OK] 설정 검증 완료') // [FIX] 수정됨
  return true
}

function printConfig(config) {
  console.log('\n[FIX] 현재 설정:') // [FIX] 수정됨
  console.log('='.repeat(40))
  console.log(`모드: ${config.mode}`)
  console.log(`개발환경: ${config.isDevelopment ? 'Yes' : 'No'}`)
  console.log('\n포트 설정:')
  Object.entries(config.ports).forEach(([name, port]) => {
    console.log(`  ${name}: ${port}`)
  })
  console.log('='.repeat(40))
}

export default defineConfig(({ mode }) => {
  // 통합 설정 로드
  const config = getIntegratedConfig(mode)
  
  // 설정 검증
  if (!validateConfig(config)) {
    throw new Error('설정 검증 실패')
  }
  
  // 개발 환경에서만 설정 출력
  if (config.isDevelopment) {
    printConfig(config)
  }
  
  const portConfig = config.ports
  
  // 프록시 로거 생성 함수
  const createProxyLogger = (name) => (proxy, _options) => {
    proxy.on('error', (err, _req, _res) => {
      console.log(`[ERROR] ${name} proxy error:`, err.message) // [FIX] 수정됨
    })
    proxy.on('proxyReq', (proxyReq, req, _res) => {
      console.log(`[UPLOAD] ${name} Request:`, req.method, req.url) // [FIX] 수정됨
    })
    proxy.on('proxyRes', (proxyRes, req, _res) => {
      const status = proxyRes.statusCode >= 400 ? '[ERROR]' : '[OK]' // [FIX] 수정됨
      console.log(`${status} ${name} Response:`, proxyRes.statusCode, req.url)
    })
  }
  
  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        // Supabase 호환성을 위해 polyfill 제거
        // stream: 'stream-browserify',
        // url: 'url',
        // util: resolve(__dirname, 'src/polyfills/util.js'),
        // http: resolve(__dirname, 'src/polyfills/http.js'),
      },
      dedupe: ['@supabase/supabase-js'], // [FIX] 수정됨: 중복 의존성 제거
    },
    // API 파일 처리를 위한 추가 설정
    build: {
      rollupOptions: {
        external: ['dotenv']
      }
    },
    optimizeDeps: {
      include: ['localforage', 'p-limit', 'chart.js', 'vue-chartjs', 'pinia', 'axios', 'onnxruntime-web'],
      exclude: ['@supabase/supabase-js'], // Supabase는 최적화에서 제외
      needsInterop: ['onnxruntime-web'], // [FIX] 수정됨: onnxruntime-web ESM/CJS 혼합 해결
      esbuildOptions: {
        define: {
          global: 'globalThis' // [FIX] 수정됨: esbuild에서 global 변수 처리
        }
      }
    },
    define: {
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: false,
      'global': 'globalThis', // [FIX] 수정됨: 브라우저에서 global 변수 지원
    },
    server: {
      port: portConfig.frontend,
      strictPort: true,
      host: '0.0.0.0',
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: portConfig.frontend,
        clientPort: portConfig.frontend,
        overlay: true
      }, // [FIX] 수정됨: HMR 연결 안정화
      watch: {
        usePolling: false,
        interval: 100
      }, // [FIX] 수정됨: 파일 감시 최적화
      fs: {
        strict: false,
        allow: ['..']
      },
      configureServer: undefined,
      proxy: {
        '/api/inspection': {
          target: `http://localhost:${portConfig.inspectionApi || 3045}`,
          changeOrigin: true,
          configure: createProxyLogger('Inspection')
        },
        '/api/upload/proxy-image': {
          target: `http://localhost:${portConfig.webpApi}`,
          changeOrigin: true,
          configure: createProxyLogger('WebP')
        },
        '/api/proxy': {
          target: 'https://cdn.rebrickable.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/proxy/, ''),
          configure: createProxyLogger('Rebrickable')
        },
        '/api/synthetic': {
          target: `http://localhost:${portConfig.syntheticApi}`,
          changeOrigin: true,
          configure: createProxyLogger('Synthetic')
        },
        '/api/manual-upload': {
          target: `http://localhost:${portConfig.manualUploadApi}`,
          changeOrigin: true,
          configure: createProxyLogger('ManualUpload')
        },
        '/api/ai': {
          target: `http://localhost:${portConfig.aiApi}`,
          changeOrigin: true,
          configure: createProxyLogger('AI')
        },
        '/api/openai': {
          target: `http://localhost:${portConfig.frontend}`,
          changeOrigin: true,
          configure: createProxyLogger('OpenAI')
        },
        '/api/system': {
          target: `http://localhost:${portConfig.frontend}`,
          changeOrigin: true,
          configure: createProxyLogger('System')
        },
        '/api/proxy-image': {
          target: `http://localhost:${portConfig.frontend}`,
          changeOrigin: true,
          configure: createProxyLogger('ProxyImage')
        },
               '/api/semantic-vector': {
                 target: `http://localhost:${portConfig.semanticVectorApi || 3022}`,
                 changeOrigin: true,
                 configure: createProxyLogger('SemanticVector')
               },
               '/api/port-status': {
                 target: `http://localhost:${portConfig.monitoring || 3040}`,
                 changeOrigin: true,
                 configure: createProxyLogger('PortStatus')
               }
      }
    }
  }
})
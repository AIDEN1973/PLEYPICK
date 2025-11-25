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
  
  const supabaseProxyTarget = process.env.VITE_SUPABASE_URL || 'https://npferbxuxocbfnfbpcnz.supabase.co' // 🔧 수정됨
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk' // 🔧 수정됨
  const supabaseProxyPath = process.env.VITE_SUPABASE_PROXY_PATH || '' // 🔧 수정됨
  const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // 🔧 수정됨
  const supabaseProxyRewrite = supabaseProxyPath ? new RegExp(`^${escapeRegex(supabaseProxyPath)}`) : null // 🔧 수정됨

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        stream: 'stream-browserify', // [FIX] 수정됨: stream 모듈 브라우저 폴리필
        url: 'url', // [FIX] 수정됨: url 모듈 브라우저 폴리필
        util: resolve(__dirname, 'src/polyfills/util.js'), // [FIX] 수정됨: util 모듈 브라우저 폴리필
        http: resolve(__dirname, 'src/polyfills/http.js'), // [FIX] 수정됨: http 모듈 브라우저 폴리필
      },
      dedupe: ['@supabase/supabase-js'], // [FIX] 수정됨: 중복 의존성 제거
    },
    // API 파일 처리를 위한 추가 설정
    build: {
      rollupOptions: {
        external: ['dotenv']
      },
      minify: 'esbuild', // esbuild 사용 (terser 대신, 기본 포함)
      // esbuild는 drop_console 옵션을 지원하지 않으므로
      // console.log는 기본적으로 유지됨
    },
    optimizeDeps: {
      include: ['localforage', 'p-limit', 'chart.js', 'vue-chartjs', 'pinia', 'axios', 'onnxruntime-web', 'url', 'util'],
      exclude: [], // [FIX] 수정됨: alias로 해결하므로 exclude 제거
      needsInterop: ['onnxruntime-web', 'url', 'util'], // [FIX] 수정됨: onnxruntime-web ESM/CJS 혼합 해결, url/util 모듈 추가
      esbuildOptions: {
        define: {
          global: 'globalThis' // [FIX] 수정됨: esbuild에서 global 변수 처리
        }
      },
      force: true // [FIX] 수정됨: 의존성 강제 재최적화
    },
    define: {
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: false,
      // 'global': 'globalThis' 제거 - Supabase 옵션의 'global' 키와 충돌 방지
      // 브라우저에서는 이미 globalThis가 기본값이므로 별도 변환 불필요
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
        '/api/rebrickable': {
          target: `http://localhost:${portConfig.webpApi}`,
          changeOrigin: true,
          configure: createProxyLogger('RebrickableAPI')
        },
        '/api/lego-instructions': {
          target: `http://localhost:${portConfig.webpApi}`,
          changeOrigin: true,
          configure: createProxyLogger('LEGO Instructions')
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
        ...(supabaseProxyPath
          ? {
              [supabaseProxyPath]: {
                target: supabaseProxyTarget,
                changeOrigin: true,
                secure: true,
                rewrite: (path) => (supabaseProxyRewrite ? path.replace(supabaseProxyRewrite, '') : path),
                headers: supabaseAnonKey
                  ? {
                      apikey: supabaseAnonKey,
                      Authorization: `Bearer ${supabaseAnonKey}`,
                    }
                  : undefined,
                configure: createProxyLogger('SupabaseREST'),
              }
            }
          : {}),
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
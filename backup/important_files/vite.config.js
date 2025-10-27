import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { getIntegratedConfig, validateConfig, printConfig } from './src/config/env.js'

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
      console.log(`❌ ${name} proxy error:`, err.message)
    })
    proxy.on('proxyReq', (proxyReq, req, _res) => {
      console.log(`📤 ${name} Request:`, req.method, req.url)
    })
    proxy.on('proxyRes', (proxyRes, req, _res) => {
      const status = proxyRes.statusCode >= 400 ? '❌' : '✅'
      console.log(`${status} ${name} Response:`, proxyRes.statusCode, req.url)
    })
  }
  
  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    // API 파일 처리를 위한 추가 설정
    build: {
      rollupOptions: {
        external: ['dotenv']
      }
    },
    optimizeDeps: {
      include: ['localforage', 'p-limit', 'chart.js', 'vue-chartjs', 'pinia', 'axios'],
      exclude: []
    },
    define: {
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: false,
    },
    server: {
      port: portConfig.frontend,
      strictPort: true,
      host: '0.0.0.0',
      proxy: {
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
        }
      }
    }
  }
})
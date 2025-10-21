import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import fs from 'fs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  // 통합 포트 관리 시스템에서 포트 읽기 (프론트엔드는 항상 3000 고정)
  const getPortConfig = () => {
    try {
      const portConfigFile = resolve(process.cwd(), '.port-config.json')
      if (fs.existsSync(portConfigFile)) {
        const portConfig = JSON.parse(fs.readFileSync(portConfigFile, 'utf8'))
        console.log('📄 포트 설정 파일에서 읽기 성공')
        // 프론트엔드는 항상 3000으로 고정
        portConfig.frontend = 3000
        return portConfig
      }
    } catch (error) {
      console.warn('포트 설정 파일을 읽을 수 없습니다:', error.message)
    }
    
    // 기본 포트 설정 (프론트엔드는 항상 3000)
    const defaultConfig = {
      frontend: 3000,  // 항상 3000 고정
      trainingApi: 3010,
      syntheticApi: 3011,
      worker: 3020,
      manualUploadApi: 3030,
      monitoring: 3040
    }
    
    console.log('📄 기본 포트 설정 사용 (프론트엔드: 3000 고정)')
    return defaultConfig
  }
  
  const portConfig = getPortConfig()
  
  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    optimizeDeps: {
      include: ['localforage', 'p-limit', 'chart.js', 'vue-chartjs'],
      exclude: []
    },
    define: {
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: false,
    },
    server: {
      port: portConfig.frontend,
      strictPort: true,
      host: 'localhost',
      proxy: {
        '/api/upload/proxy-image': {
          target: 'http://localhost:3004',
          changeOrigin: true,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('webp proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending WebP Proxy Request:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received WebP Proxy Response:', proxyRes.statusCode, req.url);
            });
          },
        },
        '/api/proxy': {
          target: 'https://cdn.rebrickable.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/proxy/, ''),
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending Request to the Target:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
            });
          },
        },
        '/api/openai': {
          target: 'https://api.openai.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/openai/, ''),
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('OpenAI proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending OpenAI Request:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received OpenAI Response:', proxyRes.statusCode, req.url);
            });
          },
        },
        '/api/upload': {
          target: 'https://vanessa2.godohosting.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/upload/, ''),
          configure: (proxy, _options) => {
            console.log('Configuring /api/upload proxy');
            proxy.on('error', (err, _req, _res) => {
              console.log('upload proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending Upload Request:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received Upload Response:', proxyRes.statusCode, req.url);
            });
          },
        },
        '/api/synthetic': {
          target: `http://localhost:${portConfig.syntheticApi}`,
          changeOrigin: true,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('synthetic API proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending Synthetic API Request:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received Synthetic API Response:', proxyRes.statusCode, req.url);
            });
          },
        },
        '/api/dataset': {
          target: `http://localhost:${portConfig.syntheticApi}`,
          changeOrigin: true,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('dataset API proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending Dataset API Request:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received Dataset API Response:', proxyRes.statusCode, req.url);
            });
          },
        },
        '/api/manual-upload': {
          target: `http://localhost:${portConfig.manualUploadApi}`,
          changeOrigin: true,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('manual upload API proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending Manual Upload API Request:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received Manual Upload API Response:', proxyRes.statusCode, req.url);
            });
          },
        }
      }
    }
  }
})
// 🔧 수정됨: 브라우저용 http 모듈 빈 polyfill
// http 모듈은 브라우저에서 사용할 수 없으므로 빈 객체로 대체

// ESM exports
export default {}
export const STATUS_CODES = {}
export const METHODS = []
export const Agent = class {}
export const ClientRequest = class {}
export const IncomingMessage = class {}
export const ServerResponse = class {}
export const Server = class {}
export const createServer = () => ({})
export const request = () => ({})
export const get = () => ({})

// CommonJS exports (stream-browserify 호환성)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STATUS_CODES: {},
    METHODS: [],
    Agent: class {},
    ClientRequest: class {},
    IncomingMessage: class {},
    ServerResponse: class {},
    Server: class {},
    createServer: () => ({}),
    request: () => ({}),
    get: () => ({})
  }
}


// 🔧 수정됨: 브라우저용 util 모듈 polyfill
// util 모듈의 주요 함수들을 브라우저에서 사용 가능하도록 구현

// ESM exports
export const debuglog = (section) => {
  const prefix = `[${section}]`
  return (...args) => {
    if (process?.env?.NODE_DEBUG?.split(',').includes(section)) {
      console.debug(prefix, ...args)
    }
  }
}

export const inspect = (obj, options = {}) => {
  const depth = options.depth ?? 2
  const maxArrayLength = options.maxArrayLength ?? 100
  
  try {
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value) && value.length > maxArrayLength) {
          return `[Array(${value.length})]`
        }
      }
      return value
    }, 2)
  } catch (e) {
    return String(obj)
  }
}

export const format = (format, ...args) => {
  return format.replace(/%[sdj%]/g, (match) => {
    if (match === '%%') return '%'
    const arg = args.shift()
    if (match === '%s') return String(arg)
    if (match === '%d') return Number(arg)
    if (match === '%j') return JSON.stringify(arg)
    return match
  })
}

export const promisify = (fn) => {
  return (...args) => {
    return new Promise((resolve, reject) => {
      fn(...args, (err, result) => {
        if (err) reject(err)
        else resolve(result)
      })
    })
  }
}

export const isArray = Array.isArray
export const isBuffer = (obj) => obj instanceof ArrayBuffer || obj instanceof Uint8Array
export const isDate = (obj) => obj instanceof Date
export const isError = (obj) => obj instanceof Error
export const isFunction = (obj) => typeof obj === 'function'
export const isNull = (obj) => obj === null
export const isNullOrUndefined = (obj) => obj === null || obj === undefined
export const isNumber = (obj) => typeof obj === 'number' && !isNaN(obj)
export const isObject = (obj) => typeof obj === 'object' && obj !== null && !Array.isArray(obj)
export const isPrimitive = (obj) => obj === null || (typeof obj !== 'object' && typeof obj !== 'function')
export const isRegExp = (obj) => obj instanceof RegExp
export const isString = (obj) => typeof obj === 'string'
export const isSymbol = (obj) => typeof obj === 'symbol'
export const isUndefined = (obj) => obj === undefined

export default {
  debuglog,
  inspect,
  format,
  promisify,
  isArray,
  isBuffer,
  isDate,
  isError,
  isFunction,
  isNull,
  isNullOrUndefined,
  isNumber,
  isObject,
  isPrimitive,
  isRegExp,
  isString,
  isSymbol,
  isUndefined
}

// CommonJS exports (stream-browserify 호환성)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    debuglog,
    inspect,
    format,
    promisify,
    isArray,
    isBuffer,
    isDate,
    isError,
    isFunction,
    isNull,
    isNullOrUndefined,
    isNumber,
    isObject,
    isPrimitive,
    isRegExp,
    isString,
    isSymbol,
    isUndefined
  }
}


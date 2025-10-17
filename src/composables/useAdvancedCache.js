/**
 * 🚀 고급 캐싱 시스템
 * 
 * Redis 기반 분산 캐싱 + 메모리 캐싱 하이브리드
 * - LRU 캐시 (메모리)
 * - Redis 캐시 (분산)
 * - 자동 만료 및 갱신
 * - 캐시 무효화 전략
 */

import { ref, computed } from 'vue'
import { useSupabase } from './useSupabase'

// 전역 캐시 상태
const memoryCache = new Map()
const cacheStats = ref({
  hits: 0,
  misses: 0,
  evictions: 0,
  size: 0
})

// 캐시 설정
const CACHE_CONFIG = {
  // 메모리 캐시 설정
  MEMORY_MAX_SIZE: 1000,
  MEMORY_TTL: 5 * 60 * 1000, // 5분
  
  // Redis 캐시 설정
  REDIS_TTL: 60 * 60 * 1000, // 1시간
  REDIS_PREFIX: 'brickbox:',
  
  // 캐시 전략
  STRATEGY: 'hybrid', // 'memory', 'redis', 'hybrid'
  
  // 자동 갱신
  AUTO_REFRESH: true,
  REFRESH_THRESHOLD: 0.8 // 80% TTL 경과 시 갱신
}

export function useAdvancedCache() {
  const { supabase } = useSupabase()
  const loading = ref(false)
  const error = ref(null)

  /**
   * 캐시 키 생성
   */
  const generateCacheKey = (prefix, ...params) => {
    const key = params
      .filter(Boolean)
      .map(p => typeof p === 'object' ? JSON.stringify(p) : String(p))
      .join(':')
    return `${CACHE_CONFIG.REDIS_PREFIX}${prefix}:${key}`
  }

  /**
   * 메모리 캐시에서 조회
   */
  const getFromMemory = (key) => {
    const item = memoryCache.get(key)
    if (!item) return null
    
    // TTL 확인
    if (Date.now() > item.expires) {
      memoryCache.delete(key)
      cacheStats.value.evictions++
      return null
    }
    
    cacheStats.value.hits++
    return item.data
  }

  /**
   * 메모리 캐시에 저장
   */
  const setToMemory = (key, data, ttl = CACHE_CONFIG.MEMORY_TTL) => {
    // LRU 정책: 최대 크기 초과 시 오래된 항목 제거
    if (memoryCache.size >= CACHE_CONFIG.MEMORY_MAX_SIZE) {
      const oldestKey = memoryCache.keys().next().value
      memoryCache.delete(oldestKey)
      cacheStats.value.evictions++
    }
    
    memoryCache.set(key, {
      data,
      expires: Date.now() + ttl,
      created: Date.now()
    })
    
    cacheStats.value.size = memoryCache.size
  }

  /**
   * Redis 캐시에서 조회
   */
  const getFromRedis = async (key) => {
    try {
      const { data, error } = await supabase
        .from('cache_store')
        .select('value, expires_at')
        .eq('key', key)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()
      
      if (error || !data) return null
      
      cacheStats.value.hits++
      return JSON.parse(data.value)
    } catch (err) {
      console.warn('Redis 캐시 조회 실패:', err)
      return null
    }
  }

  /**
   * Redis 캐시에 저장
   */
  const setToRedis = async (key, data, ttl = CACHE_CONFIG.REDIS_TTL) => {
    try {
      const expiresAt = new Date(Date.now() + ttl).toISOString()
      
      await supabase
        .from('cache_store')
        .upsert({
          key,
          value: JSON.stringify(data),
          expires_at: expiresAt,
          created_at: new Date().toISOString()
        })
      
      return true
    } catch (err) {
      console.warn('Redis 캐시 저장 실패:', err)
      return false
    }
  }

  /**
   * 하이브리드 캐시 조회
   */
  const get = async (key, fetcher, options = {}) => {
    const {
      ttl = CACHE_CONFIG.MEMORY_TTL,
      strategy = CACHE_CONFIG.STRATEGY,
      autoRefresh = CACHE_CONFIG.AUTO_REFRESH
    } = options

    // 1. 메모리 캐시에서 조회
    if (strategy === 'memory' || strategy === 'hybrid') {
      const memoryData = getFromMemory(key)
      if (memoryData) {
        // 자동 갱신 체크
        if (autoRefresh && shouldRefresh(key)) {
          refreshInBackground(key, fetcher, ttl)
        }
        return memoryData
      }
    }

    // 2. Redis 캐시에서 조회
    if (strategy === 'redis' || strategy === 'hybrid') {
      const redisData = await getFromRedis(key)
      if (redisData) {
        // 메모리 캐시에도 저장
        if (strategy === 'hybrid') {
          setToMemory(key, redisData, ttl)
        }
        return redisData
      }
    }

    // 3. 캐시 미스 - 데이터 페처 실행
    cacheStats.value.misses++
    loading.value = true
    
    try {
      const data = await fetcher()
      
      // 캐시에 저장
      if (strategy === 'memory' || strategy === 'hybrid') {
        setToMemory(key, data, ttl)
      }
      
      if (strategy === 'redis' || strategy === 'hybrid') {
        await setToRedis(key, data, ttl)
      }
      
      return data
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 자동 갱신 필요 여부 확인
   */
  const shouldRefresh = (key) => {
    const item = memoryCache.get(key)
    if (!item) return false
    
    const elapsed = Date.now() - item.created
    const threshold = item.expires - item.created
    return elapsed > (threshold * CACHE_CONFIG.REFRESH_THRESHOLD)
  }

  /**
   * 백그라운드 갱신
   */
  const refreshInBackground = async (key, fetcher, ttl) => {
    try {
      const data = await fetcher()
      
      // 캐시 업데이트
      setToMemory(key, data, ttl)
      await setToRedis(key, data, ttl)
      
      console.log(`🔄 캐시 백그라운드 갱신 완료: ${key}`)
    } catch (err) {
      console.warn(`⚠️ 캐시 백그라운드 갱신 실패: ${key}`, err)
    }
  }

  /**
   * 캐시 무효화
   */
  const invalidate = async (pattern) => {
    // 메모리 캐시 무효화
    if (pattern.includes('*')) {
      // 와일드카드 패턴
      const regex = new RegExp(pattern.replace(/\*/g, '.*'))
      for (const key of memoryCache.keys()) {
        if (regex.test(key)) {
          memoryCache.delete(key)
          cacheStats.value.evictions++
        }
      }
    } else {
      // 정확한 키
      memoryCache.delete(pattern)
    }
    
    // Redis 캐시 무효화
    try {
      await supabase
        .from('cache_store')
        .delete()
        .like('key', pattern)
    } catch (err) {
      console.warn('Redis 캐시 무효화 실패:', err)
    }
    
    cacheStats.value.size = memoryCache.size
  }

  /**
   * 캐시 통계
   */
  const getStats = () => {
    const total = cacheStats.value.hits + cacheStats.value.misses
    const hitRate = total > 0 ? (cacheStats.value.hits / total * 100).toFixed(2) : 0
    
    return {
      ...cacheStats.value,
      hitRate: `${hitRate}%`,
      memoryUsage: `${memoryCache.size}/${CACHE_CONFIG.MEMORY_MAX_SIZE}`
    }
  }

  /**
   * 캐시 클리어
   */
  const clear = () => {
    memoryCache.clear()
    cacheStats.value = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0
    }
  }

  /**
   * 부품 메타데이터 캐싱
   */
  const getPartMetadata = async (partId, colorId) => {
    const key = generateCacheKey('part_metadata', partId, colorId)
    
    return await get(key, async () => {
      const { data, error } = await supabase
        .from('parts_master_features')
        .select('*')
        .eq('part_id', partId)
        .eq('color_id', colorId)
        .single()
      
      if (error) throw error
      return data
    }, {
      ttl: 30 * 60 * 1000, // 30분
      strategy: 'hybrid'
    })
  }

  /**
   * 세트 정보 캐싱
   */
  const getSetInfo = async (setNum) => {
    const key = generateCacheKey('set_info', setNum)
    
    return await get(key, async () => {
      const { data, error } = await supabase
        .from('lego_sets')
        .select('*')
        .eq('set_num', setNum)
        .single()
      
      if (error) throw error
      return data
    }, {
      ttl: 60 * 60 * 1000, // 1시간
      strategy: 'hybrid'
    })
  }

  /**
   * 검색 결과 캐싱
   */
  const getSearchResults = async (query, filters = {}) => {
    const key = generateCacheKey('search', query, filters)
    
    return await get(key, async () => {
      let queryBuilder = supabase
        .from('parts_master_features')
        .select('*')
      
      // 필터 적용
      if (filters.shape_tag) {
        queryBuilder = queryBuilder.eq('shape_tag', filters.shape_tag)
      }
      if (filters.series) {
        queryBuilder = queryBuilder.eq('series', filters.series)
      }
      
      const { data, error } = await queryBuilder
      
      if (error) throw error
      return data
    }, {
      ttl: 10 * 60 * 1000, // 10분
      strategy: 'hybrid'
    })
  }

  return {
    // 기본 캐시 함수
    get,
    invalidate,
    clear,
    
    // 특화된 캐시 함수
    getPartMetadata,
    getSetInfo,
    getSearchResults,
    
    // 상태 및 통계
    loading,
    error,
    getStats,
    
    // 설정
    config: CACHE_CONFIG
  }
}

// 캐시 스토어 테이블 생성 SQL
export const CACHE_STORE_SQL = `
-- 캐시 스토어 테이블 생성
CREATE TABLE IF NOT EXISTS cache_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_cache_store_expires ON cache_store(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_store_created ON cache_store(created_at);

-- 만료된 캐시 자동 정리 함수
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM cache_store WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- RLS 정책
ALTER TABLE cache_store ENABLE ROW LEVEL SECURITY;

CREATE POLICY cache_store_policy ON cache_store
FOR ALL TO authenticated
USING (true);
`;

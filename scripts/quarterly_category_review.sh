#!/bin/bash
# ============================================================================
# 분기별 카테고리 검토 스크립트
# ============================================================================
# 목적: unknown 카테고리 로그 분석 및 리포트 생성
# 실행 주기: 분기 1회 (3개월마다)
# 사용법: ./scripts/quarterly_category_review.sh
# ============================================================================

echo "============================================================================"
echo "📊 분기별 카테고리 검토 리포트"
echo "실행 시각: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================================"
echo ""

# DB 연결 설정 (환경변수 또는 .env 파일에서 로드)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-brickbox}"
DB_USER="${DB_USER:-postgres}"

# 1. 분기별 리포트 생성
echo "📈 1. 최근 3개월 unknown 카테고리 분석..."
echo ""

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
\x on
SELECT * FROM generate_category_review_report(10, NOW() - INTERVAL '3 months');
\x off
EOF

echo ""
echo "============================================================================"
echo ""

# 2. 요약 통계
echo "📊 2. 카테고리별 요약 통계..."
echo ""

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
SELECT 
  shape_tag,
  unique_parts_count,
  total_detections,
  CASE 
    WHEN total_detections >= 100 THEN '🔴 HIGH'
    WHEN total_detections >= 50 THEN '🟡 MEDIUM'
    ELSE '🟢 LOW'
  END as priority
FROM v_unknown_categories_summary
ORDER BY total_detections DESC
LIMIT 20;
EOF

echo ""
echo "============================================================================"
echo ""

# 3. 최근 7일 트렌드
echo "📈 3. 최근 7일간 unknown 검출 트렌드..."
echo ""

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
SELECT 
  DATE(last_detected_at) as date,
  COUNT(DISTINCT part_id) as unique_parts,
  SUM(detected_count) as total_detections
FROM unknown_category_logs
WHERE last_detected_at >= NOW() - INTERVAL '7 days'
  AND part_category = 99
GROUP BY DATE(last_detected_at)
ORDER BY date DESC;
EOF

echo ""
echo "============================================================================"
echo ""

# 4. 권장 사항 출력
echo "💡 권장 사항:"
echo ""
echo "  🔴 HIGH Priority (100+ 검출):"
echo "     → 즉시 새 카테고리 추가 권장"
echo "     → SQL: INSERT INTO part_categories ..."
echo ""
echo "  🟡 MEDIUM Priority (50-99 검출):"
echo "     → 다음 분기 검토 대상"
echo ""
echo "  🟢 LOW Priority (10-49 검출):"
echo "     → 모니터링 계속"
echo ""
echo "============================================================================"
echo ""

# 5. 카테고리 추가 템플릿 생성
echo "📝 5. 카테고리 추가 SQL 템플릿 생성 중..."
echo ""

cat > /tmp/add_category_template.sql <<'SQL_TEMPLATE'
-- ============================================================================
-- 신규 카테고리 추가 템플릿
-- ============================================================================
-- 분기별 검토 후 필요한 카테고리를 추가하세요
-- 작성일: $(date '+%Y-%m-%d')
-- ============================================================================

-- 1. 다음 사용 가능한 ID 확인
SELECT MAX(id) + 1 as next_id 
FROM part_categories 
WHERE id < 99;

-- 2. 새 카테고리 추가 (예시)
-- INSERT INTO part_categories (id, code, display_name, display_name_ko, category_type, sort_order)
-- VALUES (30, 'connector', 'Connector', '커넥터', 'shape', 30);

-- 3. 기존 부품 마이그레이션
-- UPDATE parts_master_features
-- SET part_category = 30, shape_tag = 'connector'
-- WHERE shape_tag = 'unknown' 
--   AND LOWER(part_name) LIKE '%connector%';

-- 4. 로그 정리
-- SELECT cleanup_resolved_category_logs('connector');

-- 5. 캐시 갱신 (애플리케이션 재시작 또는 캐시 클리어)
SQL_TEMPLATE

echo "✅ 템플릿 생성 완료: /tmp/add_category_template.sql"
echo ""
echo "============================================================================"
echo ""
echo "✅ 분기별 검토 완료!"
echo ""
echo "다음 단계:"
echo "  1. HIGH priority 카테고리 검토"
echo "  2. /tmp/add_category_template.sql 수정"
echo "  3. SQL 실행 (psql -f /tmp/add_category_template.sql)"
echo "  4. 애플리케이션 재배포 (캐시 갱신)"
echo ""
echo "============================================================================"


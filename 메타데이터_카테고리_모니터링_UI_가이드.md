# 📊 카테고리 모니터링 UI 가이드

**URL**: http://localhost:3000/metadata-management (4번째 탭)  
**목적**: Unknown 카테고리 로그 분석 및 분기별 검토  
**작성일**: 2025-10-13

---

## 🎯 개요

메타데이터 관리 페이지에 **카테고리 모니터링 탭**이 추가되었습니다.  
실시간으로 unknown 카테고리를 추적하고, 분기별 검토를 통해 새로운 카테고리를 추가할 수 있습니다.

---

## 📦 설치

### 1. DB 설정 (필수)
```bash
# 기본 카테고리 시스템
psql -f database/create_part_categories_table.sql
psql -f database/fix_part_category_constraint.sql
psql -f database/migrate_part_categories.sql

# 모니터링 시스템
psql -f database/create_category_monitoring.sql
```

### 2. 코드 배포
```bash
# 프론트엔드 빌드
npm run build

# 또는 개발 서버
npm run dev
```

---

## 🖥️ UI 구조

### 메인 탭 (4개)
```
메타데이터 관리 페이지
├── 📝 AI 메타데이터
├── 🧠 CLIP 임베딩
├── 🔧 프롬프트 설정
└── 📊 카테고리 모니터링  ← 신규 추가!
```

### 카테고리 모니터링 탭 (4개 서브탭)
```
📊 카테고리 모니터링
├── 📊 요약
│   └── Unknown 카테고리 10회 이상 검출된 항목 요약
├── 📋 상세
│   └── 부품별 unknown 검출 상세 정보
├── 📈 분기 리포트
│   └── 3개월 기준 검토 리포트 (HIGH/MEDIUM/LOW)
└── 🏷️ 등록된 카테고리
    └── 현재 등록된 30개 카테고리 목록
```

---

## 📊 기능 설명

### 1. 통계 대시보드 (상단)

4개의 통계 카드가 표시됩니다:

| 카드 | 설명 |
|------|------|
| 🔍 Unknown 형태 | 매핑되지 않은 shape_tag 종류 수 |
| 📦 Unknown 부품 | Unknown으로 분류된 부품 개수 |
| 🎯 총 검출 횟수 | Unknown 부품이 검출된 총 횟수 |
| 📅 HIGH Priority | 100회 이상 검출된 카테고리 수 |

### 2. 요약 탭 (📊)

**기능:**
- Unknown 카테고리 요약 조회 (10회 이상)
- Priority 뱃지 표시 (🔴 HIGH / 🟡 MEDIUM / 🟢 LOW)
- 첫 발견일 / 최근 발견일
- 샘플 부품명

**Priority 기준:**
- 🔴 HIGH: 100회 이상 → 즉시 카테고리 추가 권장
- 🟡 MEDIUM: 50-99회 → 다음 분기 검토
- 🟢 LOW: 10-49회 → 모니터링 계속

**예시:**
```
Shape Tag        | 부품 수 | 총 검출 | Priority
─────────────────┼─────────┼─────────┼──────────
connector        | 15      | 245     | 🔴 245
hinge_plate      | 8       | 87      | 🟡 87
bracket          | 5       | 23      | 🟢 23
```

### 3. 상세 탭 (📋)

**기능:**
- 부품별 unknown 검출 상세 정보
- Part ID, 부품명, Shape Tag, 검출 횟수
- 상위 50개만 표시 (성능 최적화)

**사용 사례:**
- 특정 부품이 왜 unknown인지 확인
- 부품명 패턴 분석

### 4. 분기 리포트 탭 (📈)

**기능:**
- 최근 3개월 기준 검토 리포트 생성
- 최소 검출 횟수 필터링 (기본 10회)
- HIGH/MEDIUM/LOW priority 분류
- 권장 사항 표시
- SQL 템플릿 자동 생성

**워크플로우:**
```
1. [리포트 생성] 버튼 클릭
   ↓
2. 결과 확인 (priority별 분류)
   ↓
3. HIGH priority 항목 검토
   ↓
4. SQL 템플릿 복사
   ↓
5. psql에서 실행
   ↓
6. 코드 업데이트 (getHardcodedCategoryMapping)
   ↓
7. 배포
```

**자동 생성 SQL:**
```sql
-- 카테고리 추가 템플릿
INSERT INTO part_categories (id, code, display_name, display_name_ko, category_type, sort_order)
VALUES (30, 'new_category', 'New Category', '신규 카테고리', 'shape', 30);

-- 기존 부품 마이그레이션
UPDATE parts_master_features
SET part_category = 30, shape_tag = 'new_category'
WHERE shape_tag = 'unknown' AND LOWER(part_name) LIKE '%new_category%';

-- 로그 정리
SELECT cleanup_resolved_category_logs('new_category');
```

### 5. 등록된 카테고리 탭 (🏷️)

**기능:**
- 현재 등록된 모든 카테고리 조회
- ID, Code, 표시명, 한글명, 타입
- 부품 수 (해당 카테고리로 분류된 부품 개수)
- 활성/비활성 상태

**예시:**
```
ID | Code         | 표시명        | 한글명 | 타입  | 부품 수 | 상태
───┼──────────────┼──────────────┼────────┼───────┼─────────┼──────
1  | plate        | Plate        | 플레이트 | shape | 1,234   | 활성
2  | brick        | Brick        | 브릭   | shape | 2,567   | 활성
21 | animal_figure| Animal Figure| 동물   | shape | 45      | 활성
```

---

## 🔄 일상 운영

### 자동 모니터링
1. 시스템이 자동으로 unknown 카테고리 로그 수집
2. 콘솔 로그: `[UNKNOWN_CATEGORY] {...}`
3. DB 저장: `unknown_category_logs` 테이블

### 주기적 확인
```bash
# 매주 월요일
1. 메타데이터 관리 페이지 접속
2. 카테고리 모니터링 탭 클릭
3. 요약 탭에서 트렌드 확인
```

---

## 📈 분기별 검토 (3개월마다)

### Step 1: 리포트 생성
```
1. [📈 분기 리포트] 탭 클릭
2. [리포트 생성] 버튼 클릭
3. 결과 확인
```

### Step 2: HIGH Priority 검토
```
리포트에서 🔴 HIGH priority 항목 확인
예: connector (245회 검출)
```

### Step 3: 카테고리 추가 결정
```
질문 체크리스트:
- 실제로 자주 사용되는 부품인가?
- 기존 카테고리로 분류 불가능한가?
- 향후에도 계속 사용될 것인가?

→ YES: 카테고리 추가
→ NO: 다음 분기 재검토
```

### Step 4: SQL 실행
```sql
-- UI에서 자동 생성된 템플릿 사용
-- 값만 수정하여 실행

-- 1. 다음 ID 확인
SELECT MAX(id) + 1 FROM part_categories WHERE id < 99;
-- 결과: 30

-- 2. 카테고리 추가
INSERT INTO part_categories (id, code, display_name, display_name_ko, category_type, sort_order)
VALUES (30, 'connector', 'Connector', '커넥터', 'shape', 30);

-- 3. 기존 부품 마이그레이션
UPDATE parts_master_features
SET part_category = 30, shape_tag = 'connector'
WHERE shape_tag = 'unknown' 
  AND LOWER(part_name) LIKE '%connector%';

-- 4. 로그 정리
SELECT cleanup_resolved_category_logs('connector');
```

### Step 5: 코드 업데이트
```javascript
// src/composables/useMasterPartsPreprocessing.js
function getHardcodedCategoryMapping() {
  return {
    // ... 기존 코드 ...
    'connector': 30,  // ✅ 추가
    'unknown': 99
  };
}
```

### Step 6: 배포
```bash
npm run build
# 또는 서비스 재시작
```

### Step 7: 검증
```
1. UI에서 [새로고침] 클릭
2. [등록된 카테고리] 탭에서 확인
3. [요약] 탭에서 connector가 사라졌는지 확인
```

---

## 🎨 UI 스크린샷 설명

### 통계 대시보드
```
┌───────────────────────────────────────────────────────┐
│  🔍 Unknown 형태    📦 Unknown 부품    🎯 총 검출    │
│      3               45              287            │
│                                                       │
│  📅 HIGH Priority                                     │
│      2                                                │
└───────────────────────────────────────────────────────┘
```

### 요약 탭 테이블
```
┌────────────┬────────┬────────┬─────────────────┐
│ Shape Tag  │ 부품 수│ 총 검출│ Priority       │
├────────────┼────────┼────────┼─────────────────┤
│ connector  │  15    │ 🔴 245 │ 첫: 2025-07-01 │
│ hinge_plate│   8    │ 🟡  87 │ 최근: 2025-10-10│
│ bracket    │   5    │ 🟢  23 │                 │
└────────────┴────────┴────────┴─────────────────┘
```

---

## 🔧 문제 해결

### 데이터가 안 보임
```bash
# 1. 뷰 존재 확인
psql -c "\dv v_unknown_categories_summary"

# 2. 데이터 확인
psql -c "SELECT COUNT(*) FROM unknown_category_logs;"

# 3. RPC 함수 확인
psql -c "\df log_unknown_category"
```

### 리포트 생성 실패
```bash
# RPC 함수 확인
psql -c "\df generate_category_review_report"

# 수동 실행
psql -c "SELECT * FROM generate_category_review_report(10, NOW() - INTERVAL '3 months');"
```

### 새로고침 안됨
```javascript
// 브라우저 콘솔에서 확인
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓' : '✗')
```

---

## 📋 체크리스트

### 설치 시
- [ ] create_part_categories_table.sql 실행
- [ ] fix_part_category_constraint.sql 실행
- [ ] migrate_part_categories.sql 실행
- [ ] create_category_monitoring.sql 실행
- [ ] npm run build 실행
- [ ] 브라우저에서 접속 확인

### 분기별 검토
- [ ] 리포트 생성
- [ ] HIGH priority 검토
- [ ] 카테고리 추가 결정
- [ ] SQL 실행
- [ ] 코드 업데이트
- [ ] 배포
- [ ] 검증

---

## 🎯 효과

### 가시성
- ✅ Unknown 카테고리 실시간 모니터링
- ✅ 트렌드 파악 용이
- ✅ Priority 자동 분류

### 효율성
- ✅ 분기별 검토 30분 → 10분
- ✅ SQL 자동 생성
- ✅ 검증 단계 간소화

### 품질
- ✅ 데이터 기반 의사결정
- ✅ 체계적인 카테고리 관리
- ✅ 운영 가시성 향상

---

## 🚀 다음 단계

1. **즉시**: 메타데이터 관리 페이지 접속 및 확인
2. **주간**: 요약 탭에서 트렌드 모니터링
3. **분기**: 리포트 생성 및 카테고리 추가 검토

---

**완벽한 카테고리 관리 시스템 구축 완료!** 🎉


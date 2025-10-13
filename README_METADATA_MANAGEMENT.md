# 🤖 AI 메타데이터 관리 시스템

## 📋 개요

BrickBox 시스템에 AI 메타데이터 및 CLIP 임베딩을 간편하게 관리할 수 있는 웹 UI를 추가했습니다.

---

## 🎯 주요 기능

### 1️⃣ AI 메타데이터 관리
- ✅ 상태별 조회 (완료/오류/없음)
- 📊 실시간 통계 및 진행률
- 🔍 검색 및 필터링
- 🔄 수동 생성/재시도
- 📝 메타데이터 상세 보기

### 2️⃣ CLIP 임베딩 관리
- ✅ 상태별 조회 (완료/대기/실패/없음)
- 📊 실시간 통계 및 진행률
- 🟢 워커 상태 모니터링
- 🔄 수동 생성/재시도
- 🧠 768차원 임베딩 확인

---

## 🗂️ 파일 구조

### Backend (Database)
```
database/
├── create_metadata_management_views.sql  # 뷰 및 RPC 함수
└── README_EMBEDDING_768.md               # 768차원 전환 가이드
```

**생성된 뷰:**
- `v_metadata_status` - AI 메타데이터 상태 조회
- `v_embedding_status` - CLIP 임베딩 상태 조회

**생성된 RPC 함수:**
- `get_metadata_stats()` - 메타데이터 통계
- `get_embedding_stats()` - 임베딩 통계
- `request_metadata_generation(ids)` - 메타데이터 수동 생성 요청
- `request_embedding_generation(ids)` - 임베딩 수동 생성 요청
- `retry_failed_embeddings()` - 실패 항목 일괄 재시도
- `request_missing_embeddings()` - 미생성 항목 일괄 생성

### Frontend (Vue)
```
src/
├── views/
│   └── MetadataManagement.vue        # 메인 뷰
├── components/
│   ├── MetadataTab.vue               # AI 메타데이터 탭
│   └── EmbeddingTab.vue              # CLIP 임베딩 탭
├── main.js                           # 라우터 등록
└── App.vue                           # 네비게이션 추가
```

---

## 🚀 설치 및 실행

### 1단계: DB 설정
```bash
# Supabase SQL Editor에서 실행
database/create_metadata_management_views.sql
```

### 2단계: Frontend 빌드
```bash
# 의존성 설치 (이미 설치되어 있으면 생략)
npm install

# 개발 서버 실행
npm run dev
```

### 3단계: 접속
```
http://localhost:5173/metadata-management
```

---

## 📱 사용 방법

### AI 메타데이터 탭

1. **상태 확인**
   - 통계 카드에서 완료/오류/없음 개수 확인
   - 진행률 확인

2. **필터링**
   - 상태별 필터 버튼 클릭
   - 검색창에 Part ID 입력

3. **개별 생성**
   - 체크박스 선택 후 "선택 항목 생성" 클릭
   - 또는 행별 🔄 버튼 클릭

4. **일괄 생성**
   - "오류 전체 재시도" - 오류 항목만 재시도
   - "없음 전체 생성" - 미생성 항목 일괄 생성

5. **상세 보기**
   - 완료된 항목의 👁️ 버튼 클릭
   - Feature Text, Recognition Hints, Feature JSON 확인

### CLIP 임베딩 탭

1. **상태 확인**
   - 통계 카드에서 완료/대기/실패 개수 확인
   - 워커 상태 확인 (🟢 실행중 / 🔴 중지됨)
   - 768차원 모델 확인

2. **필터링**
   - 상태별 필터 버튼 클릭
   - 검색창에 Part ID 입력

3. **개별 생성**
   - 체크박스 선택 후 "선택 항목 생성" 클릭
   - 또는 행별 🔄 버튼 클릭

4. **일괄 생성**
   - "실패 전체 재시도" - 실패 항목 자동 재시도
   - "없음 전체 생성" - 미생성 항목 일괄 생성

5. **상세 보기**
   - 완료된 항목의 👁️ 버튼 클릭
   - 임베딩 벡터 미리보기 (처음 20개)
   - 차원 확인 (768)
   - 제로 벡터 여부 확인

6. **새로고침**
   - 🔄 새로고침 버튼으로 수동 갱신
   - 30초마다 자동 갱신

---

## 🔄 워크플로우

### 신규 부품 등록 시

```
1. 신규 레고 등록 화면
   ↓ 부품 정보 입력 및 저장
   
2. parts_master_features 테이블에 INSERT
   ↓ feature_text가 있으면 트리거 자동 실행
   
3. embedding_status = 'pending' 자동 설정
   ↓ 백그라운드 워커가 감지
   
4. 워커가 CLIP 임베딩 생성 (768차원)
   ↓ 완료 후 DB 업데이트
   
5. embedding_status = 'completed' 
   ✅ 완료!
```

### 메타데이터 수동 생성 시

```
1. 메타데이터 관리 화면
   ↓ AI 메타데이터 탭
   
2. 상태 필터 = "없음" 선택
   ↓ 생성할 항목 체크
   
3. "선택 항목 생성" 클릭
   ↓ RPC 함수 호출
   
4. meta_source = 'manual_request' 설정
   ↓ AI 메타 생성 워커가 처리
   
5. feature_text 생성 완료
   ✅ 완료!
```

### 임베딩 수동 생성 시

```
1. 메타데이터 관리 화면
   ↓ CLIP 임베딩 탭
   
2. 상태 필터 = "없음" 또는 "실패" 선택
   ↓ 생성할 항목 체크
   
3. "선택 항목 생성" 클릭
   ↓ RPC 함수 호출
   
4. embedding_status = 'pending' 설정
   ↓ 백그라운드 워커가 감지
   
5. ViT-L/14 모델로 768차원 임베딩 생성
   ↓ DB 업데이트
   
6. embedding_status = 'completed'
   ✅ 완료!
```

---

## 📊 데이터 흐름

```
┌─────────────────────────┐
│   신규 레고 등록         │
│ (NewLegoRegistration)   │
└───────────┬─────────────┘
            │
            ↓ INSERT
┌─────────────────────────┐
│ parts_master_features   │
│ (Database Table)        │
└───┬──────────────┬──────┘
    │              │
    │              ↓ Trigger
    │   ┌─────────────────┐
    │   │ embedding_status│
    │   │   = 'pending'   │
    │   └────────┬────────┘
    │            │
    │            ↓
    │   ┌─────────────────┐
    │   │  Embedding      │
    │   │  Worker         │
    │   │  (Background)   │
    │   └────────┬────────┘
    │            │
    │            ↓ Generate
    │   ┌─────────────────┐
    │   │  clip_text_emb  │
    │   │  (768-dim)      │
    │   └─────────────────┘
    │
    ↓ Query
┌─────────────────────────┐
│  메타데이터 관리         │
│ (MetadataManagement)    │
│                         │
│ ├─ AI 메타데이터 탭     │
│ └─ CLIP 임베딩 탭       │
└─────────────────────────┘
```

---

## 🎨 UI 스크린샷 설명

### AI 메타데이터 탭
```
┌─────────────────────────────────────┐
│ 📊 통계                              │
│ ✅ 완료: 18,234                      │
│ ⚠️ 오류: 124                         │
│ ❌ 없음: 1,642                       │
│ 📊 진행률: 91%                       │
├─────────────────────────────────────┤
│ 🔍 [검색] [전체] [완료] [오류] [없음] │
├─────────────────────────────────────┤
│ ☑ | ID | Part | Color | Text | 상태  │
│ ...테이블 데이터...                   │
├─────────────────────────────────────┤
│ [선택 항목 생성] [오류 재시도]        │
└─────────────────────────────────────┘
```

### CLIP 임베딩 탭
```
┌─────────────────────────────────────┐
│ 📊 통계 (768차원)                    │
│ ✅ 완료: 12,450                      │
│ 🔄 대기: 6,890                       │
│ ❌ 실패: 23                          │
│ 📊 진행률: 64%                       │
├─────────────────────────────────────┤
│ 워커: 🟢 실행중 | 차원: 768          │
├─────────────────────────────────────┤
│ 🔍 [검색] [전체] [완료] [대기] [실패] │
├─────────────────────────────────────┤
│ ☑ | ID | Part | Color | Text | 상태  │
│ ...테이블 데이터...                   │
├─────────────────────────────────────┤
│ [선택 항목 생성] [실패 재시도] [🔄]   │
└─────────────────────────────────────┘
```

---

## 🔧 트러블슈팅

### 1. 데이터가 로드되지 않음
- Supabase SQL Editor에서 `create_metadata_management_views.sql` 실행 확인
- 브라우저 콘솔(F12)에서 에러 확인
- RPC 함수 권한 확인

### 2. 워커가 실행되지 않음
```bash
# 워커 상태 확인
ps aux | grep embedding_worker

# 워커 실행
$env:SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_KEY = "your-service-role-key"
$env:PYTHONIOENCODING = "utf-8"

python scripts\embedding_worker.py
```

### 3. 임베딩 생성 실패
- `feature_text`가 존재하는지 확인
- 워커 로그 확인
- CLIP 모델 다운로드 확인 (ViT-L/14, 약 890MB)

### 4. 768차원이 아닌 512차원으로 생성됨
- `scripts/embedding_worker.py` 확인
- `clip.load("ViT-L/14")` 사용 확인
- DB에서 차원 확인: `array_length(clip_text_emb::real[], 1)`

---

## 📈 성능 최적화

### 페이지네이션
- 기본 10개씩 표시
- 대량 데이터 처리 시 성능 유지

### 자동 새로고침
- 30초마다 자동 갱신 (임베딩 탭)
- 수동 새로고침 버튼 제공

### 배치 처리
- 워커는 10개씩 배치 처리
- DB 부하 최소화

---

## 🎯 향후 개선 사항

- [ ] WebSocket으로 실시간 진행률 표시
- [ ] 워커 시작/중지 버튼 (UI에서 직접 제어)
- [ ] 임베딩 품질 점수 표시
- [ ] 엑셀 export 기능
- [ ] 일괄 편집 기능

---

## 📚 관련 문서

- [메타데이터 기술 문서](database/메타데이터.txt)
- [768차원 전환 가이드](database/README_EMBEDDING_768.md)
- [임베딩 자동화 가이드](database/README_EMBEDDING_AUTOMATION.md)
- [메타데이터 개선 실행계획](메타데이터_개선_실행계획.md)

---

**✅ 구현 완료!** 이제 웹 UI에서 AI 메타데이터와 CLIP 임베딩을 편리하게 관리할 수 있습니다! 🎉


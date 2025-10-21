# BrickBox AI System

## 📋 프로젝트 개요

BrickBox는 LEGO 부품 인식을 위한 AI 시스템입니다.

## 🚫 정책 문서

### 1. **NO_MOCK_DATA_POLICY.md**
- 목업/더미 데이터 사용 금지
- 실제 데이터만 사용

### 2. **NO_EMOJI_POLICY.md** 
- 이모지 사용 금지
- ASCII 태그 사용 권장

## 🔧 개발 가이드라인

### 이모지 사용 금지
```python
# ❌ 금지
print("✅ 성공!")
print("❌ 실패!")

# ✅ 허용
print("[OK] 성공!")
print("[ERROR] 실패!")
```

### ASCII 태그 시스템
| 목적 | 이모지 (금지) | ASCII 태그 (허용) |
|------|---------------|------------------|
| 성공 | ✅ | `[OK]` |
| 실패 | ❌ | `[ERROR]` |
| 경고 | ⚠️ | `[WARNING]` |
| 정보 | ℹ️ | `[INFO]` |
| 검색 | 🔍 | `[CHECK]` |
| 업로드 | 📤 | `[UPLOAD]` |
| 수정 | 🔧 | `[FIX]` |
| 패키지 | 📦 | `[BUCKET]` |
| 연결 | 🔌 | `[CONNECT]` |
| 대기 | ⏳ | `[WAIT]` |
| 시작 | 🚀 | `[START]` |

## 🛠️ 도구

### 이모지 검사
```bash
# 이모지 사용 검사
python scripts/check_emojis_simple.py

# 이모지 제거 (자동)
python remove_emojis.py
```

## 📁 프로젝트 구조

```
brickbox/
├── scripts/                    # 스크립트 파일
│   ├── render_ldraw_to_supabase.py
│   ├── check_emojis_simple.py
│   └── ...
├── database/                   # 데이터베이스 스키마
├── output/                     # 출력 파일
├── NO_MOCK_DATA_POLICY.md      # 목업 데이터 금지 정책
├── NO_EMOJI_POLICY.md          # 이모지 사용 금지 정책
└── README.md
```

## 🚀 시작하기

1. 환경 설정
2. 의존성 설치
3. 정책 문서 숙지
4. 개발 시작

## 📞 지원

정책 관련 문의는 개발팀에 연락하세요.
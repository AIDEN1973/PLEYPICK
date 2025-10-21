# 🚫 이모지 사용 금지 규정

## 📋 정책 개요

**BrickBox 시스템에서는 모든 이모지 사용을 엄격히 금지합니다.**

## ❌ 금지된 이모지 유형

### 1. **유니코드 이모지**
```python
# ❌ 금지
print("✅ 성공!")
print("❌ 실패!")
print("⚠️ 경고")
print("🔍 검색 중...")
print("📦 패키지")
print("🚀 시작")

# ✅ 허용
print("[OK] 성공!")
print("[ERROR] 실패!")
print("[WARNING] 경고")
print("[CHECK] 검색 중...")
print("[BUCKET] 패키지")
print("[START] 시작")
```

### 2. **Blender 환경 호환성**
```python
# ❌ 금지 - Blender Python 콘솔에서 인코딩 오류 발생
print("🔧 수정 중...")
print("📤 업로드 중...")
print("🔌 연결 중...")

# ✅ 허용 - ASCII 안전
print("[FIX] 수정 중...")
print("[UPLOAD] 업로드 중...")
print("[CONNECT] 연결 중...")
```

### 3. **터미널 출력 호환성**
```bash
# ❌ 금지 - Windows PowerShell에서 인코딩 오류
echo "✅ 완료"
echo "❌ 오류"

# ✅ 허용 - ASCII 안전
echo "[OK] 완료"
echo "[ERROR] 오류"
```

## ✅ 허용된 대체 표기법

### 1. **ASCII 태그 시스템**
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

### 2. **상태 표시 시스템**
```python
# ✅ 권장 패턴
print(f"[OK] 작업 완료: {result}")
print(f"[ERROR] 작업 실패: {error}")
print(f"[WARNING] 주의사항: {warning}")
print(f"[INFO] 정보: {info}")
print(f"[CHECK] 검증 중: {item}")
print(f"[UPLOAD] 업로드 중: {file}")
print(f"[FIX] 수정 중: {issue}")
print(f"[BUCKET] 버킷 작업: {bucket}")
print(f"[CONNECT] 연결 중: {service}")
print(f"[WAIT] 대기 중: {duration}초")
print(f"[START] 시작: {process}")
```

## 🎯 적용 범위

### 1. **코드 파일**
- Python 스크립트
- JavaScript/TypeScript
- Shell 스크립트
- 배치 파일

### 2. **출력 메시지**
- 콘솔 로그
- 에러 메시지
- 상태 표시
- 진행 상황

### 3. **문서**
- README.md
- 기술 문서
- 주석
- 설명서

## 🔧 구현 가이드라인

### 1. **기존 이모지 제거**
```python
# 이모지 제거 스크립트 예시
replacements = [
    ('🔍', '[CHECK]'),
    ('✅', '[OK]'),
    ('❌', '[ERROR]'),
    ('⚠️', '[WARNING]'),
    ('💡', '[INFO]'),
    ('📤', '[UPLOAD]'),
    ('🔧', '[FIX]'),
    ('📦', '[BUCKET]'),
    ('🔌', '[CONNECT]'),
    ('⏳', '[WAIT]'),
    ('🚀', '[START]')
]
```

### 2. **일관성 유지**
- 모든 파일에서 동일한 태그 사용
- 팀 전체가 동일한 표기법 준수
- 코드 리뷰에서 이모지 사용 금지 확인

### 3. **자동화 도구**
```python
# 이모지 검사 스크립트
import re

def check_emojis(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    emoji_pattern = r'[🔍✅❌⚠️💡📤🔧📦🔌⏳🚀]'
    matches = re.findall(emoji_pattern, content)
    
    if matches:
        print(f"❌ 이모지 발견: {file_path}")
        print(f"   발견된 이모지: {matches}")
        return False
    else:
        print(f"✅ 이모지 없음: {file_path}")
        return True
```

## 📊 이점

### 1. **호환성 향상**
- Blender Python 환경 호환
- Windows PowerShell 호환
- 다양한 터미널 환경 지원

### 2. **안정성 증대**
- 인코딩 오류 방지
- 크로스 플랫폼 호환성
- 국제화 지원

### 3. **유지보수성**
- 일관된 표기법
- 명확한 의미 전달
- 자동화 도구 활용 가능

## 🚨 위반 시 조치

### 1. **코드 리뷰 단계**
- 이모지 사용 발견 시 즉시 수정 요청
- ASCII 태그로 교체 후 재제출

### 2. **자동화 검사**
- CI/CD 파이프라인에서 이모지 검사
- 위반 시 빌드 실패 처리

### 3. **팀 교육**
- 정책 숙지 및 준수 교육
- 정기적인 코드 리뷰를 통한 확인

## 📝 예외 사항

### 1. **마케팅 자료**
- 웹사이트, 브로셔 등 마케팅 목적의 문서
- 사용자 인터페이스 디자인

### 2. **외부 라이브러리**
- 서드파티 라이브러리의 이모지 사용
- 수정 불가능한 외부 코드

## 🔄 정책 업데이트

이 정책은 프로젝트 요구사항에 따라 업데이트될 수 있습니다.
모든 팀원은 최신 정책을 숙지하고 준수해야 합니다.

---

**정책 수립일**: 2025-01-20  
**적용 범위**: BrickBox 전체 프로젝트  
**검토 주기**: 분기별  
**책임자**: 개발팀 리드

## 🔗 관련 문서

- [NO_MOCK_DATA_POLICY.md](./NO_MOCK_DATA_POLICY.md) - 목업 데이터 금지 정책
- [README.md](./README.md) - 프로젝트 개요 및 가이드라인

## 🛠️ 자동화 도구

### 이모지 검사 스크립트
```bash
# 간단한 이모지 검사
python scripts/check_emojis_simple.py

# 이모지 제거 (자동)
python remove_emojis.py
```

### CI/CD 통합
- GitHub Actions에서 자동 이모지 검사
- 위반 시 빌드 실패 처리
- Pull Request에서 자동 검증

## 📊 정책 준수 현황

- ✅ **현재 상태**: 이모지 사용 위반 없음
- ✅ **자동화**: CI/CD 파이프라인 통합 완료
- ✅ **도구**: 검사 및 제거 스크립트 준비
- ✅ **문서화**: 정책 문서 및 가이드라인 완성

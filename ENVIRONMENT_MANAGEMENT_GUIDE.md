# BrickBox 환경변수 관리 시스템 가이드

## 개요

BrickBox 프로젝트의 환경변수를 중앙집중식으로 관리하는 시스템입니다. 기존의 `.env` 파일 의존성을 제거하고 더 유연하고 강력한 환경변수 관리 기능을 제공합니다.

## 주요 기능

- **중앙집중식 관리**: 모든 환경변수를 하나의 시스템에서 관리
- **다중 형식 지원**: JSON, YAML, ENV 형식으로 설정 저장/로드
- **유효성 검사**: 설정값의 유효성 자동 검사
- **대화형 설정**: 명령행에서 대화형으로 설정 가능
- **GUI 도구**: tkinter 기반 그래픽 환경변수 관리 도구
- **자동 폴백**: 통합 시스템 사용 불가시 기존 방식으로 자동 폴백

## 파일 구조

```
scripts/
├── env_manager.py          # 핵심 환경변수 관리자
├── env_integration.py      # 통합 환경변수 모듈
├── env_gui.py             # GUI 환경변수 관리 도구
└── update_rebrickable_key.py  # API 키 업데이트 도구

config.json                # JSON 형식 설정 파일
config.yaml               # YAML 형식 설정 파일 (선택사항)
.env                      # 기존 ENV 형식 파일 (호환성)
```

## 사용법

### 1. 명령행 도구

#### 설정 표시
```bash
python scripts/env_manager.py show
```

#### 설정 유효성 검사
```bash
python scripts/env_manager.py validate
```

#### 대화형 설정
```bash
python scripts/env_manager.py setup
```

#### 설정 저장
```bash
# JSON 형식으로 저장
python scripts/env_manager.py save json

# YAML 형식으로 저장
python scripts/env_manager.py save yaml

# ENV 형식으로 저장
python scripts/env_manager.py save env
```

#### 환경변수 적용
```bash
python scripts/env_manager.py apply
```

### 2. GUI 도구

```bash
python scripts/env_gui.py
```

GUI 도구를 통해 다음 기능을 사용할 수 있습니다:
- 환경변수 시각적 편집
- 실시간 유효성 검사
- 설정 저장/로드
- 환경변수 적용

### 3. 프로그래밍 방식

#### 기본 사용법
```python
from scripts.env_manager import env_manager, get_env, set_env

# 설정값 가져오기
url = get_env('supabase_url')
api_key = get_env('openai_api_key')

# 설정값 설정하기
set_env('custom_setting', 'value')

# 설정 저장
env_manager.save_config('json')
```

#### 통합 모듈 사용
```python
from scripts.env_integration import (
    get_supabase_config, 
    get_api_keys, 
    get_port_config,
    apply_environment
)

# 환경변수 적용
apply_environment()

# Supabase 설정 가져오기
supabase_config = get_supabase_config()
url = supabase_config['url']
key = supabase_config['service_role']

# API 키 가져오기
api_keys = get_api_keys()
openai_key = api_keys['openai']
rebrickable_key = api_keys['rebrickable']

# 포트 설정 가져오기
ports = get_port_config()
vite_port = ports['vite']
training_port = ports['training_api']
```

## 설정 우선순위

1. **환경변수** (최우선)
2. **config.json**
3. **.env 파일**
4. **config.yaml** (선택사항)

## 지원하는 환경변수

### Supabase 설정
- `supabase_url`: Supabase 프로젝트 URL
- `supabase_anon_key`: Supabase 익명 키
- `supabase_service_role`: Supabase 서비스 롤 키

### API 키
- `openai_api_key`: OpenAI API 키
- `rebrickable_api_key`: Rebrickable API 키

### 포트 설정
- `vite_port`: Vite 개발 서버 포트 (기본: 3000)
- `training_api_port`: 훈련 API 포트 (기본: 3010)
- `synthetic_api_port`: 합성 데이터 API 포트 (기본: 3011)
- `worker_port`: 워커 포트 (기본: 3020)
- `clip_service_port`: CLIP 서비스 포트 (기본: 3021)
- `semantic_vector_api_port`: 시맨틱 벡터 API 포트 (기본: 3022)
- `manual_upload_port`: 수동 업로드 포트 (기본: 3030)
- `monitoring_port`: 모니터링 포트 (기본: 3040)
- `preview_port`: 미리보기 포트 (기본: 4173)

### 서비스 URL
- `clip_service_url`: CLIP 서비스 URL
- `semantic_vector_api_url`: 시맨틱 벡터 API URL
- `vite_api_base`: Vite API 기본 URL
- `vite_synthetic_api_base`: Vite 합성 데이터 API 기본 URL
- `vite_webp_image_api_base`: Vite WebP 이미지 API 기본 URL

## 기존 시스템과의 호환성

기존 코드는 수정 없이 계속 작동합니다. 환경변수 관리 시스템은 다음과 같이 작동합니다:

1. **통합 시스템 사용 가능시**: 새로운 중앙집중식 관리 사용
2. **통합 시스템 사용 불가시**: 기존 `.env` 파일 방식으로 자동 폴백

## 마이그레이션 가이드

### 기존 .env 파일에서 마이그레이션

1. **현재 설정 백업**
   ```bash
   cp .env .env.backup
   ```

2. **통합 시스템으로 설정 로드**
   ```bash
   python scripts/env_manager.py show
   ```

3. **JSON 형식으로 저장**
   ```bash
   python scripts/env_manager.py save json
   ```

4. **유효성 검사**
   ```bash
   python scripts/env_manager.py validate
   ```

### 새로운 프로젝트 설정

1. **대화형 설정 실행**
   ```bash
   python scripts/env_manager.py setup
   ```

2. **GUI 도구 사용**
   ```bash
   python scripts/env_gui.py
   ```

## 문제 해결

### 환경변수 관리자 사용 불가
```bash
# 의존성 설치
pip install python-dotenv pyyaml

# 또는 프로젝트 루트에서
pip install -r requirements.txt
```

### 설정 유효성 검사 실패
```bash
# 오류 확인
python scripts/env_manager.py validate

# 설정 초기화
python scripts/env_manager.py setup
```

### GUI 도구 실행 불가
```bash
# tkinter 설치 확인
python -c "import tkinter"

# 또는 GUI 없이 명령행 사용
python scripts/env_manager.py setup
```

## 고급 사용법

### 사용자 정의 설정 추가
```python
from scripts.env_manager import env_manager

# 사용자 정의 설정 추가
env_manager.set('custom_database_url', 'postgresql://...')
env_manager.set('custom_api_timeout', 30)

# 설정 저장
env_manager.save_config('json')
```

### 환경별 설정 관리
```python
# 개발 환경
env_manager.set('node_env', 'development')
env_manager.set('debug_mode', True)

# 프로덕션 환경
env_manager.set('node_env', 'production')
env_manager.set('debug_mode', False)
```

### 설정 파일 백업/복원
```bash
# 백업
cp config.json config.json.backup

# 복원
cp config.json.backup config.json
```

## 보안 고려사항

- API 키는 암호화되지 않은 상태로 저장됩니다
- `config.json` 파일을 버전 관리에 포함하지 마세요
- 프로덕션 환경에서는 환경변수를 직접 설정하는 것을 권장합니다

## 지원 및 피드백

문제가 발생하거나 개선 사항이 있으면 이슈를 등록해주세요.

---

이 가이드를 통해 BrickBox 프로젝트의 환경변수를 효율적으로 관리할 수 있습니다.

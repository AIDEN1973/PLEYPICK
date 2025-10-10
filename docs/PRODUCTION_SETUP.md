# 🚀 BrickBox 프로덕션 환경 설정 가이드

## 📋 다른 PC에서 합성 데이터셋 생성하기

### 1️⃣ **필수 소프트웨어 설치**

#### **Blender 4.5+ 설치**
```bash
# Windows
1. https://www.blender.org/download/ 에서 Blender 4.5+ 다운로드
2. 기본 경로에 설치: C:/Program Files/Blender Foundation/Blender 4.5/
3. 환경 변수 설정 (선택사항)
```

#### **LDraw Parts Library 설치**
```bash
# Windows
1. https://www.ldraw.org/downloads-2/downloads.html 에서 LDraw 다운로드
2. C:/LDraw/ 경로에 설치
3. parts 폴더 구조 확인: C:/LDraw/parts/3001.dat
```

#### **Python 환경 설정**
```bash
# Python 3.8+ 필요 (Blender 내장 Python 사용)
# 추가 패키지 설치 (선택사항 - 자동 설치됨)
pip install supabase python-dotenv
```

#### **Node.js 환경 (웹 애플리케이션용)**
```bash
# Node.js 18+ 설치
# https://nodejs.org/ 에서 LTS 버전 다운로드

# 프로젝트 의존성 설치
npm install
```

#### **Git 설치 (소스 코드 다운로드용)**
```bash
# Git 설치
# https://git-scm.com/ 에서 다운로드
```

### 2️⃣ **환경 변수 설정**

#### **.env 파일 생성**
```bash
# 프로젝트 루트에 .env 파일 생성
VITE_SUPABASE_URL=https://npferbxuxocbfnfbpcnz.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_SUPABASE_SERVICE_ROLE=your_service_key_here

# Blender 경로 (기본값)
BLENDER_PATH=C:/Program Files/Blender Foundation/Blender 4.5/blender.exe
LDRAW_PATH=C:/LDraw/parts

# 추가 API 키 (선택사항)
VITE_OPENAI_API_KEY=your_openai_api_key_here
VITE_REBRICKABLE_API_KEY=your_rebrickable_api_key_here

# 로컬 추론 엔드포인트 (선택사항)
VITE_DETECTION_API_URL=http://127.0.0.1:7000/detect
VITE_CLIP_IMAGE_API_URL=http://127.0.0.1:7000/embed/image
VITE_COLOR_EXTRACT_API_URL=http://127.0.0.1:7000/extract/color
```

#### **config/synthetic_dataset.env 파일 생성**
```bash
# 합성 데이터셋 전용 설정 파일
LDRAW_LIBRARY_PATH=C:/LDraw
LDRAW_PARTS_PATH=C:/LDraw/parts
BLENDER_RENDER_ENGINE=cycles
BLENDER_USE_GPU=true
SYNTHETIC_OUTPUT_DIR=./output/synthetic
SYNTHETIC_IMAGE_FORMAT=WEBP
SYNTHETIC_ANNOTATION_FORMAT=YOLO
```

### 3️⃣ **프로젝트 설정**

#### **소스 코드 다운로드**
```bash
# Git으로 프로젝트 클론
git clone https://github.com/your-repo/brickbox.git
cd brickbox

# 또는 ZIP 파일 다운로드 후 압축 해제
```

#### **의존성 설치**
```bash
# Node.js 의존성 설치
npm install

# Python 의존성 설치 (선택사항 - 자동 설치됨)
pip install supabase python-dotenv
```

#### **웹 애플리케이션 실행**
```bash
# 개발 서버 실행
npm run dev

# 또는 프로덕션 빌드
npm run build
npm run preview
```

### 4️⃣ **프로덕션 모드 실행**

#### **단일 부품 렌더링**
```bash
# 기본 명령어
"C:/Program Files/Blender Foundation/Blender 4.5/blender.exe" \
  --background \
  --python scripts/render_ldraw_to_supabase.py \
  -- --part-id 3001 --count 100 --output-dir ./output --quality high
```

#### **배치 렌더링**
```bash
# 여러 부품 렌더링
python scripts/synthetic_dataset_pipeline.py \
  --part-list "3001,3002,3003" \
  --max-images 500 \
  --batch-size 10 \
  --output-dir "./output/synthetic"
```

#### **웹 인터페이스 사용**
```bash
# 웹 애플리케이션에서 합성 데이터셋 관리
# http://localhost:3001/synthetic-dataset
```

### 5️⃣ **경로 커스터마이징**

#### **다른 경로에 설치된 경우**
```bash
# .env 파일에서 경로 수정
BLENDER_PATH=D:/Blender/blender.exe
LDRAW_PATH=D:/LDraw/parts

# 또는 명령어에서 직접 지정
"D:/Blender/blender.exe" \
  --background \
  --python scripts/render_ldraw_to_supabase.py \
  -- --part-id 3001 --count 100
```

### 6️⃣ **추가 설정 (선택사항)**

#### **GPU 드라이버 업데이트**
```bash
# NVIDIA GPU 사용 시
# 최신 드라이버 설치 권장
# https://www.nvidia.com/drivers/

# AMD GPU 사용 시  
# 최신 드라이버 설치 권장
# https://www.amd.com/support
```

#### **Python 패키지 수동 설치**
```bash
# Blender Python 환경에 패키지 설치
"C:/Program Files/Blender Foundation/Blender 4.5/4.5/python/bin/python.exe" -m pip install supabase python-dotenv
```

#### **웹 서버 설정 (프로덕션 배포)**
```bash
# Express 서버 실행
npm run server

# 또는 PM2로 프로덕션 실행
npm install -g pm2
pm2 start server/synthetic-api.js --name "brickbox-api"
```

#### **포트 설정 및 충돌 방지**
```bash
# 기본 포트 설정
# - 웹 애플리케이션: 3000
# - 합성 데이터셋 API: 3004  
# - Blender API: 5003
# - 로컬 추론 서비스: 7000

# 포트 충돌 시 다른 포트 사용
# .env 파일에서 포트 변경
VITE_DEV_SERVER_PORT=3001
VITE_SYNTHETIC_API_PORT=3005
```

#### **Windows 특화 설정**
```bash
# Windows Defender 예외 추가
# - Blender 실행 파일
# - Python 스크립트
# - 출력 디렉토리

# PowerShell 실행 정책 설정
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 긴 경로 지원 활성화 (Windows 10+)
# 레지스트리 편집기에서 활성화
```

#### **배치 스크립트 실행**
```bash
# Windows 배치 파일 실행
scripts/generate_synthetic_dataset.bat

# Linux/Mac 셸 스크립트 실행
chmod +x scripts/generate_synthetic_dataset.sh
./scripts/generate_synthetic_dataset.sh
```

### 7️⃣ **문제 해결**

#### **Blender 경로 오류**
```bash
# 경로 확인
where blender
# 또는
"C:/Program Files/Blender Foundation/Blender 4.5/blender.exe" --version
```

#### **LDraw 경로 오류**
```bash
# LDraw 파일 확인
ls C:/LDraw/parts/3001.dat
```

#### **권한 오류**
```bash
# 관리자 권한으로 실행
# 또는 출력 디렉토리 권한 확인
```

#### **Python 패키지 오류**
```bash
# Blender Python 경로 확인
"C:/Program Files/Blender Foundation/Blender 4.5/4.5/python/bin/python.exe" --version

# 패키지 수동 설치
"C:/Program Files/Blender Foundation/Blender 4.5/4.5/python/bin/python.exe" -m pip install --user supabase python-dotenv
```

#### **Node.js 의존성 오류**
```bash
# Node.js 버전 확인
node --version

# 의존성 재설치
rm -rf node_modules package-lock.json
npm install
```

#### **포트 충돌 오류**
```bash
# 포트 사용 중인 프로세스 확인
netstat -ano | findstr :3000
netstat -ano | findstr :3004
netstat -ano | findstr :5003

# 프로세스 종료
taskkill /PID <PID번호> /F

# 또는 다른 포트 사용
npm run dev -- --port 3001
```

#### **Windows Defender 차단**
```bash
# Windows Defender 예외 추가
# 1. Windows 보안 > 바이러스 및 위협 방지
# 2. 설정 관리 > 제외 추가 또는 제거
# 3. 다음 폴더 추가:
#    - C:/Program Files/Blender Foundation/
#    - 프로젝트 루트 디렉토리
#    - 출력 디렉토리 (./output)
```

#### **긴 경로 오류 (Windows)**
```bash
# 긴 경로 지원 활성화
# 1. 레지스트리 편집기 실행 (regedit)
# 2. HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\FileSystem
# 3. LongPathsEnabled 값을 1로 설정
# 4. 재부팅
```

#### **PowerShell 실행 정책 오류**
```bash
# PowerShell 실행 정책 설정
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 또는 관리자 권한으로 실행
Start-Process powershell -Verb runAs
```

#### **메모리 부족 오류**
```bash
# 가상 메모리 설정 확인
# 1. 시스템 속성 > 고급 > 성능 설정
# 2. 고급 > 가상 메모리 > 변경
# 3. 사용자 지정 크기 설정 (최소 8GB 권장)
```

### 8️⃣ **성능 최적화**

#### **GPU 가속 설정**
- NVIDIA RTX 카드: OPTIX 자동 활성화
- AMD 카드: HIP 지원
- CPU 렌더링: 기본값

#### **메모리 최적화**
- 8GB+ RAM 권장
- SSD 저장소 권장
- 병렬 렌더링: CPU 코어 수에 따라 자동 조정

#### **네트워크 최적화**
- Supabase 연결 안정성 확인
- 방화벽 설정 확인
- 프록시 환경에서 포트 설정

#### **시스템 요구사항 확인**
```bash
# 최소 시스템 요구사항
# - RAM: 8GB+ (16GB 권장)
# - 저장소: 50GB+ 여유 공간
# - GPU: NVIDIA GTX 1060+ 또는 AMD RX 580+
# - CPU: Intel i5-8400+ 또는 AMD Ryzen 5 2600+

# 시스템 정보 확인
# Windows
systeminfo
# 또는
wmic cpu get name
wmic memorychip get capacity
wmic path win32_VideoController get name
```

### 9️⃣ **모니터링**

#### **렌더링 진행 상황**
```bash
# 로그 확인
tail -f output/render.log

# 파일 생성 확인
ls -la output/3001/
```

#### **성능 통계**
- 렌더링 속도: ~5초/이미지 (GPU)
- 메모리 사용량: ~357MB
- 저장소: 평균 50KB/이미지

#### **웹 애플리케이션 모니터링**
```bash
# 개발 서버 로그
npm run dev

# 프로덕션 서버 로그
npm run server
```

## 🎯 **요약**

다른 PC에서 합성 데이터셋을 생성하려면:

1. ✅ **Blender 4.5+ 설치**
2. ✅ **LDraw Parts Library 설치**  
3. ✅ **Node.js 18+ 설치**
4. ✅ **Git 설치**
5. ✅ **환경 변수 설정**
6. ✅ **프로젝트 의존성 설치**
7. ✅ **권한 확인**
8. ✅ **경로 설정**
9. ✅ **포트 충돌 방지**
10. ✅ **Windows Defender 예외 추가**
11. ✅ **시스템 요구사항 확인**

## 🚨 **중요 주의사항**

### **Windows 환경 특화 설정**
- Windows Defender 예외 추가 필수
- PowerShell 실행 정책 설정
- 긴 경로 지원 활성화
- 가상 메모리 8GB+ 설정

### **포트 관리**
- 웹 애플리케이션: 3000
- 합성 데이터셋 API: 3004
- Blender API: 5003
- 로컬 추론 서비스: 7000

### **성능 최적화**
- GPU 드라이버 최신 버전 유지
- SSD 저장소 사용 권장
- 16GB+ RAM 권장

이 모든 요구사항이 충족되면 어느 PC에서든 프로덕션 모드로 합성 데이터셋을 생성할 수 있습니다! 🚀

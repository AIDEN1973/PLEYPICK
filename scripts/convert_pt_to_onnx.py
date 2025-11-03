#!/usr/bin/env python3
"""
기존 .pt 모델을 .onnx로 변환하여 Supabase Storage에 업로드하는 스크립트
"""

import os
import sys
from pathlib import Path
from datetime import datetime

# 환경변수 관리 시스템 사용
try:
    from scripts.env_integration import get_supabase_config, apply_environment
    apply_environment()
    ENV_MANAGER_AVAILABLE = True
    print("[OK] 환경변수 관리 시스템 로드됨")
except ImportError:
    ENV_MANAGER_AVAILABLE = False
    # 폴백: .env 파일 로드
    try:
        from dotenv import load_dotenv
        env_path = Path(__file__).parent.parent / '.env'
        if env_path.exists():
            load_dotenv(env_path, override=True)
            print(f"[OK] .env 파일 로드됨: {env_path}")
    except ImportError:
        print("[WARN] python-dotenv가 설치되지 않음. pip install python-dotenv")
    except Exception as e:
        print(f"[WARN] .env 파일 로드 실패: {e}")

# Supabase 클라이언트
try:
    from supabase import create_client
except ImportError:
    print("[ERROR] Supabase 클라이언트가 설치되지 않았습니다.")
    print("다음 명령어로 설치하세요: pip install supabase")
    sys.exit(1)

# YOLO 관련 임포트
try:
    from ultralytics import YOLO
except ImportError:
    print("[ERROR] ultralytics가 설치되지 않았습니다.")
    print("다음 명령어로 설치하세요: pip install ultralytics")
    sys.exit(1)


def download_pt_model(supabase, model_name):
    """Supabase Storage에서 .pt 모델 다운로드"""
    try:
        print(f"[DOWNLOAD] {model_name}.pt 다운로드 중...")
        
        # Storage에서 파일 다운로드
        response = supabase.storage.from_('models').download(f"{model_name}.pt")
        
        # Supabase Python 클라이언트는 bytes를 반환
        if isinstance(response, bytes):
            model_data = response
        elif hasattr(response, 'content'):
            model_data = response.content
        elif hasattr(response, 'read'):
            model_data = response.read()
        else:
            print(f"[ERROR] 다운로드 응답 형식을 알 수 없습니다: {type(response)}")
            return None
        
        # 임시 디렉토리에 저장
        temp_dir = Path("public/models/temp")
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        pt_path = temp_dir / f"{model_name}.pt"
        with open(pt_path, 'wb') as f:
            f.write(model_data)
        
        print(f"[OK] 다운로드 완료: {pt_path} ({len(model_data)} bytes)")
        return pt_path
        
    except Exception as e:
        print(f"[ERROR] 다운로드 실패: {e}")
        import traceback
        traceback.print_exc()
        return None


def convert_to_onnx(pt_path, model_name, imgsz=640):
    """PyTorch 모델을 ONNX로 변환"""
    try:
        print(f"[CONVERT] {pt_path} → ONNX 변환 중...")
        
        # YOLO 모델 로드
        model = YOLO(str(pt_path))
        
        # ONNX 변환 목적 경로
        onnx_path = pt_path.parent / f"{model_name}.onnx"
        
        # 이미 존재하면 삭제
        if onnx_path.exists():
            onnx_path.unlink()
        
        # ONNX 변환 (목적 경로 지정)
        model.export(format='onnx', imgsz=imgsz)
        
        # model.export()는 원본 파일과 같은 디렉토리에 모델명.onnx로 저장하는 경우가 많음
        # 또는 현재 작업 디렉토리에 저장될 수 있음
        
        # 우선순위 1: 목적 경로에 이미 생성되었는지 확인
        if onnx_path.exists():
            print(f"[OK] ONNX 변환 완료: {onnx_path}")
            return onnx_path
        
        # 우선순위 2: pt_path와 같은 디렉토리에서 찾기
        pt_dir = pt_path.parent
        possible_names = [
            f"{model_name}.onnx",
            "yolo11n.onnx",
            "yolo11s-seg.onnx",
            "yolo11n-seg.onnx",
            "yolo11s.onnx",
            "best.onnx"
        ]
        
        for name in possible_names:
            candidate = pt_dir / name
            if candidate.exists():
                if candidate != onnx_path:
                    candidate.rename(onnx_path)
                    print(f"[OK] ONNX 변환 완료 (이동): {candidate} → {onnx_path}")
                else:
                    print(f"[OK] ONNX 변환 완료: {onnx_path}")
                return onnx_path
        
        # 우선순위 3: 현재 작업 디렉토리에서 찾기
        current_dir = Path.cwd()
        for name in possible_names:
            candidate = current_dir / name
            if candidate.exists():
                candidate.rename(onnx_path)
                print(f"[OK] ONNX 변환 완료 (현재 디렉토리에서 이동): {candidate} → {onnx_path}")
                return onnx_path
        
        # 우선순위 4: pt_path 디렉토리 전체 검색
        for file in pt_dir.glob("*.onnx"):
            if file.exists():
                file.rename(onnx_path)
                print(f"[OK] ONNX 변환 완료 (검색 후 이동): {file} → {onnx_path}")
                return onnx_path
        
        raise FileNotFoundError(f"ONNX 파일을 찾을 수 없습니다. 검색 위치: {pt_dir}, {current_dir}")
        
    except Exception as e:
        print(f"[ERROR] ONNX 변환 실패: {e}")
        import traceback
        traceback.print_exc()
        return None


def upload_onnx_model(supabase, onnx_path, model_name):
    """ONNX 모델을 Supabase Storage에 업로드"""
    try:
        print(f"[UPLOAD] {onnx_path} 업로드 중...")
        
        # ONNX 파일 읽기
        with open(onnx_path, 'rb') as f:
            onnx_data = f.read()
        
        # 공개 URL 생성 (업로드 실패해도 URL은 생성)
        supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
        bucket_path = f"{model_name}.onnx"
        public_url = f"{supabase_url}/storage/v1/object/public/models/{bucket_path}"
        
        # 업로드 시도
        upload_result = supabase.storage.from_('models').upload(
            bucket_path,
            onnx_data
        )
        
        # 업로드 응답 처리 (local_yolo_training.py와 동일한 방식)
        if hasattr(upload_result, 'error') and upload_result.error:
            print(f"[ERROR] ONNX 모델 업로드 실패: {upload_result.error}")
            print(f"[WARN] 업로드 실패로 인해 예상 공개 URL을 사용합니다: {public_url}")
        else:
            print(f"[OK] ONNX 모델 업로드 성공, 공개 URL: {public_url}")
        
        # 실패해도 URL 반환 (나중에 수동 업로드 가능)
        return public_url
        
    except Exception as e:
        print(f"[ERROR] 업로드 실패: {e}")
        import traceback
        traceback.print_exc()
        # 에러가 나도 공개 URL 반환
        supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
        bucket_path = f"{model_name}.onnx"
        public_url = f"{supabase_url}/storage/v1/object/public/models/{bucket_path}"
        print(f"[WARN] 예상 공개 URL: {public_url}")
        return public_url


def update_model_registry(supabase, model_name, onnx_url, onnx_path):
    """model_registry 테이블 업데이트"""
    try:
        print(f"[UPDATE] model_registry 업데이트 중: {model_name}")
        
        # 기존 모델 정보 조회
        result = supabase.table('model_registry')\
            .select('*')\
            .eq('model_name', model_name)\
            .execute()
        
        if result.error:
            print(f"[ERROR] 모델 조회 실패: {result.error}")
            return False
        
        if not result.data or len(result.data) == 0:
            print(f"[WARN] 모델을 찾을 수 없습니다: {model_name}")
            return False
        
        model_data = result.data[0]
        
        # 업데이트 데이터 준비
        update_data = {
            'updated_at': datetime.now().isoformat()
        }
        
        # model_url이 .pt인 경우 .onnx로 업데이트
        if model_data.get('model_url', '').endswith('.pt'):
            update_data['model_url'] = onnx_url
            print(f"[UPDATE] model_url 업데이트: .pt → .onnx")
        
        # model_path가 .pt인 경우 .onnx로 업데이트
        if model_data.get('model_path', '').endswith('.pt'):
            update_data['model_path'] = f"{model_name}.onnx"
            print(f"[UPDATE] model_path 업데이트: .pt → .onnx")
        
        # 업데이트 실행 (에러 처리 개선)
        try:
            update_result = supabase.table('model_registry')\
                .update(update_data)\
                .eq('model_name', model_name)\
                .execute()
            
            if hasattr(update_result, 'error') and update_result.error:
                print(f"[ERROR] 업데이트 실패: {update_result.error}")
                return False
        except Exception as update_err:
            print(f"[ERROR] 업데이트 실행 실패: {update_err}")
            # 에러가 나도 업데이트 데이터는 출력
            print(f"[INFO] 수동 업데이트용 SQL:")
            print(f"UPDATE model_registry SET")
            print(f"  model_url = '{onnx_url}',")
            print(f"  model_path = '{onnx_path.split('/')[-1] if '/' in str(onnx_path) else onnx_path}',")
            print(f"  updated_at = NOW()")
            print(f"WHERE model_name = '{model_name}';")
            return False
        
        print(f"[OK] model_registry 업데이트 완료")
        return True
        
    except Exception as e:
        print(f"[ERROR] 업데이트 실패: {e}")
        import traceback
        traceback.print_exc()
        return False


def process_model(model_name, imgsz=None):
    """모델 변환 프로세스 전체 실행"""
    print("\n" + "="*60)
    print(f"🔄 모델 변환 시작: {model_name}")
    print("="*60)
    
    # Supabase 클라이언트 초기화 (환경변수 관리 시스템 사용)
    if ENV_MANAGER_AVAILABLE:
        supabase_config = get_supabase_config()
        supabase_url = supabase_config['url']
        supabase_key = supabase_config['service_role'] or supabase_config['anon_key']
        print(f"[DEBUG] 환경변수 관리 시스템 사용: {supabase_url}")
    else:
        # 폴백: 기존 방식
        supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
        supabase_key = (
            os.getenv('SUPABASE_SERVICE_ROLE_KEY')
            or os.getenv('VITE_SUPABASE_SERVICE_ROLE')
            or os.getenv('SUPABASE_ANON_KEY')
            or os.getenv('VITE_SUPABASE_ANON_KEY')
        )
        print(f"[DEBUG] 기본 환경변수 사용: {supabase_url}")
    
    if not supabase_url or not supabase_key:
        print("[ERROR] Supabase 환경변수가 설정되지 않음")
        return False
    
    print(f"[DEBUG] Supabase Key 타입: {'SERVICE_ROLE' if (ENV_MANAGER_AVAILABLE and supabase_config.get('service_role')) or (not ENV_MANAGER_AVAILABLE and (os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_SERVICE_ROLE'))) else 'ANON'} (길이: {len(supabase_key) if supabase_key else 0})")
    
    supabase = create_client(supabase_url, supabase_key)
    
    # training_metadata에서 imgsz 확인
    if imgsz is None:
        try:
            result = supabase.table('model_registry')\
                .select('training_metadata')\
                .eq('model_name', model_name)\
                .maybe_single()\
                .execute()
            
            if result.data and result.data.get('training_metadata'):
                training_meta = result.data['training_metadata']
                if isinstance(training_meta, dict):
                    imgsz = training_meta.get('imgsz', 640)
                    print(f"[INFO] training_metadata에서 imgsz 확인: {imgsz}")
        except:
            pass
        
        if imgsz is None:
            imgsz = 640
            print(f"[INFO] 기본 imgsz 사용: {imgsz}")
    
    # 1. .pt 모델 다운로드
    pt_path = download_pt_model(supabase, model_name)
    if not pt_path:
        return False
    
    # 2. ONNX 변환
    onnx_path = convert_to_onnx(pt_path, model_name, imgsz)
    if not onnx_path:
        # 임시 파일 정리
        pt_path.unlink()
        return False
    
    # 3. ONNX 업로드
    onnx_url = upload_onnx_model(supabase, onnx_path, model_name)
    if not onnx_url:
        # 임시 파일 정리
        pt_path.unlink()
        onnx_path.unlink()
        return False
    
    # 4. model_registry 업데이트
    success = update_model_registry(supabase, model_name, onnx_url, onnx_path)
    
    # ONNX 파일은 보존 (수동 업로드용)
    print(f"[INFO] ONNX 파일 보존: {onnx_path}")
    
    # 임시 파일 정리 (PT 파일만 삭제)
    try:
        pt_path.unlink()
        print(f"[CLEANUP] PyTorch 임시 파일 삭제 완료")
    except:
        pass
    
    if success:
        print("\n" + "="*60)
        print(f"✅ 모델 변환 완료: {model_name}")
        print("="*60)
        print(f"ONNX URL: {onnx_url}")
        return True
    else:
        print("\n" + "="*60)
        print(f"[WARNING] 모델 변환 완료 (등록 실패): {model_name}")
        print("="*60)
        return False


def main():
    """메인 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description='기존 .pt 모델을 .onnx로 변환하여 업로드')
    parser.add_argument('--model_name', help='모델 이름 (확장자 제외, 예: brickbox_s_seg_stage1_20251030_220157)')
    parser.add_argument('--imgsz', type=int, help='이미지 크기 (기본값: training_metadata에서 자동 확인 또는 640)')
    parser.add_argument('--batch', nargs='+', help='여러 모델 일괄 처리')
    
    args = parser.parse_args()
    
    models_to_process = []
    
    if args.batch:
        models_to_process = args.batch
    elif args.model_name:
        models_to_process = [args.model_name]
    else:
        print("[ERROR] 모델 이름을 지정하세요: --model_name 또는 --batch")
        parser.print_help()
        return
    
    success_count = 0
    for model_name in models_to_process:
        if process_model(model_name, args.imgsz):
            success_count += 1
    
    print("\n" + "="*60)
    print(f"📊 전체 결과: {success_count}/{len(models_to_process)} 성공")
    print("="*60)


if __name__ == '__main__':
    main()


#!/usr/bin/env python3
"""
PyTorch 모델을 ONNX로 변환하는 유틸리티 스크립트

Supabase Storage에 업로드된 .pt 파일을 다운로드하여 ONNX로 변환하고 다시 업로드합니다.
"""

import argparse
import os
import sys
from pathlib import Path
from datetime import datetime

# .env 파일 로드 (환경변수 관리 시스템과 일관성 유지)
try:
    from dotenv import load_dotenv
    # 프로젝트 루트의 .env 파일 로드
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path, override=True)
        print(f"[OK] .env 파일 로드: {env_path}")
except ImportError:
    print("[WARN] python-dotenv가 설치되지 않음. pip install python-dotenv")
except Exception as e:
    print(f"[WARN] .env 파일 로드 실패: {e}")

try:
    from supabase import create_client
    from ultralytics import YOLO
except ImportError as e:
    print(f"[ERROR] 필요한 패키지가 설치되지 않았습니다: {e}")
    print("다음 명령어로 설치하세요: pip install supabase ultralytics")
    sys.exit(1)

def setup_supabase():
    """Supabase 클라이언트 설정 (환경변수 관리 시스템 사용)"""
    # [FIX] 수정됨: 환경변수 관리 시스템 사용
    # scripts/env_manager.mjs는 Node.js 전용이므로 Python에서는 직접 .env 파일 로드
    
    # .env 파일에서 환경변수 로드
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path, override=True)
    
    # Supabase 설정 (Service Role 우선)
    supabase_url = (
        os.getenv('SUPABASE_URL')
        or os.getenv('VITE_SUPABASE_URL')
        or 'https://npferbxuxocbfnfbpcnz.supabase.co'
    )
    
    supabase_key = (
        os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        or os.getenv('VITE_SUPABASE_SERVICE_ROLE')
        # 기본 Service Role Key (환경변수 없을 경우)
        or 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3NDk4NSwiZXhwIjoyMDc1MDUwOTg1fQ.pPWhWrb4QBC-DT4dd6Y1p-LlHNd9UTKef3SHEXUDp00'
    )
    
    if not supabase_url or not supabase_key:
        print("[ERROR] Supabase 설정을 찾을 수 없습니다")
        sys.exit(1)
    
    print(f"[INFO] Supabase URL: {supabase_url}")
    print(f"[INFO] Service Role Key 사용: {supabase_key[:20]}...")
    
    return create_client(supabase_url, supabase_key)

def download_model(supabase, model_path, local_path):
    """Supabase Storage에서 모델 다운로드"""
    try:
        print(f"[DOWNLOAD] 모델 다운로드 중: {model_path}")
        response = supabase.storage.from_('models').download(model_path)
        
        if hasattr(response, 'error') and response.error:
            print(f"[ERROR] 다운로드 실패: {response.error}")
            return False
        
        # 바이너리 데이터로 받은 경우
        if isinstance(response, bytes):
            with open(local_path, 'wb') as f:
                f.write(response)
        else:
            # 파일 객체인 경우
            with open(local_path, 'wb') as f:
                f.write(response.read())
        
        print(f"[OK] 다운로드 완료: {local_path} ({Path(local_path).stat().st_size / 1024 / 1024:.2f} MB)")
        return True
    except Exception as e:
        print(f"[ERROR] 다운로드 중 오류: {e}")
        import traceback
        traceback.print_exc()
        return False

def convert_to_onnx(pt_path, onnx_path, imgsz=640):
    """PyTorch 모델을 ONNX로 변환"""
    try:
        print(f"[CONVERT] ONNX 변환 시작: {pt_path}")
        model = YOLO(str(pt_path))
        
        # ONNX 변환
        export_result = model.export(
            format='onnx',
            imgsz=imgsz,
            simplify=True,
            opset=12
        )
        
        # export()는 모델 객체의 경로를 반환하거나, 현재 디렉토리에 저장할 수 있음
        # 여러 가능한 경로에서 파일 찾기
        possible_paths = [
            Path(onnx_path),  # 목적지 경로
            Path(pt_path).with_suffix('.onnx'),  # .pt와 같은 디렉토리
            Path("yolo11n-seg.onnx"),  # YOLO 기본 이름
            Path("yolo11n.onnx"),
            Path("yolo11s-seg.onnx"),
            Path("yolo11s.onnx"),
            Path("best.onnx"),
        ]
        
        # export_result가 문자열 경로인 경우
        if isinstance(export_result, (str, Path)):
            possible_paths.insert(0, Path(export_result))
        
        exported_file = None
        for p in possible_paths:
            if p and p.exists():
                if p != Path(onnx_path):
                    # 파일이 다른 경로에 있으면 목적지로 이동
                    p.rename(onnx_path)
                    print(f"[OK] ONNX 파일 이동: {p} → {onnx_path}")
                else:
                    print(f"[OK] ONNX 파일 저장: {onnx_path}")
                exported_file = Path(onnx_path)
                break
        
        if not exported_file:
            raise FileNotFoundError(f"ONNX 파일을 찾을 수 없습니다. 검색 경로: {possible_paths}")
        
        print(f"[OK] ONNX 변환 완료: {onnx_path} ({exported_file.stat().st_size / 1024 / 1024:.2f} MB)")
        return True
        
    except Exception as e:
        print(f"[ERROR] ONNX 변환 실패: {e}")
        import traceback
        traceback.print_exc()
        return False

def upload_onnx(supabase, onnx_path, model_name):
    """ONNX 모델을 Supabase Storage에 업로드 (학습 스크립트와 동일한 방식)"""
    try:
        onnx_bucket_path = f"{model_name}.onnx"
        print(f"[UPLOAD] ONNX 모델 업로드 중: {onnx_bucket_path}")
        
        with open(onnx_path, 'rb') as f:
            onnx_data = f.read()
        
        # [FIX] 수정됨: 학습 스크립트와 동일한 업로드 방식 사용
        # local_yolo_training.py의 upload_and_register_model 함수와 동일한 방식
        upload_result = supabase.storage.from_('models').upload(
            onnx_bucket_path,
            onnx_data
        )
        
        # Supabase Storage 업로드 응답 처리 (학습 스크립트와 동일)
        if hasattr(upload_result, 'error') and upload_result.error:
            error_msg = upload_result.error
            print(f"[ERROR] ONNX 모델 업로드 실패: {error_msg}")
            
            # 파일이 이미 존재하는 경우 update 시도
            if 'already exists' in str(error_msg) or 'duplicate' in str(error_msg).lower():
                print(f"[INFO] 파일이 이미 존재합니다. 업데이트 시도 중...")
                try:
                    update_result = supabase.storage.from_('models').update(
                        onnx_bucket_path,
                        onnx_data
                    )
                    if hasattr(update_result, 'error') and update_result.error:
                        print(f"[ERROR] ONNX 모델 업데이트 실패: {update_result.error}")
                        return False
                    else:
                        print(f"[OK] ONNX 모델 업데이트 성공")
                        supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
                        onnx_public_url = f"{supabase_url}/storage/v1/object/public/models/{onnx_bucket_path}"
                        print(f"[OK] ONNX 모델 업로드 완료, 공개 URL: {onnx_public_url}")
                        return True
                except Exception as update_err:
                    print(f"[ERROR] 업데이트 시도 실패: {update_err}")
                    return False
            else:
                # 학습 스크립트처럼 예상 공개 URL을 생성하고 계속 진행
                supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
                onnx_public_url = f"{supabase_url}/storage/v1/object/public/models/{onnx_bucket_path}"
                print(f"[WARN] 모델 업로드 실패로 인해 예상 공개 URL을 사용합니다: {onnx_public_url}")
                return False
        else:
            # 업로드 성공
            supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
            onnx_public_url = f"{supabase_url}/storage/v1/object/public/models/{onnx_bucket_path}"
            print(f"[OK] ONNX 모델 업로드 성공, 공개 URL: {onnx_public_url}")
            return True
        
        # model_registry 업데이트
        try:
            # model_name에서 타임스탬프 추출
            # brickbox_s_seg_stage1_20251106_132857 -> stage1
            stage = 'stage1' if 'stage1' in model_name else ('stage2' if 'stage2' in model_name else 'single')
            
            # 활성 모델 찾기
            registry_response = supabase.table('model_registry').select('*').eq('model_name', model_name).execute()
            
            if registry_response.data and len(registry_response.data) > 0:
                model_record = registry_response.data[0]
                # model_url과 model_path 업데이트 (ONNX 우선)
                supabase.table('model_registry').update({
                    'model_url': onnx_public_url,
                    'model_path': onnx_bucket_path,
                    'updated_at': datetime.now().isoformat()
                }).eq('id', model_record['id']).execute()
                print(f"[OK] model_registry 업데이트 완료: {model_name}")
            else:
                print(f"[WARN] model_registry에서 모델을 찾을 수 없습니다: {model_name}")
        except Exception as e:
            print(f"[WARN] model_registry 업데이트 실패: {e}")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] ONNX 업로드 중 오류: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    parser = argparse.ArgumentParser(description='PyTorch 모델을 ONNX로 변환하고 업로드')
    parser.add_argument('model_path', help='Supabase Storage의 모델 경로 (예: brickbox_s_seg_stage1_20251106_132857.pt)')
    parser.add_argument('--imgsz', type=int, default=640, help='이미지 크기 (기본값: 640)')
    parser.add_argument('--no-upload', action='store_true', help='변환만 하고 업로드하지 않음')
    
    args = parser.parse_args()
    
    # 모델 이름 추출 (.pt 확장자 제거)
    model_name = args.model_path.replace('.pt', '')
    
    # 임시 디렉토리 생성
    temp_dir = Path("temp_onnx_convert")
    temp_dir.mkdir(exist_ok=True)
    
    pt_local_path = temp_dir / args.model_path
    onnx_local_path = temp_dir / f"{model_name}.onnx"
    
    try:
        # Supabase 클라이언트 설정
        supabase = setup_supabase()
        
        # 모델 다운로드
        if not download_model(supabase, args.model_path, pt_local_path):
            print("[ERROR] 모델 다운로드 실패")
            sys.exit(1)
        
        # ONNX 변환
        if not convert_to_onnx(pt_local_path, onnx_local_path, args.imgsz):
            print("[ERROR] ONNX 변환 실패")
            sys.exit(1)
        
        # 업로드 (옵션)
        upload_success = True
        if not args.no_upload:
            upload_success = upload_onnx(supabase, onnx_local_path, model_name)
            if not upload_success:
                print("[ERROR] ONNX 업로드 실패")
                print("[INFO] 수동 업로드 스크립트 사용:")
                print(f"  python scripts/upload_onnx_to_storage.py {onnx_local_path} {model_name}")
        
        print("\n" + "="*60)
        if upload_success and not args.no_upload:
            print("[SUCCESS] ONNX 변환 및 업로드 완료!")
        else:
            print("[SUCCESS] ONNX 변환 완료!")
        print("="*60)
        print(f"모델: {model_name}")
        print(f"ONNX 파일: {onnx_local_path}")
        if args.no_upload:
            print(f"\n[INFO] 업로드하려면 다음 명령 실행:")
            print(f"  python scripts/upload_onnx_to_storage.py {onnx_local_path} {model_name}")
        
    except Exception as e:
        print(f"[ERROR] 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        # 임시 파일 정리 (--no-upload 옵션 사용 시에는 삭제하지 않음)
        if temp_dir.exists():
            if args.no_upload:
                print(f"[INFO] 임시 디렉토리 유지: {temp_dir}")
                print(f"[INFO] 업로드 후 수동으로 삭제하세요: rmdir /s /q {temp_dir}")
            else:
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)
                print(f"[CLEANUP] 임시 디렉토리 삭제: {temp_dir}")

if __name__ == "__main__":
    main()

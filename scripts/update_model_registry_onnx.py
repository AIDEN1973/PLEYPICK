#!/usr/bin/env python3
"""
ONNX 파일이 이미 Supabase Storage에 업로드된 경우 model_registry를 업데이트하는 스크립트
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
        print("[WARN] python-dotenv가 설치되지 않음")
    except Exception as e:
        print(f"[WARN] .env 파일 로드 실패: {e}")

# Supabase 클라이언트
try:
    from supabase import create_client
except ImportError:
    print("[ERROR] Supabase 클라이언트가 설치되지 않았습니다.")
    print("다음 명령어로 설치하세요: pip install supabase")
    sys.exit(1)


def update_model_registry(model_name, onnx_filename=None):
    """model_registry 테이블 업데이트"""
    try:
        # Supabase 클라이언트 초기화 (환경변수 관리 시스템 우선)
        supabase_url = None
        supabase_key = None
        
        if ENV_MANAGER_AVAILABLE:
            try:
                supabase_config = get_supabase_config()
                supabase_url = supabase_config.get('url')
                supabase_key = supabase_config.get('service_role') or supabase_config.get('anon_key')
                if supabase_url and supabase_key:
                    print(f"[DEBUG] 환경변수 관리 시스템 사용: {supabase_url}")
            except Exception as e:
                print(f"[WARN] 환경변수 관리 시스템 오류: {e}")
        
        if not supabase_url or not supabase_key:
            # 폴백: 기본 환경변수
            supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
            supabase_key = (
                os.getenv('SUPABASE_SERVICE_ROLE_KEY')
                or os.getenv('VITE_SUPABASE_SERVICE_ROLE')
                or os.getenv('SUPABASE_ANON_KEY')
                or os.getenv('VITE_SUPABASE_ANON_KEY')
            )
            if supabase_url and supabase_key:
                print(f"[DEBUG] 기본 환경변수 사용: {supabase_url}")
        
        if not supabase_url or not supabase_key:
            print("[ERROR] Supabase 환경변수가 설정되지 않음")
            return False
        
        supabase = create_client(supabase_url, supabase_key)
        
        print(f"\n[UPDATE] model_registry 업데이트 중: {model_name}")
        
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
        print(f"[INFO] 기존 모델 정보:")
        print(f"  model_url: {model_data.get('model_url', 'N/A')}")
        print(f"  model_path: {model_data.get('model_path', 'N/A')}")
        
        # ONNX 파일명 결정
        if not onnx_filename:
            onnx_filename = f"{model_name}.onnx"
        
        # ONNX URL 생성
        onnx_url = f"{supabase_url}/storage/v1/object/public/models/{onnx_filename}"
        
        # 업데이트 데이터 준비
        update_data = {
            'updated_at': datetime.now().isoformat()
        }
        
        # model_url 업데이트 (항상 ONNX로 변경)
        current_model_url = model_data.get('model_url', '')
        if not current_model_url.endswith('.onnx'):
            update_data['model_url'] = onnx_url
            print(f"[UPDATE] model_url 업데이트: {current_model_url} → {onnx_url}")
        
        # model_path 업데이트 (항상 ONNX로 변경)
        current_model_path = model_data.get('model_path', '')
        if not current_model_path.endswith('.onnx'):
            update_data['model_path'] = onnx_filename
            print(f"[UPDATE] model_path 업데이트: {current_model_path} → {onnx_filename}")
        
        # 업데이트가 필요한 경우만 실행
        if len(update_data) > 1:  # updated_at 외에 다른 필드가 있는 경우
            update_result = supabase.table('model_registry')\
                .update(update_data)\
                .eq('model_name', model_name)\
                .execute()
            
            if hasattr(update_result, 'error') and update_result.error:
                print(f"[ERROR] 업데이트 실패: {update_result.error}")
                return False
            
            print(f"[OK] model_registry 업데이트 완료")
            print(f"[INFO] 업데이트된 정보:")
            print(f"  model_url: {update_data.get('model_url', '변경 없음')}")
            print(f"  model_path: {update_data.get('model_path', '변경 없음')}")
            return True
        else:
            print(f"[INFO] 이미 ONNX로 설정되어 있습니다. 업데이트 불필요")
            return True
        
    except Exception as e:
        print(f"[ERROR] 업데이트 실패: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """메인 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description='ONNX 파일 업로드 후 model_registry 업데이트')
    parser.add_argument('--model_name', help='모델 이름 (확장자 제외)')
    parser.add_argument('--onnx_filename', help='ONNX 파일명 (기본값: {model_name}.onnx)')
    parser.add_argument('--batch', nargs='+', help='여러 모델 일괄 처리')
    parser.add_argument('--skip_upload_check', action='store_true', help='업로드 확인 없이 바로 업데이트 실행')
    
    args = parser.parse_args()
    
    models_to_process = []
    
    if args.batch:
        models_to_process = args.batch
    elif args.model_name:
        models_to_process = [(args.model_name, args.onnx_filename)]
    else:
        print("[ERROR] 모델 이름을 지정하세요: --model_name 또는 --batch")
        parser.print_help()
        return
    
    print("\n" + "="*60)
    print("📝 ONNX 파일 수동 업로드 후 model_registry 업데이트")
    print("="*60)
    
    if not args.skip_upload_check:
        print("\n[안내] 다음 단계를 따라주세요:")
        print("1. Supabase Dashboard에서 Storage > models 버킷 접근")
        print("2. 다음 ONNX 파일들을 업로드:")
        for model_name in (args.batch or [args.model_name]):
            onnx_filename = f"{model_name}.onnx"
            print(f"   - {onnx_filename}")
            print(f"     경로: public/models/temp/{onnx_filename}")
        print("3. 업로드 완료 후 Enter 키를 눌러 model_registry 업데이트를 진행합니다.")
        print("="*60)
        
        try:
            input("\n업로드가 완료되었으면 Enter 키를 눌러주세요...")
        except KeyboardInterrupt:
            print("\n[INFO] 사용자 취소. --skip_upload_check 옵션을 사용하면 확인 없이 실행할 수 있습니다.")
            return
    else:
        print("\n[INFO] 업로드 확인을 건너뛰고 바로 업데이트를 진행합니다.")
        print("="*60)
    
    success_count = 0
    for item in models_to_process:
        if isinstance(item, tuple):
            model_name, onnx_filename = item
        else:
            model_name = item
            onnx_filename = None
        
        if update_model_registry(model_name, onnx_filename):
            success_count += 1
    
    print("\n" + "="*60)
    print(f"📊 전체 결과: {success_count}/{len(models_to_process)} 성공")
    print("="*60)


if __name__ == '__main__':
    main()


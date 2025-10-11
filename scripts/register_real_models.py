#!/usr/bin/env python3
"""
실제 학습된 모델들을 model_registry에 등록
"""

import os
from datetime import datetime
from supabase import create_client, Client

def load_env():
    """환경 변수 로드"""
    env_vars = {}
    try:
        with open('.env', 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key] = value
    except FileNotFoundError:
        print("❌ .env 파일을 찾을 수 없습니다.")
        return None
    
    return env_vars

def register_real_models(supabase: Client):
    """실제 학습된 모델들을 등록"""
    try:
        # Storage에서 모델 파일들 확인
        print("🔍 Storage 모델 파일 확인 중...")
        files = supabase.storage.from_('models').list()
        
        # 실제 모델 파일들 필터링
        model_files = []
        for file_info in files:
            filename = file_info.get('name', '')
            size = file_info.get('size', 0)
            
            # 모델 파일이고 크기가 0이 아닌 것들
            if (filename.endswith(('.pt', '.onnx', '.pth')) and size > 0):
                model_files.append({
                    'name': filename,
                    'size': size,
                    'path': filename
                })
                print(f"📁 실제 모델 발견: {filename} ({size} bytes)")
        
        if not model_files:
            print("📭 실제 모델 파일이 없습니다.")
            return False
        
        # 각 모델을 등록
        registered_count = 0
        for model_info in model_files:
            try:
                filename = model_info['name']
                print(f"\n📤 모델 등록 중: {filename}")
                
                # 파일명에서 모델 정보 추출
                model_name = filename.replace('.pt', '').replace('.onnx', '').replace('.pth', '')
                model_version = f"v1.0.0_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                
                # 모델 타입 결정
                if filename.endswith('.onnx'):
                    model_type = 'yolo_onnx'
                elif filename.endswith('.pt'):
                    model_type = 'yolo_pytorch'
                else:
                    model_type = 'yolo_pytorch'
                
                # 공개 URL 생성
                public_url = supabase.storage.from_('models').get_public_url(filename)
                print(f"🔗 공개 URL: {public_url}")
                
                # model_registry에 등록할 데이터
                model_data = {
                    'model_name': model_name,
                    'model_version': model_version,
                    'version': model_version,
                    'model_type': model_type,
                    'model_path': public_url,
                    'model_url': public_url,
                    'pt_model_path': public_url if filename.endswith('.pt') else None,
                    'model_size': model_info['size'],
                    'is_active': filename == 'set_76917-1_best.pt',  # best 모델만 활성화
                    'performance_metrics': {
                        'mAP50': 0.0,  # 실제 성능 측정 필요
                        'mAP50_95': 0.0,
                        'precision': 0.0,
                        'recall': 0.0,
                        'f1_score': 0.0
                    },
                    'training_metadata': {
                        'source': 'existing_training',
                        'set_num': '76917',
                        'discovered_at': datetime.now().isoformat(),
                        'file_size': model_info['size'],
                        'original_filename': filename,
                        'model_type_detected': model_type
                    },
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }
                
                # 데이터베이스에 삽입
                result = supabase.table('model_registry').insert(model_data).execute()
                
                if result.data:
                    status = "✅ 활성" if model_data['is_active'] else "❌ 비활성"
                    print(f"✅ 모델 등록 완료: {model_name} - {status}")
                    registered_count += 1
                else:
                    print(f"❌ 모델 등록 실패: {model_name}")
                    
            except Exception as e:
                print(f"❌ 모델 등록 중 오류 {model_info['name']}: {e}")
        
        print(f"\n📊 등록 완료: {registered_count}/{len(model_files)}개 모델")
        
        # 등록된 모델 목록 확인
        try:
            result = supabase.table('model_registry').select('model_name, model_version, is_active').execute()
            if result.data:
                print(f"\n📋 현재 등록된 모델 목록:")
                for model in result.data:
                    status = "✅ 활성" if model['is_active'] else "❌ 비활성"
                    print(f"  - {model['model_name']} ({model['model_version']}) - {status}")
        except Exception as e:
            print(f"❌ 등록된 모델 목록 조회 실패: {e}")
        
        return registered_count > 0
        
    except Exception as e:
        print(f"❌ 모델 등록 실패: {e}")
        return False

def main():
    """메인 함수"""
    print("🤖 실제 학습된 모델 등록 시작")
    print("=" * 50)
    
    # 환경 변수 로드
    env_vars = load_env()
    if not env_vars:
        return
    
    SUPABASE_URL = env_vars.get('VITE_SUPABASE_URL')
    SUPABASE_KEY = env_vars.get('VITE_SUPABASE_SERVICE_ROLE_KEY') or env_vars.get('VITE_SUPABASE_ANON_KEY')
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Supabase 환경 변수가 설정되지 않았습니다.")
        return
    
    # Supabase 클라이언트 생성
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # 실제 모델들 등록
    success = register_real_models(supabase)
    
    if success:
        print(f"\n✅ 실제 모델 등록 완료!")
        print("🎯 이제 모니터링 대시보드에서 실제 학습된 모델을 확인할 수 있습니다.")
    else:
        print(f"\n❌ 모델 등록 실패")

if __name__ == "__main__":
    main()

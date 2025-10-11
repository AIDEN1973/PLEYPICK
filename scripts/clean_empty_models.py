#!/usr/bin/env python3
"""
Supabase Storage의 빈 모델 파일 정리 및 model_registry 정리
"""

import os
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

def clean_empty_models(supabase: Client):
    """빈 모델 파일과 관련 레코드 정리"""
    try:
        # 1. Storage에서 빈 파일 확인 및 삭제
        print("🔍 Storage 빈 파일 확인 중...")
        files = supabase.storage.from_('models').list()
        
        empty_files = []
        for file_info in files:
            if file_info.get('size', 0) == 0:
                empty_files.append(file_info['name'])
                print(f"📭 빈 파일 발견: {file_info['name']} ({file_info.get('size', 0)} bytes)")
        
        # 빈 파일 삭제
        if empty_files:
            print(f"🗑️ 빈 파일 삭제 중: {len(empty_files)}개")
            for filename in empty_files:
                try:
                    supabase.storage.from_('models').remove([filename])
                    print(f"✅ 삭제 완료: {filename}")
                except Exception as e:
                    print(f"❌ 삭제 실패 {filename}: {e}")
        
        # 2. model_registry에서 빈 파일과 관련된 레코드 삭제
        print("\n🔍 model_registry 빈 파일 관련 레코드 확인 중...")
        
        # 빈 파일과 관련된 모델들 삭제
        for filename in empty_files:
            try:
                # 파일명에서 모델명 추출
                model_name = filename.replace('.pt', '').replace('.onnx', '').replace('.pth', '')
                
                # 관련 레코드 삭제
                result = supabase.table('model_registry').delete().eq('model_name', model_name).execute()
                if result.data:
                    print(f"✅ 레코드 삭제 완료: {model_name}")
                else:
                    print(f"📭 삭제할 레코드 없음: {model_name}")
                    
            except Exception as e:
                print(f"❌ 레코드 삭제 실패 {model_name}: {e}")
        
        # 3. 현재 남은 모델들 확인
        print("\n📋 현재 남은 모델들:")
        try:
            result = supabase.table('model_registry').select('model_name, model_version, is_active').execute()
            if result.data:
                for model in result.data:
                    status = "✅ 활성" if model['is_active'] else "❌ 비활성"
                    print(f"  - {model['model_name']} ({model['model_version']}) - {status}")
            else:
                print("  📭 등록된 모델이 없습니다.")
        except Exception as e:
            print(f"❌ 모델 목록 조회 실패: {e}")
        
        return True
        
    except Exception as e:
        print(f"❌ 정리 작업 실패: {e}")
        return False

def main():
    """메인 함수"""
    print("🧹 빈 모델 파일 정리 시작")
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
    
    # 빈 모델 파일 정리
    success = clean_empty_models(supabase)
    
    if success:
        print(f"\n✅ 정리 완료!")
        print("🎯 이제 실제 학습된 모델만 등록됩니다.")
    else:
        print(f"\n❌ 정리 실패")

if __name__ == "__main__":
    main()

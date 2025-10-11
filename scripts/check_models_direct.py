#!/usr/bin/env python3
"""
Supabase Storage models 버킷 직접 확인
"""

import os
import sys
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

def check_models_direct():
    """models 버킷 직접 확인"""
    print("🔍 Supabase Storage models 버킷 직접 확인...")
    
    # 환경 변수 로드
    env_vars = load_env()
    if not env_vars:
        return False
    
    # Supabase 클라이언트 생성
    try:
        supabase_url = env_vars.get('VITE_SUPABASE_URL')
        supabase_key = env_vars.get('VITE_SUPABASE_ANON_KEY')
        
        if not supabase_url or not supabase_key:
            print("❌ Supabase 환경 변수가 설정되지 않았습니다.")
            return False
        
        supabase: Client = create_client(supabase_url, supabase_key)
        print("✅ Supabase 클라이언트 연결 성공")
        
    except Exception as e:
        print(f"❌ Supabase 클라이언트 생성 실패: {e}")
        return False
    
    # models 버킷에 직접 접근 시도
    try:
        print("\n📁 models 버킷 직접 접근 시도...")
        
        # brickbox_s_seg_20251010_034224 폴더 내용 확인
        folder_path = "brickbox_s_seg_20251010_034224"
        files = supabase.storage.from_('models').list(folder_path)
        
        print(f"✅ '{folder_path}' 폴더 접근 성공")
        print(f"📄 파일 목록:")
        for file in files:
            print(f"   - {file['name']}")
        
        # 특정 모델 파일들 확인
        expected_files = [
            'set_76917-1_best.pt',
            'set_76917-1_last.pt', 
            'set_76917-1_best.onnx'
        ]
        
        print(f"\n🎯 모델 파일 공개 URL 확인...")
        for filename in expected_files:
            try:
                file_path = f"{folder_path}/{filename}"
                public_url = supabase.storage.from_('models').get_public_url(file_path)
                print(f"✅ {filename}")
                print(f"   URL: {public_url}")
            except Exception as e:
                print(f"❌ {filename} - {e}")
        
        return True
        
    except Exception as e:
        print(f"❌ models 버킷 접근 실패: {e}")
        print(f"   오류 타입: {type(e).__name__}")
        print(f"   오류 메시지: {str(e)}")
        return False

if __name__ == "__main__":
    success = check_models_direct()
    sys.exit(0 if success else 1)

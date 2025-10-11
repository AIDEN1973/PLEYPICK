#!/usr/bin/env python3
"""
Supabase Storage 직접 확인
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

def main():
    """메인 함수"""
    print("🔍 Supabase Storage 직접 확인")
    print("=" * 50)
    
    # 환경 변수 로드
    env_vars = load_env()
    if not env_vars:
        return
    
    SUPABASE_URL = env_vars.get('VITE_SUPABASE_URL')
    SUPABASE_KEY = env_vars.get('VITE_SUPABASE_SERVICE_ROLE_KEY') or env_vars.get('VITE_SUPABASE_ANON_KEY')
    
    print(f"🔗 Supabase URL: {SUPABASE_URL}")
    print(f"🔑 Key 타입: {'Service Role' if 'SERVICE_ROLE' in SUPABASE_KEY else 'Anon'}")
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Supabase 환경 변수가 설정되지 않았습니다.")
        return
    
    # Supabase 클라이언트 생성
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    try:
        # 1. 버킷 목록 확인
        print("\n📦 버킷 목록 확인...")
        buckets = supabase.storage.list_buckets()
        print(f"버킷 수: {len(buckets)}")
        for bucket in buckets:
            print(f"  - {bucket.name} (공개: {bucket.public})")
        
        # 2. models 버킷 직접 접근 시도
        print("\n🔍 models 버킷 직접 접근...")
        try:
            files = supabase.storage.from_('models').list()
            print(f"models 버킷 파일 수: {len(files)}")
            for file_info in files:
                print(f"  - {file_info.get('name', 'unknown')} ({file_info.get('size', 0)} bytes)")
        except Exception as e:
            print(f"❌ models 버킷 접근 실패: {e}")
        
        # 3. 다른 버킷들도 확인
        print("\n🔍 다른 버킷들 확인...")
        for bucket in buckets:
            try:
                files = supabase.storage.from_(bucket.name).list()
                print(f"{bucket.name} 버킷 파일 수: {len(files)}")
                for file_info in files[:5]:  # 처음 5개만 표시
                    print(f"  - {file_info.get('name', 'unknown')} ({file_info.get('size', 0)} bytes)")
            except Exception as e:
                print(f"❌ {bucket.name} 버킷 접근 실패: {e}")
        
    except Exception as e:
        print(f"❌ Storage 확인 실패: {e}")

if __name__ == "__main__":
    main()

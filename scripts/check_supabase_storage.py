#!/usr/bin/env python3
"""
Supabase Storage 상태 확인 및 RLS 정책 문제 해결
"""

import os
from supabase import create_client, Client

def check_supabase_storage():
    """
    Supabase Storage 상태 확인
    """
    # 환경 변수 로드
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
        return False
    
    SUPABASE_URL = env_vars.get('VITE_SUPABASE_URL')
    SUPABASE_KEY = env_vars.get('VITE_SUPABASE_ANON_KEY')
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Supabase 환경 변수가 설정되지 않았습니다.")
        return False
    
    # Supabase 클라이언트 생성
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    print("🔍 Supabase Storage 상태 확인 중...")
    
    try:
        # Storage 버킷 목록 확인
        buckets = supabase.storage.list_buckets()
        print(f"📦 사용 가능한 버킷: {[bucket.name for bucket in buckets]}")
        
        # models 버킷이 있는지 확인
        models_bucket = None
        for bucket in buckets:
            if bucket.name == 'models':
                models_bucket = bucket
                break
        
        if not models_bucket:
            print("❌ 'models' 버킷이 존재하지 않습니다.")
            print("💡 Supabase 대시보드에서 'models' 버킷을 생성하세요.")
            return False
        
        print(f"✅ 'models' 버킷 확인됨: {models_bucket.name}")
        
        # 기존 파일 목록 확인
        try:
            files = supabase.storage.from_('models').list('yolo')
            print(f"📁 기존 yolo 폴더 파일들: {[f['name'] for f in files]}")
        except Exception as e:
            print(f"⚠️ yolo 폴더 접근 실패: {e}")
        
        # 파일 업로드 시도
        print("\n🧪 파일 업로드 시도...")
        test_content = b"file content"
        
        try:
            result = supabase.storage.from_('models').upload(
                "test/test.txt",
                test_content,
                file_options={"content-type": "text/plain"}
            )
            print("✅ 파일 업로드 성공!")
            
            # 파일 삭제
            supabase.storage.from_('models').remove(["test/test.txt"])
            print("🗑️ 파일 삭제 완료")
            
        except Exception as e:
            print(f"❌ 파일 업로드 실패: {e}")
            print("\n💡 해결 방법:")
            print("1. Supabase 대시보드 > Storage > models 버킷")
            print("2. RLS 정책 확인 및 수정")
            print("3. 또는 Service Role Key 사용")
            
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Supabase Storage 확인 실패: {e}")
        return False

if __name__ == "__main__":
    check_supabase_storage()

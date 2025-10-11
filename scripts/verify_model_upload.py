#!/usr/bin/env python3
"""
Supabase Storage에 업로드된 모델 파일 확인
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

def check_model_upload():
    """모델 업로드 확인"""
    print("🔍 Supabase Storage 모델 파일 확인 중...")
    
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
    
    # models 버킷 확인
    try:
        print("\n📦 Storage 버킷 목록 확인...")
        buckets = supabase.storage.list_buckets()
        print(f"📋 사용 가능한 버킷: {[bucket.name for bucket in buckets]}")
        
        # models 버킷이 있는지 확인
        models_bucket = None
        for bucket in buckets:
            if bucket.name == 'models':
                models_bucket = bucket
                break
        
        if not models_bucket:
            print("❌ 'models' 버킷이 존재하지 않습니다.")
            return False
        
        print("✅ 'models' 버킷 확인됨")
        
    except Exception as e:
        print(f"❌ 버킷 목록 조회 실패: {e}")
        return False
    
    # brickbox_s_seg_20251010_034224 폴더 확인
    try:
        print("\n📁 모델 폴더 확인...")
        folder_path = "brickbox_s_seg_20251010_034224"
        files = supabase.storage.from_('models').list(folder_path)
        
        if not files:
            print(f"❌ '{folder_path}' 폴더가 비어있거나 존재하지 않습니다.")
            return False
        
        print(f"✅ '{folder_path}' 폴더 확인됨")
        print(f"📄 파일 목록:")
        for file in files:
            print(f"   - {file['name']} ({file.get('metadata', {}).get('size', 'Unknown')} bytes)")
        
    except Exception as e:
        print(f"❌ 폴더 내용 조회 실패: {e}")
        return False
    
    # 특정 모델 파일들 확인
    expected_files = [
        'set_76917-1_best.pt',
        'set_76917-1_last.pt', 
        'set_76917-1_best.onnx'
    ]
    
    print(f"\n🎯 예상 모델 파일 확인...")
    missing_files = []
    
    for filename in expected_files:
        try:
            file_path = f"{folder_path}/{filename}"
            file_info = supabase.storage.from_('models').get_public_url(file_path)
            print(f"✅ {filename} - 공개 URL 생성 가능")
            print(f"   URL: {file_info}")
        except Exception as e:
            print(f"❌ {filename} - 파일 없음 또는 접근 불가: {e}")
            missing_files.append(filename)
    
    if missing_files:
        print(f"\n⚠️ 누락된 파일: {missing_files}")
        return False
    
    print(f"\n🎉 모든 모델 파일이 정상적으로 업로드되었습니다!")
    print(f"📊 총 {len(expected_files)}개 파일 확인됨")
    
    return True

if __name__ == "__main__":
    success = check_model_upload()
    sys.exit(0 if success else 1)

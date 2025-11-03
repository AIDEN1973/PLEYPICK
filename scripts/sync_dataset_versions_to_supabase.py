#!/usr/bin/env python3
"""
데이터셋 버전을 Supabase에 동기화하는 스크립트
"""

import os
import sys
import json
import requests
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

# UTF-8 인코딩 설정
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# 환경변수 설정
os.environ['PYTHONIOENCODING'] = 'utf-8'
os.environ['LANG'] = 'ko_KR.UTF-8'
os.environ['LC_ALL'] = 'ko_KR.UTF-8'
os.environ['PYTHONUTF8'] = '1'

def load_env_file():
    """환경 변수 로드"""
    env_file = Path('.env')
    if env_file.exists():
        try:
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if '=' in line and not line.startswith('#'):
                        key, value = line.strip().split('=', 1)
                        os.environ[key] = value
        except UnicodeDecodeError:
            # UTF-8 실패 시 다른 인코딩 시도
            try:
                with open(env_file, 'r', encoding='cp949') as f:
                    for line in f:
                        if '=' in line and not line.startswith('#'):
                            key, value = line.strip().split('=', 1)
                            os.environ[key] = value
            except:
                print("[WARNING] .env 파일 읽기 실패, 환경변수 직접 설정")
                # 기본값 설정
                os.environ['SUPABASE_URL'] = 'https://npferbxuxocbfnfbpcnz.supabase.co'
                os.environ['SUPABASE_ANON_KEY'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ2NzQ4MDAsImV4cCI6MjA1MDI1MDgwMH0.placeholder-key'

def get_supabase_config():
    """Supabase 설정 가져오기"""
    load_env_file()
    
    # 환경 변수에서 직접 가져오기 (서버에서 설정한 값 우선)
    url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
    # 서비스 역할 키 사용 (RLS 우회)
    key = os.getenv('SUPABASE_SERVICE_ROLE') or os.getenv('VITE_SUPABASE_SERVICE_ROLE') or os.getenv('SUPABASE_ANON_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')
    
    # 기본값 설정
    if not url:
        url = 'https://npferbxuxocbfnfbpcnz.supabase.co'
    if not key:
        key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk'
    
    print(f"[INFO] Supabase URL: {url}")
    print(f"[INFO] Supabase Key: {key[:20]}...")
    
    return url, key

def load_local_versions():
    """로컬 버전 데이터 로드"""
    versions_file = Path('output/dataset_versions.json')
    if not versions_file.exists():
        print("[ERROR] dataset_versions.json 파일이 없습니다.")
        return None
    
    with open(versions_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    return data

def sync_version_to_supabase(version_data, url, key, is_current=False):
    """단일 버전을 Supabase에 동기화"""
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
        'apikey': key  # RLS 우회를 위한 추가 헤더
    }
    
    # 데이터 준비 (한글 인코딩 처리)
    description = version_data.get('description', '')
    if isinstance(description, str):
        # 한글 인코딩 문제 수정
        description = description.encode('utf-8').decode('utf-8')
    
    # 매니페스트에서 해시 정보 가져오기
    manifest_path = Path(f'output/manifests/{version_data["version"]}.json')
    dataset_hash = ''
    if manifest_path.exists():
        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                manifest = json.load(f)
                dataset_hash = manifest.get('dataset_hash', '')
        except Exception as e:
            print(f"[WARNING] 매니페스트 읽기 실패: {e}")
    
    payload = {
        'version': version_data['version'],
        'description': description,
        'file_counts': version_data.get('file_counts', {}),
        'created_at': version_data.get('created_at', datetime.now().isoformat()),
        'is_current': is_current,
        'storage_path': f"datasets/{version_data['version']}",
        'metadata': {
            'dataset_hash': dataset_hash,
            'source_path': version_data.get('source_path', ''),
            'local_path': version_data.get('path', '')
        }
    }
    
    try:
        # UPSERT (INSERT ... ON CONFLICT ... DO UPDATE)
        response = requests.post(
            f"{url}/rest/v1/dataset_versions",
            headers=headers,
            json=payload,
            params={'on_conflict': 'version'}  # 버전 충돌 시 업데이트
        )
        
        if response.status_code in [200, 201]:
            print(f"[SUCCESS] 버전 {version_data['version']} 동기화 완료")
            return True
        else:
            print(f"[ERROR] 버전 {version_data['version']} 동기화 실패: {response.status_code}")
            print(f"응답: {response.text}")
            return False
            
    except Exception as e:
        print(f"[ERROR] 버전 {version_data['version']} 동기화 중 오류: {e}")
        return False

def get_supabase_versions(url, key):
    """Supabase에서 현재 버전 목록 가져오기"""
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.get(
            f"{url}/rest/v1/dataset_versions",
            headers=headers
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"[ERROR] Supabase 버전 조회 실패: {response.status_code}")
            return []
    except Exception as e:
        print(f"[ERROR] Supabase 버전 조회 중 오류: {e}")
        return []

def main():
    """메인 함수"""
    print("[INFO] 데이터셋 버전 Supabase 동기화 시작")
    
    # Supabase 설정 확인
    url, key = get_supabase_config()
    if not url or not key:
        return 1
    
    # 로컬 버전 데이터 로드
    local_data = load_local_versions()
    if not local_data:
        return 1
    
    versions = local_data.get('versions', {})
    current_version = local_data.get('current_version', '')
    
    print(f"[INFO] 로컬 버전 {len(versions)}개 발견")
    print(f"[INFO] 현재 버전: {current_version}")
    
    # 각 버전을 Supabase에 동기화
    success_count = 0
    for version_data in versions:
        version_key = version_data['version']
        is_current = (version_key == current_version)
        if sync_version_to_supabase(version_data, url, key, is_current):
            success_count += 1
    
    print(f"[INFO] 동기화 완료: {success_count}/{len(versions)}개 성공")
    
    # Supabase에서 최종 상태 확인
    print("\n[INFO] Supabase 동기화 상태 확인:")
    supabase_versions = get_supabase_versions(url, key)
    for version in supabase_versions:
        status = "현재" if version.get('is_current') else "백업"
        print(f"  - v{version['version']}: {status} ({version.get('description', '')})")
    
    return 0

if __name__ == '__main__':
    sys.exit(main())

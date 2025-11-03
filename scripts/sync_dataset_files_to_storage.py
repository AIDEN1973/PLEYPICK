#!/usr/bin/env python3
"""
데이터셋 파일을 Supabase Storage에 동기화하는 스크립트
"""

import os
import sys
import json
import shutil
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
            print("[WARNING] .env 파일 읽기 실패, 환경변수 직접 설정")
            os.environ['SUPABASE_URL'] = 'https://npferbxuxocbfnfbpcnz.supabase.co'
            os.environ['SUPABASE_KEY'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3NDk4NSwiZXhwIjoyMDc1MDUwOTg1fQ.pPWhWrb4QBC-DT4dd6Y1p-LlHNd9UTKef3SHEXUDp00'

def get_supabase_config():
    """Supabase 설정 가져오기"""
    load_env_file()
    
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_KEY') or os.getenv('VITE_SUPABASE_SERVICE_ROLE')
    
    if not url or not key:
        print("[ERROR] Supabase 설정이 없습니다. .env 파일을 확인하세요.")
        return None, None
    
    return url, key

def upload_file_to_storage(file_path, storage_path, url, key):
    """단일 파일을 Supabase Storage에 업로드"""
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/octet-stream'
    }
    
    try:
        with open(file_path, 'rb') as f:
            file_data = f.read()
        
        response = requests.post(
            f"{url}/storage/v1/object/dataset-files/{storage_path}",
            headers=headers,
            data=file_data
        )
        
        if response.status_code in [200, 201]:
            print(f"[SUCCESS] {storage_path} 업로드 완료")
            return True
        else:
            print(f"[ERROR] {storage_path} 업로드 실패: {response.status_code}")
            print(f"응답: {response.text}")
            return False
            
    except Exception as e:
        print(f"[ERROR] {storage_path} 업로드 중 오류: {e}")
        return False

def sync_dataset_version_to_storage(version, dataset_path, url, key):
    """특정 버전의 데이터셋을 Storage에 동기화"""
    print(f"[INFO] 버전 {version} Storage 동기화 시작...")
    
    # Storage 경로 설정
    storage_base_path = f"datasets/v{version}"
    
    success_count = 0
    total_count = 0
    
    # 이미지 파일 업로드
    images_path = Path(dataset_path) / "images"
    if images_path.exists():
        for img_file in images_path.rglob("*"):
            if img_file.is_file():
                relative_path = img_file.relative_to(dataset_path)
                storage_path = f"{storage_base_path}/{relative_path}".replace("\\", "/")
                
                total_count += 1
                if upload_file_to_storage(img_file, storage_path, url, key):
                    success_count += 1
    
    # 라벨 파일 업로드
    labels_path = Path(dataset_path) / "labels"
    if labels_path.exists():
        for label_file in labels_path.rglob("*"):
            if label_file.is_file():
                relative_path = label_file.relative_to(dataset_path)
                storage_path = f"{storage_base_path}/{relative_path}".replace("\\", "/")
                
                total_count += 1
                if upload_file_to_storage(label_file, storage_path, url, key):
                    success_count += 1
    
    # 메타데이터 파일 업로드
    metadata_path = Path(dataset_path) / "metadata"
    if metadata_path.exists():
        for meta_file in metadata_path.rglob("*"):
            if meta_file.is_file():
                relative_path = meta_file.relative_to(dataset_path)
                storage_path = f"{storage_base_path}/{relative_path}".replace("\\", "/")
                
                total_count += 1
                if upload_file_to_storage(meta_file, storage_path, url, key):
                    success_count += 1
    
    # data.yaml 파일 업로드
    data_yaml = Path(dataset_path) / "data.yaml"
    if data_yaml.exists():
        total_count += 1
        storage_path = f"{storage_base_path}/data.yaml"
        if upload_file_to_storage(data_yaml, storage_path, url, key):
            success_count += 1
    
    print(f"[INFO] 버전 {version} 동기화 완료: {success_count}/{total_count}개 파일")
    return success_count, total_count

def main():
    """메인 함수"""
    print("[INFO] 데이터셋 파일 Storage 동기화 시작")
    
    # Supabase 설정 확인
    url, key = get_supabase_config()
    if not url or not key:
        return 1
    
    # 로컬 버전 데이터 로드
    versions_file = Path('output/dataset_versions.json')
    if not versions_file.exists():
        print("[ERROR] dataset_versions.json 파일이 없습니다.")
        return 1
    
    with open(versions_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    versions = data.get('versions', {})
    current_version = data.get('current_version', '')
    
    print(f"[INFO] 로컬 버전 {len(versions)}개 발견")
    print(f"[INFO] 현재 버전: {current_version}")
    
    # 각 버전을 Storage에 동기화
    total_success = 0
    total_files = 0
    
    for version_key, version_data in versions.items():
        dataset_path = version_data.get('path', '')
        if dataset_path and Path(dataset_path).exists():
            success, files = sync_dataset_version_to_storage(
                version_key, dataset_path, url, key
            )
            total_success += success
            total_files += files
        else:
            print(f"[WARNING] 버전 {version_key}의 데이터셋 경로가 존재하지 않습니다: {dataset_path}")
    
    print(f"[INFO] 전체 동기화 완료: {total_success}/{total_files}개 파일 성공")
    return 0

if __name__ == '__main__':
    sys.exit(main())



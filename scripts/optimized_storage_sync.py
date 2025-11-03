#!/usr/bin/env python3
"""
최적화된 데이터셋 Storage 동기화 스크립트
- 공통 파일은 한 번만 저장
- 버전별 차이점만 별도 관리
"""

import os
import sys
import json
import hashlib
import requests
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Set

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
    key = os.getenv('SUPABASE_SERVICE_ROLE') or os.getenv('VITE_SUPABASE_SERVICE_ROLE') or os.getenv('SUPABASE_KEY')
    
    if not url or not key:
        print("[ERROR] Supabase 설정이 없습니다. .env 파일을 확인하세요.")
        return None, None
    
    return url, key

def calculate_file_hash(file_path):
    """파일 해시 계산"""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def scan_dataset_files(dataset_path):
    """데이터셋 파일 스캔 및 해시 계산"""
    files_info = {}
    dataset_path = Path(dataset_path)
    
    if not dataset_path.exists():
        return files_info
    
    for file_path in dataset_path.rglob("*"):
        if file_path.is_file():
            relative_path = str(file_path.relative_to(dataset_path)).replace("\\", "/")
            file_hash = calculate_file_hash(file_path)
            file_size = file_path.stat().st_size
            
            files_info[relative_path] = {
                'path': file_path,
                'hash': file_hash,
                'size': file_size,
                'relative_path': relative_path
            }
    
    return files_info

def scan_synthetic_folder(synthetic_path):
    """synthetic 폴더에서 엘리먼트 ID별 파일 스캔"""
    files_info = {}
    synthetic_path = Path(synthetic_path)
    
    if not synthetic_path.exists():
        return files_info
    
    # 엘리먼트 ID 폴더들만 스캔 (숫자로만 구성된 6-7자리 폴더명)
    for element_folder in synthetic_path.iterdir():
        if element_folder.is_dir() and element_folder.name.isdigit() and len(element_folder.name) >= 6:
            print(f"[SCAN] 엘리먼트 ID {element_folder.name} 스캔 중...")
            for file_path in element_folder.rglob("*"):
                if file_path.is_file():
                    # synthetic/6211342/6211342_000.webp -> 6211342/6211342_000.webp
                    relative_path = str(file_path.relative_to(synthetic_path)).replace("\\", "/")
                    file_hash = calculate_file_hash(file_path)
                    file_size = file_path.stat().st_size
                    
                    files_info[relative_path] = {
                        'path': file_path,
                        'hash': file_hash,
                        'size': file_size,
                        'relative_path': relative_path
                    }
            print(f"[SCAN] 엘리먼트 ID {element_folder.name}: {len([f for f in element_folder.rglob('*') if f.is_file()])}개 파일")
    
    return files_info

def upload_file_to_storage(file_path, storage_path, url, key):
    """단일 파일을 Supabase Storage에 업로드"""
    # 파일 확장자에 따른 MIME 타입 결정
    file_ext = os.path.splitext(file_path)[1].lower()
    mime_types = {
        '.json': 'application/json',
        '.yaml': 'text/plain',
        '.yml': 'text/plain',
        '.txt': 'text/plain',
        '.webp': 'image/webp',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg'
    }
    content_type = mime_types.get(file_ext, 'application/octet-stream')
    
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': content_type
    }
    
    try:
        with open(file_path, 'rb') as f:
            file_data = f.read()
        
        # Storage 경로 정규화
        storage_path = storage_path.replace('\\', '/')
        
        response = requests.post(
            f"{url}/storage/v1/object/lego-synthetic/{storage_path}",
            headers=headers,
            data=file_data
        )
        
        if response.status_code in [200, 201]:
            return True
        elif response.status_code == 409:
            print(f"[SKIP] {storage_path} 이미 존재함")
            return True  # 중복 파일은 성공으로 처리
        else:
            # 응답 본문에서 409 오류 확인
            if response.text and "409" in response.text and "Duplicate" in response.text:
                print(f"[SKIP] {storage_path} 이미 존재함")
                return True
            else:
                print(f"[ERROR] {storage_path} 업로드 실패: {response.status_code}")
                if response.text:
                    print(f"[ERROR] 응답: {response.text}")
                return False
            
    except Exception as e:
        print(f"[ERROR] {storage_path} 업로드 중 오류: {e}")
        return False

def upload_file_to_storage_force(file_path, storage_path, url, key):
    """단일 파일을 Supabase Storage에 강제 업로드 (덮어쓰기)"""
    # 파일 확장자에 따른 MIME 타입 결정
    file_ext = os.path.splitext(file_path)[1].lower()
    mime_types = {
        '.json': 'application/json',
        '.yaml': 'text/plain',
        '.yml': 'text/plain',
        '.txt': 'text/plain',
        '.webp': 'image/webp',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg'
    }
    content_type = mime_types.get(file_ext, 'application/octet-stream')
    
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': content_type
    }
    
    try:
        with open(file_path, 'rb') as f:
            file_data = f.read()
        
        # Storage 경로 정규화
        storage_path = storage_path.replace('\\', '/')
        
        # 기존 파일 삭제 시도 (실패해도 무시)
        try:
            delete_response = requests.delete(
                f"{url}/storage/v1/object/lego-synthetic/{storage_path}",
                headers={'apikey': key, 'Authorization': f'Bearer {key}'}
            )
        except:
            pass  # 삭제 실패는 무시
        
        # 파일 업로드
        response = requests.post(
            f"{url}/storage/v1/object/lego-synthetic/{storage_path}",
            headers=headers,
            data=file_data
        )
        
        if response.status_code in [200, 201]:
            print(f"[FORCE] {storage_path} 강제 업로드 성공")
            return True
        else:
            print(f"[ERROR] {storage_path} 강제 업로드 실패: {response.status_code}")
            if response.text:
                print(f"[ERROR] 응답: {response.text}")
            return False
            
    except Exception as e:
        print(f"[ERROR] {storage_path} 강제 업로드 중 오류: {e}")
        return False

def create_file_index(files_info, url, key):
    """파일 인덱스 생성 및 공통 파일 업로드"""
    print("[INFO] 파일 인덱스 생성 중...")
    
    # 해시별 파일 그룹화
    hash_groups = {}
    for file_info in files_info.values():
        file_hash = file_info['hash']
        if file_hash not in hash_groups:
            hash_groups[file_hash] = []
        hash_groups[file_hash].append(file_info)
    
    # 공통 파일 업로드 (해시 기반)
    uploaded_files = {}
    common_files = {}
    
    for file_hash, file_list in hash_groups.items():
        if len(file_list) > 1:  # 중복 파일
            # 첫 번째 파일을 공통 파일로 업로드
            first_file = file_list[0]
            storage_path = f"common/{file_hash}/{first_file['relative_path']}"
            
            if upload_file_to_storage(first_file['path'], storage_path, url, key):
                common_files[file_hash] = storage_path
                print(f"[COMMON] {file_hash[:8]}... → {storage_path}")
                
                # 모든 중복 파일을 공통 파일로 매핑
                for file_info in file_list:
                    uploaded_files[file_info['relative_path']] = {
                        'type': 'common',
                        'storage_path': storage_path,
                        'hash': file_hash
                    }
        else:  # 고유 파일
            file_info = file_list[0]
            storage_path = f"unique/{file_hash}/{file_info['relative_path']}"
            
            if upload_file_to_storage(file_info['path'], storage_path, url, key):
                uploaded_files[file_info['relative_path']] = {
                    'type': 'unique',
                    'storage_path': storage_path,
                    'hash': file_hash
                }
                print(f"[UNIQUE] {file_info['relative_path']} → {storage_path}")
    
    return uploaded_files, common_files

def sync_to_synthetic_folder(files_info, uploaded_files, url, key):
    """synthetic 폴더에 부품별 구조로 동기화 (강제 업로드)"""
    print("[INFO] synthetic 폴더 동기화 중...")
    
    synthetic_synced = 0
    synthetic_skipped = 0
    
    for relative_path, file_info in files_info.items():
        filename = os.path.basename(relative_path)
        
        # 파일명에서 엘리먼트 ID 또는 부품 ID 추출
        # 예: 6211342_000.webp -> 6211342
        # 예: 6335317_000.webp -> 6335317
        if '_' in filename:
            element_id = filename.split('_')[0]
        else:
            # 파일명에 언더스코어가 없으면 경로에서 추출 시도
            parts = relative_path.split('/')
            if len(parts) >= 2:
                element_id = parts[0]
            else:
                print(f"[WARNING] ID를 추출할 수 없음: {relative_path}")
                synthetic_skipped += 1
                continue
        
        # 엘리먼트 ID 판별 (숫자로만 구성되고 6-7자리)
        is_element_id = element_id.isdigit() and len(element_id) >= 6
        
        if is_element_id:
            # 엘리먼트 ID: synthetic/{element_id}/{filename}
            synthetic_path = f"synthetic/{element_id}/{filename}"
        else:
            # 부품 ID: synthetic/{part_id}/{filename}
            synthetic_path = f"synthetic/{element_id}/{filename}"
        
        # synthetic 폴더는 강제 업로드 (덮어쓰기)
        if upload_file_to_storage_force(file_info['path'], synthetic_path, url, key):
            synthetic_synced += 1
            print(f"[SYNTHETIC] {relative_path} → {synthetic_path}")
        else:
            synthetic_skipped += 1
    
    print(f"[INFO] synthetic 동기화 완료: {synthetic_synced}개 성공, {synthetic_skipped}개 건너뜀")
    return synthetic_synced, synthetic_skipped

def create_version_manifest(version, files_info, uploaded_files, url, key):
    """버전별 매니페스트 생성"""
    manifest = {
        'version': version,
        'created_at': datetime.now().isoformat(),
        'files': {},
        'common_files': {},
        'unique_files': {},
        'synthetic_files': {}
    }
    
    for relative_path, file_info in files_info.items():
        if relative_path in uploaded_files:
            upload_info = uploaded_files[relative_path]
            manifest['files'][relative_path] = {
                'storage_path': upload_info['storage_path'],
                'hash': upload_info['hash'],
                'type': upload_info['type']
            }
            
            if upload_info['type'] == 'common':
                manifest['common_files'][relative_path] = upload_info['storage_path']
            else:
                manifest['unique_files'][relative_path] = upload_info['storage_path']
            
            # synthetic 경로도 매니페스트에 추가
            filename = os.path.basename(relative_path)
            
            # 파일명에서 엘리먼트 ID 또는 부품 ID 추출
            if '_' in filename:
                element_id = filename.split('_')[0]
            else:
                parts = relative_path.split('/')
                if len(parts) >= 2:
                    element_id = parts[0]
                else:
                    continue
            
            # 엘리먼트 ID 판별 (숫자로만 구성되고 6-7자리)
            is_element_id = element_id.isdigit() and len(element_id) >= 6
            
            if is_element_id:
                # 엘리먼트 ID: synthetic/{element_id}/{filename}
                synthetic_path = f"synthetic/{element_id}/{filename}"
            else:
                # 부품 ID: synthetic/{part_id}/{filename}
                synthetic_path = f"synthetic/{element_id}/{filename}"
            
            manifest['synthetic_files'][relative_path] = synthetic_path
    
    # 매니페스트를 Storage에 저장
    manifest_json = json.dumps(manifest, indent=2, ensure_ascii=False)
    manifest_path = f"manifests/v{version}/manifest.json"
    
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json'
    }
    
    response = requests.post(
        f"{url}/storage/v1/object/lego-synthetic/{manifest_path}",
        headers=headers,
        data=manifest_json.encode('utf-8')
    )
    
    if response.status_code in [200, 201]:
        print(f"[MANIFEST] v{version} 매니페스트 생성 완료")
        return True
    else:
        print(f"[ERROR] v{version} 매니페스트 생성 실패: {response.status_code}")
        return False

def main():
    """메인 함수"""
    print("[INFO] 최적화된 데이터셋 Storage 동기화 시작")
    
    # Supabase 설정 확인
    url, key = get_supabase_config()
    if not url or not key:
        return 1
    
    # output/synthetic 폴더 스캔
    synthetic_path = Path('output/synthetic')
    if not synthetic_path.exists():
        print(f"[ERROR] synthetic 폴더가 존재하지 않습니다: {synthetic_path}")
        return 1
    
    print(f"[SCAN] synthetic 폴더 스캔 중: {synthetic_path}")
    all_files = scan_synthetic_folder(synthetic_path)
    print(f"[SCAN] synthetic 폴더: {len(all_files)}개 파일")
    
    if not all_files:
        print("[WARNING] 업로드할 파일이 없습니다.")
        return 1
    
    # 파일 인덱스 생성 및 공통 파일 업로드
    uploaded_files, common_files = create_file_index(all_files, url, key)
    
    print(f"[INFO] 공통 파일: {len(common_files)}개")
    print(f"[INFO] 업로드된 파일: {len(uploaded_files)}개")
    
    # synthetic 폴더 동기화
    synthetic_synced, synthetic_skipped = sync_to_synthetic_folder(all_files, uploaded_files, url, key)
    
    # 매니페스트 생성은 생략 (synthetic 폴더는 단순 동기화)
    
    print("[INFO] 최적화된 Storage 동기화 완료!")
    print(f"[INFO] 공통 파일로 {len(common_files)}개 중복 제거")
    print(f"[INFO] synthetic 폴더 동기화: {synthetic_synced}개 성공, {synthetic_skipped}개 건너뜀")
    
    return 0

if __name__ == '__main__':
    sys.exit(main())

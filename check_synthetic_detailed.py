#!/usr/bin/env python3
import os
import sys
import requests
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# 통합 환경변수 관리 시스템 사용
try:
    from scripts.env_integration import get_supabase_config, apply_environment
    apply_environment()
    supabase_config = get_supabase_config()
    url = supabase_config['url']
    key = supabase_config['service_role']
    print("통합 환경변수 관리 시스템을 사용합니다.")
except ImportError:
    # 폴백: 기존 방식
    print("통합 환경변수 관리 시스템을 사용할 수 없습니다. 기본 방식을 사용합니다.")
    url = 'https://npferbxuxocbfnfbpcnz.supabase.co'
    key = os.getenv('SUPABASE_SERVICE_ROLE')

print(f"URL: {url}")
print(f"Key: {key[:20]}..." if key else "Key: None")

# lego-synthetic 버킷의 루트 확인
print("\n=== lego-synthetic 버킷 루트 ===")
response = requests.get(f'{url}/storage/v1/object/list/lego-synthetic', 
                       headers={'apikey': key, 'Authorization': f'Bearer {key}'})

print(f"Response Status: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    print(f'루트 폴더 파일/폴더 수: {len(data)}')
    for item in data:
        print(f'- {item["name"]} (type: {item.get("metadata", {}).get("mimetype", "folder")})')
else:
    print(f'오류: {response.status_code} - {response.text}')

# synthetic 폴더 확인
print("\n=== synthetic 폴더 ===")
response = requests.get(f'{url}/storage/v1/object/list/lego-synthetic', 
                       headers={'apikey': key, 'Authorization': f'Bearer {key}'},
                       params={'prefix': 'synthetic/'})

print(f"Response Status: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    print(f'Synthetic 폴더 파일 수: {len(data)}')
    for item in data[:20]:  # 처음 20개만 출력
        print(f'- {item["name"]}')
else:
    print(f'오류: {response.status_code} - {response.text}')

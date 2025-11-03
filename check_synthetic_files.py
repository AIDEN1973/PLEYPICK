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

# synthetic 폴더의 실제 파일 수 확인
response = requests.get(f'{url}/storage/v1/object/list/lego-synthetic', 
                       headers={'apikey': key, 'Authorization': f'Bearer {key}'},
                       params={'prefix': 'synthetic/6211342/'})

if response.status_code == 200:
    data = response.json()
    print(f'6211342 폴더 파일 수: {len(data)}')
    webp_files = [f for f in data if f['name'].endswith('.webp')]
    print(f'WebP 파일 수: {len(webp_files)}')
    if webp_files:
        print('WebP 파일 예시:')
        for f in webp_files[:5]:
            print(f'  - {f["name"]}')
else:
    print(f'오류: {response.status_code}')
    print(response.text)

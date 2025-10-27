#!/usr/bin/env python3
import os
import requests

# Supabase 설정
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

#!/usr/bin/env python3
import os
import requests

# Supabase 설정
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

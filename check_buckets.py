#!/usr/bin/env python3
import os
import requests

# Supabase 설정
url = 'https://npferbxuxocbfnfbpcnz.supabase.co'
key = os.getenv('SUPABASE_SERVICE_ROLE')

print(f"URL: {url}")
print(f"Key: {key[:20]}..." if key else "Key: None")

# 모든 버킷 확인
response = requests.get(f'{url}/storage/v1/bucket', 
                       headers={'apikey': key, 'Authorization': f'Bearer {key}'})

print(f"Response Status: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    print(f'총 버킷 수: {len(data)}')
    for bucket in data:
        print(f'- {bucket["name"]} (public: {bucket.get("public", False)})')
else:
    print(f'오류: {response.status_code} - {response.text}')

#!/usr/bin/env python3
"""Upload missing JSON files to Supabase"""

import os
import sys
import glob
import json
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
    from dotenv import load_dotenv
    load_dotenv()
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_KEY')

# Supabase 클라이언트 생성
from supabase import create_client

if not url or not key:
    print("[ERROR] Supabase credentials missing")
    exit(1)

supabase = create_client(url, key)
print("[OK] Supabase client created")

# Find all JSON files in output/synthetic
json_files = glob.glob("output/synthetic/**/*.json", recursive=True)
print(f"\n[FOUND] {len(json_files)} JSON files")

success_count = 0
error_count = 0

for json_file in json_files:
    # Convert local path to Supabase path
    # output/synthetic/4583789/4583789_001.json -> synthetic/4583789/4583789_001.json
    rel_path = os.path.relpath(json_file, "output")
    rel_path = rel_path.replace("\\", "/")  # Windows path fix
    
    print(f"\n[UPLOAD] {rel_path}")
    
    try:
        # Read JSON file
        with open(json_file, 'rb') as f:
            file_bytes = f.read()
        
        # Upload to Supabase
        result = supabase.storage.from_('lego-synthetic').upload(
            rel_path,
            file_bytes,
            file_options={
                "content-type": "application/json",
                "upsert": "true",
                "cache-control": "public, max-age=31536000"
            }
        )
        
        if hasattr(result, 'error') and result.error:
            print(f"  [ERROR] {result.error}")
            error_count += 1
        else:
            print(f"  [OK] Uploaded")
            success_count += 1
            
    except Exception as e:
        print(f"  [ERROR] {e}")
        error_count += 1

print(f"\n[SUMMARY]")
print(f"  Success: {success_count}")
print(f"  Error: {error_count}")
print(f"  Total: {len(json_files)}")


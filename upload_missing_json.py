#!/usr/bin/env python3
"""Upload missing JSON files to Supabase"""

from supabase import create_client
from dotenv import load_dotenv
import os
import glob
import json

# Load environment variables
load_dotenv()

# Create Supabase client
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_KEY')

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


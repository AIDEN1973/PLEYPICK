#!/usr/bin/env python3
"""Supabase JSON Upload Test Script"""

from supabase import create_client
from dotenv import load_dotenv
import os
import json

# Load environment variables
load_dotenv()

# Create Supabase client
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_KEY')

print(f"SUPABASE_URL: {'SET' if url else 'NOT SET'}")
print(f"SUPABASE_KEY: {'SET' if key else 'NOT SET'}")

if not url or not key:
    print("\n[ERROR] Supabase connection info missing!")
    print("   Check SUPABASE_URL and SUPABASE_KEY in .env file")
    exit(1)

print(f"\n[CONNECT] Connecting to Supabase...")
print(f"   URL: {url[:50]}...")
print(f"   KEY: {key[:20]}...")

try:
    supabase = create_client(url, key)
    print("[OK] Supabase client created successfully")
except Exception as e:
    print(f"[ERROR] Supabase client creation failed: {e}")
    exit(1)

# Check buckets
try:
    print("\n[CHECK] Checking buckets...")
    buckets = supabase.storage.list_buckets()
    bucket_names = [b.name for b in buckets] if buckets else []
    print(f"   Available buckets: {bucket_names}")
    
    if 'lego-synthetic' in bucket_names:
        print("   [OK] lego-synthetic bucket found")
    else:
        print("   [ERROR] lego-synthetic bucket not found")
        exit(1)
except Exception as e:
    print(f"[ERROR] Bucket check failed: {e}")
    exit(1)

# Create test JSON file
test_json = {
    "test": "data",
    "timestamp": "2025-01-01T00:00:00Z",
    "message": "JSON upload test"
}

test_json_bytes = json.dumps(test_json, ensure_ascii=False, indent=2).encode('utf-8')
test_path = "synthetic/test/test_upload.json"

print(f"\n[UPLOAD] Testing JSON file upload...")
print(f"   Path: {test_path}")
print(f"   Size: {len(test_json_bytes)} bytes")

try:
    result = supabase.storage.from_('lego-synthetic').upload(
        test_path,
        test_json_bytes,
        file_options={
            "content-type": "application/json",
            "upsert": "true",
            "cache-control": "public, max-age=31536000"
        }
    )
    
    if hasattr(result, 'error') and result.error:
        print(f"[ERROR] Upload failed: {result.error}")
        exit(1)
    else:
        print("[OK] JSON file uploaded successfully!")
        print(f"   Result: {result}")
except Exception as e:
    print(f"[ERROR] Upload exception: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

# Check uploaded files
print(f"\n[CHECK] Checking uploaded files...")
try:
    files = supabase.storage.from_('lego-synthetic').list('synthetic/test')
    print(f"   File count: {len(files)}")
    for file in files:
        print(f"   - {file['name']}")
    print("\n[OK] All tests passed!")
except Exception as e:
    print(f"[ERROR] File check failed: {e}")


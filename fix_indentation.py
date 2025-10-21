#!/usr/bin/env python3
"""들여쓰기 문제를 자동으로 수정하는 스크립트"""

import re

# 문제가 되는 부분을 완전히 다시 작성
fixed_code = '''
                # Supabase upload attempt (재시도 로직 포함)
                print(f"[CHECK] E2 JSON Supabase client status: {'[OK] CONNECTED' if self.supabase else '[ERROR] NOT CONNECTED'}")
                
                if self.supabase:
                    print("[OK] E2 JSON Supabase upload starting")
                    try:
                        e2_json_bytes = json.dumps(e2_metadata, ensure_ascii=False, indent=2).encode('utf-8')
                        e2_json_path_supabase = f"synthetic/{element_id}/{e2_json_filename}"
                        
                        # 재시도 로직 (최대 5회로 증가)
                        max_retries = 5
                        retry_delay = 1  # 초
                        e2_upload_success = False
                        
                        for attempt in range(max_retries):
                            try:
                                print(f"E2 JSON upload attempt {attempt + 1}/{max_retries}: {e2_json_path_supabase}")
                                print(f"   file size: {len(e2_json_bytes)} bytes")
                                print(f"   Supabase client status: {'OK' if self.supabase else 'NOT OK'}")
                                
                                # Supabase client status 확인
                                if not self.supabase:
                                    print("[ERROR] Supabase client not initialized")
                                    print("[WARNING] Skipping E2 JSON upload")
                                    break
                                
                                # Supabase 클라이언트 재초기화 시도
                                if attempt > 0:
                                    print(f"[RETRY] Reinitializing Supabase client attempt {attempt}")
                                    try:
                                        from supabase import create_client, Client
                                        from dotenv import load_dotenv
                                        import os
                                        
                                        load_dotenv()
                                        url = os.getenv("SUPABASE_URL")
                                        key = os.getenv("SUPABASE_KEY")
                                        
                                        if url and key:
                                            self.supabase = create_client(url, key)
                                            print("[OK] Supabase client reinitialized")
                                        else:
                                            print("[ERROR] Supabase env vars missing")
                                            break
                                    except Exception as reinit_error:
                                        print(f"[ERROR] Supabase client reinit failed: {reinit_error}")
                                        break
                                
                                result = self.supabase.storage.from_('lego-synthetic').upload(
                                    e2_json_path_supabase,
                                    e2_json_bytes,
                                    file_options={
                                        "content-type": "application/json",
                                        "upsert": "true",
                                        "cache-control": "public, max-age=31536000"
                                    }
                                )
                                
                                if hasattr(result, 'error') and result.error:
                                    print(f"[ERROR] E2 JSON upload failed (attempt {attempt + 1}): {result.error}")
                                    if attempt < max_retries - 1:
                                        print(f"[WAIT] Retrying in {retry_delay} seconds...")
                                        import time
                                        time.sleep(retry_delay)
                                        retry_delay *= 2
                                        continue
                                    else:
                                        print(f"[ERROR] Max retries exceeded")
                                        break
                                else:
                                    print(f"E2 JSON upload completed: {e2_json_path_supabase}")
                                    e2_upload_success = True
                                    break
                                    
                            except Exception as e:
                                print(f"[ERROR] E2 JSON upload exception (attempt {attempt + 1}): {e}")
                                if attempt < max_retries - 1:
                                    print(f"[WAIT] Retrying in {retry_delay} seconds...")
                                    import time
                                    time.sleep(retry_delay)
                                    retry_delay *= 2
                                    continue
                                else:
                                    print(f"[ERROR] Max retries exceeded: {e}")
                                    break
                        
                        if not e2_upload_success:
                            print("[ERROR] E2 JSON upload final failure")
                            print("[WARNING] Continuing process despite upload failure")
                            
                    except Exception as upload_error:
                        print(f"E2 JSON Supabase upload exception: {upload_error}")
                else:
                    print("[WARNING] Supabase not connected - E2 JSON saved locally only")
'''

print("Fixed code block:")
print(fixed_code)
print("\n\nCopy this code and replace lines 3110-3220 in render_ldraw_to_supabase.py")


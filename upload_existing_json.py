#!/usr/bin/env python3
"""기존 JSON 파일들을 Supabase에 업로드"""

import os
import json
import glob
from dotenv import load_dotenv
from supabase import create_client, Client

# .env 파일 로드
load_dotenv()

def upload_json_files():
    """기존 JSON 파일들을 Supabase에 업로드"""
    try:
        # Supabase 클라이언트 생성
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        
        if not url or not key:
            print("[ERROR] Supabase 환경변수가 설정되지 않음")
            return False
            
        supabase: Client = create_client(url, key)
        print("[OK] Supabase 클라이언트 생성 성공")
        
        # JSON 파일 찾기
        json_files = glob.glob("output/synthetic/4583789/*.json")
        print(f"[INFO] 발견된 JSON 파일: {len(json_files)}개")
        
        uploaded_count = 0
        failed_count = 0
        
        for json_file in json_files:
            try:
                # 파일명에서 element_id 추출
                filename = os.path.basename(json_file)
                element_id = "4583789"  # 하드코딩
                
                # 파일 읽기
                with open(json_file, 'r', encoding='utf-8') as f:
                    json_data = json.load(f)
                
                # JSON을 바이트로 변환
                json_bytes = json.dumps(json_data, ensure_ascii=False, indent=2).encode('utf-8')
                
                # 업로드 경로
                upload_path = f"synthetic/{element_id}/{filename}"
                
                print(f"[UPLOAD] {filename} 업로드 시도...")
                print(f"   크기: {len(json_bytes)} bytes")
                print(f"   경로: {upload_path}")
                
                # Supabase 업로드
                result = supabase.storage.from_('lego-synthetic').upload(
                    upload_path,
                    json_bytes,
                    file_options={
                        "content-type": "application/json",
                        "upsert": "true",
                        "cache-control": "public, max-age=31536000"
                    }
                )
                
                if hasattr(result, 'error') and result.error:
                    print(f"[ERROR] {filename} 업로드 실패: {result.error}")
                    failed_count += 1
                else:
                    print(f"[OK] {filename} 업로드 성공")
                    uploaded_count += 1
                    
            except Exception as e:
                print(f"[ERROR] {json_file} 처리 중 오류: {e}")
                failed_count += 1
        
        print(f"\n=== 업로드 결과 ===")
        print(f"성공: {uploaded_count}개")
        print(f"실패: {failed_count}개")
        print(f"총 파일: {len(json_files)}개")
        
        return uploaded_count > 0
        
    except Exception as e:
        print(f"[ERROR] 업로드 프로세스 오류: {e}")
        return False

def main():
    """메인 함수"""
    print("=== 기존 JSON 파일 Supabase 업로드 ===")
    
    success = upload_json_files()
    
    if success:
        print("\n[SUCCESS] JSON 파일 업로드 완료")
    else:
        print("\n[FAILURE] JSON 파일 업로드 실패")

if __name__ == "__main__":
    main()

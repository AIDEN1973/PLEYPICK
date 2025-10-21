#!/usr/bin/env python3
"""JSON 업로드 디버깅 테스트"""

import os
import json
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

def test_supabase_connection():
    """Supabase 연결 테스트"""
    try:
        from supabase import create_client, Client
        
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        
        print(f"[CHECK] SUPABASE_URL: {'SET' if url else 'NOT SET'}")
        print(f"[CHECK] SUPABASE_KEY: {'SET' if key else 'NOT SET'}")
        
        if not url or not key:
            print("[ERROR] Supabase 환경변수가 설정되지 않음")
            return None
            
        supabase: Client = create_client(url, key)
        print("[OK] Supabase 클라이언트 생성 성공")
        
        # 버킷 리스트 확인
        try:
            buckets = supabase.storage.list_buckets()
            print(f"[OK] 버킷 리스트 조회 성공: {len(buckets)}개 버킷")
            for bucket in buckets:
                print(f"  - {bucket.name}")
        except Exception as e:
            print(f"[ERROR] 버킷 리스트 조회 실패: {e}")
            
        return supabase
        
    except Exception as e:
        print(f"[ERROR] Supabase 연결 실패: {e}")
        return None

def test_json_upload():
    """JSON 파일 업로드 테스트"""
    supabase = test_supabase_connection()
    if not supabase:
        print("[ERROR] Supabase 연결 실패로 테스트 중단")
        return False
    
    # 테스트용 JSON 데이터
    test_data = {
        "schema_version": "1.6.1-E2",
        "pair_uid": "test-uuid-12345",
        "part_id": "12345",
        "annotation": {
            "bbox_pixel_xyxy": [100, 100, 200, 200],
            "bbox_norm_xyxy": [0.1, 0.1, 0.2, 0.2],
            "segmentation": {
                "rle_base64": "test_data",
                "compressed_size": 100
            }
        },
        "qa": {
            "qa_flag": True,
            "reprojection_rms_px": 1.0
        },
        "perf": {
            "avg_confidence": 0.95,
            "avg_inference_time_ms": 5.0
        },
        "integrity": {
            "validated_at": "2025-01-20T12:00:00Z"
        }
    }
    
    try:
        # JSON을 바이트로 변환
        json_bytes = json.dumps(test_data, ensure_ascii=False, indent=2).encode('utf-8')
        print(f"[INFO] 테스트 JSON 크기: {len(json_bytes)} bytes")
        
        # 업로드 경로
        upload_path = "synthetic/test_element/test_e2.json"
        
        print(f"[UPLOAD] JSON 업로드 시도: {upload_path}")
        
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
            print(f"[ERROR] JSON 업로드 실패: {result.error}")
            return False
        else:
            print(f"[OK] JSON 업로드 성공: {upload_path}")
            return True
            
    except Exception as e:
        print(f"[ERROR] JSON 업로드 예외: {e}")
        return False

def main():
    """메인 테스트 함수"""
    print("=== JSON 업로드 디버깅 테스트 ===")
    
    # 1. Supabase 연결 테스트
    print("\n1. Supabase 연결 테스트")
    supabase = test_supabase_connection()
    
    if not supabase:
        print("\n[FAILURE] Supabase 연결 실패")
        return
    
    # 2. JSON 업로드 테스트
    print("\n2. JSON 업로드 테스트")
    success = test_json_upload()
    
    if success:
        print("\n[SUCCESS] JSON 업로드 테스트 성공")
    else:
        print("\n[FAILURE] JSON 업로드 테스트 실패")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
qa_logs 테이블 최종 수정 실행 스크립트
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client

def main():
    load_dotenv()
    
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        print("Supabase 환경 변수가 설정되지 않았습니다.")
        sys.exit(1)
    
    supabase = create_client(supabase_url, supabase_key)
    
    # SQL 명령어들
    sql_commands = [
        "ALTER TABLE qa_logs ADD COLUMN IF NOT EXISTS ssim DECIMAL(5,4);",
        "ALTER TABLE qa_logs ADD COLUMN IF NOT EXISTS snr DECIMAL(6,2);",
        "ALTER TABLE qa_logs ADD COLUMN IF NOT EXISTS element_id VARCHAR(255);",
        "ALTER TABLE qa_logs ADD COLUMN IF NOT EXISTS status VARCHAR(50);",
        "ALTER TABLE qa_logs ADD COLUMN IF NOT EXISTS reprojection_error DECIMAL(8,4);",
        "ALTER TABLE qa_logs ADD COLUMN IF NOT EXISTS processing_time INTEGER;",
        "UPDATE qa_logs SET ssim = ssim_score WHERE ssim IS NULL AND ssim_score IS NOT NULL;",
        "UPDATE qa_logs SET snr = snr_db WHERE snr IS NULL AND snr_db IS NOT NULL;",
        "UPDATE qa_logs SET status = qa_status WHERE status IS NULL AND qa_status IS NOT NULL;",
        "UPDATE qa_logs SET reprojection_error = reprojection_error_rms_px WHERE reprojection_error IS NULL AND reprojection_error_rms_px IS NOT NULL;",
        "UPDATE qa_logs SET processing_time = processing_time_ms WHERE processing_time IS NULL AND processing_time_ms IS NOT NULL;",
        "CREATE INDEX IF NOT EXISTS idx_qa_logs_ssim ON qa_logs(ssim);",
        "CREATE INDEX IF NOT EXISTS idx_qa_logs_snr ON qa_logs(snr);",
        "CREATE INDEX IF NOT EXISTS idx_qa_logs_element_id ON qa_logs(element_id);",
        "CREATE INDEX IF NOT EXISTS idx_qa_logs_status ON qa_logs(status);",
        "CREATE INDEX IF NOT EXISTS idx_qa_logs_reprojection_error ON qa_logs(reprojection_error);",
        "CREATE INDEX IF NOT EXISTS idx_qa_logs_processing_time ON qa_logs(processing_time);"
    ]
    
    print("qa_logs 테이블 최종 수정 시작...")
    
    success_count = 0
    for i, sql in enumerate(sql_commands, 1):
        try:
            result = supabase.rpc('exec_sql', {'sql': sql})
            print(f"성공 {i}/{len(sql_commands)}: {sql[:50]}...")
            success_count += 1
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                print(f"이미 존재 {i}/{len(sql_commands)}: {sql[:50]}...")
                success_count += 1
            else:
                print(f"실패 {i}/{len(sql_commands)}: {sql[:50]}... - {e}")
    
    print(f"\nqa_logs 수정 완료! ({success_count}/{len(sql_commands)} 성공)")
    
    # 테이블 구조 확인
    try:
        result = supabase.rpc('exec_sql', {
            'sql': "SELECT column_name FROM information_schema.columns WHERE table_name = 'qa_logs' ORDER BY column_name;"
        })
        print("\nqa_logs 테이블 컬럼 목록:")
        if result and hasattr(result, 'data'):
            for col in result.data:
                print(f"  - {col['column_name']}")
    except Exception as e:
        print(f"컬럼 목록 조회 실패: {e}")

if __name__ == "__main__":
    main()

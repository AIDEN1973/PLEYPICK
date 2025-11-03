#!/usr/bin/env python3
"""
기존 JSON 파일에 part_name 필드 추가
"""

import json
import os
import sys
from pathlib import Path

def get_part_name_from_db(part_id):
    """데이터베이스에서 부품 이름 조회"""
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        
        # 환경 변수에서 DB 연결 정보 가져오기
        import os
        from dotenv import load_dotenv
        load_dotenv()
        
        # Supabase 연결 정보
        supabase_url = os.getenv('VITE_SUPABASE_URL')
        if not supabase_url:
            print("[ERROR] VITE_SUPABASE_URL not found")
            return None
            
        # Supabase URL에서 호스트, 포트, 데이터베이스 정보 추출
        # 예: https://xxx.supabase.co -> xxx.supabase.co
        host = supabase_url.replace('https://', '').replace('http://', '')
        
        # 환경 변수에서 직접 DB 정보 가져오기 (실제 구현에서는 적절한 방법 사용)
        conn = psycopg2.connect(
            host=host,
            database="postgres",
            user="postgres",
            password=os.getenv('SUPABASE_DB_PASSWORD', ''),
            port=5432
        )
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT name FROM lego_parts WHERE part_num = %s", (part_id,))
            result = cur.fetchone()
            return result['name'] if result else None
            
    except Exception as e:
        print(f"[ERROR] DB 조회 오류: {e}")
        return None

def fix_json_file(json_path):
    """JSON 파일에 part_name 필드 추가"""
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 이미 part_name이 있으면 스킵
        if 'part_name' in data:
            return False
            
        part_id = data.get('part_id')
        if not part_id:
            print(f"[WARNING] {json_path}: part_id 없음")
            return False
            
        # 데이터베이스에서 부품 이름 조회
        part_name = get_part_name_from_db(part_id)
        if not part_name:
            print(f"[WARNING] {json_path}: 부품 이름을 찾을 수 없음 (part_id: {part_id})")
            return False
            
        # part_name 필드 추가
        data['part_name'] = part_name
        
        # 파일 저장
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        print(f"✅ {json_path}: part_name 추가됨 ({part_name})")
        return True
        
    except Exception as e:
        print(f"[ERROR] {json_path} 처리 오류: {e}")
        return False

def main():
    """메인 함수"""
    synthetic_dir = Path("output/synthetic")
    
    if not synthetic_dir.exists():
        print("[ERROR] output/synthetic 디렉토리가 존재하지 않습니다")
        return
        
    print("[FIX] JSON 파일에 part_name 필드 추가 시작...")
    
    fixed_count = 0
    total_count = 0
    
    # 각 부품 폴더 처리
    for part_dir in synthetic_dir.iterdir():
        if not part_dir.is_dir():
            continue
            
        print(f"[DIR] 부품 폴더 처리: {part_dir.name}")
        
        # JSON 파일 찾기
        for json_file in part_dir.glob("*.json"):
            if json_file.name.endswith('_e2.json'):
                continue  # E2 JSON은 스킵
                
            total_count += 1
            if fix_json_file(json_file):
                fixed_count += 1
                
    print(f"[SUCCESS] 완료! 총 {total_count}개 파일 중 {fixed_count}개 파일 수정됨")

if __name__ == "__main__":
    main()

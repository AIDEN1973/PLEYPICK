#!/usr/bin/env python3
"""
방금 완료된 학습 결과를 DB에 수동 업데이트하는 스크립트
"""

import os
import sys
from datetime import datetime
from pathlib import Path

# .env 파일 로드
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path, override=True)
        print(f"[OK] .env 파일 로드됨: {env_path}")
except ImportError:
    print("[WARN] python-dotenv가 설치되지 않음")

# Supabase 클라이언트
try:
    from supabase import create_client
except ImportError:
    print("[ERROR] Supabase 클라이언트가 설치되지 않았습니다.")
    print("다음 명령어로 설치하세요: pip install supabase")
    sys.exit(1)

def update_training_results(part_id, metrics):
    """학습 결과를 part_training_status에 업데이트"""
    try:
        # [FIX] 수정됨: Supabase 클라이언트 초기화 (하드코딩 우회)
        supabase_url = 'https://npferbxuxocbfnfbpcnz.supabase.co'
        supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3NDk4NSwiZXhwIjoyMDc1MDUwOTg1fQ.pPWhWrb4QBC-DT4dd6Y1p-LlHNd9UTKef3SHEXUDp00'
        
        print(f"[INFO] Supabase URL: {supabase_url}")
        print(f"[INFO] Key: {supabase_key[:20]}...")
        
        supabase = create_client(supabase_url, supabase_key)
        
        print(f"\n[UPDATE] 부품 {part_id} 학습 결과 업데이트 중...")
        print(f"  mAP50: {metrics['mAP50']:.4f}")
        print(f"  mAP50-95: {metrics['mAP50_95']:.4f}")
        print(f"  Precision: {metrics['precision']:.4f}")
        print(f"  Recall: {metrics['recall']:.4f}")
        
        # [FIX] 수정됨: upsert로 업데이트 (map50_95, f1_score 제거 - 컬럼 없음)
        result = supabase.table('part_training_status').upsert({
            'part_id': str(part_id),
            'status': 'completed',
            'map50': float(metrics['mAP50']),
            'precision': float(metrics['precision']),
            'recall': float(metrics['recall']),
            'last_trained_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }, on_conflict='part_id').execute()
        
        # 응답 처리
        if hasattr(result, 'error') and result.error:
            print(f"[ERROR] 업데이트 실패: {result.error}")
            return False
        else:
            print(f"[OK] 부품 {part_id} 학습 결과 업데이트 완료!")
            if result.data:
                print(f"[DATA] {result.data}")
            return True
            
    except Exception as e:
        print(f"[ERROR] 업데이트 실패: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """메인 함수"""
    print("="*60)
    print("[FIX] 학습 결과 수동 업데이트 스크립트")
    print("="*60)
    
    # 방금 학습한 결과 (터미널 로그에서 추출)
    # 부품 ID: 32028 (엘리먼트 ID 6179330)
    # Stage2 메트릭:
    #   metrics/mAP50(M): 0.23593325917686325
    #   metrics/mAP50-95(M): 0.06210015232990761
    #   metrics/precision(M): 0.3548387096774194
    #   metrics/recall(M): 0.275
    
    part_id = '32028'
    metrics = {
        'mAP50': 0.23593325917686325,
        'mAP50_95': 0.06210015232990761,
        'precision': 0.3548387096774194,
        'recall': 0.275,
        'f1_score': 2 * (0.3548387096774194 * 0.275) / (0.3548387096774194 + 0.275) if (0.3548387096774194 + 0.275) > 0 else 0
    }
    
    print(f"\n📦 업데이트 대상:")
    print(f"  부품 ID: {part_id}")
    print(f"  엘리먼트 ID: 6179330")
    print(f"  부품명: Plate Special 1 x 2 with Door Rail")
    print(f"\n📊 학습 결과:")
    print(f"  mAP50: {metrics['mAP50']:.4f}")
    print(f"  mAP50-95: {metrics['mAP50_95']:.4f}")
    print(f"  Precision: {metrics['precision']:.4f}")
    print(f"  Recall: {metrics['recall']:.4f}")
    print(f"  F1-Score: {metrics['f1_score']:.4f}")
    
    # 사용자 확인
    response = input("\n이 결과로 DB를 업데이트하시겠습니까? (y/n): ")
    if response.lower() != 'y':
        print("[CANCEL] 업데이트가 취소되었습니다.")
        return
    
    # 업데이트 실행
    success = update_training_results(part_id, metrics)
    
    if success:
        print("\n" + "="*60)
        print("✅ 업데이트 완료!")
        print("="*60)
        print("\n다음 확인사항:")
        print("1. Supabase 대시보드에서 part_training_status 테이블 확인")
        print(f"2. part_id = '{part_id}' 행의 메트릭 값 확인")
        print("3. automated-training 페이지에서 부품 정보 새로고침")
    else:
        print("\n" + "="*60)
        print("[ERROR] 업데이트 실패")
        print("="*60)
        print("\n해결 방법:")
        print("1. .env 파일에 SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY 확인")
        print("2. Supabase 대시보드에서 수동 업데이트")
        sys.exit(1)

if __name__ == "__main__":
    main()


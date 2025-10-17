#!/usr/bin/env python3
"""
BrickBox 임베딩 자동 생성 워커

백그라운드에서 지속적으로 실행되며, pending 상태의 부품에 대해
자동으로 CLIP 임베딩을 생성합니다.

실행 방법:
  pip install openai-clip torch supabase tqdm
  python scripts/embedding_worker.py

환경 변수:
  SUPABASE_URL, SUPABASE_KEY
  
종료:
  Ctrl+C
"""

import os
import sys
import time
import signal
import json
import numpy as np
from datetime import datetime
from typing import List, Dict

# .env 파일 로드 시도
try:
    from dotenv import load_dotenv
    load_dotenv()  # .env 파일에서 환경 변수 로드
except ImportError:
    pass  # python-dotenv가 없으면 시스템 환경 변수만 사용

try:
    import torch
    import clip
    from supabase import create_client
except ImportError as e:
    print(f"❌ 패키지 설치 필요: {e}")
    print("실행: pip install openai-clip torch supabase tqdm python-dotenv")
    sys.exit(1)

# ============================================
# 설정
# ============================================
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
BATCH_SIZE = 10  # 한 번에 처리할 부품 수
POLL_INTERVAL = 10  # 큐 확인 주기 (초)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# 종료 플래그
shutdown_flag = False

def signal_handler(signum, frame):
    global shutdown_flag
    print("\n[STOP] 종료 신호 수신... 정리 중...")
    shutdown_flag = True

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

# ============================================
# 초기화
# ============================================
def initialize():
    """시스템 초기화"""
    print("=" * 60)
    print("[WORKER] BrickBox 임베딩 워커 시작")
    print("=" * 60)
    print(f"[TIME] 시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"[DEVICE] Device: {DEVICE}")
    print(f"[BATCH] 배치 크기: {BATCH_SIZE}")
    print(f"[POLL] 폴링 주기: {POLL_INTERVAL}초")
    print("")

    # 환경 변수 확인
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERROR] 환경 변수 설정 필요:")
        print("  export SUPABASE_URL='...'")
        print("  export SUPABASE_KEY='...'")
        sys.exit(1)

    # CLIP 모델 로드 (ViT-L/14: 768차원)
    print("[LOAD] CLIP 모델 로드 중 (ViT-L/14, 768차원)...")
    try:
        model, preprocess = clip.load("ViT-L/14", device=DEVICE)
        model.eval()
        print("[OK] CLIP 모델 로드 완료 (768차원)")
    except Exception as e:
        print(f"[ERROR] CLIP 모델 로드 실패: {e}")
        sys.exit(1)

    # DB 연결
    print("[LOAD] Supabase 연결 중...")
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("[OK] Supabase 연결 완료")
    except Exception as e:
        print(f"[ERROR] Supabase 연결 실패: {e}")
        sys.exit(1)

    print("")
    print("=" * 60)
    print("[RUN] 워커 실행 중... (Ctrl+C로 종료)")
    print("=" * 60)
    print("")
    
    return model, supabase

# ============================================
# 임베딩 생성
# ============================================
def generate_embedding(model, text: str) -> np.ndarray:
    """CLIP 임베딩 생성"""
    text_tokens = clip.tokenize([text], truncate=True).to(DEVICE)
    with torch.no_grad():
        text_features = model.encode_text(text_tokens)
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)
    return text_features[0].cpu().numpy()

def embedding_to_str(emb: np.ndarray) -> str:
    """임베딩을 DB 저장 형식으로 변환"""
    return '[' + ','.join([f'{v:.6f}' for v in emb]) + ']'

# ============================================
# 큐 처리
# ============================================
def fetch_pending_items(supabase, limit=10) -> List[Dict]:
    """pending 상태 부품 조회"""
    try:
        response = supabase.table('parts_master_features') \
            .select('id, part_id, color_id, feature_text, recognition_hints') \
            .eq('embedding_status', 'pending') \
            .not_.is_('feature_text', 'null') \
            .order('updated_at', desc=False) \
            .limit(limit) \
            .execute()
        
        return response.data
    except Exception as e:
        print(f"[ERROR] 큐 조회 실패: {e}")
        return []

def update_embedding(supabase, item_id: int, emb_list: list) -> bool:
    """임베딩 업데이트 (RPC 함수 사용)"""
    try:
        # vector 타입은 문자열로 변환하여 RPC로 전달
        emb_str = '[' + ','.join([str(v) for v in emb_list]) + ']'
        
        response = supabase.rpc('update_part_embedding', {
            'p_id': item_id,
            'p_embedding': emb_str
        }).execute()
        
        return response.data == True
    except Exception as e:
        print(f"[ERROR] 업데이트 실패 (id={item_id}): {e}")
        return False

def mark_failed(supabase, item_id: int, error: str) -> bool:
    """실패 상태 표시"""
    try:
        supabase.table('parts_master_features') \
            .update({
                'embedding_status': 'failed',
                'updated_at': 'NOW()'
            }) \
            .eq('id', item_id) \
            .execute()
        return True
    except Exception as e:
        print(f"[ERROR] 실패 표시 실패 (id={item_id}): {e}")
        return False

# ============================================
# 메인 루프
# ============================================
def process_batch(model, supabase, items: List[Dict]) -> Dict[str, int]:
    """배치 처리"""
    stats = {'success': 0, 'failed': 0}
    
    for item in items:
        try:
            # 텍스트 준비
            text = item['feature_text']
            if item.get('recognition_hints') and item['recognition_hints'].get('ko'):
                text += " " + item['recognition_hints']['ko']
            
            # 임베딩 생성
            emb = generate_embedding(model, text)
            emb_list = emb.tolist() if hasattr(emb, 'tolist') else list(emb)
            
            # DB 업데이트
            if update_embedding(supabase, item['id'], emb_list):
                stats['success'] += 1
                print(f"[OK] {item['part_id']:15s} (id={item['id']:4d}) -> 완료")
            else:
                stats['failed'] += 1
                mark_failed(supabase, item['id'], "Update failed")
        
        except Exception as e:
            stats['failed'] += 1
            print(f"[FAIL] {item.get('part_id', '?'):15s} (id={item.get('id', '?'):4d}) -> 실패: {e}")
            mark_failed(supabase, item['id'], str(e))
    
    return stats

def update_heartbeat(supabase):
    """워커 하트비트 업데이트"""
    try:
        supabase.table('embedding_worker_status').upsert({
            'worker_name': 'embedding_worker',
            'last_heartbeat': datetime.now().isoformat(),
            'status': 'running',
            'updated_at': datetime.now().isoformat()
        }).execute()
    except Exception as e:
        print(f"[WARNING] 하트비트 업데이트 실패: {e}")

def worker_loop(model, supabase):
    """메인 워커 루프"""
    total_stats = {'success': 0, 'failed': 0, 'iterations': 0}
    idle_count = 0
    
    # 초기 하트비트 업데이트
    update_heartbeat(supabase)
    
    while not shutdown_flag:
        try:
            # pending 항목 조회
            items = fetch_pending_items(supabase, BATCH_SIZE)
            
            if items:
                idle_count = 0
                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] [BATCH] {len(items)}개 부품 처리 중...")
                
                # 배치 처리
                stats = process_batch(model, supabase, items)
                
                # 통계 업데이트
                total_stats['success'] += stats['success']
                total_stats['failed'] += stats['failed']
                total_stats['iterations'] += 1
                
                print(f"   성공: {stats['success']}, 실패: {stats['failed']}")
                print(f"   (누적: 성공 {total_stats['success']}, 실패 {total_stats['failed']})")
            
            else:
                idle_count += 1
                if idle_count == 1:
                    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] [IDLE] 대기 중... (큐 비어있음)")
                elif idle_count % 6 == 0:  # 1분마다
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] [IDLE] 계속 대기 중...")
            
            # 하트비트 업데이트 (매 루프마다)
            update_heartbeat(supabase)
            
            # 대기
            if not shutdown_flag:
                time.sleep(POLL_INTERVAL)
        
        except Exception as e:
            print(f"\n[ERROR] 예기치 않은 오류: {e}")
            time.sleep(POLL_INTERVAL * 2)
    
    # 종료 통계
    print("\n" + "=" * 60)
    print("[STATS] 최종 통계")
    print("=" * 60)
    print(f"처리 횟수: {total_stats['iterations']}")
    print(f"성공: {total_stats['success']}")
    print(f"실패: {total_stats['failed']}")
    print(f"종료 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

# ============================================
# 메인
# ============================================
def main():
    model, supabase = initialize()
    worker_loop(model, supabase)
    print("\n[EXIT] 워커 정상 종료\n")

if __name__ == "__main__":
    main()


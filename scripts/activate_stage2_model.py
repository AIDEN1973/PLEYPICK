#!/usr/bin/env python3
"""
Stage2 모델을 active로 업데이트하는 스크립트
"""
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from scripts.env_integration import get_supabase_config
from supabase import create_client

def activate_stage2_model():
    """Stage2 모델을 active 상태로 업데이트"""
    config = get_supabase_config()
    supabase = create_client(config['url'], config['service_role'])
    
    print("="*60)
    print("📝 Stage2 모델 활성화")
    print("="*60)
    
    # Stage2 모델 조회 (is_active는 True이지만 status가 inactive인 경우)
    result = supabase.table('model_registry').select('*').eq('model_stage', 'stage2').order('created_at', desc=True).limit(1).execute()
    
    if hasattr(result, 'error') and result.error:
        print(f"[ERROR] Stage2 모델 조회 실패: {result.error}")
        return False
    
    stage2_models = result.data if hasattr(result, 'data') and result.data else []
    
    if not stage2_models or len(stage2_models) == 0:
        print("[WARN] 활성화할 Stage2 모델이 없습니다.")
        return False
    
    # Stage2 모델 활성화
    for model in stage2_models:
        print(f"\n[UPDATE] 모델 활성화: {model['model_name']}")
        update_result = supabase.table('model_registry').update({
            'status': 'active',
            'is_active': True
        }).eq('id', model['id']).execute()
        
        if hasattr(update_result, 'error') and update_result.error:
            print(f"[ERROR] 모델 활성화 실패: {update_result.error}")
        else:
            print(f"[OK] 모델 활성화 성공: {model['model_name']}")
    
    print("\n" + "="*60)
    print("✅ Stage2 모델 활성화 완료")
    print("="*60)
    return True

if __name__ == '__main__':
    activate_stage2_model()


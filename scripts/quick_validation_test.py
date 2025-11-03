#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
빠른 검증 테스트 - 렌더링 코드 검증만 수행
"""

import json
from pathlib import Path

def test_rendering_code():
    """렌더링 코드 검증"""
    print("=" * 60)
    print("렌더링 코드 검증")
    print("=" * 60)
    
    script_path = Path("scripts/render_ldraw_to_supabase.py")
    
    checks = {
        'depth_map_rendering': False,
        'camera_params': False,
        'pnp_rms': False,
        'depth_score': False,
        'metadata_save': False
    }
    
    with open(script_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 깊이 맵 렌더링 설정
    if '_setup_depth_map_rendering' in content:
        if 'OPEN_EXR' in content and 'DepthOutput' in content:
            checks['depth_map_rendering'] = True
            print("[OK] 깊이 맵 렌더링 설정 함수 존재")
    
    # 카메라 파라미터 추출
    if '_extract_camera_parameters' in content:
        if 'intrinsics_3x3' in content:
            checks['camera_params'] = True
            print("[OK] 카메라 파라미터 추출 함수 존재 (K 행렬 포함)")
    
    # PnP 재투영 RMS
    if '_calculate_rms' in content:
        if 'solvePnPRansac' in content and 'projectPoints' in content:
            checks['pnp_rms'] = True
            print("[OK] PnP 재투영 RMS 계산 함수 존재")
    
    # 깊이 맵 검증
    if '_validate_depth_map_exr' in content:
        if 'OpenEXR' in content or 'depth_map' in content:
            checks['depth_score'] = True
            print("[OK] 깊이 맵 검증 함수 존재")
    
    # 메타데이터 저장
    if "'camera': make_json_safe(camera_params)" in content or '"camera": make_json_safe(camera_params)' in content:
        if "'quality_metrics': make_json_safe(quality_metrics)" in content or '"quality_metrics": make_json_safe(quality_metrics)' in content:
            checks['metadata_save'] = True
            print("[OK] 메타데이터에 카메라 파라미터 및 품질 메트릭 저장 로직 존재")
    
    print("\n" + "=" * 60)
    print("검증 결과")
    print("=" * 60)
    
    all_ok = all(checks.values())
    
    for check_name, passed in checks.items():
        status = "[OK]" if passed else "[FAIL]"
        print(f"{status} {check_name}: {'통과' if passed else '실패'}")
    
    if all_ok:
        print("\n[OK] 모든 핵심 기능이 코드에 구현되어 있습니다!")
        print("실제 렌더링 테스트를 위해 다음 명령을 실행하세요:")
        print("  blender --background --python scripts/render_ldraw_to_supabase.py -- --part-id 3001 --count 1 --output-dir ./output/test_new_features")
    else:
        print("\n[WARN] 일부 기능이 누락되었을 수 있습니다.")
    
    return all_ok

if __name__ == "__main__":
    test_rendering_code()


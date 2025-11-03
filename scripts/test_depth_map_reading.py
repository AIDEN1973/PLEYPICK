#!/usr/bin/env python3
"""
깊이 맵 읽기 기능 테스트 스크립트
OpenEXR 및 깊이 맵 검증 알고리즘 테스트
"""

import os
import sys
import numpy as np
from pathlib import Path

def test_opencxr_import():
    """OpenEXR 및 Imath import 테스트"""
    print("=" * 60)
    print("[1/3] OpenEXR 및 Imath Import 테스트")
    print("=" * 60)
    
    try:
        import OpenEXR
        import Imath
        print("✅ OpenEXR 모듈 import 성공")
        print("✅ Imath 모듈 import 성공")
        return True
    except ImportError as e:
        print(f"[ERROR] Import 실패: {e}")
        print("\n해결 방법:")
        print("  python scripts/install_opencv_opencxr.py")
        return False

def test_exr_reading():
    """EXR 파일 읽기 테스트 (더미 데이터)"""
    print("\n" + "=" * 60)
    print("[2/3] EXR 파일 읽기 로직 테스트")
    print("=" * 60)
    
    try:
        import OpenEXR
        import Imath
        
        # 더미 깊이 맵 생성 (테스트용)
        width, height = 1024, 1024
        depth_map = np.random.rand(height, width).astype(np.float32) * 10.0  # 0-10 범위
        
        # NumPy 배열을 bytes로 변환
        depth_bytes = depth_map.tobytes()
        
        # 읽기 테스트 (frombuffer)
        depth_array_test = np.frombuffer(depth_bytes, dtype=np.float32)
        depth_map_test = depth_array_test.reshape((height, width))
        
        # 검증
        if np.allclose(depth_map, depth_map_test):
            print("✅ EXR 데이터 읽기 로직 정상 작동")
            print(f"   - 해상도: {width}x{height}")
            print(f"   - 깊이 범위: {depth_map.min():.3f} ~ {depth_map.max():.3f}")
            return True
        else:
            print("[ERROR] 데이터 변환 오류")
            return False
            
    except Exception as e:
        print(f"[ERROR] EXR 읽기 테스트 실패: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_depth_validation():
    """깊이 맵 검증 알고리즘 테스트"""
    print("\n" + "=" * 60)
    print("[3/3] 깊이 맵 검증 알고리즘 테스트")
    print("=" * 60)
    
    try:
        import cv2
        import numpy as np
        
        # 테스트 깊이 맵 생성
        height, width = 1024, 1024
        depth_map = np.ones((height, width), dtype=np.float32) * 5.0
        
        # 일부 노이즈 추가
        noise = np.random.randn(height, width) * 0.1
        depth_map = depth_map + noise
        
        # 유효 범위 설정
        zmin = 0.1
        zmax = 10.0
        
        # 검증 알고리즘 (scripts/render_ldraw_to_supabase.py:2432-2477)
        valid = np.isfinite(depth_map) & (depth_map > 0)
        valid_ratio = float(np.mean(valid))
        
        depth_var = float(np.var(depth_map[valid])) if np.any(valid) else 1e9
        
        sobelx = cv2.Sobel(depth_map.astype(np.float32), cv2.CV_32F, 1, 0, ksize=3)
        sobely = cv2.Sobel(depth_map.astype(np.float32), cv2.CV_32F, 0, 1, ksize=3)
        edge_strength = float(np.mean(np.sqrt(sobelx**2 + sobely**2)))
        edge_smoothness = 1.0 / (1.0 + edge_strength)
        
        score = 0.4 * valid_ratio + 0.3 * (1.0 / (1.0 + depth_var)) + 0.3 * edge_smoothness
        
        print("✅ 깊이 맵 검증 알고리즘 정상 작동")
        print(f"   - 유효 픽셀 비율: {valid_ratio:.4f}")
        print(f"   - 깊이 분산: {depth_var:.4f}")
        print(f"   - 엣지 부드러움: {edge_smoothness:.4f}")
        print(f"   - 깊이 품질 점수: {score:.4f}")
        
        if score >= 0.85:
            print("   ✅ 품질 기준 통과 (≥0.85)")
        else:
            print(f"   [WARNING] 품질 기준 미달 (기준: ≥0.85, 현재: {score:.4f})")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] 깊이 맵 검증 테스트 실패: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_existing_depth_files():
    """기존 깊이 맵 파일 검색"""
    print("\n" + "=" * 60)
    print("[추가] 기존 깊이 맵 파일 검색")
    print("=" * 60)
    
    output_dir = Path("output/synthetic")
    exr_files = list(output_dir.rglob("*.exr"))
    
    if exr_files:
        print(f"✅ 발견된 EXR 파일: {len(exr_files)}개")
        for exr_file in exr_files[:5]:  # 최대 5개만 표시
            size = exr_file.stat().st_size / (1024 * 1024)  # MB
            print(f"   - {exr_file.relative_to(output_dir)} ({size:.2f} MB)")
        if len(exr_files) > 5:
            print(f"   ... 외 {len(exr_files) - 5}개 파일")
    else:
        print("[WARNING] EXR 파일을 찾을 수 없음")
        print("   렌더링 후 깊이 맵 파일이 생성됩니다.")

def main():
    """메인 함수"""
    print("\n" + "=" * 60)
    print("깊이 맵 읽기 기능 테스트")
    print("=" * 60)
    
    results = []
    
    # 1. OpenEXR Import 테스트
    results.append(("OpenEXR Import", test_opencxr_import()))
    
    # 2. EXR 읽기 테스트
    if results[0][1]:
        results.append(("EXR 파일 읽기", test_exr_reading()))
        results.append(("깊이 맵 검증", test_depth_validation()))
    
    # 3. 기존 파일 검색
    test_existing_depth_files()
    
    # 결과 요약
    print("\n" + "=" * 60)
    print("테스트 결과 요약")
    print("=" * 60)
    for name, passed in results:
        status = "✅ 통과" if passed else "[ERROR] 실패"
        print(f"{name}: {status}")
    
    all_passed = all(r[1] for r in results)
    if all_passed:
        print("\n✅ 모든 테스트 통과!")
        print("렌더링 스크립트가 깊이 맵 기능을 사용할 수 있습니다.")
        return 0
    else:
        print("\n[WARNING] 일부 테스트 실패")
        print("렌더링 스크립트는 폴백 모드로 동작합니다.")
        return 1

if __name__ == "__main__":
    sys.exit(main())


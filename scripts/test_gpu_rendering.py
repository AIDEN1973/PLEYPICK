#!/usr/bin/env python3
"""
GPU 가속 렌더링 성능 테스트
Blender에서 GPU 가속이 제대로 작동하는지 확인하고 렌더링 속도를 측정
"""

import sys
import os
import time
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

def test_gpu_rendering():
    """GPU 렌더링 성능 테스트"""
    print("=== GPU 가속 렌더링 성능 테스트 ===")
    
    try:
        from scripts.render_ldraw_to_supabase import LDrawRenderer
        
        # 렌더러 생성
        print("렌더러 초기화 중...")
        renderer = LDrawRenderer()
        
        # GPU 상태 확인
        print(f"\n=== GPU 상태 확인 ===")
        print(f"GPU 최적화 활성화: {renderer.gpu_optimized}")
        print(f"메모리 최적화 활성화: {renderer.memory_optimized}")
        
        # Blender GPU 설정 확인
        try:
            import bpy
            print(f"\n=== Blender GPU 설정 ===")
            print(f"렌더 엔진: {bpy.context.scene.render.engine}")
            print(f"Cycles 디바이스: {bpy.context.scene.cycles.device}")
            
            # GPU 디바이스 타입 확인
            if hasattr(bpy.context.preferences, 'addons'):
                cycles_addon = bpy.context.preferences.addons.get('cycles')
                if cycles_addon:
                    prefs = cycles_addon.preferences
                    print(f"컴퓨트 디바이스 타입: {prefs.compute_device_type}")
                    
                    # 사용 가능한 디바이스들
                    print(f"사용 가능한 디바이스 타입들:")
                    try:
                        device_types = prefs.get_device_types(bpy.context)
                        for device_type in device_types:
                            print(f"  - {device_type[0]}: {device_type[1]}")
                    except Exception as e:
                        print(f"  디바이스 타입 조회 실패: {e}")
            
            # 렌더링 설정 확인
            print(f"\n=== 렌더링 설정 ===")
            print(f"해상도: {bpy.context.scene.render.resolution_x}x{bpy.context.scene.render.resolution_y}")
            print(f"샘플 수: {bpy.context.scene.cycles.samples}")
            print(f"적응형 샘플링: {bpy.context.scene.cycles.use_adaptive_sampling}")
            print(f"디노이징: {bpy.context.scene.cycles.use_denoising}")
            print(f"디노이저: {bpy.context.scene.cycles.denoiser}")
            print(f"타일 크기: {bpy.context.scene.cycles.tile_size}")
            
            # GPU 메모리 정보
            if renderer.gpu_optimized:
                gpu_memory = renderer._get_gpu_memory()
                print(f"GPU 메모리: {gpu_memory}GB")
            
        except Exception as e:
            print(f"Blender 설정 확인 실패: {e}")
        
        # 테스트 렌더링 수행
        print(f"\n=== 렌더링 성능 테스트 ===")
        
        # 간단한 테스트 씬 생성
        test_element_id = "6335317"
        test_output_dir = Path("temp/test_rendering")
        test_output_dir.mkdir(parents=True, exist_ok=True)
        
        print(f"테스트 Element ID: {test_element_id}")
        print(f"출력 디렉토리: {test_output_dir}")
        
        # 렌더링 시간 측정
        start_time = time.time()
        
        try:
            # 단일 이미지 렌더링 테스트
            test_image_path = test_output_dir / f"{test_element_id}_test.webp"
            
            print("렌더링 시작...")
            result = renderer.render_image_with_retry(str(test_image_path))
            
            end_time = time.time()
            render_time = end_time - start_time
            
            print(f"렌더링 완료!")
            print(f"렌더링 시간: {render_time:.2f}초")
            print(f"결과: {result}")
            
            # 파일 크기 확인
            if test_image_path.exists():
                file_size = test_image_path.stat().st_size
                print(f"파일 크기: {file_size / 1024:.1f}KB")
                
                # 성능 평가
                if render_time < 5:
                    print("[OK] 렌더링 속도: 매우 빠름 (<5초)")
                elif render_time < 10:
                    print("[OK] 렌더링 속도: 빠름 (5-10초)")
                elif render_time < 20:
                    print("[WARNING] 렌더링 속도: 보통 (10-20초)")
                else:
                    print("[WARNING] 렌더링 속도: 느림 (>20초)")
                
                # GPU 가속 효과 확인
                if renderer.gpu_optimized and render_time < 10:
                    print("[OK] GPU 가속이 효과적으로 작동하고 있습니다!")
                elif renderer.gpu_optimized and render_time >= 10:
                    print("[WARNING] GPU 가속이 활성화되었지만 성능이 예상보다 낮습니다.")
                elif not renderer.gpu_optimized:
                    print("[INFO] CPU 렌더링을 사용하고 있습니다.")
                
            else:
                print("[ERROR] 렌더링된 파일이 생성되지 않았습니다.")
                
        except Exception as e:
            print(f"[ERROR] 렌더링 테스트 실패: {e}")
            import traceback
            traceback.print_exc()
        
        # 정리
        print(f"\n=== 정리 ===")
        try:
            renderer.cleanup()
            print("렌더러 정리 완료")
        except Exception as e:
            print(f"정리 중 오류: {e}")
            
    except Exception as e:
        print(f"[ERROR] GPU 렌더링 테스트 실패: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_gpu_rendering()

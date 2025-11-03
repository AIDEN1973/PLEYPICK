#!/usr/bin/env python3
"""
Blender GPU 가속 확인 스크립트
실제 Blender에서 실행하여 GPU 가속 상태와 렌더링 성능을 확인
"""

import bpy
import time
import os
from pathlib import Path

def check_gpu_status():
    """GPU 상태 확인"""
    print("=== Blender GPU 상태 확인 ===")
    
    # 렌더 엔진 확인
    print(f"렌더 엔진: {bpy.context.scene.render.engine}")
    
    # Cycles 설정 확인
    if bpy.context.scene.render.engine == 'CYCLES':
        print(f"Cycles 디바이스: {bpy.context.scene.cycles.device}")
        
        # GPU 디바이스 타입 확인
        try:
            cycles_addon = bpy.context.preferences.addons.get('cycles')
            if cycles_addon:
                prefs = cycles_addon.preferences
                print(f"컴퓨트 디바이스 타입: {prefs.compute_device_type}")
                
                # 사용 가능한 디바이스들
                print("사용 가능한 디바이스 타입들:")
                try:
                    device_types = prefs.get_device_types(bpy.context)
                    for device_type in device_types:
                        print(f"  - {device_type[0]}: {device_type[1]}")
                except Exception as e:
                    print(f"  디바이스 타입 조회 실패: {e}")
                
                # 활성화된 디바이스들
                print("활성화된 디바이스들:")
                for device in prefs.devices:
                    if device.use:
                        print(f"  - {device.name} ({device.type})")
        except Exception as e:
            print(f"GPU 설정 확인 실패: {e}")
    
    # 렌더링 설정 확인
    print(f"\n=== 렌더링 설정 ===")
    print(f"해상도: {bpy.context.scene.render.resolution_x}x{bpy.context.scene.render.resolution_y}")
    print(f"샘플 수: {bpy.context.scene.cycles.samples}")
    print(f"적응형 샘플링: {bpy.context.scene.cycles.use_adaptive_sampling}")
    print(f"디노이징: {bpy.context.scene.cycles.use_denoising}")
    print(f"디노이저: {bpy.context.scene.cycles.denoiser}")
    print(f"타일 크기: {bpy.context.scene.cycles.tile_size}")

def test_rendering_speed():
    """렌더링 속도 테스트"""
    print(f"\n=== 렌더링 속도 테스트 ===")
    
    # Cycles 엔진으로 변경
    bpy.context.scene.render.engine = 'CYCLES'
    print("렌더 엔진을 Cycles로 변경했습니다.")
    
    # 테스트 이미지 경로
    output_path = Path("C:/cursor/brickbox/temp/gpu_test.webp")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # 렌더링 설정
    bpy.context.scene.render.filepath = str(output_path)
    bpy.context.scene.render.image_settings.file_format = 'WEBP'
    bpy.context.scene.render.image_settings.quality = 90
    
    # 해상도 설정 (테스트용)
    bpy.context.scene.render.resolution_x = 512
    bpy.context.scene.render.resolution_y = 512
    
    # 샘플 수 설정 (GPU 최적화)
    bpy.context.scene.cycles.samples = 32  # GPU용으로 샘플 수 감소
    
    # GPU 최적화 설정
    if bpy.context.scene.cycles.device == 'GPU':
        # GPU용 최적화 설정
        bpy.context.scene.cycles.use_adaptive_sampling = True
        bpy.context.scene.cycles.adaptive_threshold = 0.01
        bpy.context.scene.cycles.adaptive_min_samples = 16
        bpy.context.scene.cycles.tile_size = 256  # GPU용 타일 크기
        print("GPU 최적화 설정 적용")
    else:
        # CPU용 설정
        bpy.context.scene.cycles.tile_size = 32
        print("CPU 설정 적용")
    
    print(f"테스트 해상도: 512x512")
    print(f"샘플 수: {bpy.context.scene.cycles.samples}")
    print(f"출력 경로: {output_path}")
    
    # 렌더링 시간 측정
    start_time = time.time()
    
    try:
        print("렌더링 시작...")
        bpy.ops.render.render(write_still=True)
        
        end_time = time.time()
        render_time = end_time - start_time
        
        print(f"렌더링 완료!")
        print(f"렌더링 시간: {render_time:.2f}초")
        
        # 파일 크기 확인
        if output_path.exists():
            file_size = output_path.stat().st_size
            print(f"파일 크기: {file_size / 1024:.1f}KB")
            
            # 성능 평가
            if render_time < 2:
                print("[OK] 렌더링 속도: 매우 빠름 (<2초)")
            elif render_time < 5:
                print("[OK] 렌더링 속도: 빠름 (2-5초)")
            elif render_time < 10:
                print("[WARNING] 렌더링 속도: 보통 (5-10초)")
            else:
                print("[WARNING] 렌더링 속도: 느림 (>10초)")
            
            # GPU 가속 효과 확인
            if bpy.context.scene.cycles.device == 'GPU' and render_time < 5:
                print("[OK] GPU 가속이 효과적으로 작동하고 있습니다!")
            elif bpy.context.scene.cycles.device == 'GPU' and render_time >= 5:
                print("[WARNING] GPU 가속이 활성화되었지만 성능이 예상보다 낮습니다.")
            elif bpy.context.scene.cycles.device == 'CPU':
                print("[INFO] CPU 렌더링을 사용하고 있습니다.")
            
        else:
            print("[ERROR] 렌더링된 파일이 생성되지 않았습니다.")
            
    except Exception as e:
        print(f"[ERROR] 렌더링 테스트 실패: {e}")

def setup_gpu_optimization():
    """GPU 최적화 설정"""
    print(f"\n=== GPU 최적화 설정 ===")
    
    try:
        # Cycles 애드온 활성화 확인
        if 'cycles' not in bpy.context.preferences.addons:
            print("Cycles 애드온이 활성화되지 않았습니다.")
            return False
        
        prefs = bpy.context.preferences.addons['cycles'].preferences
        
        # 사용 가능한 GPU 타입 확인
        available_devices = []
        for device_type in ['OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL']:
            try:
                if hasattr(prefs, 'get_device_types'):
                    device_types = prefs.get_device_types(bpy.context)
                    if device_type in [t[0] for t in device_types]:
                        available_devices.append(device_type)
            except:
                continue
        
        print(f"사용 가능한 GPU 타입: {available_devices}")
        
        # 최적 GPU 선택 및 설정
        if 'OPTIX' in available_devices:
            prefs.compute_device_type = 'OPTIX'
            bpy.context.scene.cycles.device = 'GPU'
            bpy.context.scene.cycles.denoiser = 'OPTIX'
            print("OPTIX GPU 가속 활성화 (RTX 카드)")
            return True
        elif 'CUDA' in available_devices:
            prefs.compute_device_type = 'CUDA'
            bpy.context.scene.cycles.device = 'GPU'
            bpy.context.scene.cycles.denoiser = 'OPENIMAGEDENOISE'
            print("CUDA GPU 가속 활성화 (GTX/RTX 카드)")
            return True
        elif 'HIP' in available_devices:
            prefs.compute_device_type = 'HIP'
            bpy.context.scene.cycles.device = 'GPU'
            print("HIP GPU 가속 활성화 (AMD 카드)")
            return True
        elif 'METAL' in available_devices:
            prefs.compute_device_type = 'METAL'
            bpy.context.scene.cycles.device = 'GPU'
            print("METAL GPU 가속 활성화 (Apple Silicon)")
            return True
        else:
            bpy.context.scene.cycles.device = 'CPU'
            print("GPU 없음, CPU 사용")
            return False
            
    except Exception as e:
        print(f"GPU 최적화 설정 실패: {e}")
        return False

def main():
    """메인 함수"""
    print("=== Blender GPU 가속 확인 및 성능 테스트 ===")
    
    # GPU 상태 확인
    check_gpu_status()
    
    # GPU 최적화 설정
    gpu_enabled = setup_gpu_optimization()
    
    # 렌더링 속도 테스트
    test_rendering_speed()
    
    print(f"\n=== 테스트 완료 ===")
    if gpu_enabled:
        print("GPU 가속이 활성화되었습니다.")
    else:
        print("CPU 렌더링을 사용하고 있습니다.")

if __name__ == "__main__":
    main()

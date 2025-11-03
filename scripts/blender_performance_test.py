#!/usr/bin/env python3
"""
Blender 렌더링 성능 테스트
실제 Blender에서 LEGO 부품 렌더링을 통해 GPU 가속 성능을 측정
"""

import bpy
import time
import os
from pathlib import Path

def setup_test_scene():
    """테스트 씬 설정"""
    print("테스트 씬 설정 중...")
    
    # 기본 큐브 제거
    if "Cube" in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects["Cube"], do_unlink=True)
    
    # 기본 라이트 제거
    if "Light" in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects["Light"], do_unlink=True)
    
    # 간단한 테스트 오브젝트 생성 (LEGO 부품 시뮬레이션)
    bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 1))
    test_cube = bpy.context.active_object
    test_cube.name = "LEGO_Test_Part"
    
    # 머티리얼 생성
    mat = bpy.data.materials.new(name="LEGO_Red")
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs[0].default_value = (0.8, 0.1, 0.1, 1.0)  # 빨간색
    test_cube.data.materials.append(mat)
    
    # 카메라 설정
    bpy.ops.object.camera_add(location=(5, -5, 3))
    camera = bpy.context.active_object
    camera.rotation_euler = (1.1, 0, 0.785)
    bpy.context.scene.camera = camera
    
    # 라이트 설정
    bpy.ops.object.light_add(type='SUN', location=(2, 2, 5))
    sun = bpy.context.active_object
    sun.data.energy = 3
    
    # HDRI 환경 조명 추가
    world = bpy.context.scene.world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.5  # 환경 조명 강도
    
    print("테스트 씬 설정 완료")

def test_rendering_performance():
    """렌더링 성능 테스트"""
    print("=== Blender 렌더링 성능 테스트 ===")
    
    # 테스트 씬 설정
    setup_test_scene()
    
    # Cycles 엔진으로 변경
    bpy.context.scene.render.engine = 'CYCLES'
    print("렌더 엔진을 Cycles로 변경했습니다.")
    
    # GPU 설정 확인 및 최적화
    print(f"\n=== GPU 설정 확인 ===")
    print(f"Cycles 디바이스: {bpy.context.scene.cycles.device}")
    
    # GPU 최적화 설정
    try:
        cycles_addon = bpy.context.preferences.addons.get('cycles')
        if cycles_addon:
            prefs = cycles_addon.preferences
            print(f"컴퓨트 디바이스 타입: {prefs.compute_device_type}")
            
            # OPTIX GPU 활성화 (RTX 카드)
            if 'OPTIX' in [t[0] for t in prefs.get_device_types(bpy.context)]:
                prefs.compute_device_type = 'OPTIX'
                bpy.context.scene.cycles.device = 'GPU'
                bpy.context.scene.cycles.denoiser = 'OPTIX'
                print("OPTIX GPU 가속 활성화")
            elif 'CUDA' in [t[0] for t in prefs.get_device_types(bpy.context)]:
                prefs.compute_device_type = 'CUDA'
                bpy.context.scene.cycles.device = 'GPU'
                bpy.context.scene.cycles.denoiser = 'OPENIMAGEDENOISE'
                print("CUDA GPU 가속 활성화")
            else:
                bpy.context.scene.cycles.device = 'CPU'
                print("CPU 렌더링 사용")
    except Exception as e:
        print(f"GPU 설정 실패: {e}")
        bpy.context.scene.cycles.device = 'CPU'
    
    # 렌더링 설정 최적화
    if bpy.context.scene.cycles.device == 'GPU':
        # GPU 최적화 설정
        bpy.context.scene.cycles.samples = 64
        bpy.context.scene.cycles.use_adaptive_sampling = True
        bpy.context.scene.cycles.adaptive_threshold = 0.01
        bpy.context.scene.cycles.adaptive_min_samples = 16
        bpy.context.scene.cycles.tile_size = 256
        bpy.context.scene.cycles.use_denoising = True
        print("GPU 최적화 설정 적용")
    else:
        # CPU 최적화 설정
        bpy.context.scene.cycles.samples = 128
        bpy.context.scene.cycles.use_adaptive_sampling = True
        bpy.context.scene.cycles.adaptive_threshold = 0.001
        bpy.context.scene.cycles.adaptive_min_samples = 32
        bpy.context.scene.cycles.tile_size = 32
        bpy.context.scene.cycles.use_denoising = True
        print("CPU 최적화 설정 적용")
    
    # 여러 해상도로 테스트
    test_resolutions = [
        (512, 512, "저해상도"),
        (768, 768, "중해상도"),
        (1024, 1024, "고해상도")
    ]
    
    results = []
    output_dir = Path("C:/cursor/brickbox/temp/blender_performance_test")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    for width, height, desc in test_resolutions:
        print(f"\n--- {desc} 테스트 ({width}x{height}) ---")
        
        # 해상도 설정
        bpy.context.scene.render.resolution_x = width
        bpy.context.scene.render.resolution_y = height
        
        # 출력 경로 설정
        output_path = output_dir / f"test_{width}x{height}.webp"
        bpy.context.scene.render.filepath = str(output_path)
        bpy.context.scene.render.image_settings.file_format = 'WEBP'
        bpy.context.scene.render.image_settings.quality = 90
        
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
                
                # 픽셀당 렌더링 시간 계산
                total_pixels = width * height
                time_per_pixel = render_time / total_pixels * 1000000  # 마이크로초
                print(f"픽셀당 렌더링 시간: {time_per_pixel:.2f}μs")
                
                # 결과 저장
                results.append({
                    'resolution': f"{width}x{height}",
                    'description': desc,
                    'render_time': render_time,
                    'file_size_kb': file_size / 1024,
                    'time_per_pixel_us': time_per_pixel,
                    'success': True
                })
                
                # 성능 평가
                if render_time < 2:
                    print("[OK] 렌더링 속도: 매우 빠름 (<2초)")
                elif render_time < 5:
                    print("[OK] 렌더링 속도: 빠름 (2-5초)")
                elif render_time < 10:
                    print("[WARNING] 렌더링 속도: 보통 (5-10초)")
                else:
                    print("[WARNING] 렌더링 속도: 느림 (>10초)")
                
            else:
                print("[ERROR] 렌더링된 파일이 생성되지 않았습니다.")
                results.append({
                    'resolution': f"{width}x{height}",
                    'description': desc,
                    'render_time': render_time,
                    'file_size_kb': 0,
                    'time_per_pixel_us': 0,
                    'success': False
                })
                
        except Exception as e:
            print(f"[ERROR] 렌더링 테스트 실패: {e}")
            results.append({
                'resolution': f"{width}x{height}",
                'description': desc,
                'render_time': 0,
                'file_size_kb': 0,
                'time_per_pixel_us': 0,
                'success': False
            })
    
    # 결과 요약
    print(f"\n=== 성능 테스트 결과 요약 ===")
    print(f"{'해상도':<12} {'설명':<8} {'시간(초)':<8} {'파일크기(KB)':<12} {'픽셀당시간(μs)':<15} {'상태'}")
    print("-" * 80)
    
    for result in results:
        status = "성공" if result['success'] else "실패"
        print(f"{result['resolution']:<12} {result['description']:<8} {result['render_time']:<8.2f} {result['file_size_kb']:<12.1f} {result['time_per_pixel_us']:<15.2f} {status}")
    
    # 성능 분석
    successful_results = [r for r in results if r['success']]
    if successful_results:
        avg_render_time = sum(r['render_time'] for r in successful_results) / len(successful_results)
        avg_time_per_pixel = sum(r['time_per_pixel_us'] for r in successful_results) / len(successful_results)
        
        print(f"\n=== 성능 분석 ===")
        print(f"평균 렌더링 시간: {avg_render_time:.2f}초")
        print(f"평균 픽셀당 시간: {avg_time_per_pixel:.2f}μs")
        
        if bpy.context.scene.cycles.device == 'GPU':
            print(f"GPU 가속: 활성화")
            if avg_render_time < 3:
                print("[OK] GPU 가속이 효과적으로 작동하고 있습니다!")
            else:
                print("[WARNING] GPU 가속이 활성화되었지만 성능이 예상보다 낮습니다.")
        else:
            print(f"GPU 가속: 비활성화 (CPU 렌더링)")
            if avg_render_time < 10:
                print("[OK] CPU 렌더링 성능이 양호합니다.")
            else:
                print("[WARNING] CPU 렌더링 성능이 낮습니다.")
    
    print(f"\n=== 테스트 완료 ===")

def main():
    """메인 함수"""
    test_rendering_performance()

if __name__ == "__main__":
    main()

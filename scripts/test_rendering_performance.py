#!/usr/bin/env python3
"""
렌더링 성능 측정 스크립트
실제 LEGO 부품 렌더링을 통해 GPU 가속 성능을 측정
"""

import sys
import os
import time
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

def test_rendering_performance():
    """렌더링 성능 테스트"""
    print("=== BrickBox 렌더링 성능 테스트 ===")
    
    try:
        from scripts.render_ldraw_to_supabase import LDrawRenderer
        
        # 렌더러 생성
        print("렌더러 초기화 중...")
        renderer = LDrawRenderer()
        
        # GPU 상태 확인
        print(f"\n=== GPU 상태 확인 ===")
        print(f"GPU 최적화 활성화: {renderer.gpu_optimized}")
        print(f"메모리 최적화 활성화: {renderer.memory_optimized}")
        
        # 테스트 Element ID
        test_element_id = "6335317"
        test_output_dir = Path("temp/performance_test")
        test_output_dir.mkdir(parents=True, exist_ok=True)
        
        print(f"\n=== 렌더링 성능 테스트 ===")
        print(f"테스트 Element ID: {test_element_id}")
        print(f"출력 디렉토리: {test_output_dir}")
        
        # 여러 해상도로 테스트
        test_resolutions = [
            (512, 512, "저해상도"),
            (768, 768, "중해상도"),
            (1024, 1024, "고해상도")
        ]
        
        results = []
        
        for width, height, desc in test_resolutions:
            print(f"\n--- {desc} 테스트 ({width}x{height}) ---")
            
            # 해상도 설정
            renderer.resolution = (width, height)
            
            # 테스트 이미지 경로
            test_image_path = test_output_dir / f"{test_element_id}_{width}x{height}.webp"
            
            # 렌더링 시간 측정
            start_time = time.time()
            
            try:
                print("렌더링 시작...")
                result = renderer.render_image_with_retry(str(test_image_path))
                
                end_time = time.time()
                render_time = end_time - start_time
                
                print(f"렌더링 완료!")
                print(f"렌더링 시간: {render_time:.2f}초")
                
                # 파일 크기 확인
                if test_image_path.exists():
                    file_size = test_image_path.stat().st_size
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
            
            if renderer.gpu_optimized:
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
        
        # 정리
        print(f"\n=== 정리 ===")
        try:
            renderer.cleanup()
            print("렌더러 정리 완료")
        except Exception as e:
            print(f"정리 중 오류: {e}")
            
    except Exception as e:
        print(f"[ERROR] 렌더링 성능 테스트 실패: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_rendering_performance()

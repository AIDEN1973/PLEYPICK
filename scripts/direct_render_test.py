#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
직접 렌더링 테스트 스크립트
실제 Blender를 실행하여 새로운 기능 검증
"""

import os
import sys
import subprocess
import time
from pathlib import Path

def find_blender():
    """Blender 실행 파일 찾기"""
    # Windows 일반 경로들
    windows_paths = [
        r"C:\Program Files\Blender Foundation\Blender 4.5\blender.exe",
        r"C:\Program Files\Blender Foundation\Blender 4.0\blender.exe",
        r"C:\Program Files\Blender Foundation\Blender 3.6\blender.exe",
        r"C:\Program Files\Blender Foundation\Blender 3.5\blender.exe",
    ]
    
    for path in windows_paths:
        if os.path.exists(path):
            return path
    
    # PATH에서 찾기
    try:
        result = subprocess.run(['where', 'blender'], capture_output=True, text=True, timeout=5)
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip().split('\n')[0]
    except:
        pass
    
    return None

def run_test_render(blender_path, part_id="3001", count=1):
    """테스트 렌더링 실행"""
    print("=" * 60)
    print("직접 렌더링 테스트")
    print("=" * 60)
    
    script_path = Path("scripts/render_ldraw_to_supabase.py").absolute()
    output_dir = Path("output/test_new_features").absolute()
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\n설정:")
    print(f"  Blender: {blender_path}")
    print(f"  스크립트: {script_path}")
    print(f"  부품 ID: {part_id}")
    print(f"  이미지 수: {count}")
    print(f"  출력 디렉토리: {output_dir}")
    
    # 렌더링 명령 구성
    cmd = [
        blender_path,
        "--background",
        "--python", str(script_path),
        "--",
        "--part-id", part_id,
        "--count", str(count),
        "--output-dir", str(output_dir),
        "--quality", "fast"
    ]
    
    print(f"\n명령:")
    print(f"  {' '.join(cmd)}")
    print(f"\n렌더링 시작... (시간이 걸릴 수 있습니다)")
    
    try:
        start_time = time.time()
        
        process = subprocess.Popen(
            cmd,
            cwd=Path.cwd(),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
        
        # 실시간 출력 모니터링
        output_lines = []
        error_lines = []
        
        while True:
            output = process.stdout.readline()
            error = process.stderr.readline()
            
            if output == '' and error == '' and process.poll() is not None:
                break
            
            if output:
                output_lines.append(output.strip())
                # 중요한 메시지만 출력
                if any(keyword in output.lower() for keyword in ['info', 'warn', 'error', 'ok', '렌더링', '깊이', '카메라', 'pnp', 'depth']):
                    print(f"[OUT] {output.strip()}")
            
            if error:
                error_lines.append(error.strip())
                print(f"[ERR] {error.strip()}")
        
        return_code = process.poll()
        elapsed_time = time.time() - start_time
        
        print(f"\n렌더링 완료 (종료 코드: {return_code}, 소요 시간: {elapsed_time:.1f}초)")
        
        if return_code == 0:
            print("[OK] 렌더링 성공")
            return True, output_dir, output_lines, error_lines
        else:
            print("[FAIL] 렌더링 실패")
            if error_lines:
                print("\n오류 출력:")
                for line in error_lines[-20:]:  # 마지막 20줄만
                    print(f"  {line}")
            return False, output_dir, output_lines, error_lines
            
    except Exception as e:
        print(f"[ERROR] 렌더링 실행 오류: {e}")
        import traceback
        traceback.print_exc()
        return False, output_dir, [], []

def validate_render_results(output_dir, part_id):
    """렌더링 결과 검증"""
    print("\n" + "=" * 60)
    print("렌더링 결과 검증")
    print("=" * 60)
    
    # dataset_synthetic 구조 확인
    dataset_dir = output_dir / "dataset_synthetic"
    if dataset_dir.exists():
        # 새로운 구조: dataset_synthetic/images/train/3001
        part_dir = dataset_dir / part_id
        # 이미지 디렉토리 확인
        image_train_dir = dataset_dir / "images" / "train" / part_id
        if image_train_dir.exists() and list(image_train_dir.glob("*")):
            part_dir = dataset_dir
    else:
        # 기존 구조: output_dir/3001
        part_dir = output_dir / part_id
    
    if not part_dir.exists():
        print(f"[FAIL] 부품 디렉토리 없음: {part_dir}")
        return False
    
    results = {
        'images': 0,
        'depth_maps': 0,
        'metadata': 0,
        'e2_metadata': 0,
        'labels': 0,
        'has_camera_params': False,
        'has_quality_metrics': False,
        'rms_ok': False,
        'depth_ok': False
    }
    
    # 이미지 확인
    image_dir = part_dir / "images"
    if image_dir.exists():
        images = list(image_dir.glob("*.webp"))
        results['images'] = len(images)
        print(f"[OK] 이미지: {len(images)}개")
        for img in images[:3]:
            size_mb = img.stat().st_size / (1024 * 1024)
            print(f"  - {img.name} ({size_mb:.2f} MB)")
    
    # 깊이 맵 확인
    depth_dir = part_dir / "depth"
    if depth_dir.exists():
        depth_files = list(depth_dir.glob("*.exr"))
        results['depth_maps'] = len(depth_files)
        print(f"[OK] 깊이 맵: {len(depth_files)}개")
        for depth in depth_files:
            size_mb = depth.stat().st_size / (1024 * 1024)
            print(f"  - {depth.name} ({size_mb:.2f} MB)")
    else:
        print("[WARN] 깊이 맵 디렉토리 없음")
    
    # 메타데이터 확인
    meta_dir = part_dir / "meta"
    if meta_dir.exists():
        meta_files = list(meta_dir.glob("*.json"))
        results['metadata'] = len(meta_files)
        
        if meta_files:
            print(f"[OK] 메타데이터: {len(meta_files)}개")
            # 첫 번째 메타데이터 상세 검증
            import json
            meta_file = meta_files[0]
            
            try:
                with open(meta_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # 카메라 파라미터 확인
                if 'camera' in data:
                    camera = data['camera']
                    if 'intrinsics_3x3' in camera:
                        results['has_camera_params'] = True
                        K = camera['intrinsics_3x3']
                        print(f"  [OK] 카메라 K 행렬: 존재")
                        print(f"     K[0][0] (fx): {K[0][0]:.1f}")
                        print(f"     K[1][1] (fy): {K[1][1]:.1f}")
                        print(f"     K[0][2] (cx): {K[0][2]:.1f}")
                        print(f"     K[1][2] (cy): {K[1][2]:.1f}")
                    else:
                        print(f"  [FAIL] 카메라 K 행렬: 누락")
                    
                    if 'rotation_matrix_3x3' in camera:
                        print(f"  [OK] 카메라 R 행렬: 존재")
                    
                    if 'translation' in camera:
                        print(f"  [OK] 카메라 t 벡터: 존재")
                else:
                    print(f"  [FAIL] 카메라 파라미터 섹션: 누락")
                
                # 품질 메트릭 확인
                if 'quality_metrics' in data:
                    results['has_quality_metrics'] = True
                    qm = data['quality_metrics']
                    print(f"  [OK] 품질 메트릭: 존재")
                    
                    if 'reprojection_rms_px' in qm:
                        rms = qm['reprojection_rms_px']
                        results['rms_ok'] = rms <= 1.5
                        status = "✅" if results['rms_ok'] else "[WARNING]"
                        print(f"    {status} 재투영 RMS: {rms:.3f}px (기준: ≤1.5px)")
                    elif 'rms' in qm:
                        rms = qm['rms']
                        results['rms_ok'] = rms <= 1.5
                        status = "✅" if results['rms_ok'] else "[WARNING]"
                        print(f"    {status} RMS: {rms:.3f}px (기준: ≤1.5px)")
                    
                    if 'depth_score' in qm:
                        depth = qm['depth_score']
                        results['depth_ok'] = depth >= 0.85
                        status = "✅" if results['depth_ok'] else "[WARNING]"
                        print(f"    {status} Depth Score: {depth:.4f} (기준: ≥0.85)")
                    elif 'depth_quality_score' in qm:
                        depth = qm['depth_quality_score']
                        results['depth_ok'] = depth >= 0.85
                        status = "✅" if results['depth_ok'] else "[WARNING]"
                        print(f"    {status} Depth Quality Score: {depth:.4f} (기준: ≥0.85)")
                else:
                    print(f"  [FAIL] 품질 메트릭 섹션: 누락")
            
            except Exception as e:
                print(f"  [ERROR] 메타데이터 읽기 실패: {e}")
    
    # E2 메타데이터 확인
    meta_e_dir = part_dir / "meta-e"
    if meta_e_dir.exists():
        e2_files = list(meta_e_dir.glob("*.json"))
        results['e2_metadata'] = len(e2_files)
        print(f"[OK] E2 메타데이터: {len(e2_files)}개")
    
    # 라벨 확인
    label_dir = part_dir / "labels"
    if label_dir.exists():
        labels = list(label_dir.glob("*.txt"))
        results['labels'] = len(labels)
        print(f"[OK] 라벨: {len(labels)}개")
    
    # 종합 평가
    print(f"\n{'='*60}")
    print("종합 평가")
    print(f"{'='*60}")
    
    all_ok = (
        results['images'] > 0 and
        results['metadata'] > 0 and
        results['has_camera_params'] and
        results['has_quality_metrics']
    )
    
    if all_ok:
        print("[OK] 모든 핵심 기능 정상 작동")
    else:
        print("[WARN] 일부 기능 누락 또는 오류")
    
    print(f"\n상세 결과:")
    print(f"  이미지: {results['images']}개")
    print(f"  깊이 맵: {results['depth_maps']}개")
    print(f"  메타데이터: {results['metadata']}개")
    print(f"  E2 메타데이터: {results['e2_metadata']}개")
    print(f"  라벨: {results['labels']}개")
    print(f"  카메라 파라미터: {'[OK]' if results['has_camera_params'] else '[FAIL]'}")
    print(f"  품질 메트릭: {'[OK]' if results['has_quality_metrics'] else '[FAIL]'}")
    print(f"  RMS 기준 통과: {'[OK]' if results['rms_ok'] else '[WARN]'}")
    print(f"  Depth 기준 통과: {'[OK]' if results['depth_ok'] else '[WARN]'}")
    
    return all_ok

def main():
    """메인 함수"""
    print("=" * 60)
    print("직접 렌더링 테스트 시작")
    print("=" * 60)
    
    # Blender 찾기
    print("\n[1/3] Blender 실행 파일 찾기...")
    blender_path = find_blender()
    
    if not blender_path:
        print("[FAIL] Blender를 찾을 수 없습니다.")
        print("\n수동 실행 방법:")
        print("  blender --background --python scripts/render_ldraw_to_supabase.py -- --part-id 3001 --count 1 --output-dir ./output/test_new_features")
        return
    
    print(f"Blender 발견: {blender_path}")
    
    # 렌더링 실행
    print("\n[2/3] 렌더링 실행...")
    success, output_dir, output_lines, error_lines = run_test_render(
        blender_path,
        part_id="3001",
        count=1
    )
    
    if not success:
        print("\n[ERROR] 렌더링 실패 - 검증 건너뜀")
        return
    
    # 결과 검증
    print("\n[3/3] 결과 검증...")
    validate_ok = validate_render_results(output_dir, "3001")
    
    print("\n" + "=" * 60)
    print("테스트 완료")
    print("=" * 60)
    
    if success and validate_ok:
        print("[OK] 모든 테스트 통과!")
    elif success:
        print("[WARN] 렌더링은 성공했으나 검증에서 일부 문제 발견")
    else:
        print("[FAIL] 렌더링 실패")

if __name__ == "__main__":
    main()


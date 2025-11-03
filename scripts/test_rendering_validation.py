#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
실제 렌더링 테스트 스크립트
깊이 맵, 카메라 파라미터, 품질 메트릭 검증
"""

import os
import sys
import json
import subprocess
from pathlib import Path

def find_blender_executable():
    """Blender 실행 파일 찾기"""
    possible_paths = [
        "blender",
        "C:/Program Files/Blender Foundation/Blender 4.0/blender.exe",
        "C:/Program Files/Blender Foundation/Blender 4.1/blender.exe",
        "C:/Program Files/Blender Foundation/Blender 3.6/blender.exe",
        "/usr/bin/blender",
        "/usr/local/bin/blender"
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            return path
        # PATH에서 찾기
        try:
            result = subprocess.run([path, "--version"], capture_output=True, timeout=5)
            if result.returncode == 0:
                return path
        except:
            continue
    
    return None

def check_test_part():
    """테스트용 부품 확인"""
    # 간단한 부품 확인 (예: 3001 - 기본 브릭)
    test_part = "3001"
    
    # LDraw 파일 확인
    ldraw_paths = [
        f"data/ldraw/parts/{test_part}.dat",
        f"data/ldraw/p/{test_part}.dat",
        f"ldraw/parts/{test_part}.dat"
    ]
    
    for path in ldraw_paths:
        if os.path.exists(path):
            return test_part, path
    
    return None, None

def run_render_test(part_id="3001", output_dir="./output/test_validation"):
    """렌더링 테스트 실행"""
    print("=" * 60)
    print("실제 렌더링 테스트")
    print("=" * 60)
    
    # 1. Blender 실행 파일 확인
    print("\n[1/5] Blender 실행 파일 확인...")
    blender_exe = find_blender_executable()
    if not blender_exe:
        print("[ERROR] Blender 실행 파일을 찾을 수 없습니다.")
        print("\n수동 실행 방법:")
        print("  blender --background --python scripts/render_ldraw_to_supabase.py -- --part-id 3001 --count 1")
        return False
    print(f"✅ Blender 발견: {blender_exe}")
    
    # 2. 테스트 부품 확인
    print("\n[2/5] 테스트 부품 확인...")
    test_part, part_path = check_test_part()
    if not test_part:
        print("[WARNING] 테스트 부품 파일을 찾을 수 없습니다.")
        print("테스트는 계속 진행하되, 실제 부품 파일이 필요할 수 있습니다.")
    else:
        print(f"✅ 테스트 부품: {test_part}")
    
    # 3. 출력 디렉토리 생성
    print("\n[3/5] 출력 디렉토리 생성...")
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    print(f"✅ 출력 디렉토리: {output_path}")
    
    # 4. 렌더링 명령 구성
    print("\n[4/5] 렌더링 명령 구성...")
    script_path = Path("scripts/render_ldraw_to_supabase.py").absolute()
    
    cmd = [
        blender_exe,
        "--background",
        "--python", str(script_path),
        "--",
        "--part-id", part_id,
        "--count", "1",
        "--output-dir", str(output_path)
    ]
    
    print(f"명령: {' '.join(cmd)}")
    
    # 5. 렌더링 실행
    print("\n[5/5] 렌더링 실행...")
    print("[WARNING] 주의: Blender 렌더링은 시간이 걸릴 수 있습니다.")
    print("진행 상황을 확인하세요...\n")
    
    try:
        result = subprocess.run(
            cmd,
            cwd=Path.cwd(),
            capture_output=True,
            text=True,
            timeout=300  # 5분 타임아웃
        )
        
        print("=" * 60)
        print("렌더링 출력")
        print("=" * 60)
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print("오류 출력:")
            print(result.stderr)
        
        if result.returncode == 0:
            print("\n✅ 렌더링 완료")
            return True
        else:
            print(f"\n[ERROR] 렌더링 실패 (종료 코드: {result.returncode})")
            return False
            
    except subprocess.TimeoutExpired:
        print("\n[WARNING] 렌더링 타임아웃 (5분 초과)")
        return False
    except Exception as e:
        print(f"\n[ERROR] 렌더링 실행 오류: {e}")
        return False

def validate_render_output(output_dir="./output/test_validation"):
    """렌더링 결과 검증"""
    print("\n" + "=" * 60)
    print("렌더링 결과 검증")
    print("=" * 60)
    
    output_path = Path(output_dir)
    if not output_path.exists():
        print(f"[ERROR] 출력 디렉토리 없음: {output_path}")
        return False
    
    validation_results = {
        'images': [],
        'depth_maps': [],
        'metadata': [],
        'labels': [],
        'issues': []
    }
    
    # 1. 이미지 파일 확인
    print("\n[1/4] 이미지 파일 확인...")
    image_files = list(output_path.rglob("*.webp"))
    if image_files:
        print(f"✅ 이미지 파일: {len(image_files)}개")
        for img_file in image_files[:5]:
            size_mb = img_file.stat().st_size / (1024 * 1024)
            validation_results['images'].append({
                'path': str(img_file),
                'size_mb': round(size_mb, 2)
            })
            print(f"  - {img_file.relative_to(output_path)} ({size_mb:.2f} MB)")
    else:
        print("[WARNING] 이미지 파일 없음")
        validation_results['issues'].append("이미지 파일 없음")
    
    # 2. 깊이 맵 파일 확인
    print("\n[2/4] 깊이 맵 파일 확인...")
    depth_files = list(output_path.rglob("*.exr"))
    if depth_files:
        print(f"✅ 깊이 맵 파일: {len(depth_files)}개")
        for depth_file in depth_files:
            size_mb = depth_file.stat().st_size / (1024 * 1024)
            validation_results['depth_maps'].append({
                'path': str(depth_file),
                'size_mb': round(size_mb, 2)
            })
            print(f"  - {depth_file.relative_to(output_path)} ({size_mb:.2f} MB)")
    else:
        print("[WARNING] 깊이 맵 파일 없음")
        validation_results['issues'].append("깊이 맵 파일 없음")
    
    # 3. 메타데이터 확인
    print("\n[3/4] 메타데이터 확인...")
    meta_files = list(output_path.rglob("*.json"))
    if meta_files:
        print(f"✅ 메타데이터 파일: {len(meta_files)}개")
        for meta_file in meta_files[:5]:
            try:
                with open(meta_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # 카메라 파라미터 확인
                has_camera = 'camera' in data and 'intrinsics_3x3' in data.get('camera', {})
                
                # 품질 메트릭 확인
                has_quality = 'quality_metrics' in data
                if has_quality:
                    qm = data['quality_metrics']
                    has_rms = 'reprojection_rms_px' in qm or 'rms' in qm
                    has_depth = 'depth_score' in qm or 'depth_quality_score' in qm
                else:
                    has_rms = False
                    has_depth = False
                
                validation_results['metadata'].append({
                    'path': str(meta_file),
                    'has_camera_params': has_camera,
                    'has_quality_metrics': has_quality,
                    'has_rms': has_rms,
                    'has_depth_score': has_depth
                })
                
                status = "✅" if (has_camera and has_quality and has_rms and has_depth) else "[WARNING]"
                print(f"  {status} {meta_file.name}")
                if has_camera:
                    print(f"    - 카메라 파라미터: 존재")
                if has_rms:
                    rms = qm.get('reprojection_rms_px', qm.get('rms', 'N/A'))
                    print(f"    - RMS: {rms}")
                if has_depth:
                    depth = qm.get('depth_score', qm.get('depth_quality_score', 'N/A'))
                    print(f"    - Depth: {depth}")
                
            except Exception as e:
                print(f"  [ERROR] 메타데이터 읽기 실패: {meta_file.name} - {e}")
                validation_results['issues'].append(f"메타데이터 읽기 실패: {meta_file.name}")
    
    # 4. 라벨 파일 확인
    print("\n[4/4] 라벨 파일 확인...")
    label_files = list(output_path.rglob("*.txt"))
    if label_files:
        print(f"✅ 라벨 파일: {len(label_files)}개")
    else:
        print("[WARNING] 라벨 파일 없음")
        validation_results['issues'].append("라벨 파일 없음")
    
    # 결과 저장
    report_path = Path("output/rendering_test_validation.json")
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(validation_results, f, ensure_ascii=False, indent=2)
    
    print(f"\n📄 검증 결과 저장: {report_path}")
    
    # 요약
    print("\n" + "=" * 60)
    print("검증 요약")
    print("=" * 60)
    print(f"이미지: {len(validation_results['images'])}개")
    print(f"깊이 맵: {len(validation_results['depth_maps'])}개")
    print(f"메타데이터: {len(validation_results['metadata'])}개")
    print(f"이슈: {len(validation_results['issues'])}개")
    
    if validation_results['issues']:
        print("\n[WARNING] 발견된 이슈:")
        for issue in validation_results['issues']:
            print(f"  - {issue}")
    
    return len(validation_results['issues']) == 0

def main():
    """메인 함수"""
    print("=" * 60)
    print("실제 렌더링 테스트 및 검증")
    print("=" * 60)
    
    # 테스트 부품 ID
    test_part_id = "3001"  # 기본 브릭
    
    # 렌더링 실행
    success = run_render_test(test_part_id)
    
    if success:
        # 결과 검증
        validate_render_output()
        print("\n✅ 렌더링 테스트 완료")
    else:
        print("\n[WARNING] 렌더링 실행 실패 또는 수동 실행 필요")
        print("\n수동 실행 방법:")
        print(f"  blender --background --python scripts/render_ldraw_to_supabase.py -- --part-id {test_part_id} --count 1 --output-dir ./output/test_validation")

if __name__ == "__main__":
    main()


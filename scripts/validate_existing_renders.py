#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
기존 렌더링 결과 검증 스크립트
깊이 맵, 카메라 파라미터, 품질 메트릭 검증
"""

import os
import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple

def validate_single_meta(meta_file: Path) -> Dict:
    """단일 메타데이터 파일 검증"""
    results = {
        'file': str(meta_file),
        'valid': False,
        'has_camera_params': False,
        'has_quality_metrics': False,
        'has_rms': False,
        'has_depth_score': False,
        'rms_value': None,
        'depth_value': None,
        'quality_passed': False,
        'issues': []
    }
    
    try:
        with open(meta_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        results['valid'] = True
        
        # 카메라 파라미터 확인
        if 'camera' in data:
            camera = data['camera']
            if 'intrinsics_3x3' in camera:
                results['has_camera_params'] = True
                if len(camera['intrinsics_3x3']) == 3 and len(camera['intrinsics_3x3'][0]) == 3:
                    results['issues'].append(("INFO", "카메라 K 행렬 정상 (3x3)"))
                else:
                    results['issues'].append(("WARNING", f"카메라 K 행렬 형식 이상: {len(camera['intrinsics_3x3'])}"))
            else:
                results['issues'].append(("ERROR", "카메라 내부 파라미터 (K) 누락"))
        else:
            results['issues'].append(("ERROR", "카메라 파라미터 섹션 누락"))
        
        # 품질 메트릭 확인
        if 'quality_metrics' in data:
            results['has_quality_metrics'] = True
            qm = data['quality_metrics']
            
            # RMS 확인
            if 'reprojection_rms_px' in qm:
                results['has_rms'] = True
                results['rms_value'] = float(qm['reprojection_rms_px'])
                if results['rms_value'] <= 1.5:
                    results['issues'].append(("INFO", f"RMS 기준 통과: {results['rms_value']:.3f}px ≤ 1.5px"))
                else:
                    results['issues'].append(("WARNING", f"RMS 기준 미달: {results['rms_value']:.3f}px > 1.5px"))
            elif 'rms' in qm:
                results['has_rms'] = True
                results['rms_value'] = float(qm['rms'])
                if results['rms_value'] <= 1.5:
                    results['issues'].append(("INFO", f"RMS 기준 통과: {results['rms_value']:.3f}px ≤ 1.5px"))
                else:
                    results['issues'].append(("WARNING", f"RMS 기준 미달: {results['rms_value']:.3f}px > 1.5px"))
            else:
                results['issues'].append(("ERROR", "RMS 값 누락 (reprojection_rms_px 또는 rms)"))
            
            # Depth 확인
            if 'depth_score' in qm:
                results['has_depth_score'] = True
                results['depth_value'] = float(qm['depth_score'])
                if results['depth_value'] >= 0.85:
                    results['issues'].append(("INFO", f"Depth 기준 통과: {results['depth_value']:.4f} ≥ 0.85"))
                else:
                    results['issues'].append(("WARNING", f"Depth 기준 미달: {results['depth_value']:.4f} < 0.85"))
            elif 'depth_quality_score' in qm:
                results['has_depth_score'] = True
                results['depth_value'] = float(qm['depth_quality_score'])
                if results['depth_value'] >= 0.85:
                    results['issues'].append(("INFO", f"Depth 기준 통과: {results['depth_value']:.4f} ≥ 0.85"))
                else:
                    results['issues'].append(("WARNING", f"Depth 기준 미달: {results['depth_value']:.4f} < 0.85"))
            else:
                results['issues'].append(("ERROR", "Depth 점수 누락 (depth_score 또는 depth_quality_score)"))
            
            # 품질 통과 여부
            if results['has_rms'] and results['has_depth_score']:
                if results['rms_value'] is not None and results['depth_value'] is not None:
                    results['quality_passed'] = (results['rms_value'] <= 1.5 and results['depth_value'] >= 0.85)
        else:
            results['issues'].append(("ERROR", "품질 메트릭 섹션 누락"))
        
    except Exception as e:
        results['issues'].append(("ERROR", f"메타데이터 읽기 실패: {e}"))
    
    return results

def find_depth_map(element_id: str, output_dir: Path) -> Path:
    """깊이 맵 파일 찾기"""
    depth_dir = output_dir / element_id / "depth"
    if depth_dir.exists():
        exr_files = list(depth_dir.glob("*.exr"))
        if exr_files:
            return exr_files[0]
    return None

def validate_existing_renders(output_dir="./output/synthetic"):
    """기존 렌더링 결과 검증"""
    print("=" * 60)
    print("기존 렌더링 결과 검증")
    print("=" * 60)
    
    output_path = Path(output_dir)
    if not output_path.exists():
        print(f"출력 디렉토리 없음: {output_path}")
        return
    
    # 모든 element_id 디렉토리 찾기
    element_dirs = [d for d in output_path.iterdir() if d.is_dir() and d.name.isdigit()]
    
    if not element_dirs:
        print("렌더링 결과 없음")
        return
    
    print(f"\n발견된 렌더링 결과: {len(element_dirs)}개")
    
    all_results = []
    
    for element_dir in element_dirs[:5]:  # 최대 5개만 검증
        element_id = element_dir.name
        print(f"\n{'='*60}")
        print(f"부품 검증: {element_id}")
        print(f"{'='*60}")
        
        # 메타데이터 파일 찾기
        meta_dir = element_dir / "meta"
        if not meta_dir.exists():
            print(f"[WARNING] 메타디렉토리 없음: {meta_dir}")
            continue
        
        meta_files = list(meta_dir.glob("*.json"))
        if not meta_files:
            print(f"[WARNING] 메타데이터 파일 없음")
            continue
        
        # 첫 번째 메타데이터 파일 검증
        meta_file = meta_files[0]
        print(f"\n메타데이터 파일: {meta_file.name}")
        
        result = validate_single_meta(meta_file)
        all_results.append(result)
        
        # 결과 출력
        if result['has_camera_params']:
            print("✅ 카메라 파라미터: 존재")
        else:
            print("[ERROR] 카메라 파라미터: 누락")
        
        if result['has_quality_metrics']:
            print("✅ 품질 메트릭: 존재")
        else:
            print("[ERROR] 품질 메트릭: 누락")
        
        if result['has_rms']:
            rms = result['rms_value']
            status = "✅" if rms <= 1.5 else "[WARNING]"
            print(f"{status} RMS: {rms:.3f}px (기준: ≤1.5px)")
        else:
            print("[ERROR] RMS: 누락")
        
        if result['has_depth_score']:
            depth = result['depth_value']
            status = "✅" if depth >= 0.85 else "[WARNING]"
            print(f"{status} Depth: {depth:.4f} (기준: ≥0.85)")
        else:
            print("[ERROR] Depth: 누락")
        
        if result['quality_passed']:
            print("✅ 품질 기준: 통과")
        elif result['has_rms'] and result['has_depth_score']:
            print("[WARNING] 품질 기준: 미달")
        
        # 깊이 맵 파일 확인
        depth_file = find_depth_map(element_id, output_path)
        if depth_file:
            size_mb = depth_file.stat().st_size / (1024 * 1024)
            print(f"✅ 깊이 맵: {depth_file.name} ({size_mb:.2f} MB)")
        else:
            print("[WARNING] 깊이 맵: 없음 (새로 렌더링 필요)")
        
        # 이슈 출력
        if result['issues']:
            for issue_type, msg in result['issues']:
                if issue_type == "ERROR":
                    print(f"  [ERROR] {msg}")
                elif issue_type == "WARNING":
                    print(f"  [WARNING] {msg}")
    
    # 종합 통계
    print(f"\n{'='*60}")
    print("종합 통계")
    print(f"{'='*60}")
    
    total = len(all_results)
    has_camera = sum(1 for r in all_results if r['has_camera_params'])
    has_quality = sum(1 for r in all_results if r['has_quality_metrics'])
    has_rms = sum(1 for r in all_results if r['has_rms'])
    has_depth = sum(1 for r in all_results if r['has_depth_score'])
    passed = sum(1 for r in all_results if r['quality_passed'])
    
    print(f"검증 샘플: {total}개")
    print(f"카메라 파라미터: {has_camera}/{total} ({has_camera*100//total if total > 0 else 0}%)")
    print(f"품질 메트릭: {has_quality}/{total} ({has_quality*100//total if total > 0 else 0}%)")
    print(f"RMS 값: {has_rms}/{total} ({has_rms*100//total if total > 0 else 0}%)")
    print(f"Depth 값: {has_depth}/{total} ({has_depth*100//total if total > 0 else 0}%)")
    print(f"품질 기준 통과: {passed}/{total} ({passed*100//total if total > 0 else 0}%)")
    
    # RMS 및 Depth 평균 계산
    rms_values = [r['rms_value'] for r in all_results if r['rms_value'] is not None]
    depth_values = [r['depth_value'] for r in all_results if r['depth_value'] is not None]
    
    if rms_values:
        avg_rms = sum(rms_values) / len(rms_values)
        print(f"\nRMS 평균: {avg_rms:.3f}px (기준: ≤1.5px)")
        passed_rms = sum(1 for v in rms_values if v <= 1.5)
        print(f"RMS 기준 통과: {passed_rms}/{len(rms_values)} ({passed_rms*100//len(rms_values) if rms_values else 0}%)")
    
    if depth_values:
        avg_depth = sum(depth_values) / len(depth_values)
        print(f"Depth 평균: {avg_depth:.4f} (기준: ≥0.85)")
        passed_depth = sum(1 for v in depth_values if v >= 0.85)
        print(f"Depth 기준 통과: {passed_depth}/{len(depth_values)} ({passed_depth*100//len(depth_values) if depth_values else 0}%)")
    
    # 결과 저장
    report_path = Path("output/existing_renders_validation.json")
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump({
            'summary': {
                'total': total,
                'has_camera_params': has_camera,
                'has_quality_metrics': has_quality,
                'has_rms': has_rms,
                'has_depth_score': has_depth,
                'quality_passed': passed,
                'avg_rms': avg_rms if rms_values else None,
                'avg_depth': avg_depth if depth_values else None
            },
            'results': all_results
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\n상세 보고서 저장: {report_path}")

def main():
    """메인 함수"""
    validate_existing_renders()

if __name__ == "__main__":
    main()


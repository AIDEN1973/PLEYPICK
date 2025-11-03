#!/usr/bin/env python3
"""
데이터셋 품질 검증 스크립트
메타데이터 v2.0-draft 기준으로 품질 검증 수행
"""

import os
import json
import math
from pathlib import Path
from typing import Dict, List, Tuple
import argparse

def validate_quality_standards(ssim: float, snr: float, rms: float, depth: float) -> Dict[str, bool]:
    """품질 기준 검증 (메타데이터 v2.0-draft 기준)"""
    return {
        'ssim_pass': ssim >= 0.96,
        'snr_pass': snr >= 30.0,
        'rms_pass': rms <= 1.5,
        'depth_pass': depth >= 0.85,
        'overall_pass': ssim >= 0.96 and snr >= 30.0 and rms <= 1.5 and depth >= 0.85
    }

def validate_label_file(label_path: Path) -> List[str]:
    """라벨 파일 검증"""
    issues = []
    
    try:
        with open(label_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        if not lines:
            issues.append(f"빈 라벨 파일: {label_path}")
            return issues
        
        for line_num, line in enumerate(lines, 1):
            parts = line.strip().split()
            if len(parts) < 5:
                issues.append(f"잘못된 라벨 형식 {label_path}:{line_num}")
                continue
            
            # 클래스 ID 검증
            try:
                class_id = int(parts[0])
                if class_id < 0:
                    issues.append(f"음수 클래스 ID {label_path}:{line_num}")
                    continue
            except ValueError:
                issues.append(f"잘못된 클래스 ID {label_path}:{line_num}")
                continue
            
            # 좌표 검증 (NaN/Inf 체크)
            try:
                coords = [float(x) for x in parts[1:]]
                if any(math.isnan(x) or math.isinf(x) for x in coords):
                    issues.append(f"NaN/Inf 좌표 {label_path}:{line_num}")
                    continue
                if any(x < 0 or x > 1 for x in coords):
                    issues.append(f"범위 초과 좌표 {label_path}:{line_num}")
                    continue
            except ValueError:
                issues.append(f"잘못된 좌표 형식 {label_path}:{line_num}")
                continue
    
    except Exception as e:
        issues.append(f"라벨 파일 읽기 오류 {label_path}: {e}")
    
    return issues

def validate_metadata_quality(meta_path: Path) -> Tuple[List[str], Dict[str, float]]:
    """메타데이터 품질 검증"""
    issues = []
    quality_metrics = {}
    
    try:
        with open(meta_path, 'r', encoding='utf-8') as f:
            meta = json.load(f)
        
        # 품질 지표 추출
        quality = meta.get('quality', {})
        ssim = quality.get('ssim', 0.0)
        snr = quality.get('snr', 0.0)
        rms = quality.get('rms', 0.0)
        depth = quality.get('depth_score', 0.0)
        
        quality_metrics = {
            'ssim': ssim,
            'snr': snr,
            'rms': rms,
            'depth': depth
        }
        
        # 품질 기준 검증
        quality_check = validate_quality_standards(ssim, snr, rms, depth)
        if not quality_check['overall_pass']:
            issues.append(f"품질 기준 미달 {meta_path}: SSIM={ssim:.3f}, SNR={snr:.1f}, RMS={rms:.3f}, Depth={depth:.3f}")
    
    except Exception as e:
        issues.append(f"메타데이터 읽기 오류 {meta_path}: {e}")
    
    return issues, quality_metrics

def validate_dataset_structure(dataset_path: Path) -> List[str]:
    """데이터셋 구조 검증"""
    issues = []
    
    # 필수 디렉토리 확인
    required_dirs = ['images/train', 'images/val', 'images/test', 'labels/train', 'labels/val', 'labels/test']
    for dir_path in required_dirs:
        full_path = dataset_path / dir_path
        if not full_path.exists():
            issues.append(f"필수 디렉토리 누락: {full_path}")
    
    # dataset.yaml 확인
    yaml_file = dataset_path / 'dataset.yaml'
    if not yaml_file.exists():
        issues.append(f"dataset.yaml 파일 누락: {yaml_file}")
    else:
        try:
            import yaml
            with open(yaml_file, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            
            required_keys = ['train', 'val', 'test', 'nc', 'names']
            for key in required_keys:
                if key not in config:
                    issues.append(f"dataset.yaml에 필수 키 누락: {key}")
        except Exception as e:
            issues.append(f"dataset.yaml 읽기 오류: {e}")
    
    return issues

def validate_dataset_quality(dataset_path: str) -> bool:
    """데이터셋 품질 종합 검증"""
    dataset_dir = Path(dataset_path)
    
    if not dataset_dir.exists():
        print(f"[ERROR] 데이터셋 경로가 존재하지 않습니다: {dataset_path}")
        return False
    
    print(f"[VALIDATE] 데이터셋 품질 검증 시작: {dataset_path}")
    
    all_issues = []
    total_files = 0
    valid_files = 0
    quality_stats = {'ssim': [], 'snr': [], 'rms': [], 'depth': []}
    
    # 구조 검증
    structure_issues = validate_dataset_structure(dataset_dir)
    all_issues.extend(structure_issues)
    
    # 이미지와 라벨 파일 검증
    for split in ['train', 'val', 'test']:
        images_dir = dataset_dir / "images" / split
        labels_dir = dataset_dir / "labels" / split
        
        if not images_dir.exists() or not labels_dir.exists():
            continue
        
        for image_file in images_dir.glob('*.webp'):
            total_files += 1
            label_file = labels_dir / image_file.with_suffix('.txt').name
            
            if not label_file.exists():
                all_issues.append(f"라벨 파일 누락: {label_file}")
                continue
            
            # 라벨 파일 검증
            label_issues = validate_label_file(label_file)
            all_issues.extend(label_issues)
            
            # 메타데이터 품질 검증 (있는 경우)
            meta_file = dataset_dir / "meta" / image_file.stem / f"{image_file.stem}.json"
            if meta_file.exists():
                meta_issues, quality_metrics = validate_metadata_quality(meta_file)
                all_issues.extend(meta_issues)
                
                # 품질 통계 수집
                for key, value in quality_metrics.items():
                    quality_stats[key].append(value)
            
            if not label_issues:
                valid_files += 1
    
    # 품질 통계 리포트
    if quality_stats['ssim']:
        avg_ssim = sum(quality_stats['ssim']) / len(quality_stats['ssim'])
        avg_snr = sum(quality_stats['snr']) / len(quality_stats['snr'])
        avg_rms = sum(quality_stats['rms']) / len(quality_stats['rms'])
        avg_depth = sum(quality_stats['depth']) / len(quality_stats['depth'])
        
        print(f"[QUALITY] 평균 품질 지표:")
        print(f"  - SSIM: {avg_ssim:.3f} (기준: ≥0.96)")
        print(f"  - SNR: {avg_snr:.1f} (기준: ≥30.0)")
        print(f"  - RMS: {avg_rms:.3f} (기준: ≤1.5)")
        print(f"  - Depth: {avg_depth:.3f} (기준: ≥0.85)")
        
        # 품질 기준 통과율 계산
        pass_count = 0
        for i in range(len(quality_stats['ssim'])):
            if validate_quality_standards(
                quality_stats['ssim'][i],
                quality_stats['snr'][i],
                quality_stats['rms'][i],
                quality_stats['depth'][i]
            )['overall_pass']:
                pass_count += 1
        
        pass_rate = (pass_count / len(quality_stats['ssim'])) * 100
        print(f"  - 품질 기준 통과율: {pass_rate:.1f}% ({pass_count}/{len(quality_stats['ssim'])}개)")
    
    # 결과 리포트
    print(f"[STATS] 검증 완료: {valid_files}/{total_files} 파일 유효")
    if all_issues:
        print(f"[WARN] {len(all_issues)}개 문제 발견:")
        for issue in all_issues[:20]:  # 최대 20개만 표시
            print(f"  - {issue}")
        if len(all_issues) > 20:
            print(f"  ... 및 {len(all_issues) - 20}개 추가 문제")
    else:
        print("[OK] 데이터셋 품질 검증 통과")
    
    return len(all_issues) == 0

def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(description='데이터셋 품질 검증')
    parser.add_argument('dataset_path', help='검증할 데이터셋 경로')
    
    args = parser.parse_args()
    
    success = validate_dataset_quality(args.dataset_path)
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())


#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dataset_synthetic 품질 검증 스크립트
- 이미지 품질 검증 (WebP, 해상도, 크기)
- 라벨 품질 검증 (bbox 유효성, 좌표 정확도)
- 메타데이터 품질 검증 (QA 플래그, 품질 지표)
- EXR 파일 품질 검증 (압축, 크기)
"""

import os
import json
import sys
from pathlib import Path
from collections import defaultdict
from PIL import Image
import statistics

# Windows 콘솔 인코딩 설정
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

def validate_dataset_quality(base_path="output/synthetic/dataset_synthetic"):
    """dataset_synthetic 품질 검증"""
    
    base = Path(base_path)
    if not base.exists():
        print(f"[ERROR] 경로가 존재하지 않습니다: {base_path}")
        return False
    
    errors = []
    warnings = []
    stats = defaultdict(list)
    qa_flags = defaultdict(int)
    
    print("=" * 80)
    print("dataset_synthetic 품질 검증")
    print("=" * 80)
    print(f"검증 경로: {base.absolute()}")
    print()
    
    images_train = base / 'images' / 'train'
    labels_train = base / 'labels' / 'train'
    meta_dir = base / 'meta'
    meta_e_dir = base / 'meta-e'
    depth_dir = base / 'depth'
    
    # 부품 폴더 찾기
    element_folders = [d for d in images_train.iterdir() if d.is_dir()] if images_train.exists() else []
    
    for element_folder in element_folders:
        element_id = element_folder.name
        print(f"[품질 검증] 부품: {element_id}")
        
        images_path = images_train / element_id
        labels_path = labels_train / element_id
        meta_path = meta_dir / element_id
        meta_e_path = meta_e_dir / element_id
        depth_path = depth_dir / element_id
        
        # 1. 이미지 품질 검증
        print("  [1] 이미지 품질 검증")
        image_files = sorted(images_path.glob('*.webp')) if images_path.exists() else []
        
        for img_file in image_files:
            try:
                with Image.open(img_file) as img:
                    width, height = img.size
                    file_size = img_file.stat().st_size
                    
                    stats['image_widths'].append(width)
                    stats['image_heights'].append(height)
                    stats['image_sizes'].append(file_size)
                    
                    # 해상도 검증
                    if width < 640 or height < 640:
                        warnings.append(f"{img_file.name}: 해상도 낮음 ({width}x{height})")
                    
                    # 파일 크기 검증 (WebP Q90 기준)
                    size_kb = file_size / 1024
                    if size_kb < 5:
                        warnings.append(f"{img_file.name}: 파일 크기 비정상적으로 작음 ({size_kb:.2f} KB)")
                    elif size_kb > 500:
                        warnings.append(f"{img_file.name}: 파일 크기 비정상적으로 큼 ({size_kb:.2f} KB)")
                    
                    # WebP 형식 확인
                    if img.format != 'WEBP':
                        errors.append(f"{img_file.name}: WebP 형식 아님 ({img.format})")
            
            except Exception as e:
                errors.append(f"{img_file.name}: 이미지 읽기 오류: {e}")
        
        if image_files:
            avg_width = statistics.mean(stats['image_widths'])
            avg_height = statistics.mean(stats['image_heights'])
            avg_size_kb = statistics.mean(stats['image_sizes']) / 1024
            print(f"    ✓ 이미지: {len(image_files)}개")
            print(f"    - 평균 해상도: {avg_width:.0f}x{avg_height:.0f}")
            print(f"    - 평균 크기: {avg_size_kb:.2f} KB")
        
        # 2. 라벨 품질 검증
        print("  [2] 라벨 품질 검증")
        label_files = sorted(labels_path.glob('*.txt')) if labels_path.exists() else []
        
        for label_file in label_files:
            try:
                with open(label_file, 'r') as f:
                    lines = f.readlines()
                
                if not lines:
                    warnings.append(f"{label_file.name}: 빈 라벨 파일")
                    continue
                
                for line_num, line in enumerate(lines, 1):
                    line = line.strip()
                    if not line:
                        continue
                    
                    parts = line.split()
                    if len(parts) < 5:
                        continue
                    
                    try:
                        class_id = int(parts[0])
                        center_x = float(parts[1])
                        center_y = float(parts[2])
                        width = float(parts[3])
                        height = float(parts[4])
                        
                        # Bbox 유효성 검증
                        x_min = center_x - width / 2
                        x_max = center_x + width / 2
                        y_min = center_y - height / 2
                        y_max = center_y + height / 2
                        
                        if not (0 <= x_min < x_max <= 1 and 0 <= y_min < y_max <= 1):
                            errors.append(f"{label_file.name}:{line_num}: bbox 범위 오류 (x:[{x_min:.3f}, {x_max:.3f}], y:[{y_min:.3f}, {y_max:.3f}])")
                        
                        # Bbox 크기 검증 (너무 작거나 큰 bbox)
                        bbox_area = width * height
                        stats['bbox_areas'].append(bbox_area)
                        
                        if bbox_area < 0.01:
                            warnings.append(f"{label_file.name}:{line_num}: bbox 너무 작음 (area={bbox_area:.4f})")
                        elif bbox_area > 0.95:
                            warnings.append(f"{label_file.name}:{line_num}: bbox 너무 큼 (area={bbox_area:.4f})")
                        
                        # Segmentation polygon 검증
                        if len(parts) > 5:
                            polygon_coords = [float(x) for x in parts[5:]]
                            if len(polygon_coords) % 2 != 0:
                                errors.append(f"{label_file.name}:{line_num}: 폴리곤 좌표 개수 오류")
                            
                            # 폴리곤 좌표 범위
                            for coord in polygon_coords:
                                if not (0 <= coord <= 1):
                                    warnings.append(f"{label_file.name}:{line_num}: 폴리곤 좌표 범위 초과 ({coord:.3f})")
                    
                    except (ValueError, IndexError) as e:
                        errors.append(f"{label_file.name}:{line_num}: 파싱 오류: {e}")
            
            except Exception as e:
                errors.append(f"{label_file.name}: 파일 읽기 오류: {e}")
        
        if label_files:
            print(f"    ✓ 라벨: {len(label_files)}개")
            if stats['bbox_areas']:
                avg_area = statistics.mean(stats['bbox_areas'])
                print(f"    - 평균 bbox 면적: {avg_area:.4f}")
        
        # 3. 메타데이터 품질 검증
        print("  [3] 메타데이터 품질 검증")
        meta_files = sorted(meta_path.glob('*.json')) if meta_path.exists() else []
        meta_e_files = sorted(meta_e_path.glob('*_e2.json')) if meta_e_path.exists() else []
        
        for meta_file in meta_files:
            try:
                with open(meta_file, 'r', encoding='utf-8') as f:
                    meta = json.load(f)
                
                # QA 플래그 수집
                if 'qa_flag' in meta:
                    qa_flags[meta['qa_flag']] += 1
                
                # 품질 지표 수집
                if 'reprojection_rms_px' in meta:
                    rms = meta['reprojection_rms_px']
                    stats['rms_values'].append(rms)
                    if rms > 1.5:
                        warnings.append(f"{meta_file.name}: RMS 높음 ({rms:.3f}px)")
                
                if 'ssim' in meta:
                    ssim = meta['ssim']
                    stats['ssim_values'].append(ssim)
                    if ssim < 0.965:
                        warnings.append(f"{meta_file.name}: SSIM 낮음 ({ssim:.4f})")
                
                if 'snr' in meta:
                    snr = meta['snr']
                    stats['snr_values'].append(snr)
                    if snr < 30:
                        warnings.append(f"{meta_file.name}: SNR 낮음 ({snr:.2f} dB)")
                
                if 'depth_quality_score' in meta:
                    depth_score = meta['depth_quality_score']
                    stats['depth_scores'].append(depth_score)
                    if depth_score < 0.5:
                        warnings.append(f"{meta_file.name}: Depth 품질 낮음 ({depth_score:.3f})")
            
            except Exception as e:
                errors.append(f"{meta_file.name}: 메타데이터 읽기 오류: {e}")
        
        # 메타-E 품질 검증
        for meta_e_file in meta_e_files:
            try:
                with open(meta_e_file, 'r', encoding='utf-8') as f:
                    meta_e = json.load(f)
                
                # QA 플래그 수집
                if 'qa_flag' in meta_e:
                    qa_flags[meta_e['qa_flag']] += 1
                elif 'qa' in meta_e and 'qa_flag' in meta_e['qa']:
                    qa_flags[meta_e['qa']['qa_flag']] += 1
                
                # 품질 지표 수집
                if 'reprojection_rms_px' in meta_e:
                    rms = meta_e['reprojection_rms_px']
                    if rms not in stats['rms_values']:
                        stats['rms_values'].append(rms)
                
                if 'ssim' in meta_e:
                    ssim = meta_e['ssim']
                    if ssim not in stats['ssim_values']:
                        stats['ssim_values'].append(ssim)
            
            except Exception as e:
                errors.append(f"{meta_e_file.name}: 메타-E 읽기 오류: {e}")
        
        if meta_files or meta_e_files:
            print(f"    ✓ 메타: {len(meta_files)}개, 메타-E: {len(meta_e_files)}개")
        
        # 4. EXR 파일 품질 검증
        print("  [4] EXR 파일 품질 검증")
        depth_files = sorted(depth_path.glob('*.exr')) if depth_path.exists() else []
        
        for depth_file in depth_files:
            try:
                file_size = depth_file.stat().st_size
                size_kb = file_size / 1024
                
                stats['depth_sizes'].append(file_size)
                
                # EXR 파일 크기 검증 (단일 채널 + ZIP 압축 기준: 150-200KB)
                if size_kb < 50:
                    warnings.append(f"{depth_file.name}: EXR 파일 크기 비정상적으로 작음 ({size_kb:.2f} KB)")
                elif size_kb > 500:
                    errors.append(f"{depth_file.name}: EXR 파일 크기 비정상적으로 큼 ({size_kb:.2f} KB) - 압축 미적용 가능성")
                elif size_kb > 300:
                    warnings.append(f"{depth_file.name}: EXR 파일 크기 큼 ({size_kb:.2f} KB) - 압축 확인 필요")
            
            except Exception as e:
                errors.append(f"{depth_file.name}: EXR 파일 읽기 오류: {e}")
        
        if depth_files:
            avg_depth_size_kb = statistics.mean(stats['depth_sizes']) / 1024 if stats['depth_sizes'] else 0
            print(f"    ✓ EXR: {len(depth_files)}개")
            print(f"    - 평균 크기: {avg_depth_size_kb:.2f} KB")
            
            # 압축 상태 추정
            if stats['image_widths'] and stats['image_heights']:
                avg_resolution = statistics.mean(stats['image_widths']) * statistics.mean(stats['image_heights'])
                uncompressed_size = avg_resolution * 4  # 32bit float = 4 bytes
                if stats['depth_sizes']:
                    avg_compressed = statistics.mean(stats['depth_sizes'])
                    compression_ratio = uncompressed_size / avg_compressed if avg_compressed > 0 else 0
                    print(f"    - 압축률: {compression_ratio:.2f}x")
                    if compression_ratio < 2.0:
                        warnings.append(f"EXR 압축률 낮음 ({compression_ratio:.2f}x) - ZIP 압축 확인 필요")
    
    print()
    
    # 5. 전체 품질 지표 요약
    print("=" * 80)
    print("품질 지표 요약")
    print("=" * 80)
    
    if stats['image_widths']:
        print(f"이미지 해상도: {statistics.mean(stats['image_widths']):.0f}x{statistics.mean(stats['image_heights']):.0f} (평균)")
        print(f"이미지 크기: {statistics.mean(stats['image_sizes']) / 1024:.2f} KB (평균)")
    
    if stats['bbox_areas']:
        print(f"Bbox 면적: {statistics.mean(stats['bbox_areas']):.4f} (평균)")
    
    if stats['rms_values']:
        avg_rms = statistics.mean(stats['rms_values'])
        print(f"재투영 RMS: {avg_rms:.3f}px (평균)")
        if avg_rms <= 1.5:
            print("  ✓ RMS 품질 양호 (≤1.5px)")
        else:
            print("  ⚠ RMS 품질 주의 (>1.5px)")
    
    if stats['ssim_values']:
        avg_ssim = statistics.mean(stats['ssim_values'])
        print(f"SSIM: {avg_ssim:.4f} (평균)")
        if avg_ssim >= 0.965:
            print("  ✓ SSIM 품질 양호 (≥0.965)")
        else:
            print("  ⚠ SSIM 품질 주의 (<0.965)")
    
    if stats['snr_values']:
        avg_snr = statistics.mean(stats['snr_values'])
        print(f"SNR: {avg_snr:.2f} dB (평균)")
        if avg_snr >= 30:
            print("  ✓ SNR 품질 양호 (≥30 dB)")
        else:
            print("  ⚠ SNR 품질 주의 (<30 dB)")
    
    if stats['depth_scores']:
        avg_depth = statistics.mean(stats['depth_scores'])
        print(f"Depth 품질 점수: {avg_depth:.3f} (평균)")
    
    if stats['depth_sizes']:
        avg_depth_size = statistics.mean(stats['depth_sizes']) / 1024
        print(f"EXR 파일 크기: {avg_depth_size:.2f} KB (평균)")
        if 150 <= avg_depth_size <= 200:
            print("  ✓ EXR 크기 정상 (150-200KB)")
        else:
            print("  ⚠ EXR 크기 주의 (150-200KB 범위 밖)")
    
    print()
    
    # QA 플래그 분포
    if qa_flags:
        print("QA 플래그 분포:")
        total_qa = sum(qa_flags.values())
        for flag, count in sorted(qa_flags.items()):
            percentage = (count / total_qa) * 100 if total_qa > 0 else 0
            print(f"  - {flag}: {count}개 ({percentage:.1f}%)")
        
        pass_count = qa_flags.get('PASS', 0)
        pass_rate = (pass_count / total_qa) * 100 if total_qa > 0 else 0
        print(f"  PASS 비율: {pass_rate:.1f}%")
        if pass_rate >= 80:
            print("  ✓ PASS 비율 양호 (≥80%)")
        else:
            print("  ⚠ PASS 비율 주의 (<80%)")
    
    print()
    
    # 6. 오류 및 경고 요약
    print("=" * 80)
    print("검증 결과")
    print("=" * 80)
    
    if errors:
        print(f"오류: {len(errors)}개")
        for error in errors[:10]:
            print(f"  ✗ {error}")
        if len(errors) > 10:
            print(f"  ... 외 {len(errors) - 10}개 오류")
        print()
    
    if warnings:
        print(f"경고: {len(warnings)}개")
        for warning in warnings[:10]:
            print(f"  ⚠ {warning}")
        if len(warnings) > 10:
            print(f"  ... 외 {len(warnings) - 10}개 경고")
        print()
    
    if not errors and not warnings:
        print("✓ 모든 품질 검증 통과!")
        quality_score = 100
    elif not errors:
        print("⚠ 경고만 있음 (학습 가능)")
        quality_score = 80 - min(len(warnings) * 2, 20)
    else:
        print("✗ 오류 발견 (품질 개선 필요)")
        quality_score = max(0, 60 - len(errors) * 5)
    
    print()
    print(f"품질 점수: {quality_score}/100")
    
    return quality_score >= 60

if __name__ == '__main__':
    import sys
    base_path = sys.argv[1] if len(sys.argv) > 1 else "output/synthetic/dataset_synthetic"
    success = validate_dataset_quality(base_path)
    sys.exit(0 if success else 1)

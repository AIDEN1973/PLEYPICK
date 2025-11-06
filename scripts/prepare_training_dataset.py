#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
데이터셋 train/val/test 분할 스크립트
세트 렌더링 완료 후 전체 데이터셋을 train/val/test로 분할합니다 (기술문서 2.2: 80/10/10).
"""

import os
import sys
import shutil
import random
import argparse
from pathlib import Path


def split_dataset(source_dir, output_dir=None, train_ratio=0.8, val_ratio=0.1, test_ratio=0.1, min_files=10):
    """
    데이터셋을 train/val/test로 분할 (기술문서 2.2: 기본 80/10/10)
    
    Args:
        source_dir: 소스 디렉토리 (dataset_synthetic)
        output_dir: 출력 디렉토리 (기본값: source_dir과 동일)
        train_ratio: train 비율 (기본값: 0.8)
        val_ratio: val 비율 (기본값: 0.1)
        test_ratio: test 비율 (기본값: 0.1)
        min_files: 최소 파일 수 (기본값: 10)
    """
    if output_dir is None:
        output_dir = source_dir
    
    source_path = Path(source_dir)
    output_path = Path(output_dir)
    
    if not source_path.exists():
        print(f"ERROR: 소스 디렉토리가 없습니다: {source_dir}")
        return False
    
    # [FIX] 수정됨: 새 구조 지원 (dataset_synthetic/{element_id}/images)
    # 기존 구조도 호환성 유지 (dataset_synthetic/images/train/{element_id})
    
    # 새 구조 확인: dataset_synthetic/{element_id}/images
    part_dirs = []
    is_old_structure = True  # 기본값은 기존 구조
    images_train_dir = None
    labels_dir = None
    
    # [FIX] 수정됨: source_path가 output/synthetic인 경우 dataset_synthetic 하위 경로 확인
    # API에서 sourcePath='output/synthetic'로 전달되지만, 실제 부품 폴더는 dataset_synthetic/{element_id}/에 있음
    dataset_synthetic_path = source_path
    if not (source_path / 'images' / 'train').exists() and (source_path / 'dataset_synthetic').exists():
        # source_path가 output/synthetic인 경우 dataset_synthetic 하위 경로 사용
        dataset_synthetic_path = source_path / 'dataset_synthetic'
        print(f"[INFO] dataset_synthetic 하위 경로 사용: {dataset_synthetic_path}")
    
    if (dataset_synthetic_path / 'images' / 'train').exists():
        # 기존 구조: dataset_synthetic/images/train/{element_id}
        images_train_dir = dataset_synthetic_path / 'images' / 'train'
        part_dirs = [(element_dir, True) for element_dir in images_train_dir.iterdir() if element_dir.is_dir()]
        labels_dir = dataset_synthetic_path / 'labels' / 'train'
        print(f"[INFO] 기존 구조 감지: images/train/{'{element_id}'}")
        is_old_structure = True
    else:
        # 새 구조: dataset_synthetic/{element_id}/images
        part_dirs = [(part_dir, False) for part_dir in dataset_synthetic_path.iterdir() 
                     if part_dir.is_dir() and (part_dir / 'images').exists()]
        print(f"[INFO] 새 구조 감지: {'{element_id}'}/images")
        is_old_structure = False
    
    if not part_dirs:
        print(f"WARN: 부품 폴더를 찾을 수 없습니다: {dataset_synthetic_path}")
        print(f"[DEBUG] 확인한 경로:")
        print(f"  - 소스 경로: {source_path}")
        print(f"  - dataset_synthetic 경로: {dataset_synthetic_path}")
        if dataset_synthetic_path.exists():
            print(f"  - 하위 항목: {list(dataset_synthetic_path.iterdir())[:10]}")
        return False
    
    total_moved = 0
    total_elements = 0
    
    # 각 element_id별로 분할
    for element_dir, is_old in part_dirs:
        element_id = element_dir.name
        print(f"\n[INFO] 부품 {element_id} 처리 중...")
        
        # 새 구조: element_dir/images/*.png
        # 기존 구조: element_dir/*.webp (이미 train 폴더 내부)
        if is_old:
            train_files = list(element_dir.glob('*.webp')) + list(element_dir.glob('*.png'))
            labels_dir_for_part = dataset_synthetic_path / 'labels' / 'train' / element_id
        else:
            train_files = list((element_dir / 'images').glob('*.png')) + list((element_dir / 'images').glob('*.webp'))
            labels_dir_for_part = element_dir / 'labels'
        
        if len(train_files) < min_files:
            print(f"[INFO] 파일 수 부족 ({len(train_files)}개 < {min_files}개), 분할 건너뜀")
            continue
        
        # val/test 폴더 경로 생성
        if is_old:
            # 기존 구조: dataset_synthetic/images/val/{element_id}, test/{element_id}
            # [FIX] 수정됨: output_path 대신 dataset_synthetic_path 사용
            val_images_dir = dataset_synthetic_path / 'images' / 'val' / element_id
            test_images_dir = dataset_synthetic_path / 'images' / 'test' / element_id
            train_labels_dir = dataset_synthetic_path / 'labels' / 'train' / element_id
            val_labels_dir = dataset_synthetic_path / 'labels' / 'val' / element_id
            test_labels_dir = dataset_synthetic_path / 'labels' / 'test' / element_id
        else:
            # 새 구조: dataset_synthetic/{element_id}/images/train, val, test
            val_images_dir = element_dir / 'images' / 'val'
            test_images_dir = element_dir / 'images' / 'test'
            train_images_dir = element_dir / 'images' / 'train'
            train_labels_dir = element_dir / 'labels' / 'train'
            val_labels_dir = element_dir / 'labels' / 'val'
            test_labels_dir = element_dir / 'labels' / 'test'
        
        # val/test 폴더 생성
        val_images_dir.mkdir(parents=True, exist_ok=True)
        test_images_dir.mkdir(parents=True, exist_ok=True)
        val_labels_dir.mkdir(parents=True, exist_ok=True)
        test_labels_dir.mkdir(parents=True, exist_ok=True)
        
        if not is_old:
            train_images_dir.mkdir(parents=True, exist_ok=True)
            train_labels_dir.mkdir(parents=True, exist_ok=True)
        
        # 파일명 리스트 추출 및 셔플
        train_files_list = [f.name for f in train_files]
        random.shuffle(train_files_list)
        
        # 분할 인덱스 계산 (80/10/10)
        total_files = len(train_files_list)
        train_idx = int(total_files * train_ratio)
        val_idx = train_idx + int(total_files * val_ratio)
        
        train_files_split = train_files_list[:train_idx]
        val_files = train_files_list[train_idx:val_idx]
        test_files = train_files_list[val_idx:]
        
        # 파일 이동 (새 구조는 train/val/test로 분할, 기존 구조는 val/test만 이동)
        if not is_old:
            # [FIX] 수정됨: 새 구조에서는 모든 파일을 이동(move)하여 루트에 중복 파일이 남지 않도록 함
            # 새 구조: 모든 파일을 train/val/test로 분할 (원본 파일은 이동)
            train_moved_count = 0
            for filename in train_files_split:
                src_img = element_dir / 'images' / filename
                dst_img = train_images_dir / filename
                if src_img.exists() and not dst_img.exists():
                    shutil.move(str(src_img), str(dst_img))
                    train_moved_count += 1
                label_filename = filename.replace('.webp', '.txt').replace('.png', '.txt')
                src_label = labels_dir_for_part / label_filename
                if src_label.exists():
                    dst_label = train_labels_dir / label_filename
                    if not dst_label.exists():
                        shutil.move(str(src_label), str(dst_label))
            print(f"[INFO] train 파일 이동: {train_moved_count}개 이미지")
        
        # val 폴더로 이동
        val_moved_count = 0
        for filename in val_files:
            # 이미지 파일 이동
            if is_old:
                src_img = element_dir / filename
            else:
                src_img = element_dir / 'images' / filename
            dst_img = val_images_dir / filename
            
            # 라벨 파일 이동
            label_filename = filename.replace('.webp', '.txt').replace('.png', '.txt')
            if is_old:
                src_label = labels_dir_for_part / label_filename
            else:
                src_label = labels_dir_for_part / label_filename
            dst_label = val_labels_dir / label_filename
            
            try:
                if src_img.exists():
                    shutil.move(str(src_img), str(dst_img))
                if src_label.exists():
                    shutil.move(str(src_label), str(dst_label))
                val_moved_count += 1
            except Exception as e:
                print(f"[WARN] Val 파일 이동 실패: {filename} - {e}")
        
        # test 폴더로 이동
        test_moved_count = 0
        for filename in test_files:
            # 이미지 파일 이동
            if is_old:
                src_img = element_dir / filename
            else:
                src_img = element_dir / 'images' / filename
            dst_img = test_images_dir / filename
            
            # 라벨 파일 이동
            label_filename = filename.replace('.webp', '.txt').replace('.png', '.txt')
            if is_old:
                src_label = labels_dir_for_part / label_filename
            else:
                src_label = labels_dir_for_part / label_filename
            dst_label = test_labels_dir / label_filename
            
            try:
                if src_img.exists():
                    # [FIX] 수정됨: 새 구조에서도 파일 이동(move)하여 루트에 중복 파일이 남지 않도록 함
                    shutil.move(str(src_img), str(dst_img))
                if src_label.exists():
                    # [FIX] 수정됨: 새 구조에서도 파일 이동(move)하여 루트에 중복 파일이 남지 않도록 함
                    shutil.move(str(src_label), str(dst_label))
                test_moved_count += 1
            except Exception as e:
                print(f"[WARN] Test 파일 이동 실패: {filename} - {e}")
        
        # [FIX] 수정됨: 새 구조에서는 train 파일도 이동했으므로 카운트에 포함
        if not is_old:
            train_moved_count_for_total = len(train_files_split)  # train 파일은 위에서 이미 이동됨
        else:
            train_moved_count_for_total = 0  # 기존 구조에서는 train 파일 이동 없음
        
        total_moved += (train_moved_count_for_total + val_moved_count + test_moved_count)
        total_elements += 1
        if not is_old:
            print(f"[INFO] 부품 {element_id}: train {len(train_files_split)}개 (이동 완료), val {len(val_files)}개 (이동: {val_moved_count}개), test {len(test_files)}개 (이동: {test_moved_count}개)")
            
            # [FIX] 수정됨: 새 구조에서 train/val/test 분할 후 dataset.yaml, dataset.json 업데이트
            try:
                import yaml
                import json
                
                # dataset.yaml 업데이트
                dataset_yaml_path = element_dir / 'images' / 'dataset.yaml'
                if dataset_yaml_path.exists():
                    yaml_content = {
                        'path': str(element_dir.absolute()),
                        'train': 'images/train',
                        'val': 'images/val',
                        'test': 'images/test',
                        'nc': 1,
                        'names': ['lego_part']
                    }
                    with open(dataset_yaml_path, 'w', encoding='utf-8') as f:
                        yaml.dump(yaml_content, f, default_flow_style=False, allow_unicode=True)
                    print(f"[INFO] dataset.yaml 업데이트 완료: {dataset_yaml_path}")
                
                # dataset.json 업데이트
                dataset_json_path = element_dir / 'images' / 'dataset.json'
                if dataset_json_path.exists():
                    json_content = {
                        'path': str(element_dir.absolute()),
                        'train': 'images/train',
                        'val': 'images/val',
                        'test': 'images/test',
                        'nc': 1,
                        'names': ['lego_part']
                    }
                    with open(dataset_json_path, 'w', encoding='utf-8') as f:
                        json.dump(json_content, f, ensure_ascii=False, indent=2)
                    print(f"[INFO] dataset.json 업데이트 완료: {dataset_json_path}")
            except Exception as e:
                print(f"[WARN] dataset.yaml/json 업데이트 실패: {e}")
        else:
            print(f"[INFO] 부품 {element_id}: train {len(train_files_split)}개, val {len(val_files)}개 (이동: {val_moved_count}개), test {len(test_files)}개 (이동: {test_moved_count}개)")
    
    print(f"\n[INFO] 전체 분할 완료: {total_elements}개 부품, {total_moved}개 파일 이동")
    return True


def main():
    parser = argparse.ArgumentParser(description='데이터셋 train/val/test 분할 (기술문서 2.2: 80/10/10)')
    parser.add_argument('--source', type=str, required=True, help='소스 디렉토리 (dataset_synthetic)')
    parser.add_argument('--output', type=str, help='출력 디렉토리 (기본값: source와 동일)')
    parser.add_argument('--train-ratio', type=float, default=0.8, help='train 비율 (기본값: 0.8)')
    parser.add_argument('--val-ratio', type=float, default=0.1, help='val 비율 (기본값: 0.1)')
    parser.add_argument('--test-ratio', type=float, default=0.1, help='test 비율 (기본값: 0.1)')
    parser.add_argument('--min-files', type=int, default=10, help='최소 파일 수 (기본값: 10)')
    
    args = parser.parse_args()
    
    # 비율 검증
    total_ratio = args.train_ratio + args.val_ratio + args.test_ratio
    if abs(total_ratio - 1.0) > 0.01:
        print(f"[ERROR] 비율 합이 1.0이 아닙니다: {total_ratio}")
        sys.exit(1)
    
    print(f"[INFO] 데이터셋 train/val/test 분할 시작...")
    print(f"[INFO] 소스: {args.source}")
    print(f"[INFO] 출력: {args.output or args.source}")
    print(f"[INFO] Train 비율: {args.train_ratio}, Val 비율: {args.val_ratio}, Test 비율: {args.test_ratio}")
    
    success = split_dataset(
        args.source,
        args.output,
        args.train_ratio,
        args.val_ratio,
        args.test_ratio,
        args.min_files
    )
    
    if success:
        print("[INFO] 데이터셋 준비 완료")
        sys.exit(0)
    else:
        print("[ERROR] 데이터셋 준비 실패")
        sys.exit(1)


if __name__ == '__main__':
    main()

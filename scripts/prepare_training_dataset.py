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
    
    # images/train/{element_id} 폴더 찾기
    images_train_dir = source_path / 'images' / 'train'
    if not images_train_dir.exists():
        print(f"WARN: images/train 폴더가 없습니다: {images_train_dir}")
        return False
    
    total_moved = 0
    total_elements = 0
    
    # 각 element_id별로 분할
    for element_dir in images_train_dir.iterdir():
        if not element_dir.is_dir():
            continue
        
        element_id = element_dir.name
        print(f"\n[INFO] 부품 {element_id} 처리 중...")
        
        # train 폴더의 모든 webp 파일 가져오기
        train_files = list(element_dir.glob('*.webp'))
        
        if len(train_files) < min_files:
            print(f"[INFO] 파일 수 부족 ({len(train_files)}개 < {min_files}개), 분할 건너뜀")
            continue
        
        # val/test 폴더 경로 생성
        val_images_dir = output_path / 'images' / 'val' / element_id
        test_images_dir = output_path / 'images' / 'test' / element_id
        train_labels_dir = output_path / 'labels' / 'train' / element_id
        val_labels_dir = output_path / 'labels' / 'val' / element_id
        test_labels_dir = output_path / 'labels' / 'test' / element_id
        
        # val/test 폴더 생성
        val_images_dir.mkdir(parents=True, exist_ok=True)
        test_images_dir.mkdir(parents=True, exist_ok=True)
        val_labels_dir.mkdir(parents=True, exist_ok=True)
        test_labels_dir.mkdir(parents=True, exist_ok=True)
        
        # 파일명 리스트 추출 및 셔플
        train_files = [f.name for f in train_files]
        random.shuffle(train_files)
        
        # 분할 인덱스 계산 (80/10/10)
        total_files = len(train_files)
        train_idx = int(total_files * train_ratio)
        val_idx = train_idx + int(total_files * val_ratio)
        
        val_files = train_files[train_idx:val_idx]
        test_files = train_files[val_idx:]
        
        # val 폴더로 이동
        val_moved_count = 0
        for filename in val_files:
            # 이미지 파일 이동
            src_img = element_dir / filename
            dst_img = val_images_dir / filename
            
            # 라벨 파일 이동
            label_filename = filename.replace('.webp', '.txt')
            src_label = train_labels_dir / label_filename
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
            src_img = element_dir / filename
            dst_img = test_images_dir / filename
            
            # 라벨 파일 이동
            label_filename = filename.replace('.webp', '.txt')
            src_label = train_labels_dir / label_filename
            dst_label = test_labels_dir / label_filename
            
            try:
                if src_img.exists():
                    shutil.move(str(src_img), str(dst_img))
                if src_label.exists():
                    shutil.move(str(src_label), str(dst_label))
                test_moved_count += 1
            except Exception as e:
                print(f"[WARN] Test 파일 이동 실패: {filename} - {e}")
        
        total_moved += (val_moved_count + test_moved_count)
        total_elements += 1
        print(f"[INFO] 부품 {element_id}: train {train_idx}개, val {len(val_files)}개 (이동: {val_moved_count}개), test {len(test_files)}개 (이동: {test_moved_count}개)")
    
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

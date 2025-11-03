#!/usr/bin/env python3
"""
데이터셋 구조 변환 스크립트
단일 폴더 구조를 train/val/test 분할 구조로 변환
"""

import os
import shutil
import yaml
from pathlib import Path
import random
from typing import List, Tuple

def convert_single_folder_to_split_structure(source_dir: str, target_dir: str, 
                                           train_ratio: float = 0.8, 
                                           val_ratio: float = 0.1, 
                                           test_ratio: float = 0.1) -> bool:
    """
    단일 폴더 구조를 train/val/test 분할 구조로 변환
    
    Args:
        source_dir: 원본 데이터셋 디렉토리 (예: output/synthetic/6335317/)
        target_dir: 변환된 데이터셋 디렉토리
        train_ratio: 훈련 데이터 비율
        val_ratio: 검증 데이터 비율  
        test_ratio: 테스트 데이터 비율
    """
    try:
        source_path = Path(source_dir)
        target_path = Path(target_dir)
        
        if not source_path.exists():
            print(f"[ERROR] 원본 디렉토리가 존재하지 않습니다: {source_dir}")
            return False
        
        # 대상 디렉토리 생성
        target_path.mkdir(parents=True, exist_ok=True)
        
        # 완벽한 폴더 구조에서 이미지 파일 수집
        images_dir = source_path / 'images'
        if not images_dir.exists():
            print(f"[ERROR] images 디렉토리가 존재하지 않습니다: {images_dir}")
            return False
        
        image_files = []
        for ext in ['*.webp', '*.jpg', '*.jpeg', '*.png']:
            image_files.extend(list(images_dir.glob(ext)))
        
        if not image_files:
            print(f"[ERROR] 이미지 파일을 찾을 수 없습니다: {images_dir}")
            return False
        
        print(f"[INFO] {len(image_files)}개 이미지 파일 발견")
        
        # 파일명으로 정렬하여 일관된 분할 보장
        image_files.sort()
        
        # 분할 인덱스 계산
        total_files = len(image_files)
        train_end = int(total_files * train_ratio)
        val_end = train_end + int(total_files * val_ratio)
        
        # 분할
        train_files = image_files[:train_end]
        val_files = image_files[train_end:val_end]
        test_files = image_files[val_end:]
        
        print(f"[SPLIT] 분할 결과:")
        print(f"  - Train: {len(train_files)}개")
        print(f"  - Val: {len(val_files)}개")
        print(f"  - Test: {len(test_files)}개")
        
        # 디렉토리 구조 생성
        for split in ['train', 'val', 'test']:
            (target_path / 'images' / split).mkdir(parents=True, exist_ok=True)
            (target_path / 'labels' / split).mkdir(parents=True, exist_ok=True)
        
        # 파일 복사
        splits = {
            'train': train_files,
            'val': val_files,
            'test': test_files
        }
        
        for split_name, files in splits.items():
            print(f"[COPY] {split_name} 분할 복사 중...")
            
            # 대상 디렉토리 구조 생성
            images_split_dir = target_path / 'images' / split_name
            labels_split_dir = target_path / 'labels' / split_name
            meta_split_dir = target_path / 'meta' / split_name
            meta_e_split_dir = target_path / 'meta-e' / split_name
            
            for dir_path in [images_split_dir, labels_split_dir, meta_split_dir, meta_e_split_dir]:
                dir_path.mkdir(parents=True, exist_ok=True)
            
            for image_file in files:
                # 이미지 파일 복사
                dst_image = images_split_dir / image_file.name
                shutil.copy2(image_file, dst_image)
                
                # 라벨 파일 복사 (labels 디렉토리에서)
                label_file = source_path / 'labels' / image_file.name.replace('.webp', '.txt').replace('.jpg', '.txt').replace('.jpeg', '.txt').replace('.png', '.txt')
                if label_file.exists():
                    dst_label = labels_split_dir / label_file.name
                    shutil.copy2(label_file, dst_label)
                else:
                    print(f"[WARN] 라벨 파일 없음: {label_file}")
                
                # 메타데이터 JSON 파일 복사 (meta 디렉토리에서)
                json_file = source_path / 'meta' / image_file.name.replace('.webp', '.json').replace('.jpg', '.json').replace('.jpeg', '.json').replace('.png', '.json')
                if json_file.exists():
                    dst_json = meta_split_dir / json_file.name
                    shutil.copy2(json_file, dst_json)
                
                # E2 메타데이터 JSON 파일 복사 (meta-e 디렉토리에서)
                e2_json_file = source_path / 'meta-e' / image_file.name.replace('.webp', '_e2.json').replace('.jpg', '_e2.json').replace('.jpeg', '_e2.json').replace('.png', '_e2.json')
                if e2_json_file.exists():
                    dst_e2_json = meta_e_split_dir / e2_json_file.name
                    shutil.copy2(e2_json_file, dst_e2_json)
        
        # dataset.yaml 생성
        dataset_config = {
            'path': str(target_path.absolute()),
            'train': 'images/train',
            'val': 'images/val',
            'test': 'images/test',
            'nc': 1,  # 단일 클래스
            'names': ['lego_part']
        }
        
        yaml_file = target_path / 'dataset.yaml'
        with open(yaml_file, 'w', encoding='utf-8') as f:
            yaml.dump(dataset_config, f, default_flow_style=False)
        
        print(f"[OK] 데이터셋 구조 변환 완료: {target_path}")
        print(f"[YAML] dataset.yaml 생성: {yaml_file}")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] 데이터셋 구조 변환 실패: {e}")
        return False

def main():
    """메인 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description='데이터셋 구조 변환')
    parser.add_argument('--source', required=True, help='원본 데이터셋 디렉토리')
    parser.add_argument('--target', required=True, help='변환된 데이터셋 디렉토리')
    parser.add_argument('--train_ratio', type=float, default=0.8, help='훈련 데이터 비율')
    parser.add_argument('--val_ratio', type=float, default=0.1, help='검증 데이터 비율')
    parser.add_argument('--test_ratio', type=float, default=0.1, help='테스트 데이터 비율')
    
    args = parser.parse_args()
    
    # 비율 검증
    if abs(args.train_ratio + args.val_ratio + args.test_ratio - 1.0) > 0.001:
        print("[ERROR] 비율의 합이 1.0이어야 합니다.")
        return 1
    
    success = convert_single_folder_to_split_structure(
        args.source, args.target, 
        args.train_ratio, args.val_ratio, args.test_ratio
    )
    
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())

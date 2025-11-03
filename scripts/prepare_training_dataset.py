#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
합성 데이터를 YOLO 학습 형식으로 변환하는 스크립트
"""

import os
import sys
import json
import shutil
import argparse
from pathlib import Path
from typing import List, Dict
import random
from dataset_version_manager import DatasetVersionManager

# 인코딩 설정
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

def convert_json_to_yolo(json_path: str) -> str:
    """JSON 어노테이션을 YOLO 형식으로 변환"""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    bbox = data.get('bounding_box', {})
    polygon_uv = data.get('polygon_uv', [])
    
    # YOLO 형식: class_id center_x center_y width height
    class_id = 0  # 단일 클래스: lego_part
    center_x = bbox.get('center_x', 0.5)
    center_y = bbox.get('center_y', 0.5)
    width = bbox.get('width', 0.7)
    height = bbox.get('height', 0.7)
    
    # Segmentation polygon (optional)
    polygon_str = ""
    if polygon_uv:
        # Flatten polygon coordinates
        coords = []
        for point in polygon_uv:
            coords.extend([point[0], point[1]])
        polygon_str = " " + " ".join([f"{c:.6f}" for c in coords])
    
    return f"{class_id} {center_x:.6f} {center_y:.6f} {width:.6f} {height:.6f}{polygon_str}"

def prepare_dataset(
    source_dir: str = "output/synthetic",
    target_dir: str = "output/dataset_synthetic",
    train_split: float = 0.8,
    force_rebuild: bool = False
):
    """스마트 데이터셋 준비 - 증분 업데이트 지원"""
    source_path = Path(source_dir)
    target_path = Path(target_dir)
    
    print(f"[DIR] 스마트 데이터셋 준비 시작: {source_dir} -> {target_dir}")
    
    # 강제 재생성 모드
    if force_rebuild and target_path.exists():
        print("🗑️ 강제 재생성 모드: 기존 데이터셋 폴더 삭제 중...")
        shutil.rmtree(target_path)
        print("[OK] 기존 데이터셋 폴더 삭제 완료")
    elif target_path.exists():
        print("[RETRY] 증분 업데이트 모드: 기존 데이터셋 유지하고 새 파일만 추가")
    
    # 디렉토리 생성
    (target_path / "images" / "train").mkdir(parents=True, exist_ok=True)
    (target_path / "images" / "val").mkdir(parents=True, exist_ok=True)
    # [FIX] 수정됨: labels는 element_id별로 생성되므로 여기서는 생성하지 않음
    (target_path / "metadata").mkdir(parents=True, exist_ok=True)
    
    print("[DIR] dataset_synthetic 폴더 구조 생성 중...")
    
    # 모든 이미지 파일 수집 (dataset_synthetic 구조 우선, 구 구조 폴백)
    image_files = []
    
    # [FIX] 수정됨: dataset_synthetic 구조 우선 확인
    dataset_synthetic_path = source_path / "dataset_synthetic"
    if dataset_synthetic_path.exists():
        # dataset_synthetic/images/train/{element_id}/ 구조
        train_images_path = dataset_synthetic_path / "images" / "train"
        train_labels_path = dataset_synthetic_path / "labels"
        meta_path = dataset_synthetic_path / "meta"
        meta_e_path = dataset_synthetic_path / "meta-e"
        
        if train_images_path.exists():
            print(f"[DIR] dataset_synthetic 구조 감지: {train_images_path}")
            for element_dir in train_images_path.iterdir():
                if element_dir.is_dir():
                    element_id = element_dir.name
                    images_dir = element_dir
                    labels_dir = train_labels_path / element_id
                    meta_dir = meta_path / element_id
                    meta_e_dir = meta_e_path / element_id
                    
                    for img_file in images_dir.glob("*.webp"):
                        json_file = meta_dir / img_file.with_suffix('.json').name if meta_dir.exists() else None
                        label_file = labels_dir / img_file.with_suffix('.txt').name if labels_dir.exists() else None
                        e2_json_file = meta_e_dir / f"{img_file.stem}_e2.json" if meta_e_dir.exists() else None
                        
                        if json_file and json_file.exists():
                            image_files.append({
                                'image': img_file,
                                'json': json_file,
                                'label': label_file if label_file and label_file.exists() else None,
                                'e2_json': e2_json_file if e2_json_file and e2_json_file.exists() else None
                            })
    
    # 구 구조 폴백: output/synthetic/{element_id}/images/*.webp
    if len(image_files) == 0:
        print(f"[DIR] 구 구조 확인: {source_path}")
        for element_dir in source_path.iterdir():
            if element_dir.is_dir() and not element_dir.name.startswith('.') and element_dir.name != 'dataset_synthetic':
                images_dir = element_dir / "images"
                labels_dir = element_dir / "labels"
                meta_dir = element_dir / "meta"
                meta_e_dir = element_dir / "meta-e"
                
                if images_dir.exists():
                    for img_file in images_dir.glob("*.webp"):
                        json_file = meta_dir / img_file.with_suffix('.json').name if meta_dir.exists() else None
                        label_file = labels_dir / img_file.with_suffix('.txt').name if labels_dir.exists() else None
                        e2_json_file = meta_e_dir / f"{img_file.stem}_e2.json" if meta_e_dir.exists() else None
                        
                        if json_file and json_file.exists():
                            image_files.append({
                                'image': img_file,
                                'json': json_file,
                                'label': label_file if label_file and label_file.exists() else None,
                                'e2_json': e2_json_file if e2_json_file and e2_json_file.exists() else None
                            })
                else:
                    # 구구조 폴백: element_id/*.webp
                    for img_file in element_dir.glob("*.webp"):
                        json_file = img_file.with_suffix('.json')
                        if json_file.exists():
                            image_files.append({
                                'image': img_file,
                                'json': json_file,
                                'label': None,
                                'e2_json': None
                            })
    
    print(f"전체 이미지 수: {len(image_files)}")
    
    # 증분 업데이트 모드: 기존 파일과 비교 (element_id 폴더 구조 고려)
    if target_path.exists() and not force_rebuild:
        existing_files = set()
        # [FIX] 수정됨: element_id 폴더 구조를 고려하여 기존 파일 수집
        for split in ['train', 'val']:
            split_path = target_path / "images" / split
            if split_path.exists():
                for element_dir in split_path.iterdir():
                    if element_dir.is_dir():
                        for img_file in element_dir.glob("*.webp"):
                            # element_id와 파일명을 조합하여 고유 키 생성
                            element_id = element_dir.name
                            existing_files.add(f"{element_id}/{img_file.name}")
        
        # 새 파일만 필터링 (element_id/파일명 조합으로 비교)
        new_image_files = []
        for file_dict in image_files:
            img_file = file_dict['image']
            img_path = Path(img_file)
            
            # element_id 추출 (위와 동일한 로직)
            parts = list(img_path.parts)
            element_id = None
            try:
                train_idx = parts.index('train')
                if train_idx + 1 < len(parts):
                    element_id = parts[train_idx + 1]
            except ValueError:
                try:
                    images_idx = parts.index('images')
                    if images_idx + 1 < len(parts):
                        element_id = parts[images_idx + 1]
                except ValueError:
                    if img_path.parent.name not in ('images', 'train', 'val'):
                        element_id = img_path.parent.name
                    elif img_path.parent.parent.name not in ('images', 'train', 'val', 'dataset_synthetic'):
                        element_id = img_path.parent.parent.name
            
            file_key = f"{element_id}/{img_file.name}" if element_id else img_file.name
            if file_key not in existing_files:
                new_image_files.append(file_dict)
        
        print(f"[RETRY] 증분 업데이트: 새 파일 {len(new_image_files)}개, 기존 파일 {len(existing_files)}개")
        image_files = new_image_files
    
    if len(image_files) == 0:
        print("[ERROR] 처리할 이미지가 없습니다!")
        return
    
    # 랜덤 셔플
    random.shuffle(image_files)
    
    # Train/Val 분할
    split_idx = int(len(image_files) * train_split)
    train_files = image_files[:split_idx]
    val_files = image_files[split_idx:]
    
    print(f"📊 분할 결과:")
    print(f"  - Train: {len(train_files)}개 ({len(train_files)/len(image_files)*100:.1f}%)")
    print(f"  - Val: {len(val_files)}개 ({len(val_files)/len(image_files)*100:.1f}%)")
    print(f"  - 목표 비율: {train_split*100:.0f}%:{100-train_split*100:.0f}%")
    
    # 파일 복사 및 변환 (element_id 폴더 구조 유지)
    copied_images = 0
    copied_labels = 0
    copied_metadata = 0
    
    # [FIX] 수정됨: element_id별로 그룹화하여 폴더 구조 유지
    files_by_element = {}
    for file_dict in image_files:
        img_file = file_dict['image']
        img_path = Path(img_file)
        element_id = None
        
        # element_id 추출: 경로 구조 분석
        parts = list(img_path.parts)
        # dataset_synthetic/images/train/{element_id}/파일명.webp 구조 찾기
        try:
            train_idx = parts.index('train')
            if train_idx + 1 < len(parts):
                element_id = parts[train_idx + 1]
        except ValueError:
            pass
        
        # train이 없으면 images 폴더 다음 찾기
        if not element_id:
            try:
                images_idx = parts.index('images')
                if images_idx + 1 < len(parts):
                    element_id = parts[images_idx + 1]
            except ValueError:
                pass
        
        # 여전히 없으면 부모 디렉토리 이름 사용
        if not element_id:
            # dataset_synthetic 구조가 아닌 경우: {element_id}/images/파일명.webp
            parent = img_path.parent
            if parent.name not in ('images', 'train', 'val'):
                element_id = parent.name
            elif parent.parent.name not in ('images', 'train', 'val', 'dataset_synthetic'):
                element_id = parent.parent.name
            else:
                # 최종 폴백: 파일명에서 추출
                element_id = img_file.stem.split('_')[0] if '_' in img_file.stem else 'unknown'
        
        if element_id not in files_by_element:
            files_by_element[element_id] = {'train': [], 'val': []}
        
        # train/val 분류
        if file_dict in train_files:
            files_by_element[element_id]['train'].append(file_dict)
        elif file_dict in val_files:
            files_by_element[element_id]['val'].append(file_dict)
    
    # element_id별 폴더 구조 유지하며 파일 이동
    for element_id, splits in files_by_element.items():
        for split_name in ['train', 'val']:
            files = splits[split_name]
            if not files:
                continue
                
            # element_id 폴더 생성
            element_img_dir = target_path / "images" / split_name / element_id
            # [FIX] 수정됨: labels는 train/val 구분 없이 labels/{element_id}/ 구조
            element_label_dir = target_path / "labels" / element_id
            
            element_img_dir.mkdir(parents=True, exist_ok=True)
            element_label_dir.mkdir(parents=True, exist_ok=True)
            
            for file_dict in files:
                img_file = file_dict['image']
                json_file = file_dict['json']
                label_file = file_dict.get('label')
                e2_json_file = file_dict.get('e2_json')
                
                # [FIX] 수정됨: 이미지와 라벨을 train/val로 분할
                img_dest = element_img_dir / img_file.name
                img_src_abs = Path(img_file).absolute()
                img_dest_abs = img_dest.absolute()
                
                if split_name == 'train':
                    # train 파일은 이미 dataset_synthetic/images/train/{element_id}/에 있음
                    # source와 target이 같으므로 복사 불필요 (이미 올바른 위치)
                    if img_src_abs == img_dest_abs:
                        copied_images += 1  # 이미 올바른 위치
                    elif not img_dest.exists():
                        # 경로가 다른 경우만 복사 (구 구조에서 새 구조로 변환 시)
                        shutil.copy2(img_file, img_dest)
                        copied_images += 1
                    else:
                        copied_images += 1  # 이미 존재
                else:  # val
                    # val은 train 폴더의 원본 파일을 val 폴더로 복사 (원본 유지)
                    # 원본: dataset_synthetic/images/train/{element_id}/파일.webp
                    # 복사: dataset_synthetic/images/val/{element_id}/파일.webp
                    if not img_dest.exists():
                        # source와 target이 같은 경로면 원본은 train에 있음
                        if img_src_abs == (target_path / "images" / "train" / element_id / img_file.name).absolute():
                            # 같은 파일을 val로 복사 (원본 train 유지)
                            shutil.copy2(img_file, img_dest)
                            copied_images += 1
                        else:
                            # 다른 경로에서 복사
                            shutil.copy2(img_file, img_dest)
                            copied_images += 1
                    else:
                        copied_images += 1  # 이미 존재
                
                # 라벨 파일 처리 (labels/{element_id}/ 구조)
                label_dest = target_path / "labels" / element_id / img_file.with_suffix('.txt').name
                label_src = Path(label_file) if label_file and Path(label_file).exists() else None
                
                if split_name == 'train':
                    # train 라벨은 복사
                    if label_src and label_src.exists():
                        if not label_dest.exists():
                            shutil.copy2(str(label_src), str(label_dest))
                            copied_labels += 1
                    else:
                        # 어노테이션 변환
                        if not label_dest.exists():
                            yolo_label = convert_json_to_yolo(str(json_file))
                            label_dest.write_text(yolo_label, encoding='utf-8')
                            copied_labels += 1
                else:  # val
                    # val 라벨은 source에서 복사 (이동 아님)
                    if label_src and label_src.exists():
                        if not label_dest.exists():
                            shutil.copy2(str(label_src), str(label_dest))
                            copied_labels += 1
                    else:
                        # 어노테이션 변환
                        if not label_dest.exists():
                            yolo_label = convert_json_to_yolo(str(json_file))
                            label_dest.write_text(yolo_label, encoding='utf-8')
                            copied_labels += 1
                
                # 메타데이터 복사 (metadata 폴더는 공통)
                metadata_dest = target_path / "metadata" / json_file.name
                if not metadata_dest.exists():
                    shutil.copy2(json_file, metadata_dest)
                    copied_metadata += 1
                
                # E2 JSON 파일도 복사
                if e2_json_file and Path(e2_json_file).exists():
                    e2_metadata_dest = target_path / "metadata" / Path(e2_json_file).name
                    if not e2_metadata_dest.exists():
                        shutil.copy2(e2_json_file, e2_metadata_dest)
                        copied_metadata += 1
    
    # data.yaml 파일 생성
    print("📄 data.yaml 파일 생성 중...")
    data_yaml_content = f"""# BrickBox Synthetic Dataset Configuration
path: {target_path.absolute()}
train: images/train
val: images/val

# Classes
nc: 1  # number of classes
names: ['lego_part']  # class names

# Dataset info
total_images: {len(image_files)}
train_images: {len(train_files)}
val_images: {len(val_files)}
"""
    
    yaml_path = target_path / "data.yaml"
    yaml_path.write_text(data_yaml_content, encoding='utf-8')
    
    print("[OK] 데이터셋 준비 완료!")
    print(f"📊 준비된 파일: 이미지 {copied_images}개, 라벨 {copied_labels}개, 메타데이터 {copied_metadata}개")
    print(f"[DIR] 저장 위치: {target_path.absolute()}")
    
    # 버전 관리 시스템에 등록
    try:
        version_manager = DatasetVersionManager(str(source_path.parent))
        version = version_manager.create_version(
            str(target_path), 
            description=f"자동 생성 - {len(image_files)}개 이미지"
        )
        print(f"[REPORT] 데이터셋 버전 {version} 생성됨")
    except Exception as e:
        print(f"[WARNING] 버전 관리 실패: {e}")
        # 버전 관리는 선택사항이므로 계속 진행
    
    return {
        'images': copied_images,
        'labels': copied_labels,
        'metadata': copied_metadata,
        'train_files': len(train_files),
        'val_files': len(val_files)
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Prepare synthetic dataset for YOLO training')
    parser.add_argument('--source', default='output/synthetic', help='Source directory')
    parser.add_argument('--output', default='output/dataset_synthetic', help='Output directory')
    parser.add_argument('--train-split', type=float, default=0.8, help='Train split ratio')
    parser.add_argument('--force-rebuild', action='store_true', help='Force rebuild from scratch')
    
    args = parser.parse_args()
    
    try:
        result = prepare_dataset(
            source_dir=args.source,
            target_dir=args.output,
            train_split=args.train_split,
            force_rebuild=args.force_rebuild
        )
        print(f"[OK] 성공: {result}")
    except Exception as e:
        print(f"[ERROR] 오류: {e}")
        sys.exit(1)
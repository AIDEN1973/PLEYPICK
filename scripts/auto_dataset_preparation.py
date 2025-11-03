#!/usr/bin/env python3
"""
BrickBox 자동 데이터셋 준비 스크립트
렌더링 완료 시 자동으로 dataset_synthetic 폴더에 데이터를 복사하고 YAML 파일을 생성
"""

import os
import sys
import json
import shutil
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import argparse

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

class AutoDatasetPreparer:
    """자동 데이터셋 준비 클래스"""
    
    def __init__(self, output_dir: str = None):
        self.project_root = project_root
        self.output_dir = Path(output_dir) if output_dir else project_root / "output" / "synthetic"
        self.dataset_dir = self.output_dir / "dataset_synthetic"
        
        # 로깅 설정
        self.setup_logging()
        
        # 디렉토리 생성
        self.create_directories()
    
    def setup_logging(self):
        """로깅 설정"""
        log_dir = self.output_dir / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / f"auto_dataset_preparation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def create_directories(self):
        """필요한 디렉토리 생성"""
        directories = [
            self.dataset_dir,
            self.dataset_dir / "images" / "train",
            self.dataset_dir / "images" / "val",
            self.dataset_dir / "labels" / "train",
            self.dataset_dir / "labels" / "val",
            self.dataset_dir / "meta" / "train"
        ]
        
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
            self.logger.info(f"디렉토리 생성: {directory}")
    
    def scan_rendered_parts(self) -> List[str]:
        """렌더링된 부품 목록 스캔"""
        self.logger.info("렌더링된 부품 목록 스캔 중...")
        
        rendered_parts = []
        for item in self.output_dir.iterdir():
            if item.is_dir() and not item.name.startswith('.') and item.name != "dataset_synthetic":
                # 부품 디렉토리인지 확인 (이미지 파일이 있는지)
                if (item / "images").exists() or any(item.glob("*.webp")):
                    rendered_parts.append(item.name)
                    self.logger.info(f"  부품 발견: {item.name}")
        
        self.logger.info(f"총 {len(rendered_parts)}개 부품 발견")
        return rendered_parts
    
    def copy_part_data(self, part_id: str) -> Dict:
        """특정 부품의 데이터를 dataset_synthetic로 복사"""
        self.logger.info(f"부품 {part_id} 데이터 복사 중...")
        
        part_dir = self.output_dir / part_id
        if not part_dir.exists():
            self.logger.error(f"부품 디렉토리 없음: {part_dir}")
            return {"success": False, "error": "Part directory not found"}
        
        copy_results = {
            "part_id": part_id,
            "images_copied": 0,
            "labels_copied": 0,
            "meta_copied": 0,
            "errors": []
        }
        
        try:
            # 이미지 파일 복사
            image_files = list(part_dir.glob("*.webp"))
            for img_file in image_files:
                dst_path = self.dataset_dir / "images" / "train" / img_file.name
                shutil.copy2(img_file, dst_path)
                copy_results["images_copied"] += 1
            
            # 라벨 파일 복사
            label_files = list(part_dir.glob("*.txt"))
            for label_file in label_files:
                dst_path = self.dataset_dir / "labels" / "train" / label_file.name
                shutil.copy2(label_file, dst_path)
                copy_results["labels_copied"] += 1
            
            # 메타데이터 파일 복사
            json_files = list(part_dir.glob("*.json"))
            for json_file in json_files:
                dst_path = self.dataset_dir / "meta" / "train" / json_file.name
                shutil.copy2(json_file, dst_path)
                copy_results["meta_copied"] += 1
            
            self.logger.info(f"부품 {part_id} 복사 완료: {copy_results['images_copied']}개 이미지, {copy_results['labels_copied']}개 라벨, {copy_results['meta_copied']}개 메타데이터")
            
        except Exception as e:
            error_msg = f"부품 {part_id} 복사 실패: {e}"
            self.logger.error(f"{error_msg}")
            copy_results["errors"].append(error_msg)
            copy_results["success"] = False
        
        return copy_results
    
    def update_yaml_config(self, part_ids: List[str]) -> str:
        """YAML 설정 파일 업데이트"""
        self.logger.info("YAML 설정 파일 업데이트 중...")
        
        yaml_path = self.dataset_dir / "data.yaml"
        
        # 현재 데이터셋 통계 계산
        train_images = len(list((self.dataset_dir / "images" / "train").glob("*.webp")))
        train_labels = len(list((self.dataset_dir / "labels" / "train").glob("*.txt")))
        
        yaml_config = {
            'path': str(self.dataset_dir.absolute()),
            'train': 'images/train',
            'val': 'images/val',
            'test': 'images/test',
            'nc': 1,  # 클래스 수 (lego_part)
            'names': ['lego_part'],
            'dataset_info': {
                'total_parts': len(part_ids),
                'part_ids': part_ids,
                'train_images': train_images,
                'train_labels': train_labels,
                'last_updated': datetime.now().isoformat()
            }
        }
        
        # YAML 파일 생성
        try:
            import yaml
            with open(yaml_path, 'w', encoding='utf-8') as f:
                yaml.dump(yaml_config, f, default_flow_style=False, allow_unicode=True)
            
            self.logger.info(f"YAML 설정 파일 생성: {yaml_path}")
            return str(yaml_path)
            
        except ImportError:
            # yaml 모듈이 없는 경우 JSON으로 저장
            json_path = yaml_path.with_suffix('.json')
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(yaml_config, f, indent=2, ensure_ascii=False)
            
            self.logger.warning(f"YAML 모듈 없음, JSON으로 저장: {json_path}")
            return str(json_path)
    
    def prepare_dataset(self, specific_parts: List[str] = None) -> Dict:
        """전체 데이터셋 준비"""
        self.logger.info("자동 데이터셋 준비 시작...")
        
        preparation_results = {
            'start_time': datetime.now(),
            'parts_processed': [],
            'total_images': 0,
            'total_labels': 0,
            'total_meta': 0,
            'errors': [],
            'success': False
        }
        
        try:
            # 1. 렌더링된 부품 목록 스캔
            if specific_parts:
                rendered_parts = specific_parts
                self.logger.info(f"지정된 부품 처리: {rendered_parts}")
            else:
                rendered_parts = self.scan_rendered_parts()
            
            if not rendered_parts:
                self.logger.warning("처리할 부품이 없습니다")
                return preparation_results
            
            # 2. 각 부품 데이터 복사
            for part_id in rendered_parts:
                copy_result = self.copy_part_data(part_id)
                preparation_results['parts_processed'].append(copy_result)
                
                if copy_result.get('success', True):  # success가 False가 아닌 경우
                    preparation_results['total_images'] += copy_result.get('images_copied', 0)
                    preparation_results['total_labels'] += copy_result.get('labels_copied', 0)
                    preparation_results['total_meta'] += copy_result.get('meta_copied', 0)
                else:
                    preparation_results['errors'].extend(copy_result.get('errors', []))
            
            # 3. YAML 설정 파일 업데이트
            yaml_path = self.update_yaml_config(rendered_parts)
            
            # 4. 결과 요약
            preparation_results['end_time'] = datetime.now()
            preparation_results['yaml_path'] = yaml_path
            preparation_results['success'] = len(preparation_results['errors']) == 0
            
            self.logger.info("자동 데이터셋 준비 완료!")
            self.logger.info(f"처리된 부품: {len(rendered_parts)}개")
            self.logger.info(f"총 이미지: {preparation_results['total_images']}개")
            self.logger.info(f"총 라벨: {preparation_results['total_labels']}개")
            self.logger.info(f"총 메타데이터: {preparation_results['total_meta']}개")
            
            if preparation_results['errors']:
                self.logger.warning(f"{len(preparation_results['errors'])}개 오류 발생")
                for error in preparation_results['errors']:
                    self.logger.warning(f"  - {error}")
            
        except Exception as e:
            preparation_results['errors'].append(f"데이터셋 준비 실패: {e}")
            preparation_results['end_time'] = datetime.now()
            self.logger.error(f"데이터셋 준비 실패: {e}")
        
        return preparation_results

def main():
    """메인 실행 함수"""
    parser = argparse.ArgumentParser(description='자동 데이터셋 준비')
    parser.add_argument('--output-dir', type=str, help='출력 디렉토리 경로')
    parser.add_argument('--parts', nargs='+', help='처리할 특정 부품 ID 목록')
    parser.add_argument('--scan-only', action='store_true', help='부품 스캔만 실행')
    
    args = parser.parse_args()
    
    # 준비기 초기화
    preparer = AutoDatasetPreparer(args.output_dir)
    
    try:
        if args.scan_only:
            # 부품 스캔만 실행
            parts = preparer.scan_rendered_parts()
            print("렌더링된 부품 목록:")
            for part in parts:
                print(f"  - {part}")
        else:
            # 전체 데이터셋 준비 실행
            results = preparer.prepare_dataset(args.parts)
            print("데이터셋 준비 결과:")
            print(json.dumps(results, indent=2, ensure_ascii=False, default=str))
            
    except Exception as e:
        print(f"실행 실패: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

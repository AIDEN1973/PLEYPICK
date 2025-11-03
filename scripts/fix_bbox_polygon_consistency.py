#!/usr/bin/env python3
"""
bbox/polygon 일치성 수정 스크립트
"""

import os
import json
import numpy as np
from pathlib import Path
import argparse
import logging
from datetime import datetime

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class BboxPolygonFixer:
    """bbox/polygon 일치성 수정기"""
    
    def __init__(self, dataset_path: str):
        self.dataset_path = Path(dataset_path)
    
    def fix_bbox_polygon_consistency(self) -> bool:
        """bbox/polygon 일치성 수정"""
        logger.info("bbox/polygon 일치성 수정 시작")
        
        meta_files = list((self.dataset_path / 'meta').glob('*.json'))
        success_count = 0
        
        for meta_file in meta_files:
            try:
                with open(meta_file, 'r', encoding='utf-8') as f:
                    meta = json.load(f)
                
                # polygon_uv에서 bbox 재계산
                if 'polygon_uv' in meta and len(meta['polygon_uv']) >= 2:
                    polygon = np.array(meta['polygon_uv'])
                    
                    # polygon 범위 계산
                    x_coords = polygon[:, 0]
                    y_coords = polygon[:, 1]
                    
                    new_bbox = {
                        'x_min': float(np.min(x_coords)),
                        'y_min': float(np.min(y_coords)),
                        'x_max': float(np.max(x_coords)),
                        'y_max': float(np.max(y_coords))
                    }
                    
                    # 기존 bbox와 비교
                    if 'bounding_box' in meta:
                        old_bbox = meta['bounding_box']
                        
                        # 1% 허용 오차로 비교 (더 엄격한 기준)
                        tolerance = 0.01
                        is_different = False
                        
                        for key in ['x_min', 'y_min', 'x_max', 'y_max']:
                            if abs(old_bbox[key] - new_bbox[key]) > tolerance:
                                is_different = True
                                break
                        
                        if is_different:
                            meta['bounding_box'] = new_bbox
                            logger.info(f"bbox 수정: {meta_file.name}")
                        else:
                            logger.info(f"bbox 일치: {meta_file.name}")
                    else:
                        meta['bounding_box'] = new_bbox
                        logger.info(f"bbox 추가: {meta_file.name}")
                    
                    # 업데이트 시간 갱신
                    meta['updated_at'] = datetime.now().isoformat() + "Z"
                    
                    # 파일 저장
                    with open(meta_file, 'w', encoding='utf-8') as f:
                        json.dump(meta, f, indent=2, ensure_ascii=False)
                    
                    success_count += 1
                else:
                    logger.warning(f"polygon_uv 데이터 부족: {meta_file.name}")
            
            except Exception as e:
                logger.error(f"bbox/polygon 수정 실패 {meta_file.name}: {e}")
        
        success_rate = (success_count / len(meta_files)) * 100
        logger.info(f"bbox/polygon 수정 완료: {success_count}/{len(meta_files)} ({success_rate:.1f}%)")
        
        return success_count == len(meta_files)

def main():
    parser = argparse.ArgumentParser(description='bbox/polygon 일치성 수정')
    parser.add_argument('dataset_path', help='수정할 데이터셋 경로')
    parser.add_argument('--verbose', '-v', action='store_true', help='상세 로그 출력')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # 수정 실행
    fixer = BboxPolygonFixer(args.dataset_path)
    success = fixer.fix_bbox_polygon_consistency()
    
    if success:
        logger.info("bbox/polygon 일치성 수정 완료")
        exit(0)
    else:
        logger.error("bbox/polygon 일치성 수정 실패")
        exit(1)

if __name__ == "__main__":
    main()

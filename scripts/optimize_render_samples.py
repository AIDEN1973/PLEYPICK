#!/usr/bin/env python3
"""
렌더링 샘플 수 최적화 스크립트
- JSON 파일들의 샘플 수를 부품 복잡도에 맞게 조정
- 단순 부품: 384 샘플 (기존 640 → 40% 속도 향상)
- 중간 부품: 512 샘플
- 복잡 부품: 640 샘플
- 투명 부품: 768 샘플
"""

import json
import os
import glob
from pathlib import Path

def analyze_part_complexity(part_id, color_id=None):
    """부품 복잡도 분석"""
    part_name = str(part_id).lower()
    
    # 투명/반사 색상 ID 확인
    if color_id and color_id in [47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60]:
        return 768, "투명/반사 부품"
    
    # 키워드 기반 복잡도 분석
    if any(keyword in part_name for keyword in ['plate', 'tile', 'brick', 'stud']):
        return 384, "단순 부품 (Plate/Tile)"
    elif any(keyword in part_name for keyword in ['beam', 'rod', 'axle', 'pin', 'connector']):
        return 512, "중간 복잡도 부품"
    elif any(keyword in part_name for keyword in ['technic', 'gear', 'wheel', 'tire', 'panel', 'slope']):
        return 640, "복잡한 부품 (Technic)"
    else:
        # 기본값: 중간 복잡도
        return 512, "중간 복잡도 부품 (기본값)"

def optimize_json_samples(json_file_path):
    """JSON 파일의 샘플 수 최적화"""
    try:
        with open(json_file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 부품 정보 추출
        part_id = data.get('part_id', '')
        element_id = data.get('element_id', '')
        color_id = None
        
        # 색상 ID 추출
        if 'material' in data and 'color_id' in data['material']:
            color_id = data['material']['color_id']
        
        # 복잡도 분석
        optimal_samples, description = analyze_part_complexity(part_id, color_id)
        
        # 현재 샘플 수 확인
        current_samples = data.get('render_settings', {}).get('samples', 640)
        
        # 샘플 수 업데이트
        if 'render_settings' not in data:
            data['render_settings'] = {}
        
        data['render_settings']['samples'] = optimal_samples
        
        # 파일 저장
        with open(json_file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"OK {os.path.basename(json_file_path)}: {current_samples} -> {optimal_samples} 샘플 ({description})")
        
        return True
        
    except Exception as e:
        print(f"ERROR {json_file_path} 처리 실패: {e}")
        return False

def main():
    """메인 함수"""
    print("렌더링 샘플 수 최적화 시작...")
    
    # JSON 파일 검색
    json_pattern = "output/synthetic/dataset_synthetic/images/train/4583789/*.json"
    json_files = glob.glob(json_pattern)
    
    if not json_files:
        print("JSON 파일을 찾을 수 없습니다.")
        return
    
    print(f"{len(json_files)}개 JSON 파일 발견")
    
    # 각 JSON 파일 최적화
    success_count = 0
    for json_file in json_files:
        if optimize_json_samples(json_file):
            success_count += 1
    
    print(f"\n최적화 완료: {success_count}/{len(json_files)}개 파일")
    
    # 성능 향상 예상치 계산
    original_samples = 640
    optimized_samples = 384  # 단순 부품 기준
    speed_improvement = (original_samples - optimized_samples) / original_samples * 100
    
    print(f"예상 속도 향상: {speed_improvement:.1f}% (640 -> 384 샘플)")

if __name__ == "__main__":
    main()

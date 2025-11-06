#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
렌더링 실패 분석 스크립트
"""

import os
import sys
from pathlib import Path

def analyze_synthetic_folder():
    """synthetic 폴더 분석"""
    base_dir = Path('output/synthetic')
    
    if not base_dir.exists():
        print(f"[ERROR] {base_dir} 폴더가 없습니다")
        return
    
    folders = [d for d in base_dir.iterdir() if d.is_dir() and d.name != 'dataset_synthetic']
    
    print("=" * 80)
    print("렌더링 결과 분석")
    print("=" * 80)
    
    empty_folders = []
    populated_folders = []
    
    for folder in folders:
        images_dir = folder / 'images'
        if images_dir.exists():
            webp_files = list(images_dir.glob('*.webp'))
            if len(webp_files) == 0:
                empty_folders.append(folder.name)
            else:
                populated_folders.append((folder.name, len(webp_files)))
    
    print(f"\n빈 폴더 (렌더링 실패): {len(empty_folders)}개")
    if empty_folders:
        print("  샘플:", ', '.join(empty_folders[:10]))
        if len(empty_folders) > 10:
            print(f"  ... 외 {len(empty_folders) - 10}개")
    
    print(f"\n렌더링 완료 폴더: {len(populated_folders)}개")
    for folder_name, count in populated_folders:
        print(f"  {folder_name}: {count}개 파일")
    
    print(f"\n요약:")
    print(f"  - 총 폴더: {len(folders)}개")
    print(f"  - 빈 폴더: {len(empty_folders)}개 ({len(empty_folders)/len(folders)*100:.1f}%)")
    print(f"  - 완료 폴더: {len(populated_folders)}개 ({len(populated_folders)/len(folders)*100:.1f}%)")
    
    # 세트 76917 부품 목록 확인 (element_id 기준)
    print(f"\n세트 76917 부품 확인:")
    set_76917_folders = [f for f in empty_folders if f.startswith('7') or len(f) >= 7]
    if set_76917_folders:
        print(f"  세트 76917 관련 폴더: {len(set_76917_folders)}개")
        print(f"  샘플: {', '.join(set_76917_folders[:10])}")

if __name__ == '__main__':
    analyze_synthetic_folder()










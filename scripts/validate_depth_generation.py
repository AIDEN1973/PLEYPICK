#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Depth 파일 생성 검증 스크립트
"""

import os
import sys
from pathlib import Path

def validate_depth_files():
    """depth 파일 생성 상태 검증"""
    base_dir = Path('output/synthetic')
    
    if not base_dir.exists():
        print(f"[ERROR] {base_dir} 폴더가 없습니다")
        return False
    
    folders = [d for d in base_dir.iterdir() if d.is_dir() and d.name != 'dataset_synthetic']
    
    print("=" * 80)
    print("Depth 파일 생성 검증")
    print("=" * 80)
    
    depth_stats = {
        'total_folders': len(folders),
        'has_depth_folder': 0,
        'has_depth_files': 0,
        'exr_files': 0,
        'png_files': 0,
        'empty_depth_folders': 0,
        'no_depth_folder': 0
    }
    
    depth_file_locations = []
    
    for folder in folders:
        depth_dir = folder / 'depth'
        
        if depth_dir.exists():
            depth_stats['has_depth_folder'] += 1
            depth_files = list(depth_dir.glob('*'))
            
            if len(depth_files) > 0:
                depth_stats['has_depth_files'] += 1
                
                for df in depth_files:
                    if df.suffix.lower() == '.exr':
                        depth_stats['exr_files'] += 1
                        depth_file_locations.append((folder.name, df.name, 'EXR'))
                    elif df.suffix.lower() == '.png':
                        depth_stats['png_files'] += 1
                        depth_file_locations.append((folder.name, df.name, 'PNG'))
            else:
                depth_stats['empty_depth_folders'] += 1
        else:
            depth_stats['no_depth_folder'] += 1
    
    print(f"\n📊 통계:")
    print(f"  - 총 폴더: {depth_stats['total_folders']}개")
    print(f"  - depth 폴더 있음: {depth_stats['has_depth_folder']}개")
    print(f"  - depth 폴더 없음: {depth_stats['no_depth_folder']}개")
    print(f"  - depth 파일 있음: {depth_stats['has_depth_files']}개")
    print(f"  - 빈 depth 폴더: {depth_stats['empty_depth_folders']}개")
    print(f"  - EXR 파일: {depth_stats['exr_files']}개")
    print(f"  - PNG 파일: {depth_stats['png_files']}개")
    
    if depth_file_locations:
        print(f"\n✅ Depth 파일 발견:")
        for folder, file, fmt in depth_file_locations[:10]:
            print(f"  {folder}/{file} ({fmt})")
        if len(depth_file_locations) > 10:
            print(f"  ... 외 {len(depth_file_locations) - 10}개")
    else:
        print(f"\n[ERROR] Depth 파일이 하나도 없습니다!")
    
    # 문제 진단
    print(f"\n🔍 문제 진단:")
    if depth_stats['has_depth_folder'] > 0 and depth_stats['has_depth_files'] == 0:
        print("  [WARNING]  depth 폴더는 생성되었지만 파일이 없음")
        print("  → Blender OutputFile 노드가 파일을 저장하지 못함")
        print("  → Compositor 설정 또는 렌더링 방식 확인 필요")
    elif depth_stats['has_depth_folder'] == 0:
        print("  [WARNING]  depth 폴더 자체가 생성되지 않음")
        print("  → render_single_part 함수의 depth_dir 생성 로직 확인 필요")
    
    return depth_stats['has_depth_files'] > 0

if __name__ == '__main__':
    success = validate_depth_files()
    sys.exit(0 if success else 1)






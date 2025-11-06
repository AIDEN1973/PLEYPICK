#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
단일 부품 렌더링 중복 체크 스크립트
"""

import os
import sys
from pathlib import Path

def check_existing_rendering(element_id, part_id, output_dir='./output/synthetic'):
    """
    기존 렌더링 여부 확인
    
    Args:
        element_id: element_id (우선순위 1)
        part_id: part_id (우선순위 2)
        output_dir: 출력 디렉토리 경로
    
    Returns:
        dict: {
            'exists': bool,
            'folder_path': str,
            'file_count': int,
            'message': str
        }
    """
    base_dir = Path(output_dir)
    
    # 폴더명 결정: element_id 우선, 없으면 part_id
    folder_name = element_id if element_id else part_id
    
    if not folder_name:
        return {
            'exists': False,
            'folder_path': None,
            'file_count': 0,
            'message': 'element_id와 part_id가 모두 없습니다.'
        }
    
    # 폴더 경로
    folder_path = base_dir / str(folder_name)
    
    if not folder_path.exists():
        return {
            'exists': False,
            'folder_path': str(folder_path),
            'file_count': 0,
            'message': f'폴더가 없습니다: {folder_path}'
        }
    
    # 파일 개수 확인
    images_dir = folder_path / 'images'
    labels_dir = folder_path / 'labels'
    
    webp_count = 0
    txt_count = 0
    
    if images_dir.exists():
        webp_count = len(list(images_dir.glob('*.webp')))
    
    if labels_dir.exists():
        txt_count = len(list(labels_dir.glob('*.txt')))
    
    total_count = webp_count + txt_count
    
    # 최소 파일 수 기준 (200장 기준으로 150장 이상이면 완료로 간주)
    MIN_FILES = 150
    
    if total_count >= MIN_FILES:
        return {
            'exists': True,
            'folder_path': str(folder_path),
            'file_count': total_count,
            'webp_count': webp_count,
            'txt_count': txt_count,
            'message': f'기존 렌더링 발견: {folder_path} ({total_count}개 파일, 웹피: {webp_count}, 라벨: {txt_count})'
        }
    elif total_count > 0:
        return {
            'exists': True,
            'folder_path': str(folder_path),
            'file_count': total_count,
            'webp_count': webp_count,
            'txt_count': txt_count,
            'message': f'불완전한 렌더링 발견: {folder_path} ({total_count}개 파일만 있음, 최소 {MIN_FILES}개 필요)'
        }
    else:
        return {
            'exists': False,
            'folder_path': str(folder_path),
            'file_count': 0,
            'message': f'폴더는 있지만 파일이 없습니다: {folder_path}'
        }

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='단일 부품 렌더링 중복 체크')
    parser.add_argument('--element-id', type=str, help='Element ID')
    parser.add_argument('--part-id', type=str, required=True, help='Part ID')
    parser.add_argument('--output-dir', type=str, default='./output/synthetic', help='출력 디렉토리')
    
    args = parser.parse_args()
    
    result = check_existing_rendering(args.element_id, args.part_id, args.output_dir)
    
    print(f"중복 체크 결과:")
    print(f"  존재 여부: {result['exists']}")
    print(f"  폴더 경로: {result['folder_path']}")
    print(f"  파일 개수: {result.get('file_count', 0)}")
    if 'webp_count' in result:
        print(f"  WebP 개수: {result['webp_count']}")
        print(f"  TXT 개수: {result['txt_count']}")
    print(f"  메시지: {result['message']}")
    
    # Exit code: 존재하면 1, 없으면 0
    sys.exit(1 if result['exists'] else 0)










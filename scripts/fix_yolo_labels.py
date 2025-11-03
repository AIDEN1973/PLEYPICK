#!/usr/bin/env python3
"""
YOLO 라벨 파일의 좌표 범위 문제 수정
"""

import os
import sys
from pathlib import Path

def normalize_coordinates(line):
    """YOLO 라벨 라인의 좌표를 0-1 범위로 정규화"""
    parts = line.strip().split()
    if len(parts) < 5:
        return line
    
    try:
        # 첫 5개 값 (class_id, x, y, w, h) 처리
        class_id = int(parts[0])
        x = float(parts[1])
        y = float(parts[2])
        w = float(parts[3])
        h = float(parts[4])
        
        # 좌표를 0-1 범위로 클리핑
        x = max(0.0, min(1.0, x))
        y = max(0.0, min(1.0, y))
        w = max(0.0, min(1.0, w))
        h = max(0.0, min(1.0, h))
        
        # 정규화된 좌표로 라인 재구성
        normalized_parts = [str(class_id), f"{x:.6f}", f"{y:.6f}", f"{w:.6f}", f"{h:.6f}"]
        
        # 세그멘테이션 좌표가 있다면 (5개 이상의 값) 처리
        if len(parts) > 5:
            seg_coords = []
            for i in range(5, len(parts), 2):
                if i + 1 < len(parts):
                    u = float(parts[i])
                    v = float(parts[i + 1])
                    # UV 좌표도 0-1 범위로 클리핑
                    u = max(0.0, min(1.0, u))
                    v = max(0.0, min(1.0, v))
                    seg_coords.extend([f"{u:.6f}", f"{v:.6f}"])
            normalized_parts.extend(seg_coords)
        
        return " ".join(normalized_parts)
        
    except (ValueError, IndexError) as e:
        print(f"[WARNING] 좌표 파싱 오류: {line} - {e}")
        return line

def fix_yolo_file(file_path):
    """YOLO 라벨 파일 수정"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        fixed_lines = []
        has_fixes = False
        
        for line in lines:
            line = line.strip()
            if not line:
                fixed_lines.append(line)
                continue
                
            normalized_line = normalize_coordinates(line)
            if normalized_line != line:
                has_fixes = True
                print(f"[FIX] 수정: {file_path.name}")
                print(f"  원본: {line}")
                print(f"  수정: {normalized_line}")
            
            fixed_lines.append(normalized_line)
        
        if has_fixes:
            # 파일 저장
            with open(file_path, 'w', encoding='utf-8') as f:
                for line in fixed_lines:
                    f.write(line + '\n')
            return True
        
        return False
        
    except Exception as e:
        print(f"[ERROR] {file_path} 처리 오류: {e}")
        return False

def main():
    """메인 함수"""
    synthetic_dir = Path("output/synthetic")
    
    if not synthetic_dir.exists():
        print("[ERROR] output/synthetic 디렉토리가 존재하지 않습니다")
        return
        
    print("[FIX] YOLO 라벨 파일 좌표 범위 수정 시작...")
    
    fixed_count = 0
    total_count = 0
    
    # 각 부품 폴더 처리
    for part_dir in synthetic_dir.iterdir():
        if not part_dir.is_dir():
            continue
            
        print(f"[DIR] 부품 폴더 처리: {part_dir.name}")
        
        # TXT 파일 찾기 (YOLO 라벨)
        for txt_file in part_dir.glob("*.txt"):
            total_count += 1
            if fix_yolo_file(txt_file):
                fixed_count += 1
                
    print(f"[SUCCESS] 완료! 총 {total_count}개 파일 중 {fixed_count}개 파일 수정됨")

if __name__ == "__main__":
    main()

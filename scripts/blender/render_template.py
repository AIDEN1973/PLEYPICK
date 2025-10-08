#!/usr/bin/env python3
"""
🧱 BrickBox Blender 렌더링 스크립트 템플릿
환경 설정에 따라 자동 생성된 스크립트
"""

import bpy
import sys
import os
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root))

# 환경 설정 로드
from scripts.render_ldraw_to_supabase import LDrawRenderer
from scripts.yolo_annotation_generator import YOLOAnnotationGenerator

def main():
    """메인 렌더링 함수"""
    print("🧱 BrickBox Blender 렌더링 시작")
    
    # 렌더러 초기화
    renderer = LDrawRenderer()
    
    # 여기에 렌더링 로직 추가
    print("렌더링 완료")

if __name__ == "__main__":
    main()

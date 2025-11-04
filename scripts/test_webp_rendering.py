#!/usr/bin/env python3
"""
WebP 렌더링 테스트 스크립트
기술문서 정합성 검증을 위한 테스트 이미지 생성
"""

import os
import sys
import bpy
import bmesh
from pathlib import Path

# Blender 환경 확인
BLENDER_AVAILABLE = True
try:
    import bpy
    import bmesh
except ImportError:
    BLENDER_AVAILABLE = False
    print("Blender 환경이 아닙니다. 테스트를 건너뜁니다.")

def setup_test_scene():
    """테스트 씬 설정"""
    if not BLENDER_AVAILABLE:
        print("Blender 환경이 아닙니다.")
        return False
        
    # 기존 오브젝트 삭제
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    
    # 큐브 추가 (LEGO 부품 시뮬레이션)
    bpy.ops.mesh.primitive_cube_add(size=2, enter_editmode=False, align='WORLD', location=(0, 0, 0))
    bpy.context.object.name = "LEGO_Test_Part"
    
    # 재질 추가 (기술문서 준수)
    material = bpy.data.materials.new(name="LEGO_Material")
    material.use_nodes = True
    material.node_tree.nodes["Principled BSDF"].inputs[0].default_value = (0.2, 0.2, 0.2, 1.0)  # Dark Gray
    bpy.context.object.data.materials.append(material)
    
    # 조명 추가
    bpy.ops.object.light_add(type='SUN', radius=1, align='WORLD', location=(5, 5, 5))
    bpy.context.object.data.energy = 5
    
    # 카메라 설정
    bpy.ops.object.camera_add(enter_editmode=False, align='WORLD', location=(3, -4, 3), rotation=(0.9, 0, 0.7))
    bpy.context.scene.camera = bpy.context.object
    
    # 렌더 엔진을 Cycles로 설정
    bpy.context.scene.render.engine = 'CYCLES'
    
    return True

def configure_webp_settings():
    """WebP 설정 (기술문서 준수)"""
    if not BLENDER_AVAILABLE:
        return False
        
    # WebP 출력 설정
    bpy.context.scene.render.image_settings.file_format = 'WEBP'
    bpy.context.scene.render.image_settings.color_mode = 'RGB'  # RGBA → RGB (25% 용량 절약)
    bpy.context.scene.render.image_settings.quality = 90  # WebP Q90 품질 설정 (기술문서 기준)
    bpy.context.scene.render.image_settings.compression = 6  # -m 6 (메모리 최적화)
    bpy.context.scene.render.image_settings.color_depth = '8'  # 8비트 색상 깊이
    
    # 해상도 설정
    bpy.context.scene.render.resolution_x = 1024
    bpy.context.scene.render.resolution_y = 1024
    
    # 메타데이터 포함 (EXIF, ICC 프로파일) - 기술문서 준수 강화
    try:
        # EXIF 메타데이터 강제 활성화
        if hasattr(bpy.context.scene.render.image_settings, 'use_metadata'):
            bpy.context.scene.render.image_settings.use_metadata = True
            print("[INFO] EXIF 메타데이터 활성화")
        if hasattr(bpy.context.scene.render.image_settings, 'metadata_format'):
            bpy.context.scene.render.image_settings.metadata_format = 'EXIF'
            print("[INFO] EXIF 포맷 설정")
        
        # ICC 프로파일 강제 포함 (기술문서 요구사항)
        if hasattr(bpy.context.scene.render.image_settings, 'use_icc_profile'):
            bpy.context.scene.render.image_settings.use_icc_profile = True
            print("[INFO] ICC 프로파일 활성화")
        
        # sRGB 색공간 강제 설정
        if hasattr(bpy.context.scene.render.image_settings, 'color_management'):
            bpy.context.scene.render.image_settings.color_management = 'OVERRIDE'
        if hasattr(bpy.context.scene.render.image_settings, 'color_space'):
            bpy.context.scene.render.image_settings.color_space = 'sRGB'
            print("[INFO] sRGB 색공간 설정")
            
    except Exception as e:
        print(f"[WARN] 메타데이터 설정 실패 (Blender 버전 호환성): {e}")
        # 폴백: 기본 설정으로 강제 적용
        try:
            bpy.context.scene.render.image_settings.use_metadata = True
            print("[INFO] 폴백: 기본 메타데이터 활성화")
        except:
            pass
    
    return True

def render_test_images():
    """테스트 이미지 렌더링"""
    if not BLENDER_AVAILABLE:
        return False
        
    # 출력 디렉토리 생성
    output_dir = Path("output/test_webp")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 테스트 이미지들 렌더링
    test_cases = [
        {"name": "test_webp_001", "location": (0, 0, 0)},
        {"name": "test_webp_002", "location": (2, 0, 0)},
        {"name": "test_webp_003", "location": (0, 2, 0)},
    ]
    
    for i, test_case in enumerate(test_cases):
        # 큐브 위치 변경
        bpy.ops.mesh.primitive_cube_add(size=2, enter_editmode=False, align='WORLD', location=test_case["location"])
        bpy.context.object.name = f"LEGO_Test_Part_{i+1}"
        
        # 재질 추가
        material = bpy.data.materials.new(name=f"LEGO_Material_{i+1}")
        material.use_nodes = True
        colors = [(0.2, 0.2, 0.2, 1.0), (0.8, 0.2, 0.2, 1.0), (0.2, 0.8, 0.2, 1.0)]
        material.node_tree.nodes["Principled BSDF"].inputs[0].default_value = colors[i]
        bpy.context.object.data.materials.append(material)
        
        # 렌더링
        output_path = output_dir / f"{test_case['name']}.webp"
        bpy.context.scene.render.filepath = str(output_path)
        
        print(f"[INFO] 렌더링 중: {output_path}")
        bpy.ops.render.render(write_still=True)
        
        # 오브젝트 삭제 (다음 렌더링을 위해)
        bpy.ops.object.delete(use_global=False)
    
    print(f"[INFO] 테스트 이미지 렌더링 완료: {output_dir}")
    return True

def main():
    """메인 실행 함수"""
    print("=== WebP 렌더링 테스트 시작 ===")
    
    if not BLENDER_AVAILABLE:
        print("Blender 환경이 아닙니다. 테스트를 건너뜁니다.")
        return
    
    # 1. 테스트 씬 설정
    if not setup_test_scene():
        print("테스트 씬 설정 실패")
        return
    
    # 2. WebP 설정
    if not configure_webp_settings():
        print("WebP 설정 실패")
        return
    
    # 3. 테스트 이미지 렌더링
    if not render_test_images():
        print("테스트 이미지 렌더링 실패")
        return
    
    print("=== WebP 렌더링 테스트 완료 ===")

if __name__ == "__main__":
    main()















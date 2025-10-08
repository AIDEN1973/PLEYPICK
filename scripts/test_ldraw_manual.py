#!/usr/bin/env python3
"""
🧱 BrickBox LDraw 수동 테스트 스크립트

LDraw Add-on 없이 기본 도형으로 합성 데이터셋 생성
"""

import bpy
import bmesh
import os
import sys
import math
import mathutils
from mathutils import Vector, Euler
import random

def clear_scene():
    """씬 초기화"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def setup_camera():
    """카메라 설정"""
    bpy.ops.object.camera_add(location=(0, -5, 2))
    camera = bpy.context.object
    camera.name = "TestCamera"
    camera.rotation_euler = (math.radians(60), 0, 0)
    bpy.context.scene.camera = camera

def setup_lighting():
    """조명 설정"""
    # 키 라이트
    bpy.ops.object.light_add(type='SUN', location=(2, -2, 5))
    key_light = bpy.context.object
    key_light.name = "KeyLight"
    key_light.data.energy = 3.0
    
    # 필 라이트
    bpy.ops.object.light_add(type='AREA', location=(-2, -1, 3))
    fill_light = bpy.context.object
    fill_light.name = "FillLight"
    fill_light.data.energy = 1.5

def setup_render_settings():
    """렌더링 설정"""
    bpy.context.scene.render.engine = 'CYCLES'
    bpy.context.scene.render.resolution_x = 640
    bpy.context.scene.render.resolution_y = 640
    bpy.context.scene.cycles.samples = 32
    bpy.context.scene.render.image_settings.file_format = 'PNG'
    bpy.context.scene.render.image_settings.color_mode = 'RGB'

def create_lego_brick():
    """LEGO 브릭 모양의 기본 도형 생성"""
    # 메인 브릭 (2x4)
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
    main_brick = bpy.context.object
    main_brick.name = "LEGOBrick"
    main_brick.scale = (2, 4, 1)
    
    # 스터드 추가 (간단한 원통)
    bpy.ops.mesh.primitive_cylinder_add(location=(0, 0, 0.5))
    stud = bpy.context.object
    stud.name = "Stud"
    stud.scale = (0.3, 0.3, 0.2)
    
    # 스터드들을 브릭 위에 배치
    stud_locations = [
        (-0.5, -1.5, 0.5), (0.5, -1.5, 0.5),
        (-0.5, -0.5, 0.5), (0.5, -0.5, 0.5),
        (-0.5, 0.5, 0.5), (0.5, 0.5, 0.5),
        (-0.5, 1.5, 0.5), (0.5, 1.5, 0.5)
    ]
    
    for i, loc in enumerate(stud_locations):
        bpy.ops.mesh.primitive_cylinder_add(location=loc)
        stud = bpy.context.object
        stud.name = f"Stud_{i}"
        stud.scale = (0.3, 0.3, 0.2)
    
    # 모든 객체 선택 및 결합
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.join()
    
    lego_brick = bpy.context.active_object
    lego_brick.name = "LEGOBrick"
    
    print("✅ LEGO 브릭 생성 완료")
    return lego_brick

def apply_random_material(obj):
    """랜덤 재질 적용"""
    material = bpy.data.materials.new(name="LEGOMaterial")
    material.use_nodes = True
    
    nodes = material.node_tree.nodes
    nodes.clear()
    
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    output = nodes.new(type='ShaderNodeOutputMaterial')
    
    material.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    # LEGO 색상 팔레트
    lego_colors = [
        (0.8, 0.1, 0.1, 1.0),  # 빨강
        (0.1, 0.3, 0.8, 1.0),  # 파랑
        (0.1, 0.7, 0.2, 1.0),  # 초록
        (0.9, 0.8, 0.1, 1.0),  # 노랑
        (0.95, 0.95, 0.95, 1.0),  # 흰색
        (0.2, 0.2, 0.2, 1.0),  # 검정
        (0.8, 0.4, 0.1, 1.0),  # 주황
        (0.6, 0.1, 0.6, 1.0)   # 보라
    ]
    
    color = random.choice(lego_colors)
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = 0.3
    
    if obj.data.materials:
        obj.data.materials[0] = material
    else:
        obj.data.materials.append(material)
    
    print(f"✅ LEGO 재질 적용 완료: {color}")
    return color

def apply_random_rotation(obj):
    """랜덤 회전 적용"""
    rotation_x = random.uniform(0, 2 * math.pi)
    rotation_y = random.uniform(0, 2 * math.pi)
    rotation_z = random.uniform(0, 2 * math.pi)
    obj.rotation_euler = (rotation_x, rotation_y, rotation_z)
    
    print(f"✅ 회전 적용: ({math.degrees(rotation_x):.1f}°, {math.degrees(rotation_y):.1f}°, {math.degrees(rotation_z):.1f}°)")
    return (rotation_x, rotation_y, rotation_z)

def render_image(output_path):
    """이미지 렌더링"""
    bpy.context.scene.render.filepath = output_path
    bpy.ops.render.render(write_still=True)
    print(f"✅ 렌더링 완료: {output_path}")

def main():
    """메인 실행 함수"""
    print("🧱 BrickBox LEGO 브릭 렌더링 테스트 시작")
    
    # 출력 디렉토리 생성
    output_dir = os.path.abspath("./output/test")
    os.makedirs(output_dir, exist_ok=True)
    print(f"📁 출력 디렉토리: {output_dir}")
    
    # 씬 초기화
    clear_scene()
    
    # 렌더링 설정
    setup_render_settings()
    setup_camera()
    setup_lighting()
    
    # LEGO 브릭 생성
    lego_brick = create_lego_brick()
    
    # 랜덤 재질 적용
    color = apply_random_material(lego_brick)
    
    # 랜덤 회전 적용
    rotation = apply_random_rotation(lego_brick)
    
    # 렌더링
    output_path = os.path.join(output_dir, "lego_brick_test.png")
    render_image(output_path)
    
    print("🎉 LEGO 브릭 렌더링 테스트 완료!")
    print(f"📁 출력 파일: {output_path}")
    print(f"📊 렌더링 정보:")
    print(f"  - 색상: {color}")
    print(f"  - 회전: {rotation}")
    print(f"  - 해상도: 640x640")
    print(f"  - 엔진: Cycles")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
🧱 BrickBox 간단한 세트 렌더링 스크립트

Blender 내부에서 실행되는 간단한 세트 렌더링
- 특정 부품들로 세트 구성
- 다중 부품 동시 렌더링
- 세트별 합성 데이터셋 생성
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
    bpy.ops.object.camera_add(location=(0, -8, 4))
    camera = bpy.context.object
    camera.name = "SetCamera"
    camera.rotation_euler = (math.radians(50), 0, 0)
    bpy.context.scene.camera = camera

def setup_lighting():
    """조명 설정"""
    # 키 라이트
    bpy.ops.object.light_add(type='SUN', location=(3, -3, 6))
    key_light = bpy.context.object
    key_light.name = "KeyLight"
    key_light.data.energy = 4.0
    
    # 필 라이트
    bpy.ops.object.light_add(type='AREA', location=(-3, -2, 4))
    fill_light = bpy.context.object
    fill_light.name = "FillLight"
    fill_light.data.energy = 2.0

def setup_render_settings():
    """렌더링 설정"""
    bpy.context.scene.render.engine = 'CYCLES'
    bpy.context.scene.render.resolution_x = 640
    bpy.context.scene.render.resolution_y = 640
    bpy.context.scene.cycles.samples = 64
    bpy.context.scene.render.image_settings.file_format = 'PNG'
    bpy.context.scene.render.image_settings.color_mode = 'RGB'

def load_ldraw_part(part_id, ldraw_path):
    """LDraw 부품 로드"""
    try:
        # LDraw Importer Add-on 활성화
        import addon_utils
        addon_utils.enable("ImportLDraw-master", default_set=True)
        
        # LDraw 환경 변수 설정
        import os
        os.environ['LDRAWDIR'] = ldraw_path
        
        # LDraw 파일 경로
        part_file = os.path.join(ldraw_path, "parts", f"{part_id}.dat")
        if not os.path.exists(part_file):
            print(f"❌ LDraw 파일 없음: {part_file}")
            return None
        
        # LDraw 파일 임포트
        bpy.ops.import_scene.importldraw(filepath=part_file)
        
        # 임포트된 객체 선택
        imported_objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
        
        if not imported_objects:
            print(f"❌ LDraw 파일에서 메시를 찾을 수 없습니다: {part_id}")
            return None
        
        # 모든 메시를 하나의 객체로 결합
        if len(imported_objects) > 1:
            bpy.context.view_layer.objects.active = imported_objects[0]
            bpy.ops.object.select_all(action='DESELECT')
            for obj in imported_objects:
                obj.select_set(True)
            bpy.ops.object.join()
        
        part_object = bpy.context.active_object
        part_object.name = f"LEGOPart_{part_id}"
        
        print(f"✅ LDraw 부품 로드 성공: {part_id}")
        return part_object
        
    except Exception as e:
        print(f"❌ LDraw 로드 실패: {e}")
        return None

def apply_material(obj, color):
    """재질 적용"""
    material = bpy.data.materials.new(name=f"LEGOMaterial_{color}")
    material.use_nodes = True
    
    nodes = material.node_tree.nodes
    nodes.clear()
    
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    output = nodes.new(type='ShaderNodeOutputMaterial')
    
    material.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = 0.3
    
    if obj.data.materials:
        obj.data.materials[0] = material
    else:
        obj.data.materials.append(material)
    
    print(f"✅ 재질 적용 완료: {color}")
    return color

def create_lego_set():
    """LEGO 세트 생성 (Monkie Kid's Delivery Bike 시뮬레이션)"""
    print("🧱 LEGO 세트 생성: Monkie Kid's Delivery Bike")
    
    # 세트 구성 부품들 (실제 세트의 주요 부품들)
    set_parts = [
        {"part_id": "3001", "color": (0.8, 0.1, 0.1, 1.0), "position": (0, 0, 0), "name": "2x4 Brick"},
        {"part_id": "3001", "color": (0.1, 0.3, 0.8, 1.0), "position": (2, 0, 0), "name": "2x4 Brick Blue"},
        {"part_id": "3001", "color": (0.1, 0.7, 0.2, 1.0), "position": (-2, 0, 0), "name": "2x4 Brick Green"},
        {"part_id": "3001", "color": (0.9, 0.8, 0.1, 1.0), "position": (0, 2, 0), "name": "2x4 Brick Yellow"},
        {"part_id": "3001", "color": (0.8, 0.4, 0.1, 1.0), "position": (0, -2, 0), "name": "2x4 Brick Orange"},
    ]
    
    loaded_parts = []
    
    for part_info in set_parts:
        part_id = part_info["part_id"]
        color = part_info["color"]
        position = part_info["position"]
        name = part_info["name"]
        
        print(f"🔧 부품 로드: {name} ({part_id})")
        
        # LDraw 부품 로드
        part_object = load_ldraw_part(part_id, "C:/LDraw")
        if not part_object:
            continue
        
        # 위치 설정
        part_object.location = position
        
        # 재질 적용
        apply_material(part_object, color)
        
        # 랜덤 회전 적용
        rotation_x = random.uniform(0, 2 * math.pi)
        rotation_y = random.uniform(0, 2 * math.pi)
        rotation_z = random.uniform(0, 2 * math.pi)
        part_object.rotation_euler = (rotation_x, rotation_y, rotation_z)
        
        loaded_parts.append(part_object)
        print(f"✅ 부품 배치 완료: {name}")
    
    print(f"🎉 LEGO 세트 생성 완료: {len(loaded_parts)}개 부품")
    return loaded_parts

def render_image(output_path):
    """이미지 렌더링"""
    bpy.context.scene.render.filepath = output_path
    bpy.ops.render.render(write_still=True)
    print(f"✅ 렌더링 완료: {output_path}")

def main():
    """메인 실행 함수"""
    print("🧱 BrickBox LEGO 세트 렌더링 시작")
    
    # 출력 디렉토리 생성
    output_dir = os.path.abspath("./output/sets")
    os.makedirs(output_dir, exist_ok=True)
    print(f"📁 출력 디렉토리: {output_dir}")
    
    # 씬 초기화
    clear_scene()
    
    # 렌더링 설정
    setup_render_settings()
    setup_camera()
    setup_lighting()
    
    # LEGO 세트 생성
    set_parts = create_lego_set()
    
    if not set_parts:
        print("❌ 세트 생성 실패")
        return
    
    # 렌더링
    output_path = os.path.join(output_dir, "monkie_kid_delivery_bike.png")
    render_image(output_path)
    
    print("🎉 LEGO 세트 렌더링 완료!")
    print(f"📁 출력 파일: {output_path}")
    print(f"📊 렌더링 정보:")
    print(f"  - 세트: Monkie Kid's Delivery Bike")
    print(f"  - 부품 수: {len(set_parts)}")
    print(f"  - 해상도: 640x640")
    print(f"  - 엔진: Cycles")

if __name__ == "__main__":
    main()

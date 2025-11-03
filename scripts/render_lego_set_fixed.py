#!/usr/bin/env python3
"""
BrickBox 레고 세트별 렌더링 스크립트
특정 레고 세트의 모든 부품을 렌더링하여 합성 데이터셋 생성
- 세트별 부품 목록 조회
- 각 부품별 다중 렌더링 (각도, 색상, 조명 변화)
- Supabase 업로드 및 메타데이터 저장
"""

import bpy
import bmesh
import os
import sys
import math
import mathutils
from mathutils import Vector, Euler
import random
import argparse
from datetime import datetime
from pathlib import Path

# Supabase 클라이언트
try:
    import sys
    import os
    sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
    from supabase import create_client, Client
    from dotenv import load_dotenv
    SUPABASE_AVAILABLE = True
except ImportError:
    print("[WARNING] Supabase 클라이언트를 설치하세요: pip install supabase python-dotenv")
    SUPABASE_AVAILABLE = False

class LegoSetRenderer:
    """레고 세트별 렌더링 클래스"""
    
    def __init__(self, supabase_url=None, supabase_key=None):
        self.supabase = None
        if SUPABASE_AVAILABLE and supabase_url and supabase_key:
            self.supabase = create_client(supabase_url, supabase_key)
            print("[OK] Supabase 클라이언트 연결 성공")
    
    def get_set_parts(self, set_num):
        """특정 세트의 부품 목록 조회"""
        if not self.supabase:
            print("[ERROR] Supabase 클라이언트가 없습니다")
            return []
        
        try:
            # 세트 ID 조회
            set_result = self.supabase.table('lego_sets').select('id').eq('set_num', set_num).execute()
            if not set_result.data:
                print(f"[ERROR] 세트를 찾을 수 없습니다: {set_num}")
                return []
            
            set_id = set_result.data[0]['id']
            
            # 세트의 부품 목록 조회
            parts_result = self.supabase.table('set_parts').select(
                'part_id, color_id, quantity'
            ).eq('set_id', set_id).execute()
            
            print(f"[OK] 세트 {set_num}의 부품 {len(parts_result.data)}개 조회 완료")
            return parts_result.data
            
        except Exception as e:
            print(f"[ERROR] 세트 부품 조회 실패: {e}")
            return []
    
    def clear_scene(self):
        """씬 초기화"""
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
    
    def setup_camera(self):
        """카메라 설정"""
        bpy.ops.object.camera_add(location=(0, -5, 2))
        camera = bpy.context.object
        camera.name = "SetCamera"
        camera.rotation_euler = (math.radians(60), 0, 0)
        bpy.context.scene.camera = camera
    
    def setup_lighting(self):
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
    
    def setup_render_settings(self):
        """렌더링 설정"""
        bpy.context.scene.render.engine = 'CYCLES'
        bpy.context.scene.render.resolution_x = 640
        bpy.context.scene.render.resolution_y = 640
        bpy.context.scene.cycles.samples = 64  # 세트 렌더링용으로 증가
        bpy.context.scene.render.image_settings.file_format = 'WEBP'
        bpy.context.scene.render.image_settings.quality = 80  # WebP Q80 품질 설정
        bpy.context.scene.render.image_settings.color_mode = 'RGB'
    
    def load_ldraw_part(self, part_id, ldraw_path):
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
                print(f"[ERROR] LDraw 파일 없음: {part_file}")
                return None
            
            # LDraw 파일 임포트
            bpy.ops.import_scene.importldraw(filepath=part_file)
            
            # 임포트된 객체 선택
            imported_objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
            if not imported_objects:
                print(f"[ERROR] LDraw 파일에서 메시를 찾을 수 없습니다: {part_id}")
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
            print(f"[OK] LDraw 부품 로드 성공: {part_id}")
            return part_object
            
        except Exception as e:
            print(f"[ERROR] LDraw 로드 실패: {e}")
            return None
    
    def apply_random_material(self, obj, color_id=None):
        """랜덤 재질 적용"""
        material = bpy.data.materials.new(name=f"LEGOMaterial_{color_id}")
        material.use_nodes = True
        nodes = material.node_tree.nodes
        nodes.clear()
        
        bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
        output = nodes.new(type='ShaderNodeOutputMaterial')
        material.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
        
        # LEGO 색상 팔레트 (color_id 기반)
        lego_colors = {
            0: (0.95, 0.95, 0.95, 1.0),  # 흰색
            1: (0.2, 0.2, 0.2, 1.0),     # 검정
            2: (0.1, 0.3, 0.8, 1.0),    # 파랑
            3: (0.1, 0.7, 0.2, 1.0),    # 초록
            4: (0.8, 0.1, 0.1, 1.0),    # 빨강
            5: (0.9, 0.8, 0.1, 1.0),    # 노랑
            6: (0.8, 0.4, 0.1, 1.0),    # 주황
            7: (0.6, 0.1, 0.6, 1.0),    # 보라
            8: (0.4, 0.2, 0.1, 1.0),    # 갈색
            9: (0.5, 0.5, 0.5, 1.0)     # 회색
        }
        
        if color_id in lego_colors:
            color = lego_colors[color_id]
        else:
            # 랜덤 색상
            color = random.choice(list(lego_colors.values()))
        
        bsdf.inputs['Base Color'].default_value = color
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.3
        
        if obj.data.materials:
            obj.data.materials[0] = material
        else:
            obj.data.materials.append(material)
        
        print(f"[OK] 재질 적용 완료: {color}")
        return color
    
    def apply_random_rotation(self, obj):
        """랜덤 회전 적용"""
        rotation_x = random.uniform(0, 2 * math.pi)
        rotation_y = random.uniform(0, 2 * math.pi)
        rotation_z = random.uniform(0, 2 * math.pi)
        
        obj.rotation_euler = (rotation_x, rotation_y, rotation_z)
        print(f"[OK] 회전 적용: ({math.degrees(rotation_x):.1f}°, {math.degrees(rotation_y):.1f}°, {math.degrees(rotation_z):.1f}°)")
        return (rotation_x, rotation_y, rotation_z)
    
    def render_image(self, output_path):
        """이미지 렌더링"""
        bpy.context.scene.render.filepath = output_path
        bpy.ops.render.render(write_still=True)
        print(f"[OK] 렌더링 완료: {output_path}")
    
    def render_set(self, set_num, ldraw_path, output_dir, images_per_part=5):
        """세트 렌더링"""
        print(f"[START] 레고 세트 렌더링 시작: {set_num}")
        
        # 세트 부품 목록 조회
        set_parts = self.get_set_parts(set_num)
        if not set_parts:
            return
        
        # 출력 디렉토리 생성
        set_output_dir = os.path.join(output_dir, set_num)
        os.makedirs(set_output_dir, exist_ok=True)
        
        total_images = 0
        for part_data in set_parts:
            part_id = part_data['part_id']
            color_id = part_data['color_id']
            quantity = part_data['quantity']
            
            print(f"\n[FIX] 부품 렌더링: {part_id} (색상: {color_id}, 수량: {quantity})")
            
            for i in range(images_per_part):
                # 씬 초기화
                self.clear_scene()
                
                # 렌더링 설정
                self.setup_render_settings()
                self.setup_camera()
                self.setup_lighting()
                
                # LDraw 부품 로드
                part_object = self.load_ldraw_part(part_id, ldraw_path)
                if not part_object:
                    continue
                
                # 재질 적용
                color = self.apply_random_material(part_object, color_id)
                
                # 랜덤 회전 적용
                rotation = self.apply_random_rotation(part_object)
                
                # 렌더링
                output_filename = f"{set_num}_{part_id}_{color_id}_{i:03d}.webp"
                output_path = os.path.join(set_output_dir, output_filename)
                self.render_image(output_path)
                
                total_images += 1
                print(f"📸 이미지 생성: {output_filename}")
        
        print(f"\n[SUCCESS] 세트 렌더링 완료!")
        print(f"📊 결과:")
        print(f"   - 세트: {set_num}")
        print(f"   - 부품 수: {len(set_parts)}")
        print(f"   - 총 이미지: {total_images}")
        print(f"   - 출력 디렉토리: {set_output_dir}")

def main():
    """메인 실행 함수"""
    parser = argparse.ArgumentParser(description='레고 세트별 렌더링')
    parser.add_argument('--set-num', required=True, help='레고 세트 번호 (예: 30341-1)')
    parser.add_argument('--ldraw-path', default='C:/LDraw', help='LDraw 라이브러리 경로')
    parser.add_argument('--output-dir', default='./output/synthetic', help='출력 디렉토리')
    parser.add_argument('--images-per-part', type=int, default=5, help='부품당 이미지 수')
    parser.add_argument('--supabase-url', help='Supabase URL')
    parser.add_argument('--supabase-key', help='Supabase Key')
    
    args = parser.parse_args()
    
    # 환경 변수에서 Supabase 설정 로드
    if not args.supabase_url or not args.supabase_key:
        from dotenv import load_dotenv
        load_dotenv('config/synthetic_dataset.env')
        args.supabase_url = os.getenv('VITE_SUPABASE_URL')
        args.supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY')
    
    # 렌더러 생성
    renderer = LegoSetRenderer(args.supabase_url, args.supabase_key)
    
    # 세트 렌더링 실행
    renderer.render_set(
        set_num=args.set_num,
        ldraw_path=args.ldraw_path,
        output_dir=args.output_dir,
        images_per_part=args.images_per_part
    )

if __name__ == "__main__":
    main()

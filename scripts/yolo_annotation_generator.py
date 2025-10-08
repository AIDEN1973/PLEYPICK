#!/usr/bin/env python3
"""
🧱 BrickBox YOLO 어노테이션 자동 생성기

Blender의 3D 좌표를 YOLO 포맷으로 정확하게 변환하는 고급 로직
- 3D 월드 좌표 → 2D 카메라 투영
- 바운딩 박스 계산 및 정규화
- YOLO 포맷 변환
- 어노테이션 검증 및 품질 관리
"""

import bpy
import bmesh
import mathutils
import numpy as np
from mathutils import Vector, Matrix
import math
import json
from typing import Dict, List, Tuple, Optional, Union
from dataclasses import dataclass

@dataclass
class BoundingBox:
    """바운딩 박스 정보를 담는 데이터 클래스"""
    center_x: float
    center_y: float
    width: float
    height: float
    confidence: float = 1.0
    
    def to_yolo_format(self, class_id: int = 0) -> str:
        """YOLO 포맷 문자열로 변환"""
        return f"{class_id} {self.center_x:.6f} {self.center_y:.6f} {self.width:.6f} {self.height:.6f}"
    
    def to_pixel_coords(self, image_width: int, image_height: int) -> Dict:
        """픽셀 좌표로 변환"""
        center_x_pixel = self.center_x * image_width
        center_y_pixel = self.center_y * image_height
        width_pixel = self.width * image_width
        height_pixel = self.height * image_height
        
        return {
            'x_min': int(center_x_pixel - width_pixel / 2),
            'y_min': int(center_y_pixel - height_pixel / 2),
            'x_max': int(center_x_pixel + width_pixel / 2),
            'y_max': int(center_y_pixel + height_pixel / 2)
        }

class YOLOAnnotationGenerator:
    """YOLO 어노테이션 자동 생성기"""
    
    def __init__(self, image_width: int = 640, image_height: int = 640):
        self.image_width = image_width
        self.image_height = image_height
        self.camera = None
        self.scene = bpy.context.scene
        
    def setup_camera(self, camera_name: str = "SyntheticCamera") -> bool:
        """카메라 설정 및 검증"""
        try:
            self.camera = bpy.data.objects.get(camera_name)
            if not self.camera:
                print(f"❌ 카메라를 찾을 수 없습니다: {camera_name}")
                return False
            
            if self.camera.type != 'CAMERA':
                print(f"❌ 객체가 카메라가 아닙니다: {camera_name}")
                return False
            
            # 렌더 카메라로 설정
            self.scene.camera = self.camera
            return True
            
        except Exception as e:
            print(f"❌ 카메라 설정 실패: {e}")
            return False
    
    def get_camera_matrix(self) -> Matrix:
        """카메라 매트릭스 계산"""
        if not self.camera:
            raise ValueError("카메라가 설정되지 않았습니다")
        
        # 카메라의 월드 매트릭스
        camera_matrix = self.camera.matrix_world
        
        # 카메라 좌표계로 변환하는 매트릭스
        camera_to_world = camera_matrix
        world_to_camera = camera_to_world.inverted()
        
        return world_to_camera
    
    def project_3d_to_2d(self, world_point: Vector) -> Optional[Vector]:
        """3D 월드 좌표를 2D 카메라 좌표로 투영"""
        try:
            # 월드 좌표를 카메라 좌표로 변환
            camera_matrix = self.get_camera_matrix()
            camera_point = camera_matrix @ world_point
            
            # 카메라 앞에 있는지 확인
            if camera_point.z <= 0:
                return None
            
            # 2D 투영 (perspective projection)
            x_2d = camera_point.x / camera_point.z
            y_2d = camera_point.y / camera_point.z
            
            return Vector((x_2d, y_2d))
            
        except Exception as e:
            print(f"❌ 3D → 2D 투영 실패: {e}")
            return None
    
    def camera_to_screen_coords(self, camera_point: Vector) -> Vector:
        """카메라 좌표를 스크린 좌표로 변환"""
        # 카메라 센서 설정
        sensor_width = self.camera.data.sensor_width
        sensor_height = self.camera.data.sensor_height
        focal_length = self.camera.data.lens
        
        # 렌더 해상도
        render_width = self.scene.render.resolution_x
        render_height = self.scene.render.resolution_y
        
        # 픽셀 좌표로 변환
        pixel_x = (camera_point.x * focal_length / sensor_width + 0.5) * render_width
        pixel_y = (camera_point.y * focal_length / sensor_height + 0.5) * render_height
        
        return Vector((pixel_x, pixel_y))
    
    def calculate_bounding_box_advanced(self, object_name: str) -> Optional[BoundingBox]:
        """고급 바운딩 박스 계산 (메시 분석 기반)"""
        try:
            # 객체 가져오기
            obj = bpy.data.objects.get(object_name)
            if not obj or obj.type != 'MESH':
                print(f"❌ 메시 객체를 찾을 수 없습니다: {object_name}")
                return None
            
            # 메시 데이터 가져오기
            mesh = obj.data
            if not mesh.vertices:
                print(f"❌ 메시에 버텍스가 없습니다: {object_name}")
                return None
            
            # 객체의 월드 매트릭스
            object_matrix = obj.matrix_world
            
            # 모든 버텍스를 월드 좌표로 변환
            world_vertices = []
            for vertex in mesh.vertices:
                world_vertex = object_matrix @ vertex.co
                world_vertices.append(world_vertex)
            
            # 2D 투영 좌표 계산
            screen_vertices = []
            for world_vertex in world_vertices:
                camera_point = self.project_3d_to_2d(world_vertex)
                if camera_point:
                    screen_point = self.camera_to_screen_coords(camera_point)
                    screen_vertices.append(screen_point)
            
            if not screen_vertices:
                print(f"❌ 유효한 2D 투영 좌표가 없습니다: {object_name}")
                return None
            
            # 바운딩 박스 계산
            x_coords = [v.x for v in screen_vertices]
            y_coords = [v.y for v in screen_vertices]
            
            min_x, max_x = min(x_coords), max(x_coords)
            min_y, max_y = min(y_coords), max(y_coords)
            
            # 이미지 경계 내로 클램핑
            min_x = max(0, min(min_x, self.image_width))
            max_x = max(0, min(max_x, self.image_width))
            min_y = max(0, min(min_y, self.image_height))
            max_y = max(0, min(max_y, self.image_height))
            
            # 유효성 검사
            if max_x <= min_x or max_y <= min_y:
                print(f"❌ 유효하지 않은 바운딩 박스: {object_name}")
                return None
            
            # YOLO 포맷으로 변환 (정규화된 좌표)
            center_x = (min_x + max_x) / 2.0 / self.image_width
            center_y = (min_y + max_y) / 2.0 / self.image_height
            width = (max_x - min_x) / self.image_width
            height = (max_y - min_y) / self.image_height
            
            # 경계 검사
            if center_x < 0 or center_x > 1 or center_y < 0 or center_y > 1:
                print(f"⚠️ 바운딩 박스가 이미지 경계를 벗어남: {object_name}")
            
            if width <= 0 or height <= 0:
                print(f"❌ 유효하지 않은 크기: {object_name}")
                return None
            
            return BoundingBox(
                center_x=center_x,
                center_y=center_y,
                width=width,
                height=height
            )
            
        except Exception as e:
            print(f"❌ 바운딩 박스 계산 실패: {e}")
            return None
    
    def calculate_multiple_objects_bbox(self, object_names: List[str]) -> List[BoundingBox]:
        """여러 객체의 바운딩 박스 계산"""
        bboxes = []
        
        for i, obj_name in enumerate(object_names):
            bbox = self.calculate_bounding_box_advanced(obj_name)
            if bbox:
                bbox.class_id = i  # 클래스 ID 설정
                bboxes.append(bbox)
            else:
                print(f"⚠️ 객체 {obj_name}의 바운딩 박스 계산 실패")
        
        return bboxes
    
    def generate_yolo_annotation(self, object_names: Union[str, List[str]], 
                                class_ids: Optional[List[int]] = None) -> str:
        """YOLO 어노테이션 생성"""
        if isinstance(object_names, str):
            object_names = [object_names]
        
        if class_ids is None:
            class_ids = list(range(len(object_names)))
        
        bboxes = self.calculate_multiple_objects_bbox(object_names)
        
        # YOLO 포맷 문자열 생성
        yolo_lines = []
        for i, bbox in enumerate(bboxes):
            class_id = class_ids[i] if i < len(class_ids) else i
            yolo_line = f"{class_id} {bbox.center_x:.6f} {bbox.center_y:.6f} {bbox.width:.6f} {bbox.height:.6f}"
            yolo_lines.append(yolo_line)
        
        return '\n'.join(yolo_lines)
    
    def validate_annotation(self, bbox: BoundingBox) -> Dict[str, bool]:
        """어노테이션 품질 검증"""
        validation = {
            'valid_center': 0 <= bbox.center_x <= 1 and 0 <= bbox.center_y <= 1,
            'valid_size': 0 < bbox.width <= 1 and 0 < bbox.height <= 1,
            'reasonable_size': bbox.width > 0.01 and bbox.height > 0.01,  # 최소 크기
            'not_too_large': bbox.width < 0.95 and bbox.height < 0.95,  # 최대 크기
            'aspect_ratio_ok': 0.1 < bbox.width / bbox.height < 10  # 비율 검사
        }
        
        validation['overall_valid'] = all(validation.values())
        return validation
    
    def generate_annotation_with_validation(self, object_names: Union[str, List[str]], 
                                          class_ids: Optional[List[int]] = None) -> Dict:
        """검증이 포함된 어노테이션 생성"""
        if isinstance(object_names, str):
            object_names = [object_names]
        
        bboxes = self.calculate_multiple_objects_bbox(object_names)
        
        results = {
            'annotations': [],
            'valid_count': 0,
            'invalid_count': 0,
            'yolo_format': ''
        }
        
        for i, bbox in enumerate(bboxes):
            class_id = class_ids[i] if class_ids and i < len(class_ids) else i
            
            validation = self.validate_annotation(bbox)
            
            annotation_data = {
                'class_id': class_id,
                'bbox': bbox,
                'validation': validation,
                'yolo_line': bbox.to_yolo_format(class_id)
            }
            
            results['annotations'].append(annotation_data)
            
            if validation['overall_valid']:
                results['valid_count'] += 1
            else:
                results['invalid_count'] += 1
        
        # YOLO 포맷 문자열 생성
        valid_annotations = [ann for ann in results['annotations'] if ann['validation']['overall_valid']]
        results['yolo_format'] = '\n'.join([ann['yolo_line'] for ann in valid_annotations])
        
        return results
    
    def save_annotation_file(self, annotation_data: Dict, filepath: str) -> bool:
        """어노테이션 파일 저장"""
        try:
            with open(filepath, 'w') as f:
                f.write(annotation_data['yolo_format'])
            
            print(f"✅ 어노테이션 파일 저장: {filepath}")
            return True
            
        except Exception as e:
            print(f"❌ 어노테이션 파일 저장 실패: {e}")
            return False
    
    def generate_metadata(self, object_names: List[str], bboxes: List[BoundingBox]) -> Dict:
        """메타데이터 생성"""
        metadata = {
            'image_info': {
                'width': self.image_width,
                'height': self.image_height,
                'format': 'PNG'
            },
            'objects': [],
            'statistics': {
                'total_objects': len(bboxes),
                'valid_objects': 0,
                'average_bbox_size': 0
            }
        }
        
        total_size = 0
        valid_count = 0
        
        for i, (obj_name, bbox) in enumerate(zip(object_names, bboxes)):
            validation = self.validate_annotation(bbox)
            bbox_size = bbox.width * bbox.height
            
            object_info = {
                'name': obj_name,
                'class_id': i,
                'bbox': {
                    'center_x': bbox.center_x,
                    'center_y': bbox.center_y,
                    'width': bbox.width,
                    'height': bbox.height
                },
                'pixel_coords': bbox.to_pixel_coords(self.image_width, self.image_height),
                'validation': validation,
                'size': bbox_size
            }
            
            metadata['objects'].append(object_info)
            
            if validation['overall_valid']:
                valid_count += 1
                total_size += bbox_size
        
        metadata['statistics']['valid_objects'] = valid_count
        metadata['statistics']['average_bbox_size'] = total_size / max(valid_count, 1)
        
        return metadata

def main():
    """메인 실행 함수 (Blender 내에서 실행)"""
    print("🧱 BrickBox YOLO 어노테이션 생성기 시작")
    
    # 어노테이션 생성기 초기화
    generator = YOLOAnnotationGenerator(image_width=640, image_height=640)
    
    # 카메라 설정
    if not generator.setup_camera():
        print("❌ 카메라 설정 실패")
        return
    
    # 렌더링된 객체들 찾기
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    
    if not mesh_objects:
        print("❌ 렌더링할 메시 객체가 없습니다")
        return
    
    print(f"📦 발견된 객체: {len(mesh_objects)}개")
    for obj in mesh_objects:
        print(f"  - {obj.name}")
    
    # 어노테이션 생성
    object_names = [obj.name for obj in mesh_objects]
    results = generator.generate_annotation_with_validation(object_names)
    
    print(f"\n📊 어노테이션 생성 결과:")
    print(f"  - 총 객체: {len(results['annotations'])}개")
    print(f"  - 유효한 객체: {results['valid_count']}개")
    print(f"  - 무효한 객체: {results['invalid_count']}개")
    
    # YOLO 포맷 출력
    print(f"\n📝 YOLO 포맷:")
    print(results['yolo_format'])
    
    # 메타데이터 생성
    bboxes = [ann['bbox'] for ann in results['annotations']]
    metadata = generator.generate_metadata(object_names, bboxes)
    
    print(f"\n📋 메타데이터:")
    print(json.dumps(metadata, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()

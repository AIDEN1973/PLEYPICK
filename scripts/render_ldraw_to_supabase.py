#!/usr/bin/env python3
"""
🧱 BrickBox LDraw → Blender → Supabase 합성 데이터셋 생성 스크립트

이 스크립트는 LDraw 3D CAD 모델을 Blender에서 렌더링하여 
Supabase Storage에 자동 업로드하는 합성 데이터셋 생성 파이프라인입니다.

주요 기능:
- LDraw .dat 파일 자동 로드
- 랜덤 각도/색상/조명/배경으로 렌더링
- 3D 좌표 → YOLO 포맷 자동 변환
- Supabase Storage 자동 업로드
- 메타데이터 자동 기록

사용법:
1. Blender 3.6+ 설치
2. LDraw Importer Add-on 설치
3. python render_ldraw_to_supabase.py --part-id 3001 --count 100
"""

import bpy
import bmesh
import os
import sys
import json
import random
import math
import mathutils
import time
import multiprocessing
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from mathutils import Vector, Euler
from bpy_extras.object_utils import world_to_camera_view
import numpy as np
from pathlib import Path
import argparse
from datetime import datetime
# YAML 대신 JSON으로 YOLO 설정 파일 생성 (Blender 환경 호환성)
yaml = None  # yaml 모듈 사용하지 않음

def create_dataset_yaml(output_dir, class_names, part_id):
    """YOLO 데이터셋용 설정 파일 생성 (JSON 형식)"""
    dataset_config = {
        'path': str(output_dir),
        'train': 'images',
        'val': 'images',
        'nc': len(class_names),
        'names': class_names
    }
    
    # JSON 형식으로 YOLO 설정 파일 생성
    json_path = output_dir / 'dataset.json'
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(dataset_config, f, ensure_ascii=False, indent=2)
    
    # YAML 형식도 간단하게 생성 (수동으로)
    yaml_path = output_dir / 'dataset.yaml'
    with open(yaml_path, 'w', encoding='utf-8') as f:
        f.write(f"# YOLO Dataset Configuration\n")
        f.write(f"path: {output_dir}\n")
        f.write(f"train: images\n")
        f.write(f"val: images\n")
        f.write(f"nc: {len(class_names)}\n")
        f.write(f"names: {class_names}\n")
    
    print(f"✅ dataset.yaml 생성: {yaml_path}")
    print(f"✅ dataset.json 생성: {json_path}")
    return yaml_path

# 환경 선로드: 스크립트 진입 즉시 .env 계열 강제 로드(Blender 인자 전달 실패 대비)
try:
    import os as _os
    import sys as _sys
    
    # dotenv 패키지 강제 설치/로드
    try:
        from dotenv import load_dotenv as _load_dotenv
    except ImportError:
        try:
            import subprocess
            subprocess.check_call([_sys.executable, '-m', 'pip', 'install', '--user', 'python-dotenv'])
            from dotenv import load_dotenv as _load_dotenv
        except Exception:
            print("⚠️ python-dotenv 설치 실패, 환경변수 로드 불가")
            _load_dotenv = None
    
    _root = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..'))
    _candidates = [
        _os.path.join(_root, '.env.blender'),
        _os.path.join(_root, 'config', 'synthetic_dataset.env'),
        _os.path.join(_root, '.env'),
    ]
    _loaded = []
    if _load_dotenv:
        for _p in _candidates:
            try:
                if _os.path.exists(_p):
                    _load_dotenv(_p)
                    _loaded.append(_p)
            except Exception:
                pass
    try:
        print(f"🧪 env pre-load → files={len(_loaded)} loaded={[_os.path.basename(x) for x in _loaded]}")
    except Exception:
        pass
except Exception:
    pass

# JSON 직렬화 보조: Vector/Euler/NumPy 등 비원시 타입 변환
def make_json_safe(value):
    try:
        import numpy as _np
    except Exception:
        _np = None

    # 기본 타입은 그대로 반환
    if value is None or isinstance(value, (bool, int, float, str)):
        return value

    # Blender 수학 타입 변환
    try:
        from mathutils import Vector as _Vector, Euler as _Euler
        if isinstance(value, (_Vector, _Euler)):
            try:
                return [float(x) for x in value[:]]
            except Exception:
                # Fallback: 개별 속성 접근
                comps = []
                for attr in ('x', 'y', 'z'):
                    if hasattr(value, attr):
                        try:
                            comps.append(float(getattr(value, attr)))
                        except Exception:
                            pass
                return comps
    except Exception:
        pass

    # NumPy 스칼라/배열 처리
    if _np is not None:
        try:
            if isinstance(value, _np.generic):
                return value.item()
            if isinstance(value, _np.ndarray):
                return value.tolist()
        except Exception:
            pass

    # 시퀀스/매핑 재귀 변환
    if isinstance(value, (list, tuple, set)):
        return [make_json_safe(v) for v in value]
    if isinstance(value, dict):
        return { str(make_json_safe(k)): make_json_safe(v) for k, v in value.items() }

    # 기타 객체는 문자열로 폴백
    try:
        return str(value)
    except Exception:
        return None

# Supabase 클라이언트 (Blender 내에서 실행) - 강화된 폴백
try:
    import sys
    import os
    import urllib.request
    import zipfile
    import tempfile
    
    # Blender 내부에서 외부 패키지 사용을 위한 경로 추가
    sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
    from supabase import create_client, Client
    from dotenv import load_dotenv
    SUPABASE_AVAILABLE = True
    print("✅ Supabase 패키지 정상 로드")
except ImportError:
    try:
        print("🔧 Supabase 패키지 수동 설치 시도 중...")
        
        # 임시 디렉토리에 패키지 다운로드
        temp_dir = tempfile.mkdtemp()
        packages_dir = os.path.join(temp_dir, 'packages')
        os.makedirs(packages_dir, exist_ok=True)
        
        # pip install --target 방식으로 설치 (의존성 포함)
        import subprocess
        result = subprocess.run([
            sys.executable, '-m', 'pip', 'install', 
            '--target', packages_dir,
            'supabase', 'python-dotenv'
        ], capture_output=True, text=True, timeout=120)
        
        if result.returncode == 0:
            # 설치된 패키지를 sys.path에 추가
            sys.path.insert(0, packages_dir)
            from supabase import create_client, Client
            from dotenv import load_dotenv
            SUPABASE_AVAILABLE = True
            print("✅ Supabase 패키지 수동 설치 완료")
        else:
            raise Exception(f"pip install failed: {result.stderr}")
            
    except Exception as e:
        print(f"⚠️ Supabase 패키지 설치 실패: {e}")
        print("📝 대안: 로컬 저장만 수행됩니다.")
        SUPABASE_AVAILABLE = False

class LDrawRenderer:
    """LDraw 모델을 렌더링하여 합성 데이터셋을 생성하는 클래스"""
    
    def __init__(self, supabase_url=None, supabase_key=None, background='white', color_management='auto'):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.supabase = None
        self.current_samples = 64  # 기본 샘플 수
        self.background = background  # 'white' | 'gray' | 'auto'
        self.color_management = color_management  # 'auto' | 'filmic' | 'standard'
        self.background_gray_value = 0.5
        self.resolution = (1024, 1024)  # 고해상도 기본 설정
        self.target_fill = 0.85
        
        # 흰색 부품 감지 임계값 (설정 가능)
        self.WHITE_THRESHOLD = 0.9  # RGB 값이 이 값 이상이면 흰색으로 판단
        self.BRIGHT_PART_DARKENING = 0.95  # 밝은 부품을 이 비율만큼 어둡게 조정
        
        # 캐싱 시스템 초기화
        self.scene_cache = {}  # 부품별 기본 씬 캐시
        self.material_cache = {}  # 재질/텍스처 캐시
        self.cache_dir = os.path.join(os.path.dirname(__file__), '..', 'temp', 'cache')
        self._ensure_cache_dir()
        
        # GPU 및 메모리 최적화 초기화
        self.gpu_optimized = False
        self.memory_optimized = False
        self._setup_gpu_optimization()
        self._setup_memory_optimization()
        
        # 적응형 샘플링 시스템 초기화
        self.adaptive_sampling = True
        self.complexity_cache = {}  # 부품별 복잡도 캐시
        self.noise_correction = True  # Noise Map 기반 보정
        self.quality_threshold = 0.95  # SSIM 품질 임계값
        self._setup_adaptive_sampling()
        
        # 병렬 렌더링 초기화
        self.parallel_enabled = False
        self.max_workers = min(multiprocessing.cpu_count(), 4)  # 최대 4개 워커
        self._setup_parallel_rendering()
        
        # Supabase 클라이언트 초기화 (+강화된 폴백)
        if SUPABASE_AVAILABLE:
            try:
                url = supabase_url
                key = supabase_key
                if not url or not key:
                    try:
                        # 다양한 파일에서 환경값 시도
                        from dotenv import dotenv_values
                        candidates = [
                            os.path.join(os.path.dirname(__file__), '..', '.env.blender'),
                            os.path.join(os.path.dirname(__file__), '..', 'config', 'synthetic_dataset.env'),
                            os.path.join(os.path.dirname(__file__), '..', '.env'),
                        ]
                        merged = {}
                        for p in candidates:
                            try:
                                if os.path.exists(p):
                                    merged.update(dotenv_values(p) or {})
                            except Exception:
                                pass
                        url = url or os.getenv('VITE_SUPABASE_URL') or merged.get('VITE_SUPABASE_URL') or merged.get('SUPABASE_URL')
                        key = key or os.getenv('SUPABASE_SERVICE_ROLE') or merged.get('SUPABASE_SERVICE_ROLE') \
                                  or os.getenv('SUPABASE_SERVICE_KEY') or merged.get('SUPABASE_SERVICE_KEY') \
                                  or os.getenv('SUPABASE_SERVICE_KEY_JWT') or merged.get('SUPABASE_SERVICE_KEY_JWT') \
                                  or os.getenv('VITE_SUPABASE_SERVICE_ROLE') or merged.get('VITE_SUPABASE_SERVICE_ROLE') \
                                  or os.getenv('SUPABASE_KEY') or merged.get('SUPABASE_KEY') \
                                  or os.getenv('VITE_SUPABASE_ANON_KEY') or merged.get('VITE_SUPABASE_ANON_KEY')
                    except Exception:
                        pass
                try:
                    print(f"🔎 Supabase init → url_present={bool(url)}, key_present={bool(key)}")
                except Exception:
                    pass
                if url and key:
                    self.supabase = create_client(url, key)
                    print("✅ Supabase 클라이언트 연결 성공")
                else:
                    print("⚠️ Supabase 환경변수 누락: 업로드 비활성화됨")
            except Exception as e:
                print(f"❌ Supabase 연결 실패: {e}")
        
        # 색상 팔레트 (LEGO 공식 색상)
        self.lego_colors = {
            'red': (0.8, 0.1, 0.1, 1.0),
            'blue': (0.1, 0.3, 0.8, 1.0),
            'green': (0.1, 0.7, 0.2, 1.0),
            'yellow': (0.9, 0.8, 0.1, 1.0),
            'white': (0.95, 0.95, 0.95, 1.0),
            'black': (0.1, 0.1, 0.1, 1.0),
            'orange': (0.9, 0.4, 0.1, 1.0),
            'purple': (0.5, 0.1, 0.7, 1.0),
            'pink': (0.9, 0.4, 0.7, 1.0),
            'brown': (0.4, 0.2, 0.1, 1.0),
            'gray': (0.5, 0.5, 0.5, 1.0),
            'lime': (0.6, 0.9, 0.1, 1.0),
            'cyan': (0.1, 0.8, 0.8, 1.0),
            'magenta': (0.8, 0.1, 0.6, 1.0)
        }
    
    def setup_render_settings(self, samples=64):
        """렌더링 설정 초기화 - 배경 설정 제거"""
        # 렌더 엔진을 Cycles로 설정
        bpy.context.scene.render.engine = 'CYCLES'
        
        # 장치 설정 (안전한 CPU 폴백)
        try:
            bpy.context.scene.cycles.device = 'CPU'
            prefs = bpy.context.preferences.addons['cycles'].preferences
            available_types = []
            if hasattr(prefs, 'get_device_types'):
                try:
                    available_types = [t[0] for t in prefs.get_device_types(bpy.context)]
                except Exception:
                    available_types = []
            for device_type in ['OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL']:
                if device_type in available_types:
                    prefs.compute_device_type = device_type
                    bpy.context.scene.cycles.device = 'GPU'
                    break
        except Exception:
            bpy.context.scene.cycles.device = 'CPU'
        
        # 해상도 설정 (YOLO 학습용)
        bpy.context.scene.render.resolution_x = int(self.resolution[0])
        bpy.context.scene.render.resolution_y = int(self.resolution[1])
        
        # 샘플링 설정 (품질 vs 속도 균형)
        bpy.context.scene.cycles.samples = samples
        self.current_samples = samples  # 현재 샘플 수 저장
        
        # 렌더링 품질 개선
        bpy.context.scene.cycles.use_denoising = True  # 노이즈 제거 활성화
        bpy.context.scene.cycles.denoiser = 'OPTIX' if bpy.context.scene.cycles.device == 'GPU' else 'OPENIMAGEDENOISE'
        
        # 출력 포맷 (WebP Q80으로 용량 최적화)
        bpy.context.scene.render.image_settings.file_format = 'WEBP'
        bpy.context.scene.render.image_settings.color_mode = 'RGB'  # RGBA → RGB (25% 용량 절약)
        bpy.context.scene.render.image_settings.quality = 80  # WebP Q80 품질 설정

        # 노출/색공간
        try:
            view = bpy.context.scene.view_settings
            # 자동 모드: 배경 white면 Standard(진짜 흰색 유지), 그 외는 Filmic
            if str(self.color_management).lower() == 'filmic':
                view.view_transform = 'Filmic'
            elif str(self.color_management).lower() == 'standard':
                view.view_transform = 'Standard'
            else:
                view.view_transform = 'Standard' if str(self.background).lower() == 'white' else 'Filmic'
            view.exposure = 0.0
            view.gamma = 1.0
        except Exception:
            pass
    
    def _ensure_cache_dir(self):
        """캐시 디렉토리 생성"""
        try:
            os.makedirs(self.cache_dir, exist_ok=True)
            print(f"📁 캐시 디렉토리: {self.cache_dir}")
        except Exception as e:
            print(f"⚠️ 캐시 디렉토리 생성 실패: {e}")
    
    def _get_cache_key(self, part_id, color_id, samples):
        """캐시 키 생성"""
        return f"{part_id}_{color_id}_{samples}_{self.background}_{self.resolution[0]}x{self.resolution[1]}"
    
    def _get_material_cache_key(self, color_hex, material_type="plastic"):
        """재질 캐시 키 생성"""
        return f"{color_hex}_{material_type}_{self.current_samples}"
    
    def _save_scene_cache(self, cache_key, scene_data):
        """씬 캐시 저장"""
        try:
            cache_file = os.path.join(self.cache_dir, f"scene_{cache_key}.blend")
            bpy.ops.wm.save_as_mainfile(filepath=cache_file)
            self.scene_cache[cache_key] = {
                'file_path': cache_file,
                'created_at': time.time(),
                'scene_data': scene_data
            }
            print(f"💾 씬 캐시 저장: {cache_key}")
        except Exception as e:
            print(f"⚠️ 씬 캐시 저장 실패: {e}")
    
    def _load_scene_cache(self, cache_key):
        """씬 캐시 로드"""
        try:
            if cache_key in self.scene_cache:
                cache_data = self.scene_cache[cache_key]
                cache_file = cache_data['file_path']
                
                # 캐시 파일이 존재하는지 확인
                if os.path.exists(cache_file):
                    # 캐시에서 씬 로드
                    bpy.ops.wm.open_mainfile(filepath=cache_file)
                    print(f"📂 씬 캐시 로드: {cache_key}")
                    return True
                else:
                    # 파일이 없으면 캐시에서 제거
                    del self.scene_cache[cache_key]
            return False
        except Exception as e:
            print(f"⚠️ 씬 캐시 로드 실패: {e}")
            return False
    
    def _get_cached_material(self, color_hex, material_type="plastic"):
        """캐시된 재질 가져오기"""
        cache_key = self._get_material_cache_key(color_hex, material_type)
        
        if cache_key in self.material_cache:
            print(f"🎨 재질 캐시 히트: {color_hex}")
            return self.material_cache[cache_key]
        
        return None
    
    def _save_material_cache(self, color_hex, material, material_type="plastic"):
        """재질 캐시 저장"""
        cache_key = self._get_material_cache_key(color_hex, material_type)
        self.material_cache[cache_key] = {
            'material': material,
            'color_hex': color_hex,
            'created_at': time.time()
        }
        print(f"💾 재질 캐시 저장: {color_hex}")
    
    def _setup_gpu_optimization(self):
        """GPU 최적화 설정"""
        try:
            # Cycles 애드온 활성화 확인
            if 'cycles' not in bpy.context.preferences.addons:
                print("⚠️ Cycles 애드온이 활성화되지 않음")
                return
            
            # GPU 디바이스 감지 및 설정
            prefs = bpy.context.preferences.addons['cycles'].preferences
            
            # 사용 가능한 GPU 타입 확인
            available_devices = []
            for device_type in ['OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL']:
                try:
                    if hasattr(prefs, 'get_device_types'):
                        device_types = prefs.get_device_types(bpy.context)
                        if device_type in [t[0] for t in device_types]:
                            available_devices.append(device_type)
                except:
                    continue
            
            # 최적 GPU 선택 및 설정
            if 'OPTIX' in available_devices:
                prefs.compute_device_type = 'OPTIX'
                bpy.context.scene.cycles.device = 'GPU'
                bpy.context.scene.cycles.denoiser = 'OPTIX'
                print("🚀 OPTIX GPU 가속 활성화 (RTX 카드)")
                self.gpu_optimized = True
            elif 'CUDA' in available_devices:
                prefs.compute_device_type = 'CUDA'
                bpy.context.scene.cycles.device = 'GPU'
                bpy.context.scene.cycles.denoiser = 'OPENIMAGEDENOISE'
                print("🚀 CUDA GPU 가속 활성화 (GTX/RTX 카드)")
                self.gpu_optimized = True
            elif 'HIP' in available_devices:
                prefs.compute_device_type = 'HIP'
                bpy.context.scene.cycles.device = 'GPU'
                print("🚀 HIP GPU 가속 활성화 (AMD 카드)")
                self.gpu_optimized = True
            elif 'METAL' in available_devices:
                prefs.compute_device_type = 'METAL'
                bpy.context.scene.cycles.device = 'GPU'
                print("🚀 METAL GPU 가속 활성화 (Apple Silicon)")
                self.gpu_optimized = True
            else:
                bpy.context.scene.cycles.device = 'CPU'
                print("⚠️ GPU 없음, CPU 사용")
                self.gpu_optimized = False
            
            # GPU 최적화 설정
            if self.gpu_optimized:
                # GPU 메모리 최적화
                bpy.context.scene.cycles.debug_use_spatial_splits = True
                bpy.context.scene.cycles.debug_use_hair_bvh = True
                
                # GPU 샘플링 최적화
                bpy.context.scene.cycles.sample_clamp_indirect = 10.0
                bpy.context.scene.cycles.sample_clamp_direct = 0.0
                
                print("✅ GPU 최적화 설정 완료")
                
        except Exception as e:
            print(f"⚠️ GPU 최적화 설정 실패: {e}")
            self.gpu_optimized = False
    
    def _setup_memory_optimization(self):
        """메모리 최적화 설정"""
        try:
            # GPU 메모리 최적화
            if self.gpu_optimized:
                # GPU별 최적 타일 크기 설정
                gpu_memory = self._get_gpu_memory()
                if gpu_memory >= 8:  # 8GB 이상
                    bpy.context.scene.cycles.tile_size = 256
                    print("💾 고성능 GPU 메모리 설정 (8GB+)")
                elif gpu_memory >= 4:  # 4-8GB
                    bpy.context.scene.cycles.tile_size = 128
                    print("💾 중간 성능 GPU 메모리 설정 (4-8GB)")
                else:  # 4GB 미만
                    bpy.context.scene.cycles.tile_size = 64
                    print("💾 저성능 GPU 메모리 설정 (<4GB)")
            else:
                # CPU 메모리 최적화
                bpy.context.scene.cycles.tile_size = 32
                print("💾 CPU 메모리 최적화 설정")
            
            # 텍스처 압축 설정
            bpy.context.scene.render.image_settings.compression = 15
            
            # 메모리 효율성 설정
            bpy.context.scene.cycles.debug_use_spatial_splits = True
            bpy.context.scene.cycles.debug_use_hair_bvh = True
            
            self.memory_optimized = True
            print("✅ 메모리 최적화 설정 완료")
            
        except Exception as e:
            print(f"⚠️ 메모리 최적화 설정 실패: {e}")
            self.memory_optimized = False
    
    def _get_gpu_memory(self):
        """GPU 메모리 크기 추정 (MB)"""
        try:
            if self.gpu_optimized:
                # GPU 메모리 정보 가져오기
                import bpy
                scene = bpy.context.scene
                
                # GPU 메모리 사용량 추정
                if scene.cycles.device == 'GPU':
                    # 타일 크기와 해상도로 메모리 추정
                    tile_size = scene.cycles.tile_size
                    resolution = scene.render.resolution
                    
                    # 메모리 사용량 계산 (추정)
                estimated_memory = 1024  # 기본 1GB
                
                # GPU별 메모리 추정
                if 'OPTIX' in str(bpy.context.preferences.addons['cycles'].preferences.compute_device_type):
                    estimated_memory = 8192  # RTX 카드 (8GB)
                elif 'CUDA' in str(bpy.context.preferences.addons['cycles'].preferences.compute_device_type):
                    estimated_memory = 4096  # GTX 카드 (4GB)
                elif 'HIP' in str(bpy.context.preferences.addons['cycles'].preferences.compute_device_type):
                    estimated_memory = 4096  # AMD 카드 (4GB)
                elif 'METAL' in str(bpy.context.preferences.addons['cycles'].preferences.compute_device_type):
                    estimated_memory = 8192  # Apple Silicon (8GB)
                
                return estimated_memory
            else:
                return 0
        except:
            return 1024  # 기본값
    
    def _setup_adaptive_sampling(self):
        """적응형 샘플링 시스템 설정"""
        try:
            # 부품 복잡도 분류 규칙
            self.complexity_rules = {
                # 단순 부품 (Plate/Tile) - 256 샘플
                'simple': {
                    'keywords': ['plate', 'tile', 'brick', 'stud'],
                    'patterns': [r'^\d+$', r'^\d+x\d+$'],  # 기본 브릭
                    'samples': 256,
                    'description': '단순 부품 (Plate/Tile)'
                },
                # 중간 복잡도 부품 - 320 샘플
                'medium': {
                    'keywords': ['beam', 'rod', 'axle', 'pin', 'connector'],
                    'patterns': [r'^\d+-\d+$', r'^\d+x\d+x\d+$'],
                    'samples': 320,
                    'description': '중간 복잡도 부품'
                },
                # 복잡한 부품 (Technic) - 400 샘플
                'complex': {
                    'keywords': ['technic', 'gear', 'wheel', 'tire', 'panel', 'slope'],
                    'patterns': [r'^\d+-\d+-\d+$', r'^\d+x\d+x\d+x\d+$'],
                    'samples': 400,
                    'description': '복잡한 부품 (Technic)'
                },
                # 투명/반사 전용 부품 - 480 샘플
                'transparent_reflective': {
                    'keywords': ['glass', 'crystal', 'transparent', 'clear', 'mirror', 'chrome'],
                    'patterns': [r'^\d+-\d+-\d+$', r'^\d+x\d+x\d+x\d+$'],
                    'color_ids': [47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60],  # 투명/반사 색상 ID
                    'samples': 480,
                    'description': '투명/반사 전용 부품'
                }
            }
            
            print("🎯 적응형 샘플링 시스템 활성화")
            print("  - 단순 부품: 256 샘플 (Plate/Tile)")
            print("  - 중간 부품: 320 샘플 (Beam/Rod)")
            print("  - 복잡 부품: 400 샘플 (Technic)")
            print("  - 투명/반사: 480 샘플 (Glass/Crystal)")
            
        except Exception as e:
            print(f"⚠️ 적응형 샘플링 설정 실패: {e}")
            self.adaptive_sampling = False
    
    def _analyze_part_complexity(self, part_id, part_path=None, force_color_id=None):
        """부품 복잡도 분석"""
        try:
            # 캐시에서 복잡도 확인
            cache_key = f"{part_id}_{force_color_id or 0}"
            if cache_key in self.complexity_cache:
                return self.complexity_cache[cache_key]
            
            complexity_score = 0
            part_name = str(part_id).lower()
            
            # 투명/반사 색상 ID 우선 확인
            if force_color_id and force_color_id in [47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60]:
                complexity_score = 4  # 투명/반사 최고 우선순위
            
            # 키워드 기반 복잡도 분석
            for category, rules in self.complexity_rules.items():
                for keyword in rules['keywords']:
                    if keyword in part_name:
                        if category == 'simple':
                            complexity_score = max(complexity_score, 1)
                        elif category == 'medium':
                            complexity_score = max(complexity_score, 2)
                        elif category == 'complex':
                            complexity_score = max(complexity_score, 3)
                        elif category == 'transparent_reflective':
                            complexity_score = max(complexity_score, 4)
                        break
                if complexity_score > 0:
                    break
            
            # 패턴 기반 복잡도 분석
            if complexity_score == 0:
                import re
                for category, rules in self.complexity_rules.items():
                    for pattern in rules['patterns']:
                        if re.match(pattern, str(part_id)):
                            if category == 'simple':
                                complexity_score = 1
                            elif category == 'medium':
                                complexity_score = 2
                            elif category == 'complex':
                                complexity_score = 3
                            break
                    if complexity_score > 0:
                        break
            
            # 파일 크기 기반 복잡도 분석 (파일이 있는 경우)
            if part_path and os.path.exists(part_path):
                file_size = os.path.getsize(part_path)
                if file_size < 1000:  # 1KB 미만
                    complexity_score = max(complexity_score, 1)  # 단순
                elif file_size < 5000:  # 5KB 미만
                    complexity_score = max(complexity_score, 2)  # 중간
                else:  # 5KB 이상
                    complexity_score = max(complexity_score, 3)  # 복잡
            
            # 복잡도 분류
            if complexity_score <= 1:
                category = 'simple'
            elif complexity_score <= 2:
                category = 'medium'
            elif complexity_score <= 3:
                category = 'complex'
            else:  # complexity_score >= 4
                category = 'transparent_reflective'
            
            # 캐시에 저장
            self.complexity_cache[cache_key] = {
                'category': category,
                'score': complexity_score,
                'samples': self.complexity_rules[category]['samples'],
                'description': self.complexity_rules[category]['description']
            }
            
            return self.complexity_cache[cache_key]
            
        except Exception as e:
            print(f"⚠️ 부품 복잡도 분석 실패: {e}")
            # 기본값: 복잡한 부품으로 분류
            return {
                'category': 'complex',
                'score': 3,
                'samples': 400,
                'description': '복잡한 부품 (기본값)'
            }
    
    def _get_adaptive_samples(self, part_id, part_path=None, force_color_id=None):
        """적응형 샘플 수 결정"""
        if not self.adaptive_sampling:
            return self.current_samples
        
        complexity_info = self._analyze_part_complexity(part_id, part_path, force_color_id)
        adaptive_samples = complexity_info['samples']
        
        print(f"🎯 부품 {part_id} 복잡도 분석: {complexity_info['description']} → {adaptive_samples} 샘플")
        
        return adaptive_samples
    
    def _analyze_noise_map(self, image_path):
        """Noise Map 분석 및 샘플 수 보정"""
        try:
            if not self.noise_correction:
                return 0
            
            # 이미지 로드 및 노이즈 분석
            import cv2
            import numpy as np
            
            image = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
            if image is None:
                return 0
            
            # 노이즈 레벨 계산 (Laplacian variance)
            laplacian_var = cv2.Laplacian(image, cv2.CV_64F).var()
            
            # 노이즈 레벨에 따른 샘플 수 보정
            if laplacian_var > 1000:  # 높은 노이즈
                return 64  # +64 샘플 추가
            elif laplacian_var > 500:  # 중간 노이즈
                return 32  # +32 샘플 추가
            elif laplacian_var > 200:  # 낮은 노이즈
                return 16  # +16 샘플 추가
            else:  # 매우 낮은 노이즈
                return 0  # 보정 불필요
            
        except Exception as e:
            print(f"⚠️ Noise Map 분석 실패: {e}")
            return 0
    
    def _validate_render_quality(self, image_path, target_samples):
        """SSIM 기반 렌더링 품질 검증"""
        try:
            if not self.noise_correction:
                return True
            
            # SSIM 계산 (간단한 구현)
            import cv2
            import numpy as np
            
            # 기준 이미지와 비교 (이전 샘플 수준)
            reference_path = image_path.replace('.png', '_ref.png')
            if not os.path.exists(reference_path):
                return True  # 기준 이미지가 없으면 통과
            
            img1 = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
            img2 = cv2.imread(reference_path, cv2.IMREAD_GRAYSCALE)
            
            if img1 is None or img2 is None:
                return True
            
            # 간단한 SSIM 계산
            ssim_score = self._calculate_ssim(img1, img2)
            
            # 품질 임계값 확인
            if ssim_score >= self.quality_threshold:
                print(f"✅ 품질 검증 통과: SSIM {ssim_score:.3f}")
                return True
            else:
                print(f"⚠️ 품질 검증 실패: SSIM {ssim_score:.3f} < {self.quality_threshold}")
                return False
                
        except Exception as e:
            print(f"⚠️ 품질 검증 실패: {e}")
            return True  # 오류 시 통과
    
    def _calculate_ssim(self, img1, img2):
        """SSIM 계산 (간단한 구현)"""
        try:
            # 이미지 크기 맞추기
            h, w = min(img1.shape[0], img2.shape[0]), min(img1.shape[1], img2.shape[1])
            img1 = img1[:h, :w]
            img2 = img2[:h, :w]
            
            # 간단한 SSIM 계산
            mu1 = np.mean(img1)
            mu2 = np.mean(img2)
            sigma1 = np.var(img1)
            sigma2 = np.var(img2)
            sigma12 = np.mean((img1 - mu1) * (img2 - mu2))
            
            c1 = 0.01 ** 2
            c2 = 0.03 ** 2
            
            ssim = ((2 * mu1 * mu2 + c1) * (2 * sigma12 + c2)) / \
                   ((mu1 ** 2 + mu2 ** 2 + c1) * (sigma1 + sigma2 + c2))
            
            return ssim
            
        except Exception as e:
            print(f"⚠️ SSIM 계산 실패: {e}")
            return 0.5  # 기본값
    
    def _setup_parallel_rendering(self):
        """병렬 렌더링 설정"""
        try:
            # CPU 코어 수 확인
            cpu_count = multiprocessing.cpu_count()
            print(f"🖥️ CPU 코어 수: {cpu_count}")
            
            # 최적 워커 수 결정
            if cpu_count >= 8:
                self.max_workers = 4  # 8코어 이상: 4개 워커
                print("🚀 고성능 병렬 렌더링 (4 워커)")
            elif cpu_count >= 4:
                self.max_workers = 3  # 4-7코어: 3개 워커
                print("🚀 중간 성능 병렬 렌더링 (3 워커)")
            elif cpu_count >= 2:
                self.max_workers = 2  # 2-3코어: 2개 워커
                print("🚀 저성능 병렬 렌더링 (2 워커)")
            else:
                self.max_workers = 1  # 1코어: 순차 렌더링
                print("⚠️ 단일 코어, 순차 렌더링")
            
            # 병렬 렌더링 활성화
            if self.max_workers > 1:
                self.parallel_enabled = True
                print(f"✅ 병렬 렌더링 활성화 ({self.max_workers} 워커)")
            else:
                self.parallel_enabled = False
                print("⚠️ 병렬 렌더링 비활성화")
                
        except Exception as e:
            print(f"⚠️ 병렬 렌더링 설정 실패: {e}")
            self.parallel_enabled = False
            self.max_workers = 1
    
    def render_parallel_batch(self, part_path, part_id, output_dir, indices, force_color_id=None):
        """병렬 배치 렌더링"""
        if not self.parallel_enabled or self.max_workers <= 1:
            # 순차 렌더링
            results = []
            for index in indices:
                result = self.render_single_part(part_path, part_id, output_dir, index, force_color_id)
                if result:
                    results.append(result)
            return results
        
        try:
            # 병렬 렌더링 실행
            print(f"🚀 병렬 렌더링 시작 ({len(indices)}개, {self.max_workers} 워커)")
            
            # 배치 크기 계산 (워커당 적절한 작업량)
            batch_size = max(1, len(indices) // self.max_workers)
            batches = [indices[i:i+batch_size] for i in range(0, len(indices), batch_size)]
            
            results = []
            with ProcessPoolExecutor(max_workers=self.max_workers) as executor:
                # 각 배치를 병렬로 실행
                futures = []
                for batch in batches:
                    future = executor.submit(self._render_batch_worker, part_path, part_id, output_dir, batch, force_color_id)
                    futures.append(future)
                
                # 결과 수집
                for future in futures:
                    batch_results = future.result()
                    results.extend(batch_results)
            
            print(f"✅ 병렬 렌더링 완료: {len(results)}개 성공")
            return results
            
        except Exception as e:
            print(f"⚠️ 병렬 렌더링 실패, 순차 렌더링으로 전환: {e}")
            # 폴백: 순차 렌더링
            results = []
            for index in indices:
                result = self.render_single_part(part_path, part_id, output_dir, index, force_color_id)
                if result:
                    results.append(result)
            return results
    
    def _render_batch_worker(self, part_path, part_id, output_dir, indices, force_color_id):
        """워커 프로세스에서 실행되는 배치 렌더링"""
        # 각 워커는 독립적인 Blender 인스턴스에서 실행
        results = []
        for index in indices:
            try:
                # 독립적인 렌더링 프로세스
                result = self._render_single_isolated(part_path, part_id, output_dir, index, force_color_id)
                if result:
                    results.append(result)
            except Exception as e:
                print(f"⚠️ 워커 렌더링 실패 (인덱스 {index}): {e}")
                continue
        return results
    
    def _render_single_isolated(self, part_path, part_id, output_dir, index, force_color_id):
        """독립적인 렌더링 프로세스 (워커용)"""
        # 이 메서드는 각 워커 프로세스에서 독립적으로 실행됨
        # Blender 인스턴스가 새로 시작되므로 기본 설정부터 다시 해야 함
        
        # 적응형 샘플 수 결정
        adaptive_samples = self._get_adaptive_samples(part_id, part_path, force_color_id)
        
        # 기본 렌더링 설정 (적응형 샘플 수 적용)
        self.setup_render_settings(adaptive_samples)
        self.setup_background()
        self.setup_camera()
        self.setup_lighting()
        
        # 부품 로드
        part_object = self.load_ldraw_part(part_path)
        if not part_object:
            return None
        
        # 변환 적용
        transform_data = self.apply_random_transform(part_object)
        
        # 재질 적용
        material_data = self.apply_random_material(part_object, force_color_id=force_color_id)
        
        # 카메라 위치 조정
        self.position_camera_to_object(part_object)
        
        # 바운딩 박스 계산
        bbox_data = self.calculate_bounding_box(part_object)
        
        # 렌더링 실행
        image_path = os.path.join(output_dir, f"{part_id}_{index:03d}.png")
        annotation_path = os.path.join(output_dir, f"{part_id}_{index:03d}.txt")
        
        # 렌더링
        bpy.context.scene.render.filepath = image_path
        bpy.ops.render.render(write_still=True)
        
        # Noise Map 기반 샘플 수 보정
        if self.noise_correction:
            noise_correction = self._analyze_noise_map(image_path)
            if noise_correction > 0:
                print(f"🔧 노이즈 감지: +{noise_correction} 샘플 보정")
                # 보정된 샘플 수로 재렌더링
                bpy.context.scene.cycles.samples = adaptive_samples + noise_correction
                bpy.ops.render.render(write_still=True)
                print(f"✅ 보정 완료: {adaptive_samples} → {adaptive_samples + noise_correction} 샘플")
        
        # 어노테이션 생성
        annotation_data = self.create_yolo_annotation(bbox_data, part_id)
        with open(annotation_path, 'w') as f:
            f.write(annotation_data)
        
        # 메타데이터 생성
        metadata = {
            'part_id': part_id,
            'index': index,
            'transform': transform_data,
            'material': material_data,
            'bbox': bbox_data,
            'image_path': image_path,
            'annotation_path': annotation_path
        }
        
        return metadata
    
    def apply_cached_material(self, part_object, cached_material):
        """캐시된 재질을 부품에 적용"""
        try:
            # 기존 재질 제거
            if part_object.data.materials:
                part_object.data.materials.clear()
            
            # 캐시된 재질 복사하여 적용
            new_material = cached_material.copy()
            part_object.data.materials.append(new_material)
            
            # 재질 데이터 반환
            return {
                'material': new_material,
                'color_hex': cached_material.get('color_hex', 'unknown'),
                'cached': True
            }
        except Exception as e:
            print(f"⚠️ 캐시된 재질 적용 실패: {e}")
            return None
    
    def clear_all_caches(self):
        """모든 캐시 정리"""
        try:
            # 메모리 캐시 정리
            self.scene_cache.clear()
            self.material_cache.clear()
            
            # 디스크 캐시 정리
            if os.path.exists(self.cache_dir):
                import shutil
                shutil.rmtree(self.cache_dir)
                os.makedirs(self.cache_dir, exist_ok=True)
            
            print("🗑️ 모든 캐시 정리 완료")
        except Exception as e:
            print(f"⚠️ 캐시 정리 실패: {e}")
    
    def get_cache_stats(self):
        """캐시 통계 반환"""
        scene_count = len(self.scene_cache)
        material_count = len(self.material_cache)
        
        # 디스크 캐시 크기 계산
        cache_size = 0
        if os.path.exists(self.cache_dir):
            for root, dirs, files in os.walk(self.cache_dir):
                for file in files:
                    cache_size += os.path.getsize(os.path.join(root, file))
        
        return {
            'scene_cache_count': scene_count,
            'material_cache_count': material_count,
            'cache_size_mb': round(cache_size / 1024 / 1024, 2),
            'cache_dir': self.cache_dir
        }
    
    def setup_background(self):
        """배경 설정 - 흰색/회색/자동 보정 지원"""
        world = bpy.context.scene.world
        world.use_nodes = True
        
        # 기존 노드 모두 삭제
        world.node_tree.nodes.clear()
        
        # 배경 노드 추가
        bg_node = world.node_tree.nodes.new('ShaderNodeBackground')
        output_node = world.node_tree.nodes.new('ShaderNodeOutputWorld')
        
        # 배경 색상 설정
        bg_mode = str(self.background).lower()
        if bg_mode == 'gray':
            v = 0.5
            try:
                v = float(getattr(self, 'background_gray_value', 0.5))
            except Exception:
                v = 0.5
            v = max(0.0, min(v, 1.0))
            bg_node.inputs['Color'].default_value = (v, v, v, 1.0)
        elif bg_mode == 'white':
            bg_node.inputs['Color'].default_value = (1.0, 1.0, 1.0, 1.0)
        elif bg_mode == 'auto':
            # 기본은 흰색, 실제 자동 보정은 render 단계 전에 재호출로 반영
            bg_node.inputs['Color'].default_value = (1.0, 1.0, 1.0, 1.0)
        else:
            bg_node.inputs['Color'].default_value = (1.0, 1.0, 1.0, 1.0)
        bg_node.inputs['Strength'].default_value = 1.0
        
        # 노드 연결
        world.node_tree.links.new(bg_node.outputs['Background'], output_node.inputs['Surface'])
        
        # 월드 색상도 흰색으로 설정
        world.color = (1.0, 1.0, 1.0)
        
        # 월드 설정 강제 적용
        world.use_nodes = True
        
        if bg_mode == 'gray':
            try:
                print(f"🎨 배경 설정: gray (v={getattr(self, 'background_gray_value', 0.5)}) (강도: 1.0)")
            except Exception:
                print(f"🎨 배경 설정: gray (강도: 1.0)")
        else:
            print(f"🎨 배경 설정: {self.background} (강도: 1.0)")
    
    def clear_scene(self):
        """씬 초기화"""
        # 모든 객체 삭제
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
    
    def setup_camera(self):
        """카메라 설정"""
        # 기존 카메라가 있으면 삭제
        if bpy.context.scene.camera:
            bpy.data.objects.remove(bpy.context.scene.camera, do_unlink=True)
        
        # 카메라 생성
        bpy.ops.object.camera_add(location=(0, -2, 1))
        camera = bpy.context.object
        camera.name = "SyntheticCamera"
        
        # 카메라를 원점을 향하도록 설정
        camera.rotation_euler = (math.radians(60), 0, 0)
        
        # 렌더 카메라로 설정
        bpy.context.scene.camera = camera
        
        # 카메라 설정
        camera.data.lens = 50  # 적당한 시야각
        camera.data.sensor_width = 32
        
        print(f"📸 카메라 생성 완료: {camera.name}")
        print(f"📸 씬 카메라: {bpy.context.scene.camera}")
    
    def setup_lighting(self):
        """조명 설정"""
        # 키 라이트 (주 조명)
        bpy.ops.object.light_add(type='SUN', location=(2, -2, 5))
        key_light = bpy.context.object
        key_light.name = "KeyLight"
        key_light.data.energy = 2.0
        key_light.data.color = (1.0, 0.95, 0.8)
        
        # 필 라이트 (보조 조명)
        bpy.ops.object.light_add(type='AREA', location=(-2, -1, 3))
        fill_light = bpy.context.object
        fill_light.name = "FillLight"
        fill_light.data.energy = 0.8
        fill_light.data.color = (0.8, 0.9, 1.0)
        fill_light.data.size = 2.0

        # 탑 라이트(부드러운 확산광)
        try:
            bpy.ops.object.light_add(type='AREA', location=(0, 0, 3))
            top_light = bpy.context.object
            top_light.name = "TopLight"
            top_light.data.energy = 1.0
            top_light.data.size = 3.0
        except Exception:
            pass
    
    def position_camera_to_object(self, part_object):
        """카메라가 부품을 화면에 크게 보이도록 위치 조정 - 완전히 새로운 로직"""
        scene = bpy.context.scene
        camera = scene.camera
        if camera is None or part_object is None:
            print("⚠️ 카메라 또는 부품 객체가 없습니다")
            print(f"   카메라: {camera}")
            print(f"   부품: {part_object}")
            return
        
        print(f"📸 카메라 위치 조정 시작: {camera.name}")

        # 뷰 레이어 업데이트(바운딩 박스/행렬 최신화)
        try:
            bpy.context.view_layer.update()
        except Exception:
            pass

        # 부품의 바운딩 박스 월드 좌표 계산
        bbox_world = [part_object.matrix_world @ mathutils.Vector(corner) for corner in part_object.bound_box]
        min_x = min(v.x for v in bbox_world)
        max_x = max(v.x for v in bbox_world)
        min_y = min(v.y for v in bbox_world)
        max_y = max(v.y for v in bbox_world)
        min_z = min(v.z for v in bbox_world)
        max_z = max(v.z for v in bbox_world)

        center = mathutils.Vector(((min_x + max_x) / 2.0, (min_y + max_y) / 2.0, (min_z + max_z) / 2.0))
        size_x = max_x - min_x
        size_y = max_y - min_y
        size_z = max_z - min_z
        max_dim = max(size_x, size_y, size_z)

        # 카메라 설정
        render = scene.render
        aspect = render.resolution_x / render.resolution_y
        sensor_width = camera.data.sensor_width
        sensor_height = sensor_width / aspect
        lens = camera.data.lens
        
        # FOV 계산 (올바른 공식)
        h_fov = 2.0 * math.atan((sensor_width * 0.5) / lens)
        v_fov = 2.0 * math.atan((sensor_height * 0.5) / lens)
        
        # 부품이 화면의 90%를 채우도록 필요한 거리 계산 (약간 여유)
        # 화면 점유율 = 객체크기 / (2 * 거리 * tan(FOV/2))
        # 거리 = 객체크기 / (2 * 화면점유율 * tan(FOV/2))
        target_fill = float(getattr(self, 'target_fill', 0.85))
        distance_h = (max_dim * 0.5) / (target_fill * math.tan(h_fov * 0.5))
        distance_v = (max_dim * 0.5) / (target_fill * math.tan(v_fov * 0.5))
        needed_distance = max(distance_h, distance_v) * 1.3  # 더 넉넉한 여유(여백 강화)

        # 카메라 위치 설정 (부품 앞쪽, 약간 위)
        camera.location = mathutils.Vector((
            center.x, 
            center.y - needed_distance, 
            center.z + max_dim * 0.1  # 약간 위에서 내려다보기
        ))

        # Track To 제약으로 부품을 바라보도록 설정 (더 안정적)
        # 기존 제약 제거
        for c in list(camera.constraints):
            if c.type == 'TRACK_TO':
                camera.constraints.remove(c)
        
        # 새로운 Track To 제약 추가
        track = camera.constraints.new(type='TRACK_TO')
        track.target = part_object
        track.track_axis = 'TRACK_NEGATIVE_Z'
        track.up_axis = 'UP_Y'

        # 클리핑 범위 설정
        camera.data.clip_start = 0.01
        camera.data.clip_end = max(100.0, needed_distance * 5.0)

        print(f"📸 카메라 위치: {camera.location}")
        print(f"📸 부품 중심: {center}")
        print(f"📸 부품 크기: {max_dim}")
        print(f"📸 카메라 거리: {needed_distance}")
        print(f"📸 목표 화면 점유율: {target_fill * 100}%")

        # 프레임 적합성 검증 루프: 가장자리 클리핑 시 카메라 후퇴
        try:
            for _ in range(4):  # 최대 4회 보정
                bpy.context.view_layer.update()
                # 화면 UV에서 bbox 계산
                bbox_world = [part_object.matrix_world @ mathutils.Vector(corner) for corner in part_object.bound_box]
                uv = [world_to_camera_view(scene, camera, p) for p in bbox_world]
                u_min = min(u.x for u in uv)
                v_min = min(u.y for u in uv)
                u_max = max(u.x for u in uv)
                v_max = max(u.y for u in uv)
                # 마진 3% 확보
                margin = 0.03
                if u_min >= margin and v_min >= margin and u_max <= (1.0 - margin) and v_max <= (1.0 - margin):
                    break  # 충분히 안쪽이면 종료
                # 가장자리를 넘으면 10%씩 후퇴
                camera.location.y -= (needed_distance * 0.1)
        except Exception:
            pass
    
    def load_ldraw_part(self, part_path):
        """LDraw 부품 로드"""
        try:
            print(f"🎯 LDraw 부품 로드 시작: {part_path}")
            
            # 카메라 보호를 위해 카메라만 선택 해제
            if bpy.context.scene.camera:
                bpy.context.scene.camera.select_set(False)
            
            # 기존 객체 삭제 (카메라 제외)
            bpy.ops.object.select_all(action='SELECT')
            bpy.ops.object.delete(use_global=False)
            
            # LDraw 애드온 활성화
            try:
                import addon_utils
                addon_utils.enable("ImportLDraw-master", default_set=True, persistent=True)
                print("✅ LDraw Importer Add-on 활성화")
            except Exception as e:
                print(f"⚠️ LDraw Add-on 활성화 실패: {e}")
            
            # LDraw 파일 임포트
            print("📥 LDraw 파일 임포트 중...")
            bpy.ops.import_scene.importldraw(filepath=part_path)
            print("✅ LDraw 파일 임포트 완료")
            
            # 임포터가 추가한 그라운드 플레인 제거(완전한 흰 배경 유지)
            try:
                for obj in list(bpy.data.objects):
                    if obj and obj.name and ('LegoGroundPlane' in obj.name or 'GroundPlane' in obj.name):
                        bpy.data.objects.remove(obj, do_unlink=True)
                        print("🧹 GroundPlane 제거")
            except Exception:
                pass

            # 카메라가 삭제되었는지 확인하고 복구
            if bpy.context.scene.camera is None:
                print("⚠️ 카메라가 삭제됨, 재생성 중...")
                bpy.ops.object.camera_add(location=(0, -2, 1))
                camera = bpy.context.object
                camera.name = "SyntheticCamera"
                camera.rotation_euler = (math.radians(60), 0, 0)
                bpy.context.scene.camera = camera
                camera.data.lens = 50
                camera.data.sensor_width = 32
                print(f"✅ 카메라 재생성 완료: {camera.name}")
            
            # 씬 상태 디버깅
            all_objects = list(bpy.data.objects)
            mesh_objects = [obj for obj in all_objects if obj.type == 'MESH']
            
            print(f"📊 씬 상태:")
            print(f"  - 전체 객체 수: {len(all_objects)}")
            print(f"  - 메시 객체 수: {len(mesh_objects)}")
            
            # 메시 객체 찾기 (LDraw로 임포트된 객체만)
            imported_objects = []
            for obj in mesh_objects:
                # LDraw로 임포트된 객체만 선택 (카메라, 라이트 제외)
                if (obj.type == 'MESH' and 
                    'GroundPlane' not in obj.name and 
                    'Plane' not in obj.name and
                    'Camera' not in obj.name and
                    'Light' not in obj.name and
                    hasattr(obj.data, 'vertices')):
                        imported_objects.append(obj)
            
            if not imported_objects:
                print("❌ 메시 객체를 찾을 수 없습니다")
                return None
            
            print(f"✅ 메시 객체 발견: {[obj.name for obj in imported_objects]}")
            
            # 메시 결합 (필요한 경우)
            if len(imported_objects) > 1:
                print(f"🔗 {len(imported_objects)}개 메시를 하나로 결합 중...")
                bpy.ops.object.select_all(action='DESELECT')
                bpy.context.view_layer.objects.active = imported_objects[0]
                for obj in imported_objects:
                    obj.select_set(True)
                bpy.ops.object.join()
                print("✅ 메시 결합 완료")
            
            # 최종 객체 선택 (활성 객체 또는 첫 번째 메시 객체)
            part_object = bpy.context.active_object
            if not part_object or part_object.type != 'MESH':
                # 활성 객체가 없거나 메시가 아닌 경우, 첫 번째 메시 객체 사용
                part_object = imported_objects[0]
                bpy.context.view_layer.objects.active = part_object
                print(f"🔄 활성 객체를 {part_object.name}로 설정")

            if part_object and part_object.type == 'MESH':
                part_object.name = "LEGOPart"
                print(f"✅ 최종 부품 객체: {part_object.name}")
                
                # 객체 정보 안전하게 출력
                try:
                    if hasattr(part_object.data, 'vertices') and part_object.data.vertices:
                        print(f"📊 객체 정보: 버텍스 {len(part_object.data.vertices)}개, 면 {len(part_object.data.polygons)}개")
                    else:
                        print("📊 객체 정보: 메시 데이터 없음")
                except Exception as e:
                    print(f"📊 객체 정보: {e}")
                
                return part_object
            else:
                print("❌ 활성 객체를 찾을 수 없거나 메시가 아닙니다")
                return None
            
        except Exception as e:
            print(f"❌ LDraw 로드 실패: {e}")
            return None
    
    def apply_random_transform(self, part_object):
        """랜덤 변환 적용 (회전, 위치, 크기)"""
        # 랜덤 회전 (0-360도)
        rotation_x = random.uniform(0, 2 * math.pi)
        rotation_y = random.uniform(0, 2 * math.pi)
        rotation_z = random.uniform(0, 2 * math.pi)
        
        part_object.rotation_euler = (rotation_x, rotation_y, rotation_z)
        
        # 부품을 카메라 앞의 근처에 위치(프레이밍 실패 방지)
        part_object.location = (
            random.uniform(-0.05, 0.05),  # X축 좁게
            random.uniform(-0.05, 0.05),  # Y축 좁게
            random.uniform(0.0, 0.05)     # Z축 살짝 위
        )
        
        # 적절한 크기로 조정
        scale = random.uniform(0.9, 1.1)
        part_object.scale = (scale, scale, scale)
        
        print(f"🔧 부품 위치: {part_object.location}")
        print(f"🔧 부품 회전: {part_object.rotation_euler}")
        print(f"🔧 부품 크기: {part_object.scale}")
        
        return {
            'rotation': (rotation_x, rotation_y, rotation_z),
            'location': part_object.location,
            'scale': scale
        }
    
    def apply_random_material(self, part_object, force_color_id=None, force_color_hex=None):
        """랜덤 재질 적용 (force_color_id가 주어지면 해당 색상 강제)
        - Rebrickable/LDRAW 주요 컬러 ID 매핑 포함
        - 매핑 불가 시 무작위가 아닌 중립 회색으로 폴백
        - 객체의 모든 재질 슬롯을 일관되게 교체
        """
        # 새 재질 생성
        material = bpy.data.materials.new(name="LEGOMaterial")
        material.use_nodes = True
        
        # 노드 설정
        nodes = material.node_tree.nodes
        nodes.clear()
        
        # Principled BSDF 노드 추가
        bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
        output = nodes.new(type='ShaderNodeOutputMaterial')
        
        # 노드 연결
        material.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
        
        # 색상 선택
        color_name = None
        color_rgba = None
        is_transparent = False
        is_white = False
        
        # 투명 색상 ID 감지
        if force_color_id in [47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60]:
            is_transparent = True
        
        # color_hex 우선 적용 (정확도 최우선)
        if force_color_hex and isinstance(force_color_hex, str):
            hexstr = force_color_hex.strip()
            if hexstr.startswith('#'):
                hexstr = hexstr[1:]
            if len(hexstr) == 6:
                try:
                    r = int(hexstr[0:2], 16) / 255.0
                    g = int(hexstr[2:4], 16) / 255.0
                    b = int(hexstr[4:6], 16) / 255.0
                    
                    # 흰색 감지 (RGB 모두 임계값 이상)
                    if r >= self.WHITE_THRESHOLD and g >= self.WHITE_THRESHOLD and b >= self.WHITE_THRESHOLD:
                        is_white = True
                    
                    # sRGB → Linear 변환 (Blender는 기본적으로 선형 워크플로우)
                    def srgb_to_linear(c):
                        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
                    lr = srgb_to_linear(r)
                    lg = srgb_to_linear(g)
                    lb = srgb_to_linear(b)
                    
                    # Alpha 값 동적 설정
                    alpha_value = 0.6 if is_transparent else 1.0
                    color_rgba = (lr, lg, lb, alpha_value)
                    color_name = f"hex_{force_color_hex.upper()}"
                except Exception:
                    pass
        # Rebrickable/LDRAW 주요 컬러 매핑 (대표값 근사)
        id_to_rgba = {
            0:   (0.95, 0.95, 0.95, 1.0),  # White
            1:   (0.10, 0.10, 0.10, 1.0),  # Black
            2:   (0.10, 0.30, 0.80, 1.0),  # Blue
            3:   (0.10, 0.70, 0.20, 1.0),  # Green
            4:   (0.80, 0.10, 0.10, 1.0),  # Red
            5:   (0.90, 0.80, 0.10, 1.0),  # Yellow
            6:   (0.90, 0.40, 0.10, 1.0),  # Orange
            7:   (0.50, 0.10, 0.70, 1.0),  # Purple
            8:   (0.40, 0.20, 0.10, 1.0),  # Brown
            9:   (0.50, 0.50, 0.50, 1.0),  # Gray (generic)
            71:  (0.64, 0.64, 0.66, 1.0),  # Light Bluish Gray (approx #A3A2A4)
            72:  (0.43, 0.43, 0.45, 1.0),  # Dark Bluish Gray (approx #6D6E6F)
            194: (0.86, 0.86, 0.86, 1.0),  # Light Stone Gray (for safety)
            199: (0.36, 0.36, 0.36, 1.0),  # Dark Stone Gray (for safety)
        }

        if color_rgba is None and force_color_id is not None:
            if force_color_id in id_to_rgba:
                base_rgba = id_to_rgba[force_color_id]
                # 흰색 감지 (ID 0)
                if force_color_id == 0:
                    is_white = True
                # 투명도 적용
                alpha_value = 0.6 if is_transparent else 1.0
                color_rgba = (base_rgba[0], base_rgba[1], base_rgba[2], alpha_value)
                color_name = f"color_{force_color_id}"
            else:
                # 강제 색상이지만 매핑이 없으면 중립 회색으로 고정 (무작위 금지)
                base_rgba = id_to_rgba.get(9)
                alpha_value = 0.6 if is_transparent else 1.0
                color_rgba = (base_rgba[0], base_rgba[1], base_rgba[2], alpha_value)
                color_name = f"color_{force_color_id}_fallback_gray"
        elif color_rgba is None:
            # 무작위 컬러 (강제 색상이 없을 때만)
            color_name = random.choice(list(self.lego_colors.keys()))
            base_rgba = self.lego_colors[color_name]
            alpha_value = 0.6 if is_transparent else 1.0
            color_rgba = (base_rgba[0], base_rgba[1], base_rgba[2], alpha_value)
        
        # 플라스틱 재질 파라미터
        bsdf.inputs['Base Color'].default_value = color_rgba
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.35
        
        # 투명도 설정
        if is_transparent:
            bsdf.inputs['Alpha'].default_value = color_rgba[3]  # Alpha 값 사용
            if 'Transmission' in bsdf.inputs:
                bsdf.inputs['Transmission'].default_value = 0.8  # 투명도 강화
            material.blend_method = 'BLEND'  # 블렌딩 모드
            # Blender 4.5에서는 use_transparency 대신 blend_method 사용
        else:
            bsdf.inputs['Alpha'].default_value = 1.0
            if 'Transmission' in bsdf.inputs:
                bsdf.inputs['Transmission'].default_value = 0.0
            material.blend_method = 'OPAQUE'
        
        # 밝은 부품 가시성 개선 (Adaptive Bright-Part Rendering)
        if is_white or (color_rgba[0] > self.WHITE_THRESHOLD and color_rgba[1] > self.WHITE_THRESHOLD and color_rgba[2] > self.WHITE_THRESHOLD):
            # 조건부 병합 방식: 밝은 부품 처리
            adjusted_color = (
                color_rgba[0] * self.BRIGHT_PART_DARKENING,  # 설정 가능한 비율만큼 어둡게
                color_rgba[1] * self.BRIGHT_PART_DARKENING,
                color_rgba[2] * self.BRIGHT_PART_DARKENING,
                color_rgba[3]
            )
            bsdf.inputs['Base Color'].default_value = adjusted_color
            bsdf.inputs['Roughness'].default_value = 0.5  # 경계선 강화
            print(f"🔧 밝은 부품 보정: RGB 값을 {self.BRIGHT_PART_DARKENING * 100}%로 조정")
            
            # 배경 밝기 조정을 위한 메타데이터 저장
            self.bright_part_rendering = True
            self.world_bg_strength = 0.85  # 배경을 밝은 회색으로
        else:
            # 일반 부품
            bsdf.inputs['Roughness'].default_value = 0.35
            self.bright_part_rendering = False
            self.world_bg_strength = 1.0

        # 재질을 객체에 적용 (모든 슬롯 일관 교체)
        try:
            mats = part_object.data.materials
            if mats and len(mats) > 0:
                for i in range(len(mats)):
                    mats[i] = material
            else:
                mats.append(material)
        except Exception:
            # 예외 시 최소 1개 슬롯에라도 적용
            if part_object.data.materials:
                part_object.data.materials[0] = material
            else:
                part_object.data.materials.append(material)
        
        print(f"🎨 재질 적용: {color_name} {color_rgba} (force_color_id={force_color_id}, force_color_hex={force_color_hex})")
        
        return {
            'color_name': color_name,
            'color_rgba': color_rgba,
            'is_bright_part': is_white or (color_rgba[0] > self.WHITE_THRESHOLD and color_rgba[1] > self.WHITE_THRESHOLD and color_rgba[2] > self.WHITE_THRESHOLD),
            'is_transparent': is_transparent,
            'visibility_boost': is_white or (color_rgba[0] > self.WHITE_THRESHOLD and color_rgba[1] > self.WHITE_THRESHOLD and color_rgba[2] > self.WHITE_THRESHOLD)
        }
    
    def calculate_bounding_box(self, part_object):
        """3D 객체의 2D 바운딩 박스 계산 - world_to_camera_view 기반(안정)"""
        scene = bpy.context.scene
        camera = scene.camera
        if not camera or not part_object:
            return None

        # 최신 상태 반영
        try:
            bpy.context.view_layer.update()
        except Exception:
            pass

        render_width = scene.render.resolution_x
        render_height = scene.render.resolution_y

        # 객체 바운딩 박스 코너(월드)
        corners_world = [part_object.matrix_world @ Vector(corner) for corner in part_object.bound_box]

        # 카메라 뷰로 정규화 좌표(u,v,0..1). z<0(카메라 뒤) 코너는 제외
        uv_points = []
        for cw in corners_world:
            co_ndc = world_to_camera_view(scene, camera, cw)
            if co_ndc.z >= 0.0:  # 카메라 앞만 사용
                uv_points.append((co_ndc.x, co_ndc.y))

        # 모든 코너가 뒤에 있으면 폴백: 객체 원점 투영
        if not uv_points:
            origin = part_object.matrix_world.translation
            co_ndc = world_to_camera_view(scene, camera, origin)
            uv_points.append((co_ndc.x, co_ndc.y))

        # UV 범위를 기반으로 bbox 산출
        xs = [p[0] for p in uv_points]
        ys = [p[1] for p in uv_points]
        u_min = max(0.0, min(min(xs), 1.0))
        v_min = max(0.0, min(min(ys), 1.0))
        u_max = max(0.0, min(max(xs), 1.0))
        v_max = max(0.0, min(max(ys), 1.0))

        # 최소 크기 보장(너무 작으면 학습에 불리)
        eps = 1e-4
        if (u_max - u_min) < eps or (v_max - v_min) < eps:
            # 안전 폴백: 중심 기준 소형 박스
            cx = max(0.0, min(uv_points[0][0], 1.0))
            cy = max(0.0, min(uv_points[0][1], 1.0))
            w = h = 0.1
            u_min = max(0.0, min(cx - w / 2, 1.0))
            u_max = max(0.0, min(cx + w / 2, 1.0))
            v_min = max(0.0, min(cy - h / 2, 1.0))
            v_max = max(0.0, min(cy + h / 2, 1.0))

        # YOLO 정규화(cx, cy, w, h)
        center_x = (u_min + u_max) / 2.0
        center_y = (v_min + v_max) / 2.0
        width = max(eps, (u_max - u_min))
        height = max(eps, (v_max - v_min))

        # 픽셀 좌표도 제공(디버깅/메타용)
        pixel_x_min = int(u_min * render_width)
        pixel_x_max = int(u_max * render_width)
        pixel_y_min = int(v_min * render_height)
        pixel_y_max = int(v_max * render_height)

        return {
            'center_x': center_x,
            'center_y': center_y,
            'width': width,
            'height': height,
            'pixel_coords': {
                'x_min': pixel_x_min,
                'x_max': pixel_x_max,
                'y_min': pixel_y_min,
                'y_max': pixel_y_max
            }
        }

    def project_vertices_uv(self, part_object):
        """객체의 모든 버텍스를 카메라 뷰로 투영해 UV(0..1) 좌표 목록 반환"""
        scene = bpy.context.scene
        camera = scene.camera
        if not camera or not part_object or not hasattr(part_object.data, 'vertices'):
            return []
        try:
            try:
                bpy.context.view_layer.update()
            except Exception:
                pass
            uvs = []
            for v in part_object.data.vertices:
                world_co = part_object.matrix_world @ v.co
                co_ndc = world_to_camera_view(scene, camera, world_co)
                if co_ndc.z >= 0.0:
                    u = float(max(0.0, min(co_ndc.x, 1.0)))
                    v = float(max(0.0, min(co_ndc.y, 1.0)))
                    uvs.append((u, v))
            return uvs
        except Exception:
            return []

    def _cross(self, o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    def convex_hull_uv(self, points):
        """모노톤 체인으로 UV convex hull 계산. 입력/출력은 0..1 UV 좌표."""
        if not points:
            return []
        pts = sorted(points)
        lower = []
        for p in pts:
            while len(lower) >= 2 and self._cross(lower[-2], lower[-1], p) <= 0:
                lower.pop()
            lower.append(p)
        upper = []
        for p in reversed(pts):
            while len(upper) >= 2 and self._cross(upper[-2], upper[-1], p) <= 0:
                upper.pop()
            upper.append(p)
        hull = lower[:-1] + upper[:-1]
        # 과도한 점수는 샘플링(최대 200점)
        if len(hull) > 200:
            step = max(1, len(hull) // 200)
            hull = hull[::step]
        return hull
    
    def setup_adaptive_lighting(self, is_bright_part=False):
        """밝은 부품을 위한 적응형 조명 설정"""
        scene = bpy.context.scene
        
        # 월드 노드 설정
        world = bpy.context.scene.world
        if world and world.use_nodes:
            world_nodes = world.node_tree.nodes
            world_output = world_nodes.get('World Output')
            
            if world_output and hasattr(self, 'world_bg_strength'):
                # 배경 강도 조정
                if hasattr(world_output.inputs, 'Surface'):
                    bg_node = world_nodes.get('Background')
                    if bg_node:
                        # 밝은 부품일 때 배경을 밝은 회색으로 조정
                        if is_bright_part:
                            bg_node.inputs['Color'].default_value = (0.85, 0.85, 0.85, 1.0)  # #D9D9D9
                            bg_node.inputs['Strength'].default_value = self.world_bg_strength
                        else:
                            bg_node.inputs['Color'].default_value = (1.0, 1.0, 1.0, 1.0)  # 순백색
                            bg_node.inputs['Strength'].default_value = 1.0
        
        # 조명 강화 (밝은 부품용)
        if is_bright_part:
            for obj in bpy.context.scene.objects:
                if obj.type == 'LIGHT':
                    # 키 라이트 강도 증가
                    if obj.data.type == 'SUN':
                        obj.data.energy *= 1.2
                    elif obj.data.type == 'AREA':
                        obj.data.energy *= 1.1

    def render_image(self, output_path):
        """이미지 렌더링"""
        # 출력 경로 설정
        bpy.context.scene.render.filepath = output_path
        
        # 렌더링 실행
        bpy.ops.render.render(write_still=True)
        
        return output_path
    
    def save_yolo_annotation(self, bbox_data, output_path, class_id=0, polygon_uv=None):
        """YOLO 포맷 어노테이션 저장 - 세그멘테이션 폴리곤(uv) 포함 지원, 실패 시 안전 폴백 박스 기록"""
        if bbox_data is None:
            bbox_data = { 'center_x': 0.5, 'center_y': 0.5, 'width': 0.1, 'height': 0.1 }
        
        # YOLO 포맷: class_id center_x center_y width height
        yolo_line = f"{class_id} {bbox_data['center_x']:.6f} {bbox_data['center_y']:.6f} {bbox_data['width']:.6f} {bbox_data['height']:.6f}"
        # YOLO-seg: 이어서 x1 y1 x2 y2 ... (정규화 uv)
        if polygon_uv and isinstance(polygon_uv, list) and len(polygon_uv) >= 3:
            coords = []
            for (u, v) in polygon_uv:
                coords.append(f"{u:.6f} {v:.6f}")
            yolo_line += " " + " ".join(coords)
        
        with open(output_path, 'w') as f:
            f.write(yolo_line)
        
        return output_path
    
    def upload_to_supabase(self, image_path, annotation_path, part_id, metadata):
        """Supabase Storage에 업로드 (로컬 파일명/폴더 구조를 그대로 사용)
        - 이미지(.png), 어노테이션(.txt), 메타데이터(.json) 업로드
        - 경로 규칙: synthetic/<folder>/<filename>
          * <folder> = 로컬 출력 폴더명(보통 elementId 또는 partId)
          * <filename> = 로컬 파일명
        """
        if not self.supabase:
            # 업로드 시점 재시도 초기화(가장 신뢰되는 지점)
            try:
                url = self.supabase_url
                key = self.supabase_key
                # 인자/환경/파일 순으로 재탐색
                if not url or not key:
                    from dotenv import load_dotenv, dotenv_values
                    candidates = [
                        os.path.join(os.path.dirname(__file__), '..', '.env.blender'),
                        os.path.join(os.path.dirname(__file__), '..', 'config', 'synthetic_dataset.env'),
                        os.path.join(os.path.dirname(__file__), '..', '.env'),
                    ]
                    merged = {}
                    for p in candidates:
                        try:
                            if os.path.exists(p):
                                load_dotenv(p)
                                merged.update(dotenv_values(p) or {})
                        except Exception:
                            pass
                    url = url or os.getenv('VITE_SUPABASE_URL') or merged.get('VITE_SUPABASE_URL') or merged.get('SUPABASE_URL')
                    key = key or os.getenv('SUPABASE_SERVICE_ROLE') or merged.get('SUPABASE_SERVICE_ROLE') \
                              or os.getenv('SUPABASE_SERVICE_KEY') or merged.get('SUPABASE_SERVICE_KEY') \
                              or os.getenv('SUPABASE_SERVICE_KEY_JWT') or merged.get('SUPABASE_SERVICE_KEY_JWT') \
                              or os.getenv('VITE_SUPABASE_SERVICE_ROLE') or merged.get('VITE_SUPABASE_SERVICE_ROLE') \
                              or os.getenv('SUPABASE_KEY') or merged.get('SUPABASE_KEY') \
                              or os.getenv('VITE_SUPABASE_ANON_KEY') or merged.get('VITE_SUPABASE_ANON_KEY')
                try:
                    print(f"🔎 Supabase reinit@upload → url_present={bool(url)}, key_present={bool(key)}")
                except Exception:
                    pass
                if url and key:
                    try:
                        # 로컬 스코프에서도 안전하게 import 시도
                        from supabase import create_client as _create_client
                    except Exception as _ie:
                        print(f"❌ Supabase 모듈 임포트 실패(create_client): {_ie}")
                        return None
                    self.supabase = _create_client(url, key)
                    self.supabase_url = url
                    self.supabase_key = key
                    print("✅ Supabase 클라이언트(업로드 시점) 연결 성공")
                else:
                    print("⚠️ Supabase 클라이언트가 없습니다. 로컬에만 저장됩니다.")
                    return None
            except Exception as ie:
                print(f"❌ Supabase 업로드 전 초기화 실패: {ie}")
                return None
        
        try:
            # 로컬 경로에서 폴더/파일명 추출 (idempotent 업로드를 위해 로컬 파일명 유지)
            image_filename = os.path.basename(image_path)
            annotation_filename = os.path.basename(annotation_path)
            folder_name = os.path.basename(os.path.dirname(image_path)) or str(part_id)
            
            # 이미지 업로드
            with open(image_path, 'rb') as f:
                image_data = f.read()
            
            image_path_supabase = f"synthetic/{folder_name}/{image_filename}"
            result = self.supabase.storage.from_('lego-synthetic').upload(
                image_path_supabase, 
                image_data,
                file_options={"content-type": "image/png"}
            )
            
            # Supabase 응답 객체 처리 (새로운 구조)
            if hasattr(result, 'error') and result.error:
                raise Exception(f"이미지 업로드 실패: {result.error}")
            
            # 어노테이션 업로드
            with open(annotation_path, 'rb') as f:
                annotation_data = f.read()
            
            annotation_path_supabase = f"synthetic/{folder_name}/{annotation_filename}"
            result = self.supabase.storage.from_('lego-synthetic').upload(
                annotation_path_supabase,
                annotation_data,
                file_options={"content-type": "text/plain"}
            )
            
            # Supabase 응답 객체 처리 (새로운 구조)
            if hasattr(result, 'error') and result.error:
                raise Exception(f"어노테이션 업로드 실패: {result.error}")
            
            # 메타데이터 JSON 업로드 (사이드카)
            try:
                json_filename = image_filename.replace('.png', '.json')
                json_bytes = json.dumps(metadata, ensure_ascii=False, indent=2).encode('utf-8')
                json_path_supabase = f"synthetic/{folder_name}/{json_filename}"
                result = self.supabase.storage.from_('lego-synthetic').upload(
                    json_path_supabase,
                    json_bytes,
                    file_options={"content-type": "application/json"}
                )
                # Supabase 응답 객체 처리 (새로운 구조)
                if hasattr(result, 'error') and result.error:
                    print(f"⚠️ 메타데이터 JSON 업로드 실패: {result.error}")
            except Exception as je:
                print(f"⚠️ 메타데이터 JSON 업로드 예외: {je}")
            
            # 공개 URL 생성
            image_url = self.supabase.storage.from_('lego-synthetic').get_public_url(image_path_supabase)
            annotation_url = self.supabase.storage.from_('lego-synthetic').get_public_url(annotation_path_supabase)
            
            return {
                'image_url': image_url,
                'annotation_url': annotation_url,
                'image_path': image_path_supabase,
                'annotation_path': annotation_path_supabase
            }
            
        except Exception as e:
            print(f"❌ Supabase 업로드 실패: {e}")
            return None
    
    def save_metadata(self, part_id, metadata, urls):
        """메타데이터를 Supabase 테이블에 저장"""
        if not self.supabase:
            return None
        
        try:
            # 메타데이터 테이블에 저장
            metadata_record = {
                'part_id': part_id,
                'image_url': urls['image_url'] if urls else None,
                'annotation_url': urls['annotation_url'] if urls else None,
                'metadata': json.dumps(metadata),
                'created_at': datetime.now().isoformat()
            }
            
            result = self.supabase.table('synthetic_dataset').insert(metadata_record).execute()
            
            # Supabase 응답 객체 처리 (새로운 구조)
            if hasattr(result, 'error') and result.error:
                print(f"⚠️ 메타데이터 저장 실패: {result.error}")
            else:
                print("✅ 메타데이터 저장 완료")
                
        except Exception as e:
            print(f"⚠️ 메타데이터 저장 실패: {e}")

    def list_existing_in_bucket(self, folder_name):
        """해당 폴더 내 기존 파일 목록을 조회하여 파일명 집합 반환"""
        if not self.supabase:
            return set()
        try:
            # Supabase Python 클라이언트의 list는 prefix 경로 하위 파일을 반환
            resp = self.supabase.storage.from_('lego-synthetic').list(f"synthetic/{folder_name}")
            files = resp or []
            names = set()
            for f in files:
                try:
                    name = f.get('name') if isinstance(f, dict) else getattr(f, 'name', None)
                    if name:
                        names.add(str(name))
                except Exception:
                    continue
            return names
        except Exception as e:
            print(f"⚠️ Supabase 파일 목록 조회 실패: {e}")
            return set()
    
    def render_single_part(self, part_path, part_id, output_dir, index=0, force_color_id=None):
        """단일 부품 렌더링 - 캐싱 최적화된 순서"""
        print(f"🎯 {part_id} 렌더링 시작 (인덱스: {index})")
        
        # 적응형 샘플 수 결정
        adaptive_samples = self._get_adaptive_samples(part_id, part_path, force_color_id)
        
        # 캐시 키 생성 (적응형 샘플 수 포함)
        cache_key = self._get_cache_key(part_id, force_color_id or 0, adaptive_samples)
        
        # 캐시에서 기본 씬 로드 시도
        scene_loaded = self._load_scene_cache(cache_key)
        
        if not scene_loaded:
            print(f"📦 기본 씬 생성 중... (캐시 미스)")
            # 1. 씬 초기화
            self.clear_scene()
            
            # 2. 렌더링 설정 (적응형 샘플 수 적용)
            self.setup_render_settings(adaptive_samples)
            
            # 3. 배경 설정 (가장 먼저, 다른 설정에 의해 덮어씌워지지 않도록)
            self.setup_background()
            
            # 4. 카메라 설정
            self.setup_camera()
            
            # 5. 조명 설정
            self.setup_lighting()
            
            # 6. LDraw 부품 로드
            part_object = self.load_ldraw_part(part_path)
            if not part_object:
                return None
            
            # 기본 씬 캐시 저장
            scene_data = {
                'part_id': part_id,
                'part_path': part_path,
                'samples': self.current_samples,
                'background': self.background,
                'resolution': self.resolution
            }
            self._save_scene_cache(cache_key, scene_data)
            print(f"💾 기본 씬 캐시 저장 완료")
        else:
            print(f"📂 기본 씬 캐시 로드 완료")
            # 캐시에서 로드된 씬에서 부품 객체 찾기
            part_object = None
            for obj in bpy.context.scene.objects:
                if obj.name.startswith(f"part_{part_id}"):
                    part_object = obj
                    break
            
            if not part_object:
                print(f"⚠️ 캐시에서 부품 객체를 찾을 수 없음, 새로 로드")
                part_object = self.load_ldraw_part(part_path)
                if not part_object:
                    return None
        
        # 7. 랜덤 변환 적용
        transform_data = self.apply_random_transform(part_object)
        
        # 8. 랜덤 재질 적용
        # 서버에서 전달된 color-hex/element-id를 args로 받았는지 확인
        force_color_hex = None
        element_id_value = None
        try:
            # Blender에서 실행 시, main()의 args는 지역 스코프라 여기서 접근 불가.
            # 대신 전역 argv를 직접 파싱하여 '--color-hex'를 추출한다.
            if '--' in sys.argv:
                arg_list = sys.argv[sys.argv.index('--') + 1:]
            else:
                arg_list = []
            if '--color-hex' in arg_list:
                idx = arg_list.index('--color-hex')
                if idx + 1 < len(arg_list):
                    force_color_hex = arg_list[idx + 1]
            if '--element-id' in arg_list:
                eidx = arg_list.index('--element-id')
                if eidx + 1 < len(arg_list):
                    element_id_value = arg_list[eidx + 1]
        except Exception:
            pass

        # 재질 캐싱 최적화
        if force_color_hex:
            # 캐시된 재질 확인
            cached_material = self._get_cached_material(force_color_hex)
            if cached_material:
                print(f"🎨 캐시된 재질 사용: {force_color_hex}")
                material_data = self.apply_cached_material(part_object, cached_material['material'])
            else:
                print(f"🎨 새 재질 생성: {force_color_hex}")
                material_data = self.apply_random_material(part_object, force_color_id=force_color_id, force_color_hex=force_color_hex)
                # 새로 생성된 재질 캐시에 저장
                if material_data and 'material' in material_data:
                    self._save_material_cache(force_color_hex, material_data['material'])
        else:
            material_data = self.apply_random_material(part_object, force_color_id=force_color_id, force_color_hex=force_color_hex)
        
        # 9. 카메라가 부품을 화면에 크게 보이도록 위치 조정
        self.position_camera_to_object(part_object)

        # 10. 바운딩 박스 및 폴리곤 계산
        bbox_data = self.calculate_bounding_box(part_object)
        polygon_uv = self.convex_hull_uv(self.project_vertices_uv(part_object))
        
        # 11. 밝은 부품 체크 및 적응형 배경/조명 설정
        is_bright_part = material_data and material_data.get('is_bright_part', False)
        if is_bright_part:
            print(f"🔆 밝은 부품 감지: 배경 자동 보정 ({self.background} → gray #D9D9D9)")
            self.setup_adaptive_lighting(is_bright_part=True)
        else:
            # 밝은 부품이 아닐 때만 원래 배경 유지
            self.setup_background()
        
        # 12. 출력 파일 경로 (엘리먼트 아이디가 있으면 파일명에도 반영)
        base_id_for_filename = element_id_value if element_id_value else part_id
        # 출력 폴더명이 엘리먼트 아이디(또는 사용자가 지정한 식별자)라면 그것을 우선 사용
        try:
            folder_id = os.path.basename(output_dir)
            if folder_id and folder_id != part_id:
                base_id_for_filename = folder_id
        except Exception:
            pass
        image_filename = f"{base_id_for_filename}_{index:03d}.png"
        annotation_filename = f"{base_id_for_filename}_{index:03d}.txt"
        
        image_path = os.path.join(output_dir, image_filename)
        annotation_path = os.path.join(output_dir, annotation_filename)
        
        # 13. 렌더링 전 카메라 확인
        if bpy.context.scene.camera is None:
            print("❌ 렌더링 실패: 카메라가 설정되지 않았습니다")
            return None
        
        print(f"📸 렌더링 카메라: {bpy.context.scene.camera.name}")

        # 샘플 수를 렌더 직전에 강제 적용(애드온이 변경했을 수 있음)
        try:
            bpy.context.scene.cycles.samples = self.current_samples
        except Exception:
            pass

        # 14. 렌더링
        self.render_image(image_path)
        
        # 14. YOLO 어노테이션 저장 (세그 폴리곤 포함)
        self.save_yolo_annotation(bbox_data, annotation_path, class_id=0, polygon_uv=polygon_uv)
        
        # 15. 메타데이터 생성
        # 메타데이터 구성 (JSON 직렬화 안전 변환 적용)
        metadata = {
            'part_id': part_id,
            'element_id': None,
            'transform': make_json_safe(transform_data),
            'material': make_json_safe(material_data),
            'bounding_box': make_json_safe(bbox_data),
            'polygon_uv': make_json_safe(polygon_uv),
            'render_settings': {
                'resolution': (640, 640),
                'samples': self.current_samples,
                'engine': 'cycles'
            },
            'camera': {
                'lens_mm': make_json_safe(bpy.context.scene.camera.data.lens) if bpy.context.scene.camera else None,
                'sensor_width_mm': make_json_safe(bpy.context.scene.camera.data.sensor_width) if bpy.context.scene.camera else None,
                'clip_start': make_json_safe(bpy.context.scene.camera.data.clip_start) if bpy.context.scene.camera else None,
                'clip_end': make_json_safe(bpy.context.scene.camera.data.clip_end) if bpy.context.scene.camera else None
            },
            'background': str(self.background),
            'color_management': str(self.color_management)
        }

        # element-id 전달분 반영
        try:
            if '--' in sys.argv:
                arg_list = sys.argv[sys.argv.index('--') + 1:]
            else:
                arg_list = []
            if '--element-id' in arg_list:
                idx = arg_list.index('--element-id')
                if idx + 1 < len(arg_list):
                    metadata['element_id'] = arg_list[idx + 1]
        except Exception:
            pass
        
        # 16. Supabase 업로드
        urls = self.upload_to_supabase(image_path, annotation_path, part_id, metadata)
        
        # 17. 메타데이터 저장
        self.save_metadata(part_id, metadata, urls)

        # 18. 로컬 사이드카 JSON 저장 (요청된 보강)
        try:
            meta_sidecar = image_path.replace('.png', '.json')
            with open(meta_sidecar, 'w', encoding='utf-8') as f:
                json.dump(make_json_safe(metadata), f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"⚠️ 메타데이터 사이드카 저장 실패: {e}")
        
        print(f"✅ {part_id} 렌더링 완료 → {image_filename}")
        if urls:
            print(f"🔗 Supabase URL: {urls['image_url']}")
        
        return {
            'image_path': image_path,
            'annotation_path': annotation_path,
            'metadata': metadata,
            'urls': urls
        }

def main():
    """메인 실행 함수"""
    parser = argparse.ArgumentParser(description='LDraw → Blender → Supabase 합성 데이터셋 생성')
    parser.add_argument('--part-id', required=True, help='LEGO 부품 ID (예: 3001)')
    parser.add_argument('--count', type=int, default=10, help='생성할 이미지 수')
    parser.add_argument('--quality', default='fast', choices=['fast', 'normal', 'high'], help='렌더링 품질')
    parser.add_argument('--samples', type=int, help='강제 샘플 수 (적응형 샘플링 무시)')
    parser.add_argument('--ldraw-path', default='C:/LDraw/parts/', help='LDraw 라이브러리 경로')
    parser.add_argument('--output-dir', default='./output', help='출력 디렉토리')
    parser.add_argument('--output-subdir', help='출력 하위 폴더명 (기본: part-id)')
    parser.add_argument('--supabase-url', help='Supabase URL')
    parser.add_argument('--supabase-key', help='Supabase API Key')
    parser.add_argument('--background', default='white', choices=['white','gray','auto'], help='배경색 (white|gray|auto)')
    parser.add_argument('--color-management', default='auto', choices=['auto','filmic','standard'], help='색공간 톤매핑 (auto|filmic|standard)')
    parser.add_argument('--color-id', type=int, help='강제 색상 ID (예: 4=빨강)')
    parser.add_argument('--color-hex', help='강제 색상 HEX (예: #6D6E5C)')
    parser.add_argument('--resolution', help='렌더 해상도, 예: 768x768 또는 960x960')
    parser.add_argument('--target-fill', type=float, help='화면 점유율(0~1), 예: 0.92')
    parser.add_argument('--element-id', help='원본 엘리먼트 ID (있을 경우 메타에 기록)')
    parser.add_argument('--clear-cache', action='store_true', help='모든 캐시 정리')
    parser.add_argument('--cache-stats', action='store_true', help='캐시 통계만 출력')
    parser.add_argument('--disable-parallel', action='store_true', help='병렬 렌더링 비활성화')
    parser.add_argument('--workers', type=int, help='병렬 워커 수 (기본: 자동)')
    parser.add_argument('--disable-adaptive', action='store_true', help='적응형 샘플링 비활성화')
    parser.add_argument('--complexity-stats', action='store_true', help='부품 복잡도 통계 출력')
    parser.add_argument('--disable-noise-correction', action='store_true', help='Noise Map 기반 보정 비활성화')
    parser.add_argument('--quality-threshold', type=float, default=0.95, help='SSIM 품질 임계값 (기본: 0.95)')
    parser.add_argument('--enable-ai-complexity', action='store_true', help='AI 기반 복잡도 예측 활성화')
    
    # Blender는 --python 사용 시 sys.argv에 Blender 고유 인자가 함께 포함됩니다.
    # '--' 이후의 인자만 파싱하도록 분리합니다.
    argv = sys.argv
    if '--' in argv:
        argv = argv[argv.index('--') + 1:]
    else:
        argv = []
    args = parser.parse_args(argv)
    # 디버그: 전달된 Supabase 인자 존재 여부 출력(민감정보 마스킹)
    try:
        key_preview = (args.supabase_key[:6] + '…') if getattr(args, 'supabase_key', None) else 'missing'
        print(f"🔎 Supabase args → url_present={bool(getattr(args,'supabase_url', None))}, key_present={bool(getattr(args,'supabase_key', None))}, key_preview={key_preview}")
    except Exception:
        pass
    
    # 환경 변수에서 Supabase 설정 로드
    if not args.supabase_url or not args.supabase_key:
        try:
            # 다양한 경로의 환경파일을 순서대로 시도: .env.blender → config/synthetic_dataset.env → 프로젝트 .env
            candidates = [
                os.path.join(os.path.dirname(__file__), '..', '.env.blender'),
                os.path.join(os.path.dirname(__file__), '..', 'config', 'synthetic_dataset.env'),
                os.path.join(os.path.dirname(__file__), '..', '.env'),
            ]
            for p in candidates:
                try:
                    if os.path.exists(p):
                        load_dotenv(p)
                except Exception:
                    pass
            args.supabase_url = os.getenv('VITE_SUPABASE_URL')
            # 서비스 키가 있으면 우선 사용, 없으면 anon 사용
            args.supabase_key = (
                os.getenv('SUPABASE_SERVICE_ROLE') or
                os.getenv('SUPABASE_SERVICE_KEY') or
                os.getenv('SUPABASE_SERVICE_KEY_JWT') or
                os.getenv('SUPABASE_KEY') or
                os.getenv('SUPABASE_URL') and os.getenv('SUPABASE_SERVICE_ROLE') or None or
                os.getenv('VITE_SUPABASE_SERVICE_ROLE') or
                os.getenv('VITE_SUPABASE_SERVICE_ROLE') or
                os.getenv('VITE_SUPABASE_ANON_KEY')
            )
            print(f"🔍 환경 변수 로드: URL={'설정됨' if args.supabase_url else '없음'}, KEY={'설정됨' if args.supabase_key else '없음'}")
        except Exception as e:
            print(f"⚠️ 환경 변수 로드 실패: {e}")
            pass
    
    # 출력 디렉토리 생성 (절대 경로로 변환)
    output_dir = os.path.abspath(args.output_dir)
    # 폴더명: 지정된 output-subdir 우선, 없으면 part-id 사용
    subdir_name = args.output_subdir if getattr(args, 'output_subdir', None) else args.part_id
    part_output_dir = os.path.join(output_dir, subdir_name)
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(part_output_dir, exist_ok=True)
    print(f"📁 출력 디렉토리: {part_output_dir}")
    
    # LDraw 파일 경로
    ldraw_file = os.path.join(args.ldraw_path, f"{args.part_id}.dat")
    
    if not os.path.exists(ldraw_file):
        print(f"❌ LDraw 파일을 찾을 수 없습니다: {ldraw_file}")
        return
    
    # 렌더러 초기화
    renderer = LDrawRenderer(args.supabase_url, args.supabase_key, background=args.background, color_management=args['color_management'] if isinstance(args, dict) else args.color_management)
    
    # 캐시 정리 옵션
    if args.clear_cache:
        renderer.clear_all_caches()
        print("🗑️ 모든 캐시가 정리되었습니다.")
        return
    
    # 병렬 렌더링 설정
    if args.disable_parallel:
        renderer.parallel_enabled = False
        print("⚠️ 병렬 렌더링 비활성화됨")
    
    if args.workers:
        renderer.max_workers = min(args.workers, multiprocessing.cpu_count())
        print(f"🔧 워커 수 수동 설정: {renderer.max_workers}개")
    
    # 적응형 샘플링 설정
    if args.disable_adaptive:
        renderer.adaptive_sampling = False
        print("⚠️ 적응형 샘플링 비활성화됨")
    
    # Noise Map 기반 보정 설정
    if args.disable_noise_correction:
        renderer.noise_correction = False
        print("⚠️ Noise Map 기반 보정 비활성화됨")
    
    # 품질 임계값 설정
    if args.quality_threshold:
        renderer.quality_threshold = args.quality_threshold
        print(f"🔧 품질 임계값 설정: {renderer.quality_threshold}")
    
    # AI 기반 복잡도 예측 설정
    if args.enable_ai_complexity:
        print("🤖 AI 기반 복잡도 예측 활성화 (향후 구현 예정)")
    
    # 부품 복잡도 통계 출력
    if args.complexity_stats:
        print(f"\n📊 부품 복잡도 통계:")
        print(f"  - 단순 부품: 256 샘플 (Plate/Tile)")
        print(f"  - 중간 부품: 320 샘플 (Beam/Rod)")
        print(f"  - 복잡 부품: 400 샘플 (Technic)")
        print(f"  - 적응형 샘플링: {'✅ 활성화' if renderer.adaptive_sampling else '❌ 비활성화'}")
        return
    
    # 캐시 통계만 출력
    if args.cache_stats:
        cache_stats = renderer.get_cache_stats()
        print(f"\n📊 캐시 통계:")
        print(f"  - 씬 캐시: {cache_stats['scene_cache_count']}개")
        print(f"  - 재질 캐시: {cache_stats['material_cache_count']}개")
        print(f"  - 캐시 크기: {cache_stats['cache_size_mb']}MB")
        print(f"  - 캐시 디렉토리: {cache_stats['cache_dir']}")
        return

    # 해상도/화면점유율 반영
    if args.resolution:
        try:
            if 'x' in args.resolution.lower():
                w, h = args.resolution.lower().split('x')
                renderer.resolution = (int(w), int(h))
        except Exception:
            pass
    if args.target_fill and 0.5 <= args.target_fill <= 0.98:
        renderer.target_fill = float(args.target_fill)
    
    # 샘플 수 설정 (서버에서 전달된 값 우선, 없으면 품질 기반)
    if args.samples:
        samples = args.samples
        print(f"🎯 서버에서 전달된 샘플 수: {samples}")
    else:
        # 품질에 따른 샘플 수 설정 (폐쇄 세계 최적화)
        quality_settings = {
            'fast': 64,
            'normal': 128,
            'high': 256,
            'ultra': 400
        }
        samples = quality_settings.get(args.quality, 64)
        print(f"🎯 렌더링 품질: {args.quality} → {samples} 샘플")
    
    renderer.current_samples = samples
    
    # 배치 렌더링 (중복 방지)
    results = []
    # 클라우드에 이미 존재하는 파일명 수집 (idempotent)
    existing_remote = set()
    try:
        folder_name = os.path.basename(part_output_dir) or str(args.part_id)
        temp_renderer = LDrawRenderer(args.supabase_url, args.supabase_key)
        existing_remote = temp_renderer.list_existing_in_bucket(folder_name)
    except Exception:
        existing_remote = set()

    # 병렬 렌더링 최적화
    if renderer.parallel_enabled and args.count > 1:
        print(f"🚀 병렬 렌더링 모드 ({renderer.max_workers} 워커)")
        
        # 렌더링할 인덱스 목록 생성 (중복 제외)
        render_indices = []
        for i in range(args.count):
            base_id_for_filename = args.output_subdir if getattr(args, 'output_subdir', None) else args.part_id
            image_filename = f"{base_id_for_filename}_{i:03d}.png"
            if image_filename not in existing_remote:
                render_indices.append(i)
            else:
                print(f"⏭️ 원격에 이미 존재: {image_filename} → 렌더링 건너뜀")
        
        if render_indices:
            # 병렬 배치 렌더링 실행
            batch_results = renderer.render_parallel_batch(
                ldraw_file,
                args.part_id,
                part_output_dir,
                render_indices,
                force_color_id=args.color_id
            )
            results.extend(batch_results)
        else:
            print("⏭️ 모든 이미지가 이미 존재하여 렌더링 건너뜀")
    else:
        # 순차 렌더링 (기존 방식)
        print("🔄 순차 렌더링 모드")
        for i in range(args.count):
            try:
                # 예정 파일명 (로컬/원격 동일) 계산하여 중복 시 스킵
                base_id_for_filename = args.output_subdir if getattr(args, 'output_subdir', None) else args.part_id
                image_filename = f"{base_id_for_filename}_{i:03d}.png"
                if image_filename in existing_remote:
                    print(f"⏭️ 원격에 이미 존재: {image_filename} → 렌더링 건너뜀")
                    continue

                result = renderer.render_single_part(
                    ldraw_file, 
                    args.part_id, 
                    part_output_dir,
                    i,
                    force_color_id=args.color_id
                )
                if result:
                    results.append(result)
            except Exception as e:
                print(f"❌ 렌더링 실패 (인덱스 {i}): {e}")
                continue
    
    print(f"\n🎉 렌더링 완료: {len(results)}/{args.count} 성공")
    
    # YAML 파일 생성 (렌더링 완료 후)
    if results:
        try:
            yaml_path = create_dataset_yaml(
                part_output_dir, 
                ['lego_part'],  # 클래스 이름
                args.part_id
            )
            if yaml_path:
                print(f"📋 dataset.yaml 생성 완료: {yaml_path}")
            else:
                print("⚠️ 설정 파일 생성 실패")
        except Exception as e:
            print(f"⚠️ YAML 파일 생성 실패: {e}")
    
    # 결과 요약
    if results:
        print(f"📁 출력 디렉토리: {args.output_dir}/{args.part_id}")
        print(f"🖼️ 이미지: {len(results)}개")
        print(f"📝 어노테이션: {len(results)}개")
        print(f"📋 YAML: dataset.yaml")
        
        if any(r.get('urls') for r in results):
            print("☁️ Supabase 업로드: 완료")
    
    # 성능 통계 출력
    cache_stats = renderer.get_cache_stats()
    print(f"\n📊 성능 통계:")
    print(f"  - GPU 가속: {'✅ 활성화' if renderer.gpu_optimized else '❌ 비활성화'}")
    print(f"  - 메모리 최적화: {'✅ 활성화' if renderer.memory_optimized else '❌ 비활성화'}")
    print(f"  - 병렬 렌더링: {'✅ 활성화' if renderer.parallel_enabled else '❌ 비활성화'}")
    if renderer.parallel_enabled:
        print(f"  - 워커 수: {renderer.max_workers}개")
    print(f"  - 적응형 샘플링: {'✅ 활성화' if renderer.adaptive_sampling else '❌ 비활성화'}")
    if renderer.adaptive_sampling:
        print(f"  - 복잡도 캐시: {len(renderer.complexity_cache)}개 부품")
    print(f"  - Noise Map 보정: {'✅ 활성화' if renderer.noise_correction else '❌ 비활성화'}")
    if renderer.noise_correction:
        print(f"  - 품질 임계값: {renderer.quality_threshold}")
    print(f"  - 씬 캐시: {cache_stats['scene_cache_count']}개")
    print(f"  - 재질 캐시: {cache_stats['material_cache_count']}개")
    print(f"  - 캐시 크기: {cache_stats['cache_size_mb']}MB")
    print(f"  - 캐시 디렉토리: {cache_stats['cache_dir']}")

if __name__ == "__main__":
    main()
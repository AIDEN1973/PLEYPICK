#!/usr/bin/env python3
"""
환경변수 통합 모듈
모든 스크립트에서 사용할 수 있는 통합 환경변수 관리
"""

import os
import sys
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

try:
    from scripts.env_manager import env_manager, get_env, set_env, apply_env
    ENV_MANAGER_AVAILABLE = True
except ImportError:
    ENV_MANAGER_AVAILABLE = False
    print("환경변수 관리자를 사용할 수 없습니다. 기본 환경변수를 사용합니다.")

def get_supabase_config():
    """Supabase 설정 가져오기"""
    if ENV_MANAGER_AVAILABLE:
        return {
            'url': get_env('supabase_url'),
            'anon_key': get_env('supabase_anon_key'),
            'service_role': get_env('supabase_service_role')
        }
    else:
        return {
            'url': os.getenv('VITE_SUPABASE_URL'),
            'anon_key': os.getenv('VITE_SUPABASE_ANON_KEY'),
            'service_role': os.getenv('VITE_SUPABASE_SERVICE_ROLE')
        }

def get_api_keys():
    """API 키들 가져오기"""
    if ENV_MANAGER_AVAILABLE:
        return {
            'openai': get_env('openai_api_key'),
            'rebrickable': get_env('rebrickable_api_key')
        }
    else:
        return {
            'openai': os.getenv('VITE_OPENAI_API_KEY'),
            'rebrickable': os.getenv('VITE_REBRICKABLE_API_KEY')
        }

def get_port_config():
    """포트 설정 가져오기"""
    if ENV_MANAGER_AVAILABLE:
        return {
            'vite': get_env('vite_port', 3000),
            'webp_image_api': get_env('webp_image_api_port', 3004),
            'training_api': get_env('training_api_port', 3010),
            'synthetic_api': get_env('synthetic_api_port', 3011),
            'worker': get_env('worker_port', 3020),
            'clip_service': get_env('clip_service_port', 3021),
            'semantic_vector_api': get_env('semantic_vector_api_port', 3022),
            'manual_upload': get_env('manual_upload_port', 3030),
            'monitoring': get_env('monitoring_port', 3040),
            'preview': get_env('preview_port', 4173)
        }
    else:
        return {
            'vite': int(os.getenv('VITE_PORT', 3000)),
            'webp_image_api': int(os.getenv('WEBP_IMAGE_API_PORT', 3004)),
            'training_api': int(os.getenv('TRAINING_API_PORT', 3010)),
            'synthetic_api': int(os.getenv('SYNTHETIC_API_PORT', 3011)),
            'worker': int(os.getenv('WORKER_PORT', 3020)),
            'clip_service': int(os.getenv('CLIP_SERVICE_PORT', 3021)),
            'semantic_vector_api': int(os.getenv('SEMANTIC_VECTOR_API_PORT', 3022)),
            'manual_upload': int(os.getenv('MANUAL_UPLOAD_PORT', 3030)),
            'monitoring': int(os.getenv('MONITORING_PORT', 3040)),
            'preview': int(os.getenv('PREVIEW_PORT', 4173))
        }

def get_service_urls():
    """서비스 URL들 가져오기"""
    if ENV_MANAGER_AVAILABLE:
        return {
            'clip_service': get_env('clip_service_url', 'http://localhost:3021'),
            'semantic_vector_api': get_env('semantic_vector_api_url', 'http://localhost:3022'),
            'vite_api_base': get_env('vite_api_base', 'http://localhost:3010'),
            'vite_synthetic_api_base': get_env('vite_synthetic_api_base', 'http://localhost:3011'),
            'vite_webp_image_api_base': get_env('vite_webp_image_api_base', 'http://localhost:3004')
        }
    else:
        return {
            'clip_service': os.getenv('CLIP_SERVICE_URL', 'http://localhost:3021'),
            'semantic_vector_api': os.getenv('SEMANTIC_VECTOR_API_URL', 'http://localhost:3022'),
            'vite_api_base': os.getenv('VITE_API_BASE', 'http://localhost:3010'),
            'vite_synthetic_api_base': os.getenv('VITE_SYNTHETIC_API_BASE', 'http://localhost:3011'),
            'vite_webp_image_api_base': os.getenv('VITE_WEBP_IMAGE_API_BASE', 'http://localhost:3004')
        }

def get_all_port_fields():
    """모든 포트 관련 필드들을 동적으로 가져오기"""
    if ENV_MANAGER_AVAILABLE:
        # 환경변수 관리자에서 모든 포트 관련 필드 찾기
        port_fields = {}
        for key in env_manager.config.__dict__:
            if key.endswith('_port') and not key.startswith('_'):
                value = getattr(env_manager.config, key)
                if isinstance(value, int):
                    port_fields[key] = value
        return port_fields
    else:
        # 폴백: 기본 포트 필드들
        return get_port_config()

def get_all_service_fields():
    """모든 서비스 URL 관련 필드들을 동적으로 가져오기"""
    if ENV_MANAGER_AVAILABLE:
        # 환경변수 관리자에서 모든 서비스 URL 관련 필드 찾기
        service_fields = {}
        for key in env_manager.config.__dict__:
            if (key.endswith('_url') or key.endswith('_base')) and not key.startswith('_'):
                value = getattr(env_manager.config, key)
                if isinstance(value, str) and value.startswith('http'):
                    service_fields[key] = value
        return service_fields
    else:
        # 폴백: 기본 서비스 필드들
        return get_service_urls()

def apply_environment():
    """환경변수 적용"""
    if ENV_MANAGER_AVAILABLE:
        apply_env()
        print("통합 환경변수 관리자를 통해 환경변수가 적용되었습니다.")
    else:
        print("기본 환경변수를 사용합니다.")

def validate_environment():
    """환경변수 유효성 검사"""
    if ENV_MANAGER_AVAILABLE:
        errors = env_manager.validate_config()
        if errors:
            print("환경변수 오류:")
            for field, error in errors.items():
                print(f"  - {field}: {error}")
            return False
        else:
            print("환경변수가 유효합니다.")
            return True
    else:
        # 기본 검사
        required_vars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_SERVICE_ROLE']
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        if missing_vars:
            print(f"누락된 환경변수: {missing_vars}")
            return False
        else:
            print("기본 환경변수가 유효합니다.")
            return True

def show_environment():
    """환경변수 표시"""
    if ENV_MANAGER_AVAILABLE:
        env_manager.show_config()
    else:
        print("=== 기본 환경변수 ===")
        for key, value in os.environ.items():
            if key.startswith(('VITE_', 'SUPABASE_', 'OPENAI_', 'REBRICKABLE_')):
                display_value = value[:50] + "..." if len(value) > 50 else value
                print(f"{key}: {display_value}")

# 편의 함수들
def get_supabase_url():
    return get_supabase_config()['url']

def get_supabase_key():
    return get_supabase_config()['service_role']

def get_openai_key():
    return get_api_keys()['openai']

def get_rebrickable_key():
    return get_api_keys()['rebrickable']

if __name__ == "__main__":
    print("=== BrickBox 환경변수 통합 모듈 테스트 ===")
    print(f"환경변수 관리자 사용 가능: {ENV_MANAGER_AVAILABLE}")
    
    # 환경변수 적용
    apply_environment()
    
    # 유효성 검사
    validate_environment()
    
    # 설정 표시
    show_environment()

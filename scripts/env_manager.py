#!/usr/bin/env python3
"""
BrickBox 환경변수 관리자
중앙집중식 환경변수 관리 및 동적 설정 시스템
"""

import os
import json
import yaml
from pathlib import Path
from typing import Dict, Any, Optional, Union
from dataclasses import dataclass, asdict
from dotenv import load_dotenv

@dataclass
class EnvironmentConfig:
    """환경변수 설정 데이터 클래스"""
    # Supabase 설정
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role: str = ""
    
    # API 키들
    openai_api_key: str = ""
    rebrickable_api_key: str = ""
    
    # 포트 설정
    vite_port: int = 3000
    webp_image_api_port: int = 3004
    training_api_port: int = 3010
    synthetic_api_port: int = 3011
    worker_port: int = 3020
    clip_service_port: int = 3021
    semantic_vector_api_port: int = 3022
    manual_upload_port: int = 3030
    monitoring_port: int = 3040
    preview_port: int = 4173
    
    # 서비스 URL
    clip_service_url: str = "http://localhost:3021"
    semantic_vector_api_url: str = "http://localhost:3022"
    vite_api_base: str = "http://localhost:3010"
    vite_synthetic_api_base: str = "http://localhost:3011"
    vite_webp_image_api_base: str = "http://localhost:3004"
    
    # 모델 설정
    default_model_url: str = ""
    
    # 개발 환경
    node_env: str = "development"
    
    # 추가 설정
    custom_settings: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.custom_settings is None:
            self.custom_settings = {}

class EnvironmentManager:
    """환경변수 중앙 관리자"""
    
    def __init__(self, config_dir: str = None):
        self.config_dir = Path(config_dir) if config_dir else Path(__file__).parent.parent
        self.env_file = self.config_dir / ".env"
        self.config_file = self.config_dir / "config.json"
        self.yaml_config_file = self.config_dir / "config.yaml"
        
        # 환경변수 매핑 테이블
        self.env_mapping = {
            # Supabase
            'VITE_SUPABASE_URL': 'supabase_url',
            'VITE_SUPABASE_ANON_KEY': 'supabase_anon_key',
            'VITE_SUPABASE_SERVICE_ROLE': 'supabase_service_role',
            
            # API Keys
            'VITE_OPENAI_API_KEY': 'openai_api_key',
            'VITE_REBRICKABLE_API_KEY': 'rebrickable_api_key',
            
            # Ports
            'VITE_PORT': 'vite_port',
            'WEBP_IMAGE_API_PORT': 'webp_image_api_port',
            'TRAINING_API_PORT': 'training_api_port',
            'SYNTHETIC_API_PORT': 'synthetic_api_port',
            'WORKER_PORT': 'worker_port',
            'CLIP_SERVICE_PORT': 'clip_service_port',
            'SEMANTIC_VECTOR_API_PORT': 'semantic_vector_api_port',
            'MANUAL_UPLOAD_PORT': 'manual_upload_port',
            'MONITORING_PORT': 'monitoring_port',
            'PREVIEW_PORT': 'preview_port',
            
            # Service URLs
            'CLIP_SERVICE_URL': 'clip_service_url',
            'SEMANTIC_VECTOR_API_URL': 'semantic_vector_api_url',
            'VITE_API_BASE': 'vite_api_base',
            'VITE_SYNTHETIC_API_BASE': 'vite_synthetic_api_base',
            'VITE_WEBP_IMAGE_API_BASE': 'vite_webp_image_api_base',
            
            # Model
            'VITE_DEFAULT_MODEL_URL': 'default_model_url',
            
            # Environment
            'NODE_ENV': 'node_env',
        }
        
        self.config = EnvironmentConfig()
        self.load_config()
    
    def load_config(self):
        """설정 로드 (우선순위: 환경변수 > config.json > .env)"""
        # 1. 환경변수에서 로드
        self._load_from_env()
        
        # 2. config.json에서 로드
        if self.config_file.exists():
            self._load_from_json()
        
        # 3. .env 파일에서 로드
        if self.env_file.exists():
            self._load_from_dotenv()
        
        # 4. YAML 설정에서 로드
        if self.yaml_config_file.exists():
            self._load_from_yaml()
    
    def _load_from_env(self):
        """환경변수에서 설정 로드"""
        for env_var, config_key in self.env_mapping.items():
            value = os.getenv(env_var)
            if value:
                # 타입 변환
                if hasattr(self.config, config_key):
                    current_value = getattr(self.config, config_key)
                    if isinstance(current_value, int):
                        try:
                            value = int(value)
                        except ValueError:
                            pass
                    elif isinstance(current_value, bool):
                        value = value.lower() in ('true', '1', 'yes', 'on')
                    setattr(self.config, config_key, value)
    
    def _load_from_json(self):
        """JSON 설정 파일에서 로드"""
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for key, value in data.items():
                    if hasattr(self.config, key):
                        setattr(self.config, key, value)
        except Exception as e:
            print(f"JSON 설정 로드 실패: {e}")
    
    def _load_from_dotenv(self):
        """dotenv 파일에서 로드"""
        try:
            load_dotenv(self.env_file, override=True)
            self._load_from_env()
        except Exception as e:
            print(f"dotenv 설정 로드 실패: {e}")
    
    def _load_from_yaml(self):
        """YAML 설정 파일에서 로드"""
        try:
            with open(self.yaml_config_file, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
                for key, value in data.items():
                    if hasattr(self.config, key):
                        setattr(self.config, key, value)
        except Exception as e:
            print(f"YAML 설정 로드 실패: {e}")
    
    def save_config(self, format: str = 'json'):
        """설정 저장"""
        if format == 'json':
            self._save_to_json()
        elif format == 'yaml':
            self._save_to_yaml()
        elif format == 'env':
            self._save_to_env()
        else:
            raise ValueError(f"지원하지 않는 형식: {format}")
    
    def _save_to_json(self):
        """JSON 형식으로 저장"""
        config_dict = asdict(self.config)
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(config_dict, f, indent=2, ensure_ascii=False)
        print(f"설정이 {self.config_file}에 저장되었습니다.")
    
    def _save_to_yaml(self):
        """YAML 형식으로 저장"""
        config_dict = asdict(self.config)
        with open(self.yaml_config_file, 'w', encoding='utf-8') as f:
            yaml.dump(config_dict, f, default_flow_style=False, allow_unicode=True)
        print(f"설정이 {self.yaml_config_file}에 저장되었습니다.")
    
    def _save_to_env(self):
        """ENV 형식으로 저장"""
        with open(self.env_file, 'w', encoding='utf-8') as f:
            f.write("# BrickBox 환경 설정\n")
            f.write("# 자동 생성된 파일입니다. 수동으로 편집하지 마세요.\n\n")
            
            # Supabase 설정
            f.write("# Supabase 설정\n")
            f.write(f"VITE_SUPABASE_URL={self.config.supabase_url}\n")
            f.write(f"VITE_SUPABASE_ANON_KEY={self.config.supabase_anon_key}\n")
            f.write(f"VITE_SUPABASE_SERVICE_ROLE={self.config.supabase_service_role}\n\n")
            
            # API 키
            f.write("# API 키\n")
            f.write(f"VITE_OPENAI_API_KEY={self.config.openai_api_key}\n")
            f.write(f"VITE_REBRICKABLE_API_KEY={self.config.rebrickable_api_key}\n\n")
            
            # 포트 설정
            f.write("# 포트 설정\n")
            f.write(f"VITE_PORT={self.config.vite_port}\n")
            f.write(f"WEBP_IMAGE_API_PORT={self.config.webp_image_api_port}\n")
            f.write(f"TRAINING_API_PORT={self.config.training_api_port}\n")
            f.write(f"SYNTHETIC_API_PORT={self.config.synthetic_api_port}\n")
            f.write(f"WORKER_PORT={self.config.worker_port}\n")
            f.write(f"CLIP_SERVICE_PORT={self.config.clip_service_port}\n")
            f.write(f"SEMANTIC_VECTOR_API_PORT={self.config.semantic_vector_api_port}\n")
            f.write(f"MANUAL_UPLOAD_PORT={self.config.manual_upload_port}\n")
            f.write(f"MONITORING_PORT={self.config.monitoring_port}\n")
            f.write(f"PREVIEW_PORT={self.config.preview_port}\n\n")
            
            # 서비스 URL
            f.write("# 서비스 URL\n")
            f.write(f"CLIP_SERVICE_URL={self.config.clip_service_url}\n")
            f.write(f"SEMANTIC_VECTOR_API_URL={self.config.semantic_vector_api_url}\n")
            f.write(f"VITE_API_BASE={self.config.vite_api_base}\n")
            f.write(f"VITE_SYNTHETIC_API_BASE={self.config.vite_synthetic_api_base}\n")
            f.write(f"VITE_WEBP_IMAGE_API_BASE={self.config.vite_webp_image_api_base}\n\n")
            
            # 모델 설정
            f.write("# 모델 설정\n")
            f.write(f"VITE_DEFAULT_MODEL_URL={self.config.default_model_url}\n\n")
            
            # 환경
            f.write("# 환경\n")
            f.write(f"NODE_ENV={self.config.node_env}\n")
        
        print(f"설정이 {self.env_file}에 저장되었습니다.")
    
    def get(self, key: str, default: Any = None) -> Any:
        """설정 값 가져오기"""
        if hasattr(self.config, key):
            return getattr(self.config, key)
        return self.config.custom_settings.get(key, default)
    
    def set(self, key: str, value: Any):
        """설정 값 설정하기"""
        if hasattr(self.config, key):
            setattr(self.config, key, value)
        else:
            self.config.custom_settings[key] = value
    
    def get_env_dict(self) -> Dict[str, str]:
        """환경변수 딕셔너리 반환"""
        env_dict = {}
        for env_var, config_key in self.env_mapping.items():
            value = getattr(self.config, config_key, "")
            if value:
                env_dict[env_var] = str(value)
        return env_dict
    
    def apply_to_environment(self):
        """현재 설정을 환경변수에 적용"""
        env_dict = self.get_env_dict()
        for key, value in env_dict.items():
            os.environ[key] = value
        print(f"{len(env_dict)}개의 환경변수가 적용되었습니다.")
    
    def validate_config(self) -> Dict[str, str]:
        """설정 유효성 검사"""
        errors = {}
        
        # 필수 설정 검사
        required_fields = ['supabase_url', 'supabase_service_role']
        for field in required_fields:
            if not getattr(self.config, field):
                errors[field] = f"{field}이 설정되지 않았습니다."
        
        # URL 형식 검사
        if self.config.supabase_url and not self.config.supabase_url.startswith('https://'):
            errors['supabase_url'] = "Supabase URL은 https://로 시작해야 합니다."
        
        # 포트 범위 검사
        port_fields = ['vite_port', 'training_api_port', 'synthetic_api_port']
        for field in port_fields:
            port = getattr(self.config, field)
            if port and (port < 1024 or port > 65535):
                errors[field] = f"{field}은 1024-65535 범위여야 합니다."
        
        return errors
    
    def show_config(self):
        """현재 설정 표시"""
        print("=== BrickBox 환경 설정 ===")
        config_dict = asdict(self.config)
        for key, value in config_dict.items():
            if key == 'custom_settings':
                continue
            if isinstance(value, str) and len(value) > 50:
                display_value = value[:47] + "..."
            else:
                display_value = value
            print(f"{key}: {display_value}")
        
        if self.config.custom_settings:
            print("\n=== 사용자 정의 설정 ===")
            for key, value in self.config.custom_settings.items():
                print(f"{key}: {value}")
    
    def interactive_setup(self):
        """대화형 설정"""
        print("=== BrickBox 환경 설정 대화형 설정 ===")
        
        # Supabase 설정
        print("\n1. Supabase 설정")
        self.config.supabase_url = input(f"Supabase URL [{self.config.supabase_url}]: ") or self.config.supabase_url
        self.config.supabase_anon_key = input(f"Supabase Anon Key [{self.config.supabase_anon_key[:20]}...]: ") or self.config.supabase_anon_key
        self.config.supabase_service_role = input(f"Supabase Service Role [{self.config.supabase_service_role[:20]}...]: ") or self.config.supabase_service_role
        
        # API 키
        print("\n2. API 키")
        self.config.openai_api_key = input(f"OpenAI API Key [{self.config.openai_api_key[:20]}...]: ") or self.config.openai_api_key
        self.config.rebrickable_api_key = input(f"Rebrickable API Key [{self.config.rebrickable_api_key[:20]}...]: ") or self.config.rebrickable_api_key
        
        # 포트 설정
        print("\n3. 포트 설정")
        try:
            self.config.vite_port = int(input(f"Vite Port [{self.config.vite_port}]: ") or self.config.vite_port)
            self.config.training_api_port = int(input(f"Training API Port [{self.config.training_api_port}]: ") or self.config.training_api_port)
        except ValueError:
            print("잘못된 포트 번호입니다. 기본값을 사용합니다.")
        
        # 유효성 검사
        errors = self.validate_config()
        if errors:
            print("\n설정 오류:")
            for field, error in errors.items():
                print(f"  - {field}: {error}")
            return False
        
        # 저장
        save_format = input("\n저장 형식을 선택하세요 (json/yaml/env) [json]: ") or "json"
        self.save_config(save_format)
        
        print("\n설정이 완료되었습니다!")
        return True

# 전역 환경변수 관리자 인스턴스
env_manager = EnvironmentManager()

def get_env(key: str, default: Any = None) -> Any:
    """환경변수 값 가져오기 (편의 함수)"""
    return env_manager.get(key, default)

def set_env(key: str, value: Any):
    """환경변수 값 설정하기 (편의 함수)"""
    env_manager.set(key, value)

def apply_env():
    """환경변수 적용 (편의 함수)"""
    env_manager.apply_to_environment()

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "show":
            env_manager.show_config()
        elif command == "validate":
            errors = env_manager.validate_config()
            if errors:
                print("설정 오류:")
                for field, error in errors.items():
                    print(f"  - {field}: {error}")
            else:
                print("설정이 유효합니다.")
        elif command == "setup":
            env_manager.interactive_setup()
        elif command == "save":
            format_type = sys.argv[2] if len(sys.argv) > 2 else "json"
            env_manager.save_config(format_type)
        elif command == "apply":
            env_manager.apply_to_environment()
        else:
            print(f"알 수 없는 명령: {command}")
    else:
        print("사용법: python env_manager.py [show|validate|setup|save|apply]")
        print("  show    - 현재 설정 표시")
        print("  validate - 설정 유효성 검사")
        print("  setup   - 대화형 설정")
        print("  save    - 설정 저장 (json/yaml/env)")
        print("  apply   - 환경변수 적용")

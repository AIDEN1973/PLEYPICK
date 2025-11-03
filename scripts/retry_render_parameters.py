#!/usr/bin/env python3
"""
BrickBox 실패 원인별 재렌더링 파라미터 시스템
QA FAIL 원인에 따른 최적화된 재렌더링 설정
"""

import json
import os
from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum

class FailureType(Enum):
    """실패 유형 정의"""
    FAIL_SSIM = "fail_ssim"
    FAIL_SHARPNESS = "fail_sharpness" 
    FAIL_PNP = "fail_pnp"
    FAIL_SNR = "fail_snr"
    FAIL_DEPTH = "fail_depth"
    FAIL_NOISE = "fail_noise"
    FAIL_CONTRAST = "fail_contrast"

@dataclass
class RetryRenderParameters:
    """재렌더링 파라미터 정의"""
    samples: int = 512
    lighting: str = "standard"
    background: str = "white"
    camera_distance: float = 1.0
    focus_depth: float = 0.5
    camera_variation: str = "normal"
    pose_variation: str = "normal"
    color_management: str = "standard"
    resolution: str = "1024x1024"
    target_fill: float = 0.92
    additional_params: Dict = None

    def __post_init__(self):
        if self.additional_params is None:
            self.additional_params = {}

class RetryParameterManager:
    """재렌더링 파라미터 관리자"""
    
    def __init__(self, config_path: str = "config/retry_parameters.json"):
        self.config_path = config_path
        self.parameters = self._load_parameters()
    
    def _load_parameters(self) -> Dict[str, RetryRenderParameters]:
        """파라미터 설정 로드"""
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
            else:
                # 기본 설정 생성
                config = self._create_default_config()
                self._save_config(config)
            
            # 설정을 RetryRenderParameters 객체로 변환
            parameters = {}
            for failure_type, params in config.items():
                parameters[failure_type] = RetryRenderParameters(**params)
            
            return parameters
            
        except Exception as e:
            print(f"파라미터 로드 실패: {e}")
            return self._create_default_parameters()
    
    def _create_default_config(self) -> Dict:
        """기본 설정 생성"""
        return {
            "fail_ssim": {
                "samples": 512,
                "lighting": "studio",
                "background": "white",
                "camera_distance": 1.2,
                "focus_depth": 0.5,
                "camera_variation": "increased",
                "pose_variation": "increased",
                "color_management": "filmic",
                "resolution": "1024x1024",
                "target_fill": 0.95,
                "additional_params": {
                    "denoise": True,
                    "anti_aliasing": "high"
                }
            },
            "fail_sharpness": {
                "samples": 512,
                "lighting": "standard",
                "background": "white",
                "camera_distance": 1.0,
                "focus_depth": 0.45,
                "camera_variation": "normal",
                "pose_variation": "normal",
                "color_management": "standard",
                "resolution": "1024x1024",
                "target_fill": 0.92,
                "additional_params": {
                    "focus_accuracy": "high",
                    "depth_of_field": "narrow"
                }
            },
            "fail_pnp": {
                "samples": 512,
                "lighting": "standard",
                "background": "white",
                "camera_distance": 1.0,
                "focus_depth": 0.5,
                "camera_variation": "re-randomize",
                "pose_variation": "increased",
                "color_management": "standard",
                "resolution": "1024x1024",
                "target_fill": 0.92,
                "additional_params": {
                    "pose_randomization": "high",
                    "camera_angles": "varied"
                }
            },
            "fail_snr": {
                "samples": 512,
                "lighting": "bright",
                "background": "white",
                "camera_distance": 1.0,
                "focus_depth": 0.5,
                "camera_variation": "normal",
                "pose_variation": "normal",
                "color_management": "filmic",
                "resolution": "1024x1024",
                "target_fill": 0.92,
                "additional_params": {
                    "exposure": "increased",
                    "contrast": "enhanced"
                }
            },
            "fail_depth": {
                "samples": 512,
                "lighting": "standard",
                "background": "white",
                "camera_distance": 1.0,
                "focus_depth": 0.3,
                "camera_variation": "normal",
                "pose_variation": "normal",
                "color_management": "standard",
                "resolution": "1024x1024",
                "target_fill": 0.92,
                "additional_params": {
                    "depth_rendering": "enhanced",
                    "stereo_accuracy": "high"
                }
            },
            "fail_noise": {
                "samples": 512,
                "lighting": "clean",
                "background": "white",
                "camera_distance": 1.0,
                "focus_depth": 0.5,
                "camera_variation": "normal",
                "pose_variation": "normal",
                "color_management": "filmic",
                "resolution": "1024x1024",
                "target_fill": 0.92,
                "additional_params": {
                    "denoise": True,
                    "noise_reduction": "high"
                }
            },
            "fail_contrast": {
                "samples": 512,
                "lighting": "high_contrast",
                "background": "white",
                "camera_distance": 1.0,
                "focus_depth": 0.5,
                "camera_variation": "normal",
                "pose_variation": "normal",
                "color_management": "filmic",
                "resolution": "1024x1024",
                "target_fill": 0.92,
                "additional_params": {
                    "contrast_enhancement": True,
                    "gamma_correction": "optimized"
                }
            }
        }
    
    def _create_default_parameters(self) -> Dict[str, RetryRenderParameters]:
        """기본 파라미터 객체 생성"""
        return {
            "fail_ssim": RetryRenderParameters(
                samples=512,
                lighting="studio",
                background="white",
                camera_distance=1.2,
                focus_depth=0.5,
                camera_variation="increased",
                pose_variation="increased",
                color_management="filmic",
                resolution="1024x1024",
                target_fill=0.95,
                additional_params={"denoise": True, "anti_aliasing": "high"}
            ),
            "fail_sharpness": RetryRenderParameters(
                samples=512,
                lighting="standard",
                background="white",
                camera_distance=1.0,
                focus_depth=0.45,
                camera_variation="normal",
                pose_variation="normal",
                color_management="standard",
                resolution="1024x1024",
                target_fill=0.92,
                additional_params={"focus_accuracy": "high", "depth_of_field": "narrow"}
            ),
            "fail_pnp": RetryRenderParameters(
                samples=512,
                lighting="standard",
                background="white",
                camera_distance=1.0,
                focus_depth=0.5,
                camera_variation="re-randomize",
                pose_variation="increased",
                color_management="standard",
                resolution="1024x1024",
                target_fill=0.92,
                additional_params={"pose_randomization": "high", "camera_angles": "varied"}
            )
        }
    
    def _save_config(self, config: Dict):
        """설정 저장"""
        try:
            os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"설정 저장 실패: {e}")
    
    def get_retry_parameters(self, failure_reason: str) -> RetryRenderParameters:
        """실패 원인에 따른 재렌더링 파라미터 조회"""
        try:
            # 실패 원인 분석
            failure_type = self._analyze_failure_reason(failure_reason)
            
            if failure_type in self.parameters:
                return self.parameters[failure_type]
            else:
                # 기본 파라미터 반환
                return RetryRenderParameters()
                
        except Exception as e:
            print(f"재렌더링 파라미터 조회 실패: {e}")
            return RetryRenderParameters()
    
    def _analyze_failure_reason(self, failure_reason: str) -> str:
        """실패 원인 분석"""
        failure_reason_lower = failure_reason.lower()
        
        if "ssim" in failure_reason_lower:
            return "fail_ssim"
        elif "sharpness" in failure_reason_lower:
            return "fail_sharpness"
        elif "pnp" in failure_reason_lower or "reprojection" in failure_reason_lower:
            return "fail_pnp"
        elif "snr" in failure_reason_lower:
            return "fail_snr"
        elif "depth" in failure_reason_lower:
            return "fail_depth"
        elif "noise" in failure_reason_lower:
            return "fail_noise"
        elif "contrast" in failure_reason_lower:
            return "fail_contrast"
        else:
            return "fail_ssim"  # 기본값
    
    def generate_blender_command(self, part_id: str, failure_reason: str, 
                                element_id: str, color_id: int, color_hex: str) -> str:
        """Blender 명령어 생성"""
        try:
            params = self.get_retry_parameters(failure_reason)
            
            # 기본 명령어 구성
            cmd_parts = [
                "blender",
                "--background",
                "--python", "scripts/render_ldraw_to_supabase.py",
                "--",
                f"--part-id", part_id,
                f"--count", "200",
                f"--quality", "high",
                f"--samples", str(params.samples),
                f"--background", params.background,
                f"--ldraw-path", "C:/LDraw/parts",
                f"--output-dir", "./output/synthetic",
                f"--output-subdir", element_id,
                f"--element-id", element_id,
                f"--resolution", params.resolution,
                f"--target-fill", str(params.target_fill),
                f"--color-management", params.color_management,
                f"--color-id", str(color_id),
                f"--color-hex", color_hex
            ]
            
            # 추가 파라미터 적용
            if params.lighting != "standard":
                cmd_parts.extend(["--lighting", params.lighting])
            
            if params.camera_distance != 1.0:
                cmd_parts.extend(["--camera-distance", str(params.camera_distance)])
            
            if params.focus_depth != 0.5:
                cmd_parts.extend(["--focus-depth", str(params.focus_depth)])
            
            if params.camera_variation != "normal":
                cmd_parts.extend(["--camera-variation", params.camera_variation])
            
            if params.pose_variation != "normal":
                cmd_parts.extend(["--pose-variation", params.pose_variation])
            
            # 추가 파라미터
            for key, value in params.additional_params.items():
                cmd_parts.extend([f"--{key}", str(value)])
            
            return " ".join(cmd_parts)
            
        except Exception as e:
            print(f"Blender 명령어 생성 실패: {e}")
            return ""
    
    def update_parameters(self, failure_type: str, new_params: Dict):
        """파라미터 업데이트"""
        try:
            if failure_type in self.parameters:
                # 기존 파라미터 업데이트
                for key, value in new_params.items():
                    if hasattr(self.parameters[failure_type], key):
                        setattr(self.parameters[failure_type], key, value)
                
                # 설정 파일 저장
                config = {}
                for ft, params in self.parameters.items():
                    config[ft] = {
                        "samples": params.samples,
                        "lighting": params.lighting,
                        "background": params.background,
                        "camera_distance": params.camera_distance,
                        "focus_depth": params.focus_depth,
                        "camera_variation": params.camera_variation,
                        "pose_variation": params.pose_variation,
                        "color_management": params.color_management,
                        "resolution": params.resolution,
                        "target_fill": params.target_fill,
                        "additional_params": params.additional_params
                    }
                
                self._save_config(config)
                print(f"파라미터 업데이트 완료: {failure_type}")
                
        except Exception as e:
            print(f"파라미터 업데이트 실패: {e}")
    
    def get_all_parameters(self) -> Dict[str, RetryRenderParameters]:
        """모든 파라미터 조회"""
        return self.parameters.copy()
    
    def validate_parameters(self) -> List[str]:
        """파라미터 유효성 검사"""
        issues = []
        
        for failure_type, params in self.parameters.items():
            # 샘플 수 검사
            if params.samples < 64 or params.samples > 1024:
                issues.append(f"{failure_type}: samples는 64-1024 범위여야 합니다")
            
            # 카메라 거리 검사
            if params.camera_distance < 0.5 or params.camera_distance > 3.0:
                issues.append(f"{failure_type}: camera_distance는 0.5-3.0 범위여야 합니다")
            
            # 포커스 깊이 검사
            if params.focus_depth < 0.1 or params.focus_depth > 1.0:
                issues.append(f"{failure_type}: focus_depth는 0.1-1.0 범위여야 합니다")
            
            # 타겟 필 검사
            if params.target_fill < 0.5 or params.target_fill > 1.0:
                issues.append(f"{failure_type}: target_fill은 0.5-1.0 범위여야 합니다")
        
        return issues

def main():
    """테스트 함수"""
    try:
        # RetryParameterManager 초기화
        manager = RetryParameterManager("config/retry_parameters.json")
        
        # 테스트 케이스들
        test_cases = [
            "SSIM 0.42 < 0.96",
            "Sharpness 0.65 < 0.7", 
            "RMS 2.1 > 1.5",
            "SNR 25.0 < 30.0",
            "Depth Score 0.80 < 0.85"
        ]
        
        print("🧪 재렌더링 파라미터 테스트")
        print("=" * 50)
        
        for i, failure_reason in enumerate(test_cases, 1):
            print(f"\n{i}. 실패 원인: {failure_reason}")
            
            # 파라미터 조회
            params = manager.get_retry_parameters(failure_reason)
            print(f"   파라미터: samples={params.samples}, lighting={params.lighting}")
            
            # Blender 명령어 생성
            cmd = manager.generate_blender_command(
                "test_part", failure_reason, "12345", 15, "#FFFFFF"
            )
            print(f"   명령어: {cmd[:100]}...")
        
        # 파라미터 유효성 검사
        issues = manager.validate_parameters()
        if issues:
            print(f"\n[WARNING] 파라미터 검사 이슈:")
            for issue in issues:
                print(f"   - {issue}")
        else:
            print(f"\n✅ 모든 파라미터가 유효합니다")
        
        return True
        
    except Exception as e:
        print(f"테스트 실패: {e}")
        return False

if __name__ == "__main__":
    main()

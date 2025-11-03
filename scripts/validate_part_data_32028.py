#!/usr/bin/env python3
"""
part_id 32028 데이터 검증 스크립트
"""

import json
import sys
from pathlib import Path

# 제공된 데이터 (사용자 입력에서 추출)
sample_data = {
    "part_id": "32028",
    "color_id": 1,
    "part_name": "32028",
    "feature_json": {
        "scale": "system",
        "shape": "평판 형태의 조립 부품",
        "groove": True,
        "area_px": 0,
        "function": "building_block",
        "keypoints": [],
        "shape_tag": "plate",
        "bbox_ratio": [0.8, 0.8],
        "confusions": ["3001", "3004"],
        "connection": "stud_connection",
        "hole_count": 0,
        "is_printed": False,
        "scale_type": "system",
        "center_stud": False,
        "meta_source": "auto_renderer_v4",
        "orientation": "top",
        "feature_text": "이 부품은 문 레일이 있는 1x2 플레이트로, 다양한 모델에 사용됩니다.",
        "function_tag": "building",
        "stud_pattern": None,
        "tube_pattern": None,
        "image_quality": {"q": 0.94, "snr": 40, "ssim": 0.98, "resolution": 768},
        "similar_parts": [],
        "texture_class": "matte",
        "top_color_rgb": [0, 0, 0],
        "stud_count_top": 2,
        "underside_type": "solid_tube",
        "topo_applicable": False,
        "shape_tag_legacy": "unknown",
        "color_expectation": None,
        "recognition_hints": {
            "ko": "이 부품은 문 레일이 있는 1x2 플레이트로, 다양한 모델에 사용됩니다.",
            "top_view": "상단에서 보면 두 개의 스터드가 나열되어 있으며, 한쪽에 레일이 있습니다.",
            "side_view": "옆에서 보면 비교적 얇은 두께를 가지며, 레일 부분이 드러납니다.",
            "unique_features": ["문 레일 기능", "특별한 블루 컬러", "다양한 조립 부품과 호환"]
        },
        "tube_count_bottom": 0,
        "feature_text_score": 0.44,
        "clip_distinguishing": ["도어 레일이 있는 디자인", "특별한 평면 형태"],
        "expected_hole_count": 0,
        "expected_stud_count": 2,
        "clip_unique_features": ["문 레일 기능", "특별한 블루 컬러", "다양한 조립 부품과 호환"],
        "distinguishing_features": ["도어 레일이 있는 디자인", "특별한 평면 형태"]
    },
    "recognition_hints": {
        "ko": "이 부품은 문 레일이 있는 1x2 플레이트로, 다양한 모델에 사용됩니다.",
        "top_view": "상단에서 보면 두 개의 스터드가 나열되어 있으며, 한쪽에 레일이 있습니다.",
        "side_view": "옆에서 보면 비교적 얇은 두께를 가지며, 레일 부분이 드러납니다.",
        "unique_features": ["문 레일 기능", "특별한 블루 컬러", "다양한 조립 부품과 호환"]
    },
    "confidence": 0.95,
    "usage_frequency": 0
}

def validate_vector(vector_str, vector_name, expected_dim=768):
    """벡터 검증"""
    try:
        # 문자열을 리스트로 변환 시도
        if isinstance(vector_str, str):
            # 공백 제거 후 파싱 시도
            vector_str = vector_str.strip()
            if vector_str.startswith('['):
                vector = json.loads(vector_str)
            else:
                # 쉼표로 구분된 숫자 문자열 파싱
                vector = [float(x.strip()) for x in vector_str.split(',') if x.strip()]
        elif isinstance(vector_str, list):
            vector = vector_str
        else:
            return {
                "valid": False,
                "error": f"{vector_name}: 지원하지 않는 타입 ({type(vector_str)})"
            }
        
        # 차원 확인
        if len(vector) != expected_dim:
            return {
                "valid": False,
                "dimension": len(vector),
                "expected": expected_dim,
                "error": f"{vector_name}: 차원 불일치 ({len(vector)} != {expected_dim})"
            }
        
        # 제로 벡터 검증
        import numpy as np
        vector_np = np.array(vector, dtype=np.float32)
        norm = np.linalg.norm(vector_np)
        
        if norm < 0.01:
            return {
                "valid": False,
                "norm": float(norm),
                "error": f"{vector_name}: 제로 벡터 (norm={norm:.6f} < 0.01)"
            }
        
        # 벡터 통계
        min_val = float(np.min(vector_np))
        max_val = float(np.max(vector_np))
        mean_val = float(np.mean(vector_np))
        std_val = float(np.std(vector_np))
        
        # 후반부 제로 패딩 검증 (마지막 256차원)
        if len(vector) == 768:
            front_512 = vector_np[:512]
            back_256 = vector_np[512:]
            
            front_norm = np.linalg.norm(front_512)
            back_norm = np.linalg.norm(back_256)
            back_ratio = back_norm / front_norm if front_norm > 0.01 else 0.0
            
            return {
                "valid": True,
                "dimension": len(vector),
                "norm": float(norm),
                "min": min_val,
                "max": max_val,
                "mean": mean_val,
                "std": std_val,
                "front_512_norm": float(front_norm),
                "back_256_norm": float(back_norm),
                "back_ratio": float(back_ratio),
                "has_zero_padding": back_ratio < 0.1 and back_norm < 0.1  # 후반부가 거의 0이면 제로 패딩 의심
            }
        else:
            return {
                "valid": True,
                "dimension": len(vector),
                "norm": float(norm),
                "min": min_val,
                "max": max_val,
                "mean": mean_val,
                "std": std_val
            }
            
    except Exception as e:
        return {
            "valid": False,
            "error": f"{vector_name}: 파싱 실패 ({str(e)})"
        }

def validate_feature_json(feature_json):
    """feature_json 검증"""
    issues = []
    
    # 필수 필드 확인
    required_fields = ["shape_tag", "stud_count_top", "tube_count_bottom"]
    for field in required_fields:
        if field not in feature_json:
            issues.append(f"필수 필드 누락: {field}")
    
    # 데이터 타입 확인
    if "stud_count_top" in feature_json:
        if not isinstance(feature_json["stud_count_top"], int):
            issues.append(f"stud_count_top 타입 오류: {type(feature_json['stud_count_top'])}")
    
    if "tube_count_bottom" in feature_json:
        if not isinstance(feature_json["tube_count_bottom"], int):
            issues.append(f"tube_count_bottom 타입 오류: {type(feature_json['tube_count_bottom'])}")
    
    # recognition_hints 확인
    if "recognition_hints" not in feature_json:
        issues.append("recognition_hints 필드 누락")
    elif not isinstance(feature_json["recognition_hints"], dict):
        issues.append("recognition_hints 타입 오류")
    
    return {
        "valid": len(issues) == 0,
        "issues": issues
    }

def main():
    print("=" * 80)
    print("part_id 32028 데이터 검증")
    print("=" * 80)
    
    # 실제 벡터 데이터는 사용자가 제공한 텍스트에서 추출해야 함
    # 여기서는 검증 로직만 제공
    
    print("\n[1/4] 기본 정보 검증")
    print(f"  part_id: {sample_data['part_id']}")
    print(f"  color_id: {sample_data['color_id']}")
    print(f"  part_name: {sample_data['part_name']}")
    print(f"  confidence: {sample_data['confidence']}")
    print(f"  usage_frequency: {sample_data['usage_frequency']}")
    
    print("\n[2/4] feature_json 검증")
    fj_result = validate_feature_json(sample_data["feature_json"])
    if fj_result["valid"]:
        print("  [OK] feature_json 정상")
        print(f"    shape_tag: {sample_data['feature_json'].get('shape_tag')}")
        print(f"    stud_count_top: {sample_data['feature_json'].get('stud_count_top')}")
        print(f"    tube_count_bottom: {sample_data['feature_json'].get('tube_count_bottom')}")
    else:
        print("  [ERROR] feature_json 오류:")
        for issue in fj_result["issues"]:
            print(f"    - {issue}")
    
    print("\n[3/4] recognition_hints 검증")
    if "recognition_hints" in sample_data:
        hints = sample_data["recognition_hints"]
        print(f"  [OK] recognition_hints 존재")
        print(f"    ko: {hints.get('ko', 'N/A')[:50]}...")
        print(f"    top_view: {hints.get('top_view', 'N/A')[:50]}...")
        print(f"    unique_features: {hints.get('unique_features', [])}")
    else:
        print("  [ERROR] recognition_hints 누락")
    
    print("\n[4/4] 벡터 검증 (clip_text_emb, semantic_vector)")
    print("  [WARNING]  실제 벡터 데이터는 사용자가 제공한 테이블에서 추출 필요")
    print("  [REPORT] 검증 항목:")
    print("    - 차원 수 (기대: 768)")
    print("    - 제로 벡터 여부 (norm >= 0.01)")
    print("    - semantic_vector 제로 패딩 여부 (후반부 256차원)")
    
    print("\n" + "=" * 80)
    print("검증 완료")
    print("=" * 80)
    
    # 실제 벡터 데이터 파싱 및 검증 스크립트 생성 안내
    print("\n[INFO] 실제 벡터 검증을 위해서는:")
    print("   1. clip_text_emb 배열을 파싱하여 validate_vector() 호출")
    print("   2. semantic_vector 배열을 파싱하여 validate_vector() 호출")
    print("   3. 제로 패딩 여부 확인 (semantic_vector 후반부 256차원)")

if __name__ == "__main__":
    main()


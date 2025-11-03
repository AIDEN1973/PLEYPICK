"""
parts_master_features 테이블에서 part_id = 32028인 레코드의 상세 검증
"""

import json
import sys
import os

# 프로젝트 루트를 경로에 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from scripts.env_integration import get_supabase_config, apply_environment
from supabase import create_client

def parse_vector(vector, field_name):
    """벡터 파싱 (JSON 문자열 또는 배열)"""
    if vector is None:
        return None, f"{field_name}가 NULL입니다"
    
    if isinstance(vector, str):
        try:
            vector = json.loads(vector)
        except json.JSONDecodeError:
            return None, f"{field_name}가 유효한 JSON 문자열이 아닙니다"
    
    if not isinstance(vector, (list, tuple)):
        return None, f"{field_name}가 배열이 아닙니다 (타입: {type(vector)})"
    
    return vector, None

def validate_vector_precise(vector, field_name, expected_dim=768):
    """벡터 정밀 검증"""
    import numpy as np
    
    # 파싱
    parsed_vector, parse_error = parse_vector(vector, field_name)
    if parse_error:
        return {
            "valid": False,
            "error": parse_error
        }
    
    try:
        # numpy 배열로 변환
        v = np.array(parsed_vector, dtype=np.float32)
        
        # 차원 확인
        actual_dim = len(v)
        if actual_dim != expected_dim:
            return {
                "valid": False,
                "error": f"차원 불일치: 예상 {expected_dim}, 실제 {actual_dim}",
                "dimension": actual_dim,
                "expected": expected_dim
            }
        
        # NaN, Infinity 검증
        if np.any(np.isnan(v)):
            nan_count = np.sum(np.isnan(v))
            return {
                "valid": False,
                "error": f"NaN 값 발견: {nan_count}개",
                "nan_count": int(nan_count)
            }
        
        if np.any(np.isinf(v)):
            inf_count = np.sum(np.isinf(v))
            return {
                "valid": False,
                "error": f"Infinity 값 발견: {inf_count}개",
                "inf_count": int(inf_count)
            }
        
        # 데이터 타입 검증 (모든 요소가 숫자인지)
        if not np.all(np.isfinite(v)):
            non_finite_count = np.sum(~np.isfinite(v))
            return {
                "valid": False,
                "error": f"유효하지 않은 값 발견: {non_finite_count}개",
                "non_finite_count": int(non_finite_count)
            }
        
        # 통계 계산
        min_val = float(np.min(v))
        max_val = float(np.max(v))
        mean_val = float(np.mean(v))
        std_val = float(np.std(v))
        
        # L2 norm 계산
        norm = float(np.linalg.norm(v))
        
        # 제로 벡터 검증
        if norm < 0.01:
            return {
                "valid": False,
                "error": f"제로 벡터 (norm={norm:.6f} < 0.01)",
                "norm": norm,
                "dimension": actual_dim,
                "min": min_val,
                "max": max_val,
                "mean": mean_val,
                "std": std_val
            }
        
        # 값 범위 검증 (이상치 체크)
        if abs(min_val) > 10 or abs(max_val) > 10:
            return {
                "valid": False,
                "error": f"값 범위 이상: min={min_val:.4f}, max={max_val:.4f} (예상: -1 ~ 1)",
                "norm": norm,
                "dimension": actual_dim,
                "min": min_val,
                "max": max_val,
                "mean": mean_val,
                "std": std_val
            }
        
        # 768차원 벡터의 경우 앞/뒤 분할 분석 (semantic_vector용)
        result = {
            "valid": True,
            "dimension": actual_dim,
            "norm": norm,
            "min": min_val,
            "max": max_val,
            "mean": mean_val,
            "std": std_val,
            "is_zero_vector": norm < 0.01,
            "is_normalized": 0.9 < norm < 1.1  # L2 정규화 여부 추정
        }
        
        if actual_dim == 768:
            # 앞 512차원 vs 뒤 256차원 분석
            front_512 = v[:512]
            back_256 = v[512:]
            
            front_norm = float(np.linalg.norm(front_512))
            back_norm = float(np.linalg.norm(back_256))
            back_ratio = back_norm / front_norm if front_norm > 0.01 else 0.0
            
            front_mean = float(np.mean(np.abs(front_512)))
            back_mean = float(np.mean(np.abs(back_256)))
            
            result["front_512_norm"] = front_norm
            result["back_256_norm"] = back_norm
            result["back_ratio"] = back_ratio
            result["front_512_mean_abs"] = front_mean
            result["back_256_mean_abs"] = back_mean
            result["has_zero_padding"] = back_ratio < 0.1 and back_mean < 0.001
            
            # 섹션별 통계
            result["front_512_min"] = float(np.min(front_512))
            result["front_512_max"] = float(np.max(front_512))
            result["back_256_min"] = float(np.min(back_256))
            result["back_256_max"] = float(np.max(back_256))
        
        return result
        
    except Exception as e:
        return {
            "valid": False,
            "error": f"검증 실패: {str(e)}"
        }

def validate_feature_json(feature_json):
    """feature_json 구조 검증"""
    if feature_json is None:
        return False, "feature_json이 NULL입니다"
    
    if isinstance(feature_json, str):
        try:
            feature_json = json.loads(feature_json)
        except json.JSONDecodeError:
            return False, "feature_json이 유효한 JSON이 아닙니다"
    
    required_keys = ['shape_tag', 'stud_count_top', 'groove']
    missing_keys = [key for key in required_keys if key not in feature_json]
    
    if missing_keys:
        return False, f"필수 키 누락: {missing_keys}"
    
    return True, "feature_json 구조 정상"

def validate_recognition_hints(hints):
    """recognition_hints 구조 검증"""
    if hints is None:
        return True, "recognition_hints가 NULL (선택 사항)"
    
    if isinstance(hints, str):
        try:
            hints = json.loads(hints)
        except json.JSONDecodeError:
            return False, "recognition_hints가 유효한 JSON이 아닙니다"
    
    if not isinstance(hints, dict):
        return False, "recognition_hints가 객체가 아닙니다"
    
    return True, "recognition_hints 구조 정상"

def main():
    """메인 검증 함수"""
    print("=" * 80)
    print("parts_master_features 테이블 part_id = 32028 상세 검증")
    print("=" * 80)
    
    # 환경 변수 로드
    try:
        apply_environment()
        supabase_config = get_supabase_config()
        supabase_url = supabase_config.get('url')
        supabase_key = supabase_config.get('service_role')
    except Exception as e:
        import os
        supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_SERVICE_ROLE')
    
    if not supabase_url or not supabase_key:
        print("오류: SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다")
        return
    
    # Supabase 클라이언트 생성
    supabase = create_client(supabase_url, supabase_key)
    
    # 데이터 조회
    print("\n[1] 데이터 조회 중...")
    response = supabase.table('parts_master_features').select('*').eq('part_id', '32028').execute()
    
    if not response.data or len(response.data) == 0:
        print("오류: part_id = 32028인 레코드를 찾을 수 없습니다")
        return
    
    record = response.data[0]
    print(f"레코드 조회 성공 (id: {record.get('id')})")
    
    # 검증 결과 저장
    validation_results = []
    
    # 기본 필드 검증
    print("\n[2] 기본 필드 검증...")
    checks = [
        ('part_id', record.get('part_id'), '32028', None),
        ('part_name', record.get('part_name'), None, lambda x: x is not None),
        ('color_id', record.get('color_id'), None, lambda x: x is not None),
        ('confidence', record.get('confidence'), None, lambda x: x is not None and 0 <= x <= 1),
        ('version', record.get('version'), None, lambda x: x is not None and x > 0),
    ]
    
    for check_item in checks:
        if len(check_item) == 4:
            field, value, expected, validator = check_item
        else:
            field, value, expected = check_item[:3]
            validator = None
        
        if expected is not None:
            is_valid = value == expected
            msg = f"{field}: {value} {'정상' if is_valid else f'예상: {expected}'}"
        elif validator:
            is_valid = validator(value)
            msg = f"{field}: {value} {'정상' if is_valid else '이상'}"
        else:
            is_valid = value is not None
            msg = f"{field}: {value} {'정상' if is_valid else 'NULL'}"
        validation_results.append((field, is_valid, msg))
        print(f"  {msg}")
    
    # feature_json 검증
    print("\n[3] feature_json 검증...")
    is_valid, msg = validate_feature_json(record.get('feature_json'))
    validation_results.append(('feature_json', is_valid, msg))
    print(f"  {msg}")
    
    if is_valid:
        feature_json = record.get('feature_json')
        if isinstance(feature_json, str):
            feature_json = json.loads(feature_json)
        
        print(f"  - shape_tag: {feature_json.get('shape_tag')}")
        print(f"  - stud_count_top: {feature_json.get('stud_count_top')}")
        print(f"  - groove: {feature_json.get('groove')}")
        print(f"  - confusions: {feature_json.get('confusions', [])}")
    
    # recognition_hints 검증
    print("\n[4] recognition_hints 검증...")
    is_valid, msg = validate_recognition_hints(record.get('recognition_hints'))
    validation_results.append(('recognition_hints', is_valid, msg))
    print(f"  {msg}")
    
    # 벡터 데이터 정밀 검증
    print("\n[5] 벡터 데이터 정밀 검증...")
    
    # semantic_vector 정밀 검증
    print("\n[5-1] semantic_vector 정밀 검증:")
    semantic_vector = record.get('semantic_vector')
    semantic_result = validate_vector_precise(semantic_vector, 'semantic_vector', 768)
    
    if semantic_result.get('valid'):
        print(f"  차원: {semantic_result['dimension']}")
        print(f"  L2 norm: {semantic_result['norm']:.6f}")
        print(f"  값 범위: min={semantic_result['min']:.6f}, max={semantic_result['max']:.6f}")
        print(f"  통계: mean={semantic_result['mean']:.6f}, std={semantic_result['std']:.6f}")
        print(f"  정규화 여부: {semantic_result.get('is_normalized', False)} (norm={semantic_result['norm']:.6f})")
        
        if 'front_512_norm' in semantic_result:
            print(f"\n  앞 512차원 vs 뒤 256차원 분석:")
            print(f"    앞 512차원 norm: {semantic_result['front_512_norm']:.6f}")
            print(f"    뒤 256차원 norm: {semantic_result['back_256_norm']:.6f}")
            print(f"    뒤/앞 비율: {semantic_result['back_ratio']:.4f}")
            print(f"    앞 512차원 평균 절댓값: {semantic_result['front_512_mean_abs']:.6f}")
            print(f"    뒤 256차원 평균 절댓값: {semantic_result['back_256_mean_abs']:.6f}")
            print(f"    앞 512차원 범위: [{semantic_result['front_512_min']:.6f}, {semantic_result['front_512_max']:.6f}]")
            print(f"    뒤 256차원 범위: [{semantic_result['back_256_min']:.6f}, {semantic_result['back_256_max']:.6f}]")
            
            if semantic_result.get('has_zero_padding'):
                print(f"    [WARNING] 제로 패딩 의심: 뒤 256차원이 매우 작음")
                validation_results.append(('semantic_vector', False, '제로 패딩 의심'))
            else:
                print(f"    정상: 뒤 256차원도 의미있는 값 포함")
                validation_results.append(('semantic_vector', True, f"정상 (norm={semantic_result['norm']:.6f})"))
    else:
        error_msg = semantic_result.get('error', '알 수 없는 오류')
        print(f"  오류: {error_msg}")
        validation_results.append(('semantic_vector', False, error_msg))
    
    # clip_text_emb 정밀 검증
    print("\n[5-2] clip_text_emb 정밀 검증:")
    clip_text_emb = record.get('clip_text_emb')
    clip_result = validate_vector_precise(clip_text_emb, 'clip_text_emb', 768)
    
    if clip_result.get('valid'):
        print(f"  차원: {clip_result['dimension']}")
        print(f"  L2 norm: {clip_result['norm']:.6f}")
        print(f"  값 범위: min={clip_result['min']:.6f}, max={clip_result['max']:.6f}")
        print(f"  통계: mean={clip_result['mean']:.6f}, std={clip_result['std']:.6f}")
        print(f"  정규화 여부: {clip_result.get('is_normalized', False)} (norm={clip_result['norm']:.6f})")
        
        if 'front_512_norm' in clip_result:
            print(f"\n  앞 512차원 vs 뒤 256차원 분석:")
            print(f"    앞 512차원 norm: {clip_result['front_512_norm']:.6f}")
            print(f"    뒤 256차원 norm: {clip_result['back_256_norm']:.6f}")
            print(f"    뒤/앞 비율: {clip_result['back_ratio']:.4f}")
            print(f"    앞 512차원 평균 절댓값: {clip_result['front_512_mean_abs']:.6f}")
            print(f"    뒤 256차원 평균 절댓값: {clip_result['back_256_mean_abs']:.6f}")
            print(f"    앞 512차원 범위: [{clip_result['front_512_min']:.6f}, {clip_result['front_512_max']:.6f}]")
            print(f"    뒤 256차원 범위: [{clip_result['back_256_min']:.6f}, {clip_result['back_256_max']:.6f}]")
            
            if clip_result.get('has_zero_padding'):
                print(f"    [WARNING] 제로 패딩 의심: 뒤 256차원이 매우 작음")
                validation_results.append(('clip_text_emb', False, '제로 패딩 의심'))
            else:
                print(f"    정상: 뒤 256차원도 의미있는 값 포함")
                validation_results.append(('clip_text_emb', True, f"정상 (norm={clip_result['norm']:.6f})"))
    else:
        error_msg = clip_result.get('error', '알 수 없는 오류')
        print(f"  오류: {error_msg}")
        validation_results.append(('clip_text_emb', False, error_msg))
    
    # 추가 필드 검증
    print("\n[6] 추가 필드 검증...")
    
    # similar_parts 검증
    similar_parts = record.get('similar_parts')
    if similar_parts is not None:
        if isinstance(similar_parts, str):
            try:
                similar_parts = json.loads(similar_parts)
            except json.JSONDecodeError:
                similar_parts = None
        is_valid = isinstance(similar_parts, list)
        msg = f"similar_parts: {'정상 (배열)' if is_valid else '이상 (배열이 아님)'}"
        validation_results.append(('similar_parts', is_valid, msg))
        print(f"  {msg}")
    
    # distinguishing_features 검증
    distinguishing_features = record.get('distinguishing_features')
    if distinguishing_features is not None:
        if isinstance(distinguishing_features, str):
            try:
                distinguishing_features = json.loads(distinguishing_features)
            except json.JSONDecodeError:
                distinguishing_features = None
        is_valid = isinstance(distinguishing_features, list)
        msg = f"distinguishing_features: {'정상 (배열)' if is_valid else '이상 (배열이 아님)'}"
        validation_results.append(('distinguishing_features', is_valid, msg))
        print(f"  {msg}")
    
    # detection_accuracy 검증 (0일 수 있음)
    detection_accuracy = record.get('detection_accuracy')
    msg = f"detection_accuracy: {detection_accuracy} {'(정상, 초기값)' if detection_accuracy == 0 else '(업데이트됨)' if detection_accuracy > 0 else '(음수값, 이상)'}"
    is_valid = detection_accuracy >= 0
    validation_results.append(('detection_accuracy', is_valid, msg))
    print(f"  {msg}")
    
    # usage_frequency 검증
    usage_frequency = record.get('usage_frequency')
    msg = f"usage_frequency: {usage_frequency} {'(정상, 초기값)' if usage_frequency == 0 else '(사용됨)' if usage_frequency > 0 else '(음수값, 이상)'}"
    is_valid = usage_frequency >= 0
    validation_results.append(('usage_frequency', is_valid, msg))
    print(f"  {msg}")
    
    # 점수 필드 초기값 검증
    print("\n[7] 점수 필드 초기값 검증...")
    score_fields = [
        'flip_score', 'normal_similarity', 'flipped_similarity', 'semantic_score',
        'round_shape_score', 'center_stud_score', 'groove_score', 'stud_count_score',
        'tube_pattern_score', 'hole_count_score', 'symmetry_score', 'edge_quality_score',
        'texture_score', 'color_score', 'pattern_score', 'voting_total_score'
    ]
    
    score_values = {}
    initial_value_count = 0
    unique_values = set()
    
    for field in score_fields:
        value = record.get(field)
        score_values[field] = value
        if value == 0.50:
            initial_value_count += 1
        unique_values.add(value)
    
    print(f"\n  점수 필드 분석:")
    print(f"    총 점수 필드 수: {len(score_fields)}개")
    print(f"    0.50 값 개수: {initial_value_count}개 ({initial_value_count/len(score_fields)*100:.1f}%)")
    print(f"    고유 값 개수: {len(unique_values)}개")
    print(f"    고유 값 목록: {sorted(unique_values)}")
    
    # 다른 부품들의 점수 필드와 비교 (샘플)
    print(f"\n  비교 분석을 위한 샘플 조회 중...")
    try:
        sample_response = supabase.table('parts_master_features').select(','.join(score_fields)).limit(100).execute()
        
        if sample_response.data and len(sample_response.data) > 1:
            sample_scores = {}
            for field in score_fields:
                sample_values = [r.get(field) for r in sample_response.data if r.get(field) is not None]
                if sample_values:
                    sample_scores[field] = {
                        'mean': sum(sample_values) / len(sample_values),
                        'min': min(sample_values),
                        'max': max(sample_values),
                        'unique_count': len(set(sample_values)),
                        'initial_value_count': sum(1 for v in sample_values if v == 0.50)
                    }
            
            print(f"    샘플 데이터 분석 (총 {len(sample_response.data)}개 레코드):")
            
            initial_value_suspected = []
            for field in score_fields:
                current_value = score_values[field]
                if field in sample_scores:
                    sample_stats = sample_scores[field]
                    is_initial = (
                        current_value == 0.50 and 
                        sample_stats['initial_value_count'] / len(sample_response.data) > 0.8
                    )
                    
                    if is_initial:
                        initial_value_suspected.append(field)
                    
                    print(f"\n    {field}:")
                    print(f"      현재 값: {current_value}")
                    print(f"      샘플 평균: {sample_stats['mean']:.4f}")
                    print(f"      샘플 범위: [{sample_stats['min']:.4f}, {sample_stats['max']:.4f}]")
                    print(f"      샘플 고유값 수: {sample_stats['unique_count']}개")
                    print(f"      샘플에서 0.50 비율: {sample_stats['initial_value_count']/len(sample_response.data)*100:.1f}%")
                    print(f"      초기값 의심: {'예' if is_initial else '아니오'}")
        
    except Exception as e:
        print(f"    샘플 데이터 조회 실패: {e}")
        print(f"    직접 분석 수행...")
    
    # feature_json과 비교하여 실제 계산값인지 확인
    feature_json = record.get('feature_json')
    if feature_json and isinstance(feature_json, dict):
        print(f"\n  feature_json과 점수 필드 대조:")
        
        # groove_score vs feature_json.groove
        if 'groove' in feature_json:
            groove_bool = feature_json['groove']
            groove_score = record.get('groove_score', 0)
            if groove_bool and groove_score == 0.50:
                print(f"    groove_score=0.50 vs feature_json.groove={groove_bool} (불일치 가능성)")
        
        # center_stud_score vs feature_json.center_stud
        if 'center_stud' in feature_json:
            center_stud_bool = feature_json['center_stud']
            center_stud_score = record.get('center_stud_score', 0)
            if center_stud_bool and center_stud_score == 0.50:
                print(f"    center_stud_score=0.50 vs feature_json.center_stud={center_stud_bool} (불일치 가능성)")
        
        # stud_count_score vs feature_json.stud_count_top
        if 'stud_count_top' in feature_json:
            stud_count = feature_json['stud_count_top']
            stud_count_score = record.get('stud_count_score', 0)
            if stud_count > 0 and stud_count_score == 0.50:
                print(f"    stud_count_score=0.50 vs feature_json.stud_count_top={stud_count} (불일치 가능성)")
        
        # semantic_score vs feature_json.feature_text_score
        if 'feature_text_score' in feature_json:
            feature_text_score = feature_json['feature_text_score']
            semantic_score = record.get('semantic_score', 0)
            if abs(feature_text_score - semantic_score) > 0.01:
                print(f"    semantic_score={semantic_score} vs feature_json.feature_text_score={feature_text_score} (불일치)")
            else:
                print(f"    semantic_score={semantic_score} vs feature_json.feature_text_score={feature_text_score} (일치)")
    
    # 최종 판단
    print(f"\n  최종 분석:")
    if initial_value_count == len(score_fields):
        print(f"    [WARNING] 모든 점수 필드가 0.50 (초기값으로 추정)")
        validation_results.append(('score_fields', False, '모든 점수 필드가 초기값(0.50)일 가능성 높음'))
    elif initial_value_count > len(score_fields) * 0.8:
        print(f"    [WARNING] {initial_value_count}/{len(score_fields)} 점수 필드가 0.50 (대부분 초기값)")
        validation_results.append(('score_fields', True, f'{initial_value_count}/{len(score_fields)} 필드가 초기값일 가능성'))
    elif len(unique_values) <= 2:
        print(f"    [WARNING] 고유값이 {len(unique_values)}개만 존재 (초기값일 가능성)")
        validation_results.append(('score_fields', True, f'고유값이 {len(unique_values)}개만 존재'))
    else:
        print(f"    정상: 점수 필드에 다양한 값 분포 (초기값 아님)")
        validation_results.append(('score_fields', True, '점수 필드에 다양한 값 분포'))
    
    # 최종 결과 요약
    print("\n" + "=" * 80)
    print("검증 결과 요약")
    print("=" * 80)
    
    all_valid = all(result[1] for result in validation_results)
    failed_checks = [result for result in validation_results if not result[1]]
    
    if all_valid:
        print("모든 검증 통과: 정상")
    else:
        print(f"검증 실패 항목: {len(failed_checks)}개")
        for field, is_valid, msg in failed_checks:
            print(f"  [실패] {field}: {msg}")
    
    # 통계 정보
    print("\n[통계 정보]")
    print(f"  총 검증 항목: {len(validation_results)}개")
    print(f"  통과: {sum(1 for r in validation_results if r[1])}개")
    print(f"  실패: {len(failed_checks)}개")
    
    return all_valid

if __name__ == '__main__':
    try:
        success = main()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"오류 발생: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
벡터 및 메타데이터 검증 스크립트
"""

import json
import sys
import numpy as np

def is_zero_vector(vector):
    """벡터가 제로벡터인지 확인"""
    if not vector:
        return True
    try:
        arr = np.array(vector, dtype=float)
        return np.allclose(arr, 0.0)
    except:
        return False

def check_vector_stats(vector, name):
    """벡터 통계 출력"""
    if not vector:
        print(f"[오류] {name}: 벡터가 비어있음")
        return False
    
    try:
        arr = np.array(vector, dtype=float)
        print(f"\n[{name}]")
        print(f"  길이: {len(vector)}")
        print(f"  제로벡터 여부: {is_zero_vector(vector)}")
        print(f"  평균: {np.mean(arr):.6f}")
        print(f"  표준편차: {np.std(arr):.6f}")
        print(f"  최소값: {np.min(arr):.6f}")
        print(f"  최대값: {np.max(arr):.6f}")
        print(f"  NaN 개수: {np.sum(np.isnan(arr))}")
        print(f"  Inf 개수: {np.sum(np.isinf(arr))}")
        
        # 제로벡터인 경우
        if is_zero_vector(vector):
            print(f"  [경고] {name}이 제로벡터입니다!")
            return False
        
        return True
    except Exception as e:
        print(f"[오류] {name}: {str(e)}")
        return False

def validate_metadata(data):
    """메타데이터 필드 검증"""
    issues = []
    
    # 필수 메타데이터 필드 확인
    required_fields = [
        'feature_json', 'feature_text', 'recognition_hints',
        'distinguishing_features', 'similar_parts'
    ]
    
    for field in required_fields:
        if field not in data or not data[field]:
            issues.append(f"필수 필드 누락: {field}")
    
    # feature_json 파싱 확인
    if 'feature_json' in data and data['feature_json']:
        try:
            feature_data = json.loads(data['feature_json'])
            if not isinstance(feature_data, dict):
                issues.append("feature_json이 JSON 객체가 아닙니다")
        except json.JSONDecodeError as e:
            issues.append(f"feature_json 파싱 오류: {str(e)}")
    
    # recognition_hints 파싱 확인
    if 'recognition_hints' in data and data['recognition_hints']:
        try:
            hints = json.loads(data['recognition_hints'])
            if not isinstance(hints, dict):
                issues.append("recognition_hints가 JSON 객체가 아닙니다")
        except json.JSONDecodeError as e:
            issues.append(f"recognition_hints 파싱 오류: {str(e)}")
    
    return issues

def main():
    # 사용자 입력 데이터
    input_data = json.loads(sys.stdin.read())
    
    print("=" * 60)
    print("벡터 및 메타데이터 검증")
    print("=" * 60)
    
    # 데이터가 리스트인 경우 첫 번째 항목 사용
    if isinstance(input_data, list):
        data = input_data[0]
    else:
        data = input_data
    
    # 1. CLIP 벡터 확인
    clip_emb = None
    if 'clip_text_emb' in data and data['clip_text_emb']:
        if isinstance(data['clip_text_emb'], str):
            clip_emb = json.loads(data['clip_text_emb'])
        else:
            clip_emb = data['clip_text_emb']
    
    if not clip_emb:
        print("\n[오류] clip_text_emb 필드가 없거나 비어있습니다")
    else:
        check_vector_stats(clip_emb, "CLIP Text Embedding")
    
    # 2. Semantic 벡터 확인
    semantic_vec = None
    if 'semantic_vector' in data and data['semantic_vector']:
        if isinstance(data['semantic_vector'], str):
            semantic_vec = json.loads(data['semantic_vector'])
        else:
            semantic_vec = data['semantic_vector']
    
    if not semantic_vec:
        print("\n[오류] semantic_vector 필드가 없거나 비어있습니다")
    else:
        is_valid = check_vector_stats(semantic_vec, "Semantic Vector")
        # 제로값 패턴 확인
        if semantic_vec:
            arr = np.array(semantic_vec, dtype=float)
            zero_indices = np.where(np.abs(arr) < 1e-10)[0]
            if len(zero_indices) > 0:
                print(f"  제로값(1e-10 이하) 개수: {len(zero_indices)}")
                if len(zero_indices) == len(semantic_vec):
                    print(f"  [경고] semantic_vector가 완전한 제로벡터입니다!")
                elif len(zero_indices) > len(semantic_vec) * 0.5:
                    print(f"  [경고] semantic_vector의 50% 이상이 제로값입니다!")
    
    # 3. 메타데이터 검증
    print("\n" + "=" * 60)
    print("메타데이터 검증")
    print("=" * 60)
    metadata_issues = validate_metadata(data)
    
    if metadata_issues:
        print("\n[이슈 발견]")
        for issue in metadata_issues:
            print(f"  - {issue}")
    else:
        print("\n[정상] 메타데이터 필드가 정상입니다")
    
    # 4. 종합 결과
    print("\n" + "=" * 60)
    print("검증 결과 요약")
    print("=" * 60)
    
    has_issues = False
    
    if clip_emb and is_zero_vector(clip_emb):
        print("[오류] CLIP 벡터가 제로벡터입니다")
        has_issues = True
    
    if semantic_vec:
        arr = np.array(semantic_vec, dtype=float)
        if np.allclose(arr, 0.0):
            print("[오류] Semantic 벡터가 제로벡터입니다")
            has_issues = True
        elif np.sum(np.abs(arr) < 1e-10) > len(arr) * 0.5:
            print("[경고] Semantic 벡터의 대부분이 제로값입니다")
            has_issues = True
    
    if metadata_issues:
        print(f"[경고] 메타데이터 이슈 {len(metadata_issues)}개 발견")
        has_issues = True
    
    if not has_issues:
        print("[정상] 모든 검증 항목이 정상입니다")
    else:
        print("\n[주의] 일부 항목에서 문제가 발견되었습니다")
        sys.exit(1)

if __name__ == "__main__":
    main()


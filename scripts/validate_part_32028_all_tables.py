#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
part_id 32028 기준 모든 테이블 데이터 검증 스크립트
"""

import os
import sys
from pathlib import Path
import json

# 인코딩 설정
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# 프로젝트 루트를 sys.path에 추가
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# 환경변수 관리 시스템 사용
try:
    from scripts.env_integration import get_supabase_config, apply_environment
    ENV_MANAGER_AVAILABLE = True
except ImportError as e:
    ENV_MANAGER_AVAILABLE = False
    print(f"[WARN] 환경변수 관리자를 사용할 수 없습니다: {e}")
    print(f"[WARN] 기본 환경변수를 사용합니다.")

# Supabase 클라이언트
try:
    from supabase import create_client
except ImportError:
    print("[ERROR] Supabase 클라이언트가 설치되지 않았습니다.")
    print("다음 명령어로 설치하세요: pip install supabase")
    sys.exit(1)

def setup_supabase():
    """Supabase 클라이언트 설정 (환경변수 관리 시스템 사용)"""
    if ENV_MANAGER_AVAILABLE:
        # 환경변수 적용
        apply_environment()
        # 환경변수 관리 시스템에서 설정 가져오기
        supabase_config = get_supabase_config()
        url = supabase_config.get('url')
        key = supabase_config.get('service_role')
        
        if not url or not key:
            print(f"[ERROR] 환경변수 관리 시스템에서 Supabase 설정을 찾을 수 없습니다.")
            raise ValueError("Supabase configuration not found in environment manager")
    else:
        # 폴백: 기본 환경변수 사용
        url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
        key = (
            os.getenv('SUPABASE_SERVICE_ROLE_KEY')
            or os.getenv('VITE_SUPABASE_SERVICE_ROLE')
            or os.getenv('SUPABASE_KEY')
        )
        
        if not url or not key:
            print(f"[ERROR] 환경변수에서 Supabase 설정을 찾을 수 없습니다.")
            raise ValueError("Supabase configuration not found in environment variables")
    
    print(f"[OK] Supabase URL: {url}")
    print(f"[OK] Key: {key[:20]}...")
    
    # API 키 유효성 검증
    if not key or len(key) < 50:
        print(f"[ERROR] 유효하지 않은 API 키 (길이: {len(key) if key else 0})")
        raise ValueError("Invalid API key")
    
    try:
        client = create_client(url, key)
        # 간단한 연결 테스트
        test_response = client.table('model_registry').select('id').limit(1).execute()
        print(f"[OK] Supabase 연결 성공")
        return client
    except Exception as e:
        print(f"[ERROR] Supabase 연결 실패: {e}")
        raise

def validate_vector(vector, name, expected_dim=768):
    """벡터 검증"""
    try:
        import numpy as np
        
        if not vector or not isinstance(vector, (list, tuple)):
            return {
                "valid": False,
                "error": f"{name}: 벡터가 없거나 유효하지 않음"
            }
        
        v = np.array(vector, dtype=np.float32)
        
        # 차원 확인
        if len(v) != expected_dim:
            return {
                "valid": False,
                "dimension": len(v),
                "expected": expected_dim,
                "error": f"{name}: 차원 불일치 ({len(v)} != {expected_dim})"
            }
        
        # 제로 벡터 검증
        norm = np.linalg.norm(v)
        if norm < 0.01:
            return {
                "valid": False,
                "norm": float(norm),
                "error": f"{name}: 제로 벡터 (norm={norm:.6f} < 0.01)"
            }
        
        # 벡터 통계
        min_val = float(np.min(v))
        max_val = float(np.max(v))
        mean_val = float(np.mean(v))
        std_val = float(np.std(v))
        
        # 후반부 제로 패딩 검증 (768차원인 경우)
        if len(v) == 768:
            front_512 = v[:512]
            back_256 = v[512:]
            front_norm = np.linalg.norm(front_512)
            back_norm = np.linalg.norm(back_256)
            back_ratio = back_norm / front_norm if front_norm > 0.01 else 0.0
            
            return {
                "valid": True,
                "dimension": len(v),
                "norm": float(norm),
                "min": min_val,
                "max": max_val,
                "mean": mean_val,
                "std": std_val,
                "front_512_norm": float(front_norm),
                "back_256_norm": float(back_norm),
                "back_ratio": float(back_ratio),
                "has_zero_padding": back_ratio < 0.1 and back_norm < 0.1
            }
        else:
            return {
                "valid": True,
                "dimension": len(v),
                "norm": float(norm),
                "min": min_val,
                "max": max_val,
                "mean": mean_val,
                "std": std_val
            }
            
    except Exception as e:
        return {
            "valid": False,
            "error": f"{name}: 검증 실패 ({str(e)})"
        }

def validate_feature_json(feature_json):
    """feature_json 검증"""
    if not feature_json:
        return {"valid": False, "issues": ["feature_json이 없음"]}
    
    issues = []
    
    # 필수 필드 확인
    if isinstance(feature_json, dict):
        required_fields = ["shape_tag"]
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
            issues.append("recognition_hints 필드 누락 (선택적)")
    
    return {
        "valid": len(issues) == 0,
        "issues": issues
    }

def main():
    part_id = '32028'
    
    print("=" * 80)
    print(f"part_id {part_id} 전체 테이블 데이터 검증")
    print("=" * 80)
    
    supabase = setup_supabase()
    
    all_valid = True
    results = {}
    
    # 1. lego_parts 테이블 검증
    print(f"\n[1/6] lego_parts 테이블 검증")
    try:
        response = supabase.table('lego_parts').select('*').eq('part_num', part_id).limit(10).execute()
        
        if hasattr(response, 'error') and response.error:
            print(f"  [ERROR] 조회 실패: {response.error}")
            all_valid = False
            results['lego_parts'] = {"valid": False, "error": str(response.error)}
        elif not response.data or len(response.data) == 0:
            print(f"  [WARN] 부품 정보 없음 (정상일 수 있음)")
            results['lego_parts'] = {"valid": True, "count": 0, "note": "데이터 없음"}
        else:
            print(f"  [OK] 부품 정보 존재: {len(response.data)}개")
            for part in response.data:
                print(f"    - part_num: {part.get('part_num')}, name: {part.get('name', 'N/A')[:50]}")
            results['lego_parts'] = {"valid": True, "count": len(response.data)}
    except Exception as e:
        print(f"  [ERROR] 검증 실패: {e}")
        import traceback
        traceback.print_exc()
        all_valid = False
        results['lego_parts'] = {"valid": False, "error": str(e)}
    
    # 2. parts_master_features 테이블 검증
    print(f"\n[2/6] parts_master_features 테이블 검증")
    try:
        response = supabase.table('parts_master_features').select('*').eq('part_id', part_id).limit(100).execute()
        
        if hasattr(response, 'error') and response.error:
            print(f"  [ERROR] 조회 실패: {response.error}")
            all_valid = False
            results['parts_master_features'] = {"valid": False, "error": str(response.error)}
        elif not response.data or len(response.data) == 0:
            print(f"  [WARN] AI 메타데이터 없음 (LLM 분석 필요)")
            results['parts_master_features'] = {"valid": False, "error": "데이터 없음"}
            all_valid = False
        else:
            print(f"  [OK] AI 메타데이터 존재: {len(response.data)}개 색상")
            
            valid_count = 0
            invalid_count = 0
            
            for record in response.data:
                color_id = record.get('color_id', 'N/A')
                print(f"\n  색상 ID {color_id} 검증:")
                
                # 벡터 데이터 파싱 (JSON 문자열인 경우 처리)
                clip_text_emb_raw = record.get('clip_text_emb')
                semantic_vector_raw = record.get('semantic_vector')
                
                # 디버깅: 실제 데이터 타입 확인
                print(f"    [DEBUG] clip_text_emb 타입: {type(clip_text_emb_raw)}")
                if clip_text_emb_raw:
                    if isinstance(clip_text_emb_raw, str):
                        print(f"    [DEBUG] clip_text_emb는 문자열입니다. 파싱 시도...")
                        try:
                            clip_text_emb_raw = json.loads(clip_text_emb_raw)
                            print(f"    [DEBUG] 파싱 성공: {type(clip_text_emb_raw)}, 길이: {len(clip_text_emb_raw) if isinstance(clip_text_emb_raw, (list, tuple)) else 'N/A'}")
                        except:
                            print(f"    [DEBUG] JSON 파싱 실패")
                
                print(f"    [DEBUG] semantic_vector 타입: {type(semantic_vector_raw)}")
                if semantic_vector_raw:
                    if isinstance(semantic_vector_raw, str):
                        print(f"    [DEBUG] semantic_vector는 문자열입니다. 파싱 시도...")
                        try:
                            semantic_vector_raw = json.loads(semantic_vector_raw)
                            print(f"    [DEBUG] 파싱 성공: {type(semantic_vector_raw)}, 길이: {len(semantic_vector_raw) if isinstance(semantic_vector_raw, (list, tuple)) else 'N/A'}")
                        except:
                            print(f"    [DEBUG] JSON 파싱 실패")
                
                # feature_json 검증
                fj_result = validate_feature_json(record.get('feature_json'))
                if fj_result['valid']:
                    print(f"    [OK] feature_json: 정상")
                    if isinstance(record.get('feature_json'), dict):
                        print(f"      shape_tag: {record.get('feature_json', {}).get('shape_tag', 'N/A')}")
                        print(f"      stud_count_top: {record.get('feature_json', {}).get('stud_count_top', 'N/A')}")
                else:
                    print(f"    [ERROR] feature_json: {', '.join(fj_result['issues'])}")
                
                # clip_text_emb 검증 (파싱된 데이터 사용)
                clip_result = validate_vector(clip_text_emb_raw, "clip_text_emb")
                if clip_result.get('valid'):
                    print(f"    [OK] clip_text_emb: 정상 (norm={clip_result.get('norm', 0):.4f})")
                else:
                    print(f"    [ERROR] clip_text_emb: {clip_result.get('error', '검증 실패')}")
                
                # semantic_vector 검증 (파싱된 데이터 사용)
                semantic_result = validate_vector(semantic_vector_raw, "semantic_vector")
                if semantic_result.get('valid'):
                    print(f"    [OK] semantic_vector: 정상 (norm={semantic_result.get('norm', 0):.4f})")
                    if semantic_result.get('has_zero_padding'):
                        print(f"      [WARN] 제로 패딩 의심 (back_256_norm={semantic_result.get('back_256_norm', 0):.6f})")
                else:
                    print(f"    [ERROR] semantic_vector: {semantic_result.get('error', '검증 실패')}")
                
                # recognition_hints 검증
                if record.get('recognition_hints'):
                    print(f"    [OK] recognition_hints: 존재")
                else:
                    print(f"    [WARN] recognition_hints: 없음 (선택적)")
                
                # 종합 판단
                record_valid = (
                    fj_result['valid'] and
                    clip_result.get('valid') and
                    semantic_result.get('valid')
                )
                
                if record_valid:
                    valid_count += 1
                else:
                    invalid_count += 1
            
            results['parts_master_features'] = {
                "valid": invalid_count == 0,
                "total": len(response.data),
                "valid_count": valid_count,
                "invalid_count": invalid_count
            }
            
            if invalid_count > 0:
                all_valid = False
                print(f"\n  [WARN] 일부 데이터 문제: {invalid_count}/{len(response.data)}개 색상")
            
    except Exception as e:
        print(f"  [ERROR] 검증 실패: {e}")
        import traceback
        traceback.print_exc()
        all_valid = False
        results['parts_master_features'] = {"valid": False, "error": str(e)}
    
    # 3. synthetic_dataset 테이블 검증
    print(f"\n[3/6] synthetic_dataset 테이블 검증")
    try:
        response = supabase.table('synthetic_dataset').select('*').eq('part_id', part_id).limit(20).order('created_at', desc=True).execute()
        
        if hasattr(response, 'error') and response.error:
            print(f"  [ERROR] 조회 실패: {response.error}")
            all_valid = False
            results['synthetic_dataset'] = {"valid": False, "error": str(response.error)}
        elif not response.data or len(response.data) == 0:
            print(f"  [WARN] 합성 렌더링 데이터 없음 (정상일 수 있음)")
            results['synthetic_dataset'] = {"valid": True, "count": 0, "note": "데이터 없음 (정상)"}
        else:
            print(f"  [OK] 합성 렌더링 데이터 존재: {len(response.data)}개")
            
            valid_metadata = 0
            invalid_metadata = 0
            
            for record in response.data[:5]:  # 최근 5개만 상세 검증
                metadata = record.get('metadata')
                if metadata:
                    if isinstance(metadata, str):
                        try:
                            metadata = json.loads(metadata)
                        except:
                            pass
                    
                    if isinstance(metadata, dict):
                        if 'quality_metrics' in metadata:
                            qm = metadata['quality_metrics']
                            print(f"    - schema_version: {metadata.get('schema_version', 'N/A')}")
                            print(f"      SSIM: {qm.get('ssim', 'N/A')}")
                            print(f"      SNR: {qm.get('snr', 'N/A')}")
                            print(f"      reprojection_rms_px: {qm.get('reprojection_rms_px', 'N/A')}")
                            print(f"      depth_score: {qm.get('depth_score', 'N/A')}")
                            valid_metadata += 1
                        else:
                            print(f"    [WARN] quality_metrics 없음")
                            invalid_metadata += 1
                    else:
                        invalid_metadata += 1
                else:
                    print(f"    [WARN] metadata 없음")
                    invalid_metadata += 1
            
            results['synthetic_dataset'] = {
                "valid": True,
                "count": len(response.data),
                "valid_metadata": valid_metadata,
                "invalid_metadata": invalid_metadata
            }
            
    except Exception as e:
        print(f"  [ERROR] 검증 실패: {e}")
        import traceback
        traceback.print_exc()
        all_valid = False
        results['synthetic_dataset'] = {"valid": False, "error": str(e)}
    
    # 4. set_parts 테이블 검증 (part_id 32028이 포함된 세트)
    print(f"\n[4/6] set_parts 테이블 검증 (part_id {part_id} 포함 세트)")
    try:
        # 관계 조인 없이 먼저 조회
        response = supabase.table('set_parts').select('*').eq('part_id', part_id).limit(20).execute()
        
        if hasattr(response, 'error') and response.error:
            print(f"  [ERROR] 조회 실패: {response.error}")
            all_valid = False
            results['set_parts'] = {"valid": False, "error": str(response.error)}
        elif not response.data or len(response.data) == 0:
            print(f"  [WARN] 세트 관계 없음 (정상일 수 있음)")
            results['set_parts'] = {"valid": True, "count": 0, "note": "세트 관계 없음"}
        else:
            print(f"  [OK] 세트 관계 존재: {len(response.data)}개")
            
            # 세트 정보 별도 조회
            set_ids = list(set([sp.get('set_id') for sp in response.data if sp.get('set_id')]))
            
            if set_ids:
                try:
                    set_response = supabase.table('lego_sets').select('id, set_num, name').in_('id', set_ids).execute()
                    sets_dict = {s['id']: s for s in (set_response.data or [])}
                except:
                    sets_dict = {}
            else:
                sets_dict = {}
            
            for sp in response.data[:5]:  # 최근 5개만 출력
                set_id = sp.get('set_id')
                set_info = sets_dict.get(set_id, {}) if set_id else {}
                print(f"    - set_id: {set_id}, 세트: {set_info.get('set_num', 'N/A')} ({set_info.get('name', 'N/A')[:30]})")
                print(f"      element_id: {sp.get('element_id', 'N/A')}, 수량: {sp.get('quantity', 0)}개, color_id: {sp.get('color_id', 'N/A')}")
            
            results['set_parts'] = {"valid": True, "count": len(response.data)}
            
    except Exception as e:
        print(f"  [ERROR] 검증 실패: {e}")
        import traceback
        traceback.print_exc()
        all_valid = False
        results['set_parts'] = {"valid": False, "error": str(e)}
    
    # 5. model_registry 검증 (part_id와 직접 관계 없지만, 활성 모델 확인)
    print(f"\n[5/6] model_registry 테이블 검증 (활성 모델 확인)")
    try:
        response = supabase.table('model_registry').select('*').eq('status', 'active').limit(5).order('created_at', desc=True).execute()
        
        if hasattr(response, 'error') and response.error:
            print(f"  [ERROR] 조회 실패: {response.error}")
            results['model_registry'] = {"valid": False, "error": str(response.error)}
        elif not response.data or len(response.data) == 0:
            print(f"  [WARN] 활성 모델 없음")
            results['model_registry'] = {"valid": False, "count": 0, "note": "활성 모델 없음"}
        else:
            print(f"  [OK] 활성 모델 존재: {len(response.data)}개")
            for model in response.data:
                print(f"    - {model.get('model_name', 'N/A')} (v{model.get('version', 'N/A')})")
                print(f"      stage: {model.get('model_stage', 'N/A')}, URL: {model.get('model_url', 'N/A')[:50]}...")
            results['model_registry'] = {"valid": True, "count": len(response.data)}
            
    except Exception as e:
        print(f"  [ERROR] 검증 실패: {e}")
        import traceback
        traceback.print_exc()
        results['model_registry'] = {"valid": False, "error": str(e)}
    
    # 6. 종합 검증 결과
    print(f"\n[6/6] 종합 검증 결과")
    print("=" * 80)
    
    print("\n[REPORT] 테이블별 검증 결과:")
    for table, result in results.items():
        status = "[OK]" if result.get('valid') else "[ERROR]"
        print(f"  {status} {table}: {result}")
    
    print(f"\n{'=' * 80}")
    if all_valid:
        print("[OK] 전체 검증 통과")
    else:
        print("[ERROR] 일부 검증 실패 - 위 결과를 확인하세요")
    print("=" * 80)
    
    return results

if __name__ == "__main__":
    main()


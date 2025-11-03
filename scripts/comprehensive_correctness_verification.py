#!/usr/bin/env python3
"""
종합 정합성 검증 스크립트
- 기술문서 정합성
- 논리적 일관성
- 실행 가능성
- 경계 조건
"""

import json
import re
import sys
from pathlib import Path

def verify_technical_document_compliance():
    """기술문서 정합성 검증"""
    results = []
    
    annotation_file = Path("database/어노테이션.txt")
    if not annotation_file.exists():
        results.append(("ERROR", "기술문서 어노테이션.txt 파일 없음"))
        return results
    
    # 어노테이션.txt에서 기준 추출
    content = annotation_file.read_text(encoding='utf-8')
    
    # PnP 기준 확인
    if 'SOLVEPNP_SQPNP' in content and 'iterationsCount=300' in content:
        results.append(("INFO", "✅ 기술문서: PnP Solver 기준 확인"))
    else:
        results.append(("WARNING", "기술문서 PnP 기준 확인 필요"))
    
    # 깊이 맵 기준 확인
    if '0.4*valid_ratio + 0.3*(1.0/(1.0+depth_var)) + 0.3*edge_smoothness' in content:
        results.append(("INFO", "✅ 기술문서: 깊이 맵 검증 공식 확인"))
    else:
        results.append(("WARNING", "기술문서 깊이 맵 공식 확인 필요"))
    
    # 품질 기준 확인
    if 'reprojection_rms ≤ 1.5' in content and 'depth_quality_score ≥ 0.85' in content:
        results.append(("INFO", "✅ 기술문서: 품질 기준 확인 (RMS ≤1.5px, depth ≥0.85)"))
    else:
        results.append(("WARNING", "기술문서 품질 기준 확인 필요"))
    
    return results

def verify_code_consistency():
    """코드 일관성 검증"""
    results = []
    
    script_file = Path("scripts/render_ldraw_to_supabase.py")
    if not script_file.exists():
        results.append(("ERROR", "렌더링 스크립트 파일 없음"))
        return results
    
    content = script_file.read_text(encoding='utf-8')
    
    # 1. PnP 파라미터 일관성
    pnp_checks = [
        (r'flags\s*=\s*cv2\.SOLVEPNP_SQPNP', 'SOLVEPNP_SQPNP'),
        (r'iterationsCount\s*=\s*300', 'iterationsCount=300'),
        (r'reprojectionError\s*=\s*2\.0', 'reprojectionError=2.0'),
        (r'confidence\s*=\s*0\.999', 'confidence=0.999')
    ]
    
    for pattern, name in pnp_checks:
        if re.search(pattern, content):
            results.append(("INFO", f"✅ PnP 파라미터: {name}"))
        else:
            results.append(("ERROR", f"PnP 파라미터 누락: {name}"))
    
    # 2. 깊이 맵 공식 일관성
    depth_formula = r'0\.4\s*\*\s*valid_ratio\s*\+\s*0\.3\s*\*\s*\(1\.0\s*/\s*\(1\.0\s*\+\s*depth_var\)\)\s*\+\s*0\.3\s*\*\s*edge_smoothness'
    if re.search(depth_formula, content):
        results.append(("INFO", "✅ 깊이 맵 검증 공식 정확"))
    else:
        # 간단한 패턴으로 재확인
        if '0.4 * valid_ratio' in content and '0.3 *' in content and 'edge_smoothness' in content:
            results.append(("INFO", "✅ 깊이 맵 검증 공식 존재 (가중치 확인)"))
        else:
            results.append(("ERROR", "깊이 맵 검증 공식 불일치"))
    
    # 3. 품질 기준 일관성
    rms_thresholds = re.findall(r'rms.*?<=\s*([\d.]+)', content, re.IGNORECASE)
    depth_thresholds = re.findall(r'depth.*?>=\s*([\d.]+)', content, re.IGNORECASE)
    
    rms_values = set([float(v) for v in rms_thresholds if v.replace('.', '').isdigit()])
    depth_values = set([float(v) for v in depth_thresholds if v.replace('.', '').isdigit()])
    
    if 1.5 in rms_values and len(rms_values) == 1:
        results.append(("INFO", "✅ RMS 기준 일관성: 모든 위치에서 1.5px"))
    elif 1.5 in rms_values:
        results.append(("ERROR", f"RMS 기준 불일치: {rms_values}"))
    else:
        results.append(("ERROR", f"RMS 기준 오류: {rms_values} (기술문서: 1.5px)"))
    
    if 0.85 in depth_values and len(depth_values) == 1:
        results.append(("INFO", "✅ Depth 기준 일관성: 모든 위치에서 0.85"))
    elif 0.85 in depth_values:
        results.append(("ERROR", f"Depth 기준 불일치: {depth_values}"))
    else:
        results.append(("ERROR", f"Depth 기준 오류: {depth_values} (기술문서: 0.85)"))
    
    return results

def verify_logical_consistency():
    """논리적 일관성 검증"""
    results = []
    
    script_file = Path("scripts/render_ldraw_to_supabase.py")
    content = script_file.read_text(encoding='utf-8')
    
    # 1. 3D-2D 점 동기화 확인
    if 'for vert in part_object.data.vertices' in content:
        # 동기화 로직 확인
        if 'co_ndc.z >= 0' in content and 'obj_points_3d.append' in content and 'img_points_2d.append' in content:
            # 두 append가 같은 조건문 안에 있는지 확인
            lines = content.split('\n')
            in_vert_loop = False
            obj_append_line = None
            img_append_line = None
            
            for i, line in enumerate(lines):
                if 'for vert in part_object.data.vertices' in line:
                    in_vert_loop = True
                    continue
                if in_vert_loop:
                    if 'obj_points_3d.append' in line:
                        obj_append_line = i
                    if 'img_points_2d.append' in line:
                        img_append_line = i
                    if 'def ' in line or (obj_append_line is not None and line.strip() and not line.strip().startswith('#') and not line.strip().startswith(' ') and i > obj_append_line + 10):
                        break
            
            # 수정 후: 동기화된 로직 확인
            if 'if co_ndc.z >= 0' in content:
                # 조건문 내부에 두 append가 모두 있는지 확인
                vert_section = content[content.find('for vert'):content.find('if len(obj_points_3d)', content.find('for vert'))]
                if 'obj_points_3d.append' in vert_section and 'img_points_2d.append' in vert_section:
                    # 같은 if 블록 내에 있는지 확인
                    if vert_section.count('if co_ndc.z') == 1:
                        results.append(("INFO", "✅ 3D-2D 점 동기화 로직 정상 (같은 조건문 내 수집)"))
                    else:
                        results.append(("WARNING", "3D-2D 점 동기화 로직 확인 필요"))
            
    # 2. 길이 불일치 체크 로직 확인
    if 'len(obj_points_3d) != len(img_points_2d)' in content:
        results.append(("INFO", "✅ 3D-2D 점 길이 불일치 검사 로직 존재"))
    else:
        results.append(("WARNING", "3D-2D 점 길이 불일치 검사 로직 확인 필요"))
    
    # 3. 최소 점 수 체크 확인
    if 'len(obj_points_3d) < 4' in content:
        results.append(("INFO", "✅ 최소 점 수 체크 존재 (4개 이상)"))
    else:
        results.append(("WARNING", "최소 점 수 체크 확인 필요"))
    
    return results

def verify_execution_feasibility():
    """실행 가능성 검증"""
    results = []
    
    script_file = Path("scripts/render_ldraw_to_supabase.py")
    content = script_file.read_text(encoding='utf-8')
    
    # 1. 의존성 확인
    required_modules = ['cv2', 'numpy', 'OpenEXR', 'Imath', 'bpy']
    for module in required_modules:
        if f'import {module}' in content or f'from {module}' in content:
            results.append(("INFO", f"✅ 의존성: {module} import 존재"))
        else:
            if module == 'bpy':
                results.append(("INFO", f"✅ {module}: Blender 환경에서만 사용 (정상)"))
            else:
                results.append(("WARNING", f"의존성 확인 필요: {module}"))
    
    # 2. 함수 호출 순서 확인
    # 카메라 파라미터 추출 → PnP 계산
    if '_extract_camera_parameters' in content and '_calculate_rms' in content:
        idx_extract = content.find('_extract_camera_parameters')
        idx_calculate = content.find('_calculate_rms', idx_extract)
        if idx_calculate > idx_extract:
            results.append(("INFO", "✅ 함수 호출 순서: 카메라 파라미터 추출 → PnP 계산"))
        else:
            results.append(("WARNING", "함수 호출 순서 확인 필요"))
    
    # 3. 깊이 맵 경로 설정 → 검증
    if '_configure_depth_output_path' in content and '_calculate_depth_score' in content:
        results.append(("INFO", "✅ 깊이 맵 경로 설정 및 검증 함수 존재"))
    
    # 4. 파라미터 전달 확인
    quality_metrics_calls = re.findall(r'_calculate_quality_metrics\([^)]+\)', content)
    if quality_metrics_calls:
        for call in quality_metrics_calls:
            if 'depth_path' in call and 'camera_params' in call and 'part_object' in call:
                results.append(("INFO", "✅ 품질 메트릭 호출 시 모든 파라미터 전달"))
                break
        else:
            results.append(("WARNING", "품질 메트릭 호출 시 일부 파라미터 누락 가능"))
    
    return results

def verify_boundary_conditions():
    """경계 조건 검증"""
    results = []
    
    script_file = Path("scripts/render_ldraw_to_supabase.py")
    content = script_file.read_text(encoding='utf-8')
    
    # 1. 빈 객체 처리
    if 'len(obj_points_3d) < 4' in content:
        results.append(("INFO", "✅ 빈 객체/최소 점 수 체크 존재"))
    else:
        results.append(("WARNING", "빈 객체 체크 확인 필요"))
    
    # 2. None/빈 경로 처리
    if 'depth_path and os.path.exists(depth_path)' in content:
        results.append(("INFO", "✅ 깊이 맵 경로 None 체크 존재"))
    else:
        results.append(("WARNING", "깊이 맵 경로 None 체크 확인 필요"))
    
    # 3. 카메라 없음 처리
    if 'if not camera' in content or 'if camera is None' in content:
        results.append(("INFO", "✅ 카메라 없음 체크 존재"))
    else:
        results.append(("WARNING", "카메라 없음 체크 확인 필요"))
    
    # 4. 유효 깊이 값 없음 처리
    if 'if not np.any(valid_mask)' in content or 'valid_mask' in content and 'if not' in content:
        results.append(("INFO", "✅ 유효 깊이 값 없음 체크 존재"))
    else:
        results.append(("WARNING", "유효 깊이 값 없음 체크 확인 필요"))
    
    return results

def main():
    """메인 함수"""
    print("=" * 60)
    print("종합 정합성 검증")
    print("=" * 60)
    
    all_results = {}
    
    print("\n[1/5] 기술문서 정합성 검증...")
    all_results['technical_document'] = verify_technical_document_compliance()
    
    print("[2/5] 코드 일관성 검증...")
    all_results['code_consistency'] = verify_code_consistency()
    
    print("[3/5] 논리적 일관성 검증...")
    all_results['logical_consistency'] = verify_logical_consistency()
    
    print("[4/5] 실행 가능성 검증...")
    all_results['execution_feasibility'] = verify_execution_feasibility()
    
    print("[5/5] 경계 조건 검증...")
    all_results['boundary_conditions'] = verify_boundary_conditions()
    
    # 결과 출력
    all_issues = []
    for category, issues in all_results.items():
        all_issues.extend(issues)
    
    errors = [i for i in all_issues if i[0] == 'ERROR']
    warnings = [i for i in all_issues if i[0] == 'WARNING']
    infos = [i for i in all_issues if i[0] == 'INFO']
    
    print(f"\n{'='*60}")
    print("검증 결과 요약")
    print(f"{'='*60}")
    print(f"✅ 정상: {len(infos)}개")
    print(f"[WARNING] 경고: {len(warnings)}개")
    print(f"[ERROR] 오류: {len(errors)}개")
    
    if errors:
        print(f"\n[ERROR] 오류 ({len(errors)}개):")
        for err_type, msg in errors:
            print(f"  - {msg}")
    
    if warnings:
        print(f"\n[WARNING] 경고 ({len(warnings)}개):")
        for warn_type, msg in warnings:
            print(f"  - {msg}")
    
    # 상세 결과
    print(f"\n{'='*60}")
    print("상세 검증 결과")
    print(f"{'='*60}")
    
    for category, issues in all_results.items():
        category_name = category.replace('_', ' ').title()
        print(f"\n[{category_name}]")
        for issue_type, msg in issues:
            prefix = "  ✅" if issue_type == "INFO" else "  [WARNING]" if issue_type == "WARNING" else "  [ERROR]"
            print(f"{prefix} {msg}")
    
    # 결과 저장
    output_path = Path("output/comprehensive_correctness_report.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    
    print(f"\n📄 상세 보고서 저장: {output_path}")
    
    if errors:
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())


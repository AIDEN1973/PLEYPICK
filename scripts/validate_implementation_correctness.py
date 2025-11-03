#!/usr/bin/env python3
"""
오늘 수정사항 정밀 검증 스크립트
- 코드 정합성 검증
- 기술문서 준수 확인
- 논리적 오류 분석
- 데이터 흐름 검증
"""

import ast
import re
import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Any

class ImplementationValidator:
    """구현 정합성 검증 클래스"""
    
    def __init__(self):
        self.errors = []
        self.warnings = []
        self.info = []
        
    def validate_pnp_implementation(self, file_path: str) -> List[Tuple[str, str]]:
        """PnP 재투영 RMS 구현 검증"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            issues.append(("ERROR", f"파일 읽기 실패: {e}"))
            return issues
        
        # 기술문서 기준 (어노테이션.txt:260-269)
        # method=cv2.SOLVEPNP_SQPNP
        # iterationsCount=300
        # reprojectionError=2.0
        # confidence=0.999
        
        # 1. SOLVEPNP_SQPNP 사용 확인
        if 'cv2.SOLVEPNP_SQPNP' not in content and 'SOLVEPNP_SQPNP' not in content:
            issues.append(("WARNING", "PnP Solver method가 기술문서와 다를 수 있음 (SOLVEPNP_SQPNP 확인 필요)"))
        elif 'flags=cv2.SOLVEPNP_SQPNP' in content:
            issues.append(("INFO", "✅ PnP Solver method: SOLVEPNP_SQPNP (기술문서 준수)"))
        
        # 2. iterationsCount=300 확인
        if 'iterationsCount=300' not in content and 'iterationsCount=iters' not in content:
            if 'iterationsCount' in content:
                match = re.search(r'iterationsCount\s*=\s*(\d+)', content)
                if match:
                    iters = int(match.group(1))
                    if iters != 300:
                        issues.append(("WARNING", f"iterationsCount가 300이 아님: {iters}"))
                    else:
                        issues.append(("INFO", f"✅ iterationsCount: {iters} (기술문서 준수)"))
        else:
            issues.append(("INFO", "✅ iterationsCount: 300 (기술문서 준수)"))
        
        # 3. reprojectionError=2.0 확인
        if 'reprojectionError=2.0' in content:
            issues.append(("INFO", "✅ reprojectionError: 2.0 (기술문서 준수)"))
        elif 'reprojectionError' in content:
            match = re.search(r'reprojectionError\s*=\s*([\d.]+)', content)
            if match:
                error_thresh = float(match.group(1))
                if error_thresh != 2.0:
                    issues.append(("WARNING", f"reprojectionError가 2.0이 아님: {error_thresh}"))
        
        # 4. confidence=0.999 확인
        if 'confidence=0.999' in content:
            issues.append(("INFO", "✅ confidence: 0.999 (기술문서 준수)"))
        elif 'confidence' in content:
            match = re.search(r'confidence\s*=\s*([\d.]+)', content)
            if match:
                conf = float(match.group(1))
                if conf != 0.999:
                    issues.append(("WARNING", f"confidence가 0.999가 아님: {conf}"))
        
        # 5. 재투영 오차 계산 방식 확인
        if 'cv2.projectPoints' in content and 'np.linalg.norm' in content:
            issues.append(("INFO", "✅ 재투영 오차 계산 방식 정상 (cv2.projectPoints + np.linalg.norm)"))
        else:
            issues.append(("ERROR", "재투영 오차 계산 방식이 기술문서와 다름"))
        
        return issues
    
    def validate_depth_map_implementation(self, file_path: str) -> List[Tuple[str, str]]:
        """깊이 맵 검증 구현 검증"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            issues.append(("ERROR", f"파일 읽기 실패: {e}"))
            return issues
        
        # 기술문서 기준 (어노테이션.txt:287-303)
        # score = 0.4*valid_ratio + 0.3*(1.0/(1.0+depth_var)) + 0.3*edge_smoothness
        
        # 1. 가중치 확인
        weight_pattern = r'0\.4\s*\*\s*valid_ratio|valid_ratio\s*\*\s*0\.4'
        if not re.search(weight_pattern, content):
            issues.append(("ERROR", "valid_ratio 가중치가 0.4가 아님"))
        else:
            issues.append(("INFO", "✅ valid_ratio 가중치: 0.4 (기술문서 준수)"))
        
        # 2. depth_var 가중치 확인
        depth_var_pattern = r'0\.3\s*\*\s*\(1\.0\s*/\s*\(1\.0\s*\+\s*depth_var\)\)'
        if not re.search(depth_var_pattern, content):
            # 다른 형식으로도 확인
            if '1.0 / (1.0 + depth_var)' in content and '0.3 *' in content:
                issues.append(("INFO", "✅ depth_var 가중치: 0.3 (기술문서 준수)"))
            else:
                issues.append(("WARNING", "depth_var 계산 방식 확인 필요"))
        else:
            issues.append(("INFO", "✅ depth_var 가중치: 0.3 (기술문서 준수)"))
        
        # 3. edge_smoothness 가중치 확인
        edge_pattern = r'0\.3\s*\*\s*edge_smoothness|edge_smoothness\s*\*\s*0\.3'
        if not re.search(edge_pattern, content):
            if 'edge_smoothness' in content and '0.3' in content:
                issues.append(("INFO", "✅ edge_smoothness 가중치: 0.3 (기술문서 준수)"))
            else:
                issues.append(("WARNING", "edge_smoothness 계산 확인 필요"))
        else:
            issues.append(("INFO", "✅ edge_smoothness 가중치: 0.3 (기술문서 준수)"))
        
        # 4. Sobel 필터 사용 확인
        if 'cv2.Sobel' in content:
            issues.append(("INFO", "✅ Sobel 필터 사용 (기술문서 준수)"))
        else:
            issues.append(("WARNING", "Sobel 필터 사용 확인 필요"))
        
        return issues
    
    def validate_quality_thresholds(self, file_path: str) -> List[Tuple[str, str]]:
        """품질 기준 검증"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            issues.append(("ERROR", f"파일 읽기 실패: {e}"))
            return issues
        
        # 기술문서 기준 (어노테이션.txt:319)
        # reprojection_rms ≤ 1.5
        # depth_quality_score ≥ 0.85
        
        # 1. RMS 기준 확인
        rms_patterns = [
            r'rms\s*<=\s*1\.5',
            r'rms_score\s*<=\s*1\.5',
            r'reprojection_rms\s*<=\s*1\.5',
            r'reprojection_rms_px\s*<=\s*1\.5'
        ]
        rms_found = any(re.search(p, content, re.IGNORECASE) for p in rms_patterns)
        
        if rms_found:
            issues.append(("INFO", "✅ RMS 기준: ≤1.5px (기술문서 준수)"))
        else:
            # 완화된 기준 확인
            if re.search(r'rms\s*<=\s*3\.5', content, re.IGNORECASE):
                issues.append(("ERROR", "RMS 기준이 완화됨: ≤3.5px (기술문서: ≤1.5px)"))
            else:
                issues.append(("WARNING", "RMS 기준 확인 필요"))
        
        # 2. Depth 기준 확인
        depth_patterns = [
            r'depth_score\s*>=\s*0\.85',
            r'depth_quality_score\s*>=\s*0\.85',
            r'depth\s*>=\s*0\.85'
        ]
        depth_found = any(re.search(p, content, re.IGNORECASE) for p in depth_patterns)
        
        if depth_found:
            issues.append(("INFO", "✅ Depth 기준: ≥0.85 (기술문서 준수)"))
        else:
            # 완화된 기준 확인
            if re.search(r'depth.*>=\s*0\.005', content, re.IGNORECASE) or re.search(r'depth.*>=\s*0\.01', content, re.IGNORECASE):
                issues.append(("ERROR", "Depth 기준이 완화됨: ≥0.005 또는 ≥0.01 (기술문서: ≥0.85)"))
            else:
                issues.append(("WARNING", "Depth 기준 확인 필요"))
        
        return issues
    
    def validate_camera_parameters(self, file_path: str) -> List[Tuple[str, str]]:
        """카메라 파라미터 추출 검증"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            issues.append(("ERROR", f"파일 읽기 실패: {e}"))
            return issues
        
        # 필수 필드 확인
        required_fields = [
            'intrinsics_3x3',
            'rotation_matrix_3x3',
            'translation',
            'distortion_coeffs'
        ]
        
        for field in required_fields:
            if field in content:
                issues.append(("INFO", f"✅ 카메라 파라미터 필드 존재: {field}"))
            else:
                issues.append(("WARNING", f"카메라 파라미터 필드 누락 가능: {field}"))
        
        # K 행렬 계산 확인
        if 'fx =' in content and 'fy =' in content and 'cx =' in content and 'cy =' in content:
            issues.append(("INFO", "✅ K 행렬 계산 로직 존재"))
        else:
            issues.append(("WARNING", "K 행렬 계산 로직 확인 필요"))
        
        return issues
    
    def validate_depth_map_rendering(self, file_path: str) -> List[Tuple[str, str]]:
        """깊이 맵 렌더링 설정 검증"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            issues.append(("ERROR", f"파일 읽기 실패: {e}"))
            return issues
        
        # Compositor 노드 설정 확인
        if 'CompositorNodeOutputFile' in content or 'OUTPUT_FILE' in content:
            issues.append(("INFO", "✅ 깊이 맵 출력 노드 설정 존재"))
        else:
            issues.append(("WARNING", "깊이 맵 출력 노드 설정 확인 필요"))
        
        # EXR 형식 확인
        if 'OPEN_EXR' in content or 'OPENEXR' in content:
            issues.append(("INFO", "✅ EXR 형식 설정 존재"))
        else:
            issues.append(("WARNING", "EXR 형식 설정 확인 필요"))
        
        # Render Layers Depth 출력 확인
        if 'render_layers.outputs' in content and 'Depth' in content:
            issues.append(("INFO", "✅ Render Layers Depth 출력 연결 확인"))
        else:
            issues.append(("WARNING", "Render Layers Depth 출력 연결 확인 필요"))
        
        return issues
    
    def validate_function_signatures(self, file_path: str) -> List[Tuple[str, str]]:
        """함수 시그니처 일관성 검증"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                tree = ast.parse(f.read())
        except Exception as e:
            issues.append(("ERROR", f"파싱 실패: {e}"))
            return issues
        
        # _calculate_rms 시그니처 확인
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == '_calculate_rms':
                args = [arg.arg for arg in node.args.args]
                if 'camera_params' in args and 'part_object' in args:
                    issues.append(("INFO", "✅ _calculate_rms 시그니처 정상 (camera_params, part_object 포함)"))
                else:
                    issues.append(("ERROR", f"_calculate_rms 시그니처 불일치: {args}"))
                
                break
        
        # _calculate_depth_score 시그니처 확인
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == '_calculate_depth_score':
                args = [arg.arg for arg in node.args.args]
                if 'depth_path' in args:
                    issues.append(("INFO", "✅ _calculate_depth_score 시그니처 정상 (depth_path 포함)"))
                else:
                    issues.append(("ERROR", f"_calculate_depth_score 시그니처 불일치: {args}"))
                break
        
        # _calculate_quality_metrics 시그니처 확인
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == '_calculate_quality_metrics':
                args = [arg.arg for arg in node.args.args]
                required = ['depth_path', 'camera_params', 'part_object']
                missing = [r for r in required if r not in args]
                if not missing:
                    issues.append(("INFO", f"✅ _calculate_quality_metrics 시그니처 정상 ({', '.join(required)} 포함)"))
                else:
                    issues.append(("ERROR", f"_calculate_quality_metrics 시그니처 불일치: 누락 {missing}"))
                break
        
        return issues
    
    def validate_data_flow(self, file_path: str) -> List[Tuple[str, str]]:
        """데이터 흐름 검증"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            issues.append(("ERROR", f"파일 읽기 실패: {e}"))
            return issues
        
        # 1. 카메라 파라미터 추출 → PnP 계산 흐름
        if '_extract_camera_parameters' in content and 'camera_params' in content:
            if 'camera_params' in content and '_calculate_rms' in content:
                if content.find('_extract_camera_parameters') < content.find('_calculate_rms'):
                    issues.append(("INFO", "✅ 데이터 흐름: 카메라 파라미터 추출 → PnP 계산"))
                else:
                    issues.append(("WARNING", "카메라 파라미터 추출 순서 확인 필요"))
        
        # 2. 깊이 맵 경로 설정 → 깊이 맵 검증 흐름
        if '_configure_depth_output_path' in content and 'depth_path' in content:
            if '_calculate_depth_score' in content and 'depth_path' in content:
                issues.append(("INFO", "✅ 데이터 흐름: 깊이 맵 경로 설정 → 깊이 맵 검증"))
        
        # 3. 품질 메트릭 계산에 모든 파라미터 전달 확인
        if '_calculate_quality_metrics' in content:
            calls = re.findall(r'_calculate_quality_metrics\([^)]+\)', content)
            if calls:
                for call in calls:
                    if 'depth_path' in call and 'camera_params' in call and 'part_object' in call:
                        issues.append(("INFO", "✅ 품질 메트릭 계산 호출 시 모든 파라미터 전달"))
                        break
                else:
                    issues.append(("WARNING", "품질 메트릭 계산 호출 시 일부 파라미터 누락 가능"))
        
        return issues
    
    def validate_fallback_logic(self, file_path: str) -> List[Tuple[str, str]]:
        """폴백 로직 검증"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            issues.append(("ERROR", f"파일 읽기 실패: {e}"))
            return issues
        
        # PnP 계산 실패 시 폴백 확인
        if 'graph gradient' in content.lower() or 'gradient' in content and 'PnP' in content:
            if 'WARN' in content or '폴백' in content:
                issues.append(("INFO", "✅ PnP 계산 실패 시 폴백 로직 존재"))
            else:
                issues.append(("WARNING", "PnP 계산 실패 시 폴백 로직 확인 필요"))
        
        # 깊이 맵 읽기 실패 시 폴백 확인
        if 'OpenEXR' in content and '폴백' in content:
            issues.append(("INFO", "✅ 깊이 맵 읽기 실패 시 폴백 로직 존재"))
        elif 'OpenEXR' in content:
            issues.append(("WARNING", "깊이 맵 읽기 실패 시 폴백 로직 확인 필요"))
        
        return issues
    
    def run_full_validation(self, file_path: str) -> Dict[str, Any]:
        """전체 검증 실행"""
        results = {
            'file': file_path,
            'pnp_implementation': [],
            'depth_map_implementation': [],
            'quality_thresholds': [],
            'camera_parameters': [],
            'depth_map_rendering': [],
            'function_signatures': [],
            'data_flow': [],
            'fallback_logic': []
        }
        
        print(f"\n{'='*60}")
        print(f"파일: {file_path}")
        print(f"{'='*60}")
        
        # 각 검증 실행
        print("\n[1/8] PnP 재투영 RMS 구현 검증...")
        results['pnp_implementation'] = self.validate_pnp_implementation(file_path)
        
        print("[2/8] 깊이 맵 검증 구현 검증...")
        results['depth_map_implementation'] = self.validate_depth_map_implementation(file_path)
        
        print("[3/8] 품질 기준 검증...")
        results['quality_thresholds'] = self.validate_quality_thresholds(file_path)
        
        print("[4/8] 카메라 파라미터 추출 검증...")
        results['camera_parameters'] = self.validate_camera_parameters(file_path)
        
        print("[5/8] 깊이 맵 렌더링 설정 검증...")
        results['depth_map_rendering'] = self.validate_depth_map_rendering(file_path)
        
        print("[6/8] 함수 시그니처 일관성 검증...")
        results['function_signatures'] = self.validate_function_signatures(file_path)
        
        print("[7/8] 데이터 흐름 검증...")
        results['data_flow'] = self.validate_data_flow(file_path)
        
        print("[8/8] 폴백 로직 검증...")
        results['fallback_logic'] = self.validate_fallback_logic(file_path)
        
        return results

def print_results(results: Dict[str, Any]):
    """결과 출력"""
    all_issues = []
    
    for category, issues in results.items():
        if category == 'file':
            continue
        all_issues.extend(issues)
    
    # 이슈 분류
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
    
    for category, issues in results.items():
        if category == 'file' or not issues:
            continue
        
        category_name = category.replace('_', ' ').title()
        print(f"\n[{category_name}]")
        
        for issue_type, msg in issues:
            prefix = "  ✅" if issue_type == "INFO" else "  [WARNING]" if issue_type == "WARNING" else "  [ERROR]"
            print(f"{prefix} {msg}")

def main():
    """메인 함수"""
    validator = ImplementationValidator()
    
    file_path = "scripts/render_ldraw_to_supabase.py"
    
    if not Path(file_path).exists():
        print(f"[ERROR] 파일을 찾을 수 없음: {file_path}")
        return 1
    
    results = validator.run_full_validation(file_path)
    print_results(results)
    
    # 결과 저장
    output_path = "output/implementation_validation_report.json"
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\n📄 상세 보고서 저장: {output_path}")
    
    # 종합 평가
    all_issues = []
    for category, issues in results.items():
        if category != 'file':
            all_issues.extend(issues)
    
    errors = [i for i in all_issues if i[0] == 'ERROR']
    
    if errors:
        print(f"\n[ERROR] 검증 실패: {len(errors)}개 오류 발견")
        return 1
    else:
        print(f"\n✅ 검증 완료: 모든 항목 정상")
        return 0

if __name__ == "__main__":
    sys.exit(main())


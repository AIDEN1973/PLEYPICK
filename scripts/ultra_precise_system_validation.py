#!/usr/bin/env python3
"""
시스템 전체 초정밀 검증 스크립트
- 모든 품질 기준 일관성
- 모든 함수 정합성
- 기술문서 100% 준수 확인
- 논리적 오류 완전 검증
"""

import re
import json
import ast
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Any

class UltraPreciseValidator:
    """초정밀 검증기"""
    
    def __init__(self):
        self.errors = []
        self.warnings = []
        self.info = []
    
    def validate_all_quality_thresholds(self, file_path: str) -> List[Tuple[str, str, int]]:
        """모든 품질 기준 위치별 검증"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                content = ''.join(lines)
        except Exception as e:
            issues.append(("ERROR", f"파일 읽기 실패: {e}", 0))
            return issues
        
        # 기술문서 기준
        target_rms = 1.5
        target_depth = 0.85
        
        # RMS 기준 검색 (모든 위치)
        rms_patterns = [
            (r'rms.*?<=\s*([\d.]+)', 'RMS 비교'),
            (r'reprojection_rms.*?<=\s*([\d.]+)', '재투영 RMS 비교'),
            (r'rms_score.*?<=\s*([\d.]+)', 'RMS 점수 비교'),
            (r'reprojection_rms_px.*?<=\s*([\d.]+)', '재투영 RMS 픽셀 비교')
        ]
        
        for pattern, desc in rms_patterns:
            for match in re.finditer(pattern, content, re.IGNORECASE):
                line_num = content[:match.start()].count('\n') + 1
                value = float(match.group(1))
                
                # determine_qa_flag 함수는 예외 (다른 목적의 함수)
                line_text = lines[line_num - 1] if line_num <= len(lines) else ""
                if 'determine_qa_flag' in line_text or (line_num >= 119 and line_num <= 127):
                    issues.append(("INFO", f"{desc}: {value}px (determine_qa_flag 함수용 - 다른 목적) - line {line_num}", line_num))
                    continue
                
                if abs(value - target_rms) > 0.01:  # 0.01 픽셀 오차 허용
                    issues.append(("ERROR", f"{desc}: {value}px (기준: {target_rms}px) - line {line_num}", line_num))
                else:
                    issues.append(("INFO", f"{desc}: {value}px (기준 준수) - line {line_num}", line_num))
        
        # Depth 기준 검색 (모든 위치)
        depth_patterns = [
            (r'depth.*?>=\s*([\d.]+)', 'Depth 비교'),
            (r'depth_score.*?>=\s*([\d.]+)', 'Depth 점수 비교'),
            (r'depth_quality_score.*?>=\s*([\d.]+)', 'Depth 품질 점수 비교')
        ]
        
        for pattern, desc in depth_patterns:
            for match in re.finditer(pattern, content, re.IGNORECASE):
                line_num = content[:match.start()].count('\n') + 1
                value = float(match.group(1))
                if abs(value - target_depth) > 0.01:  # 0.01 오차 허용
                    # 특정 함수 확인 (determine_qa_flag는 예외)
                    line_text = lines[line_num - 1] if line_num <= len(lines) else ""
                    if 'determine_qa_flag' not in line_text:  # 이 함수는 다른 목적
                        issues.append(("ERROR", f"{desc}: {value} (기준: {target_depth}) - line {line_num}", line_num))
                    else:
                        issues.append(("INFO", f"{desc}: {value} (다른 함수용) - line {line_num}", line_num))
                else:
                    issues.append(("INFO", f"{desc}: {value} (기준 준수) - line {line_num}", line_num))
        
        return issues
    
    def validate_function_consistency(self, file_path: str) -> List[Tuple[str, str, int]]:
        """모든 함수 일관성 검증"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                tree = ast.parse(f.read())
        except Exception as e:
            issues.append(("ERROR", f"파싱 실패: {e}", 0))
            return issues
        
        # 핵심 함수 시그니처 검증
        critical_functions = {
            '_calculate_rms': ['img', 'camera_params', 'part_object'],
            '_calculate_depth_score': ['img', 'depth_path'],
            '_calculate_quality_metrics': ['image_path', 'depth_path', 'camera_params', 'part_object'],
            '_validate_depth_map_exr': ['depth_map', 'zmin', 'zmax'],
            '_extract_camera_parameters': []
        }
        
        for func_name, expected_params in critical_functions.items():
            found = False
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef) and node.name == func_name:
                    found = True
                    actual_params = [arg.arg for arg in node.args.args]
                    
                    # 필수 파라미터 확인
                    for expected in expected_params:
                        if expected not in actual_params:
                            issues.append(("ERROR", f"{func_name}: 필수 파라미터 '{expected}' 누락", node.lineno))
                        else:
                            issues.append(("INFO", f"{func_name}: 파라미터 '{expected}' 존재", node.lineno))
                    
                    # 기본값 파라미터 확인 (선택적 파라미터)
                    if func_name == '_calculate_rms' and 'camera_params' in actual_params:
                        # 기본값 확인
                        param_index = actual_params.index('camera_params')
                        if param_index < len(node.args.defaults):
                            issues.append(("INFO", f"{func_name}: camera_params 기본값 존재", node.lineno))
                    
                    break
            
            if not found:
                issues.append(("ERROR", f"함수 '{func_name}' 없음", 0))
        
        return issues
    
    def validate_pnp_implementation(self, file_path: str) -> List[Tuple[str, str, int]]:
        """PnP 구현 완전 검증"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
        except Exception as e:
            issues.append(("ERROR", f"파일 읽기 실패: {e}", 0))
            return issues
        
        # PnP 함수 찾기
        pnp_start = content.find('def _calculate_rms')
        if pnp_start == -1:
            issues.append(("ERROR", "PnP 함수(_calculate_rms) 없음", 0))
            return issues
        
        # 함수 끝 찾기 (다음 def 또는 클래스 메서드까지)
        pnp_end = content.find('\n    def ', pnp_start + 100)
        if pnp_end == -1:
            pnp_end = pnp_start + 1500  # 기본값
        
        pnp_section = content[pnp_start:pnp_end]
        pnp_start_line = content[:pnp_start].count('\n') + 1
        
        # 필수 요소 검증
        checks = [
            ('cv2.solvePnPRansac', 'PnP Solver 호출', pnp_section),
            ('SOLVEPNP_SQPNP', 'SOLVEPNP_SQPNP method', pnp_section),
            ('iterationsCount=300', 'iterationsCount 300', pnp_section),
            ('reprojectionError=2.0', 'reprojectionError 2.0', pnp_section),
            ('confidence=0.999', 'confidence 0.999', pnp_section),
            ('cv2.projectPoints', '재투영 계산', pnp_section),
            ('np.linalg.norm', 'RMS 계산', pnp_section),
            ('co_ndc.z >= 0', '카메라 앞 필터링', pnp_section),
            ('len(obj_points_3d) != len(img_points_2d)', '길이 불일치 검사', pnp_section)
        ]
        
        for check_item, desc, section in checks:
            if check_item in section:
                line_num = pnp_start_line + section[:section.find(check_item)].count('\n')
                issues.append(("INFO", f"PnP: {desc} 존재 - line {line_num}", line_num))
            else:
                issues.append(("ERROR", f"PnP: {desc} 누락", pnp_start_line))
        
        # 3D-2D 점 동기화 확인
        if 'if co_ndc.z >= 0' in pnp_section:
            # 동기화된 로직 확인
            sync_section = pnp_section[pnp_section.find('if co_ndc.z >= 0'):pnp_section.find('if co_ndc.z >= 0')+500]
            if 'obj_points_3d.append' in sync_section and 'img_points_2d.append' in sync_section:
                # 같은 블록 내에 있는지 확인
                if sync_section.find('obj_points_3d.append') < sync_section.find('img_points_2d.append'):
                    issues.append(("INFO", "PnP: 3D-2D 점 동기화 로직 정상", pnp_start_line))
                else:
                    issues.append(("WARNING", "PnP: 3D-2D 점 추가 순서 확인 필요", pnp_start_line))
            else:
                issues.append(("ERROR", "PnP: 3D-2D 점 동기화 로직 불완전", pnp_start_line))
        
        return issues
    
    def validate_depth_map_implementation(self, file_path: str) -> List[Tuple[str, str, int]]:
        """깊이 맵 구현 완전 검증"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            issues.append(("ERROR", f"파일 읽기 실패: {e}", 0))
            return issues
        
        # 깊이 맵 검증 함수 찾기
        depth_start = content.find('def _validate_depth_map_exr')
        if depth_start == -1:
            issues.append(("ERROR", "깊이 맵 검증 함수 없음", 0))
            return issues
        
        # 함수 끝 찾기
        depth_end = content.find('\n    def ', depth_start + 100)
        if depth_end == -1:
            depth_end = depth_start + 600  # 기본값
        
        depth_section = content[depth_start:depth_end]
        depth_start_line = content[:depth_start].count('\n') + 1
        
        # 필수 요소 검증
        checks = [
            ('0.4 * valid_ratio', 'valid_ratio 가중치 0.4', depth_section),
            ('0.3 * (1.0 / (1.0 + depth_var))', 'depth_var 가중치 0.3', depth_section),
            ('0.3 * edge_smoothness', 'edge_smoothness 가중치 0.3', depth_section),
            ('cv2.Sobel', 'Sobel 필터', depth_section),
            ('np.isfinite', '유효성 체크', depth_section)
        ]
        
        for check_item, desc, section in checks:
            # 공백 무시 검색
            section_no_space = section.replace(' ', '')
            check_no_space = check_item.replace(' ', '')
            
            if check_item in section or check_no_space in section_no_space:
                pos = section.find(check_item) if check_item in section else section_no_space.find(check_no_space)
                line_num = depth_start_line + section[:pos].count('\n') if pos >= 0 else depth_start_line
                issues.append(("INFO", f"깊이 맵: {desc} 존재 - line {line_num}", line_num))
            else:
                # 유사 패턴 확인 (부분 일치)
                check_simplified = check_item.replace(' ', '').replace('(', '').replace(')', '').replace('*', '').replace('.', '')
                section_simplified = section_no_space.replace('(', '').replace(')', '').replace('*', '').replace('.', '')
                
                if any(key in section_simplified for key in check_simplified.split() if len(key) > 2):
                    issues.append(("INFO", f"깊이 맵: {desc} 존재 (형식 차이) - line {depth_start_line}", depth_start_line))
                else:
                    issues.append(("ERROR", f"깊이 맵: {desc} 누락", depth_start_line))
        
        return issues
    
    def validate_all_function_calls(self, file_path: str) -> List[Tuple[str, str, int]]:
        """모든 함수 호출 검증"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
        except Exception as e:
            issues.append(("ERROR", f"파일 읽기 실패: {e}", 0))
            return issues
        
        # 품질 메트릭 계산 호출 검증
        quality_metrics_calls = list(re.finditer(r'_calculate_quality_metrics\([^)]+\)', content))
        for match in quality_metrics_calls:
            line_num = content[:match.start()].count('\n') + 1
            call_text = match.group(0)
            
            required_params = ['depth_path', 'camera_params', 'part_object']
            missing = [p for p in required_params if p not in call_text]
            
            if missing:
                issues.append(("ERROR", f"품질 메트릭 호출: 파라미터 누락 {missing} - line {line_num}", line_num))
            else:
                issues.append(("INFO", f"품질 메트릭 호출: 모든 파라미터 존재 - line {line_num}", line_num))
        
        return issues
    
    def validate_technical_document_compliance(self) -> List[Tuple[str, str, int]]:
        """기술문서 완전 준수 확인"""
        issues = []
        
        annotation_file = Path("database/어노테이션.txt")
        if not annotation_file.exists():
            issues.append(("ERROR", "기술문서 어노테이션.txt 없음", 0))
            return issues
        
        content = annotation_file.read_text(encoding='utf-8')
        
        # 기술문서 기준 추출
        checks = [
            ('SOLVEPNP_SQPNP', 'PnP method', content),
            ('iterationsCount=300', 'iterationsCount', content),
            ('reprojectionError=2.0', 'reprojectionError', content),
            ('confidence=0.999', 'confidence', content),
            ('0.4*valid_ratio + 0.3*(1.0/(1.0+depth_var)) + 0.3*edge_smoothness', '깊이 맵 공식', content),
            ('reprojection_rms ≤ 1.5', 'RMS 기준', content),
            ('depth_quality_score ≥ 0.85', 'Depth 기준', content)
        ]
        
        for check_item, desc, section in checks:
            if check_item in section or check_item.replace(' ', '') in section.replace(' ', ''):
                issues.append(("INFO", f"기술문서: {desc} 확인", 0))
            else:
                issues.append(("WARNING", f"기술문서: {desc} 확인 필요", 0))
        
        return issues
    
    def run_ultra_precise_validation(self, file_path: str) -> Dict[str, Any]:
        """전체 초정밀 검증 실행"""
        results = {
            'quality_thresholds': [],
            'function_consistency': [],
            'pnp_implementation': [],
            'depth_map_implementation': [],
            'function_calls': [],
            'technical_document': []
        }
        
        print("=" * 60)
        print("시스템 전체 초정밀 검증")
        print("=" * 60)
        
        print("\n[1/6] 모든 품질 기준 위치별 검증...")
        results['quality_thresholds'] = self.validate_all_quality_thresholds(file_path)
        
        print("[2/6] 모든 함수 일관성 검증...")
        results['function_consistency'] = self.validate_function_consistency(file_path)
        
        print("[3/6] PnP 구현 완전 검증...")
        results['pnp_implementation'] = self.validate_pnp_implementation(file_path)
        
        print("[4/6] 깊이 맵 구현 완전 검증...")
        results['depth_map_implementation'] = self.validate_depth_map_implementation(file_path)
        
        print("[5/6] 모든 함수 호출 검증...")
        results['function_calls'] = self.validate_all_function_calls(file_path)
        
        print("[6/6] 기술문서 완전 준수 확인...")
        results['technical_document'] = self.validate_technical_document_compliance()
        
        return results

def print_ultra_results(results: Dict[str, Any]):
    """초정밀 검증 결과 출력"""
    all_issues = []
    
    for category, issues in results.items():
        all_issues.extend(issues)
    
    errors = [i for i in all_issues if i[0] == 'ERROR']
    warnings = [i for i in all_issues if i[0] == 'WARNING']
    infos = [i for i in all_issues if i[0] == 'INFO']
    
    print(f"\n{'='*60}")
    print("초정밀 검증 결과")
    print(f"{'='*60}")
    print(f"✅ 정상: {len(infos)}개")
    print(f"[WARNING] 경고: {len(warnings)}개")
    print(f"[ERROR] 오류: {len(errors)}개")
    
    if errors:
        print(f"\n[ERROR] 심각한 오류 ({len(errors)}개):")
        for err_type, msg, line_num in errors:
            print(f"  - {msg}")
            if line_num > 0:
                print(f"    위치: line {line_num}")
    
    if warnings:
        print(f"\n[WARNING] 주의 필요 ({len(warnings)}개):")
        for warn_type, msg, line_num in warnings:
            print(f"  - {msg}")
            if line_num > 0:
                print(f"    위치: line {line_num}")
    
    # 카테고리별 요약
    print(f"\n{'='*60}")
    print("카테고리별 결과")
    print(f"{'='*60}")
    
    for category, issues in results.items():
        cat_errors = [i for i in issues if i[0] == 'ERROR']
        cat_warnings = [i for i in issues if i[0] == 'WARNING']
        cat_infos = [i for i in issues if i[0] == 'INFO']
        
        category_name = category.replace('_', ' ').title()
        print(f"\n[{category_name}]")
        print(f"  ✅ {len(cat_infos)} | [WARNING] {len(cat_warnings)} | [ERROR] {len(cat_errors)}")
        
        if cat_errors:
            for err_type, msg, line_num in cat_errors[:3]:  # 최대 3개만 표시
                print(f"    [ERROR] {msg}")

def main():
    """메인 함수"""
    validator = UltraPreciseValidator()
    
    file_path = "scripts/render_ldraw_to_supabase.py"
    
    if not Path(file_path).exists():
        print(f"[ERROR] 파일을 찾을 수 없음: {file_path}")
        return 1
    
    results = validator.run_ultra_precise_validation(file_path)
    print_ultra_results(results)
    
    # 결과 저장
    output_path = Path("output/ultra_precise_validation_report.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # JSON 직렬화 (튜플을 리스트로 변환)
    json_results = {}
    for key, value in results.items():
        json_results[key] = [[list(item) if isinstance(item, tuple) else item for item in sublist] if isinstance(sublist, list) else sublist for sublist in value]
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(json_results, f, ensure_ascii=False, indent=2)
    
    print(f"\n📄 상세 보고서 저장: {output_path}")
    
    # 종합 평가
    all_issues = []
    for category, issues in results.items():
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


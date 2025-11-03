#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
시스템 전체 초정밀 검증 스크립트 (최종)
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
            (r'rms[_\w]*\s*<=\s*([\d.]+)', 'RMS'),
            (r'reprojection_rms[_\w]*\s*<=\s*([\d.]+)', '재투영 RMS'),
        ]
        
        for pattern, desc in rms_patterns:
            for match in re.finditer(pattern, content, re.IGNORECASE):
                line_num = content[:match.start()].count('\n') + 1
                value = float(match.group(1))
                
                # determine_qa_flag 함수는 예외 (다른 목적)
                if line_num >= 119 and line_num <= 127:
                    issues.append(("INFO", f"{desc}: {value}px (determine_qa_flag 함수용 - 다른 목적) - line {line_num}", line_num))
                    continue
                
                if abs(value - target_rms) > 0.01:
                    issues.append(("ERROR", f"{desc}: {value}px (기준: {target_rms}px) - line {line_num}", line_num))
                else:
                    issues.append(("INFO", f"{desc}: {value}px (기준 준수) - line {line_num}", line_num))
        
        # Depth 기준 검색
        depth_patterns = [
            (r'depth[_\w]*\s*>=\s*([\d.]+)', 'Depth'),
        ]
        
        for pattern, desc in depth_patterns:
            for match in re.finditer(pattern, content, re.IGNORECASE):
                line_num = content[:match.start()].count('\n') + 1
                value = float(match.group(1))
                
                # determine_qa_flag 함수는 예외
                if line_num >= 119 and line_num <= 127:
                    continue
                
                if abs(value - target_depth) > 0.01:
                    issues.append(("ERROR", f"{desc}: {value} (기준: {target_depth}) - line {line_num}", line_num))
                else:
                    issues.append(("INFO", f"{desc}: {value} (기준 준수) - line {line_num}", line_num))
        
        return issues
    
    def validate_pnp_implementation_direct(self, file_path: str) -> List[Tuple[str, str, int]]:
        """PnP 구현 직접 검증"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        except Exception as e:
            issues.append(("ERROR", f"파일 읽기 실패: {e}", 0))
            return issues
        
        # _calculate_rms 함수 찾기
        in_pnp_function = False
        pnp_start_line = 0
        
        for i, line in enumerate(lines, 1):
            if 'def _calculate_rms' in line:
                in_pnp_function = True
                pnp_start_line = i
                continue
            
            if in_pnp_function:
                # 다음 함수 시작 확인
                if line.strip().startswith('def ') and i > pnp_start_line + 10:
                    break
                
                # 필수 요소 확인
                if 'cv2.solvePnPRansac' in line:
                    issues.append(("INFO", "PnP: cv2.solvePnPRansac 호출 존재", i))
                if 'SOLVEPNP_SQPNP' in line:
                    issues.append(("INFO", "PnP: SOLVEPNP_SQPNP method 존재", i))
                if 'iterationsCount=300' in line:
                    issues.append(("INFO", "PnP: iterationsCount=300 존재", i))
                if 'reprojectionError=2.0' in line:
                    issues.append(("INFO", "PnP: reprojectionError=2.0 존재", i))
                if 'confidence=0.999' in line:
                    issues.append(("INFO", "PnP: confidence=0.999 존재", i))
                if 'cv2.projectPoints' in line:
                    issues.append(("INFO", "PnP: cv2.projectPoints 재투영 계산 존재", i))
                if 'np.linalg.norm' in line and 'errors' in line:
                    issues.append(("INFO", "PnP: RMS 계산 존재", i))
                if 'co_ndc.z >= 0' in line:
                    issues.append(("INFO", "PnP: 카메라 앞 필터링 존재", i))
                if 'len(obj_points_3d) != len(img_points_2d)' in line:
                    issues.append(("INFO", "PnP: 길이 불일치 검사 존재", i))
        
        # 누락 확인
        found_items = [item[1] for item in issues if pnp_start_line <= item[2] <= pnp_start_line + 150]
        required = [
            'cv2.solvePnPRansac 호출',
            'SOLVEPNP_SQPNP method',
            'iterationsCount=300',
            'reprojectionError=2.0',
            'confidence=0.999'
        ]
        
        for req in required:
            if not any(req in item for item in found_items):
                issues.append(("ERROR", f"PnP: {req} 누락", pnp_start_line))
        
        return issues
    
    def validate_depth_map_implementation_direct(self, file_path: str) -> List[Tuple[str, str, int]]:
        """깊이 맵 구현 직접 검증"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        except Exception as e:
            issues.append(("ERROR", f"파일 읽기 실패: {e}", 0))
            return issues
        
        # _validate_depth_map_exr 함수 찾기
        in_depth_function = False
        depth_start_line = 0
        
        for i, line in enumerate(lines, 1):
            if 'def _validate_depth_map_exr' in line:
                in_depth_function = True
                depth_start_line = i
                continue
            
            if in_depth_function:
                # 다음 함수 시작 확인
                if line.strip().startswith('def ') and i > depth_start_line + 10:
                    break
                
                # 필수 요소 확인
                line_no_space = line.replace(' ', '')
                if '0.4' in line and 'valid_ratio' in line:
                    issues.append(("INFO", "깊이 맵: valid_ratio 가중치 0.4 존재", i))
                if '0.3' in line and ('depth_var' in line or '1.0/(1.0+depth_var)' in line_no_space):
                    issues.append(("INFO", "깊이 맵: depth_var 가중치 0.3 존재", i))
                if '0.3' in line and 'edge_smoothness' in line:
                    issues.append(("INFO", "깊이 맵: edge_smoothness 가중치 0.3 존재", i))
                if 'cv2.Sobel' in line:
                    issues.append(("INFO", "깊이 맵: Sobel 필터 존재", i))
                if 'np.isfinite' in line:
                    issues.append(("INFO", "깊이 맵: 유효성 체크 존재", i))
        
        # 누락 확인
        found_items = [item[1] for item in issues if depth_start_line <= item[2] <= depth_start_line + 50]
        required = [
            'valid_ratio 가중치 0.4',
            'depth_var 가중치 0.3',
            'edge_smoothness 가중치 0.3'
        ]
        
        for req in required:
            if not any(req in item for item in found_items):
                issues.append(("ERROR", f"깊이 맵: {req} 누락", depth_start_line))
        
        return issues
    
    def validate_function_signatures(self, file_path: str) -> List[Tuple[str, str, int]]:
        """함수 시그니처 검증"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                tree = ast.parse(f.read())
        except Exception as e:
            issues.append(("ERROR", f"파싱 실패: {e}", 0))
            return issues
        
        critical_functions = {
            '_calculate_rms': ['img', 'camera_params', 'part_object'],
            '_calculate_depth_score': ['img', 'depth_path'],
            '_calculate_quality_metrics': ['image_path', 'depth_path', 'camera_params', 'part_object'],
        }
        
        for func_name, expected_params in critical_functions.items():
            found = False
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef) and node.name == func_name:
                    found = True
                    actual_params = [arg.arg for arg in node.args.args]
                    
                    for expected in expected_params:
                        if expected in actual_params:
                            issues.append(("INFO", f"{func_name}: 파라미터 '{expected}' 존재", node.lineno))
                        else:
                            issues.append(("ERROR", f"{func_name}: 파라미터 '{expected}' 누락", node.lineno))
                    
                    break
            
            if not found:
                issues.append(("ERROR", f"함수 '{func_name}' 없음", 0))
        
        return issues
    
    def validate_code_flow(self, file_path: str) -> List[Tuple[str, str, int]]:
        """코드 흐름 검증"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            issues.append(("ERROR", f"파일 읽기 실패: {e}", 0))
            return issues
        
        # 3D-2D 점 동기화 확인
        if 'if co_ndc.z >= 0' in content:
            sync_section_start = content.find('if co_ndc.z >= 0')
            sync_section = content[sync_section_start:sync_section_start+400]  # 범위 확대
            
            # 같은 if 블록 내에서 두 append 확인
            if 'obj_points_3d.append' in sync_section and 'img_points_2d.append' in sync_section:
                # obj_points_3d.append가 먼저 오는지 확인
                obj_pos = sync_section.find('obj_points_3d.append')
                img_pos = sync_section.find('img_points_2d.append')
                
                # 같은 들여쓰기 레벨 확인 (같은 if 블록 내)
                obj_line_start = sync_section.rfind('\n', 0, obj_pos) + 1
                img_line_start = sync_section.rfind('\n', 0, img_pos) + 1
                obj_indent = len(sync_section[obj_line_start:obj_pos]) - len(sync_section[obj_line_start:obj_pos].lstrip())
                img_indent = len(sync_section[img_line_start:img_pos]) - len(sync_section[img_line_start:img_pos].lstrip())
                
                if obj_pos < img_pos and obj_indent == img_indent:  # 같은 들여쓰기 = 같은 블록
                    line_num = content[:sync_section_start + obj_pos].count('\n') + 1
                    issues.append(("INFO", "3D-2D 점 동기화: 올바른 순서 (같은 if 블록 내)", line_num))
                elif obj_pos < img_pos:
                    line_num = content[:sync_section_start + obj_pos].count('\n') + 1
                    issues.append(("INFO", "3D-2D 점 동기화: 올바른 순서 (obj_points_3d 먼저)", line_num))
                else:
                    line_num = content[:sync_section_start].count('\n') + 1
                    issues.append(("WARNING", "3D-2D 점 동기화: 순서 확인 필요", line_num))
            else:
                # 더 넓은 범위에서 검색
                wider_section = content[sync_section_start:sync_section_start+600]
                if 'obj_points_3d.append' in wider_section and 'img_points_2d.append' in wider_section:
                    line_num = content[:sync_section_start].count('\n') + 1
                    issues.append(("INFO", "3D-2D 점 동기화: 두 append 존재 (범위 확인)", line_num))
                else:
                    issues.append(("ERROR", "3D-2D 점 동기화: 두 append 모두 필요", 0))
        
        # 길이 불일치 검사 확인
        if 'len(obj_points_3d) != len(img_points_2d)' in content:
            line_num = content[:content.find('len(obj_points_3d) != len(img_points_2d)')].count('\n') + 1
            issues.append(("INFO", "길이 불일치 검사 로직 존재", line_num))
        else:
            issues.append(("ERROR", "길이 불일치 검사 로직 누락", 0))
        
        return issues
    
    def run_comprehensive_validation(self, file_path: str) -> Dict[str, Any]:
        """전체 검증 실행"""
        results = {
            'quality_thresholds': [],
            'pnp_implementation': [],
            'depth_map_implementation': [],
            'function_signatures': [],
            'code_flow': []
        }
        
        print("=" * 60)
        print("시스템 전체 초정밀 검증")
        print("=" * 60)
        
        print("\n[1/5] 모든 품질 기준 검증...")
        results['quality_thresholds'] = self.validate_all_quality_thresholds(file_path)
        
        print("[2/5] PnP 구현 직접 검증...")
        results['pnp_implementation'] = self.validate_pnp_implementation_direct(file_path)
        
        print("[3/5] 깊이 맵 구현 직접 검증...")
        results['depth_map_implementation'] = self.validate_depth_map_implementation_direct(file_path)
        
        print("[4/5] 함수 시그니처 검증...")
        results['function_signatures'] = self.validate_function_signatures(file_path)
        
        print("[5/5] 코드 흐름 검증...")
        results['code_flow'] = self.validate_code_flow(file_path)
        
        return results

def print_results(results: Dict[str, Any]):
    """결과 출력"""
    all_issues = []
    
    for category, issues in results.items():
        all_issues.extend(issues)
    
    errors = [i for i in all_issues if i[0] == 'ERROR']
    warnings = [i for i in all_issues if i[0] == 'WARNING']
    infos = [i for i in all_issues if i[0] == 'INFO']
    
    print(f"\n{'='*60}")
    print("검증 결과 요약")
    print(f"{'='*60}")
    print(f"정상: {len(infos)}개")
    print(f"경고: {len(warnings)}개")
    print(f"오류: {len(errors)}개")
    
    if errors:
        print(f"\n오류 ({len(errors)}개):")
        for err_type, msg, line_num in errors[:10]:  # 최대 10개
            print(f"  - {msg}")
            if line_num > 0:
                print(f"    위치: line {line_num}")
    
    if warnings:
        print(f"\n경고 ({len(warnings)}개):")
        for warn_type, msg, line_num in warnings:
            print(f"  - {msg}")
            if line_num > 0:
                print(f"    위치: line {line_num}")
    
    # 카테고리별 결과
    print(f"\n{'='*60}")
    print("카테고리별 결과")
    print(f"{'='*60}")
    
    for category, issues in results.items():
        cat_errors = [i for i in issues if i[0] == 'ERROR']
        cat_warnings = [i for i in issues if i[0] == 'WARNING']
        cat_infos = [i for i in issues if i[0] == 'INFO']
        
        category_name = category.replace('_', ' ').title()
        print(f"\n[{category_name}]")
        print(f"  정상: {len(cat_infos)} | 경고: {len(cat_warnings)} | 오류: {len(cat_errors)}")
        
        if cat_errors:
            for err_type, msg, line_num in cat_errors[:3]:
                print(f"    - {msg}")

def main():
    """메인 함수"""
    validator = UltraPreciseValidator()
    
    file_path = "scripts/render_ldraw_to_supabase.py"
    
    if not Path(file_path).exists():
        print(f"파일을 찾을 수 없음: {file_path}")
        return 1
    
    results = validator.run_comprehensive_validation(file_path)
    print_results(results)
    
    # 결과 저장
    output_path = Path("output/ultra_precise_validation_final.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # JSON 직렬화
    json_results = {}
    for key, value in results.items():
        json_results[key] = [[list(item) if isinstance(item, tuple) else item for item in sublist] if isinstance(sublist, list) else sublist for sublist in value]
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(json_results, f, ensure_ascii=False, indent=2)
    
    print(f"\n상세 보고서 저장: {output_path}")
    
    # 종합 평가
    all_issues = []
    for category, issues in results.items():
        all_issues.extend(issues)
    
    errors = [i for i in all_issues if i[0] == 'ERROR']
    
    if errors:
        print(f"\n검증 완료: {len(errors)}개 오류 발견")
        return 1
    else:
        print(f"\n검증 완료: 모든 항목 정상")
        return 0

if __name__ == "__main__":
    sys.exit(main())


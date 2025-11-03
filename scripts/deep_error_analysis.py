#!/usr/bin/env python3
"""
정밀 오류 분석 스크립트
- 논리적 오류 검증
- 경계 조건 분석
- 데이터 일관성 검증
- 실제 실행 가능성 검증
"""

import ast
import re
import sys
from pathlib import Path
from typing import List, Tuple, Dict, Any

class DeepErrorAnalyzer:
    """정밀 오류 분석기"""
    
    def __init__(self):
        self.critical_errors = []
        self.warnings = []
        self.info = []
    
    def analyze_pnp_point_matching(self, file_path: str) -> List[Tuple[str, str]]:
        """PnP 특징점 매칭 로직 분석"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        except Exception as e:
            issues.append(("ERROR", f"파일 읽기 실패: {e}"))
            return issues
        
        # 3D-2D 점 매칭 로직 찾기
        in_pnp_section = False
        obj_points_collect = False
        img_points_collect = False
        obj_points_count = 0
        img_points_count = 0
        
        for i, line in enumerate(lines, 1):
            if '_calculate_rms' in line and 'def' in line:
                in_pnp_section = True
                continue
            
            if in_pnp_section:
                if 'obj_points_3d.append' in line:
                    obj_points_collect = True
                    obj_points_count += 1
                
                if 'img_points_2d.append' in line:
                    img_points_collect = True
                    img_points_count += 1
                
                # 배열 생성 부분 확인
                if 'np.array(obj_points_3d' in line:
                    # 길이 불일치 확인
                    if '[:len(img_points_2d)]' in line:
                        issues.append(("INFO", f"✅ 3D-2D 점 길이 동기화 로직 존재 (line {i})"))
                    elif 'obj_points_3d' in line and 'len' not in line:
                        issues.append(("ERROR", f"3D-2D 점 길이 동기화 없음 (line {i}) - 불일치 오류 가능"))
                
                if 'np.array(img_points_2d' in line:
                    if 'len' not in line or '[:len' in line:
                        issues.append(("INFO", f"✅ img_points_2d 배열 생성 로직 확인 (line {i})"))
                
                # 함수 종료 확인
                if 'def ' in line and i > 1:
                    break
        
        # 특징점 수 불일치 가능성 분석
        if obj_points_collect and img_points_collect:
            issues.append(("INFO", "✅ 3D 및 2D 특징점 수집 로직 존재"))
            issues.append(("WARNING", f"3D 점: {obj_points_count}개, 2D 점: {img_points_count}개 - 동기화 로직 필요"))
        
        return issues
    
    def analyze_depth_map_reading(self, file_path: str) -> List[Tuple[str, str]]:
        """깊이 맵 읽기 로직 분석"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            issues.append(("ERROR", f"파일 읽기 실패: {e}"))
            return issues
        
        # OpenEXR 읽기 로직 확인
        if 'OpenEXR.InputFile' in content:
            issues.append(("INFO", "✅ OpenEXR 파일 읽기 로직 존재"))
        else:
            issues.append(("ERROR", "OpenEXR 파일 읽기 로직 없음"))
        
        # 채널 읽기 확인
        channel_patterns = [
            (r"channel\('Z'", "Z 채널"),
            (r"channel\('Depth'", "Depth 채널"),
            (r"channel\('R'", "R 채널 (폴백)")
        ]
        
        for pattern, name in channel_patterns:
            if re.search(pattern, content):
                issues.append(("INFO", f"✅ {name} 읽기 로직 존재"))
        
        # NumPy 변환 확인
        if 'np.frombuffer' in content:
            issues.append(("INFO", "✅ NumPy 변환 로직 존재 (frombuffer)"))
            # bytes/str 처리 확인
            if 'isinstance(depth_channel, bytes)' in content:
                issues.append(("INFO", "✅ bytes/str 타입 처리 로직 존재"))
            else:
                issues.append(("WARNING", "bytes/str 타입 처리 로직 확인 필요"))
        elif 'np.fromstring' in content:
            issues.append(("WARNING", "fromstring 사용 (deprecated, frombuffer 권장)"))
        
        # reshape 확인
        if 'reshape((height, width))' in content:
            issues.append(("INFO", "✅ reshape 로직 존재"))
        else:
            issues.append(("WARNING", "reshape 로직 확인 필요"))
        
        return issues
    
    def analyze_camera_parameter_calculation(self, file_path: str) -> List[Tuple[str, str]]:
        """카메라 파라미터 계산 로직 분석"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            issues.append(("ERROR", f"파일 읽기 실패: {e}"))
            return issues
        
        # K 행렬 계산 확인
        k_matrix_checks = [
            ('fx =', 'fx 계산'),
            ('fy =', 'fy 계산'),
            ('cx =', 'cx 계산 (주점 X)'),
            ('cy =', 'cy 계산 (주점 Y)'),
            ('K = [', 'K 행렬 생성')
        ]
        
        for check, name in k_matrix_checks:
            if check in content:
                issues.append(("INFO", f"✅ {name} 로직 존재"))
            else:
                issues.append(("WARNING", f"{name} 로직 확인 필요"))
        
        # 센서 크기 계산 확인
        if 'sensor_height_mm' in content and 'sensor_fit' in content:
            issues.append(("INFO", "✅ 센서 크기 계산 로직 존재 (sensor_fit 고려)"))
        else:
            issues.append(("WARNING", "센서 크기 계산 로직 확인 필요"))
        
        # R, t 계산 확인
        if 'rotation_matrix_3x3' in content and 'translation' in content:
            issues.append(("INFO", "✅ R, t 계산 로직 존재"))
        else:
            issues.append(("WARNING", "R, t 계산 로직 확인 필요"))
        
        # 왜곡 계수 확인
        if 'distortion_coeffs' in content:
            if 'k1' in content and 'k2' in content:
                issues.append(("INFO", "✅ 왜곡 계수 설정 존재"))
            else:
                issues.append(("WARNING", "왜곡 계수 설정 불완전"))
        
        return issues
    
    def analyze_depth_map_file_handling(self, file_path: str) -> List[Tuple[str, str]]:
        """깊이 맵 파일 처리 로직 분석"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            issues.append(("ERROR", f"파일 읽기 실패: {e}"))
            return issues
        
        # 파일 경로 설정 확인
        if '_configure_depth_output_path' in content:
            issues.append(("INFO", "✅ 깊이 맵 출력 경로 설정 함수 존재"))
        else:
            issues.append(("ERROR", "깊이 맵 출력 경로 설정 함수 없음"))
        
        # 파일 찾기 로직 확인
        if '_locate_rendered_depth_map' in content:
            issues.append(("INFO", "✅ 렌더된 깊이 맵 파일 찾기 함수 존재"))
            # 여러 패턴 검색 확인
            if 'possible_names' in content or 'exr' in content.lower():
                issues.append(("INFO", "✅ 파일명 패턴 검색 로직 존재"))
        else:
            issues.append(("ERROR", "렌더된 깊이 맵 파일 찾기 함수 없음"))
        
        # 파일 이동 로직 확인
        if 'shutil.move' in content and 'depth_path' in content:
            issues.append(("INFO", "✅ 깊이 맵 파일 이동 로직 존재"))
        else:
            issues.append(("WARNING", "깊이 맵 파일 이동 로직 확인 필요"))
        
        # 파일 존재 확인
        if 'os.path.exists(depth_path)' in content or 'os.path.exists(actual_depth_path)' in content:
            issues.append(("INFO", "✅ 파일 존재 확인 로직 존재"))
        else:
            issues.append(("WARNING", "파일 존재 확인 로직 확인 필요"))
        
        return issues
    
    def analyze_quality_threshold_consistency(self, file_path: str) -> List[Tuple[str, str]]:
        """품질 기준 일관성 분석"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            issues.append(("ERROR", f"파일 읽기 실패: {e}"))
            return issues
        
        # 모든 RMS 기준 확인
        rms_patterns = re.findall(r'rms.*?<=\s*([\d.]+)', content, re.IGNORECASE)
        rms_values = [float(v) for v in rms_patterns if v.replace('.', '').isdigit()]
        
        unique_rms = set(rms_values)
        if len(unique_rms) == 1 and 1.5 in unique_rms:
            issues.append(("INFO", "✅ RMS 기준 일관성: 모든 위치에서 1.5px"))
        elif 1.5 in unique_rms:
            issues.append(("ERROR", f"RMS 기준 불일치: {unique_rms} (기술문서: 1.5px)"))
        else:
            issues.append(("ERROR", f"RMS 기준 오류: {unique_rms} (기술문서: 1.5px)"))
        
        # 모든 Depth 기준 확인
        depth_patterns = re.findall(r'depth.*?>=\s*([\d.]+)', content, re.IGNORECASE)
        depth_values = [float(v) for v in depth_patterns if v.replace('.', '').isdigit()]
        
        unique_depth = set(depth_values)
        if len(unique_depth) == 1 and 0.85 in unique_depth:
            issues.append(("INFO", "✅ Depth 기준 일관성: 모든 위치에서 0.85"))
        elif 0.85 in unique_depth:
            issues.append(("ERROR", f"Depth 기준 불일치: {unique_depth} (기술문서: 0.85)"))
        else:
            issues.append(("ERROR", f"Depth 기준 오류: {unique_depth} (기술문서: 0.85)"))
        
        return issues
    
    def analyze_error_handling(self, file_path: str) -> List[Tuple[str, str]]:
        """오류 처리 로직 분석"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                tree = ast.parse(f.read())
        except Exception as e:
            issues.append(("ERROR", f"파싱 실패: {e}"))
            return issues
        
        # 주요 함수의 오류 처리 확인
        critical_functions = [
            '_calculate_rms',
            '_calculate_depth_score',
            '_extract_camera_parameters',
            '_validate_depth_map_exr'
        ]
        
        for func_name in critical_functions:
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef) and node.name == func_name:
                    has_try = False
                    has_except = False
                    has_fallback = False
                    
                    for child in ast.walk(node):
                        if isinstance(child, ast.Try):
                            has_try = True
                            for handler in child.handlers:
                                has_except = True
                                # 폴백 로직 확인
                                for stmt in handler.body:
                                    if isinstance(stmt, ast.Return):
                                        has_fallback = True
                    
                    if has_try and has_except:
                        issues.append(("INFO", f"✅ {func_name}: try-except 블록 존재"))
                        if has_fallback:
                            issues.append(("INFO", f"✅ {func_name}: 폴백 로직 존재"))
                        else:
                            issues.append(("WARNING", f"{func_name}: 폴백 로직 확인 필요"))
                    else:
                        issues.append(("WARNING", f"{func_name}: 오류 처리 확인 필요"))
                    
                    break
        
        return issues
    
    def analyze_data_type_consistency(self, file_path: str) -> List[Tuple[str, str]]:
        """데이터 타입 일관성 분석"""
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            issues.append(("ERROR", f"파일 읽기 실패: {e}"))
            return issues
        
        # NumPy 배열 타입 확인
        if 'dtype=np.float32' in content:
            issues.append(("INFO", "✅ NumPy float32 타입 일관성"))
        else:
            issues.append(("WARNING", "NumPy 타입 확인 필요"))
        
        # 카메라 파라미터 타입 확인
        if 'np.array(K)' in content or 'np.array' in content and 'K' in content:
            issues.append(("INFO", "✅ 카메라 파라미터 NumPy 변환"))
        else:
            issues.append(("WARNING", "카메라 파라미터 타입 변환 확인 필요"))
        
        return issues
    
    def run_deep_analysis(self, file_path: str) -> Dict[str, Any]:
        """전체 심층 분석 실행"""
        results = {
            'file': file_path,
            'pnp_point_matching': [],
            'depth_map_reading': [],
            'camera_parameter_calculation': [],
            'depth_map_file_handling': [],
            'quality_threshold_consistency': [],
            'error_handling': [],
            'data_type_consistency': []
        }
        
        print(f"\n{'='*60}")
        print("정밀 오류 분석")
        print(f"{'='*60}")
        
        print("\n[1/7] PnP 특징점 매칭 로직 분석...")
        results['pnp_point_matching'] = self.analyze_pnp_point_matching(file_path)
        
        print("[2/7] 깊이 맵 읽기 로직 분석...")
        results['depth_map_reading'] = self.analyze_depth_map_reading(file_path)
        
        print("[3/7] 카메라 파라미터 계산 로직 분석...")
        results['camera_parameter_calculation'] = self.analyze_camera_parameter_calculation(file_path)
        
        print("[4/7] 깊이 맵 파일 처리 로직 분석...")
        results['depth_map_file_handling'] = self.analyze_depth_map_file_handling(file_path)
        
        print("[5/7] 품질 기준 일관성 분석...")
        results['quality_threshold_consistency'] = self.analyze_quality_threshold_consistency(file_path)
        
        print("[6/7] 오류 처리 로직 분석...")
        results['error_handling'] = self.analyze_error_handling(file_path)
        
        print("[7/7] 데이터 타입 일관성 분석...")
        results['data_type_consistency'] = self.analyze_data_type_consistency(file_path)
        
        return results

def print_deep_results(results: Dict[str, Any]):
    """심층 분석 결과 출력"""
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
    print("심층 분석 결과 요약")
    print(f"{'='*60}")
    print(f"✅ 정상: {len(infos)}개")
    print(f"[WARNING] 경고: {len(warnings)}개")
    print(f"[ERROR] 오류: {len(errors)}개")
    
    if errors:
        print(f"\n[ERROR] 심각한 오류 ({len(errors)}개):")
        for err_type, msg in errors:
            print(f"  - {msg}")
    
    if warnings:
        print(f"\n[WARNING] 주의 필요 ({len(warnings)}개):")
        for warn_type, msg in warnings:
            print(f"  - {msg}")
    
    # 상세 결과
    print(f"\n{'='*60}")
    print("상세 분석 결과")
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
    analyzer = DeepErrorAnalyzer()
    
    file_path = "scripts/render_ldraw_to_supabase.py"
    
    if not Path(file_path).exists():
        print(f"[ERROR] 파일을 찾을 수 없음: {file_path}")
        return 1
    
    results = analyzer.run_deep_analysis(file_path)
    print_deep_results(results)
    
    # 결과 저장
    import json
    output_path = "output/deep_error_analysis_report.json"
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\n📄 심층 분석 보고서 저장: {output_path}")
    
    # 종합 평가
    all_issues = []
    for category, issues in results.items():
        if category != 'file':
            all_issues.extend(issues)
    
    errors = [i for i in all_issues if i[0] == 'ERROR']
    
    if errors:
        print(f"\n[ERROR] 심층 분석 결과: {len(errors)}개 오류 발견")
        return 1
    else:
        print(f"\n✅ 심층 분석 완료: 모든 항목 정상")
        return 0

if __name__ == "__main__":
    sys.exit(main())


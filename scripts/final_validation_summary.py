#!/usr/bin/env python3
"""
최종 검증 요약 스크립트
"""

import json
import sys
from pathlib import Path

def main():
    """메인 함수"""
    print("=" * 60)
    print("최종 검증 요약")
    print("=" * 60)
    
    # 검증 보고서 읽기
    reports = {
        'implementation': Path("output/implementation_validation_report.json"),
        'deep_analysis': Path("output/deep_error_analysis_report.json")
    }
    
    all_issues = []
    
    for name, path in reports.items():
        if not path.exists():
            print(f"\n[WARNING] {name} 보고서 없음: {path}")
            continue
        
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"\n[{name}]")
        
        for category, issues in data.items():
            if category == 'file' or not issues:
                continue
            
            for issue_type, msg in issues:
                all_issues.append((issue_type, msg))
                if issue_type == 'ERROR':
                    print(f"  [ERROR] {msg}")
                elif issue_type == 'WARNING':
                    print(f"  [WARNING] {msg}")
    
    # 통계
    errors = [i for i in all_issues if i[0] == 'ERROR']
    warnings = [i for i in all_issues if i[0] == 'WARNING']
    infos = [i for i in all_issues if i[0] == 'INFO']
    
    print(f"\n{'='*60}")
    print("최종 통계")
    print(f"{'='*60}")
    print(f"✅ 정상: {len(infos)}개")
    print(f"[WARNING] 경고: {len(warnings)}개")
    print(f"[ERROR] 오류: {len(errors)}개")
    
    if errors:
        print(f"\n[ERROR] 오류 목록:")
        for err_type, msg in errors:
            print(f"  - {msg}")
    
    # 코드 직접 확인
    print(f"\n{'='*60}")
    print("코드 직접 확인")
    print(f"{'='*60}")
    
    script_file = Path("scripts/render_ldraw_to_supabase.py")
    content = script_file.read_text(encoding='utf-8')
    
    checks = [
        ("3D-2D 점 동기화", 'if co_ndc.z >= 0' in content and 'obj_points_3d.append' in content and 'img_points_2d.append' in content),
        ("길이 불일치 검사", 'len(obj_points_3d) != len(img_points_2d)' in content),
        ("PnP 파라미터", 'cv2.SOLVEPNP_SQPNP' in content and 'iterationsCount=300' in content),
        ("깊이 맵 공식", '0.4 * valid_ratio' in content and '0.3 *' in content and 'edge_smoothness' in content),
        ("RMS 기준 1.5px", 'rms <= 1.5' in content or 'reprojection_rms <= 1.5' in content),
        ("Depth 기준 0.85", 'depth_score >= 0.85' in content or 'depth >= 0.85' in content)
    ]
    
    for check_name, passed in checks:
        status = "✅" if passed else "[ERROR]"
        print(f"{status} {check_name}")
    
    if not errors and all(p for _, p in checks):
        print(f"\n✅ 모든 검증 통과!")
        return 0
    else:
        print(f"\n[WARNING] 검증 완료 (일부 항목 확인 필요)")
        return 1

if __name__ == "__main__":
    sys.exit(main())


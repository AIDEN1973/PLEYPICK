#!/usr/bin/env python3
"""
버전 관리 시스템 호환성 확인 스크립트
새로운 완벽한 폴더 구조와 기존 버전 관리 시스템의 호환성을 확인
"""

import os
import json
from pathlib import Path
from datetime import datetime

def check_version_management_compatibility():
    """버전 관리 시스템 호환성 확인"""
    print("=" * 60)
    print("버전 관리 시스템 호환성 확인")
    print("=" * 60)
    
    # 경로 설정
    output_dir = Path("output")
    datasets_dir = output_dir / "datasets"
    synthetic_dir = output_dir / "synthetic"
    versions_file = output_dir / "dataset_versions.json"
    
    compatibility_report = {
        "timestamp": datetime.now().isoformat(),
        "checks": [],
        "issues": [],
        "recommendations": []
    }
    
    # 1. 폴더 구조 확인
    print("\n1. 폴더 구조 확인")
    check_folder_structure(datasets_dir, synthetic_dir, compatibility_report)
    
    # 2. 버전 메타데이터 확인
    print("\n2. 버전 메타데이터 확인")
    check_version_metadata(versions_file, compatibility_report)
    
    # 3. 파일 구조 일관성 확인
    print("\n3. 파일 구조 일관성 확인")
    check_file_structure_consistency(datasets_dir, synthetic_dir, compatibility_report)
    
    # 4. API 호환성 확인
    print("\n4. API 호환성 확인")
    check_api_compatibility(compatibility_report)
    
    # 5. 보고서 생성
    print("\n5. 호환성 보고서 생성")
    generate_compatibility_report(compatibility_report)
    
    return compatibility_report

def check_folder_structure(datasets_dir, synthetic_dir, report):
    """폴더 구조 확인"""
    checks = []
    
    # 기존 구조 확인
    current_dir = datasets_dir / "current"
    if current_dir.exists():
        checks.append({
            "check": "기존 current 폴더 존재",
            "status": "OK",
            "path": str(current_dir)
        })
    else:
        checks.append({
            "check": "기존 current 폴더 존재",
            "status": "MISSING",
            "path": str(current_dir)
        })
    
    # 새로운 구조 확인
    synthetic_synthetic_dir = synthetic_dir / "synthetic"
    if synthetic_synthetic_dir.exists():
        checks.append({
            "check": "새로운 synthetic 폴더 존재",
            "status": "OK",
            "path": str(synthetic_synthetic_dir)
        })
        
        # 하위 폴더 확인
        subfolders = ["images", "labels", "meta", "meta-e"]
        for subfolder in subfolders:
            subfolder_path = synthetic_synthetic_dir / subfolder
            if subfolder_path.exists():
                checks.append({
                    "check": f"{subfolder} 폴더 존재",
                    "status": "OK",
                    "path": str(subfolder_path)
                })
            else:
                checks.append({
                    "check": f"{subfolder} 폴더 존재",
                    "status": "MISSING",
                    "path": str(subfolder_path)
                })
    else:
        checks.append({
            "check": "새로운 synthetic 폴더 존재",
            "status": "MISSING",
            "path": str(synthetic_synthetic_dir)
        })
    
    report["checks"].extend(checks)
    
    # 결과 출력
    for check in checks:
        status_icon = "[OK]" if check["status"] == "OK" else "[FAIL]"
        print(f"  {status_icon} {check['check']}: {check['status']}")

def check_version_metadata(versions_file, report):
    """버전 메타데이터 확인"""
    checks = []
    
    if versions_file.exists():
        try:
            with open(versions_file, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            checks.append({
                "check": "버전 메타데이터 파일 존재",
                "status": "OK",
                "path": str(versions_file)
            })
            
            # 버전 정보 확인
            versions = metadata.get("versions", [])
            checks.append({
                "check": "버전 정보 존재",
                "status": "OK" if versions else "EMPTY",
                "count": len(versions)
            })
            
            # 현재 버전 확인
            current_versions = [v for v in versions if v.get("is_current", False)]
            checks.append({
                "check": "현재 버전 설정",
                "status": "OK" if current_versions else "MISSING",
                "count": len(current_versions)
            })
            
            # 경로 일관성 확인
            for version in versions:
                version_path = Path(version.get("path", ""))
                if version_path.exists():
                    checks.append({
                        "check": f"버전 {version['version']} 경로 유효",
                        "status": "OK",
                        "path": str(version_path)
                    })
                else:
                    checks.append({
                        "check": f"버전 {version['version']} 경로 유효",
                        "status": "INVALID",
                        "path": str(version_path)
                    })
            
        except Exception as e:
            checks.append({
                "check": "버전 메타데이터 파일 파싱",
                "status": "ERROR",
                "error": str(e)
            })
    else:
        checks.append({
            "check": "버전 메타데이터 파일 존재",
            "status": "MISSING",
            "path": str(versions_file)
        })
    
    report["checks"].extend(checks)
    
    # 결과 출력
    for check in checks:
        status_icon = "[OK]" if check["status"] == "OK" else "[FAIL]"
        print(f"  {status_icon} {check['check']}: {check['status']}")

def check_file_structure_consistency(datasets_dir, synthetic_dir, report):
    """파일 구조 일관성 확인"""
    checks = []
    
    # 기존 구조 파일 수
    current_dir = datasets_dir / "current"
    if current_dir.exists():
        old_images = len(list((current_dir / "images").glob("*.webp"))) if (current_dir / "images").exists() else 0
        old_labels = len(list((current_dir / "labels").glob("*.txt"))) if (current_dir / "labels").exists() else 0
        old_metadata = len(list((current_dir / "metadata").glob("*.json"))) if (current_dir / "metadata").exists() else 0
        
        checks.append({
            "check": "기존 구조 파일 수",
            "status": "OK",
            "counts": {
                "images": old_images,
                "labels": old_labels,
                "metadata": old_metadata
            }
        })
    
    # 새로운 구조 파일 수
    synthetic_synthetic_dir = synthetic_dir / "synthetic"
    if synthetic_synthetic_dir.exists():
        new_images = len(list((synthetic_synthetic_dir / "images").glob("*.webp"))) if (synthetic_synthetic_dir / "images").exists() else 0
        new_labels = len(list((synthetic_synthetic_dir / "labels").glob("*.txt"))) if (synthetic_synthetic_dir / "labels").exists() else 0
        new_meta = len(list((synthetic_synthetic_dir / "meta").glob("*.json"))) if (synthetic_synthetic_dir / "meta").exists() else 0
        new_meta_e = len(list((synthetic_synthetic_dir / "meta-e").glob("*_e2.json"))) if (synthetic_synthetic_dir / "meta-e").exists() else 0
        
        checks.append({
            "check": "새로운 구조 파일 수",
            "status": "OK",
            "counts": {
                "images": new_images,
                "labels": new_labels,
                "meta": new_meta,
                "meta_e": new_meta_e
            }
        })
    
    report["checks"].extend(checks)
    
    # 결과 출력
    for check in checks:
        status_icon = "[OK]" if check["status"] == "OK" else "[FAIL]"
        print(f"  {status_icon} {check['check']}: {check['status']}")
        if "counts" in check:
            for file_type, count in check["counts"].items():
                print(f"    - {file_type}: {count}개")

def check_api_compatibility(report):
    """API 호환성 확인"""
    checks = []
    
    # API 파일 존재 확인
    api_file = Path("server/synthetic-api.js")
    if api_file.exists():
        checks.append({
            "check": "API 파일 존재",
            "status": "OK",
            "path": str(api_file)
        })
        
        # API 파일 내용 확인
        try:
            with open(api_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 새로운 경로 참조 확인
            if "output/synthetic/synthetic" in content:
                checks.append({
                    "check": "새로운 경로 참조",
                    "status": "OK",
                    "note": "새로운 폴더 구조 참조됨"
                })
            else:
                checks.append({
                    "check": "새로운 경로 참조",
                    "status": "MISSING",
                    "note": "기존 경로 참조됨"
                })
            
            # 메타데이터 카운트 로직 확인
            if "meta_e" in content:
                checks.append({
                    "check": "E2 메타데이터 카운트",
                    "status": "OK",
                    "note": "E2 메타데이터 카운트 로직 포함됨"
                })
            else:
                checks.append({
                    "check": "E2 메타데이터 카운트",
                    "status": "MISSING",
                    "note": "E2 메타데이터 카운트 로직 없음"
                })
                
        except Exception as e:
            checks.append({
                "check": "API 파일 내용 확인",
                "status": "ERROR",
                "error": str(e)
            })
    else:
        checks.append({
            "check": "API 파일 존재",
            "status": "MISSING",
            "path": str(api_file)
        })
    
    report["checks"].extend(checks)
    
    # 결과 출력
    for check in checks:
        status_icon = "[OK]" if check["status"] == "OK" else "[FAIL]"
        print(f"  {status_icon} {check['check']}: {check['status']}")

def generate_compatibility_report(report):
    """호환성 보고서 생성"""
    # 이슈 수집
    issues = []
    for check in report["checks"]:
        if check["status"] not in ["OK"]:
            issues.append({
                "type": check["check"],
                "status": check["status"],
                "details": check
            })
    
    report["issues"] = issues
    
    # 권장사항 생성
    recommendations = []
    
    if any(issue["type"] == "기존 current 폴더 존재" and issue["status"] == "MISSING" for issue in issues):
        recommendations.append({
            "priority": "HIGH",
            "action": "기존 current 폴더를 새로운 구조로 마이그레이션",
            "command": "python scripts/update_version_management.py"
        })
    
    if any(issue["type"] == "새로운 synthetic 폴더 존재" and issue["status"] == "MISSING" for issue in issues):
        recommendations.append({
            "priority": "HIGH",
            "action": "새로운 폴더 구조 생성",
            "command": "python scripts/render_with_perfect_structure.py --part-id 003238a --element-id 003238a --count 5"
        })
    
    if any(issue["type"] == "새로운 경로 참조" and issue["status"] == "MISSING" for issue in issues):
        recommendations.append({
            "priority": "MEDIUM",
            "action": "API 파일의 경로 참조 업데이트",
            "note": "server/synthetic-api.js 파일 수정 필요"
        })
    
    report["recommendations"] = recommendations
    
    # 보고서 저장
    report_file = Path("output/compatibility_report.json")
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    # 결과 출력
    print(f"\n[REPORT] 호환성 보고서 생성: {report_file}")
    print(f"  - 총 체크 항목: {len(report['checks'])}")
    print(f"  - 이슈 수: {len(report['issues'])}")
    print(f"  - 권장사항 수: {len(report['recommendations'])}")
    
    if report["issues"]:
        print(f"\n[WARN] 발견된 이슈:")
        for issue in report["issues"]:
            print(f"  - {issue['type']}: {issue['status']}")
    
    if report["recommendations"]:
        print(f"\n[INFO] 권장사항:")
        for rec in report["recommendations"]:
            print(f"  [{rec['priority']}] {rec['action']}")
            if "command" in rec:
                print(f"    명령어: {rec['command']}")

def main():
    """메인 실행 함수"""
    try:
        report = check_version_management_compatibility()
        
        # 전체 상태 판단
        total_checks = len(report["checks"])
        ok_checks = len([c for c in report["checks"] if c["status"] == "OK"])
        compatibility_score = (ok_checks / total_checks * 100) if total_checks > 0 else 0
        
        print("\n" + "=" * 60)
        print(f"호환성 점수: {compatibility_score:.1f}% ({ok_checks}/{total_checks})")
        
        if compatibility_score >= 80:
            print("[OK] 호환성 양호 - 새로운 폴더 구조 사용 가능")
        elif compatibility_score >= 60:
            print("[WARN] 호환성 보통 - 일부 수정 필요")
        else:
            print("[FAIL] 호환성 불량 - 대규모 수정 필요")
        
        print("=" * 60)
        
        return compatibility_score >= 60
        
    except Exception as e:
        print(f"\n[ERROR] 호환성 확인 중 오류 발생: {e}")
        return False

if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)

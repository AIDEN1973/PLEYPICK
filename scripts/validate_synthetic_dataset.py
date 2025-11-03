#!/usr/bin/env python3
"""
BrickBox 합성 데이터셋 정밀 점검 스크립트
- 디렉토리 구조 정합성
- 파일 매칭 (이미지-txt-json)
- JSON 스키마 검증 (e1, e2)
- 라벨 파일 형식 검증
- 이미지 품질 검증
- 기술문서 기준 준수 여부
"""

import json
import sys
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Tuple, Optional
import hashlib

# 프로젝트 루트 경로
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

def validate_directory_structure(synthetic_dir: Path) -> Dict:
    """디렉토리 구조 정합성 검증"""
    issues = []
    structure_ok = True
    
    # 예상 구조 확인
    expected_structure = {
        'images': '이미지 폴더',
        'labels': '라벨 폴더',
        'meta': 'Full 메타데이터 폴더 (e1)',
        'meta-e': 'Essential 메타데이터 폴더 (e2)'
    }
    
    for folder_name, desc in expected_structure.items():
        folder_path = synthetic_dir / folder_name
        if not folder_path.exists():
            issues.append(f"[ERROR] 누락: {folder_name}/ ({desc})")
            structure_ok = False
        elif not folder_path.is_dir():
            issues.append(f"[ERROR] 폴더가 아님: {folder_name}/")
            structure_ok = False
    
    return {
        'valid': structure_ok,
        'issues': issues,
        'structure': expected_structure
    }

def find_matching_files(synthetic_dir: Path) -> Dict[str, List[Dict]]:
    """이미지-txt-json 파일 매칭"""
    images_dir = synthetic_dir / 'images'
    labels_dir = synthetic_dir / 'labels'
    meta_dir = synthetic_dir / 'meta'
    meta_e_dir = synthetic_dir / 'meta-e'
    
    # 모든 이미지 파일 찾기
    image_files = {}
    if images_dir.exists():
        for img_file in images_dir.rglob('*.webp'):
            stem = img_file.stem
            image_files[stem] = img_file
    
    # 매칭 결과
    matches = []
    missing_labels = []
    missing_meta = []
    missing_meta_e = []
    
    for stem, img_file in image_files.items():
        match = {
            'stem': stem,
            'image': img_file,
            'label': None,
            'meta': None,
            'meta_e': None,
            'all_present': False
        }
        
        # 라벨 파일 찾기
        label_file = labels_dir / f"{stem}.txt"
        if not label_file.exists():
            label_file = labels_dir / f"{img_file.name.replace('.webp', '.txt')}"
        
        if label_file.exists():
            match['label'] = str(label_file)  # [FIX] 수정됨: Path를 str로 변환
        else:
            missing_labels.append(stem)
        
        # Full 메타 찾기 (e1)
        meta_file = meta_dir / f"{stem}.json"
        if not meta_file.exists():
            meta_file = meta_dir / f"{img_file.name.replace('.webp', '.json')}"
        
        if meta_file.exists():
            match['meta'] = str(meta_file)  # [FIX] 수정됨: Path를 str로 변환
        else:
            missing_meta.append(stem)
        
        # Essential 메타 찾기 (e2) - 실제 파일명 패턴 확인
        meta_e_file = None
        # 여러 가능한 패턴 시도
        patterns = [
            f"{stem}.json",  # 가장 일반적
            f"{stem}_e2.json",
            f"{img_file.name.replace('.webp', '.json')}",
            f"{img_file.name.replace('.webp', '_e2.json')}",
            f"{img_file.name.replace('.webp', '.e2.json')}"
        ]
        for pattern in patterns:
            candidate = meta_e_dir / pattern
            if candidate.exists():
                meta_e_file = candidate
                break
        
        if meta_e_file and meta_e_file.exists():
            match['meta_e'] = str(meta_e_file)  # [FIX] 수정됨: Path를 str로 변환
        else:
            missing_meta_e.append(stem)
        
        match['all_present'] = all([
            match['image'] is not None,
            match['label'] is not None,
            match['meta'] is not None,
            match['meta_e'] is not None
        ])
        
        matches.append(match)
    
    return {
        'matches': matches,
        'total_images': len(image_files),
        'complete_matches': sum(1 for m in matches if m['all_present']),
        'missing_labels': len(missing_labels),
        'missing_meta': len(missing_meta),
        'missing_meta_e': len(missing_meta_e),
        'missing_labels_list': missing_labels[:10],  # 샘플만
        'missing_meta_list': missing_meta[:10],
        'missing_meta_e_list': missing_meta_e[:10]
    }

def validate_json_schema(file_path: Path, schema_type: str) -> Dict:
    """JSON 스키마 검증 (e1 또는 e2)"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return {
            'valid': False,
            'error': f'JSON 파싱 오류: {e}',
            'schema_type': schema_type
        }
    except Exception as e:
        return {
            'valid': False,
            'error': f'파일 읽기 오류: {e}',
            'schema_type': schema_type
        }
    
    issues = []
    
    if schema_type == 'e1':  # Full Meta (v1.6.1)
        # 기술문서 기준 필수 필드 (렌더링 메타 + AI 메타)
        # 렌더링 메타 기본 필드
        render_fields = ['schema_version', 'part_id', 'element_id']
        
        # AI 메타 필수 필드 (기술문서 2.1 기준)
        ai_fields = ['set_id', 'shape_tag', 'series', 'stud_count_top', 'tube_count_bottom']
        
        # 렌더링 메타는 항상 있어야 함
        for field in render_fields:
            if field not in data:
                issues.append(f"필수 필드 누락 (렌더링 메타): {field}")
        
        # AI 메타 필드는 선택적 (LLM 생성 전에는 없을 수 있음)
        missing_ai_fields = [f for f in ai_fields if f not in data]
        if missing_ai_fields:
            issues.append(f"AI 메타 필드 누락 (LLM 생성 필요): {', '.join(missing_ai_fields)}")
        
        # schema_version 확인
        if 'schema_version' in data:
            version = data['schema_version']
            if not (version.startswith('1.6.1') or version.startswith('2.0')):
                issues.append(f"스키마 버전 형식 이상: {version}")
        
        # 품질 메트릭 확인 (기술문서 기준)
        if 'quality_metrics' in data:
            qm = data['quality_metrics']
            if 'ssim' in qm and qm['ssim'] < 0.965:
                issues.append(f"SSIM 미달: {qm['ssim']:.4f} (기준: ≥0.965)")
            if 'snr' in qm and qm['snr'] < 30:
                issues.append(f"SNR 미달: {qm['snr']:.2f} (기준: ≥30)")
            if 'reprojection_rms_px' in qm and qm['reprojection_rms_px'] > 1.5:
                issues.append(f"재투영 RMS 초과: {qm['reprojection_rms_px']:.2f} (기준: ≤1.5px)")
            if 'depth_score' in qm and qm['depth_score'] < 0.85:
                issues.append(f"깊이 점수 미달: {qm['depth_score']:.4f} (기준: ≥0.85)")
    elif schema_type == 'e2':  # Essential Meta (v1.6.1-E2)
        required_fields = [
            'schema_version', 'part_id', 'annotation', 'qa'
        ]
        
        for field in required_fields:
            if field not in data:
                issues.append(f"필수 필드 누락: {field}")
        
        # schema_version 확인
        if 'schema_version' in data:
            version = data['schema_version']
            if not 'E2' in version:
                issues.append(f"E2 스키마 버전 형식 이상: {version}")
        
        # annotation 구조 확인
        if 'annotation' in data:
            annot = data['annotation']
            required_annot = ['bbox_pixel_xyxy', 'bbox_norm_xyxy']
            for field in required_annot:
                if field not in annot:
                    issues.append(f"annotation 필수 필드 누락: {field}")
    
    return {
        'valid': len(issues) == 0,
        'issues': issues,
        'schema_type': schema_type,
        'has_data': True
    }

def validate_label_format(label_file: Path) -> Dict:
    """YOLO 라벨 파일 형식 검증"""
    try:
        with open(label_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except Exception as e:
        return {
            'valid': False,
            'error': f'파일 읽기 오류: {e}'
        }
    
    issues = []
    valid_lines = 0
    
    for line_num, line in enumerate(lines, 1):
        line = line.strip()
        if not line:
            continue
        
        parts = line.split()
        if len(parts) < 5:
            issues.append(f"라인 {line_num}: 형식 오류 (최소 5개 값 필요: class x y w h ...)")
            continue
        
        try:
            class_id = int(parts[0])
            coords = [float(p) for p in parts[1:]]
            
            # 좌표 개수 확인 (bbox: 4개, seg: 최소 6개)
            if len(coords) < 4:
                issues.append(f"라인 {line_num}: 좌표 부족 (최소 4개 필요: bbox)")
                continue
            
            # 정규화 좌표 범위 확인 (0.0 ~ 1.0)
            for i, coord in enumerate(coords[:4]):  # bbox만 확인
                if not (0.0 <= coord <= 1.0):
                    issues.append(f"라인 {line_num}: 좌표 {i+1} 범위 오류 ({coord}, 예상: 0.0~1.0)")
            
            valid_lines += 1
        except ValueError as e:
            issues.append(f"라인 {line_num}: 숫자 파싱 오류: {e}")
    
    return {
        'valid': len(issues) == 0 and valid_lines > 0,
        'issues': issues,
        'valid_lines': valid_lines,
        'total_lines': len([l for l in lines if l.strip()])
    }

def validate_image_quality(image_file: Path) -> Dict:
    """이미지 품질 검증 (WebP 형식, 크기 등)"""
    issues = []
    
    if not image_file.exists():
        return {
            'valid': False,
            'error': '파일이 존재하지 않음'
        }
    
    # 파일 크기 확인
    file_size = image_file.stat().st_size
    if file_size < 1024:  # 1KB 미만
        issues.append(f"파일 크기 이상: {file_size} bytes (너무 작음)")
    elif file_size > 10 * 1024 * 1024:  # 10MB 초과
        issues.append(f"파일 크기 이상: {file_size / 1024 / 1024:.2f} MB (너무 큼)")
    
    # 확장자 확인
    if image_file.suffix.lower() not in ['.webp', '.jpg', '.jpeg', '.png']:
        issues.append(f"지원하지 않는 이미지 형식: {image_file.suffix}")
    
    # WebP 형식 확인 (PIL 사용 가능 시)
    try:
        from PIL import Image
        with Image.open(image_file) as img:
            if img.format != 'WEBP' and image_file.suffix.lower() == '.webp':
                issues.append(f"WebP 형식이 아님: 실제 형식={img.format}")
            
            # 해상도 확인
            width, height = img.size
            if width < 100 or height < 100:
                issues.append(f"해상도 낮음: {width}x{height}")
            elif width > 4096 or height > 4096:
                issues.append(f"해상도 높음: {width}x{height} (메모리 부족 가능)")
    except ImportError:
        pass  # PIL 없으면 스킵
    except Exception as e:
        issues.append(f"이미지 검증 오류: {e}")
    
    return {
        'valid': len(issues) == 0,
        'issues': issues,
        'file_size': file_size
    }

def generate_comprehensive_report(synthetic_dir: Path) -> Dict:
    """종합 검증 보고서 생성"""
    report = {
        'directory': str(synthetic_dir),
        'timestamp': None,
        'structure': None,
        'file_matching': None,
        'json_validation': {
            'e1': {'total': 0, 'valid': 0, 'invalid': 0, 'issues': []},
            'e2': {'total': 0, 'valid': 0, 'invalid': 0, 'issues': []}
        },
        'label_validation': {
            'total': 0,
            'valid': 0,
            'invalid': 0,
            'issues': []
        },
        'image_validation': {
            'total': 0,
            'valid': 0,
            'invalid': 0,
            'issues': []
        },
        'summary': {
            'total_issues': 0,
            'critical_issues': [],
            'warnings': []
        }
    }
    
    from datetime import datetime
    report['timestamp'] = datetime.now().isoformat()
    
    # 1. 디렉토리 구조 검증
    print("[1/5] 디렉토리 구조 검증 중...")
    structure_result = validate_directory_structure(synthetic_dir)
    report['structure'] = structure_result
    
    if not structure_result['valid']:
        report['summary']['critical_issues'].extend(structure_result['issues'])
    
    # 2. 파일 매칭 검증
    print("[2/5] 파일 매칭 검증 중...")
    matching_result = find_matching_files(synthetic_dir)
    report['file_matching'] = matching_result
    
    if matching_result['missing_labels'] > 0:
        report['summary']['warnings'].append(f"라벨 파일 누락: {matching_result['missing_labels']}개")
    if matching_result['missing_meta'] > 0:
        report['summary']['warnings'].append(f"Full 메타 누락: {matching_result['missing_meta']}개")
    if matching_result['missing_meta_e'] > 0:
        report['summary']['warnings'].append(f"Essential 메타 누락: {matching_result['missing_meta_e']}개")
    
    # 3. JSON 스키마 검증 (샘플링)
    print("[3/5] JSON 스키마 검증 중...")
    matches = matching_result['matches']
    samples = matches[:20] if len(matches) > 20 else matches  # 최대 20개 샘플
    
    for match in samples:
        # E1 (Full Meta) 검증
        if match['meta']:
            e1_result = validate_json_schema(Path(match['meta']), 'e1')
            report['json_validation']['e1']['total'] += 1
            if e1_result['valid']:
                report['json_validation']['e1']['valid'] += 1
            else:
                report['json_validation']['e1']['invalid'] += 1
                report['json_validation']['e1']['issues'].append({
                    'file': str(match['meta']),
                    'issues': e1_result.get('issues', [])
                })
        
        # E2 (Essential Meta) 검증
        if match['meta_e']:
            e2_result = validate_json_schema(Path(match['meta_e']), 'e2')
            report['json_validation']['e2']['total'] += 1
            if e2_result['valid']:
                report['json_validation']['e2']['valid'] += 1
            else:
                report['json_validation']['e2']['invalid'] += 1
                report['json_validation']['e2']['issues'].append({
                    'file': str(match['meta_e']),
                    'issues': e2_result.get('issues', [])
                })
    
    # 4. 라벨 파일 검증 (샘플링)
    print("[4/5] 라벨 파일 검증 중...")
    label_samples = [m for m in samples if m['label']][:10]
    for match in label_samples:
        label_result = validate_label_format(Path(match['label']))
        report['label_validation']['total'] += 1
        if label_result['valid']:
            report['label_validation']['valid'] += 1
        else:
            report['label_validation']['invalid'] += 1
            if 'issues' in label_result:
                report['label_validation']['issues'].extend(label_result['issues'])
    
    # 5. 이미지 품질 검증 (샘플링)
    print("[5/5] 이미지 품질 검증 중...")
    image_samples = [m for m in samples if m['image']][:10]
    for match in image_samples:
        image_result = validate_image_quality(Path(match['image']))
        report['image_validation']['total'] += 1
        if image_result['valid']:
            report['image_validation']['valid'] += 1
        else:
            report['image_validation']['invalid'] += 1
            if 'issues' in image_result:
                report['image_validation']['issues'].extend(image_result['issues'])
    
    # 종합 요약
    report['summary']['total_issues'] = (
        len(report['summary']['critical_issues']) +
        len(report['summary']['warnings']) +
        report['json_validation']['e1']['invalid'] +
        report['json_validation']['e2']['invalid'] +
        report['label_validation']['invalid'] +
        report['image_validation']['invalid']
    )
    
    return report

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='BrickBox 합성 데이터셋 정밀 점검')
    parser.add_argument('--dir', type=str, default='output/synthetic', help='검증할 synthetic 디렉토리')
    parser.add_argument('--part-id', type=str, help='특정 부품 ID만 검증')
    parser.add_argument('--output', type=str, help='보고서 저장 경로 (JSON)')
    
    args = parser.parse_args()
    
    synthetic_base = Path(args.dir)
    if not synthetic_base.exists():
        print(f"[ERROR] 디렉토리가 존재하지 않습니다: {synthetic_base}")
        return 1
    
    # 특정 부품만 검증하는 경우
    if args.part_id:
        target_dir = synthetic_base / args.part_id
        if not target_dir.exists():
            print(f"[ERROR] 부품 디렉토리가 존재하지 않습니다: {target_dir}")
            return 1
        dirs_to_check = [target_dir]
    else:
        # 모든 부품 디렉토리 찾기
        dirs_to_check = [d for d in synthetic_base.iterdir() if d.is_dir() and not d.name.startswith('dataset')]
    
    print(f"[검증] {len(dirs_to_check)}개 디렉토리 검증 시작...")
    print("=" * 80)
    
    all_reports = []
    for target_dir in dirs_to_check:
        print(f"\n[대상] {target_dir.name}")
        print("-" * 80)
        
        report = generate_comprehensive_report(target_dir)
        all_reports.append({
            'part_id': target_dir.name,
            'report': report
        })
        
        # 콘솔 출력
        print(f"\n[결과 요약]")
        print(f"   디렉토리 구조: {'OK' if report['structure']['valid'] else 'FAIL'}")
        print(f"   파일 매칭:")
        print(f"     - 전체 이미지: {report['file_matching']['total_images']}개")
        print(f"     - 완전 매칭: {report['file_matching']['complete_matches']}개")
        print(f"     - 라벨 누락: {report['file_matching']['missing_labels']}개")
        print(f"     - Full 메타 누락: {report['file_matching']['missing_meta']}개")
        print(f"     - Essential 메타 누락: {report['file_matching']['missing_meta_e']}개")
        print(f"   JSON 검증:")
        print(f"     - E1 (Full): {report['json_validation']['e1']['valid']}/{report['json_validation']['e1']['total']} 유효")
        if report['json_validation']['e1']['invalid'] > 0:
            print(f"       이슈: {len(report['json_validation']['e1']['issues'])}개")
        print(f"     - E2 (Essential): {report['json_validation']['e2']['valid']}/{report['json_validation']['e2']['total']} 유효")
        if report['json_validation']['e2']['invalid'] > 0:
            print(f"       이슈: {len(report['json_validation']['e2']['issues'])}개")
        print(f"   라벨 검증: {report['label_validation']['valid']}/{report['label_validation']['total']} 유효")
        if report['label_validation']['invalid'] > 0:
            print(f"       이슈: {len(report['label_validation']['issues'])}개")
        print(f"   이미지 검증: {report['image_validation']['valid']}/{report['image_validation']['total']} 유효")
        if report['image_validation']['invalid'] > 0:
            print(f"       이슈: {len(report['image_validation']['issues'])}개")
        print(f"   총 이슈: {report['summary']['total_issues']}개")
        
        if report['summary']['critical_issues']:
            print(f"\n[중요 이슈]")
            for issue in report['summary']['critical_issues'][:5]:
                print(f"   - {issue}")
        
        if report['summary']['warnings']:
            print(f"\n[경고]")
            for warning in report['summary']['warnings'][:5]:
                print(f"   - {warning}")
    
    # 보고서 저장
    if args.output:
        output_path = Path(args.output)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(all_reports, f, indent=2, ensure_ascii=False)
        print(f"\n✅ 보고서 저장: {output_path}")
    
    return 0

if __name__ == '__main__':
    sys.exit(main())


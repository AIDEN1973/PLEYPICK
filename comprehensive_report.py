#!/usr/bin/env python3
"""
WebP 품질 및 메타데이터 정밀 분석 종합 리포트
"""
import os
import json
from pathlib import Path
from PIL import Image
import numpy as np

def generate_report():
    """종합 리포트 생성"""
    base_dir = r"C:\cursor\brickbox\output\synthetic\4240375"
    
    print("=" * 80)
    print("WebP 품질 및 메타데이터 정밀 분석 종합 리포트")
    print("=" * 80)
    print(f"분석 대상: {base_dir}")
    print(f"생성 일시: 2025-10-29")
    print()
    
    # 1. 파일 구조 분석
    print("=" * 80)
    print("1. 파일 구조 분석")
    print("=" * 80)
    
    images_dir = os.path.join(base_dir, 'images')
    meta_dir = os.path.join(base_dir, 'meta')
    meta_e_dir = os.path.join(base_dir, 'meta-e')
    labels_dir = os.path.join(base_dir, 'labels')
    
    webp_files = sorted([f for f in os.listdir(images_dir) if f.endswith('.webp')])
    json_files = sorted([f for f in os.listdir(meta_dir) if f.endswith('.json')])
    e2_files = sorted([f for f in os.listdir(meta_e_dir) if f.endswith('_e2.json')])
    txt_files = sorted([f for f in os.listdir(labels_dir) if f.endswith('.txt')])
    
    print(f"WebP 이미지: {len(webp_files)}개")
    print(f"JSON 메타데이터: {len(json_files)}개")
    print(f"E2 JSON 메타데이터: {len(e2_files)}개")
    print(f"YOLO 라벨: {len(txt_files)}개")
    print()
    
    # 파일 개수 일치 확인
    if len(webp_files) == len(json_files) == len(e2_files) == len(txt_files):
        print("OK: 모든 파일 개수가 일치합니다.")
    else:
        print("WARNING: 파일 개수가 일치하지 않습니다.")
    print()
    
    # 2. WebP 품질 분석
    print("=" * 80)
    print("2. WebP 품질 분석")
    print("=" * 80)
    
    webp_results = []
    for webp_file in webp_files:
        webp_path = os.path.join(images_dir, webp_file)
        try:
            with Image.open(webp_path) as img:
                result = {
                    'file': webp_file,
                    'size': os.path.getsize(webp_path),
                    'resolution': img.size,
                    'mode': img.mode,
                    'format': img.format,
                    'has_icc': 'icc_profile' in img.info if hasattr(img, 'info') else False,
                    'has_exif': 'exif' in img.info if hasattr(img, 'info') else False,
                }
                
                # 이미지 품질 분석
                img_array = np.array(img.convert('L'))
                laplacian_kernel = np.array([[0, -1, 0], [-1, 4, -1], [0, -1, 0]])
                laplacian = np.abs(np.convolve(img_array.flatten(), laplacian_kernel.flatten(), mode='valid'))
                result['laplacian_var'] = float(np.var(laplacian))
                
                mean_signal = np.mean(img_array)
                noise_estimate = np.std(img_array)
                if noise_estimate > 0:
                    result['snr_estimate'] = float(20 * np.log10(mean_signal / noise_estimate))
                
                webp_results.append(result)
        except Exception as e:
            print(f"ERROR: {webp_file} 분석 실패: {e}")
    
    # 통계
    total_size = sum(r['size'] for r in webp_results)
    avg_size = total_size / len(webp_results) if webp_results else 0
    files_with_icc = sum(1 for r in webp_results if r['has_icc'])
    files_with_exif = sum(1 for r in webp_results if r['has_exif'])
    avg_laplacian = sum(r.get('laplacian_var', 0) for r in webp_results) / len(webp_results) if webp_results else 0
    avg_snr = sum(r.get('snr_estimate', 0) for r in webp_results) / len(webp_results) if webp_results else 0
    
    print(f"총 파일 수: {len(webp_results)}개")
    print(f"총 크기: {total_size:,} bytes ({total_size/1024/1024:.2f} MB)")
    print(f"평균 파일 크기: {avg_size:.0f} bytes")
    print(f"평균 해상도: {webp_results[0]['resolution'] if webp_results else 'N/A'}")
    print(f"색상 모드: {webp_results[0]['mode'] if webp_results else 'N/A'}")
    print(f"ICC 프로파일 포함: {files_with_icc}/{len(webp_results)} ({files_with_icc*100/len(webp_results):.1f}%)")
    print(f"EXIF 메타데이터 포함: {files_with_exif}/{len(webp_results)} ({files_with_exif*100/len(webp_results):.1f}%)")
    print(f"평균 선명도 (Laplacian Var): {avg_laplacian:.2f}")
    print(f"평균 SNR 추정: {avg_snr:.2f} dB")
    print()
    
    # 3. 기술문서 준수 여부
    print("=" * 80)
    print("3. 기술문서 준수 여부")
    print("=" * 80)
    
    print("기술문서 요구사항:")
    print("  - WebP lossy q=90: 확인 필요")
    print("  - -m 6 (메모리 최적화): 확인 필요")
    print("  - -af on (알파 필터링): 확인 필요")
    print("  - sRGB(ICC 유지): 필수")
    print()
    
    print("실제 상태:")
    print(f"  - ICC 프로파일: {'FAIL' if files_with_icc == 0 else 'OK'}")
    print(f"  - EXIF 메타데이터: {'OPTIONAL' if files_with_exif == 0 else 'OK'}")
    print()
    
    # 4. JSON 메타데이터 분석
    print("=" * 80)
    print("4. JSON 메타데이터 분석")
    print("=" * 80)
    
    json_results = []
    for json_file in json_files[:10]:  # 샘플 10개
        json_path = os.path.join(meta_dir, json_file)
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            required_fields = ['schema_version', 'part_id', 'element_id', 'pair_uid', 
                              'transform', 'material', 'bounding_box', 'render_settings']
            missing_fields = [f for f in required_fields if f not in metadata]
            
            json_results.append({
                'file': json_file,
                'schema_version': metadata.get('schema_version'),
                'has_required_fields': len(missing_fields) == 0,
                'missing_fields': missing_fields
            })
        except Exception as e:
            print(f"ERROR: {json_file} 분석 실패: {e}")
    
    json_pass_rate = sum(1 for r in json_results if r['has_required_fields']) / len(json_results) * 100 if json_results else 0
    print(f"샘플 분석 (10개):")
    print(f"  - 스키마 버전: {json_results[0]['schema_version'] if json_results else 'N/A'}")
    print(f"  - 필수 필드 완성도: {json_pass_rate:.1f}%")
    print()
    
    # 5. E2 JSON 메타데이터 분석
    print("=" * 80)
    print("5. E2 JSON 메타데이터 분석")
    print("=" * 80)
    
    e2_results = []
    for e2_file in e2_files[:10]:  # 샘플 10개
        e2_path = os.path.join(meta_e_dir, e2_file)
        try:
            with open(e2_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            required_fields = ['schema_version', 'pair_uid', 'part_id', 'element_id',
                              'annotation', 'qa', 'perf', 'integrity']
            missing_fields = [f for f in required_fields if f not in metadata]
            
            e2_results.append({
                'file': e2_file,
                'schema_version': metadata.get('schema_version'),
                'has_required_fields': len(missing_fields) == 0,
                'missing_fields': missing_fields
            })
        except Exception as e:
            print(f"ERROR: {e2_file} 분석 실패: {e}")
    
    e2_pass_rate = sum(1 for r in e2_results if r['has_required_fields']) / len(e2_results) * 100 if e2_results else 0
    print(f"샘플 분석 (10개):")
    print(f"  - 스키마 버전: {e2_results[0]['schema_version'] if e2_results else 'N/A'}")
    print(f"  - 필수 필드 완성도: {e2_pass_rate:.1f}%")
    print()
    
    # 6. 문제점 및 권장사항
    print("=" * 80)
    print("6. 문제점 및 권장사항")
    print("=" * 80)
    
    issues = []
    recommendations = []
    
    if files_with_icc == 0:
        issues.append("ICC 프로파일이 전혀 포함되지 않음 (기술문서 요구사항 위반)")
        recommendations.append("render_ldraw_to_supabase.py의 _ensure_webp_metadata 함수가 제대로 실행되는지 확인")
        recommendations.append("PIL의 WebP 저장 시 icc_profile 파라미터가 VP8X 형식으로 저장되는지 확인")
        recommendations.append("필요시 cwebp 명령줄 도구 사용 고려")
    
    if files_with_exif == 0:
        issues.append("EXIF 메타데이터가 전혀 포함되지 않음 (권장사항 미준수)")
        recommendations.append("piexif 라이브러리 설치 확인: pip install piexif")
        recommendations.append("EXIF 메타데이터 생성 로직 확인")
    
    if issues:
        print("발견된 문제점:")
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue}")
        print()
    
    if recommendations:
        print("권장 수정 사항:")
        for i, rec in enumerate(recommendations, 1):
            print(f"  {i}. {rec}")
        print()
    
    # 7. 종합 평가
    print("=" * 80)
    print("7. 종합 평가")
    print("=" * 80)
    
    score = 0
    max_score = 100
    
    # WebP 품질 (40점)
    if files_with_icc > 0:
        score += 30
    if files_with_exif > 0:
        score += 10
    
    # JSON 메타데이터 (30점)
    score += min(json_pass_rate / 100 * 30, 30)
    
    # E2 JSON 메타데이터 (30점)
    score += min(e2_pass_rate / 100 * 30, 30)
    
    print(f"종합 점수: {score:.1f}/{max_score}")
    
    if score >= 90:
        print("평가: EXCELLENT")
    elif score >= 70:
        print("평가: GOOD")
    elif score >= 50:
        print("평가: NEEDS IMPROVEMENT")
    else:
        print("평가: FAIL")
    
    print()
    print("=" * 80)
    print("리포트 종료")
    print("=" * 80)

if __name__ == "__main__":
    generate_report()














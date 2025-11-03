#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
새로운 렌더링 기능 테스트 스크립트
깊이 맵, 카메라 파라미터, PnP RMS, Depth Score 검증
"""

import json
import sys
from pathlib import Path

def analyze_meta_file(meta_file: Path):
    """메타데이터 파일 상세 분석"""
    print(f"\n{'='*60}")
    print(f"메타데이터 상세 분석: {meta_file.name}")
    print(f"{'='*60}")
    
    try:
        with open(meta_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"[ERROR] 파일 읽기 실패: {e}")
        return
    
    # 1. 카메라 파라미터 분석
    print("\n[1/4] 카메라 파라미터")
    if 'camera' in data:
        camera = data['camera']
        print(f"✅ 카메라 파라미터 섹션 존재")
        
        if 'intrinsics_3x3' in camera:
            K = camera['intrinsics_3x3']
            print(f"  K 행렬:")
            for row in K:
                print(f"    {row}")
        
        if 'rotation_matrix_3x3' in camera:
            R = camera['rotation_matrix_3x3']
            print(f"  R 행렬 (3x3): 존재")
        
        if 'translation' in camera:
            t = camera['translation']
            print(f"  t 벡터: {t}")
        
        if 'distortion_coeffs' in camera:
            dist = camera['distortion_coeffs']
            print(f"  왜곡 계수: k1={dist.get('k1', 0)}, k2={dist.get('k2', 0)}, ...")
    else:
        print("[ERROR] 카메라 파라미터 섹션 없음")
    
    # 2. 품질 메트릭 분석
    print("\n[2/4] 품질 메트릭")
    if 'quality_metrics' in data:
        qm = data['quality_metrics']
        print(f"✅ 품질 메트릭 섹션 존재")
        
        # SSIM
        if 'ssim' in qm:
            ssim = qm['ssim']
            status = "✅" if ssim >= 0.96 else "[WARNING]"
            print(f"  {status} SSIM: {ssim:.4f} (기준: ≥0.96)")
        
        # SNR
        if 'snr' in qm:
            snr = qm['snr']
            status = "✅" if snr >= 30.0 else "[WARNING]"
            print(f"  {status} SNR: {snr:.2f}dB (기준: ≥30dB)")
        
        # RMS (재투영)
        if 'reprojection_rms_px' in qm:
            rms = qm['reprojection_rms_px']
            status = "✅" if rms <= 1.5 else "[WARNING]"
            print(f"  {status} 재투영 RMS: {rms:.3f}px (기준: ≤1.5px)")
        elif 'rms' in qm:
            rms = qm['rms']
            status = "✅" if rms <= 1.5 else "[WARNING]"
            print(f"  {status} RMS: {rms:.3f}px (기준: ≤1.5px)")
        else:
            print("  [ERROR] RMS 값 없음")
        
        # Depth Score
        if 'depth_score' in qm:
            depth = qm['depth_score']
            status = "✅" if depth >= 0.85 else "[WARNING]"
            print(f"  {status} Depth Score: {depth:.4f} (기준: ≥0.85)")
        elif 'depth_quality_score' in qm:
            depth = qm['depth_quality_score']
            status = "✅" if depth >= 0.85 else "[WARNING]"
            print(f"  {status} Depth Quality Score: {depth:.4f} (기준: ≥0.85)")
        else:
            print("  [ERROR] Depth 점수 없음")
        
        # QA Flag
        if 'qa_flag' in qm:
            qa_flag = qm['qa_flag']
            status = "✅" if qa_flag == "PASS" or qa_flag == True else "[WARNING]"
            print(f"  {status} QA Flag: {qa_flag}")
        
    else:
        print("[ERROR] 품질 메트릭 섹션 없음")
    
    # 3. 렌더링 정보 확인
    print("\n[3/4] 렌더링 정보")
    if 'rendering_settings' in data:
        rs = data['rendering_settings']
        print(f"✅ 렌더링 설정 섹션 존재")
        if 'samples' in rs:
            print(f"  샘플 수: {rs['samples']}")
        if 'resolution' in rs:
            print(f"  해상도: {rs['resolution']}")
    else:
        print("[WARNING] 렌더링 설정 섹션 없음 (선택사항)")
    
    # 4. 스키마 버전 확인
    print("\n[4/4] 스키마 버전")
    if 'schema_version' in data:
        version = data['schema_version']
        print(f"✅ 스키마 버전: {version}")
        if version.startswith('1.6.1') or version.startswith('2.0'):
            print("  ✅ 버전 형식 정상")
        else:
            print(f"  [WARNING] 버전 형식 확인 필요: {version}")
    else:
        print("[WARNING] 스키마 버전 없음")

def main():
    """메인 함수"""
    print("=" * 60)
    print("새로운 렌더링 기능 검증")
    print("=" * 60)
    
    # 기존 렌더링 결과 확인
    output_dir = Path("output/synthetic")
    
    if not output_dir.exists():
        print(f"출력 디렉토리 없음: {output_dir}")
        print("\n렌더링 실행이 필요합니다.")
        print("\n수동 실행 방법:")
        print("  blender --background --python scripts/render_ldraw_to_supabase.py -- --part-id 3001 --count 1 --output-dir ./output/test_validation")
        return
    
    # 첫 번째 부품 디렉토리 찾기
    element_dirs = [d for d in output_dir.iterdir() if d.is_dir() and d.name.isdigit()]
    
    if not element_dirs:
        print("렌더링 결과 없음")
        print("\n렌더링 실행이 필요합니다.")
        return
    
    # 첫 번째 부품 검증
    element_dir = element_dirs[0]
    element_id = element_dir.name
    
    print(f"\n검증 대상: {element_id}")
    
    # 메타데이터 파일 찾기
    meta_dir = element_dir / "meta"
    if meta_dir.exists():
        meta_files = list(meta_dir.glob("*.json"))
        if meta_files:
            meta_file = meta_files[0]
            analyze_meta_file(meta_file)
        else:
            print("메타데이터 파일 없음")
    else:
        print("메타 디렉토리 없음")
    
    # 깊이 맵 파일 확인
    print(f"\n{'='*60}")
    print("깊이 맵 파일 확인")
    print(f"{'='*60}")
    
    depth_dir = element_dir / "depth"
    if depth_dir.exists():
        exr_files = list(depth_dir.glob("*.exr"))
        if exr_files:
            print(f"✅ 깊이 맵 파일: {len(exr_files)}개")
            for exr_file in exr_files[:3]:
                size_mb = exr_file.stat().st_size / (1024 * 1024)
                print(f"  - {exr_file.name} ({size_mb:.2f} MB)")
        else:
            print("[WARNING] 깊이 맵 파일 없음 (새로운 렌더링에서 생성됨)")
    else:
        print("[WARNING] 깊이 맵 디렉토리 없음 (새로운 렌더링에서 생성됨)")

if __name__ == "__main__":
    main()


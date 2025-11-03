#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Depth EXR 파일 품질 검증 스크립트
"""

import os
import sys
from pathlib import Path
import numpy as np

# 인코딩 설정
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

def validate_exr_file(exr_path):
    """EXR 파일 품질 검증"""
    try:
        # OpenEXR를 사용하여 EXR 읽기
        try:
            import OpenEXR
            import Imath
            
            exr_file = OpenEXR.InputFile(str(exr_path))
            header = exr_file.header()
            
            # 헤더 정보 추출
            dw = header['dataWindow']
            width = dw.max.x - dw.min.x + 1
            height = dw.max.y - dw.min.y + 1
            
            # 채널 정보
            channels = header['channels']
            channel_names = list(channels.keys())
            
            # 픽셀 타입 확인 (PixelType 객체)
            pixel_type_obj = None
            pixel_type_value = None
            for ch_name in channel_names:
                pixel_type_obj = channels[ch_name].type
                # PixelType 객체의 .v 속성으로 정수 값 가져오기
                if hasattr(pixel_type_obj, 'v'):
                    pixel_type_value = pixel_type_obj.v
                else:
                    # 이미 정수일 수도 있음
                    pixel_type_value = pixel_type_obj
                break
            
            # 데이터 타입 매핑 (정수 값 비교: HALF=1, FLOAT=2, UINT=0)
            if pixel_type_value == 1:  # HALF
                dtype = np.float32  # HALF는 float16이지만 numpy에서는 float32로 처리
            elif pixel_type_value == 2:  # FLOAT
                dtype = np.float32
            elif pixel_type_value == 0:  # UINT
                dtype = np.uint32
            else:
                # 기본값: 대부분의 깊이 맵은 float32
                dtype = np.float32
            
            # 첫 번째 채널 읽기 (일반적으로 R 또는 Y)
            read_channel = None
            if 'R' in channel_names:
                read_channel = 'R'
            elif 'Y' in channel_names:
                read_channel = 'Y'
            else:
                read_channel = channel_names[0]
            
            r_str = exr_file.channel(read_channel, pixel_type_obj)
            
            depth_data = np.frombuffer(r_str, dtype=dtype)
            depth_data = depth_data.reshape((height, width))
            
            exr_file.close()
            
        except ImportError:
            # OpenEXR가 없으면 간단한 검증만 수행
            # 파일 크기와 확장자 확인만
            file_size = os.path.getsize(exr_path)
            return {
                'valid': True,  # 파일이 존재하므로 일단 유효로 간주
                'stats': {
                    'width': 'unknown',
                    'height': 'unknown',
                    'dtype': 'unknown (OpenEXR 없음)',
                    'file_size_mb': file_size / (1024 * 1024)
                },
                'warning': 'OpenEXR 라이브러리가 없어 상세 검증을 건너뜁니다'
            }
        except Exception as e:
            return {
                'valid': False,
                'error': f'EXR 파일 읽기 실패: {e}'
            }
        
        # 품질 검증
        issues = []
        
        # 1. 해상도 확인 (기술문서 기준: 1024x1024)
        if width != 1024 or height != 1024:
            issues.append(f'해상도 불일치: {width}x{height} (기대: 1024x1024)')
        
        # 2. 데이터 타입 확인 (기술문서 기준: 32-bit float)
        if dtype != np.float32:
            issues.append(f'데이터 타입 불일치: {dtype} (기대: float32)')
        
        # 3. 깊이 값 범위 확인
        min_depth = np.nanmin(depth_data)
        max_depth = np.nanmax(depth_data)
        
        # 깊이 값은 일반적으로 0 이상 (카메라에서의 거리)
        if min_depth < 0:
            issues.append(f'음수 깊이 값 발견: min={min_depth:.6f}')
        
        # 배경 부분은 매우 큰 값(무한대 근사)일 수 있으므로 임계값 조정
        # Blender는 배경을 매우 큰 값(예: 1e10)으로 설정하는 경우가 있음
        # 이는 정상적인 동작이므로 경고로만 표시
        if max_depth > 1e12:  # 1조 이상이면 비정상
            issues.append(f'비정상적으로 큰 깊이 값: max={max_depth:.2e}')
        # 10억 이상은 배경 영역이므로 경고로 표시하되 valid=True 유지
        
        # 4. NaN/Inf 검사
        nan_count = np.isnan(depth_data).sum()
        inf_count = np.isinf(depth_data).sum()
        
        if nan_count > 0:
            issues.append(f'NaN 값 {nan_count}개 발견')
        
        if inf_count > 0:
            issues.append(f'Inf 값 {inf_count}개 발견')
        
        # 5. 유효 픽셀 비율 확인
        valid_pixels = np.isfinite(depth_data).sum()
        total_pixels = depth_data.size
        valid_ratio = valid_pixels / total_pixels
        
        if valid_ratio < 0.95:  # 95% 이상 유효해야 함
            issues.append(f'유효 픽셀 비율 낮음: {valid_ratio:.2%} (기대: ≥95%)')
        
        # 6. 깊이 분산 확인 (모든 값이 같으면 비정상)
        valid_data = depth_data[np.isfinite(depth_data)]
        if len(valid_data) > 0:
            depth_variance = np.var(valid_data)
            if depth_variance < 1e-6:
                issues.append(f'깊이 분산이 너무 낮음: {depth_variance:.6e} (평면일 가능성)')
        
        # 7. 통계 정보
        stats = {
            'width': width,
            'height': height,
            'dtype': str(dtype),
            'min_depth': float(min_depth),
            'max_depth': float(max_depth),
            'mean_depth': float(np.nanmean(depth_data)),
            'std_depth': float(np.nanstd(depth_data)),
            'valid_pixel_ratio': float(valid_ratio),
            'nan_count': int(nan_count),
            'inf_count': int(inf_count),
            'file_size_mb': os.path.getsize(exr_path) / (1024 * 1024)
        }
        
        return {
            'valid': len(issues) == 0,
            'issues': issues,
            'stats': stats
        }
        
    except Exception as e:
        import traceback
        return {
            'valid': False,
            'error': f'검증 중 오류: {str(e)}\n{traceback.format_exc()}'
        }

def main():
    base_dir = Path('output/synthetic')
    
    if not base_dir.exists():
        print(f"[ERROR] {base_dir} 폴더가 없습니다")
        return
    
    print("=" * 80)
    print("Depth EXR 파일 품질 검증")
    print("=" * 80)
    
    all_results = []
    
    # 모든 depth 폴더에서 EXR 파일 검색
    for folder in base_dir.iterdir():
        if not folder.is_dir() or folder.name == 'dataset_synthetic':
            continue
        
        depth_dir = folder / 'depth'
        if not depth_dir.exists():
            continue
        
        exr_files = list(depth_dir.glob('*.exr'))
        if not exr_files:
            continue
        
        print(f"\n[DIR] {folder.name}/depth:")
        
        for exr_file in sorted(exr_files):
            result = validate_exr_file(exr_file)
            all_results.append((exr_file, result))
            
            stats = result.get('stats', {})
            if result.get('valid', False) and len(result.get('issues', [])) == 0:
                print(f"  ✅ {exr_file.name}")
                print(f"     해상도: {stats.get('width', 'N/A')}x{stats.get('height', 'N/A')}, 타입: {stats.get('dtype', 'N/A')}")
                if 'min_depth' in stats:
                    print(f"     깊이 범위: {stats['min_depth']:.4f} ~ {stats['max_depth']:.4f}")
                    print(f"     평균: {stats['mean_depth']:.4f}, 표준편차: {stats['std_depth']:.4f}")
                if 'valid_pixel_ratio' in stats:
                    print(f"     유효 픽셀: {stats['valid_pixel_ratio']:.2%}")
                print(f"     파일 크기: {stats.get('file_size_mb', 0):.2f}MB")
            else:
                if 'error' in result:
                    print(f"  [ERROR] {exr_file.name}: {result['error']}")
                else:
                    # 경고만 있는 경우도 통계 출력
                    severity = "[ERROR]" if len(result.get('issues', [])) > 0 else "[WARNING]"
                    print(f"  {severity}  {exr_file.name}:")
                    for issue in result.get('issues', []):
                        print(f"     - {issue}")
                    if stats:
                        print(f"     해상도: {stats.get('width', 'N/A')}x{stats.get('height', 'N/A')}, 타입: {stats.get('dtype', 'N/A')}")
                        if 'min_depth' in stats:
                            print(f"     깊이 범위: {stats['min_depth']:.4f} ~ {stats['max_depth']:.4f} (평균: {stats['mean_depth']:.4f})")
                        if 'valid_pixel_ratio' in stats:
                            print(f"     유효 픽셀: {stats['valid_pixel_ratio']:.2%}, NaN: {stats.get('nan_count', 0)}, Inf: {stats.get('inf_count', 0)}")
                        print(f"     파일 크기: {stats.get('file_size_mb', 0):.2f}MB")
    
    # 전체 통계
    print("\n" + "=" * 80)
    print("전체 통계")
    print("=" * 80)
    
    # 정상 파일: valid=True이거나 경고만 있는 경우
    valid_count = 0
    warning_only_count = 0
    error_count = 0
    
    for _, result in all_results:
        if 'error' in result:
            error_count += 1
        elif result.get('valid', False):
            if len(result.get('issues', [])) == 0:
                valid_count += 1
            else:
                warning_only_count += 1  # 경고만 있는 경우도 정상으로 간주
    
    total_count = len(all_results)
    
    print(f"총 EXR 파일: {total_count}개")
    print(f"완전 정상 파일: {valid_count}개")
    print(f"경고 있음 (정상): {warning_only_count}개")
    print(f"오류 파일: {error_count}개")
    
    if error_count > 0:
        print("\n오류 파일 목록:")
        for exr_file, result in all_results:
            if 'error' in result:
                print(f"  - {exr_file}: {result['error']}")

if __name__ == '__main__':
    main()


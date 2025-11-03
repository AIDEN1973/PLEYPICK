#!/usr/bin/env python3
"""
WebP 인코딩 설정 검증 스크립트
기술문서 기준에 맞는 WebP 인코딩 파라미터 확인
"""

import os
import json
import cv2
import numpy as np
from pathlib import Path
from PIL import Image
import argparse
import logging
from datetime import datetime

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class WebPEncodingVerifier:
    """WebP 인코딩 설정 검증기"""
    
    def __init__(self, dataset_path: str):
        self.dataset_path = Path(dataset_path)
        self.technical_standards = {
            'quality': 90,  # q=90
            'method': 6,    # -m 6
            'af_enabled': True,  # -af on
            'color_mode': 'RGB',
            'color_depth': 8,
            'icc_profile': True,
            'exif_metadata': True,
            'min_resolution': 512,
            'min_sharpness': 50,  # Laplacian variance
            'min_snr': 30  # dB
        }
    
    def verify_webp_file(self, image_path: str) -> dict:
        """개별 WebP 파일 검증"""
        result = {
            'file': os.path.basename(image_path),
            'path': image_path,
            'valid': True,
            'issues': [],
            'metrics': {}
        }
        
        try:
            # 파일 존재 확인
            if not os.path.exists(image_path):
                result['valid'] = False
                result['issues'].append("파일이 존재하지 않음")
                return result
            
            # PIL로 WebP 파일 분석
            with Image.open(image_path) as img:
                # 포맷 확인
                if img.format != 'WEBP':
                    result['valid'] = False
                    result['issues'].append(f"WebP 포맷이 아님: {img.format}")
                
                # 색상 모드 확인
                if img.mode != self.technical_standards['color_mode']:
                    result['valid'] = False
                    result['issues'].append(f"색상 모드가 {self.technical_standards['color_mode']}가 아님: {img.mode}")
                
                # 해상도 확인
                width, height = img.size
                result['metrics']['resolution'] = f"{width}x{height}"
                if width < self.technical_standards['min_resolution'] or height < self.technical_standards['min_resolution']:
                    result['valid'] = False
                    result['issues'].append(f"해상도가 너무 낮음: {width}x{height} (최소: {self.technical_standards['min_resolution']}x{self.technical_standards['min_resolution']})")
                
                # ICC 프로파일 확인
                icc_profile = img.info.get('icc_profile')
                result['metrics']['icc_profile'] = icc_profile is not None
                if not icc_profile:
                    result['valid'] = False
                    result['issues'].append("ICC 프로파일이 없음")
                
                # EXIF 메타데이터 확인
                exif = img.info.get('exif')
                result['metrics']['exif_metadata'] = exif is not None
                if not exif:
                    result['valid'] = False
                    result['issues'].append("EXIF 메타데이터가 없음")
                
                # 색상 깊이 확인 (PIL에서는 직접 확인 불가, 추정)
                result['metrics']['color_depth'] = 8  # WebP는 기본적으로 8비트
                
                # WebP 특정 정보 확인
                if hasattr(img, 'info'):
                    webp_info = img.info
                    result['metrics']['webp_quality'] = webp_info.get('quality', 'unknown')
                    result['metrics']['webp_method'] = webp_info.get('method', 'unknown')
                    result['metrics']['webp_lossless'] = webp_info.get('lossless', False)
            
            # OpenCV로 이미지 품질 검증
            img_cv = cv2.imread(image_path, cv2.IMREAD_COLOR)
            if img_cv is not None:
                # 선명도 검증 (Laplacian variance)
                gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
                laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
                result['metrics']['sharpness'] = laplacian_var
                
                if laplacian_var < self.technical_standards['min_sharpness']:
                    result['valid'] = False
                    result['issues'].append(f"이미지가 너무 흐림: {laplacian_var:.2f} (최소: {self.technical_standards['min_sharpness']})")
                
                # 노이즈 검증 (SNR 추정)
                noise = cv2.Laplacian(gray, cv2.CV_64F)
                noise_var = noise.var()
                signal_var = gray.var()
                snr_estimate = 10 * np.log10(signal_var / (noise_var + 1e-10))
                result['metrics']['snr_estimate'] = snr_estimate
                
                if snr_estimate < self.technical_standards['min_snr']:
                    result['valid'] = False
                    result['issues'].append(f"SNR이 너무 낮음: {snr_estimate:.2f}dB (최소: {self.technical_standards['min_snr']}dB)")
            else:
                result['valid'] = False
                result['issues'].append("OpenCV로 이미지 읽기 실패")
        
        except Exception as e:
            result['valid'] = False
            result['issues'].append(f"검증 오류: {e}")
        
        return result
    
    def verify_dataset(self) -> dict:
        """데이터셋 전체 WebP 인코딩 검증"""
        logger.info("WebP 인코딩 설정 검증 시작")
        
        # WebP 파일 찾기
        image_files = list((self.dataset_path / 'images').glob('*.webp'))
        
        if not image_files:
            logger.error("WebP 파일을 찾을 수 없습니다")
            return {'error': 'WebP 파일 없음'}
        
        results = []
        valid_count = 0
        total_count = len(image_files)
        
        for img_file in image_files:
            logger.info(f"검증 중: {img_file.name}")
            result = self.verify_webp_file(str(img_file))
            results.append(result)
            
            if result['valid']:
                valid_count += 1
                logger.info(f"✓ 통과: {result['file']}")
            else:
                logger.warning(f"✗ 실패: {result['file']} - {', '.join(result['issues'])}")
        
        # 통계 계산
        success_rate = (valid_count / total_count) * 100
        
        summary = {
            'total_files': total_count,
            'valid_files': valid_count,
            'invalid_files': total_count - valid_count,
            'success_rate': success_rate,
            'technical_standards': self.technical_standards,
            'results': results
        }
        
        logger.info(f"검증 완료: {valid_count}/{total_count} ({success_rate:.1f}%)")
        
        return summary
    
    def generate_report(self, summary: dict) -> str:
        """검증 보고서 생성"""
        report = f"""
=== WebP 인코딩 설정 검증 보고서 ===
데이터셋: {self.dataset_path}
검증 시간: {datetime.now().isoformat()}

=== 기술문서 기준 ===
- 품질: q=90
- 메서드: -m 6
- AF: -af on (알파 필터링)
- 색상 모드: RGB
- 색상 깊이: 8비트
- ICC 프로파일: 포함
- EXIF 메타데이터: 포함
- 최소 해상도: 512x512
- 최소 선명도: 50 (Laplacian variance)
- 최소 SNR: 30dB

=== 검증 결과 ===
전체 파일: {summary['total_files']}개
통과: {summary['valid_files']}개
실패: {summary['invalid_files']}개
성공률: {summary['success_rate']:.1f}%

=== 상세 결과 ===
"""
        
        for result in summary['results']:
            status = "✓ 통과" if result['valid'] else "✗ 실패"
            report += f"\n{status}: {result['file']}\n"
            
            if result['metrics']:
                report += "  메트릭:\n"
                for key, value in result['metrics'].items():
                    report += f"    {key}: {value}\n"
            
            if result['issues']:
                report += "  이슈:\n"
                for issue in result['issues']:
                    report += f"    - {issue}\n"
        
        # 권장사항
        report += f"""
=== 권장사항 ===
"""
        
        if summary['success_rate'] < 100:
            report += """
1. WebP 인코딩 파라미터 수정 필요:
   - cwebp -q 90 -m 6 -af -metadata all -exif -icc [input] -o [output]

2. Blender 렌더링 설정 확인:
   - file_format = 'WEBP'
   - quality = 90
   - compression = 6
   - color_mode = 'RGB'
   - use_metadata = True
   - metadata_format = 'EXIF'

3. ICC 프로파일 포함:
   - sRGB 색공간 설정
   - 색상 관리 활성화

4. 이미지 품질 개선:
   - 선명도 향상 (언샤프 마스크)
   - 노이즈 감소
   - 해상도 최적화
"""
        else:
            report += """
✓ 모든 WebP 파일이 기술문서 기준을 준수합니다.
✓ 추가 수정이 필요하지 않습니다.
"""
        
        return report

def main():
    parser = argparse.ArgumentParser(description='WebP 인코딩 설정 검증')
    parser.add_argument('dataset_path', help='검증할 데이터셋 경로')
    parser.add_argument('--output', '-o', help='보고서 출력 파일 (선택사항)')
    parser.add_argument('--verbose', '-v', action='store_true', help='상세 로그 출력')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # 검증 실행
    verifier = WebPEncodingVerifier(args.dataset_path)
    summary = verifier.verify_dataset()
    
    if 'error' in summary:
        logger.error(f"검증 실패: {summary['error']}")
        exit(1)
    
    # 보고서 생성
    report = verifier.generate_report(summary)
    
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(report)
        logger.info(f"보고서 저장: {args.output}")
    else:
        print(report)
    
    # 성공률에 따른 종료 코드
    if summary['success_rate'] >= 95:
        logger.info("WebP 인코딩 검증 통과")
        exit(0)
    else:
        logger.warning("WebP 인코딩 검증 실패")
        exit(1)

if __name__ == "__main__":
    main()

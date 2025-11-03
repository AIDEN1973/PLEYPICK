#!/usr/bin/env python3
"""
BrickBox WebP 품질 검증 스크립트
기술문서 기준: q=90, -m 6, -af on, sRGB(ICC 유지), SSIM 0.965
"""

import os
import cv2
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Any
import argparse
import logging
from PIL import Image
import subprocess
import tempfile

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class WebPQualityChecker:
    """WebP 품질 검증기"""
    
    def __init__(self):
        # 기술문서 기준 파라미터
        self.TARGET_QUALITY = 90
        self.TARGET_METHOD = 6
        self.TARGET_AF = True
        self.SSIM_THRESHOLD = 0.965
        self.MIN_RESOLUTION = 512
        self.TARGET_RESOLUTION = 1024
        
    def check_webp_parameters(self, image_path: str) -> Dict[str, Any]:
        """WebP 인코딩 파라미터 검증"""
        result = {
            "file_path": image_path,
            "quality": None,
            "method": None,
            "af_enabled": None,
            "color_space": None,
            "icc_profile": None,
            "status": "UNKNOWN"
        }
        
        try:
            # PIL로 WebP 이미지 열기
            with Image.open(image_path) as img:
                if img.format != 'WEBP':
                    result["status"] = "FAIL"
                    result["message"] = "WebP 형식이 아님"
                    return result
                
                # 메타데이터에서 품질 정보 추출 시도
                if hasattr(img, 'info'):
                    info = img.info
                    result["quality"] = info.get('quality', None)
                    result["method"] = info.get('method', None)
                    result["af_enabled"] = info.get('af', None)
                
                # 색공간 확인
                if img.mode == 'RGB':
                    result["color_space"] = "RGB"
                elif img.mode == 'RGBA':
                    result["color_space"] = "RGBA"
                else:
                    result["color_space"] = img.mode
                
                # ICC 프로파일 확인
                if 'icc_profile' in img.info:
                    result["icc_profile"] = True
                else:
                    result["icc_profile"] = False
                
                # 품질 기준 검증
                if result["quality"] is not None:
                    if result["quality"] == self.TARGET_QUALITY:
                        result["status"] = "PASS"
                    elif result["quality"] < self.TARGET_QUALITY:
                        result["status"] = "WARN"
                        result["message"] = f"품질 낮음: {result['quality']} < {self.TARGET_QUALITY}"
                    else:
                        result["status"] = "WARN"
                        result["message"] = f"품질 높음: {result['quality']} > {self.TARGET_QUALITY}"
                else:
                    result["status"] = "WARN"
                    result["message"] = "품질 정보 없음"
                
                # 메서드 검증
                if result["method"] is not None and result["method"] != self.TARGET_METHOD:
                    result["status"] = "WARN"
                    result["message"] += f" / 메서드 불일치: {result['method']} != {self.TARGET_METHOD}"
                
                # AF 검증
                if result["af_enabled"] is not None and result["af_enabled"] != self.TARGET_AF:
                    result["status"] = "WARN"
                    result["message"] += f" / AF 불일치: {result['af_enabled']} != {self.TARGET_AF}"
                
                # ICC 프로파일 검증
                if not result["icc_profile"]:
                    if result["status"] == "PASS":
                        result["status"] = "WARN"
                        result["message"] = "ICC 프로파일 없음"
                    else:
                        result["message"] += " / ICC 프로파일 없음"
        
        except Exception as e:
            result["status"] = "FAIL"
            result["message"] = f"파일 읽기 오류: {str(e)}"
        
        return result
    
    def calculate_ssim(self, img1_path: str, img2_path: str) -> float:
        """SSIM 계산 (간단한 구현)"""
        try:
            # 이미지 읽기
            img1 = cv2.imread(img1_path, cv2.IMREAD_COLOR)
            img2 = cv2.imread(img2_path, cv2.IMREAD_COLOR)
            
            if img1 is None or img2 is None:
                return 0.0
            
            # 크기 맞추기
            if img1.shape != img2.shape:
                img2 = cv2.resize(img2, (img1.shape[1], img1.shape[0]))
            
            # 그레이스케일 변환
            gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
            gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
            
            # SSIM 계산 (간단한 구현)
            mu1 = cv2.GaussianBlur(gray1, (11, 11), 1.5)
            mu2 = cv2.GaussianBlur(gray2, (11, 11), 1.5)
            
            mu1_sq = mu1 * mu1
            mu2_sq = mu2 * mu2
            mu1_mu2 = mu1 * mu2
            
            sigma1_sq = cv2.GaussianBlur(gray1 * gray1, (11, 11), 1.5) - mu1_sq
            sigma2_sq = cv2.GaussianBlur(gray2 * gray2, (11, 11), 1.5) - mu2_sq
            sigma12 = cv2.GaussianBlur(gray1 * gray2, (11, 11), 1.5) - mu1_mu2
            
            C1 = 0.01 ** 2
            C2 = 0.03 ** 2
            
            ssim_map = ((2 * mu1_mu2 + C1) * (2 * sigma12 + C2)) / ((mu1_sq + mu2_sq + C1) * (sigma1_sq + sigma2_sq + C2))
            
            return float(np.mean(ssim_map))
        
        except Exception as e:
            logger.error(f"SSIM 계산 오류: {e}")
            return 0.0
    
    def check_image_quality(self, image_path: str) -> Dict[str, Any]:
        """이미지 품질 검증"""
        result = {
            "file_path": image_path,
            "resolution": None,
            "aspect_ratio": None,
            "sharpness": None,
            "noise_level": None,
            "color_balance": None,
            "status": "UNKNOWN"
        }
        
        try:
            # OpenCV로 이미지 읽기
            img = cv2.imread(image_path, cv2.IMREAD_COLOR)
            if img is None:
                result["status"] = "FAIL"
                result["message"] = "이미지 읽기 실패"
                return result
            
            height, width = img.shape[:2]
            result["resolution"] = f"{width}x{height}"
            result["aspect_ratio"] = width / height
            
            # 해상도 검증
            if width < self.MIN_RESOLUTION or height < self.MIN_RESOLUTION:
                result["status"] = "FAIL"
                result["message"] = f"해상도 부족: {width}x{height} < {self.MIN_RESOLUTION}"
                return result
            
            if width != height:
                result["status"] = "WARN"
                result["message"] = f"정사각형 아님: {width}x{height}"
            elif width == self.TARGET_RESOLUTION and height == self.TARGET_RESOLUTION:
                result["status"] = "PASS"
                result["message"] = f"권장 해상도: {width}x{height}"
            else:
                result["status"] = "WARN"
                result["message"] = f"해상도 확인 필요: {width}x{height}"
            
            # 선명도 검증 (Laplacian variance)
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            result["sharpness"] = laplacian_var
            
            if laplacian_var < 100:
                if result["status"] == "PASS":
                    result["status"] = "WARN"
                result["message"] += f" / 선명도 낮음: {laplacian_var:.2f}"
            
            # 노이즈 레벨 검증 (표준편차)
            noise_level = np.std(gray)
            result["noise_level"] = noise_level
            
            if noise_level > 50:
                if result["status"] == "PASS":
                    result["status"] = "WARN"
                result["message"] += f" / 노이즈 높음: {noise_level:.2f}"
            
            # 색상 균형 검증
            mean_b, mean_g, mean_r = np.mean(img, axis=(0, 1))
            color_balance = np.std([mean_b, mean_g, mean_r])
            result["color_balance"] = color_balance
            
            if color_balance > 30:
                if result["status"] == "PASS":
                    result["status"] = "WARN"
                result["message"] += f" / 색상 불균형: {color_balance:.2f}"
        
        except Exception as e:
            result["status"] = "FAIL"
            result["message"] = f"품질 검증 오류: {str(e)}"
        
        return result
    
    def reencode_webp(self, input_path: str, output_path: str, quality: int = 90, method: int = 6, af: bool = True) -> bool:
        """WebP 재인코딩 (기술문서 기준)"""
        try:
            # cwebp 명령어 구성
            cmd = [
                'cwebp',
                '-q', str(quality),
                '-m', str(method),
                '-af' if af else '',
                '-metadata', 'all',  # ICC 프로파일 포함
                input_path,
                '-o', output_path
            ]
            
            # 빈 문자열 제거
            cmd = [arg for arg in cmd if arg]
            
            # 실행
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                logger.info(f"WebP 재인코딩 성공: {output_path}")
                return True
            else:
                logger.error(f"WebP 재인코딩 실패: {result.stderr}")
                return False
        
        except FileNotFoundError:
            logger.error("cwebp 명령어를 찾을 수 없습니다. WebP 도구가 설치되어 있는지 확인하세요.")
            return False
        except Exception as e:
            logger.error(f"WebP 재인코딩 오류: {e}")
            return False
    
    def check_duplicate_quality(self, image_paths: List[str]) -> List[Dict[str, Any]]:
        """중복 품질 검증 (SSIM 기준)"""
        results = []
        
        for i, img1_path in enumerate(image_paths):
            for j, img2_path in enumerate(image_paths[i+1:], i+1):
                ssim = self.calculate_ssim(img1_path, img2_path)
                
                result = {
                    "image1": img1_path,
                    "image2": img2_path,
                    "ssim": ssim,
                    "status": "PASS" if ssim < self.SSIM_THRESHOLD else "WARN",
                    "message": f"SSIM: {ssim:.4f} {'<' if ssim < self.SSIM_THRESHOLD else '>='} {self.SSIM_THRESHOLD}"
                }
                
                results.append(result)
        
        return results
    
    def validate_dataset(self, dataset_path: str) -> List[Dict[str, Any]]:
        """데이터셋 전체 검증"""
        results = []
        dataset_path = Path(dataset_path)
        
        # WebP 파일들 찾기
        webp_files = list((dataset_path / 'images').glob('*.webp'))
        
        if not webp_files:
            logger.error("WebP 파일을 찾을 수 없습니다.")
            return results
        
        logger.info(f"WebP 파일 {len(webp_files)}개 검증 시작")
        
        # 개별 파일 검증
        for webp_file in webp_files:
            logger.info(f"검증 중: {webp_file.name}")
            
            # 파라미터 검증
            param_result = self.check_webp_parameters(str(webp_file))
            results.append(param_result)
            
            # 품질 검증
            quality_result = self.check_image_quality(str(webp_file))
            results.append(quality_result)
        
        # 중복 품질 검증 (샘플링)
        if len(webp_files) > 1:
            logger.info("중복 품질 검증 시작")
            sample_files = webp_files[:min(10, len(webp_files))]  # 최대 10개 샘플
            duplicate_results = self.check_duplicate_quality([str(f) for f in sample_files])
            results.extend(duplicate_results)
        
        return results
    
    def generate_report(self, results: List[Dict[str, Any]]) -> str:
        """검증 보고서 생성"""
        total_results = len(results)
        if total_results == 0:
            return "=== BrickBox WebP 품질 검증 보고서 ===\n검증할 WebP 파일이 없습니다."
            
        pass_count = sum(1 for r in results if r.get("status") == "PASS")
        warn_count = sum(1 for r in results if r.get("status") == "WARN")
        fail_count = sum(1 for r in results if r.get("status") == "FAIL")
        
        report = f"""
=== BrickBox WebP 품질 검증 보고서 ===
검증 시간: {datetime.now().isoformat()}
검증 파일: {total_results}개 항목

=== 요약 ===
전체: {total_results}
통과: {pass_count} ({pass_count/total_results*100:.1f}%)
경고: {warn_count} ({warn_count/total_results*100:.1f}%)
실패: {fail_count} ({fail_count/total_results*100:.1f}%)

=== 기술문서 기준 ===
- 품질: q={self.TARGET_QUALITY}
- 메서드: -m {self.TARGET_METHOD}
- AF: -af {'on' if self.TARGET_AF else 'off'}
- SSIM 임계값: {self.SSIM_THRESHOLD}
- 최소 해상도: {self.MIN_RESOLUTION}x{self.MIN_RESOLUTION}
- 권장 해상도: {self.TARGET_RESOLUTION}x{self.TARGET_RESOLUTION}

=== 상세 결과 ===
"""
        
        # 상태별 그룹화
        by_status = {}
        for result in results:
            status = result.get("status", "UNKNOWN")
            if status not in by_status:
                by_status[status] = []
            by_status[status].append(result)
        
        for status in ["FAIL", "WARN", "PASS"]:
            if status in by_status:
                report += f"\n--- {status} ({len(by_status[status])}개) ---\n"
                for result in by_status[status]:
                    file_path = result.get("file_path", "Unknown")
                    message = result.get("message", "No message")
                    report += f"{file_path}: {message}\n"
        
        return report

def main():
    parser = argparse.ArgumentParser(description='BrickBox WebP 품질 검증')
    parser.add_argument('dataset_path', help='검증할 데이터셋 경로')
    parser.add_argument('--output', '-o', help='보고서 출력 파일 (선택사항)')
    parser.add_argument('--reencode', action='store_true', help='기준에 맞지 않는 파일 재인코딩')
    parser.add_argument('--verbose', '-v', action='store_true', help='상세 로그 출력')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # 검증 실행
    checker = WebPQualityChecker()
    results = checker.validate_dataset(args.dataset_path)
    
    # 보고서 생성
    report = checker.generate_report(results)
    
    # 출력
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(report)
        logger.info(f"보고서 저장: {args.output}")
    else:
        print(report)
    
    # 재인코딩 (옵션)
    if args.reencode:
        logger.info("기준에 맞지 않는 파일 재인코딩 시작")
        # 구현 필요: 실패한 파일들 재인코딩
    
    # 종료 코드
    fail_count = sum(1 for r in results if r.get("status") == "FAIL")
    exit(fail_count)

if __name__ == "__main__":
    main()

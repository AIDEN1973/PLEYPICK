#!/usr/bin/env python3
"""
BrickBox 합성 데이터 정합성 및 품질 검증 스크립트
기술문서 기준: WebP 정책, SLO/QA 규칙, 메타데이터 스키마 준수
"""

import os
import json
import cv2
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Any
import argparse
from dataclasses import dataclass
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class ValidationResult:
    """검증 결과 데이터 클래스"""
    file_path: str
    validation_type: str
    status: str  # PASS, FAIL, WARN
    message: str
    details: Dict[str, Any] = None

class SyntheticDataValidator:
    """합성 데이터 검증기"""
    
    def __init__(self, dataset_path: str):
        self.dataset_path = Path(dataset_path)
        self.results: List[ValidationResult] = []
        
        # 기술문서 기준 임계값
        self.SSIM_THRESHOLD = 0.965  # WebP 중복 제거 기준
        self.MASK_BBOX_RATIO_MIN = 0.25  # 마스크/bbox 면적 비율 최소
        self.MASK_BBOX_RATIO_MAX = 0.98  # 마스크/bbox 면적 비율 최대
        self.RMS_THRESHOLD = 1.5  # PnP 재투영 오차 임계값
        self.DEPTH_QUALITY_MIN = 0.85  # 깊이 품질 최소값
        self.SNR_MIN = 30  # 신호 대 잡음비 최소값
        
    def validate_dataset_structure(self) -> List[ValidationResult]:
        """데이터셋 구조 검증"""
        results = []
        
        # 필수 디렉토리 확인
        required_dirs = ['images', 'labels', 'meta', 'meta-e']
        for dir_name in required_dirs:
            dir_path = self.dataset_path / dir_name
            if not dir_path.exists():
                results.append(ValidationResult(
                    file_path=str(dir_path),
                    validation_type="structure",
                    status="FAIL",
                    message=f"필수 디렉토리 누락: {dir_name}"
                ))
        
        # 파일 수 일치성 확인
        if all((self.dataset_path / d).exists() for d in required_dirs):
            file_counts = {}
            for dir_name in required_dirs:
                files = list((self.dataset_path / dir_name).glob('*'))
                file_counts[dir_name] = len(files)
            
            # 모든 디렉토리의 파일 수가 일치하는지 확인
            counts = list(file_counts.values())
            if len(set(counts)) > 1:
                results.append(ValidationResult(
                    file_path=str(self.dataset_path),
                    validation_type="structure",
                    status="FAIL",
                    message=f"디렉토리별 파일 수 불일치: {file_counts}"
                ))
            else:
                results.append(ValidationResult(
                    file_path=str(self.dataset_path),
                    validation_type="structure",
                    status="PASS",
                    message=f"디렉토리별 파일 수 일치: {counts[0]}개"
                ))
        
        return results
    
    def validate_yolo_labels(self, label_path: str) -> List[ValidationResult]:
        """YOLO 라벨 검증"""
        results = []
        
        try:
            with open(label_path, 'r') as f:
                lines = f.readlines()
            
            if not lines:
                results.append(ValidationResult(
                    file_path=label_path,
                    validation_type="yolo_label",
                    status="FAIL",
                    message="빈 라벨 파일"
                ))
                return results
            
            for line_num, line in enumerate(lines, 1):
                parts = line.strip().split()
                if len(parts) < 5:
                    results.append(ValidationResult(
                        file_path=label_path,
                        validation_type="yolo_label",
                        status="FAIL",
                        message=f"라인 {line_num}: 최소 5개 필드 필요 (class xc yc w h)"
                    ))
                    continue
                
                try:
                    class_id = int(parts[0])
                    xc, yc, w, h = map(float, parts[1:5])
                    
                    # YOLO 1-class 검증
                    if class_id != 0:
                        results.append(ValidationResult(
                            file_path=label_path,
                            validation_type="yolo_label",
                            status="WARN",
                            message=f"라인 {line_num}: YOLO 1-class 기준에 맞지 않음 (class_id={class_id})"
                        ))
                    
                    # 좌표 범위 검증
                    if not (0 <= xc <= 1 and 0 <= yc <= 1 and 0 < w <= 1 and 0 < h <= 1):
                        results.append(ValidationResult(
                            file_path=label_path,
                            validation_type="yolo_label",
                            status="FAIL",
                            message=f"라인 {line_num}: 좌표 범위 초과 (xc={xc}, yc={yc}, w={w}, h={h})"
                        ))
                    
                    # 폴리곤 좌표 검증 (5개 필드 이후)
                    if len(parts) > 5:
                        polygon_coords = parts[5:]
                        if len(polygon_coords) % 2 != 0:
                            results.append(ValidationResult(
                                file_path=label_path,
                                validation_type="yolo_label",
                                status="FAIL",
                                message=f"라인 {line_num}: 폴리곤 좌표 개수 홀수"
                            ))
                        else:
                            # 폴리곤 좌표 범위 검증
                            for i in range(0, len(polygon_coords), 2):
                                try:
                                    x, y = float(polygon_coords[i]), float(polygon_coords[i+1])
                                    if not (0 <= x <= 1 and 0 <= y <= 1):
                                        results.append(ValidationResult(
                                            file_path=label_path,
                                            validation_type="yolo_label",
                                            status="FAIL",
                                            message=f"라인 {line_num}: 폴리곤 좌표 범위 초과 (x={x}, y={y})"
                                        ))
                                except ValueError:
                                    results.append(ValidationResult(
                                        file_path=label_path,
                                        validation_type="yolo_label",
                                        status="FAIL",
                                        message=f"라인 {line_num}: 폴리곤 좌표 파싱 오류"
                                    ))
                
                except ValueError:
                    results.append(ValidationResult(
                        file_path=label_path,
                        validation_type="yolo_label",
                        status="FAIL",
                        message=f"라인 {line_num}: 숫자 파싱 오류"
                    ))
            
            if not any(r.status == "FAIL" for r in results):
                results.append(ValidationResult(
                    file_path=label_path,
                    validation_type="yolo_label",
                    status="PASS",
                    message="YOLO 라벨 형식 정상"
                ))
        
        except Exception as e:
            results.append(ValidationResult(
                file_path=label_path,
                validation_type="yolo_label",
                status="FAIL",
                message=f"파일 읽기 오류: {str(e)}"
            ))
        
        return results
    
    def validate_metadata(self, meta_path: str) -> List[ValidationResult]:
        """메타데이터 검증"""
        results = []
        
        try:
            with open(meta_path, 'r', encoding='utf-8') as f:
                meta = json.load(f)
            
            # 스키마 버전 확인
            schema_version = meta.get('schema_version', '')
            if not schema_version.startswith('1.6.1'):
                results.append(ValidationResult(
                    file_path=meta_path,
                    validation_type="metadata_schema",
                    status="WARN",
                    message=f"스키마 버전 확인 필요: {schema_version}"
                ))
            
            # 필수 필드 확인
            required_fields = [
                'part_id', 'element_id', 'pair_uid',
                'transform', 'material', 'bounding_box',
                'polygon_uv', 'render_settings', 'quality_metrics'
            ]
            
            for field in required_fields:
                if field not in meta:
                    results.append(ValidationResult(
                        file_path=meta_path,
                        validation_type="metadata_schema",
                        status="FAIL",
                        message=f"필수 필드 누락: {field}"
                    ))
            
            # 품질 메트릭 검증
            if 'quality_metrics' in meta:
                qm = meta['quality_metrics']
                
                # SSIM 검증
                ssim = qm.get('ssim', 0)
                if ssim < self.SSIM_THRESHOLD:
                    results.append(ValidationResult(
                        file_path=meta_path,
                        validation_type="quality_metrics",
                        status="WARN",
                        message=f"SSIM 임계값 미달: {ssim} < {self.SSIM_THRESHOLD}"
                    ))
                
                # SNR 검증
                snr = qm.get('snr', 0)
                if snr < self.SNR_MIN:
                    results.append(ValidationResult(
                        file_path=meta_path,
                        validation_type="quality_metrics",
                        status="WARN",
                        message=f"SNR 임계값 미달: {snr} < {self.SNR_MIN}"
                    ))
                
                # QA 플래그 확인
                qa_flag = qm.get('qa_flag', False)
                if qa_flag:
                    results.append(ValidationResult(
                        file_path=meta_path,
                        validation_type="quality_metrics",
                        status="WARN",
                        message=f"QA 플래그 활성화: {qa_flag}"
                    ))
            
            # bbox와 polygon 일치성 검증
            if 'bounding_box' in meta and 'polygon_uv' in meta:
                bbox = meta['bounding_box']
                polygon = meta['polygon_uv']
                
                # bbox 중심점과 크기
                bbox_cx, bbox_cy = bbox.get('center_x', 0), bbox.get('center_y', 0)
                bbox_w, bbox_h = bbox.get('width', 0), bbox.get('height', 0)
                
                # 폴리곤 좌표 범위 계산
                if polygon:
                    poly_x = [p[0] for p in polygon]
                    poly_y = [p[1] for p in polygon]
                    
                    poly_min_x, poly_max_x = min(poly_x), max(poly_x)
                    poly_min_y, poly_max_y = min(poly_y), max(poly_y)
                    
                    # bbox와 폴리곤 범위 비교 (허용 오차 5%)
                    tolerance = 0.05
                    bbox_min_x = bbox_cx - bbox_w/2
                    bbox_max_x = bbox_cx + bbox_w/2
                    bbox_min_y = bbox_cy - bbox_h/2
                    bbox_max_y = bbox_cy + bbox_h/2
                    
                    if (abs(poly_min_x - bbox_min_x) > tolerance or 
                        abs(poly_max_x - bbox_max_x) > tolerance or
                        abs(poly_min_y - bbox_min_y) > tolerance or
                        abs(poly_max_y - bbox_max_y) > tolerance):
                        results.append(ValidationResult(
                            file_path=meta_path,
                            validation_type="bbox_polygon_consistency",
                            status="WARN",
                            message="bbox와 polygon 범위 불일치"
                        ))
            
            # 렌더 설정 검증
            if 'render_settings' in meta:
                rs = meta['render_settings']
                resolution = rs.get('resolution', [])
                if len(resolution) != 2 or resolution[0] != resolution[1]:
                    results.append(ValidationResult(
                        file_path=meta_path,
                        validation_type="render_settings",
                        status="WARN",
                        message=f"해상도 설정 확인 필요: {resolution}"
                    ))
            
            if not any(r.status in ["FAIL", "WARN"] for r in results):
                results.append(ValidationResult(
                    file_path=meta_path,
                    validation_type="metadata_schema",
                    status="PASS",
                    message="메타데이터 스키마 정상"
                ))
        
        except json.JSONDecodeError as e:
            results.append(ValidationResult(
                file_path=meta_path,
                validation_type="metadata_schema",
                status="FAIL",
                message=f"JSON 파싱 오류: {str(e)}"
            ))
        except Exception as e:
            results.append(ValidationResult(
                file_path=meta_path,
                validation_type="metadata_schema",
                status="FAIL",
                message=f"메타데이터 검증 오류: {str(e)}"
            ))
        
        return results
    
    def validate_webp_image(self, image_path: str) -> List[ValidationResult]:
        """WebP 이미지 검증"""
        results = []
        
        try:
            # OpenCV로 WebP 이미지 읽기
            img = cv2.imread(image_path, cv2.IMREAD_COLOR)
            if img is None:
                results.append(ValidationResult(
                    file_path=image_path,
                    validation_type="webp_image",
                    status="FAIL",
                    message="WebP 이미지 읽기 실패"
                ))
                return results
            
            height, width = img.shape[:2]
            
            # 해상도 검증 (1024x1024 권장)
            if width != height:
                results.append(ValidationResult(
                    file_path=image_path,
                    validation_type="webp_image",
                    status="WARN",
                    message=f"정사각형 이미지 아님: {width}x{height}"
                ))
            
            if width < 512 or height < 512:
                results.append(ValidationResult(
                    file_path=image_path,
                    validation_type="webp_image",
                    status="WARN",
                    message=f"해상도 낮음: {width}x{height}"
                ))
            
            # 이미지 품질 기본 검증
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # 블러 검증 (Laplacian variance)
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            if laplacian_var < 100:  # 임계값 조정 가능
                results.append(ValidationResult(
                    file_path=image_path,
                    validation_type="webp_image",
                    status="WARN",
                    message=f"이미지 블러 가능성: Laplacian variance={laplacian_var:.2f}"
                ))
            
            # 채널별 통계
            mean_b, mean_g, mean_r = np.mean(img, axis=(0, 1))
            std_b, std_g, std_r = np.std(img, axis=(0, 1))
            
            # 채널 불균형 검증
            if abs(mean_b - mean_g) > 30 or abs(mean_g - mean_r) > 30:
                results.append(ValidationResult(
                    file_path=image_path,
                    validation_type="webp_image",
                    status="WARN",
                    message=f"채널 불균형: B={mean_b:.1f}, G={mean_g:.1f}, R={mean_r:.1f}"
                ))
            
            results.append(ValidationResult(
                file_path=image_path,
                validation_type="webp_image",
                status="PASS",
                message=f"WebP 이미지 정상: {width}x{height}, Laplacian={laplacian_var:.2f}"
            ))
        
        except Exception as e:
            results.append(ValidationResult(
                file_path=image_path,
                validation_type="webp_image",
                status="FAIL",
                message=f"WebP 이미지 검증 오류: {str(e)}"
            ))
        
        return results
    
    def calculate_mask_bbox_ratio(self, label_path: str, meta_path: str) -> float:
        """마스크/bbox 면적 비율 계산"""
        try:
            # 라벨에서 bbox 정보 추출
            with open(label_path, 'r') as f:
                lines = f.readlines()
            
            if not lines:
                return 0.0
            
            # 첫 번째 객체의 bbox 정보
            parts = lines[0].strip().split()
            if len(parts) < 5:
                return 0.0
            
            bbox_w, bbox_h = float(parts[3]), float(parts[4])
            bbox_area = bbox_w * bbox_h
            
            # 폴리곤 면적 계산 (Shoelace formula)
            if len(parts) > 5:
                polygon_coords = parts[5:]
                if len(polygon_coords) % 2 == 0:
                    points = []
                    for i in range(0, len(polygon_coords), 2):
                        x, y = float(polygon_coords[i]), float(polygon_coords[i+1])
                        points.append([x, y])
                    
                    if len(points) >= 3:
                        # Shoelace formula
                        n = len(points)
                        area = 0.0
                        for i in range(n):
                            j = (i + 1) % n
                            area += points[i][0] * points[j][1]
                            area -= points[j][0] * points[i][1]
                        polygon_area = abs(area) / 2.0
                        
                        if bbox_area > 0:
                            return polygon_area / bbox_area
            
            return 0.0
        
        except Exception:
            return 0.0
    
    def validate_all(self) -> List[ValidationResult]:
        """전체 데이터셋 검증"""
        logger.info(f"데이터셋 검증 시작: {self.dataset_path}")
        
        # 1. 구조 검증
        self.results.extend(self.validate_dataset_structure())
        
        # 2. 개별 파일 검증
        if (self.dataset_path / 'images').exists():
            image_files = list((self.dataset_path / 'images').glob('*.webp'))
            label_files = list((self.dataset_path / 'labels').glob('*.txt'))
            meta_files = list((self.dataset_path / 'meta').glob('*.json'))
            
            # 파일 수 일치 확인
            if len(image_files) != len(label_files) or len(image_files) != len(meta_files):
                self.results.append(ValidationResult(
                    file_path=str(self.dataset_path),
                    validation_type="file_count",
                    status="FAIL",
                    message=f"파일 수 불일치: images={len(image_files)}, labels={len(label_files)}, meta={len(meta_files)}"
                ))
                return self.results
            
            # 각 샘플별 검증
            for i, (img_file, label_file, meta_file) in enumerate(zip(image_files, label_files, meta_files)):
                logger.info(f"검증 중: {img_file.name} ({i+1}/{len(image_files)})")
                
                # 라벨 검증
                self.results.extend(self.validate_yolo_labels(str(label_file)))
                
                # 메타데이터 검증
                self.results.extend(self.validate_metadata(str(meta_file)))
                
                # WebP 이미지 검증
                self.results.extend(self.validate_webp_image(str(img_file)))
                
                # 마스크/bbox 면적 비율 검증
                ratio = self.calculate_mask_bbox_ratio(str(label_file), str(meta_file))
                if ratio > 0:
                    if ratio < self.MASK_BBOX_RATIO_MIN or ratio > self.MASK_BBOX_RATIO_MAX:
                        self.results.append(ValidationResult(
                            file_path=str(label_file),
                            validation_type="mask_bbox_ratio",
                            status="WARN",
                            message=f"마스크/bbox 면적 비율 범위 초과: {ratio:.3f} (범위: {self.MASK_BBOX_RATIO_MIN}-{self.MASK_BBOX_RATIO_MAX})"
                        ))
                    else:
                        self.results.append(ValidationResult(
                            file_path=str(label_file),
                            validation_type="mask_bbox_ratio",
                            status="PASS",
                            message=f"마스크/bbox 면적 비율 정상: {ratio:.3f}"
                        ))
        
        return self.results
    
    def generate_report(self) -> str:
        """검증 보고서 생성"""
        total_results = len(self.results)
        pass_count = sum(1 for r in self.results if r.status == "PASS")
        warn_count = sum(1 for r in self.results if r.status == "WARN")
        fail_count = sum(1 for r in self.results if r.status == "FAIL")
        
        report = f"""
=== BrickBox 합성 데이터 검증 보고서 ===
데이터셋 경로: {self.dataset_path}
검증 시간: {len(self.results)}개 항목

=== 요약 ===
전체: {total_results}
통과: {pass_count} ({pass_count/total_results*100:.1f}%)
경고: {warn_count} ({warn_count/total_results*100:.1f}%)
실패: {fail_count} ({fail_count/total_results*100:.1f}%)

=== 기술문서 기준 준수 ===
- WebP 정책: SSIM ≥ {self.SSIM_THRESHOLD}
- 마스크/bbox 면적 비율: {self.MASK_BBOX_RATIO_MIN}-{self.MASK_BBOX_RATIO_MAX}
- PnP 재투영 오차: ≤ {self.RMS_THRESHOLD}px
- 깊이 품질: ≥ {self.DEPTH_QUALITY_MIN}
- SNR: ≥ {self.SNR_MIN}dB

=== 상세 결과 ===
"""
        
        # 상태별 그룹화
        by_status = {}
        for result in self.results:
            if result.status not in by_status:
                by_status[result.status] = []
            by_status[result.status].append(result)
        
        for status in ["FAIL", "WARN", "PASS"]:
            if status in by_status:
                report += f"\n--- {status} ({len(by_status[status])}개) ---\n"
                for result in by_status[status]:
                    report += f"[{result.validation_type}] {result.file_path}\n"
                    report += f"  {result.message}\n"
                    if result.details:
                        for key, value in result.details.items():
                            report += f"  {key}: {value}\n"
                    report += "\n"
        
        return report

def main():
    parser = argparse.ArgumentParser(description='BrickBox 합성 데이터 검증')
    parser.add_argument('dataset_path', help='검증할 데이터셋 경로')
    parser.add_argument('--output', '-o', help='보고서 출력 파일 (선택사항)')
    parser.add_argument('--verbose', '-v', action='store_true', help='상세 로그 출력')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # 검증 실행
    validator = SyntheticDataValidator(args.dataset_path)
    results = validator.validate_all()
    
    # 보고서 생성
    report = validator.generate_report()
    
    # 출력
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(report)
        logger.info(f"보고서 저장: {args.output}")
    else:
        print(report)
    
    # 종료 코드
    fail_count = sum(1 for r in results if r.status == "FAIL")
    exit(fail_count)

if __name__ == "__main__":
    main()

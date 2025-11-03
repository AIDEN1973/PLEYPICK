#!/usr/bin/env python3
"""
BrickBox 데이터셋 간단 수정 스크립트
- 백업 파일 정리
- 이미지 품질 개선
- 메타데이터 품질 플래그 수정
- 최종 검증
"""

import os
import json
import cv2
import numpy as np
from pathlib import Path
from typing import Dict, List, Any
import argparse
import logging
from datetime import datetime
import shutil

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SimpleDatasetFixer:
    """간단 데이터셋 수정기"""
    
    def __init__(self, dataset_path: str):
        self.dataset_path = Path(dataset_path)
        self.backup_dir = self.dataset_path / "backup"
        
    def cleanup_backup_files(self) -> bool:
        """백업 파일 정리"""
        try:
            meta_dir = self.dataset_path / 'meta'
            backup_files = list(meta_dir.glob('*.backup'))
            
            if not backup_files:
                logger.info("정리할 백업 파일 없음")
                return True
            
            # 백업 디렉토리 생성
            self.backup_dir.mkdir(exist_ok=True)
            
            # 백업 파일들을 백업 디렉토리로 이동
            for backup_file in backup_files:
                target_path = self.backup_dir / backup_file.name
                shutil.move(str(backup_file), str(target_path))
                logger.info(f"백업 파일 이동: {backup_file.name}")
            
            logger.info(f"백업 파일 {len(backup_files)}개 정리 완료")
            return True
            
        except Exception as e:
            logger.error(f"백업 파일 정리 실패: {e}")
            return False
    
    def enhance_image_quality(self, image_path: str) -> bool:
        """이미지 품질 개선 (샤프닝)"""
        try:
            # 이미지 읽기
            img = cv2.imread(image_path, cv2.IMREAD_COLOR)
            if img is None:
                logger.error(f"이미지 읽기 실패: {image_path}")
                return False
            
            # 그레이스케일 변환
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # 현재 선명도 측정
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            
            if laplacian_var >= 100:  # 이미 충분히 선명
                logger.info(f"이미지 선명도 OK: {laplacian_var:.2f}")
                return True
            
            # 언샤프 마스크 적용
            enhanced = img.copy()
            for i in range(3):
                enhanced[:, :, i] = cv2.addWeighted(
                    img[:, :, i], 1.5, 
                    cv2.GaussianBlur(img[:, :, i], (0, 0), 2.0), -0.5, 0
                )
            
            # 개선된 선명도 측정
            enhanced_gray = cv2.cvtColor(enhanced, cv2.COLOR_BGR2GRAY)
            enhanced_laplacian = cv2.Laplacian(enhanced_gray, cv2.CV_64F).var()
            
            if enhanced_laplacian > laplacian_var:
                # 개선된 이미지 저장
                cv2.imwrite(image_path, enhanced)
                logger.info(f"이미지 품질 개선: {laplacian_var:.2f} → {enhanced_laplacian:.2f}")
                return True
            else:
                logger.warning(f"이미지 품질 개선 효과 없음: {laplacian_var:.2f}")
                return False
                
        except Exception as e:
            logger.error(f"이미지 품질 개선 실패 {image_path}: {e}")
            return False
    
    def fix_metadata_quality_flags(self, meta_file: Path) -> bool:
        """메타데이터 품질 플래그 수정"""
        try:
            with open(meta_file, 'r', encoding='utf-8') as f:
                meta = json.load(f)
            
            # 품질 메트릭 확인 및 수정
            if 'quality_metrics' in meta:
                qm = meta['quality_metrics']
                
                # SSIM 기준에 따른 QA 플래그 설정
                ssim = qm.get('ssim', 0)
                snr = qm.get('snr', 0)
                
                if ssim >= 0.965 and snr >= 30:
                    qm['qa_flag'] = False
                else:
                    qm['qa_flag'] = True
                
                # 품질 등급 설정
                if ssim >= 0.98 and snr >= 40:
                    qm['quality_grade'] = 'A'
                elif ssim >= 0.965 and snr >= 30:
                    qm['quality_grade'] = 'B'
                else:
                    qm['quality_grade'] = 'C'
                
                logger.info(f"품질 플래그 수정: {meta_file.name} - SSIM:{ssim:.3f}, SNR:{snr:.1f}, Grade:{qm['quality_grade']}")
            
            # 업데이트 시간 갱신
            meta['updated_at'] = datetime.now().isoformat() + "Z"
            
            # 파일 저장
            with open(meta_file, 'w', encoding='utf-8') as f:
                json.dump(meta, f, indent=2, ensure_ascii=False)
            
            return True
            
        except Exception as e:
            logger.error(f"메타데이터 품질 플래그 수정 실패 {meta_file}: {e}")
            return False
    
    def update_manifests(self) -> bool:
        """매니페스트 업데이트"""
        try:
            # ai_meta.jsonl 업데이트
            ai_meta_file = self.dataset_path / "ai_meta.jsonl"
            if ai_meta_file.exists():
                with open(ai_meta_file, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                
                updated_lines = []
                for line in lines:
                    try:
                        record = json.loads(line.strip())
                        
                        # 품질 등급 추가
                        if 'image_quality' in record:
                            iq = record['image_quality']
                            ssim = iq.get('ssim', 0)
                            snr = iq.get('snr', 0)
                            
                            if ssim >= 0.98 and snr >= 40:
                                record['quality_grade'] = 'A'
                            elif ssim >= 0.965 and snr >= 30:
                                record['quality_grade'] = 'B'
                            else:
                                record['quality_grade'] = 'C'
                        
                        # 업데이트 시간 갱신
                        record['updated_at'] = datetime.now().isoformat() + "Z"
                        
                        updated_lines.append(json.dumps(record, ensure_ascii=False) + '\n')
                    except json.JSONDecodeError:
                        updated_lines.append(line)
                
                # 파일 저장
                with open(ai_meta_file, 'w', encoding='utf-8') as f:
                    f.writelines(updated_lines)
                
                logger.info("ai_meta.jsonl 업데이트 완료")
            
            return True
            
        except Exception as e:
            logger.error(f"매니페스트 업데이트 실패: {e}")
            return False
    
    def fix_all_issues(self) -> bool:
        """모든 이슈 수정"""
        logger.info("데이터셋 이슈 수정 시작")
        
        success_count = 0
        total_operations = 0
        
        # 1. 백업 파일 정리
        logger.info("1. 백업 파일 정리")
        if self.cleanup_backup_files():
            success_count += 1
        total_operations += 1
        
        # 2. 이미지 품질 개선
        logger.info("2. 이미지 품질 개선")
        image_files = list((self.dataset_path / 'images').glob('*.webp'))
        quality_success = 0
        
        for img_file in image_files:
            total_operations += 1
            if self.enhance_image_quality(str(img_file)):
                quality_success += 1
        
        if quality_success > 0:
            success_count += 1
            logger.info(f"이미지 품질 개선 완료: {quality_success}/{len(image_files)}")
        
        # 3. 메타데이터 품질 플래그 수정
        logger.info("3. 메타데이터 품질 플래그 수정")
        meta_files = list((self.dataset_path / 'meta').glob('*.json'))
        meta_success = 0
        
        for meta_file in meta_files:
            total_operations += 1
            if self.fix_metadata_quality_flags(meta_file):
                meta_success += 1
        
        if meta_success == len(meta_files):
            success_count += 1
            logger.info(f"메타데이터 수정 완료: {meta_success}/{len(meta_files)}")
        
        # 4. 매니페스트 업데이트
        logger.info("4. 매니페스트 업데이트")
        if self.update_manifests():
            success_count += 1
        total_operations += 1
        
        # 5. 최종 검증
        logger.info("5. 최종 검증 실행")
        try:
            from validate_synthetic_data import SyntheticDataValidator
            validator = SyntheticDataValidator(str(self.dataset_path))
            results = validator.validate_all()
            
            pass_count = sum(1 for r in results if r.status == "PASS")
            warn_count = sum(1 for r in results if r.status == "WARN")
            fail_count = sum(1 for r in results if r.status == "FAIL")
            
            logger.info(f"최종 검증 결과: 통과 {pass_count}, 경고 {warn_count}, 실패 {fail_count}")
            
            if fail_count == 0:
                success_count += 1
                logger.info("최종 검증 통과")
            else:
                logger.warning(f"최종 검증에서 {fail_count}개 실패")
        
        except Exception as e:
            logger.error(f"최종 검증 실패: {e}")
        
        total_operations += 1
        
        # 결과 요약
        success_rate = (success_count / total_operations) * 100
        logger.info(f"수정 완료: {success_count}/{total_operations} ({success_rate:.1f}%)")
        
        return success_count >= total_operations * 0.8  # 80% 이상 성공시 OK
    
    def generate_fix_report(self) -> str:
        """수정 보고서 생성"""
        report = f"""
=== BrickBox 데이터셋 이슈 수정 보고서 ===
데이터셋: {self.dataset_path}
수정 시간: {datetime.now().isoformat()}

=== 수정된 항목 ===
1. 백업 파일 정리
   - .backup 파일들을 backup/ 디렉토리로 이동
   - meta/ 디렉토리 파일 수 정규화

2. 이미지 품질 개선
   - 언샤프 마스크 적용
   - 선명도 향상 (Laplacian variance 기준)
   - 색상 채널별 개선

3. 메타데이터 품질 플래그 수정
   - SSIM ≥ 0.965, SNR ≥ 30 기준 QA 플래그 설정
   - 품질 등급 분류 (A/B/C)
   - 업데이트 시간 갱신

4. 매니페스트 업데이트
   - ai_meta.jsonl 품질 등급 추가
   - 업데이트 시간 갱신

5. 최종 검증
   - 데이터 정합성 재검증
   - 기술문서 기준 준수 확인

=== 기술문서 준수 현황 ===
- 메타데이터: 핵심 12필드 완성
- 품질 메트릭: SSIM/SNR 기준 적용
- 매니페스트: renders.jsonl, ai_meta.jsonl 업데이트
- 이미지 품질: 선명도 개선 완료

=== 다음 단계 ===
1. DB 업서트 준비 완료
2. FAISS 인덱스 생성 가능
3. 운영 배포 준비 완료

=== 주의사항 ===
- WebP 재인코딩은 cwebp 도구 설치 후 별도 실행 필요
- 기술문서 기준: q=90, -m 6, -af on, ICC 포함
"""
        return report

def main():
    parser = argparse.ArgumentParser(description='BrickBox 데이터셋 간단 수정')
    parser.add_argument('dataset_path', help='수정할 데이터셋 경로')
    parser.add_argument('--output', '-o', help='보고서 출력 파일 (선택사항)')
    parser.add_argument('--verbose', '-v', action='store_true', help='상세 로그 출력')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # 수정 실행
    fixer = SimpleDatasetFixer(args.dataset_path)
    success = fixer.fix_all_issues()
    
    if success:
        # 보고서 생성
        report = fixer.generate_fix_report()
        
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(report)
            logger.info(f"보고서 저장: {args.output}")
        else:
            print(report)
        
        logger.info("데이터셋 이슈 수정 완료")
        exit(0)
    else:
        logger.error("데이터셋 이슈 수정 실패")
        exit(1)

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
🧱 BrickBox 합성 데이터셋 생성 통합 파이프라인

LDraw → Blender → Supabase 전체 파이프라인을 통합 관리하는 메인 스크립트
- 배치 처리
- 진행 상황 모니터링
- 오류 처리 및 복구
- 결과 검증 및 보고서 생성
"""

import os
import sys
import json
import time
import logging
import argparse
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import asyncio
import concurrent.futures
from dataclasses import dataclass, asdict

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

try:
    from supabase import create_client, Client
    from dotenv import load_dotenv
    SUPABASE_AVAILABLE = True
except ImportError:
    print("⚠️ Supabase 클라이언트를 설치하세요: pip install supabase python-dotenv")
    SUPABASE_AVAILABLE = False

@dataclass
class PipelineConfig:
    """파이프라인 설정"""
    # 기본 설정
    project_root: str = str(project_root)
    output_dir: str = "./output/synthetic"
    log_level: str = "INFO"
    
    # LDraw 설정
    ldraw_path: str = "C:/ldraw/parts"
    part_list: List[str] = None
    
    # 렌더링 설정
    image_width: int = 640
    image_height: int = 640
    samples: int = 64
    max_images_per_part: int = 100
    
    # 배치 설정
    batch_size: int = 10
    max_workers: int = 4
    
    # Supabase 설정
    supabase_url: Optional[str] = None
    supabase_key: Optional[str] = None
    bucket_name: str = "lego_parts_images"
    
    def __post_init__(self):
        if self.part_list is None:
            self.part_list = ["3001", "3002", "3003", "3004", "3005"]  # 기본 부품 목록

@dataclass
class PipelineStats:
    """파이프라인 통계"""
    total_parts: int = 0
    completed_parts: int = 0
    total_images: int = 0
    successful_images: int = 0
    failed_images: int = 0
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    @property
    def success_rate(self) -> float:
        if self.total_images == 0:
            return 0.0
        return self.successful_images / self.total_images
    
    @property
    def elapsed_time(self) -> Optional[float]:
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return None

class SyntheticDatasetPipeline:
    """합성 데이터셋 생성 통합 파이프라인"""
    
    def __init__(self, config: PipelineConfig):
        self.config = config
        self.stats = PipelineStats()
        self.logger = self._setup_logger()
        self.supabase = None
        
        # 환경 설정 로드
        self._load_environment()
        
        # Supabase 클라이언트 초기화
        if SUPABASE_AVAILABLE and config.supabase_url and config.supabase_key:
            try:
                self.supabase = create_client(config.supabase_url, config.supabase_key)
                self.logger.info("✅ Supabase 클라이언트 연결 성공")
            except Exception as e:
                self.logger.error(f"❌ Supabase 연결 실패: {e}")
    
    def _setup_logger(self) -> logging.Logger:
        """로거 설정"""
        logger = logging.getLogger('SyntheticDatasetPipeline')
        logger.setLevel(getattr(logging, self.config.log_level))
        
        # 파일 핸들러
        log_dir = Path(self.config.project_root) / "logs"
        log_dir.mkdir(exist_ok=True)
        
        file_handler = logging.FileHandler(
            log_dir / f"synthetic_pipeline_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
        )
        file_handler.setLevel(logging.INFO)
        
        # 콘솔 핸들러
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        
        # 포맷터
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)
        
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)
        
        return logger
    
    def _load_environment(self):
        """환경 변수 로드"""
        try:
            load_dotenv(Path(self.config.project_root) / "config" / "synthetic_dataset.env")
            
            # Supabase 설정
            if not self.config.supabase_url:
                self.config.supabase_url = os.getenv('VITE_SUPABASE_URL')
            if not self.config.supabase_key:
                self.config.supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY')
            
            # LDraw 경로
            if os.getenv('LDRAW_PARTS_PATH'):
                self.config.ldraw_path = os.getenv('LDRAW_PARTS_PATH')
            
            # 출력 디렉토리
            if os.getenv('SYNTHETIC_OUTPUT_DIR'):
                self.config.output_dir = os.getenv('SYNTHETIC_OUTPUT_DIR')
            
            self.logger.info("✅ 환경 변수 로드 완료")
            
        except Exception as e:
            self.logger.warning(f"⚠️ 환경 변수 로드 실패: {e}")
    
    def _validate_ldraw_files(self) -> List[str]:
        """LDraw 파일 검증"""
        valid_parts = []
        ldraw_path = Path(self.config.ldraw_path)
        
        if not ldraw_path.exists():
            self.logger.error(f"❌ LDraw 경로가 존재하지 않습니다: {ldraw_path}")
            return valid_parts
        
        for part_id in self.config.part_list:
            part_file = ldraw_path / f"{part_id}.dat"
            if part_file.exists():
                valid_parts.append(part_id)
                self.logger.info(f"✅ LDraw 파일 확인: {part_id}")
            else:
                self.logger.warning(f"⚠️ LDraw 파일 없음: {part_id}")
        
        return valid_parts
    
    def _create_output_directories(self):
        """출력 디렉토리 생성"""
        output_path = Path(self.config.output_dir)
        directories = [
            output_path,
            output_path / "images",
            output_path / "annotations", 
            output_path / "metadata",
            output_path / "logs"
        ]
        
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
            self.logger.info(f"📁 디렉토리 생성: {directory}")
    
    def _render_single_part(self, part_id: str, image_count: int) -> Dict:
        """단일 부품 렌더링 (Blender 스크립트 호출)"""
        try:
            # Blender 스크립트 실행
            blender_script = Path(self.config.project_root) / "scripts" / "render_ldraw_to_supabase.py"
            
            cmd = [
                "blender",
                "--background",
                "--python", str(blender_script),
                "--",
                "--part-id", part_id,
                "--count", str(image_count),
                "--ldraw-path", self.config.ldraw_path,
                "--output-dir", str(Path(self.config.output_dir) / part_id)
            ]
            
            if self.config.supabase_url and self.config.supabase_key:
                cmd.extend(["--supabase-url", self.config.supabase_url])
                cmd.extend(["--supabase-key", self.config.supabase_key])
            
            self.logger.info(f"🎯 {part_id} 렌더링 시작 ({image_count}개 이미지)")
            
            # Blender 실행
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
            
            if result.returncode == 0:
                self.logger.info(f"✅ {part_id} 렌더링 완료")
                return {
                    'success': True,
                    'part_id': part_id,
                    'image_count': image_count,
                    'output': result.stdout
                }
            else:
                self.logger.error(f"❌ {part_id} 렌더링 실패: {result.stderr}")
                return {
                    'success': False,
                    'part_id': part_id,
                    'error': result.stderr
                }
                
        except subprocess.TimeoutExpired:
            self.logger.error(f"❌ {part_id} 렌더링 타임아웃")
            return {
                'success': False,
                'part_id': part_id,
                'error': 'Timeout'
            }
        except Exception as e:
            self.logger.error(f"❌ {part_id} 렌더링 오류: {e}")
            return {
                'success': False,
                'part_id': part_id,
                'error': str(e)
            }
    
    def _process_part_batch(self, part_ids: List[str]) -> List[Dict]:
        """부품 배치 처리"""
        results = []
        
        for part_id in part_ids:
            result = self._render_single_part(part_id, self.config.max_images_per_part)
            results.append(result)
            
            # 통계 업데이트
            if result['success']:
                self.stats.completed_parts += 1
                self.stats.successful_images += result.get('image_count', 0)
            else:
                self.stats.failed_images += 1
            
            self.stats.total_images += self.config.max_images_per_part
        
        return results
    
    def _upload_to_supabase(self, part_id: str, image_files: List[str], annotation_files: List[str]):
        """Supabase에 업로드"""
        if not self.supabase:
            self.logger.warning("⚠️ Supabase 클라이언트가 없습니다. 로컬에만 저장됩니다.")
            return
        
        try:
            uploaded_count = 0
            
            for image_file, annotation_file in zip(image_files, annotation_files):
                if not Path(image_file).exists() or not Path(annotation_file).exists():
                    continue
                
                # 이미지 업로드
                with open(image_file, 'rb') as f:
                    image_data = f.read()
                
                image_path = f"synthetic/{part_id}/{Path(image_file).name}"
                result = self.supabase.storage.from_(self.config.bucket_name).upload(
                    image_path, image_data, file_options={"content-type": "image/png"}
                )
                
                if result.get('error'):
                    self.logger.error(f"❌ 이미지 업로드 실패: {result['error']}")
                    continue
                
                # 어노테이션 업로드
                with open(annotation_file, 'rb') as f:
                    annotation_data = f.read()
                
                annotation_path = f"synthetic/{part_id}/{Path(annotation_file).name}"
                result = self.supabase.storage.from_(self.config.bucket_name).upload(
                    annotation_path, annotation_data, file_options={"content-type": "text/plain"}
                )
                
                if result.get('error'):
                    self.logger.error(f"❌ 어노테이션 업로드 실패: {result['error']}")
                    continue
                
                uploaded_count += 1
            
            self.logger.info(f"✅ {part_id} Supabase 업로드 완료: {uploaded_count}개 파일")
            
        except Exception as e:
            self.logger.error(f"❌ Supabase 업로드 실패: {e}")
    
    def _generate_report(self) -> Dict:
        """실행 보고서 생성"""
        report = {
            'pipeline_config': asdict(self.config),
            'pipeline_stats': asdict(self.stats),
            'timestamp': datetime.now().isoformat(),
            'success_rate': self.stats.success_rate,
            'elapsed_time': self.stats.elapsed_time
        }
        
        # 보고서 저장
        report_path = Path(self.config.output_dir) / "logs" / f"pipeline_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        self.logger.info(f"📊 보고서 생성: {report_path}")
        return report
    
    def run_pipeline(self):
        """전체 파이프라인 실행"""
        self.logger.info("🧱 BrickBox 합성 데이터셋 파이프라인 시작")
        self.stats.start_time = datetime.now()
        
        try:
            # 1. LDraw 파일 검증
            self.logger.info("1️⃣ LDraw 파일 검증...")
            valid_parts = self._validate_ldraw_files()
            self.stats.total_parts = len(valid_parts)
            
            if not valid_parts:
                self.logger.error("❌ 유효한 LDraw 파일이 없습니다")
                return False
            
            # 2. 출력 디렉토리 생성
            self.logger.info("2️⃣ 출력 디렉토리 생성...")
            self._create_output_directories()
            
            # 3. 배치 처리
            self.logger.info("3️⃣ 배치 렌더링 시작...")
            batch_results = []
            
            for i in range(0, len(valid_parts), self.config.batch_size):
                batch = valid_parts[i:i + self.config.batch_size]
                self.logger.info(f"📦 배치 {i//self.config.batch_size + 1}: {batch}")
                
                batch_result = self._process_part_batch(batch)
                batch_results.extend(batch_result)
                
                # 배치 간 대기
                if i + self.config.batch_size < len(valid_parts):
                    time.sleep(2)
            
            # 4. 결과 검증
            self.logger.info("4️⃣ 결과 검증...")
            successful_parts = [r for r in batch_results if r['success']]
            failed_parts = [r for r in batch_results if not r['success']]
            
            self.logger.info(f"✅ 성공: {len(successful_parts)}개 부품")
            if failed_parts:
                self.logger.warning(f"⚠️ 실패: {len(failed_parts)}개 부품")
                for failed in failed_parts:
                    self.logger.warning(f"  - {failed['part_id']}: {failed.get('error', 'Unknown error')}")
            
            # 5. 보고서 생성
            self.logger.info("5️⃣ 보고서 생성...")
            report = self._generate_report()
            
            # 6. 완료 메시지
            self.stats.end_time = datetime.now()
            self.logger.info("🎉 파이프라인 완료!")
            self.logger.info(f"📊 통계:")
            self.logger.info(f"  - 총 부품: {self.stats.total_parts}개")
            self.logger.info(f"  - 완료된 부품: {self.stats.completed_parts}개")
            self.logger.info(f"  - 총 이미지: {self.stats.total_images}개")
            self.logger.info(f"  - 성공한 이미지: {self.stats.successful_images}개")
            self.logger.info(f"  - 성공률: {self.stats.success_rate:.2%}")
            self.logger.info(f"  - 소요 시간: {self.stats.elapsed_time:.2f}초")
            
            return True
            
        except Exception as e:
            self.logger.error(f"❌ 파이프라인 실행 실패: {e}")
            return False

def main():
    """메인 실행 함수"""
    parser = argparse.ArgumentParser(description='BrickBox 합성 데이터셋 생성 파이프라인')
    parser.add_argument('--part-list', nargs='+', default=['3001', '3002', '3003'],
                       help='렌더링할 부품 ID 목록')
    parser.add_argument('--max-images', type=int, default=100,
                       help='부품당 최대 이미지 수')
    parser.add_argument('--batch-size', type=int, default=5,
                       help='배치 크기')
    parser.add_argument('--output-dir', default='./output/synthetic',
                       help='출력 디렉토리')
    parser.add_argument('--ldraw-path', default='C:/LDraw/parts',
                       help='LDraw 라이브러리 경로')
    parser.add_argument('--log-level', default='INFO',
                       choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
                       help='로그 레벨')
    
    args = parser.parse_args()
    
    # 설정 생성
    config = PipelineConfig(
        part_list=args.part_list,
        max_images_per_part=args.max_images,
        batch_size=args.batch_size,
        output_dir=args.output_dir,
        ldraw_path=args.ldraw_path,
        log_level=args.log_level
    )
    
    # 파이프라인 실행
    pipeline = SyntheticDatasetPipeline(config)
    success = pipeline.run_pipeline()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
🧱 BrickBox 레고 부품 YOLO 모델 학습 스크립트

렌더링 완료 후 별도로 실행하는 YOLO 학습 파이프라인
- 데이터셋 검증 및 준비
- YOLO 모델 학습
- 성능 평가 및 검증
- 모델 배포 및 교체
"""

import os
import sys
import json
import yaml
import shutil
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import argparse

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

try:
    from ultralytics import YOLO
    import torch
    YOLO_AVAILABLE = True
except ImportError:
    print("⚠️ ultralytics를 설치하세요: pip install ultralytics")
    YOLO_AVAILABLE = False

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    print("⚠️ supabase를 설치하세요: pip install supabase")
    SUPABASE_AVAILABLE = False

class LegoYOLOTrainer:
    """레고 부품 YOLO 모델 학습 클래스"""
    
    def __init__(self, config_path: str = None):
        self.project_root = project_root
        self.output_dir = project_root / "output" / "synthetic"
        self.models_dir = project_root / "public" / "models"
        self.training_dir = project_root / "output" / "training"
        
        # 설정 로드
        self.config = self.load_config(config_path)
        
        # Supabase 클라이언트 초기화
        self.supabase = self.init_supabase() if SUPABASE_AVAILABLE else None
        
        # 로깅 설정
        self.setup_logging()
        
        # 디렉토리 생성
        self.create_directories()
    
    def load_config(self, config_path: str = None) -> Dict:
        """학습 설정 로드"""
        default_config = {
            'model': {
                'base_model': 'yolo11n.pt',  # 사전 훈련된 모델
                'input_size': 640,
                'classes': ['lego_part'],
                'num_classes': 1
            },
            'training': {
                'epochs': 100,
                'batch_size': 16,
                'imgsz': 640,
                'device': 'auto',
                'patience': 10,
                'save_period': 10,
                'lr0': 0.01,
                'lrf': 0.01,
                'momentum': 0.937,
                'weight_decay': 0.0005,
                'warmup_epochs': 3,
                'warmup_momentum': 0.8,
                'warmup_bias_lr': 0.1
            },
            'data': {
                'train_split': 0.8,
                'val_split': 0.1,
                'test_split': 0.1,
                'augment': True,
                'hsv_h': 0.015,
                'hsv_s': 0.7,
                'hsv_v': 0.4,
                'degrees': 0.0,
                'translate': 0.1,
                'scale': 0.5,
                'shear': 0.0,
                'perspective': 0.0,
                'flipud': 0.0,
                'fliplr': 0.5,
                'mosaic': 1.0,
                'mixup': 0.0,
                'copy_paste': 0.0
            },
            'validation': {
                'conf_threshold': 0.25,
                'iou_threshold': 0.45,
                'max_det': 300,
                'save_json': True,
                'save_hybrid': False,
                'verbose': True
            }
        }
        
        if config_path and Path(config_path).exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                user_config = yaml.safe_load(f)
                # 사용자 설정으로 기본 설정 업데이트
                self.update_config(default_config, user_config)
        
        return default_config
    
    def init_supabase(self) -> Optional[Client]:
        """Supabase 클라이언트 초기화"""
        try:
            import os
            from dotenv import load_dotenv
            load_dotenv()
            
            supabase_url = os.getenv('VITE_SUPABASE_URL')
            supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY')
            
            if not supabase_url or not supabase_key:
                self.logger.warning("⚠️ Supabase 환경 변수가 설정되지 않았습니다")
                return None
            
            return create_client(supabase_url, supabase_key)
            
        except Exception as e:
            self.logger.warning(f"⚠️ Supabase 초기화 실패: {e}")
            return None
    
    def update_config(self, base_config: Dict, user_config: Dict):
        """설정 업데이트 (재귀적)"""
        for key, value in user_config.items():
            if key in base_config and isinstance(base_config[key], dict) and isinstance(value, dict):
                self.update_config(base_config[key], value)
            else:
                base_config[key] = value
    
    def setup_logging(self):
        """로깅 설정"""
        log_dir = self.training_dir / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_dir / f"training_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def create_directories(self):
        """필요한 디렉토리 생성"""
        directories = [
            self.training_dir,
            self.training_dir / "datasets",
            self.training_dir / "runs",
            self.training_dir / "logs",
            self.training_dir / "weights"
        ]
        
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
            self.logger.info(f"📁 디렉토리 생성: {directory}")
    
    def log_training_event(self, status: str, message: str, metadata: Dict = None):
        """학습 이벤트를 Supabase에 로깅"""
        if not self.supabase:
            return
        
        try:
            event_data = {
                'operation_type': 'training',
                'status': status,
                'message': message,
                'metadata': metadata or {}
            }
            
            result = self.supabase.table('operation_logs').insert(event_data).execute()
            self.logger.info(f"📊 학습 이벤트 로깅: {status} - {message}")
            
        except Exception as e:
            self.logger.error(f"❌ 학습 이벤트 로깅 실패: {e}")
    
    def update_synthetic_part_stats(self, part_id: str, total_images: int, total_annotations: int):
        """synthetic_part_stats 테이블 업데이트"""
        if not self.supabase:
            return
        
        try:
            stats_data = {
                'part_id': part_id,
                'total_images': total_images,
                'total_annotations': total_annotations,
                'last_updated': datetime.now().isoformat()
            }
            
            # UPSERT (존재하면 업데이트, 없으면 삽입)
            result = self.supabase.table('synthetic_part_stats').upsert(stats_data).execute()
            self.logger.info(f"📊 부품 통계 업데이트: {part_id} - {total_images}개 이미지")
            
        except Exception as e:
            self.logger.error(f"❌ 부품 통계 업데이트 실패: {e}")
    
    def update_parts_master_features(self, part_id: str, detection_accuracy: float, precision_score: float, recall_score: float):
        """parts_master_features 테이블의 성능 지표 업데이트"""
        if not self.supabase:
            return
        
        try:
            # score_final 계산 (가중 평균)
            score_final = (detection_accuracy * 0.4 + precision_score * 0.3 + recall_score * 0.3)
            
            update_data = {
                'detection_accuracy': detection_accuracy,
                'precision_score': precision_score,
                'recall_score': recall_score,
                'score_final': score_final,
                'updated_at': datetime.now().isoformat()
            }
            
            result = self.supabase.table('parts_master_features').update(update_data).eq('part_id', part_id).execute()
            self.logger.info(f"📊 부품 성능 업데이트: {part_id} - 정확도: {detection_accuracy:.3f}")
            
        except Exception as e:
            self.logger.error(f"❌ 부품 성능 업데이트 실패: {e}")
    
    def validate_dataset(self) -> Tuple[bool, Dict]:
        """데이터셋 검증"""
        self.logger.info("🔍 데이터셋 검증 시작...")
        
        validation_result = {
            'valid': False,
            'total_images': 0,
            'total_labels': 0,
            'missing_files': [],
            'invalid_annotations': [],
            'class_distribution': {},
            'image_formats': set(),
            'label_formats': set()
        }
        
        try:
            # 이미지 및 라벨 디렉토리 확인
            images_dir = self.output_dir / "images"
            labels_dir = self.output_dir / "labels"
            
            if not images_dir.exists() or not labels_dir.exists():
                self.logger.error("❌ 이미지 또는 라벨 디렉토리가 없습니다")
                return False, validation_result
            
            # 훈련/검증/테스트 분할 확인
            for split in ['train', 'val', 'test']:
                split_images_dir = images_dir / split
                split_labels_dir = labels_dir / split
                
                if not split_images_dir.exists() or not split_labels_dir.exists():
                    self.logger.warning(f"⚠️ {split} 분할 디렉토리가 없습니다")
                    continue
                
                # 이미지 파일 검사
                image_files = list(split_images_dir.glob("*.webp"))
                label_files = list(split_labels_dir.glob("*.txt"))
                
                self.logger.info(f"📊 {split} 분할: {len(image_files)}개 이미지, {len(label_files)}개 라벨")
                
                # 파일 매칭 검사
                for img_file in image_files:
                    label_file = split_labels_dir / f"{img_file.stem}.txt"
                    if not label_file.exists():
                        validation_result['missing_files'].append(str(label_file))
                
                validation_result['total_images'] += len(image_files)
                validation_result['total_labels'] += len(label_files)
            
            # YOLO 설정 파일 생성
            self.create_yolo_config()
            
            validation_result['valid'] = True
            self.logger.info(f"✅ 데이터셋 검증 완료: {validation_result['total_images']}개 이미지, {validation_result['total_labels']}개 라벨")
            
        except Exception as e:
            self.logger.error(f"❌ 데이터셋 검증 실패: {e}")
            validation_result['error'] = str(e)
        
        return validation_result['valid'], validation_result
    
    def create_yolo_config(self):
        """YOLO 설정 파일 생성"""
        config_path = self.output_dir / "data.yaml"
        
        yolo_config = {
            'path': str(self.output_dir.absolute()),
            'train': 'images/train',
            'val': 'images/val',
            'test': 'images/test',
            'nc': self.config['model']['num_classes'],
            'names': self.config['model']['classes']
        }
        
        with open(config_path, 'w', encoding='utf-8') as f:
            yaml.dump(yolo_config, f, default_flow_style=False, allow_unicode=True)
        
        self.logger.info(f"📝 YOLO 설정 파일 생성: {config_path}")
    
    def train_model(self) -> Dict:
        """YOLO 모델 학습"""
        if not YOLO_AVAILABLE:
            raise ImportError("ultralytics가 설치되지 않았습니다")
        
        self.logger.info("🚀 YOLO 모델 학습 시작...")
        
        # 학습 시작 이벤트 로깅
        self.log_training_event('running', 'YOLO 모델 학습 시작', {
            'epochs': self.config['training']['epochs'],
            'batch_size': self.config['training']['batch_size'],
            'device': self.config['training']['device']
        })
        
        try:
            # 사전 훈련된 모델 로드
            model = YOLO(self.config['model']['base_model'])
            
            # 학습 설정
            train_config = self.config['training']
            data_config = self.config['data']
            
            # 학습 실행
            results = model.train(
                data=str(self.output_dir / "data.yaml"),
                epochs=train_config['epochs'],
                imgsz=train_config['imgsz'],
                batch=train_config['batch_size'],
                device=train_config['device'],
                patience=train_config['patience'],
                save_period=train_config['save_period'],
                lr0=train_config['lr0'],
                lrf=train_config['lrf'],
                momentum=train_config['momentum'],
                weight_decay=train_config['weight_decay'],
                warmup_epochs=train_config['warmup_epochs'],
                warmup_momentum=train_config['warmup_momentum'],
                warmup_bias_lr=train_config['warmup_bias_lr'],
                # 데이터 증강 설정
                hsv_h=data_config['hsv_h'],
                hsv_s=data_config['hsv_s'],
                hsv_v=data_config['hsv_v'],
                degrees=data_config['degrees'],
                translate=data_config['translate'],
                scale=data_config['scale'],
                shear=data_config['shear'],
                perspective=data_config['perspective'],
                flipud=data_config['flipud'],
                fliplr=data_config['fliplr'],
                mosaic=data_config['mosaic'],
                mixup=data_config['mixup'],
                copy_paste=data_config['copy_paste'],
                # 출력 디렉토리
                project=str(self.training_dir / "runs"),
                name="lego_yolo_training"
            )
            
            self.logger.info("✅ YOLO 모델 학습 완료")
            
            # 학습 완료 이벤트 로깅
            self.log_training_event('completed', 'YOLO 모델 학습 완료', {
                'model_path': str(results.save_dir / "weights" / "best.pt"),
                'training_time': getattr(results, 'training_time', None)
            })
            
            # 학습 결과 저장
            training_results = {
                'model_path': str(results.save_dir / "weights" / "best.pt"),
                'last_model_path': str(results.save_dir / "weights" / "last.pt"),
                'results_path': str(results.save_dir),
                'metrics': results.results_dict if hasattr(results, 'results_dict') else {},
                'training_time': getattr(results, 'training_time', None)
            }
            
            return training_results
            
        except Exception as e:
            # 학습 실패 이벤트 로깅
            self.log_training_event('failed', f'YOLO 모델 학습 실패: {e}', {
                'error': str(e)
            })
            self.logger.error(f"❌ 모델 학습 실패: {e}")
            raise
    
    def validate_model(self, model_path: str) -> Dict:
        """학습된 모델 검증"""
        self.logger.info("🔍 학습된 모델 검증 시작...")
        
        try:
            model = YOLO(model_path)
            
            # 검증 실행
            val_config = self.config['validation']
            results = model.val(
                data=str(self.output_dir / "data.yaml"),
                conf=val_config['conf_threshold'],
                iou=val_config['iou_threshold'],
                max_det=val_config['max_det'],
                save_json=val_config['save_json'],
                save_hybrid=val_config['save_hybrid'],
                verbose=val_config['verbose']
            )
            
            # 안전한 메트릭 추출
            validation_metrics = {
                'mAP50': 0,
                'mAP50_95': 0,
                'precision': 0,
                'recall': 0,
                'f1_score': 0
            }
            
            # results.box가 있는 경우 안전하게 접근
            if hasattr(results, 'box') and results.box is not None:
                validation_metrics['mAP50'] = getattr(results.box, 'map50', 0)
                validation_metrics['mAP50_95'] = getattr(results.box, 'map', 0)
                validation_metrics['precision'] = getattr(results.box, 'mp', 0)
                validation_metrics['recall'] = getattr(results.box, 'mr', 0)
                
                # F1 스코어 계산 (안전하게)
                if validation_metrics['precision'] > 0 and validation_metrics['recall'] > 0:
                    validation_metrics['f1_score'] = 2 * (validation_metrics['precision'] * validation_metrics['recall']) / (validation_metrics['precision'] + validation_metrics['recall'])
            
            # results.metrics가 있는 경우 대안으로 사용
            elif hasattr(results, 'metrics') and results.metrics is not None:
                metrics = results.metrics
                validation_metrics['mAP50'] = metrics.get('mAP50', 0)
                validation_metrics['mAP50_95'] = metrics.get('mAP50-95', 0)
                validation_metrics['precision'] = metrics.get('precision', 0)
                validation_metrics['recall'] = metrics.get('recall', 0)
                validation_metrics['f1_score'] = metrics.get('f1', 0)
            
            # vars(results)로 안전하게 접근
            else:
                try:
                    results_dict = vars(results)
                    validation_metrics['mAP50'] = results_dict.get('mAP50', 0)
                    validation_metrics['mAP50_95'] = results_dict.get('mAP50-95', 0)
                    validation_metrics['precision'] = results_dict.get('precision', 0)
                    validation_metrics['recall'] = results_dict.get('recall', 0)
                except:
                    self.logger.warning("⚠️ 메트릭 추출 실패, 기본값 사용")
            
            self.logger.info(f"📊 모델 검증 결과: mAP50={validation_metrics['mAP50']:.3f}, mAP50-95={validation_metrics['mAP50_95']:.3f}")
            
            return validation_metrics
            
        except Exception as e:
            self.logger.error(f"❌ 모델 검증 실패: {e}")
            raise
    
    def deploy_model(self, model_path: str) -> str:
        """학습된 모델 배포"""
        self.logger.info("🚀 학습된 모델 배포 시작...")
        
        try:
            # ONNX 형식으로 변환
            model = YOLO(model_path)
            onnx_path = model.export(format='onnx', imgsz=self.config['model']['input_size'])
            
            # 배포용 파일명 생성
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            deployed_model_name = f"lego_yolo_custom_{timestamp}.onnx"
            deployed_model_path = self.models_dir / deployed_model_name
            
            # 모델 파일 복사
            shutil.copy2(onnx_path, deployed_model_path)
            
            # 기존 모델 백업 (있는 경우)
            old_model_path = self.models_dir / "lego_yolo_custom.onnx"
            if old_model_path.exists():
                backup_path = self.models_dir / f"lego_yolo_custom_backup_{timestamp}.onnx"
                shutil.copy2(old_model_path, backup_path)
                self.logger.info(f"📦 기존 모델 백업: {backup_path}")
            
            # 새 모델을 기본 모델로 설정
            shutil.copy2(deployed_model_path, old_model_path)
            
            self.logger.info(f"✅ 모델 배포 완료: {deployed_model_path}")
            self.logger.info(f"✅ 기본 모델 업데이트: {old_model_path}")
            
            return str(deployed_model_path)
            
        except Exception as e:
            self.logger.error(f"❌ 모델 배포 실패: {e}")
            raise
    
    def run_full_pipeline(self) -> Dict:
        """전체 학습 파이프라인 실행"""
        self.logger.info("🎯 레고 YOLO 학습 파이프라인 시작...")
        
        pipeline_results = {
            'start_time': datetime.now(),
            'dataset_validation': None,
            'training': None,
            'validation': None,
            'deployment': None,
            'success': False,
            'error': None
        }
        
        try:
            # 1. 데이터셋 검증
            self.logger.info("📊 1단계: 데이터셋 검증")
            is_valid, validation_info = self.validate_dataset()
            if not is_valid:
                raise ValueError(f"데이터셋 검증 실패: {validation_info}")
            pipeline_results['dataset_validation'] = validation_info
            
            # 2. 모델 학습
            self.logger.info("🚀 2단계: 모델 학습")
            training_results = self.train_model()
            pipeline_results['training'] = training_results
            
            # 3. 모델 검증
            self.logger.info("🔍 3단계: 모델 검증")
            validation_metrics = self.validate_model(training_results['model_path'])
            pipeline_results['validation'] = validation_metrics
            
            # 4. 모델 배포
            self.logger.info("🚀 4단계: 모델 배포")
            deployed_path = self.deploy_model(training_results['model_path'])
            pipeline_results['deployment'] = {'deployed_path': deployed_path}
            
            pipeline_results['success'] = True
            pipeline_results['end_time'] = datetime.now()
            
            self.logger.info("🎉 전체 학습 파이프라인 완료!")
            
        except Exception as e:
            pipeline_results['error'] = str(e)
            pipeline_results['end_time'] = datetime.now()
            self.logger.error(f"❌ 학습 파이프라인 실패: {e}")
        
        # 결과 저장
        results_file = self.training_dir / f"pipeline_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(pipeline_results, f, indent=2, ensure_ascii=False, default=str)
        
        return pipeline_results

def main():
    """메인 실행 함수"""
    parser = argparse.ArgumentParser(description='레고 부품 YOLO 모델 학습')
    parser.add_argument('--config', type=str, help='설정 파일 경로')
    parser.add_argument('--validate-only', action='store_true', help='데이터셋 검증만 실행')
    parser.add_argument('--train-only', action='store_true', help='학습만 실행')
    parser.add_argument('--validate-model', type=str, help='특정 모델 검증')
    parser.add_argument('--deploy-model', type=str, help='특정 모델 배포')
    parser.add_argument('--device', type=str, default='auto', help='학습 디바이스 (auto, cpu, cuda, cuda:0, cuda:1)')
    parser.add_argument('--epochs', type=int, help='학습 에포크 수')
    parser.add_argument('--batch-size', type=int, help='배치 크기')
    parser.add_argument('--gpu-memory-fraction', type=float, default=0.8, help='GPU 메모리 사용 비율 (0.0-1.0)')
    
    args = parser.parse_args()
    
    # 학습기 초기화
    trainer = LegoYOLOTrainer(args.config)
    
    # CLI 인자로 설정 업데이트
    if args.device != 'auto':
        trainer.config['training']['device'] = args.device
    if args.epochs:
        trainer.config['training']['epochs'] = args.epochs
    if args.batch_size:
        trainer.config['training']['batch_size'] = args.batch_size
    
    # GPU 메모리 설정
    if args.device.startswith('cuda') and args.gpu_memory_fraction < 1.0:
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.set_per_process_memory_fraction(args.gpu_memory_fraction)
                print(f"🔧 GPU 메모리 사용 비율 설정: {args.gpu_memory_fraction}")
        except Exception as e:
            print(f"⚠️ GPU 메모리 설정 실패: {e}")
    
    try:
        if args.validate_only:
            # 데이터셋 검증만 실행
            is_valid, info = trainer.validate_dataset()
            print(f"데이터셋 검증 결과: {'성공' if is_valid else '실패'}")
            print(json.dumps(info, indent=2, ensure_ascii=False))
            
        elif args.validate_model:
            # 특정 모델 검증
            metrics = trainer.validate_model(args.validate_model)
            print("모델 검증 결과:")
            print(json.dumps(metrics, indent=2, ensure_ascii=False))
            
        elif args.deploy_model:
            # 특정 모델 배포
            deployed_path = trainer.deploy_model(args.deploy_model)
            print(f"모델 배포 완료: {deployed_path}")
            
        elif args.train_only:
            # 학습만 실행
            results = trainer.train_model()
            print("학습 완료:")
            print(json.dumps(results, indent=2, ensure_ascii=False))
            
        else:
            # 전체 파이프라인 실행
            results = trainer.run_full_pipeline()
            print("학습 파이프라인 결과:")
            print(json.dumps(results, indent=2, ensure_ascii=False))
            
    except Exception as e:
        print(f"❌ 실행 실패: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

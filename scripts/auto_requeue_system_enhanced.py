#!/usr/bin/env python3
"""
BrickBox Auto-Requeue 시스템 (실패 원인별 파라미터 적용)
QA FAIL → render_queue → 재학습 트리거 연동
"""

import os
import sys
import json
import time
import logging
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AutoRequeueSystemEnhanced:
    """Auto-Requeue 시스템 (실패 원인별 파라미터 적용)"""
    
    def __init__(self, supabase_client=None):
        self.supabase = supabase_client
        self.supabase_url = os.getenv('VITE_SUPABASE_URL')
        self.supabase_key = os.getenv('VITE_SUPABASE_SERVICE_ROLE')
        self.retrain_trigger = None
        self.retry_parameter_manager = None
        
        # QA FAIL 임계치 설정
        self.qa_thresholds = {
            'ssim_min': 0.96,
            'snr_min': 30.0,
            'sharpness_min': 0.7,
            'reprojection_rms_max': 1.5,
            'depth_score_min': 0.85
        }
        
        # 재학습 트리거 임계치
        self.retrain_thresholds = {
            'consecutive_failures': 10,
            'quality_degradation_threshold': 0.05,
            'data_volume_threshold': 100
        }
    
    def initialize_retrain_trigger(self):
        """재학습 트리거 초기화"""
        try:
            from retrain_trigger import RetrainTriggerManager
            self.retrain_trigger = RetrainTriggerManager(
                config_path="config/retrain_config.json",
                supabase_client=self.supabase
            )
            logger.info("✅ 재학습 트리거 초기화 완료")
            return True
        except Exception as e:
            logger.error(f"[ERROR] 재학습 트리거 초기화 실패: {e}")
            return False
    
    def initialize_retry_parameters(self):
        """재렌더링 파라미터 매니저 초기화"""
        try:
            from retry_render_parameters import RetryParameterManager
            self.retry_parameter_manager = RetryParameterManager("config/retry_parameters.json")
            logger.info("✅ 재렌더링 파라미터 매니저 초기화 완료")
            return True
        except Exception as e:
            logger.error(f"[ERROR] 재렌더링 파라미터 매니저 초기화 실패: {e}")
            return False
    
    def check_qa_failures(self, hours: int = 24) -> List[Dict]:
        """QA FAIL 샘플 검사"""
        try:
            if not self.supabase:
                logger.error("[ERROR] Supabase 연결 없음")
                return []
            
            # 최근 N시간 QA FAIL 샘플 조회
            cutoff_time = datetime.now() - timedelta(hours=hours)
            
            # QA 로그에서 FAIL/WARN 샘플 조회
            result = (self.supabase.table('qa_logs')
                    .select('*')
                    .gte('created_at', cutoff_time.isoformat())
                    .or_("qa_status.like.fail_%,qa_status.like.FAIL_%")
                    .execute())
            
            if not result.data:
                return []
            
            fail_samples = []
            for qa_log in result.data:
                # QA FAIL 조건 확인
                if self._is_qa_failure(qa_log):
                    fail_samples.append({
                        'part_id': qa_log.get('part_id'),
                        'element_id': qa_log.get('element_id'),
                        'image_url': qa_log.get('image_url'),
                        'qa_metrics': {
                            'ssim': qa_log.get('ssim', 0),
                            'snr': qa_log.get('snr', 0),
                            'sharpness': qa_log.get('sharpness', 0),
                            'reprojection_error': qa_log.get('reprojection_error', 0),
                            'depth_score': qa_log.get('depth_score', 0)
                        },
                        'failure_reason': self._get_failure_reason(qa_log),
                        'created_at': qa_log.get('created_at')
                    })
            
            logger.info(f"🔍 QA FAIL 샘플 {len(fail_samples)}개 발견 (최근 {hours}시간)")
            return fail_samples
            
        except Exception as e:
            logger.error(f"[ERROR] QA FAIL 검사 실패: {e}")
            return []
    
    def _is_qa_failure(self, qa_log: Dict) -> bool:
        """QA FAIL 조건 확인"""
        try:
            # 직접 필드에서 값 확인
            ssim = qa_log.get('ssim', 1.0)
            snr = qa_log.get('snr', 100.0)
            sharpness = qa_log.get('sharpness', 1.0)
            reprojection_error = qa_log.get('reprojection_error', 0.0)
            depth_score = qa_log.get('depth_score', 1.0)
            
            # 임계치 확인
            if ssim < self.qa_thresholds['ssim_min']:
                return True
            if snr < self.qa_thresholds['snr_min']:
                return True
            if sharpness < self.qa_thresholds['sharpness_min']:
                return True
            if reprojection_error > self.qa_thresholds['reprojection_rms_max']:
                return True
            if depth_score < self.qa_thresholds['depth_score_min']:
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"[ERROR] QA FAIL 조건 확인 실패: {e}")
            return False
    
    def _get_failure_reason(self, qa_log: Dict) -> str:
        """실패 사유 분석"""
        try:
            reasons = []
            
            ssim = qa_log.get('ssim', 1.0)
            snr = qa_log.get('snr', 100.0)
            sharpness = qa_log.get('sharpness', 1.0)
            reprojection_error = qa_log.get('reprojection_error', 0.0)
            depth_score = qa_log.get('depth_score', 1.0)
            
            if ssim < self.qa_thresholds['ssim_min']:
                reasons.append(f"SSIM {ssim:.3f} < {self.qa_thresholds['ssim_min']}")
            if snr < self.qa_thresholds['snr_min']:
                reasons.append(f"SNR {snr:.1f} < {self.qa_thresholds['snr_min']}")
            if sharpness < self.qa_thresholds['sharpness_min']:
                reasons.append(f"Sharpness {sharpness:.3f} < {self.qa_thresholds['sharpness_min']}")
            if reprojection_error > self.qa_thresholds['reprojection_rms_max']:
                reasons.append(f"RMS {reprojection_error:.2f} > {self.qa_thresholds['reprojection_rms_max']}")
            if depth_score < self.qa_thresholds['depth_score_min']:
                reasons.append(f"Depth Score {depth_score:.3f} < {self.qa_thresholds['depth_score_min']}")
            
            return "; ".join(reasons) if reasons else "Unknown"
            
        except Exception as e:
            logger.error(f"[ERROR] 실패 사유 분석 실패: {e}")
            return "Analysis failed"
    
    def enqueue_failed_samples_with_parameters(self, fail_samples: List[Dict]) -> int:
        """실패 샘플을 실패 원인별 파라미터와 함께 render_queue에 재삽입"""
        try:
            if not fail_samples:
                return 0
            
            if not self.retry_parameter_manager:
                logger.warning("[WARNING] 재렌더링 파라미터 매니저가 초기화되지 않음")
                return self._enqueue_without_parameters(fail_samples)
            
            requeue_count = 0
            for sample in fail_samples:
                try:
                    # 실패 원인별 파라미터 조회
                    retry_params = self.retry_parameter_manager.get_retry_parameters(
                        sample['failure_reason']
                    )
                    
                    # Blender 명령어 생성
                    blender_command = self.retry_parameter_manager.generate_blender_command(
                        part_id=sample['part_id'],
                        failure_reason=sample['failure_reason'],
                        element_id=sample.get('element_id', 'unknown'),
                        color_id=15,  # 기본값
                        color_hex="#FFFFFF"  # 기본값
                    )
                    
                    # render_queue에 재삽입 요청 (파라미터 포함)
                    requeue_data = {
                        'part_id': sample['part_id'],
                        'element_id': sample.get('element_id'),
                        'image_url': sample['image_url'],
                        'requeue_reason': sample['failure_reason'],
                        'priority': 'high',
                        'retry_parameters': {
                            'samples': retry_params.samples,
                            'lighting': retry_params.lighting,
                            'background': retry_params.background,
                            'camera_distance': retry_params.camera_distance,
                            'focus_depth': retry_params.focus_depth,
                            'camera_variation': retry_params.camera_variation,
                            'pose_variation': retry_params.pose_variation,
                            'color_management': retry_params.color_management,
                            'resolution': retry_params.resolution,
                            'target_fill': retry_params.target_fill,
                            'additional_params': retry_params.additional_params
                        },
                        'blender_command': blender_command,
                        'created_at': datetime.now().isoformat()
                    }
                    
                    # Supabase에 render_queue 항목 추가
                    if self.supabase:
                        result = self.supabase.table('render_queue').insert(requeue_data).execute()
                        if result.data:
                            requeue_count += 1
                            logger.info(f"🔄 재삽입: {sample['part_id']} - {sample['failure_reason']}")
                            logger.info(f"   파라미터: samples={retry_params.samples}, lighting={retry_params.lighting}")
                    
                except Exception as e:
                    logger.error(f"[ERROR] 재삽입 실패 {sample['part_id']}: {e}")
            
            logger.info(f"✅ {requeue_count}개 샘플 재삽입 완료 (파라미터 적용)")
            return requeue_count
            
        except Exception as e:
            logger.error(f"[ERROR] 재삽입 실패: {e}")
            return 0
    
    def _enqueue_without_parameters(self, fail_samples: List[Dict]) -> int:
        """파라미터 없이 기본 재삽입"""
        try:
            requeue_count = 0
            for sample in fail_samples:
                try:
                    requeue_data = {
                        'part_id': sample['part_id'],
                        'element_id': sample.get('element_id'),
                        'image_url': sample['image_url'],
                        'requeue_reason': sample['failure_reason'],
                        'priority': 'high',
                        'created_at': datetime.now().isoformat()
                    }
                    
                    if self.supabase:
                        result = self.supabase.table('render_queue').insert(requeue_data).execute()
                        if result.data:
                            requeue_count += 1
                            logger.info(f"🔄 기본 재삽입: {sample['part_id']}")
                
                except Exception as e:
                    logger.error(f"[ERROR] 기본 재삽입 실패 {sample['part_id']}: {e}")
            
            return requeue_count
            
        except Exception as e:
            logger.error(f"[ERROR] 기본 재삽입 실패: {e}")
            return 0
    
    def check_retrain_conditions(self, fail_samples: List[Dict]) -> bool:
        """재학습 조건 확인"""
        try:
            if not self.retrain_trigger:
                logger.warning("[WARNING] 재학습 트리거 초기화되지 않음")
                return False
            
            # 연속 실패 횟수 확인
            if len(fail_samples) >= self.retrain_thresholds['consecutive_failures']:
                logger.warning(f"🚨 연속 실패 {len(fail_samples)}회 - 재학습 트리거")
                return True
            
            # 품질 저하 확인
            quality_degradation = self._calculate_quality_degradation(fail_samples)
            if quality_degradation > self.retrain_thresholds['quality_degradation_threshold']:
                logger.warning(f"📉 품질 저하 {quality_degradation:.3f} - 재학습 트리거")
                return True
            
            # 데이터 볼륨 확인
            if len(fail_samples) >= self.retrain_thresholds['data_volume_threshold']:
                logger.warning(f"📊 대량 실패 {len(fail_samples)}개 - 재학습 트리거")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"[ERROR] 재학습 조건 확인 실패: {e}")
            return False
    
    def _calculate_quality_degradation(self, fail_samples: List[Dict]) -> float:
        """품질 저하율 계산"""
        try:
            if not fail_samples:
                return 0.0
            
            # 평균 품질 지표 계산
            total_ssim = sum(sample['qa_metrics'].get('ssim', 1.0) for sample in fail_samples)
            avg_ssim = total_ssim / len(fail_samples)
            
            # 기준 대비 저하율 계산
            degradation = (self.qa_thresholds['ssim_min'] - avg_ssim) / self.qa_thresholds['ssim_min']
            return max(0.0, degradation)
            
        except Exception as e:
            logger.error(f"[ERROR] 품질 저하율 계산 실패: {e}")
            return 0.0
    
    def trigger_retraining(self, fail_samples: List[Dict]) -> bool:
        """재학습 트리거 실행"""
        try:
            if not self.retrain_trigger:
                logger.error("[ERROR] 재학습 트리거 초기화되지 않음")
                return False
            
            # 재학습 트리거 실행
            result = self.retrain_trigger.evaluate_all_triggers_with_notification()
            if result.get('recommendation', {}).get('should_retrain'):
                logger.info("🚀 재학습 트리거 실행됨")
                
                # Slack 알림 전송
                self._send_retrain_notification(
                    result.get('triggers', []), 
                    result.get('recommendation', {})
                )
                
                # 하이브리드 학습 파이프라인 실행
                self._execute_hybrid_training()
                return True
            else:
                logger.info("ℹ️ 재학습 불필요")
                return False
                
        except Exception as e:
            logger.error(f"[ERROR] 재학습 트리거 실행 실패: {e}")
            return False
    
    def _execute_hybrid_training(self):
        """하이브리드 학습 파이프라인 실행"""
        try:
            from hybrid_yolo_training_pipeline import HybridYOLOTrainingPipeline
            
            # 하이브리드 학습 파이프라인 초기화
            pipeline = HybridYOLOTrainingPipeline()
            
            # 최신 데이터셋 경로 설정
            dataset_path = self._get_latest_dataset_path()
            
            # 학습 실행
            logger.info("🎯 하이브리드 학습 파이프라인 실행")
            results = pipeline.run_hybrid_training(dataset_path)
            logger.info("✅ 하이브리드 학습 완료")
            return results
            
        except Exception as e:
            logger.error(f"[ERROR] 하이브리드 학습 실행 실패: {e}")
            return None
    
    def _send_retrain_notification(self, triggers: List[Dict], recommendation: Dict):
        """재학습 트리거 Slack 알림"""
        try:
            from slack_notification_system import SlackNotificationSystem
            
            slack_system = SlackNotificationSystem(self.supabase)
            slack_system.load_notification_settings()
            slack_system.send_retrain_trigger_notification(triggers, recommendation)
            logger.info("📢 재학습 트리거 Slack 알림 전송")
            
        except Exception as e:
            logger.error(f"[ERROR] 재학습 트리거 Slack 알림 실패: {e}")
    
    def _get_latest_dataset_path(self) -> str:
        """최신 데이터셋 경로 조회"""
        try:
            if not self.supabase:
                return "output/synthetic"
            
            # 최신 세트별 데이터셋 경로 조회
            result = (self.supabase.table('synthetic_dataset')
                    .select('set_num, created_at')
                    .order('created_at', desc=True)
                    .limit(1)
                    .execute())
            
            if result.data:
                set_num = result.data[0].get('set_num', 'latest')
                return f"output/synthetic/dataset_{set_num}"
            else:
                return "output/synthetic"
                
        except Exception as e:
            logger.error(f"[ERROR] 최신 데이터셋 경로 조회 실패: {e}")
            return "output/synthetic"
    
    def run_auto_requeue_cycle(self, hours: int = 24):
        """Auto-Requeue 사이클 실행 (실패 원인별 파라미터 적용)"""
        try:
            logger.info("🔄 Auto-Requeue 사이클 시작 (실패 원인별 파라미터 적용)")
            
            # 1. QA FAIL 샘플 검사
            fail_samples = self.check_qa_failures(hours)
            if not fail_samples:
                logger.info("✅ QA FAIL 샘플 없음")
                return
            
            # 2. 실패 샘플 재삽입 (파라미터 적용)
            requeue_count = self.enqueue_failed_samples_with_parameters(fail_samples)
            logger.info(f"✅ 재삽입 완료: {requeue_count}개 (파라미터 적용)")
            
            # 3. 재학습 조건 확인
            if self.check_retrain_conditions(fail_samples):
                # 4. 재학습 트리거 실행
                self.trigger_retraining(fail_samples)
            
            logger.info("✅ Auto-Requeue 사이클 완료")
            
        except Exception as e:
            logger.error(f"[ERROR] Auto-Requeue 사이클 실패: {e}")
    
    def get_quality_healing_stats(self, days: int = 7) -> Dict:
        """품질 회복 통계 조회"""
        try:
            if not self.supabase:
                return {"error": "Supabase 연결 없음"}
            
            # 품질 회복 통계 조회
            result = self.supabase.rpc('get_quality_healing_stats', {'days_back': days}).execute()
            
            if result.data:
                return {
                    "success": True,
                    "stats": result.data,
                    "period_days": days
                }
            else:
                return {"error": "통계 조회 실패"}
                
        except Exception as e:
            logger.error(f"[ERROR] 품질 회복 통계 조회 실패: {e}")
            return {"error": str(e)}

def main():
    """메인 실행 함수"""
    try:
        # Supabase 클라이언트 초기화
        from supabase import create_client
        
        supabase_url = os.getenv('VITE_SUPABASE_URL')
        supabase_key = os.getenv('VITE_SUPABASE_SERVICE_ROLE')
        
        if not supabase_url or not supabase_key:
            logger.error("[ERROR] Supabase 환경 변수가 설정되지 않았습니다.")
            return
        
        supabase = create_client(supabase_url, supabase_key)
        
        # Auto-Requeue 시스템 초기화
        auto_requeue = AutoRequeueSystemEnhanced(supabase)
        
        # 재학습 트리거 초기화
        auto_requeue.initialize_retrain_trigger()
        
        # 재렌더링 파라미터 매니저 초기화
        auto_requeue.initialize_retry_parameters()
        
        # Auto-Requeue 사이클 실행
        auto_requeue.run_auto_requeue_cycle(hours=24)
        
        # 품질 회복 통계 조회
        stats = auto_requeue.get_quality_healing_stats(days=7)
        if stats.get('success'):
            logger.info(f"📊 품질 회복 통계: {stats['stats']}")
        
    except Exception as e:
        logger.error(f"[ERROR] Auto-Requeue 시스템 실행 실패: {e}")

if __name__ == "__main__":
    main()

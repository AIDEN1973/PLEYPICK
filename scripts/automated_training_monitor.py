#!/usr/bin/env python3
"""
🧱 BrickBox 자동화된 YOLO 학습 모니터링 시스템

실시간 학습 상태 모니터링, 성능 추적, 알림 발송
- 학습 작업 상태 추적
- 모델 성능 모니터링
- 자동 알림 발송
- 대시보드 데이터 제공
"""

import os
import sys
import json
import time
import requests
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from pathlib import Path
from dataclasses import dataclass

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    print("⚠️ supabase를 설치하세요: pip install supabase")
    SUPABASE_AVAILABLE = False

@dataclass
class TrainingMetrics:
    """학습 메트릭 데이터 클래스"""
    job_id: int
    epoch: int
    train_loss: float
    val_loss: float
    mAP50: float
    mAP50_95: float
    precision: float
    recall: float
    f1_score: float
    learning_rate: float
    timestamp: datetime

@dataclass
class AlertConfig:
    """알림 설정 데이터 클래스"""
    webhook_url: Optional[str] = None
    email_enabled: bool = False
    email_recipients: List[str] = None
    performance_thresholds: Dict[str, float] = None
    
    def __post_init__(self):
        if self.email_recipients is None:
            self.email_recipients = []
        if self.performance_thresholds is None:
            self.performance_thresholds = {
                'mAP50': 0.7,
                'precision': 0.8,
                'recall': 0.8,
                'f1_score': 0.8
            }

class TrainingMonitor:
    """학습 모니터링 클래스"""
    
    def __init__(self, supabase_url: str, supabase_key: str):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.supabase: Optional[Client] = None
        self.alert_config = AlertConfig()
        self.monitoring_active = False
        
        if SUPABASE_AVAILABLE:
            self.supabase = create_client(supabase_url, supabase_key)
            self.load_alert_config()
    
    def load_alert_config(self):
        """알림 설정 로드"""
        try:
            # Supabase에서 알림 설정 조회
            response = self.supabase.table('automation_config')\
                .select('config_value')\
                .eq('config_key', 'notification_webhook')\
                .single()
            
            if response.data:
                config_data = response.data['config_value']
                self.alert_config.webhook_url = config_data.get('url')
            
        except Exception as e:
            print(f"⚠️ 알림 설정 로드 실패: {e}")
    
    def get_active_training_jobs(self) -> List[Dict]:
        """활성 학습 작업 조회"""
        try:
            response = self.supabase.table('training_jobs')\
                .select('*')\
                .in_('status', ['pending', 'running'])\
                .order('created_at', desc=True)
            
            return response.data or []
            
        except Exception as e:
            print(f"❌ 활성 학습 작업 조회 실패: {e}")
            return []
    
    def get_training_metrics(self, job_id: int, limit: int = 100) -> List[TrainingMetrics]:
        """학습 메트릭 조회"""
        try:
            response = self.supabase.table('training_metrics')\
                .select('*')\
                .eq('training_job_id', job_id)\
                .order('epoch', desc=True)\
                .limit(limit)
            
            metrics = []
            for row in response.data or []:
                metrics.append(TrainingMetrics(
                    job_id=row['training_job_id'],
                    epoch=row['epoch'],
                    train_loss=row.get('train_loss', 0),
                    val_loss=row.get('val_loss', 0),
                    mAP50=row.get('mAP50', 0),
                    mAP50_95=row.get('mAP50_95', 0),
                    precision=row.get('precision', 0),
                    recall=row.get('recall', 0),
                    f1_score=row.get('f1_score', 0),
                    learning_rate=row.get('learning_rate', 0),
                    timestamp=datetime.fromisoformat(row['timestamp'].replace('Z', '+00:00'))
                ))
            
            return metrics
            
        except Exception as e:
            print(f"❌ 학습 메트릭 조회 실패: {e}")
            return []
    
    def check_training_progress(self, job: Dict) -> Dict:
        """학습 진행상황 확인"""
        job_id = job['id']
        job_name = job['job_name']
        status = job['status']
        
        # 최근 메트릭 조회
        recent_metrics = self.get_training_metrics(job_id, limit=10)
        
        progress_info = {
            'job_id': job_id,
            'job_name': job_name,
            'status': status,
            'total_epochs': job.get('config', {}).get('epochs', 0),
            'current_epoch': 0,
            'latest_metrics': None,
            'progress_percentage': 0,
            'estimated_completion': None,
            'issues': []
        }
        
        if recent_metrics:
            latest = recent_metrics[0]
            progress_info['current_epoch'] = latest.epoch
            progress_info['latest_metrics'] = {
                'train_loss': latest.train_loss,
                'val_loss': latest.val_loss,
                'mAP50': latest.mAP50,
                'precision': latest.precision,
                'recall': latest.recall
            }
            
            # 진행률 계산
            total_epochs = progress_info['total_epochs']
            if total_epochs > 0:
                progress_info['progress_percentage'] = (latest.epoch / total_epochs) * 100
                
                # 예상 완료 시간 계산
                if latest.epoch > 0:
                    time_per_epoch = self.calculate_time_per_epoch(recent_metrics)
                    remaining_epochs = total_epochs - latest.epoch
                    estimated_time = time_per_epoch * remaining_epochs
                    progress_info['estimated_completion'] = datetime.now() + timedelta(seconds=estimated_time)
            
            # 문제점 감지
            progress_info['issues'] = self.detect_training_issues(recent_metrics)
        
        return progress_info
    
    def calculate_time_per_epoch(self, metrics: List[TrainingMetrics]) -> float:
        """에포크당 평균 시간 계산"""
        if len(metrics) < 2:
            return 0
        
        time_diffs = []
        for i in range(1, len(metrics)):
            diff = (metrics[i-1].timestamp - metrics[i].timestamp).total_seconds()
            time_diffs.append(diff)
        
        return sum(time_diffs) / len(time_diffs) if time_diffs else 0
    
    def detect_training_issues(self, metrics: List[TrainingMetrics]) -> List[str]:
        """학습 문제점 감지"""
        issues = []
        
        if len(metrics) < 3:
            return issues
        
        # 최근 3개 에포크의 메트릭
        recent = metrics[:3]
        
        # 1. 손실 함수 발산 확인
        train_losses = [m.train_loss for m in recent]
        if all(train_losses[i] > train_losses[i+1] * 1.5 for i in range(len(train_losses)-1)):
            issues.append("학습 손실이 발산하고 있습니다")
        
        # 2. 검증 손실 증가 확인
        val_losses = [m.val_loss for m in recent]
        if all(val_losses[i] < val_losses[i+1] for i in range(len(val_losses)-1)):
            issues.append("과적합이 발생할 수 있습니다")
        
        # 3. 성능 저하 확인
        mAP50s = [m.mAP50 for m in recent]
        if all(mAP50s[i] > mAP50s[i+1] for i in range(len(mAP50s)-1)):
            issues.append("모델 성능이 저하되고 있습니다")
        
        # 4. 학습률 문제 확인
        learning_rates = [m.learning_rate for m in recent]
        if all(lr == 0 for lr in learning_rates):
            issues.append("학습률이 0입니다")
        
        return issues
    
    def check_model_performance(self, model_id: int) -> Dict:
        """모델 성능 확인"""
        try:
            # 모델 정보 조회
            response = self.supabase.table('model_registry')\
                .select('*')\
                .eq('id', model_id)\
                .single()
            
            if not response.data:
                return {'error': '모델을 찾을 수 없습니다'}
            
            model = response.data
            metrics = model.get('metrics', {})
            
            # 성능 평가
            performance = {
                'model_id': model_id,
                'model_name': model['model_name'],
                'version': model['version'],
                'metrics': metrics,
                'performance_score': 0,
                'issues': [],
                'recommendations': []
            }
            
            # 성능 점수 계산
            score_weights = {'mAP50': 0.4, 'precision': 0.3, 'recall': 0.3}
            total_score = 0
            
            for metric, weight in score_weights.items():
                value = metrics.get(metric, 0)
                total_score += value * weight
                
                # 임계값 확인
                threshold = self.alert_config.performance_thresholds.get(metric, 0.7)
                if value < threshold:
                    performance['issues'].append(f"{metric}: {value:.3f} < {threshold}")
            
            performance['performance_score'] = total_score
            
            # 권장사항 생성
            if performance['issues']:
                performance['recommendations'].extend([
                    "더 많은 데이터로 재학습을 고려하세요",
                    "데이터 증강 기법을 적용해보세요",
                    "하이퍼파라미터 튜닝을 시도해보세요"
                ])
            
            return performance
            
        except Exception as e:
            return {'error': f'모델 성능 확인 실패: {e}'}
    
    def send_alert(self, alert_type: str, message: str, data: Dict = None):
        """알림 발송"""
        alert_data = {
            'type': alert_type,
            'message': message,
            'timestamp': datetime.now().isoformat(),
            'data': data or {}
        }
        
        # 웹훅 알림
        if self.alert_config.webhook_url:
            try:
                response = requests.post(
                    self.alert_config.webhook_url,
                    json=alert_data,
                    timeout=10
                )
                if response.status_code == 200:
                    print(f"✅ 웹훅 알림 발송 완료: {alert_type}")
                else:
                    print(f"⚠️ 웹훅 알림 발송 실패: {response.status_code}")
            except Exception as e:
                print(f"❌ 웹훅 알림 발송 실패: {e}")
        
        # 이메일 알림 (구현 필요)
        if self.alert_config.email_enabled:
            self.send_email_alert(alert_data)
    
    def send_email_alert(self, alert_data: Dict):
        """이메일 알림 발송 (구현 필요)"""
        # 실제 구현에서는 SMTP 또는 이메일 서비스 사용
        print(f"📧 이메일 알림: {alert_data['message']}")
    
    def monitor_training_jobs(self):
        """학습 작업 모니터링"""
        print("🔍 학습 작업 모니터링 시작...")
        
        active_jobs = self.get_active_training_jobs()
        
        for job in active_jobs:
            progress = self.check_training_progress(job)
            
            print(f"📊 작업 {progress['job_name']}: {progress['progress_percentage']:.1f}% 완료")
            
            # 문제점 알림
            if progress['issues']:
                self.send_alert(
                    'training_issues',
                    f"학습 작업 {progress['job_name']}에서 문제가 감지되었습니다",
                    {'job_id': progress['job_id'], 'issues': progress['issues']}
                )
            
            # 완료 예상 시간 알림
            if progress['estimated_completion']:
                remaining_time = progress['estimated_completion'] - datetime.now()
                if remaining_time.total_seconds() < 3600:  # 1시간 이내
                    self.send_alert(
                        'training_completion_soon',
                        f"학습 작업 {progress['job_name']}이 곧 완료됩니다",
                        {'job_id': progress['job_id'], 'estimated_completion': progress['estimated_completion'].isoformat()}
                    )
    
    def monitor_model_performance(self):
        """모델 성능 모니터링"""
        print("📈 모델 성능 모니터링 시작...")
        
        try:
            # 활성 모델 조회
            response = self.supabase.table('model_registry')\
                .select('id')\
                .eq('status', 'active')\
                .single()
            
            if not response.data:
                print("⚠️ 활성 모델이 없습니다")
                return
            
            model_id = response.data['id']
            performance = self.check_model_performance(model_id)
            
            if 'error' in performance:
                print(f"❌ 모델 성능 확인 실패: {performance['error']}")
                return
            
            print(f"📊 모델 {performance['model_name']} 성능 점수: {performance['performance_score']:.3f}")
            
            # 성능 문제 알림
            if performance['issues']:
                self.send_alert(
                    'model_performance_low',
                    f"모델 {performance['model_name']}의 성능이 기준치에 미달합니다",
                    performance
                )
            
        except Exception as e:
            print(f"❌ 모델 성능 모니터링 실패: {e}")
    
    def generate_dashboard_data(self) -> Dict:
        """대시보드 데이터 생성"""
        try:
            # 학습 작업 통계
            jobs_response = self.supabase.table('training_jobs')\
                .select('status, created_at')\
                .gte('created_at', (datetime.now() - timedelta(days=7)).isoformat())
            
            jobs_data = jobs_response.data or []
            job_stats = {
                'total': len(jobs_data),
                'completed': len([j for j in jobs_data if j['status'] == 'completed']),
                'running': len([j for j in jobs_data if j['status'] == 'running']),
                'failed': len([j for j in jobs_data if j['status'] == 'failed'])
            }
            
            # 모델 통계
            models_response = self.supabase.table('model_registry')\
                .select('status, created_at, metrics')\
                .gte('created_at', (datetime.now() - timedelta(days=30)).isoformat())
            
            models_data = models_response.data or []
            model_stats = {
                'total': len(models_data),
                'active': len([m for m in models_data if m['status'] == 'active']),
                'average_mAP50': sum(m.get('metrics', {}).get('mAP50', 0) for m in models_data) / max(len(models_data), 1)
            }
            
            # 최근 학습 메트릭
            recent_metrics = []
            for job in jobs_data[:5]:  # 최근 5개 작업
                metrics = self.get_training_metrics(job['id'], limit=1)
                if metrics:
                    recent_metrics.append({
                        'job_id': job['id'],
                        'latest_epoch': metrics[0].epoch,
                        'mAP50': metrics[0].mAP50,
                        'precision': metrics[0].precision,
                        'recall': metrics[0].recall
                    })
            
            return {
                'job_stats': job_stats,
                'model_stats': model_stats,
                'recent_metrics': recent_metrics,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"❌ 대시보드 데이터 생성 실패: {e}")
            return {}
    
    def start_monitoring(self, interval: int = 300):
        """모니터링 시작 (기본 5분 간격)"""
        print(f"🚀 학습 모니터링 시작 (간격: {interval}초)")
        self.monitoring_active = True
        
        while self.monitoring_active:
            try:
                print(f"\n⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - 모니터링 실행")
                
                # 학습 작업 모니터링
                self.monitor_training_jobs()
                
                # 모델 성능 모니터링
                self.monitor_model_performance()
                
                # 대시보드 데이터 저장
                dashboard_data = self.generate_dashboard_data()
                if dashboard_data:
                    # 대시보드 데이터를 파일로 저장 (또는 Supabase에 저장)
                    dashboard_file = project_root / "logs" / f"dashboard_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
                    dashboard_file.parent.mkdir(exist_ok=True)
                    
                    with open(dashboard_file, 'w', encoding='utf-8') as f:
                        json.dump(dashboard_data, f, indent=2, ensure_ascii=False, default=str)
                
                print("✅ 모니터링 완료")
                
            except Exception as e:
                print(f"❌ 모니터링 실행 중 오류: {e}")
            
            # 다음 실행까지 대기
            time.sleep(interval)
    
    def stop_monitoring(self):
        """모니터링 중지"""
        print("🛑 모니터링 중지")
        self.monitoring_active = False

def main():
    """메인 실행 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description='BrickBox 자동화된 YOLO 학습 모니터링')
    parser.add_argument('--interval', type=int, default=300, help='모니터링 간격 (초)')
    parser.add_argument('--once', action='store_true', help='한 번만 실행')
    parser.add_argument('--dashboard', action='store_true', help='대시보드 데이터만 생성')
    
    args = parser.parse_args()
    
    # Supabase 연결 설정
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        print("❌ Supabase 환경 변수가 설정되지 않았습니다")
        sys.exit(1)
    
    # 모니터 초기화
    monitor = TrainingMonitor(supabase_url, supabase_key)
    
    if args.dashboard:
        # 대시보드 데이터만 생성
        data = monitor.generate_dashboard_data()
        print(json.dumps(data, indent=2, ensure_ascii=False, default=str))
    elif args.once:
        # 한 번만 실행
        monitor.monitor_training_jobs()
        monitor.monitor_model_performance()
    else:
        # 지속적 모니터링
        try:
            monitor.start_monitoring(args.interval)
        except KeyboardInterrupt:
            monitor.stop_monitoring()

if __name__ == "__main__":
    main()

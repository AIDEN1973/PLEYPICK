#!/usr/bin/env python3
"""
🧱 BrickBox 자동 학습 스케줄러

완전 자동화된 YOLO 학습 스케줄링 시스템
- 시간 기반 자동 학습
- 데이터 기반 자동 학습
- 성능 기반 자동 재학습
- 알림 시스템
"""

import os
import sys
import time
import json
import schedule
import requests
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

# Supabase 클라이언트
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    print("⚠️ Supabase 클라이언트가 설치되지 않았습니다")

class AutoTrainingScheduler:
    """자동 학습 스케줄러 클래스"""
    
    def __init__(self):
        self.supabase = None
        self.scheduler_running = False
        
        if SUPABASE_AVAILABLE:
            self.init_supabase()
            self.setup_schedules()
    
    def init_supabase(self):
        """Supabase 클라이언트 초기화"""
        try:
            self.supabase = create_client(
                os.getenv('SUPABASE_URL', 'https://npferbxuxocbfnfbpcnz.supabase.co'),
                os.getenv('SUPABASE_SERVICE_ROLE_KEY', 'your-service-role-key')
            )
            print("✅ Supabase 연결 성공")
        except Exception as e:
            print(f"❌ Supabase 연결 실패: {e}")
            self.supabase = None
    
    def setup_schedules(self):
        """스케줄 설정"""
        # 1. 매일 새벽 2시 자동 학습 (기본 학습)
        schedule.every().day.at("02:00").do(self.daily_auto_training)
        
        # 2. 매주 일요일 새벽 3시 장시간 학습 (주간 학습)
        schedule.every().sunday.at("03:00").do(self.weekly_auto_training)
        
        # 3. 매시간 데이터 변경 감지 (실시간 학습)
        schedule.every().hour.do(self.hourly_data_check)
        
        # 4. 매 30분마다 성능 모니터링
        schedule.every(30).minutes.do(self.performance_monitoring)
        
        print("📅 자동 학습 스케줄 설정 완료")
        print("  - 매일 02:00: 기본 학습")
        print("  - 매주 일요일 03:00: 주간 학습")
        print("  - 매시간: 데이터 변경 감지")
        print("  - 매 30분: 성능 모니터링")
    
    def daily_auto_training(self):
        """매일 자동 학습"""
        print(f"🌅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - 매일 자동 학습 시작")
        
        try:
            # 학습 조건 확인
            conditions = self.check_training_conditions()
            if not conditions['should_train']:
                print(f"⏳ 학습 조건 미충족: {conditions['reason']}")
                return
            
            # 자동 학습 트리거
            result = self.trigger_training({
                'epochs': 100,
                'batch_size': 16,
                'imgsz': 640,
                'device': 'cuda',
                'schedule_type': 'daily'
            })
            
            if result['success']:
                print(f"✅ 매일 자동 학습 시작: {result['job_id']}")
                self.send_notification("매일 자동 학습이 시작되었습니다", result)
            else:
                print(f"❌ 매일 자동 학습 실패: {result['error']}")
                
        except Exception as e:
            print(f"❌ 매일 자동 학습 오류: {e}")
    
    def weekly_auto_training(self):
        """주간 자동 학습 (더 긴 학습)"""
        print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - 주간 자동 학습 시작")
        
        try:
            # 학습 조건 확인
            conditions = self.check_training_conditions()
            if not conditions['should_train']:
                print(f"⏳ 학습 조건 미충족: {conditions['reason']}")
                return
            
            # 주간 학습 (더 많은 에포크)
            result = self.trigger_training({
                'epochs': 200,  # 더 긴 학습
                'batch_size': 16,
                'imgsz': 640,
                'device': 'cuda',
                'schedule_type': 'weekly'
            })
            
            if result['success']:
                print(f"✅ 주간 자동 학습 시작: {result['job_id']}")
                self.send_notification("주간 자동 학습이 시작되었습니다", result)
            else:
                print(f"❌ 주간 자동 학습 실패: {result['error']}")
                
        except Exception as e:
            print(f"❌ 주간 자동 학습 오류: {e}")
    
    def hourly_data_check(self):
        """매시간 데이터 변경 감지"""
        print(f"🔍 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - 데이터 변경 감지")
        
        try:
            # 최근 1시간 새 데이터 확인
            one_hour_ago = datetime.now() - timedelta(hours=1)
            result = self.supabase.table('synthetic_dataset').select('*').gte('created_at', one_hour_ago.isoformat()).execute()
            new_data_count = len(result.data) if result.data else 0
            
            print(f"📊 최근 1시간 새 데이터: {new_data_count}개")
            
            # 100개 이상 새 데이터가 있으면 즉시 학습
            if new_data_count >= 100:
                print("🎯 대량 데이터 감지 - 즉시 학습 시작")
                result = self.trigger_training({
                    'epochs': 100,
                    'batch_size': 16,
                    'imgsz': 640,
                    'device': 'cuda',
                    'schedule_type': 'immediate',
                    'new_data_count': new_data_count
                })
                
                if result['success']:
                    print(f"✅ 즉시 학습 시작: {result['job_id']}")
                    self.send_notification(f"대량 데이터 감지로 즉시 학습이 시작되었습니다 ({new_data_count}개)", result)
                else:
                    print(f"❌ 즉시 학습 실패: {result['error']}")
            else:
                print(f"⏳ 데이터 부족: {new_data_count}/100개")
                
        except Exception as e:
            print(f"❌ 데이터 변경 감지 오류: {e}")
    
    def performance_monitoring(self):
        """성능 모니터링"""
        print(f"📊 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - 성능 모니터링")
        
        try:
            # 현재 모델 성능 확인
            performance = self.check_model_performance()
            
            if performance['status'] == 'success':
                rating = performance['performance_rating']
                metrics = performance['metrics']
                
                print(f"📈 모델 성능: {rating} (mAP50: {metrics['mAP50']:.3f})")
                
                # 성능이 낮으면 재학습 트리거
                if performance['needs_retraining']:
                    print("⚠️ 성능 저하 감지 - 재학습 트리거")
                    result = self.trigger_training({
                        'epochs': 150,  # 재학습은 더 많은 에포크
                        'batch_size': 16,
                        'imgsz': 640,
                        'device': 'cuda',
                        'schedule_type': 'retraining',
                        'reason': 'performance_degradation'
                    })
                    
                    if result['success']:
                        print(f"✅ 성능 기반 재학습 시작: {result['job_id']}")
                        self.send_notification("모델 성능 저하로 재학습이 시작되었습니다", result)
                    else:
                        print(f"❌ 성능 기반 재학습 실패: {result['error']}")
            else:
                print(f"⚠️ 성능 모니터링 실패: {performance['message']}")
                
        except Exception as e:
            print(f"❌ 성능 모니터링 오류: {e}")
    
    def check_training_conditions(self) -> Dict:
        """학습 조건 확인"""
        if not self.supabase:
            return {"should_train": False, "reason": "Supabase 연결 없음"}
        
        try:
            # 1. 최근 24시간 새 데이터 확인
            yesterday = datetime.now() - timedelta(days=1)
            result = self.supabase.table('synthetic_dataset').select('*').gte('created_at', yesterday.isoformat()).execute()
            new_data_count = len(result.data) if result.data else 0
            
            # 2. 현재 실행 중인 학습 작업 확인
            running_jobs = self.supabase.table('training_jobs').select('*').in_('status', ['pending', 'running']).execute()
            has_running_job = len(running_jobs.data) > 0 if running_jobs.data else False
            
            # 3. 최근 학습 완료 시간 확인
            recent_training = self.supabase.table('training_jobs').select('*').eq('status', 'completed').order('completed_at', desc=True).limit(1).execute()
            last_training_time = None
            if recent_training.data:
                last_training_time = datetime.fromisoformat(recent_training.data[0]['completed_at'].replace('Z', '+00:00'))
            
            # 4. 학습 조건 판단
            should_train = (
                new_data_count >= 50 and  # 50개 이상 새 데이터
                not has_running_job and   # 실행 중인 작업 없음
                (not last_training_time or (datetime.now() - last_training_time).total_seconds() > 3600)  # 1시간 이상 간격
            )
            
            return {
                "should_train": should_train,
                "new_data_count": new_data_count,
                "has_running_job": has_running_job,
                "last_training_time": last_training_time.isoformat() if last_training_time else None,
                "reason": "조건 충족" if should_train else "조건 미충족"
            }
            
        except Exception as e:
            return {"should_train": False, "reason": f"조건 확인 실패: {e}"}
    
    def trigger_training(self, config: Dict) -> Dict:
        """학습 트리거"""
        if not self.supabase:
            return {"success": False, "error": "Supabase 연결 없음"}
        
        try:
            # Supabase Function 호출
            response = requests.post(
                f"{os.getenv('SUPABASE_URL', 'https://npferbxuxocbfnfbpcnz.supabase.co')}/functions/v1/auto-training-trigger",
                headers={
                    'Authorization': f"Bearer {os.getenv('SUPABASE_SERVICE_ROLE_KEY', 'your-service-role-key')}",
                    'Content-Type': 'application/json'
                },
                json=config
            )
            
            if response.status_code == 200:
                result = response.json()
                return result
            else:
                error_msg = f"HTTP {response.status_code}: {response.text}"
                return {"success": False, "error": error_msg}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def check_model_performance(self) -> Dict:
        """모델 성능 확인"""
        if not self.supabase:
            return {"status": "error", "message": "Supabase 연결 없음"}
        
        try:
            # 최신 모델 조회
            result = self.supabase.table('model_registry').select('*').eq('status', 'active').order('created_at', desc=True).limit(1).execute()
            
            if not result.data:
                return {"status": "no_model", "message": "활성 모델 없음"}
            
            model = result.data[0]
            performance = model.get('performance_metrics', {})
            
            # 성능 평가
            mAP50 = performance.get('mAP50', 0)
            precision = performance.get('precision', 0)
            recall = performance.get('recall', 0)
            
            # 성능 기준
            performance_rating = "excellent" if mAP50 > 0.8 else "good" if mAP50 > 0.6 else "poor"
            
            return {
                "status": "success",
                "model_name": model['model_name'],
                "performance_rating": performance_rating,
                "metrics": {
                    "mAP50": mAP50,
                    "precision": precision,
                    "recall": recall
                },
                "needs_retraining": mAP50 < 0.6  # 성능이 낮으면 재학습 필요
            }
            
        except Exception as e:
            return {"status": "error", "message": f"성능 확인 실패: {e}"}
    
    def send_notification(self, message: str, data: Dict):
        """알림 전송"""
        try:
            # 웹훅 알림 전송
            webhook_url = os.getenv('NOTIFICATION_WEBHOOK_URL')
            if webhook_url:
                requests.post(webhook_url, json={
                    'message': message,
                    'timestamp': datetime.now().isoformat(),
                    'data': data
                })
                print(f"📤 알림 전송: {message}")
        except Exception as e:
            print(f"⚠️ 알림 전송 실패: {e}")
    
    def start_scheduler(self):
        """스케줄러 시작"""
        print("🚀 자동 학습 스케줄러 시작...")
        self.scheduler_running = True
        
        while self.scheduler_running:
            try:
                schedule.run_pending()
                time.sleep(60)  # 1분마다 체크
            except KeyboardInterrupt:
                print("\n🛑 스케줄러 중단")
                self.scheduler_running = False
                break
            except Exception as e:
                print(f"❌ 스케줄러 오류: {e}")
                time.sleep(60)
    
    def stop_scheduler(self):
        """스케줄러 중단"""
        self.scheduler_running = False
        print("🛑 자동 학습 스케줄러 중단")

def main():
    """메인 함수"""
    print("🧱 BrickBox 자동 학습 스케줄러")
    print("=" * 50)
    
    scheduler = AutoTrainingScheduler()
    
    if not scheduler.supabase:
        print("❌ Supabase 연결 실패 - 스케줄러를 시작할 수 없습니다")
        return
    
    try:
        scheduler.start_scheduler()
    except KeyboardInterrupt:
        print("\n👋 스케줄러 종료")
    except Exception as e:
        print(f"❌ 스케줄러 실패: {e}")

if __name__ == "__main__":
    main()

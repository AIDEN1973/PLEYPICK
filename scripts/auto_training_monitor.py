#!/usr/bin/env python3
"""
🧱 BrickBox 자동 학습 모니터링 시스템

완전 자동화된 YOLO 학습 모니터링 및 관리
- 실시간 학습 상태 모니터링
- 자동 성능 평가
- 모델 자동 배포
- 알림 시스템
"""

import os
import sys
import time
import json
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

class AutoTrainingMonitor:
    """자동 학습 모니터링 클래스"""
    
    def __init__(self):
        self.supabase = None
        self.monitoring = False
        self.check_interval = 300  # 5분마다 체크
        
        if SUPABASE_AVAILABLE:
            self.init_supabase()
    
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
    
    def check_auto_training_conditions(self) -> Dict:
        """자동 학습 조건 확인"""
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
                new_data_count >= 100 and  # 100개 이상 새 데이터
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
    
    def trigger_auto_training(self) -> Dict:
        """자동 학습 트리거"""
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
                json={}
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ 자동 학습 트리거 성공: {result.get('message', '')}")
                return result
            else:
                error_msg = f"HTTP {response.status_code}: {response.text}"
                print(f"❌ 자동 학습 트리거 실패: {error_msg}")
                return {"success": False, "error": error_msg}
                
        except Exception as e:
            print(f"❌ 자동 학습 트리거 실패: {e}")
            return {"success": False, "error": str(e)}
    
    def monitor_training_progress(self) -> Dict:
        """학습 진행상황 모니터링"""
        if not self.supabase:
            return {"status": "error", "message": "Supabase 연결 없음"}
        
        try:
            # 현재 실행 중인 학습 작업 조회
            result = self.supabase.table('training_jobs').select('*').in_('status', ['pending', 'running']).order('created_at', desc=True).limit(1).execute()
            
            if not result.data:
                return {"status": "no_running_job", "message": "실행 중인 학습 작업 없음"}
            
            job = result.data[0]
            
            # 학습 진행상황 분석
            progress_info = {
                "job_id": job['id'],
                "job_name": job['job_name'],
                "status": job['status'],
                "created_at": job['created_at'],
                "started_at": job.get('started_at'),
                "progress": job.get('progress', {}),
                "error_message": job.get('error_message')
            }
            
            # 실행 시간 계산
            if job.get('started_at'):
                start_time = datetime.fromisoformat(job['started_at'].replace('Z', '+00:00'))
                elapsed_time = datetime.now() - start_time
                progress_info['elapsed_time'] = str(elapsed_time).split('.')[0]
            
            return progress_info
            
        except Exception as e:
            return {"status": "error", "message": f"모니터링 실패: {e}"}
    
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
    
    def start_monitoring(self):
        """모니터링 시작"""
        print("🚀 자동 학습 모니터링 시작...")
        self.monitoring = True
        
        while self.monitoring:
            try:
                print(f"\n⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - 모니터링 체크")
                
                # 1. 자동 학습 조건 확인
                conditions = self.check_auto_training_conditions()
                print(f"📊 학습 조건: {conditions}")
                
                if conditions.get('should_train'):
                    print("🎯 자동 학습 조건 충족 - 학습 시작")
                    result = self.trigger_auto_training()
                    print(f"📤 학습 트리거 결과: {result}")
                else:
                    print(f"⏳ 학습 조건 미충족: {conditions.get('reason', '')}")
                
                # 2. 현재 학습 진행상황 확인
                progress = self.monitor_training_progress()
                if progress.get('status') == 'success':
                    print(f"📈 학습 진행상황: {progress}")
                
                # 3. 모델 성능 확인
                performance = self.check_model_performance()
                if performance.get('status') == 'success':
                    print(f"📊 모델 성능: {performance}")
                    
                    if performance.get('needs_retraining'):
                        print("⚠️ 모델 성능 저하 감지 - 재학습 필요")
                
                # 4. 다음 체크까지 대기
                print(f"⏳ {self.check_interval}초 후 다시 체크...")
                time.sleep(self.check_interval)
                
            except KeyboardInterrupt:
                print("\n🛑 모니터링 중단")
                self.monitoring = False
                break
            except Exception as e:
                print(f"❌ 모니터링 오류: {e}")
                time.sleep(60)  # 오류 시 1분 대기
    
    def stop_monitoring(self):
        """모니터링 중단"""
        self.monitoring = False
        print("🛑 자동 학습 모니터링 중단")

def main():
    """메인 함수"""
    print("🧱 BrickBox 자동 학습 모니터링 시스템")
    print("=" * 50)
    
    monitor = AutoTrainingMonitor()
    
    if not monitor.supabase:
        print("❌ Supabase 연결 실패 - 모니터링을 시작할 수 없습니다")
        return
    
    try:
        monitor.start_monitoring()
    except KeyboardInterrupt:
        print("\n👋 모니터링 종료")
    except Exception as e:
        print(f"❌ 모니터링 실패: {e}")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
자동 시스템 시작 스크립트
서버 모니터링 + 자동 복구 + 렌더링 재시작을 통합 실행
"""
import subprocess
import time
import os
import signal
import sys
import threading
from datetime import datetime

class AutoSystem:
    def __init__(self):
        self.processes = {}
        self.is_running = False
        
    def start_all_services(self):
        """모든 서비스 시작"""
        try:
            print("[START] 자동 시스템 시작")
            print("=" * 50)
            
            # 1. 서버 모니터링 시작
            self.start_server_monitor()
            time.sleep(2)
            
            # 2. 자동 복구 시스템 시작
            self.start_auto_recovery()
            time.sleep(2)
            
            # 3. 상태 확인
            self.check_system_status()
            
            self.is_running = True
            print("[OK] 자동 시스템 시작 완료")
            print("=" * 50)
            
        except Exception as e:
            print(f"[ERROR] 자동 시스템 시작 실패: {e}")
    
    def start_server_monitor(self):
        """서버 모니터링 시작"""
        try:
            monitor_script = os.path.join(os.path.dirname(__file__), 'server_monitor.py')
            if os.path.exists(monitor_script):
                self.processes['monitor'] = subprocess.Popen(
                    ['python', monitor_script],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                print("[OK] 서버 모니터링 시작됨")
            else:
                print("[ERROR] 서버 모니터 스크립트를 찾을 수 없습니다")
        except Exception as e:
            print(f"[ERROR] 서버 모니터링 시작 실패: {e}")
    
    def start_auto_recovery(self):
        """자동 복구 시스템 시작"""
        try:
            recovery_script = os.path.join(os.path.dirname(__file__), 'auto_recovery.py')
            if os.path.exists(recovery_script):
                self.processes['recovery'] = subprocess.Popen(
                    ['python', recovery_script],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                print("[OK] 자동 복구 시스템 시작됨")
            else:
                print("[ERROR] 자동 복구 스크립트를 찾을 수 없습니다")
        except Exception as e:
            print(f"[ERROR] 자동 복구 시스템 시작 실패: {e}")
    
    def check_system_status(self):
        """시스템 상태 확인"""
        try:
            print("\n📊 시스템 상태 확인:")
            
            # 서버 상태 확인
            import requests
            try:
                response = requests.get('http://localhost:3002/api/synthetic/status', timeout=5)
                if response.status_code == 200:
                    print("[OK] API 서버: 정상")
                else:
                    print("[WARNING] API 서버: 응답 이상")
            except:
                print("[ERROR] API 서버: 연결 실패")
            
            # 렌더링 상태 확인
            state_file = os.path.join(os.path.dirname(__file__), '..', 'output', 'synthetic', 'rendering_state.json')
            if os.path.exists(state_file):
                print("[DIR] 렌더링 상태: 저장됨")
            else:
                print("[DIR] 렌더링 상태: 없음")
                
        except Exception as e:
            print(f"[WARNING] 상태 확인 실패: {e}")
    
    def monitor_processes(self):
        """프로세스 모니터링"""
        while self.is_running:
            try:
                for name, process in self.processes.items():
                    if process.poll() is not None:
                        print(f"[WARNING] {name} 프로세스 종료됨 (코드: {process.returncode})")
                        
                        # 프로세스 재시작
                        if name == 'monitor':
                            self.start_server_monitor()
                        elif name == 'recovery':
                            self.start_auto_recovery()
                
                time.sleep(5)  # 5초마다 확인
                
            except Exception as e:
                print(f"[WARNING] 프로세스 모니터링 오류: {e}")
                time.sleep(5)
    
    def stop_all_services(self):
        """모든 서비스 중단"""
        try:
            print("\n[STOP] 자동 시스템 중단 중...")
            
            self.is_running = False
            
            for name, process in self.processes.items():
                if process and process.poll() is None:
                    process.terminate()
                    print(f"[STOP] {name} 프로세스 중단됨")
            
            print("[OK] 자동 시스템 중단 완료")
            
        except Exception as e:
            print(f"[WARNING] 중단 실패: {e}")

def main():
    """메인 함수"""
    auto_system = AutoSystem()
    
    # 시그널 핸들러 등록
    def signal_handler(signum, frame):
        print(f"\n[STOP] 시그널 {signum} 수신 - 자동 시스템 중단")
        auto_system.stop_all_services()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # 자동 시스템 시작
        auto_system.start_all_services()
        
        # 프로세스 모니터링 스레드 시작
        monitor_thread = threading.Thread(target=auto_system.monitor_processes, daemon=True)
        monitor_thread.start()
        
        # 메인 루프
        while auto_system.is_running:
            time.sleep(1)
            
    except KeyboardInterrupt:
        auto_system.stop_all_services()
    except Exception as e:
        print(f"[ERROR] 자동 시스템 오류: {e}")
        auto_system.stop_all_services()

if __name__ == "__main__":
    main()



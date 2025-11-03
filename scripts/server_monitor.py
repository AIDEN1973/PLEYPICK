#!/usr/bin/env python3
"""
서버 상태 모니터링 및 자동 재시작 시스템
"""
import requests
import time
import subprocess
import psutil
import json
import os
import signal
import sys
from datetime import datetime
import threading
import queue

class ServerMonitor:
    def __init__(self, api_port=3002, frontend_port=3000, max_retries=5, check_interval=10):
        self.api_port = api_port
        self.frontend_port = frontend_port
        self.max_retries = max_retries
        self.check_interval = check_interval
        self.server_process = None
        self.is_monitoring = False
        self.retry_count = 0
        self.last_rendering_state = None
        self.rendering_queue = queue.Queue()
        
    def check_server_health(self):
        """서버 상태 확인"""
        try:
            # API 서버 상태 확인
            api_response = requests.get(f'http://localhost:{self.api_port}/api/synthetic/status', timeout=5)
            if api_response.status_code == 200:
                return True
        except requests.exceptions.RequestException:
            pass
        
        try:
            # 프론트엔드 서버 상태 확인
            frontend_response = requests.get(f'http://localhost:{self.frontend_port}/', timeout=5)
            if frontend_response.status_code == 200:
                return True
        except requests.exceptions.RequestException:
            pass
            
        return False
    
    def start_api_server(self):
        """API 서버 시작"""
        try:
            print(f"API 서버 시작 중... (포트: {self.api_port})")
            
            # 기존 프로세스 종료
            self.kill_existing_servers()
            
            # 새 서버 시작
            server_script = os.path.join(os.path.dirname(__file__), '..', 'server', 'synthetic-api.js')
            if os.path.exists(server_script):
                self.server_process = subprocess.Popen(
                    ['node', server_script],
                    cwd=os.path.dirname(server_script),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                
                # 서버 시작 대기
                time.sleep(3)
                
                if self.check_server_health():
                    print("API 서버 시작 완료")
                    return True
                else:
                    print("API 서버 시작 실패")
                    return False
            else:
                print(f"서버 스크립트를 찾을 수 없습니다: {server_script}")
                return False
                
        except Exception as e:
            print(f"API 서버 시작 실패: {e}")
            return False
    
    def kill_existing_servers(self):
        """기존 서버 프로세스 종료"""
        try:
            # 포트 사용 중인 프로세스 찾기
            for proc in psutil.process_iter(['pid', 'name', 'connections']):
                try:
                    for conn in proc.info['connections'] or []:
                        if conn.laddr.port in [self.api_port, self.frontend_port]:
                            print(f"기존 서버 프로세스 종료: PID {proc.info['pid']}")
                            proc.kill()
                            time.sleep(1)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
        except Exception as e:
            print(f"기존 프로세스 정리 실패: {e}")
    
    def save_rendering_state(self, state):
        """렌더링 상태 저장"""
        try:
            state_file = os.path.join(os.path.dirname(__file__), '..', 'output', 'synthetic', 'rendering_state.json')
            os.makedirs(os.path.dirname(state_file), exist_ok=True)
            
            with open(state_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'timestamp': datetime.now().isoformat(),
                    'state': state
                }, f, indent=2, ensure_ascii=False)
                
            print(f"렌더링 상태 저장: {state_file}")
        except Exception as e:
            print(f"렌더링 상태 저장 실패: {e}")
    
    def load_rendering_state(self):
        """렌더링 상태 복구"""
        try:
            state_file = os.path.join(os.path.dirname(__file__), '..', 'output', 'synthetic', 'rendering_state.json')
            if os.path.exists(state_file):
                with open(state_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    print(f"렌더링 상태 복구: {data['timestamp']}")
                    return data['state']
        except Exception as e:
            print(f"렌더링 상태 복구 실패: {e}")
        return None
    
    def resume_rendering(self, state):
        """렌더링 재시작"""
        if not state:
            return False
            
        try:
            print("렌더링 재시작 중...")
            
            # 렌더링 스크립트 재시작
            render_script = os.path.join(os.path.dirname(__file__), 'render_ldraw_to_supabase.py')
            if os.path.exists(render_script):
                # 남은 렌더링 수 계산
                remaining_count = state.get('total_count', 0) - state.get('completed_count', 0)
                start_index = state.get('completed_count', 0)
                
                if remaining_count > 0:
                    cmd = [
                        'python', render_script,
                        '--part-id', str(state.get('part_id', '')),
                        '--count', str(remaining_count),
                        '--quality', state.get('quality', 'high'),
                        '--samples', str(state.get('samples', 512)),
                        '--background', state.get('background', 'white'),
                        '--ldraw-path', state.get('ldraw_path', 'C:/LDraw/parts'),
                        '--output-dir', state.get('output_dir', './output/synthetic'),
                        '--output-subdir', state.get('output_subdir', ''),
                        '--element-id', state.get('element_id', ''),
                        '--resolution', state.get('resolution', '1024x1024'),
                        '--target-fill', str(state.get('target_fill', 0.92)),
                        '--color-management', state.get('color_management', 'standard'),
                        '--supabase-url', state.get('supabase_url', ''),
                        '--supabase-key', state.get('supabase_key', ''),
                        '--color-id', str(state.get('color_id', 10)),
                        '--color-hex', state.get('color_hex', '4B9F4A'),
                        '--start-index', str(start_index)
                    ]
                    
                    print(f"렌더링 재시작 명령: {' '.join(cmd)}")
                    
                    # 백그라운드에서 렌더링 시작
                    render_process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                    print(f"렌더링 재시작됨 (PID: {render_process.pid})")
                    return True
                    
        except Exception as e:
            print(f"렌더링 재시작 실패: {e}")
        return False
    
    def monitor_loop(self):
        """모니터링 루프"""
        print(f"서버 모니터링 시작 (체크 간격: {self.check_interval}초)")
        self.is_monitoring = True
        
        while self.is_monitoring:
            try:
                if not self.check_server_health():
                    print(f"서버 다운 감지 (시도 {self.retry_count + 1}/{self.max_retries})")
                    
                    if self.retry_count < self.max_retries:
                        self.retry_count += 1
                        
                        # 서버 재시작 시도
                        if self.start_api_server():
                            print("서버 재시작 성공")
                            self.retry_count = 0
                            
                            # 렌더링 상태 복구 시도
                            state = self.load_rendering_state()
                            if state:
                                self.resume_rendering(state)
                        else:
                            print(f"서버 재시작 실패 (시도 {self.retry_count}/{self.max_retries})")
                    else:
                        print("최대 재시도 횟수 초과. 모니터링 중단")
                        break
                else:
                    if self.retry_count > 0:
                        print("서버 연결 복구됨")
                        self.retry_count = 0
                
                time.sleep(self.check_interval)
                
            except KeyboardInterrupt:
                print("\n모니터링 중단됨")
                break
            except Exception as e:
                print(f"모니터링 오류: {e}")
                time.sleep(self.check_interval)
        
        self.is_monitoring = False
        print("서버 모니터링 종료")
    
    def start_monitoring(self):
        """모니터링 시작"""
        if not self.is_monitoring:
            monitor_thread = threading.Thread(target=self.monitor_loop, daemon=True)
            monitor_thread.start()
            return True
        return False
    
    def stop_monitoring(self):
        """모니터링 중단"""
        self.is_monitoring = False
        if self.server_process:
            self.server_process.terminate()

def main():
    """메인 함수"""
    monitor = ServerMonitor()
    
    # 시그널 핸들러 등록
    def signal_handler(signum, frame):
        print(f"\n시그널 {signum} 수신 - 모니터링 중단")
        monitor.stop_monitoring()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # 모니터링 시작
    if monitor.start_monitoring():
        print("서버 자동 모니터링 시작됨")
        try:
            while monitor.is_monitoring:
                time.sleep(1)
        except KeyboardInterrupt:
            monitor.stop_monitoring()
    else:
        print("모니터링 시작 실패")

if __name__ == "__main__":
    main()

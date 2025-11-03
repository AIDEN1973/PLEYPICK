#!/usr/bin/env python3
"""
자동 복구 시스템 - 서버 다운 시 자동 재시작 및 렌더링 복구
"""
import subprocess
import time
import json
import os
import signal
import sys
import threading
from datetime import datetime

class AutoRecovery:
    def __init__(self):
        self.monitor_process = None
        self.render_process = None
        self.is_running = False
        
    def start_monitoring(self):
        """모니터링 시작"""
        try:
            print("🚀 자동 복구 시스템 시작")
            
            # 서버 모니터 시작
            monitor_script = os.path.join(os.path.dirname(__file__), 'server_monitor.py')
            if os.path.exists(monitor_script):
                self.monitor_process = subprocess.Popen(
                    ['python', monitor_script],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                print("✅ 서버 모니터링 시작됨")
            
            # 렌더링 상태 확인 및 복구
            self.check_and_resume_rendering()
            
            self.is_running = True
            print("🔄 자동 복구 시스템 활성화됨")
            
        except Exception as e:
            print(f"[ERROR] 자동 복구 시스템 시작 실패: {e}")
    
    def check_and_resume_rendering(self):
        """렌더링 상태 확인 및 복구"""
        try:
            state_file = os.path.join(os.path.dirname(__file__), '..', 'output', 'synthetic', 'rendering_state.json')
            
            if os.path.exists(state_file):
                with open(state_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    state = data.get('state', {})
                    
                    # 미완료 렌더링이 있는지 확인
                    total_count = state.get('total_count', 0)
                    completed_count = state.get('completed_count', 0)
                    
                    if completed_count < total_count:
                        print(f"📂 미완료 렌더링 발견: {completed_count}/{total_count}")
                        print("🔄 렌더링 자동 재시작 시도...")
                        
                        # 렌더링 재시작
                        self.resume_rendering(state)
                    else:
                        print("✅ 모든 렌더링이 완료됨")
            else:
                print("📂 렌더링 상태 파일 없음")
                
        except Exception as e:
            print(f"[WARNING] 렌더링 상태 확인 실패: {e}")
    
    def resume_rendering(self, state):
        """렌더링 재시작"""
        try:
            # 남은 렌더링 수 계산
            total_count = state.get('total_count', 0)
            completed_count = state.get('completed_count', 0)
            remaining_count = total_count - completed_count
            start_index = completed_count
            
            if remaining_count <= 0:
                print("✅ 재시작할 렌더링이 없습니다")
                return
            
            print(f"🔄 렌더링 재시작: {remaining_count}개 남음 (시작 인덱스: {start_index})")
            
            # 렌더링 명령어 구성
            cmd = [
                'python', 'scripts/render_ldraw_to_supabase.py',
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
            
            # 렌더링 프로세스 시작
            self.render_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            print(f"✅ 렌더링 재시작됨 (PID: {self.render_process.pid})")
            
            # 렌더링 모니터링 스레드 시작
            monitor_thread = threading.Thread(target=self.monitor_render_process, daemon=True)
            monitor_thread.start()
            
        except Exception as e:
            print(f"[ERROR] 렌더링 재시작 실패: {e}")
    
    def monitor_render_process(self):
        """렌더링 프로세스 모니터링"""
        try:
            if self.render_process:
                # 프로세스 완료 대기
                stdout, stderr = self.render_process.communicate()
                
                if self.render_process.returncode == 0:
                    print("✅ 렌더링 완료")
                else:
                    print(f"[ERROR] 렌더링 실패 (코드: {self.render_process.returncode})")
                    if stderr:
                        print(f"오류: {stderr}")
                        
        except Exception as e:
            print(f"[WARNING] 렌더링 모니터링 실패: {e}")
    
    def stop(self):
        """자동 복구 시스템 중단"""
        try:
            self.is_running = False
            
            if self.monitor_process:
                self.monitor_process.terminate()
                print("🛑 서버 모니터링 중단됨")
            
            if self.render_process:
                self.render_process.terminate()
                print("🛑 렌더링 프로세스 중단됨")
                
        except Exception as e:
            print(f"[WARNING] 중단 실패: {e}")

def main():
    """메인 함수"""
    recovery = AutoRecovery()
    
    # 시그널 핸들러 등록
    def signal_handler(signum, frame):
        print(f"\n🛑 시그널 {signum} 수신 - 자동 복구 시스템 중단")
        recovery.stop()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # 자동 복구 시스템 시작
        recovery.start_monitoring()
        
        # 메인 루프
        while recovery.is_running:
            time.sleep(1)
            
    except KeyboardInterrupt:
        recovery.stop()
    except Exception as e:
        print(f"[ERROR] 자동 복구 시스템 오류: {e}")
        recovery.stop()

if __name__ == "__main__":
    main()



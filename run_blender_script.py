#!/usr/bin/env python3
"""Blender 스크립트 실행을 위한 래퍼"""

import os
import sys
import subprocess
import time
from pathlib import Path

def run_blender_script():
    """Blender 스크립트 실행"""
    try:
        # 현재 디렉토리 확인
        current_dir = os.getcwd()
        print(f"[INFO] 현재 디렉토리: {current_dir}")
        
        # Blender 실행 파일 경로
        blender_path = r"C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
        
        if not os.path.exists(blender_path):
            print(f"[ERROR] Blender 실행 파일을 찾을 수 없습니다: {blender_path}")
            return False
        
        # 스크립트 경로
        script_path = os.path.join(current_dir, "scripts", "render_ldraw_to_supabase.py")
        
        if not os.path.exists(script_path):
            print(f"[ERROR] 스크립트 파일을 찾을 수 없습니다: {script_path}")
            return False
        
        # 실행 명령어 구성
        cmd = [
            blender_path,
            "--background",
            "--python", script_path,
            "--",
            "--part", "3001",
            "--count", "1",
            "--background", "white",
            "--samples", "10",
            "--resolution", "1024x1024"
        ]
        
        print(f"[START] Blender 스크립트 실행 시작")
        print(f"[CMD] {' '.join(cmd)}")
        
        # 프로세스 실행
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1,
            encoding='utf-8',
            errors='replace'
        )
        
        # 실시간 출력 모니터링
        while True:
            output = process.stdout.readline()
            if output == '' and process.poll() is not None:
                break
            if output:
                print(f"[BLENDER] {output.strip()}")
        
        # 프로세스 완료 대기
        return_code = process.poll()
        
        if return_code == 0:
            print(f"[SUCCESS] Blender 스크립트 실행 완료")
            return True
        else:
            print(f"[ERROR] Blender 스크립트 실행 실패 (코드: {return_code})")
            return False
            
    except Exception as e:
        print(f"[ERROR] Blender 스크립트 실행 중 오류: {e}")
        return False

def main():
    """메인 함수"""
    print("=== Blender 스크립트 자동 실행 ===")
    
    success = run_blender_script()
    
    if success:
        print("\n[SUCCESS] 모든 작업이 완료되었습니다!")
    else:
        print("\n[FAILURE] 작업 중 오류가 발생했습니다.")

if __name__ == "__main__":
    main()

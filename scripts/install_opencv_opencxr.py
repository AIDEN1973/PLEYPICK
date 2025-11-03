#!/usr/bin/env python3
"""
OpenCV 및 OpenEXR 자동 설치 스크립트
Blender Python 환경 또는 일반 Python 환경에서 실행 가능
"""

import sys
import subprocess
import os

def install_package(package_name, import_name=None):
    """패키지 설치 시도"""
    if import_name is None:
        import_name = package_name
    
    try:
        __import__(import_name)
        print(f"[OK] {package_name} 이미 설치됨")
        return True
    except ImportError:
        print(f"[PACKAGE] {package_name} 설치 중...")
        try:
            subprocess.check_call([
                sys.executable, "-m", "pip", "install", "--user", package_name
            ])
            print(f"[OK] {package_name} 설치 완료")
            return True
        except Exception as e:
            print(f"[ERROR] {package_name} 설치 실패: {e}")
            return False

def main():
    """메인 함수"""
    print("=" * 60)
    print("OpenCV 및 OpenEXR 자동 설치 스크립트")
    print("=" * 60)
    
    # 1. OpenCV 설치
    print("\n[1/2] OpenCV 설치 확인...")
    cv2_installed = install_package("opencv-python-headless", "cv2")
    
    # 2. OpenEXR 설치
    print("\n[2/2] OpenEXR 설치 확인...")
    exr_installed = install_package("OpenEXR", "OpenEXR")
    
    # 3. Imath 확인 (OpenEXR과 함께 설치됨)
    if exr_installed:
        try:
            import Imath
            print("[OK] Imath 사용 가능")
        except ImportError:
            print("[WARNING] Imath를 찾을 수 없음 (OpenEXR 재설치 필요)")
    
    # 4. 결과 요약
    print("\n" + "=" * 60)
    print("설치 결과 요약")
    print("=" * 60)
    print(f"OpenCV: {'[OK] 설치됨' if cv2_installed else '[ERROR] 설치 실패'}")
    print(f"OpenEXR: {'[OK] 설치됨' if exr_installed else '[ERROR] 설치 실패'}")
    
    if cv2_installed and exr_installed:
        print("\n[OK] 모든 필수 패키지가 설치되었습니다.")
        print("렌더링 스크립트를 실행할 수 있습니다.")
        return 0
    else:
        print("\n[WARNING] 일부 패키지 설치에 실패했습니다.")
        print("수동 설치가 필요할 수 있습니다:")
        if not cv2_installed:
            print("  pip install --user opencv-python-headless")
        if not exr_installed:
            print("  pip install --user OpenEXR")
        return 1

if __name__ == "__main__":
    sys.exit(main())


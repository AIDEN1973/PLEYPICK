#!/usr/bin/env python3
"""
🧱 BrickBox LDraw Add-on 진단 스크립트

LDraw Add-on의 정확한 상태를 확인
"""

import bpy
import os

def diagnose_ldraw_addon():
    """LDraw Add-on 진단"""
    print("🔍 LDraw Add-on 진단")
    print("=" * 50)
    
    # 1. Add-on 목록 확인
    addons = bpy.context.preferences.addons
    print(f"📊 총 Add-on 수: {len(addons)}")
    
    # 2. LDraw 관련 Add-on 찾기
    ldraw_addons = []
    for addon in addons:
        addon_name = addon.module
        if 'ldraw' in addon_name.lower():
            ldraw_addons.append(addon_name)
            print(f"✅ LDraw Add-on 발견: {addon_name}")
    
    if not ldraw_addons:
        print("❌ LDraw Add-on 없음")
    
    # 3. Import operator 확인
    print("\n🔧 Import Operator 확인:")
    import_ops = [op for op in dir(bpy.ops) if 'import' in op.lower()]
    for op in sorted(import_ops):
        print(f"  - {op}")
    
    # 4. LDraw 파일 확인
    ldraw_path = "C:/LDraw/parts/3001.dat"
    print(f"\n📁 LDraw 파일 확인: {ldraw_path}")
    if os.path.exists(ldraw_path):
        print("✅ 파일 존재")
        # 파일 크기 확인
        file_size = os.path.getsize(ldraw_path)
        print(f"📊 파일 크기: {file_size} bytes")
    else:
        print("❌ 파일 없음")
    
    # 5. LDraw 디렉토리 구조 확인
    ldraw_base = "C:/LDraw"
    print(f"\n📂 LDraw 디렉토리 구조:")
    if os.path.exists(ldraw_base):
        print("✅ LDraw 루트 디렉토리 존재")
        parts_dir = os.path.join(ldraw_base, "parts")
        if os.path.exists(parts_dir):
            print("✅ parts 디렉토리 존재")
            # parts 디렉토리 내용 확인
            try:
                files = os.listdir(parts_dir)
                print(f"📊 parts 디렉토리 파일 수: {len(files)}")
                # .dat 파일 수 확인
                dat_files = [f for f in files if f.endswith('.dat')]
                print(f"📊 .dat 파일 수: {len(dat_files)}")
            except Exception as e:
                print(f"❌ parts 디렉토리 접근 실패: {e}")
        else:
            print("❌ parts 디렉토리 없음")
    else:
        print("❌ LDraw 루트 디렉토리 없음")
    
    # 6. Add-on 활성화 상태 확인
    print(f"\n🔧 Add-on 활성화 상태:")
    for addon in addons:
        if 'ldraw' in addon.module.lower():
            print(f"  - {addon.module}: {'활성화' if addon.enabled else '비활성화'}")
    
    # 7. 해결 방법 제시
    print(f"\n💡 해결 방법:")
    print("1. Blender 실행")
    print("2. Edit → Preferences → Add-ons")
    print("3. 'LDraw' 검색")
    print("4. 'Import-Export: LDraw (.dat) file format' 체크박스 활성화")
    print("5. LDraw library path: C:\\LDraw 설정")
    print("6. Blender 재시작")

if __name__ == "__main__":
    diagnose_ldraw_addon()

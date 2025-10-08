#!/usr/bin/env python3
"""
🧱 BrickBox Blender Add-on 확인 스크립트

Blender에서 사용 가능한 모든 Add-on을 확인
"""

import bpy
import os

def check_available_addons():
    """사용 가능한 Add-on 목록 확인"""
    print("🔍 Blender Add-on 확인")
    print("=" * 50)
    
    # 모든 Add-on 목록
    addons = bpy.context.preferences.addons
    
    print(f"📊 총 Add-on 수: {len(addons)}")
    print()
    
    # LDraw 관련 Add-on 찾기
    ldraw_addons = []
    for addon in addons:
        addon_name = addon.module
        if 'ldraw' in addon_name.lower():
            ldraw_addons.append(addon_name)
    
    if ldraw_addons:
        print("✅ LDraw 관련 Add-on 발견:")
        for addon in ldraw_addons:
            print(f"  - {addon}")
    else:
        print("❌ LDraw 관련 Add-on 없음")
    
    print()
    
    # Import 관련 Add-on 찾기
    import_addons = []
    for addon in addons:
        addon_name = addon.module
        if 'import' in addon_name.lower():
            import_addons.append(addon_name)
    
    if import_addons:
        print("📥 Import 관련 Add-on:")
        for addon in import_addons:
            print(f"  - {addon}")
    
    print()
    
    # 사용 가능한 operator 확인
    print("🔧 사용 가능한 Import Operator:")
    import_ops = [op for op in dir(bpy.ops) if 'import' in op.lower()]
    for op in sorted(import_ops):
        print(f"  - {op}")
    
    print()
    
    # LDraw 파일 존재 확인
    ldraw_path = "C:/LDraw/parts/3001.dat"
    if os.path.exists(ldraw_path):
        print(f"✅ LDraw 파일 존재: {ldraw_path}")
    else:
        print(f"❌ LDraw 파일 없음: {ldraw_path}")
    
    print()
    print("💡 해결 방법:")
    print("1. Blender에서 Edit → Preferences → Add-ons")
    print("2. 'LDraw' 검색")
    print("3. 'Import-Export: LDraw (.dat) file format' 활성화")
    print("4. LDraw library path: C:\\LDraw 설정")

if __name__ == "__main__":
    check_available_addons()

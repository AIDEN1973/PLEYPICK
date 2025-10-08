#!/usr/bin/env python3
"""
🧱 BrickBox Add-on ID 확인 스크립트

Blender에서 LDraw Add-on의 정확한 ID를 찾기
"""

import bpy
import addon_utils

def check_addon_id():
    """Add-on ID 확인"""
    print("🔍 LDraw Add-on ID 확인")
    print("=" * 50)
    
    # 모든 Add-on 목록 확인
    print("📊 모든 Add-on 목록:")
    for mod in addon_utils.modules():
        if "ldraw" in mod.__name__.lower():
            print(f"✅ LDraw 관련 Add-on 발견: {mod.__name__}")
            print(f"   - 모듈 경로: {mod.__file__}")
            print(f"   - 활성화 상태: {mod.__name__ in bpy.context.preferences.addons}")
    
    print("\n🔧 사용 가능한 Import Operator:")
    import_ops = [op for op in dir(bpy.ops) if 'import' in op.lower()]
    for op in sorted(import_ops):
        print(f"  - {op}")
    
    # LDraw operator 확인
    if hasattr(bpy.ops, 'import_scene'):
        ldraw_ops = [op for op in dir(bpy.ops.import_scene) if 'ldraw' in op.lower()]
        if ldraw_ops:
            print(f"\n✅ LDraw Import Operator 발견: {ldraw_ops}")
        else:
            print("\n❌ LDraw Import Operator 없음")
    
    print("\n💡 해결 방법:")
    print("1. 위에서 출력된 Add-on 이름을 사용")
    print("2. addon_utils.enable('<정확한_이름>', default_set=True)")
    print("3. Blender 재시작 후 다시 시도")

if __name__ == "__main__":
    check_addon_id()

#!/usr/bin/env python3
"""
🧱 BrickBox 렌더링 스크립트 수정
실시간 업로드를 로컬 저장으로 변경하여 일괄 업로드 지원
"""

import os
import sys
import shutil
from pathlib import Path

def modify_render_script():
    """렌더링 스크립트를 로컬 저장 방식으로 수정"""
    
    render_script_path = Path("scripts/render_ldraw_to_supabase.py")
    backup_path = Path("scripts/render_ldraw_to_supabase.py.backup")
    
    if not render_script_path.exists():
        print("❌ 렌더링 스크립트를 찾을 수 없습니다:", render_script_path)
        return False
    
    # 백업 생성
    if not backup_path.exists():
        shutil.copy2(render_script_path, backup_path)
        print("📦 원본 스크립트 백업 생성:", backup_path)
    
    # 스크립트 내용 읽기
    with open(render_script_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 실시간 업로드 부분을 로컬 저장으로 변경
    modifications = [
        # 1. 실시간 업로드 비활성화
        (
            "self.upload_to_supabase(image_path, annotation_path, part_id, metadata)",
            "# self.upload_to_supabase(image_path, annotation_path, part_id, metadata)  # 일괄 업로드로 변경"
        ),
        
        # 2. 로컬 저장 경로 설정
        (
            "output_dir = os.path.join(args.output_dir, str(part_id))",
            "output_dir = os.path.join(args.output_dir, str(part_id))\n        # 로컬 저장을 위한 디렉토리 생성\n        os.makedirs(output_dir, exist_ok=True)"
        ),
        
        # 3. 업로드 완료 메시지 변경
        (
            "print(f'✅ 렌더링 완료: {image_path}')",
            "print(f'✅ 로컬 저장 완료: {image_path}')"
        ),
        
        # 4. 일괄 업로드 안내 메시지 추가
        (
            "print(f'🎉 렌더링 완료: {len(results)}개 파일')",
            "print(f'🎉 로컬 렌더링 완료: {len(results)}개 파일')\n        print(f'📤 일괄 업로드 실행: python scripts/batch_upload_renderings.py {args.output_dir}')"
        )
    ]
    
    # 수정 적용
    modified_content = content
    for old_text, new_text in modifications:
        if old_text in modified_content:
            modified_content = modified_content.replace(old_text, new_text)
            print(f"✅ 수정 적용: {old_text[:50]}...")
        else:
            print(f"⚠️ 수정할 텍스트를 찾을 수 없음: {old_text[:50]}...")
    
    # 수정된 내용 저장
    with open(render_script_path, 'w', encoding='utf-8') as f:
        f.write(modified_content)
    
    print("✅ 렌더링 스크립트 수정 완료!")
    print("📋 변경 사항:")
    print("  - 실시간 Supabase 업로드 비활성화")
    print("  - 로컬 저장 방식으로 변경")
    print("  - 일괄 업로드 안내 메시지 추가")
    
    return True

def create_batch_upload_config():
    """일괄 업로드 설정 파일 생성"""
    
    config = {
        "batch_upload": {
            "enabled": True,
            "batch_size": 10,
            "upload_delay": 0.5,
            "batch_delay": 2.0,
            "cleanup_after_upload": True,
            "keep_backup": True
        },
        "local_storage": {
            "output_dir": "output/renders",
            "backup_dir": "output/backup",
            "max_backup_age_days": 30
        },
        "supabase": {
            "bucket": "lego-synthetic",
            "table": "synthetic_dataset",
            "check_existing": True
        }
    }
    
    config_path = Path("scripts/batch_upload_config.json")
    with open(config_path, 'w', encoding='utf-8') as f:
        import json
        json.dump(config, f, indent=2, ensure_ascii=False)
    
    print(f"✅ 일괄 업로드 설정 파일 생성: {config_path}")
    return True

def main():
    """메인 실행 함수"""
    print("🔧 BrickBox 렌더링 스크립트 수정 시작")
    
    # 1. 렌더링 스크립트 수정
    if modify_render_script():
        print("✅ 렌더링 스크립트 수정 완료")
    else:
        print("❌ 렌더링 스크립트 수정 실패")
        return False
    
    # 2. 일괄 업로드 설정 생성
    if create_batch_upload_config():
        print("✅ 일괄 업로드 설정 생성 완료")
    else:
        print("❌ 일괄 업로드 설정 생성 실패")
        return False
    
    print("\n🎉 모든 수정 완료!")
    print("\n📋 사용 방법:")
    print("1. 렌더링 실행: python scripts/render_ldraw_to_supabase.py ...")
    print("2. 일괄 업로드: python scripts/batch_upload_renderings.py output/renders")
    print("3. 자동 실행: scripts\\run_batch_upload.bat")
    
    return True

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
잘못된 경로에 저장된 WebP 파일들을 올바른 경로로 이동하는 스크립트
"""

import os
import sys
import asyncio
import aiohttp
from supabase import create_client, Client
from dotenv import load_dotenv

# 환경 변수 로드
load_dotenv()

# Supabase 클라이언트 설정
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Supabase 환경 변수가 설정되지 않았습니다.")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

async def fix_webp_storage_path():
    """잘못된 경로의 WebP 파일들을 올바른 경로로 이동"""
    try:
        print("🔍 잘못된 경로의 WebP 파일들 확인 중...")
        
        # 1. lego_parts_images 버킷에서 lego_sets_images 폴더의 파일들 확인
        try:
            wrong_path_files = supabase.storage.from_('lego_parts_images').list('lego_sets_images')
            print(f"📁 잘못된 경로에서 발견된 파일들: {len(wrong_path_files)}개")
            
            for file_info in wrong_path_files:
                if file_info['name'].endswith('_set.webp'):
                    print(f"  - {file_info['name']}")
        except Exception as e:
            print(f"⚠️ 잘못된 경로 파일 확인 실패: {e}")
        
        # 2. 저장된 세트 목록 조회
        result = supabase.table('lego_sets').select('*').execute()
        sets = result.data
        
        if not sets:
            print("❌ 저장된 세트가 없습니다.")
            return
        
        print(f"📋 총 {len(sets)}개 세트 처리 시작...")
        
        # 3. 각 세트의 WebP 파일을 올바른 경로로 이동
        success_count = 0
        for i, set_data in enumerate(sets, 1):
            set_num = set_data['set_num']
            webp_filename = f"{set_num}_set.webp"
            
            print(f"\n[{i}/{len(sets)}] 처리 중: {set_num}")
            
            try:
                # 3-1. 잘못된 경로에서 파일 다운로드
                wrong_path = f"lego_sets_images/{webp_filename}"
                try:
                    file_data = supabase.storage.from_('lego_parts_images').download(wrong_path)
                    print(f"📥 잘못된 경로에서 파일 다운로드: {wrong_path}")
                except Exception as e:
                    print(f"⚠️ 잘못된 경로에서 파일 없음: {e}")
                    continue
                
                # 3-2. 올바른 경로에 파일 업로드
                upload_result = supabase.storage.from_('lego_sets_images').upload(
                    webp_filename, 
                    file_data, 
                    file_options={"content-type": "image/webp", "upsert": True}
                )
                
                if upload_result.get('error'):
                    print(f"❌ 올바른 경로 업로드 실패: {upload_result['error']}")
                    continue
                
                print(f"✅ 올바른 경로에 업로드 완료: {webp_filename}")
                
                # 3-3. 잘못된 경로에서 파일 삭제
                try:
                    supabase.storage.from_('lego_parts_images').remove([wrong_path])
                    print(f"🗑️ 잘못된 경로에서 파일 삭제: {wrong_path}")
                except Exception as e:
                    print(f"⚠️ 잘못된 경로 파일 삭제 실패: {e}")
                
                # 3-4. set_images 테이블 메타데이터 업데이트
                public_url = f"{SUPABASE_URL}/storage/v1/object/public/lego_sets_images/{webp_filename}"
                
                metadata_data = {
                    'set_num': set_num,
                    'supabase_url': public_url,
                    'file_path': webp_filename,
                    'file_name': webp_filename,
                    'set_id': set_data['id']
                }
                
                result = supabase.table('set_images').upsert(
                    metadata_data, 
                    on_conflict='set_num',
                    returning='minimal'
                ).execute()
                
                if result.data:
                    print(f"💾 메타데이터 업데이트 완료: {set_num}")
                    success_count += 1
                else:
                    print(f"⚠️ 메타데이터 업데이트 실패: {set_num}")
                
            except Exception as e:
                print(f"❌ 처리 실패: {set_num} - {e}")
            
            # API 제한 방지를 위한 대기
            await asyncio.sleep(1)
        
        print(f"\n🎉 경로 수정 완료!")
        print(f"✅ 성공: {success_count}개")
        print(f"❌ 실패: {len(sets) - success_count}개")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")

if __name__ == "__main__":
    asyncio.run(fix_webp_storage_path())

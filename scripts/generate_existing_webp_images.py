#!/usr/bin/env python3
"""
기존 저장된 레고 세트들의 이미지를 WebP로 변환하고 메타데이터를 저장하는 스크립트
"""

import os
import sys
import asyncio
import aiohttp
from supabase import create_client, Client
from dotenv import load_dotenv
from PIL import Image
import io

# 환경 변수 로드
load_dotenv()

# Supabase 클라이언트 설정
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Supabase 환경 변수가 설정되지 않았습니다.")
    print("VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 확인하세요.")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

async def convert_set_to_webp(set_data):
    """세트 이미지를 WebP로 변환하고 메타데이터 저장"""
    try:
        set_num = set_data['set_num']
        set_img_url = set_data['set_img_url']
        
        print(f"🔄 변환 시작: {set_num}")
        
        # 1. 원본 이미지 다운로드
        async with aiohttp.ClientSession() as session:
            async with session.get(set_img_url) as response:
                if response.status != 200:
                    print(f"❌ 이미지 다운로드 실패: {set_num} (상태: {response.status})")
                    return False
                
                image_data = await response.read()
                print(f"📥 이미지 다운로드 완료: {set_num} ({len(image_data)} bytes)")
        
        # 2. WebP 변환 (Pillow 사용)
        img = Image.open(io.BytesIO(image_data))
        
        # 크기 최적화 (최대 800px)
        max_size = 800
        if img.width > max_size or img.height > max_size:
            ratio = min(max_size / img.width, max_size / img.height)
            new_width = int(img.width * ratio)
            new_height = int(img.height * ratio)
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            print(f"📏 크기 조정: {img.width}x{img.height}")
        
        # WebP로 변환 (품질 60%)
        webp_buffer = io.BytesIO()
        img.save(webp_buffer, format='WebP', quality=60, optimize=True)
        webp_data = webp_buffer.getvalue()
        
        print(f"🖼️ WebP 변환 완료: {len(webp_data)} bytes (원본: {len(image_data)} bytes)")
        print(f"📊 압축률: {((len(image_data) - len(webp_data)) / len(image_data) * 100):.1f}% 감소")
        
        # 3. Supabase Storage에 업로드
        webp_filename = f"{set_num}_set.webp"
        file_path = f"lego_sets_images/{webp_filename}"
        
        # 먼저 기존 파일이 있는지 확인하고 삭제
        try:
            supabase.storage.from_('lego_parts_images').remove([file_path])
        except:
            pass  # 파일이 없어도 무시
        
        result = supabase.storage.from_('lego_parts_images').upload(
            file_path, 
            webp_data, 
            file_options={"content-type": "image/webp"}
        )
        
        # UploadResponse 객체 처리
        if hasattr(result, 'error') and result.error:
            print(f"❌ 업로드 실패: {result.error}")
            return False
        
        print(f"✅ 업로드 완료: {webp_filename}")
        
        # 4. lego_sets 테이블에 WebP URL 업데이트
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/lego_parts_images/{file_path}"
        
        # lego_sets 테이블의 해당 세트에 WebP URL 업데이트
        result = supabase.table('lego_sets').update({
            'webp_image_url': public_url
        }).eq('set_num', set_num).execute()
        
        if hasattr(result, 'data') and result.data:
            print(f"💾 WebP URL 저장 완료: {set_num}")
            return True
        else:
            print(f"⚠️ WebP URL 저장 실패: {set_num}")
            return False
        
    except Exception as e:
        print(f"❌ 변환 실패: {set_num} - {e}")
        return False

async def main():
    """메인 함수"""
    print("🚀 기존 레고 세트 WebP 변환 시작...")
    
    try:
        # 저장된 세트 목록 조회
        result = supabase.table('lego_sets').select('*').execute()
        sets = result.data
        
        if not sets:
            print("❌ 저장된 세트가 없습니다.")
            return
        
        print(f"📋 총 {len(sets)}개 세트 발견")
        
        # 각 세트 변환
        success_count = 0
        for i, set_data in enumerate(sets, 1):
            print(f"\n[{i}/{len(sets)}] 처리 중: {set_data['set_num']} - {set_data['name']}")
            
            if await convert_set_to_webp(set_data):
                success_count += 1
            
            # API 제한 방지를 위한 대기
            await asyncio.sleep(1)
        
        print(f"\n🎉 변환 완료!")
        print(f"✅ 성공: {success_count}개")
        print(f"❌ 실패: {len(sets) - success_count}개")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")

if __name__ == "__main__":
    asyncio.run(main())

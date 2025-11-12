#!/usr/bin/env python3
"""
WebP 파일 검증 스크립트
"""

import os
from PIL import Image

def check_webp_files(directory):
    """WebP 파일들을 검증"""
    print(f"=== WebP 파일 검증: {directory} ===")
    
    if not os.path.exists(directory):
        print(f"디렉토리가 존재하지 않습니다: {directory}")
        return
    
    webp_files = [f for f in os.listdir(directory) if f.endswith('.webp')]
    print(f"발견된 WebP 파일: {len(webp_files)}개")
    
    if not webp_files:
        print("WebP 파일이 없습니다.")
        return
    
    for i, filename in enumerate(webp_files[:3]):  # 처음 3개만 확인
        filepath = os.path.join(directory, filename)
        print(f"\n--- 파일 {i+1}: {filename} ---")
        
        try:
            # 파일 크기
            file_size = os.path.getsize(filepath)
            print(f"파일 크기: {file_size:,} bytes ({file_size/1024:.1f} KB)")
            
            # PIL로 이미지 정보 확인
            with Image.open(filepath) as img:
                print(f"포맷: {img.format}")
                print(f"모드: {img.mode}")
                print(f"크기: {img.size}")
                
                # ICC 프로파일 확인
                icc_profile = img.info.get('icc_profile')
                print(f"ICC 프로파일: {'있음' if icc_profile else '없음'}")
                
                # EXIF 메타데이터 확인
                exif = img.info.get('exif')
                print(f"EXIF 메타데이터: {'있음' if exif else '없음'}")
                
                # WebP 특정 정보
                if hasattr(img, 'info'):
                    webp_info = {k: v for k, v in img.info.items() if 'webp' in k.lower() or 'quality' in k.lower()}
                    if webp_info:
                        print(f"WebP 정보: {webp_info}")
                    else:
                        print("WebP 특정 정보: 없음")
                
        except Exception as e:
            print(f"오류: {e}")

if __name__ == "__main__":
    check_webp_files("c:/output/test_webp")


















<<<<<<< HEAD
=======

>>>>>>> 87039ac2483fb2cfc80115fa29c3e4f844a1454b

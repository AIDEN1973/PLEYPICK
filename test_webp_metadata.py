#!/usr/bin/env python3
"""
기존 WebP 파일에 ICC 프로파일과 EXIF 메타데이터 주입 테스트
"""
import os
import sys
import subprocess
from pathlib import Path
from PIL import Image, ImageCms
import piexif
from datetime import datetime

def test_webp_metadata_injection():
    """WebP 메타데이터 주입 테스트"""
    base_dir = r"C:\cursor\brickbox\output\synthetic\4240375\images"
    
    print("=" * 80)
    print("WebP 메타데이터 주입 테스트")
    print("=" * 80)
    
    # 첫 번째 WebP 파일 선택
    webp_files = [f for f in os.listdir(base_dir) if f.endswith('.webp')]
    if not webp_files:
        print("WebP 파일을 찾을 수 없습니다.")
        return
    
    test_file = os.path.join(base_dir, webp_files[0])
    backup_file = test_file + ".backup"
    
    print(f"테스트 파일: {test_file}")
    
    # 원본 파일 백업
    import shutil
    shutil.copy2(test_file, backup_file)
    print(f"백업 파일 생성: {backup_file}")
    
    try:
        # 1. cwebp 방식 테스트
        print("\n1. cwebp 방식 테스트")
        test_cwebp_method(test_file)
        
        # 2. PIL 방식 테스트
        print("\n2. PIL 방식 테스트")
        shutil.copy2(backup_file, test_file)  # 원본 복원
        test_pil_method(test_file)
        
    except Exception as e:
        print(f"테스트 실패: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # 백업 파일 정리
        if os.path.exists(backup_file):
            os.remove(backup_file)
            print(f"백업 파일 정리 완료")

def test_cwebp_method(image_path):
    """cwebp 명령줄 도구를 사용한 메타데이터 주입"""
    try:
        # cwebp 명령줄 도구 확인
        result = subprocess.run(['cwebp', '-version'], capture_output=True, text=True)
        if result.returncode != 0:
            print("cwebp 명령줄 도구를 찾을 수 없습니다.")
            return False
        
        print("cwebp 명령줄 도구 발견")
        
        # 임시 파일들 생성
        temp_png = image_path + ".temp.png"
        temp_icc = image_path + ".temp.icc"
        temp_exif = image_path + ".temp.exif"
        temp_webp = image_path + ".temp.webp"
        
        try:
            # 이미지 로드 및 PNG로 저장
            with Image.open(image_path) as img:
                if img.mode != "RGB":
                    img = img.convert("RGB")
                img.save(temp_png, "PNG")
            
            # sRGB ICC 프로파일 생성
            srgb_profile = ImageCms.createProfile("sRGB")
            icc_profile_obj = ImageCms.ImageCmsProfile(srgb_profile)
            icc_profile = icc_profile_obj.tobytes()
            
            with open(temp_icc, 'wb') as f:
                f.write(icc_profile)
            print(f"ICC 프로파일 생성: {len(icc_profile)} bytes")
            
            # EXIF 메타데이터 생성
            zeroth_ifd = {
                piexif.ImageIFD.Software: b"BrickBox-Renderer",
                piexif.ImageIFD.DateTime: datetime.utcnow().strftime("%Y:%m:%d %H:%M:%S").encode('utf-8'),
            }
            exif_dict = {"0th": zeroth_ifd, "Exif": {}, "1st": {}, "thumbnail": None}
            exif_data = piexif.dump(exif_dict)
            
            with open(temp_exif, 'wb') as f:
                f.write(exif_data)
            print(f"EXIF 메타데이터 생성: {len(exif_data)} bytes")
            
            # cwebp 명령어 실행
            cmd = [
                'cwebp',
                temp_png,
                '-o', temp_webp,
                '-q', '90',
                '-m', '6',
                '-af',
                '-metadata', 'all',
                '-icc', temp_icc,
                '-exif', temp_exif
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"cwebp 실행 실패: {result.stderr}")
                return False
            
            # 원본 파일 교체
            import shutil
            shutil.move(temp_webp, image_path)
            print("cwebp 방식으로 WebP 파일 업데이트 완료")
            
            # 결과 검증
            verify_webp_metadata(image_path)
            
        finally:
            # 임시 파일 정리
            for temp_file in [temp_png, temp_icc, temp_exif, temp_webp]:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
        
        return True
        
    except Exception as e:
        print(f"cwebp 방식 실패: {e}")
        return False

def test_pil_method(image_path):
    """PIL을 사용한 메타데이터 주입"""
    try:
        temp_file = image_path + ".tmp"
        
        with Image.open(image_path) as img:
            if img.mode != "RGB":
                img = img.convert("RGB")
            
            # ICC 프로파일 생성
            srgb_profile = ImageCms.createProfile("sRGB")
            icc_profile_obj = ImageCms.ImageCmsProfile(srgb_profile)
            icc_profile = icc_profile_obj.tobytes()
            
            # EXIF 메타데이터 생성
            zeroth_ifd = {
                piexif.ImageIFD.Software: b"BrickBox-Renderer",
                piexif.ImageIFD.DateTime: datetime.utcnow().strftime("%Y:%m:%d %H:%M:%S").encode('utf-8'),
            }
            exif_dict = {"0th": zeroth_ifd, "Exif": {}, "1st": {}, "thumbnail": None}
            exif_data = piexif.dump(exif_dict)
            
            # WebP 저장
            save_kwargs = {
                "format": "WEBP",
                "quality": 90,
                "method": 6,
                "lossless": False,
                "icc_profile": icc_profile,
                "exif": exif_data
            }
            
            img.save(temp_file, **save_kwargs)
            print("PIL 방식으로 WebP 파일 생성 완료")
        
        # 원본 파일 교체
        import shutil
        shutil.move(temp_file, image_path)
        
        # 결과 검증
        verify_webp_metadata(image_path)
        
        return True
        
    except Exception as e:
        print(f"PIL 방식 실패: {e}")
        return False

def verify_webp_metadata(image_path):
    """WebP 메타데이터 검증"""
    print(f"\n검증: {os.path.basename(image_path)}")
    
    try:
        with Image.open(image_path) as img:
            print(f"  포맷: {img.format}")
            print(f"  모드: {img.mode}")
            print(f"  해상도: {img.size}")
            
            # ICC 프로파일 확인
            if hasattr(img, 'info') and 'icc_profile' in img.info:
                icc_profile = img.info['icc_profile']
                print(f"  ICC 프로파일: 있음 ({len(icc_profile)} bytes)")
                if b'sRGB' in icc_profile[:100]:
                    print("    타입: sRGB")
                else:
                    print("    타입: 기타")
            else:
                print("  ICC 프로파일: 없음")
            
            # EXIF 메타데이터 확인
            if hasattr(img, 'info') and 'exif' in img.info:
                exif_data = img.info['exif']
                print(f"  EXIF 메타데이터: 있음 ({len(exif_data)} bytes)")
            else:
                print("  EXIF 메타데이터: 없음")
                
    except Exception as e:
        print(f"  검증 실패: {e}")

if __name__ == "__main__":
    test_webp_metadata_injection()














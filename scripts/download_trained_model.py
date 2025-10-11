#!/usr/bin/env python3
"""
Colab에서 학습된 YOLO 모델을 로컬로 다운로드하는 스크립트
"""

import os
import requests
from pathlib import Path

def download_model_from_colab():
    """
    Colab에서 학습된 모델을 다운로드
    """
    print("🚀 Colab에서 학습된 모델 다운로드 시작...")
    
    # 모델 저장 디렉토리 생성
    model_dir = Path("public/models")
    model_dir.mkdir(exist_ok=True)
    
    # Colab에서 파일을 다운로드하는 방법들
    print("\n📋 Colab에서 모델을 다운로드하는 방법:")
    print("1. Colab에서 다음 코드를 실행하세요:")
    print("""
    # 1. Google Drive에 업로드
    from google.colab import drive
    drive.mount('/content/drive')
    
    # 2. 모델 파일을 Drive에 복사
    import shutil
    shutil.copy('/content/brickbox_yolo/set_76917-1/weights/best.pt', 
                '/content/drive/MyDrive/brickbox_models/set_76917-1_best.pt')
    shutil.copy('/content/brickbox_yolo/set_76917-1/weights/last.pt', 
                '/content/drive/MyDrive/brickbox_models/set_76917-1_last.pt')
    
    # 3. ONNX 변환
    from ultralytics import YOLO
    model = YOLO('/content/brickbox_yolo/set_76917-1/weights/best.pt')
    model.export(format='onnx', imgsz=640)
    
    # 4. ONNX 파일도 Drive에 복사
    shutil.copy('/content/brickbox_yolo/set_76917-1/weights/best.onnx', 
                '/content/drive/MyDrive/brickbox_models/set_76917-1_best.onnx')
    """)
    
    print("\n2. Google Drive에서 파일을 다운로드하세요:")
    print("   - set_76917-1_best.pt")
    print("   - set_76917-1_last.pt") 
    print("   - set_76917-1_best.onnx")
    
    print("\n3. 다운로드한 파일을 다음 위치에 저장하세요:")
    print(f"   - {model_dir}/set_76917-1_best.pt")
    print(f"   - {model_dir}/set_76917-1_last.pt")
    print(f"   - {model_dir}/set_76917-1_best.onnx")

def create_model_deployment_script():
    """
    모델 배포를 위한 스크립트 생성
    """
    script_content = '''#!/usr/bin/env python3
"""
학습된 YOLO 모델을 Supabase에 배포하는 스크립트
"""

import os
import sys
from pathlib import Path
from supabase import create_client, Client
import json

def deploy_model_to_supabase():
    """
    학습된 모델을 Supabase Storage에 업로드
    """
    # 환경 변수 로드
    SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
    SUPABASE_KEY = os.getenv('VITE_SUPABASE_ANON_KEY')
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Supabase 환경 변수가 설정되지 않았습니다.")
        return False
    
    # Supabase 클라이언트 생성
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # 모델 파일 경로
    model_dir = Path("public/models")
    model_files = [
        "set_76917-1_best.pt",
        "set_76917-1_best.onnx"
    ]
    
    print("🚀 모델 배포 시작...")
    
    for model_file in model_files:
        model_path = model_dir / model_file
        
        if not model_path.exists():
            print(f"⚠️ 모델 파일을 찾을 수 없습니다: {model_path}")
            continue
            
        try:
            # 파일 읽기
            with open(model_path, 'rb') as f:
                file_data = f.read()
            
            # Supabase Storage에 업로드
            result = supabase.storage.from_('models').upload(
                f"yolo/{model_file}",
                file_data,
                file_options={"content-type": "application/octet-stream"}
            )
            
            if result:
                print(f"✅ {model_file} 업로드 성공")
                
                # 모델 메타데이터를 데이터베이스에 저장
                model_metadata = {
                    "model_name": "set_76917-1",
                    "model_type": "yolo_segmentation",
                    "version": "1.0",
                    "file_path": f"yolo/{model_file}",
                    "file_size": len(file_data),
                    "status": "active"
                }
                
                # models 테이블에 메타데이터 저장 (테이블이 있다면)
                try:
                    supabase.table('models').insert(model_metadata).execute()
                    print(f"📊 {model_file} 메타데이터 저장 완료")
                except Exception as e:
                    print(f"⚠️ 메타데이터 저장 실패: {e}")
                    
            else:
                print(f"❌ {model_file} 업로드 실패")
                
        except Exception as e:
            print(f"❌ {model_file} 처리 중 오류: {e}")
    
    print("🎉 모델 배포 완료!")

if __name__ == "__main__":
    deploy_model_to_supabase()
'''
    
    with open("scripts/deploy_trained_model.py", "w", encoding="utf-8") as f:
        f.write(script_content)
    
    print("✅ 모델 배포 스크립트 생성: scripts/deploy_trained_model.py")

if __name__ == "__main__":
    download_model_from_colab()
    create_model_deployment_script()

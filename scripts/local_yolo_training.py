#!/usr/bin/env python3
"""
BrickBox 로컬 YOLO 학습 스크립트

웹 UI에서 자동으로 실행되는 YOLO 모델 학습 스크립트
"""

import argparse
import os
import sys
import json
import time
from pathlib import Path
from datetime import datetime

# .env 파일 로드 (강화된 버전)
try:
    from dotenv import load_dotenv
    # 프로젝트 루트 디렉토리에서 .env 파일 로드
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path, override=True)  # override=True로 기존 환경변수 덮어쓰기
        print(f"[OK] .env 파일 로드됨: {env_path}")
        
        # 환경변수 검증
        required_vars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_SERVICE_ROLE']
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        if missing_vars:
            print(f"[WARN] 필수 환경변수 누락: {missing_vars}")
        else:
            print("[OK] 필수 환경변수 모두 로드됨")
    else:
        print(f"[WARN] .env 파일을 찾을 수 없음: {env_path}")
        print("[INFO] 시스템 환경변수 사용")
except ImportError:
    print("[WARN] python-dotenv가 설치되지 않음. pip install python-dotenv")
    print("[INFO] 시스템 환경변수 사용")
except Exception as e:
    print(f"[WARN] .env 파일 로드 실패: {e}")
    print("[INFO] 시스템 환경변수 사용")

# Supabase 클라이언트
try:
    from supabase import create_client, Client
except ImportError:
    print("[ERROR] Supabase 클라이언트가 설치되지 않았습니다.")
    print("다음 명령어로 설치하세요: pip install supabase")
    sys.exit(1)

# YOLO 관련 임포트
try:
    from ultralytics import YOLO
    import torch
except ImportError as e:
    print(f"[ERROR] 필요한 패키지가 설치되지 않았습니다: {e}")
    print("다음 명령어로 설치하세요: pip install ultralytics torch")
    sys.exit(1)

def setup_supabase(override_url: str | None = None, override_key: str | None = None):
    """Supabase 클라이언트 설정 (Service Role 우선)"""
    # 환경변수 디버깅
    print(f"[DEBUG] 환경변수 확인:")
    print(f"  SUPABASE_URL: {os.getenv('SUPABASE_URL')}")
    print(f"  VITE_SUPABASE_URL: {os.getenv('VITE_SUPABASE_URL')}")
    print(f"  SUPABASE_SERVICE_ROLE_KEY: {os.getenv('SUPABASE_SERVICE_ROLE_KEY')}")
    print(f"  VITE_SUPABASE_SERVICE_ROLE: {os.getenv('VITE_SUPABASE_SERVICE_ROLE')}")
    
    url = (
        override_url
        or
        os.getenv('SUPABASE_URL')
        or os.getenv('VITE_SUPABASE_URL')
        or 'https://npferbxuxocbfnfbpcnz.supabase.co'
    )
    key = (
        override_key
        or
        os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        or os.getenv('VITE_SUPABASE_SERVICE_ROLE')
        or os.getenv('SUPABASE_ANON_KEY')
        or os.getenv('VITE_SUPABASE_ANON_KEY')
        or 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQ3NDk4NSwiZXhwIjoyMDc1MDUwOTg1fQ.pPWhWrb4QBC-DT4dd6Y1p-LlHNd9UTKef3SHEXUDp00'
    )
    
    print(f"[OK] 사용할 URL: {url}")
    print(f"[OK] 사용할 Key: {key[:20]}...")
    
    return create_client(url, key)

def update_training_progress(supabase, job_id, epoch, total_epochs, metrics=None):
    """학습 진행률을 데이터베이스에 업데이트"""
    try:
        progress_data = {
            'current_epoch': epoch,
            'total_epochs': total_epochs,
            'percent': round((epoch / total_epochs) * 100, 2),
            'status': 'training',
            'metrics': metrics or {}
        }
        
        # training_jobs 테이블 업데이트
        supabase.table('training_jobs').update({
            'progress': progress_data,
            'status': 'training',
            'updated_at': datetime.now().isoformat()
        }).eq('id', job_id).execute()
        
        print(f"[PROGRESS] 진행률 업데이트: {epoch}/{total_epochs} ({progress_data['percent']}%)")
        
    except Exception as e:
        print(f"[WARN] 진행률 업데이트 실패: {e}")

def setup_logging():
    """로깅 설정"""
    import logging
    
    # 로그 디렉토리 생성
    log_dir = Path("output/training/logs")
    log_dir.mkdir(parents=True, exist_ok=True)
    
    # 로그 파일 설정
    log_file = log_dir / f"training_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file, encoding='utf-8'),
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    return logging.getLogger(__name__)

def update_training_status(job_id, status, progress=None, metrics=None):
    """학습 상태를 데이터베이스에 업데이트"""
    try:
        import requests
        
        # Supabase API 호출 (실제 구현 시 환경변수에서 URL 가져오기)
        supabase_url = os.getenv('VITE_SUPABASE_URL', 'https://npferbxuxocbfnfbpcnz.supabase.co')
        supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY', 'your-anon-key')
        
        # 학습 상태 업데이트
        update_data = {
            'status': status,
            'updated_at': datetime.now().isoformat()
        }
        
        if progress:
            update_data['progress'] = progress
            
        if metrics:
            update_data['metrics'] = metrics
        
        # 실제 구현 시 Supabase REST API 호출
        print(f"[STATS] 학습 상태 업데이트: {status}")
        if progress:
            print(f"[PROGRESS] 진행률: {progress}")
        if metrics:
            print(f"[STATS] 메트릭: {metrics}")
            
    except Exception as e:
        print(f"[WARN] 상태 업데이트 실패: {e}")

def prepare_dataset(set_num, part_id=None):
    """데이터셋 준비 - 중복 부품 제거 포함"""
    print(f"[INFO] 데이터셋 준비 시작: 세트 {set_num}, 부품 {part_id}")

    # 데이터셋 경로 설정
    if set_num == 'latest':
        # 부품 단위 학습의 경우 해당 부품 디렉토리 사용
        if part_id:
            # 먼저 엘리먼트 ID로 시도 (데이터셋이 엘리먼트 ID로 저장됨)
            dataset_path = Path(f"C:/cursor/brickbox/output/synthetic/{part_id}")
            
        # 완벽한 폴더 구조 확인
        if dataset_path.exists():
            images_dir = dataset_path / 'images'
            labels_dir = dataset_path / 'labels'
            meta_dir = dataset_path / 'meta'
            meta_e_dir = dataset_path / 'meta-e'
            
            if not images_dir.exists() or not labels_dir.exists():
                print(f"[ERROR] 완벽한 폴더 구조가 없습니다: {dataset_path}")
                print(f"[INFO] 필요한 폴더: images/, labels/, meta/, meta-e/")
                dataset_path = None
            else:
                print(f"[OK] 완벽한 폴더 구조 확인: {dataset_path}")
                print(f"  - images/: {images_dir.exists()}")
                print(f"  - labels/: {labels_dir.exists()}")
                print(f"  - meta/: {meta_dir.exists()}")
                print(f"  - meta-e/: {meta_e_dir.exists()}")
                
                # dataset.yaml 생성 (완벽한 폴더 구조용)
                dataset_yaml_path = dataset_path / 'dataset.yaml'
                if not dataset_yaml_path.exists():
                    print(f"[INFO] dataset.yaml 생성: {dataset_yaml_path}")
                    yaml_content = {
                        'path': str(dataset_path.absolute()),
                        'train': 'images/train',
                        'val': 'images/val', 
                        'test': 'images/test',
                        'nc': 1,
                        'names': ['lego_part']
                    }
                    with open(dataset_yaml_path, 'w', encoding='utf-8') as f:
                        import yaml
                        yaml.dump(yaml_content, f, default_flow_style=False, allow_unicode=True)
            
            # 엘리먼트 ID로 찾을 수 없으면 part_id로 시도
            if not dataset_path or not dataset_path.exists():
                print(f"[WARN] 엘리먼트 ID {part_id} 디렉토리가 없음. part_id로 검색 중...")
                
                # parts_master에서 part_id 조회 (Service Role 사용)
                try:
                    import requests
                    import os
                    
                    supabase_url = (
                        os.getenv('SUPABASE_URL')
                        or os.getenv('VITE_SUPABASE_URL')
                        or 'https://npferbxuxocbfnfbpcnz.supabase.co'
                    )
                    supabase_key = (
                        os.getenv('SUPABASE_SERVICE_ROLE_KEY')
                        or os.getenv('VITE_SUPABASE_SERVICE_ROLE')
                        or os.getenv('SUPABASE_ANON_KEY')
                        or os.getenv('VITE_SUPABASE_ANON_KEY')
                    )
                    
                    response = requests.get(
                        f"{supabase_url}/rest/v1/parts_master",
                                    headers={
                                        "apikey": supabase_key,
                                        "Authorization": f"Bearer {supabase_key}",
                                        "Content-Type": "application/json"
                                    },
                        params={
                            "element_id": f"eq.{part_id}",
                            "select": "part_id",
                            "limit": 1
                        }
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        if data and len(data) > 0:
                            actual_part_id = data[0].get('part_id')
                            if actual_part_id:
                                dataset_path = Path(f"C:/cursor/brickbox/output/synthetic/{actual_part_id}")
                                print(f"[CONVERT] part_id {actual_part_id} 디렉토리로 시도: {dataset_path}")
                except Exception as e:
                    print(f"[WARN] part_id 조회 실패: {e}")
        else:
            dataset_path = Path("C:/cursor/brickbox/output/synthetic/prepared")
    else:
        dataset_path = Path(f"C:/cursor/brickbox/output/synthetic/set_{set_num}")

    if not dataset_path.exists():
        print(f"[ERROR] 데이터셋 경로가 존재하지 않습니다: {dataset_path}")
        return None
    
    # dataset.yaml 파일 확인
    yaml_file = dataset_path / "dataset.yaml"
    if not yaml_file.exists():
        print(f"[ERROR] dataset.yaml 파일이 없습니다: {yaml_file}")
        return None
    
    # 중복 부품 제거 처리
    if set_num != 'latest':
        filtered_yaml = remove_duplicate_parts(yaml_file, set_num, part_id)
        if filtered_yaml:
            yaml_file = filtered_yaml
    
    print(f"[OK] 데이터셋 준비 완료: {dataset_path}")
    return str(yaml_file)

def remove_duplicate_parts(yaml_file, set_num, part_id=None):
    """이미 학습된 부품을 제거하여 중복 학습 방지"""
    try:
        import yaml
        from supabase import create_client
        import os
        
        # Supabase 클라이언트 초기화
        supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_ANON_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')
        
        if not supabase_url or not supabase_key:
            print("[WARN] Supabase 환경변수가 설정되지 않음 - 중복 제거 스킵")
            print("[TIP] SUPABASE_URL, SUPABASE_ANON_KEY 또는 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정하세요")
            return None
            
        supabase = create_client(supabase_url, supabase_key)
        
        # dataset.yaml 읽기
        with open(yaml_file, 'r', encoding='utf-8') as f:
            dataset_config = yaml.safe_load(f)
        
        # 세트 부품 목록 조회
        if part_id:
            # 부품 단위 학습: 특정 부품만 학습
            target_parts = [part_id]
            print(f"[PART] 부품 단위 학습: {part_id}")
        else:
            # 세트 단위 학습: 세트 내 모든 부품
            try:
                # 세트 정보 조회
                set_response = supabase.table('lego_sets').select('id').eq('set_num', set_num).single().execute()
                if not set_response.data:
                    print(f"[ERROR] 세트 {set_num}을 찾을 수 없음")
                    return None
                
                # 세트 부품 조회
                parts_response = supabase.table('set_parts').select('part_id').eq('set_id', set_response.data['id']).execute()
                target_parts = [p['part_id'] for p in parts_response.data] if parts_response.data else []
                print(f"[SET] 세트 {set_num} 부품: {len(target_parts)}개")
            except Exception as e:
                print(f"[WARN] 세트 부품 조회 실패: {e}")
                return None
        
        if not target_parts:
            print("[ERROR] 학습할 부품이 없음")
            return None
        
        # 이미 학습된 부품 확인
        try:
            # 여러 부품 ID를 한 번에 조회 (성능 최적화)
            trained_parts = []
            try:
                # Supabase Python 클라이언트에서 in_() 메서드 사용
                response = supabase.table('part_training_status').select('part_id').in_('part_id', target_parts).eq('status', 'completed').execute()
                if response.data:
                    trained_parts = [p['part_id'] for p in response.data]
                    print(f"[SEARCH] 일괄 조회로 {len(trained_parts)}개 부품 상태 확인")
            except Exception as e:
                print(f"[WARN] 일괄 조회 실패, 개별 조회로 전환: {e}")
                # 일괄 조회 실패 시 개별 조회로 fallback
                for part_id in target_parts:
                    try:
                        response = supabase.table('part_training_status').select('part_id').eq('part_id', part_id).eq('status', 'completed').execute()
                        if response.data:
                            trained_parts.extend([p['part_id'] for p in response.data])
                    except Exception as e:
                        print(f"[WARN] 부품 {part_id} 상태 조회 실패: {e}")
                        continue
            
            if trained_parts:
                print(f"[SKIP] 이미 학습된 부품 {len(trained_parts)}개 스킵: {trained_parts[:5]}{'...' if len(trained_parts) > 5 else ''}")
                
                # 새로 학습할 부품만 필터링
                new_parts = [p for p in target_parts if p not in trained_parts]
                
                if not new_parts:
                    print("[ERROR] 모든 부품이 이미 학습됨 - 학습 중단")
                    return None
                
                print(f"[OK] 새로 학습할 부품 {len(new_parts)}개: {new_parts[:5]}{'...' if len(new_parts) > 5 else ''}")
                
                # 필터링된 데이터셋 생성
                filtered_yaml = create_filtered_dataset(yaml_file, new_parts)
                return filtered_yaml
            else:
                print("[OK] 모든 부품이 새로 학습 대상")
                return None
                
        except Exception as e:
            print(f"[WARN] 중복 부품 확인 실패: {e}")
            return None
            
    except Exception as e:
        print(f"[ERROR] 중복 부품 제거 실패: {e}")
        return None

def create_filtered_dataset(original_yaml, target_parts):
    """특정 부품만 포함하는 필터링된 데이터셋 생성"""
    try:
        import yaml
        import shutil
        from pathlib import Path
        import json
        
        print(f"[SEARCH] 필터링된 데이터셋 생성 시작: {len(target_parts)}개 부품")
        print(f"[SET] 대상 부품: {target_parts}")
        
        # 원본 파일 백업
        backup_yaml = original_yaml.replace('.yaml', '_backup.yaml')
        shutil.copy2(original_yaml, backup_yaml)
        print(f"[SAVE] 원본 백업: {backup_yaml}")
        
        # dataset.yaml 읽기
        with open(original_yaml, 'r', encoding='utf-8') as f:
            dataset_config = yaml.safe_load(f)
        
        # YOLO 데이터셋 구조 확인
        train_path = Path(dataset_config.get('train', ''))
        val_path = Path(dataset_config.get('val', ''))
        test_path = Path(dataset_config.get('test', ''))
        
        print(f"📁 데이터셋 경로:")
        print(f"  - Train: {train_path}")
        print(f"  - Val: {val_path}")
        print(f"  - Test: {test_path}")
        
        # 부품별 클래스 ID 매핑 생성
        part_to_class_id = {part_id: idx for idx, part_id in enumerate(target_parts)}
        print(f"[LABEL] 클래스 매핑: {part_to_class_id}")
        
        # 필터링된 파일들 수집
        filtered_files = {'train': [], 'val': [], 'test': []}
        total_images = 0
        
        for split_name, split_path in [('train', train_path), ('val', val_path), ('test', test_path)]:
            if not split_path.exists():
                print(f"[WARN] {split_name} 경로가 존재하지 않음: {split_path}")
                continue
                
            print(f"[SEARCH] {split_name} 폴더 스캔 중...")
            split_images = []
            
            # 이미지 파일들 찾기 (webp 형식)
            for image_file in split_path.glob('*.webp'):
                # 부품 ID가 파일명에 포함된 이미지만 필터링
                # 1. element_id 패턴: {element_id}_{sequence}.webp
                # 2. part_id 패턴: {part_id}_{sequence}.webp (엘리먼트 ID가 없는 경우)
                for part_id in target_parts:
                    # 파일명이 해당 부품으로 시작하는지 확인
                    if image_file.name.startswith(f"{part_id}_"):
                        # 라벨 파일 경로 (labels 폴더에서)
                        label_path = split_path.parent.parent / "labels" / split_path.name / image_file.with_suffix('.txt').name
                        if label_path.exists():
                            # 라벨 파일에서 해당 부품의 라벨만 추출
                            filtered_labels = filter_labels_for_parts(label_path, target_parts, part_to_class_id)
                            if filtered_labels:
                                split_images.append(str(image_file))
                                total_images += 1
                                print(f"  [OK] {image_file.name} (부품: {part_id})")
                        break
            
            filtered_files[split_name] = split_images
            print(f"[STATS] {split_name}: {len(split_images)}개 이미지")
        
        if total_images == 0:
            print("[ERROR] 필터링된 이미지가 없음")
            return None
        
        # 필터링된 dataset.yaml 생성
        filtered_config = dataset_config.copy()
        filtered_config['nc'] = len(target_parts)  # 클래스 수
        filtered_config['names'] = target_parts     # 클래스 이름
        
        # 필터링된 파일을 임시 폴더에 복사
        temp_dir = Path(original_yaml).parent / "filtered_dataset"
        temp_dir.mkdir(exist_ok=True)
        
        # train/val/test 폴더 생성
        for split_name in ['train', 'val', 'test']:
            split_dir = temp_dir / split_name
            split_dir.mkdir(exist_ok=True)
            
            for image_path in filtered_files[split_name]:
                src_path = Path(image_path)
                dst_path = split_dir / src_path.name
                shutil.copy2(src_path, dst_path)
                
                # 라벨 파일도 복사 (labels 폴더에서)
                label_src = Path(image_path).parent.parent / "labels" / Path(image_path).parent.name / Path(image_path).with_suffix('.txt').name
                label_dst = split_dir / Path(image_path).with_suffix('.txt').name
                if label_src.exists():
                    # 필터링된 라벨 내용으로 새 파일 생성
                    filtered_labels = filter_labels_for_parts(label_src, target_parts, part_to_class_id)
                    if filtered_labels:
                        with open(label_dst, 'w', encoding='utf-8') as f:
                            for line in filtered_labels:
                                f.write(line + '\n')
        
        # 필터링된 dataset.yaml 저장
        temp_yaml = temp_dir / "dataset.yaml"
        with open(temp_yaml, 'w', encoding='utf-8') as f:
            yaml.dump(filtered_config, f, default_flow_style=False)
        
        print(f"[OK] 필터링된 데이터셋 생성 완료: {total_images}개 이미지")
        print(f"📁 저장 위치: {temp_yaml}")
        return str(temp_yaml)
        
    except Exception as e:
        print(f"[ERROR] 필터링된 데이터셋 생성 실패: {e}")
        import traceback
        traceback.print_exc()
        return None

def filter_labels_for_parts(label_file, target_parts, part_to_class_id):
    """라벨 파일에서 특정 부품의 라벨만 필터링"""
    try:
        filtered_lines = []
        
        # 파일명에서 부품 ID 추출
        file_name = Path(label_file).stem
        print(f"[SEARCH] 라벨 파일 처리: {file_name}")
        
        with open(label_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                    
                parts = line.split()
                if len(parts) < 5:
                    continue
                
                # 현재 모든 라벨이 클래스 0으로 통합되어 있음
                # 파일명이 target_parts에 포함된 부품으로 시작하는지 확인
                for part_id, new_class_id in part_to_class_id.items():
                    if file_name.startswith(f"{part_id}_"):
                        # 새로운 클래스 ID로 변경
                        parts[0] = str(new_class_id)
                        filtered_lines.append(' '.join(parts))
                        print(f"  [OK] 라벨 변환: 클래스 0 → {new_class_id} (부품: {part_id})")
                        break
        
        return filtered_lines
        
    except Exception as e:
        print(f"[WARN] 라벨 필터링 실패 {label_file}: {e}")
        return []

def update_part_training_status(set_num, part_id, metrics):
    """학습 완료된 부품들의 상태를 업데이트하여 중복 학습 방지"""
    try:
        from supabase import create_client
        import os
        
        # Supabase 클라이언트 초기화 (Service Role 우선)
        supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
        supabase_key = (
            os.getenv('SUPABASE_SERVICE_ROLE_KEY')
            or os.getenv('VITE_SUPABASE_SERVICE_ROLE')
            or os.getenv('SUPABASE_ANON_KEY')
            or os.getenv('VITE_SUPABASE_ANON_KEY')
        )
        
        if not supabase_url or not supabase_key:
            print("[WARN] Supabase 환경변수가 설정되지 않음 - 부품 상태 업데이트 스킵")
            print("[TIP] SUPABASE_URL, SUPABASE_ANON_KEY 또는 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정하세요")
            return
            
        supabase = create_client(supabase_url, supabase_key)
        
        if part_id:
            # 부품 단위 학습: element_id 입력 가능 → part_id 매핑
            try:
                pm = create_client(supabase_url, supabase_key)
                # element_id → part_id 매핑 시도
                resp = pm.table('parts_master').select('part_id').eq('element_id', part_id).limit(1).execute()
                if resp.data and len(resp.data) > 0 and resp.data[0].get('part_id'):
                    actual_part_id = resp.data[0]['part_id']
                    print(f"[CONVERT] element_id {part_id} → part_id {actual_part_id}")
                    part_id = actual_part_id
            except Exception as e:
                print(f"[WARN] element_id→part_id 매핑 실패(무시): {e}")
            # 최종 part_id로 업데이트
            trained_parts = [part_id]
            print(f"[PART] 부품 단위 학습 완료: {part_id}")
        else:
            # 세트 단위 학습: 세트 내 모든 부품 업데이트
            try:
                # 세트 정보 조회
                set_response = supabase.table('lego_sets').select('id').eq('set_num', set_num).single().execute()
                if not set_response.data:
                    print(f"[ERROR] 세트 {set_num}을 찾을 수 없음")
                    return
                
                # 세트 부품 조회
                parts_response = supabase.table('set_parts').select('part_id').eq('set_id', set_response.data['id']).execute()
                trained_parts = [p['part_id'] for p in parts_response.data] if parts_response.data else []
                print(f"[SET] 세트 단위 학습 완료: {len(trained_parts)}개 부품")
            except Exception as e:
                print(f"[WARN] 세트 부품 조회 실패: {e}")
                return
        
        # 각 부품의 학습 상태를 'completed'로 업데이트 (upsert 사용)
        for part_id in trained_parts:
            try:
                # 🔧 수정됨: upsert 사용 (map50_95, f1_score 제거 - 컬럼 없음)
                result = supabase.table('part_training_status').upsert({
                    'part_id': str(part_id),
                    'status': 'completed',
                    'map50': float(metrics.get('mAP50', 0.0)),
                    'precision': float(metrics.get('precision', 0.0)),
                    'recall': float(metrics.get('recall', 0.0)),
                    'last_trained_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }, on_conflict='part_id').execute()
                
                # Supabase 응답 처리 (올바른 방식)
                if hasattr(result, 'error') and result.error:
                    print(f"[WARN] 부품 {part_id} 상태 업데이트 실패: {result.error}")
                else:
                    print(f"[OK] 부품 {part_id} 학습 상태 업데이트 완료")
            except Exception as e:
                print(f"[WARN] 부품 {part_id} 상태 업데이트 실패: {e}")
        
        print(f"[OK] 총 {len(trained_parts)}개 부품 학습 상태 업데이트 완료")
        
    except Exception as e:
        print(f"[ERROR] 부품 학습 상태 업데이트 실패: {e}")

def train_hybrid_models(dataset_yaml, config, job_id=None):
    """하이브리드 YOLO 모델 학습 (1단계 + 2단계 순차 실행)"""
    print("[HYBRID] 하이브리드 학습 시작: 1단계 + 2단계 순차 실행")
    
    # Supabase 클라이언트 설정
    supabase = None
    if job_id:
        try:
            supabase = setup_supabase()
            print(f"📡 데이터베이스 연결됨 (작업 ID: {job_id})")
        except Exception as e:
            print(f"[WARN] Supabase 연결 실패: {e}")
    
    results = {}
    
    try:
        # 1단계 학습 (YOLO11n-seg)
        print("\n" + "="*60)
        print("🎯 1단계 학습 시작: YOLO11n-seg (빠른 스캔)")
        print("="*60)
        
        stage1_config = config.copy()
        stage1_config['model_stage'] = 'stage1'
        stage1_results, stage1_model = train_yolo_model(dataset_yaml, stage1_config, job_id)
        results['stage1'] = stage1_results
        
        print(f"\n✅ 1단계 학습 완료: {stage1_results}")
        
        # 2단계 학습 (YOLO11s-seg)
        print("\n" + "="*60)
        print("🎯 2단계 학습 시작: YOLO11s-seg (정밀 검증)")
        print("="*60)
        
        stage2_config = config.copy()
        stage2_config['model_stage'] = 'stage2'
        stage2_results, stage2_model = train_yolo_model(dataset_yaml, stage2_config, job_id)
        results['stage2'] = stage2_results
        
        print(f"\n✅ 2단계 학습 완료: {stage2_results}")
        
        # 하이브리드 학습 완료 상태 업데이트
        if supabase and job_id:
            try:
                supabase.table('training_jobs').update({
                    'status': 'completed',
                    'progress': {
                        'current_epoch': config.get('epochs', 100),
                        'total_epochs': config.get('epochs', 100),
                        'percent': 100,
                        'status': 'completed',
                        'stage1_completed': True,
                        'stage2_completed': True
                    },
                    'completed_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }).eq('id', job_id).execute()
                print("[OK] 하이브리드 학습 완료 상태 업데이트됨")
            except Exception as e:
                print(f"[WARN] 하이브리드 학습 완료 상태 업데이트 실패: {e}")
        
        # 하이브리드 모델 저장 및 업로드
        print("\n" + "="*60)
        print("💾 하이브리드 모델 저장 및 업로드 중...")
        print("="*60)
        
        # Stage 1 모델 저장 및 업로드
        if stage1_model and hasattr(stage1_model, 'save'):
            print("[STAGE1] Stage 1 모델 저장 중...")
            stage1_path = Path("public/models/lego_yolo_stage1_latest.pt")
            stage1_model.save(stage1_path)
            print(f"[OK] Stage 1 모델 저장 완료: {stage1_path}")
            
            # Stage 1 ONNX 변환 // 🔧 수정됨
            stage1_onnx_path = None
            try:
                stage1_onnx_path = Path("public/models/lego_yolo_stage1_latest.onnx")
                stage1_model.export(format='onnx', imgsz=config.get('imgsz', 640))
                exported_path = Path("public/models/yolo11n.onnx")
                if exported_path.exists():
                    exported_path.rename(stage1_onnx_path)
                    print(f"[OK] Stage 1 ONNX 모델 저장 완료: {stage1_onnx_path}")
                else:
                    raise FileNotFoundError("ONNX 파일을 찾을 수 없습니다")
            except Exception as onnx_error:
                print(f"[WARN] Stage 1 ONNX 변환 실패: {onnx_error}")
                stage1_onnx_path = None
            
            # Stage 1 모델 업로드
            try:
                stage1_cfg = config.copy()
                stage1_cfg['model_stage'] = 'stage1'
                upload_and_register_model(str(stage1_path), stage1_onnx_path, stage1_cfg)
            except Exception as e:
                print(f"[WARN] Stage 1 모델 업로드 실패: {e}")
        
        # Stage 2 모델 저장 및 업로드
        if stage2_model and hasattr(stage2_model, 'save'):
            print("[STAGE2] Stage 2 모델 저장 중...")
            stage2_path = Path("public/models/lego_yolo_stage2_latest.pt")
            stage2_model.save(stage2_path)
            print(f"[OK] Stage 2 모델 저장 완료: {stage2_path}")
            
            # Stage 2 ONNX 변환 // 🔧 수정됨
            stage2_onnx_path = None
            try:
                stage2_onnx_path = Path("public/models/lego_yolo_stage2_latest.onnx")
                stage2_model.export(format='onnx', imgsz=config.get('imgsz', 640))
                exported_path = Path("public/models/yolo11s-seg.onnx")
                if exported_path.exists():
                    exported_path.rename(stage2_onnx_path)
                    print(f"[OK] Stage 2 ONNX 모델 저장 완료: {stage2_onnx_path}")
                else:
                    # 다른 가능한 경로 확인
                    possible_paths = [
                        Path("public/models/yolo11s.onnx"),
                        Path("public/models/yolo11n.onnx"),
                        Path("public/models/best.onnx")
                    ]
                    for p in possible_paths:
                        if p.exists():
                            p.rename(stage2_onnx_path)
                            print(f"[OK] Stage 2 ONNX 모델 이동 완료: {p} → {stage2_onnx_path}")
                            break
                    else:
                        raise FileNotFoundError("ONNX 파일을 찾을 수 없습니다")
            except Exception as onnx_error:
                print(f"[WARN] Stage 2 ONNX 변환 실패: {onnx_error}")
                stage2_onnx_path = None
            
            # Stage 2 모델 업로드
            try:
                stage2_cfg = config.copy()
                stage2_cfg['model_stage'] = 'stage2'
                upload_and_register_model(str(stage2_path), stage2_onnx_path, stage2_cfg)
            except Exception as e:
                print(f"[WARN] Stage 2 모델 업로드 실패: {e}")
        
        print("\n" + "="*60)
        print("🎉 하이브리드 학습 완료!")
        print("="*60)
        print(f"1단계 (YOLO11n-seg): {stage1_results}")
        print(f"2단계 (YOLO11s-seg): {stage2_results}")
        
        return results, {'stage1': stage1_model, 'stage2': stage2_model}
        
    except Exception as e:
        print(f"[ERROR] 하이브리드 학습 실패: {e}")
        if supabase and job_id:
            try:
                supabase.table('training_jobs').update({
                    'status': 'failed',
                    'progress': {
                        'status': 'failed',
                        'error': str(e)
                    },
                    'updated_at': datetime.now().isoformat()
                }).eq('id', job_id).execute()
            except Exception as update_error:
                print(f"[WARN] 실패 상태 업데이트 실패: {update_error}")
        raise e

def train_yolo_model(dataset_yaml, config, job_id=None):
    """YOLO 모델 학습"""
    print("[START] YOLO 모델 학습 시작...")
    
    # Supabase 클라이언트 설정
    supabase = None
    if job_id:
        try:
            supabase = setup_supabase()
            print(f"📡 데이터베이스 연결됨 (작업 ID: {job_id})")
        except Exception as e:
            print(f"[WARN] 데이터베이스 연결 실패: {e}")
    
    # 디바이스 설정
    device = 'cuda' if torch.cuda.is_available() and config.get('device') == 'cuda' else 'cpu'
    print(f"[DEVICE] 사용 디바이스: {device}")
    
    # GPU 사용 불가 시 경고 및 CPU 설정 조정
    if device == 'cpu':
        print("[WARN] GPU를 사용할 수 없습니다. CPU로 학습을 진행합니다.")
        print("[TIP] GPU 가속을 원한다면 PyTorch CUDA 버전을 설치하세요.")
        print("   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121")
    
    # 하이브리드 YOLO 모델 학습 (2단계 시스템)
    # 기본값: 하이브리드 학습 (1단계 + 2단계 순차 실행)
    model_stage = config.get('model_stage', 'hybrid')  # hybrid, stage1, stage2
    
    if model_stage == 'hybrid':
        print("[HYBRID] 하이브리드 학습 시작: 1단계 + 2단계 순차 실행")
        return train_hybrid_models(dataset_yaml, config, job_id)
    elif model_stage == 'stage1':
        model = YOLO('yolo11n-seg.pt')  # 1단계: 빠른 스캔용
        print("[START] 1단계 모델 (YOLO11n-seg): 빠른 전체 스캔")
    else:
        model = YOLO('yolo11s-seg.pt')  # 2단계: 정밀 검증용
        print("[TARGET] 2단계 모델 (YOLO11s-seg): 정밀 검증")
    
    # 단계별 학습 설정
    if model_stage == 'stage1':
        # 1단계: 빠른 스캔용 설정
        # CPU 사용 시 배치 크기와 이미지 크기 조정
        batch_size = 4 if device == 'cpu' else config.get('batch_size', 32)
        imgsz = 416 if device == 'cpu' else config.get('imgsz', 640)
        
        training_args = {
            'data': dataset_yaml,
            'epochs': config.get('epochs', 100),  # 1단계: 기술문서 권장 기준
            'batch': batch_size,  # CPU 시 작은 배치
            'imgsz': imgsz,  # CPU 시 작은 이미지
            'device': device,
            'project': 'output/training',
            'name': f'brickbox_stage1_{config.get("set_num", "latest")}_{datetime.now().strftime("%Y%m%d_%H%M%S")}',
            'save': True,
            'plots': True,
            'val': True,
            'patience': 25,  # Early stopping (15 → 25, 작은 데이터셋은 더 많은 에폭 필요)
            'save_period': 10,
            'cache': True,
            'workers': 4,
            'optimizer': 'AdamW',
            'lr0': 0.005,  # 0.01 → 0.005 (작은 데이터셋에 적합)
            'lrf': 0.1,  # 0.01 → 0.1 (더 부드러운 감소)
            'momentum': 0.937,
            'weight_decay': 0.0005,
            'warmup_epochs': 5,  # 3 → 5 (더 긴 워밍업)
            'warmup_momentum': 0.8,
            'warmup_bias_lr': 0.1,
            'box': 10.0,  # 7.5 → 10.0 (바운딩 박스 정확도 강조)
            'cls': 0.5,
            'dfl': 1.5,
            'pose': 12.0,
            'kobj': 2.0,
            'label_smoothing': 0.0,
            # 1단계 데이터 증강 (데이터셋 크기 부족 대응 - 증강 강화)
            'copy_paste': 1.0,  # 최대 활용 (데이터셋 작을 때 효과적)
            'mosaic': 1.0,  # 최대 활용
            'mixup': 0.1,  # 추가 (작은 데이터셋에 유용)
            'fliplr': 0.5,
            'hsv_h': 0.015,  # 색상 변환 강화
            'hsv_s': 0.7,  # 0.3 → 0.7
            'hsv_v': 0.4,  # 0.3 → 0.4
            'perspective': 0.0005,
            'erasing': 0.4,  # 0.1 → 0.4 (데이터 다양성 증가)
            'nbs': 64,
            'overlap_mask': True,
            'mask_ratio': 4,
            'dropout': 0.0,
            # 'val_period': 1,  # YOLO에서 지원하지 않음
            # 1단계 추론 설정 (낮은 임계값 - Recall 향상, BOM 환경 최적화)
            'conf': 0.10,  # 0.15 → 0.10 (BOM 환경: 누락 방지 최우선)
            'iou': 0.50,
            'max_det': 200,  # 50 → 200 (더 많은 탐지 허용, 후속 식별 단계에서 필터링)
        }
    else:
        # 2단계: 정밀 검증용 설정
        # CPU 사용 시 배치 크기와 이미지 크기 조정
        batch_size = 2 if device == 'cpu' else config.get('batch_size', 16)
        imgsz = 512 if device == 'cpu' else config.get('imgsz', 768)
        
        training_args = {
            'data': dataset_yaml,
            'epochs': config.get('epochs', 100),  # 2단계: 기술문서 권장 기준
            'batch': batch_size,  # CPU 시 작은 배치
            'imgsz': imgsz,  # CPU 시 작은 이미지
            'device': device,
            'project': 'output/training',
            'name': f'brickbox_stage2_{config.get("set_num", "latest")}_{datetime.now().strftime("%Y%m%d_%H%M%S")}',
            'save': True,
            'plots': True,
            'val': True,
            'patience': 25,  # Early stopping (15 → 25, 작은 데이터셋은 더 많은 에폭 필요)
            'save_period': 10,
            'cache': True,
            'workers': 4,
            'optimizer': 'AdamW',
            'lr0': 0.005,  # 0.01 → 0.005 (작은 데이터셋에 적합)
            'lrf': 0.1,  # 0.01 → 0.1 (더 부드러운 감소)
            'momentum': 0.937,
            'weight_decay': 0.0005,
            'warmup_epochs': 5,  # 3 → 5 (더 긴 워밍업)
            'warmup_momentum': 0.8,
            'warmup_bias_lr': 0.1,
            'box': 10.0,  # 7.5 → 10.0 (바운딩 박스 정확도 강조)
            'cls': 0.5,
            'dfl': 1.5,
            'pose': 12.0,
            'kobj': 2.0,
            'label_smoothing': 0.0,
            # 2단계 데이터 증강 (데이터셋 크기 부족 대응 - 최대 증강)
            'copy_paste': 1.0,  # 최대 활용
            'mosaic': 1.0,  # 최대 활용
            'mixup': 0.2,  # 추가
            'fliplr': 0.5,
            'hsv_h': 0.015,  # 색상 변환 강화
            'hsv_s': 0.7,  # 색상 채도 변환 강화
            'hsv_v': 0.4,  # 명도 변환 강화
            'perspective': 0.001,
            'erasing': 0.2,
            'nbs': 64,
            'overlap_mask': True,
            'mask_ratio': 4,
            'dropout': 0.0,
            # 'val_period': 1,  # YOLO에서 지원하지 않음
            # 2단계 추론 설정 (정밀 검증, BOM 환경 최적화)
            'conf': 0.25,  # 0.5 → 0.25 (1차 결과 재검증)
            'iou': 0.60,  # 더 엄격한 IoU (정밀 검증)
            'max_det': 100,  # 20 → 100 (1차에서 탐지된 영역만 검증)
        }
    
    print(f"[STATS] 학습 설정: {training_args}")
    
    # 학습 시작
    start_time = time.time()
    
    # 실시간 진행률 업데이트를 위한 콜백 함수
    def on_train_epoch_end(trainer):
        if supabase and job_id:
            epoch = trainer.epoch + 1
            total_epochs = training_args['epochs']
            
            # 메트릭 수집
            metrics = {}
            if hasattr(trainer, 'metrics'):
                metrics = {
                    'box_loss': float(trainer.metrics.get('box_loss', 0)),
                    'seg_loss': float(trainer.metrics.get('seg_loss', 0)),
                    'cls_loss': float(trainer.metrics.get('cls_loss', 0)),
                    'dfl_loss': float(trainer.metrics.get('dfl_loss', 0)),
                    'map50': float(trainer.metrics.get('map50', 0)),
                    'map50_95': float(trainer.metrics.get('map50_95', 0))
                }
            
            # 데이터베이스 업데이트
            update_training_progress(supabase, job_id, epoch, total_epochs, metrics)
    
    # YOLO 모델에 콜백 추가
    model.add_callback('on_train_epoch_end', on_train_epoch_end)
    
    results = model.train(**training_args)
    end_time = time.time()
    
    training_time = end_time - start_time
    print(f"[TIME] 학습 완료 시간: {training_time:.2f}초")
    
    # 학습 완료 상태 업데이트
    if supabase and job_id:
        try:
            supabase.table('training_jobs').update({
                'status': 'completed',
                'progress': {
                    'current_epoch': training_args['epochs'],
                    'total_epochs': training_args['epochs'],
                    'percent': 100,
                    'status': 'completed'
                },
                'completed_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }).eq('id', job_id).execute()
            print("[OK] 학습 완료 상태 업데이트됨")
        except Exception as e:
            print(f"[WARN] 학습 완료 상태 업데이트 실패: {e}")
    
    return results, model

def save_model(model, config):
    """학습된 모델 저장"""
    print("[SAVE] 학습된 모델 저장 중...")
    
    # 모델 저장 경로
    model_dir = Path("public/models")
    model_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # PyTorch 모델로 저장 (기본)
        model_path = model_dir / f"lego_yolo_set_{config.get('set_num', 'latest')}.pt"
        model.save(model_path)
        print(f"[OK] PyTorch 모델 저장 완료: {model_path}")
        
        # ONNX 변환 시도 (필수) // 🔧 수정됨
        onnx_path = None
        try:
            onnx_path = model_dir / f"lego_yolo_set_{config.get('set_num', 'latest')}.onnx"
            model.export(format='onnx', imgsz=config.get('imgsz', 640))
            
            # 내보낸 모델을 목적지로 이동
            exported_path = model_dir / "yolo11n.onnx"
            if exported_path.exists():
                exported_path.rename(onnx_path)
                print(f"[OK] ONNX 모델 저장 완료: {onnx_path}")
            else:
                # 다른 경로에서 찾기 시도
                possible_paths = [
                    model_dir / "yolo11s-seg.onnx",
                    model_dir / "yolo11n-seg.onnx",
                    model_dir / "best.onnx"
                ]
                for p in possible_paths:
                    if p.exists():
                        p.rename(onnx_path)
                        print(f"[OK] ONNX 모델 이동 완료: {p} → {onnx_path}")
                        break
                else:
                    raise FileNotFoundError("ONNX 파일을 찾을 수 없습니다")
        except Exception as onnx_error:
            print(f"[ERROR] ONNX 변환 실패: {onnx_error}")
            print("[WARN] ONNX 파일 없이 진행합니다. 브라우저에서 모델을 사용할 수 없습니다.")
            onnx_path = None
        
        # 자동 업로드 및 등록
        upload_and_register_model(model_path, onnx_path, config)
            
    except Exception as e:
        print(f"[ERROR] 모델 저장 실패: {e}")

def upload_and_register_model(model_path, onnx_path, config):
    """학습된 모델을 Supabase 스토리지에 업로드하고 model_registry에 등록 // 🔧 수정됨"""
    try:
        from supabase import create_client
        import os
        from datetime import datetime
        
        # Supabase 클라이언트 초기화 (Service Role 우선)
        supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
        supabase_key = (
            os.getenv('SUPABASE_SERVICE_ROLE_KEY')
            or os.getenv('VITE_SUPABASE_SERVICE_ROLE')
            or os.getenv('SUPABASE_ANON_KEY')
            or os.getenv('VITE_SUPABASE_ANON_KEY')
        )
        
        if not supabase_url or not supabase_key:
            print("[WARN] Supabase 환경변수가 설정되지 않음 - 모델 업로드 스킵")
            return
            
        supabase = create_client(supabase_url, supabase_key)
        
        # 모델 파일 읽기
        with open(model_path, 'rb') as f:
            model_data = f.read()
        
        # 파일명 생성 (타임스탬프 + 스테이지 포함) // 🔧 수정됨
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        stage_label = config.get('model_stage', 'single')
        if stage_label not in ('stage1', 'stage2'):
            stage_label = 'single'
        model_name = f"brickbox_s_seg_{stage_label}_{timestamp}"
        pt_bucket_path = f"{model_name}.pt"
        
        # PyTorch 모델 업로드
        print(f"[UPLOAD] PyTorch 모델 업로드 중: {pt_bucket_path}")
        upload_result = supabase.storage.from_('models').upload(
            pt_bucket_path,
            model_data
        )
        
        # Supabase Storage 업로드 응답 처리
        if hasattr(upload_result, 'error') and upload_result.error:
            print(f"[ERROR] PyTorch 모델 업로드 실패: {upload_result.error}")
            pt_public_url = f"{supabase_url}/storage/v1/object/public/models/{pt_bucket_path}"
            print(f"[WARN] 모델 업로드 실패로 인해 예상 공개 URL을 사용합니다: {pt_public_url}")
        else:
            pt_public_url = f"{supabase_url}/storage/v1/object/public/models/{pt_bucket_path}"
            print(f"[OK] PyTorch 모델 업로드 성공, 공개 URL: {pt_public_url}")
        
        # ONNX 모델 업로드 (있는 경우) // 🔧 수정됨
        onnx_bucket_path = None
        onnx_public_url = None
        # onnx_path를 Path 객체로 정규화
        onnx_path_obj = Path(onnx_path) if onnx_path else None
        if onnx_path_obj and onnx_path_obj.exists():
            onnx_bucket_path = f"{model_name}.onnx"
            print(f"[UPLOAD] ONNX 모델 업로드 중: {onnx_bucket_path}")
            with open(onnx_path_obj, 'rb') as f:
                onnx_data = f.read()
            
            onnx_upload_result = supabase.storage.from_('models').upload(
                onnx_bucket_path,
                onnx_data
            )
            
            if hasattr(onnx_upload_result, 'error') and onnx_upload_result.error:
                print(f"[ERROR] ONNX 모델 업로드 실패: {onnx_upload_result.error}")
            else:
                onnx_public_url = f"{supabase_url}/storage/v1/object/public/models/{onnx_bucket_path}"
                print(f"[OK] ONNX 모델 업로드 성공, 공개 URL: {onnx_public_url}")
        else:
            print("[WARN] ONNX 파일이 없어 업로드를 건너뜁니다")
        
        # model_registry에 등록
        print(f"[REGISTER] 모델 등록 중: {model_name}")
        model_size_mb = len(model_data) / (1024 * 1024)
        
        # 동일 stage의 활성 모델만 비활성화 (stage1과 stage2는 별도 관리) // 🔧 수정됨
        current_stage = config.get('model_stage', 'single')
        if current_stage in ('stage1', 'stage2'):
            # 하이브리드 모드: 동일 stage만 비활성화
        supabase.table('model_registry').update({
            'is_active': False,
            'status': 'inactive'
        }).eq('is_active', True).eq('model_stage', current_stage).execute()
            print(f"[INFO] {current_stage} 기존 활성 모델 비활성화")
        else:
            # 단일 모드: 모든 활성 모델 비활성화
            supabase.table('model_registry').update({
                'is_active': False,
                'status': 'inactive'
            }).eq('is_active', True).execute()
        
        # 새 모델 등록 (ONNX URL 우선 사용, 항상 active로 설정) // 🔧 수정됨
        from datetime import datetime as _dt
        version = f"1.0.{_dt.now().strftime('%Y%m%d%H%M%S')}"
        
        # model_url은 브라우저용 ONNX 파일을 우선 사용, 없으면 .pt 사용
        final_model_url = onnx_public_url if onnx_public_url else pt_public_url
        
        registry_data = {
            'model_name': model_name,
            'version': version,
            'model_url': final_model_url,  # ONNX 우선, 없으면 .pt
            'model_path': onnx_bucket_path if onnx_bucket_path else pt_bucket_path,  # ONNX 우선
            'pt_model_path': pt_bucket_path,
            'is_active': True,  # 항상 active로 설정
            'status': 'active',  # 항상 active로 설정 (stage1, stage2 모두)
            'model_type': 'yolo',
            'model_size_mb': round(model_size_mb, 2),
            'segmentation_support': True,
            'model_stage': current_stage,
            'created_by': 'system',
            'training_metadata': {
                'set_num': config.get('set_num', 'latest'),
                'part_id': config.get('part_id'),
                'epochs': config.get('epochs', 100),
                'batch_size': config.get('batch_size', 16),
                'imgsz': config.get('imgsz', 640),
                'device': config.get('device', 'cuda')
            }
        }
        
        registry_result = supabase.table('model_registry').insert(registry_data).execute()
        
        # Supabase 응답 처리
        if hasattr(registry_result, 'error') and registry_result.error:
            print(f"[ERROR] 모델 등록 실패: {registry_result.error}")
        else:
            print(f"[OK] 모델 업로드 및 등록 완료: {model_name}")
            print(f"[URL] PyTorch URL: {pt_public_url}")
            if onnx_public_url:
                print(f"[URL] ONNX URL: {onnx_public_url}")
            else:
                print("[WARN] ONNX URL이 없습니다. 브라우저에서 모델을 사용할 수 없습니다.")
            
    except Exception as e:
        print(f"[ERROR] 모델 업로드 및 등록 실패: {e}")
        import traceback
        traceback.print_exc()

def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(description='BrickBox YOLO 학습 스크립트')
    parser.add_argument('--set_num', default='latest', help='레고 세트 번호')
    parser.add_argument('--part_id', help='부품 ID 또는 엘리먼트 ID (부품 단위 학습용)')
    parser.add_argument('--epochs', type=int, default=100, help='학습 에폭 수 (기술문서 권장: 100)')
    parser.add_argument('--batch_size', type=int, default=24, help='배치 크기 (16~32 권장)')
    parser.add_argument('--imgsz', type=int, default=768, help='이미지 크기 (768 권장, 960 고성능)')
    parser.add_argument('--device', default='cuda', help='사용 디바이스')
    parser.add_argument('--job_id', help='학습 작업 ID')
    parser.add_argument('--model_stage', choices=['stage1', 'stage2', 'hybrid'], default='hybrid', 
                       help='하이브리드 모델 단계 (hybrid: 1단계+2단계, stage1: YOLO11n-seg, stage2: YOLO11s-seg)')
    
    args = parser.parse_args()
    
    # 로깅 설정
    logger = setup_logging()
    
    # 설정 정보
    config = {
        'set_num': args.set_num,
        'part_id': args.part_id,
        'epochs': args.epochs,
        'batch_size': args.batch_size,
        'imgsz': args.imgsz,
        'device': args.device,
        'job_id': args.job_id,
        'model_stage': args.model_stage
    }
    
    print("[START] BrickBox YOLO 학습 시작")
    print(f"[STATS] 설정: {config}")
    
    try:
        # 1. 학습 상태 업데이트 (시작)
        if args.job_id:
            update_training_status(args.job_id, 'running', {'status': '학습 시작'})
        
        # 2. ID 매핑 제거: 전달받은 ID를 그대로 사용 (element_id 디렉토리 우선)
        actual_part_id = args.part_id
        
        # 3. 데이터셋 준비 (중복 부품 제거 포함)
        dataset_yaml = prepare_dataset(args.set_num, actual_part_id)
        if not dataset_yaml:
            print("[ERROR] 데이터셋 준비 실패")
            if args.job_id:
                update_training_status(args.job_id, 'failed', {'error': '데이터셋 준비 실패'})
            sys.exit(1)
        
        # 4. YOLO 모델 학습
        print("[START] YOLO 모델 학습 시작...")
        results, model = train_yolo_model(dataset_yaml, config, args.job_id)
        
        # 5. 학습 결과 처리
        if results:
            print("[OK] 학습 완료!")
            
            # 최종 메트릭 추출 (안전한 방식)
            final_metrics = {
                'mAP50': 0.0,
                'mAP50_95': 0.0,
                'precision': 0.0,
                'recall': 0.0
            }
            
            try:
                if hasattr(results, 'box') and results.box:
                    final_metrics['mAP50'] = getattr(results.box, 'map50', 0.0)
                    final_metrics['mAP50_95'] = getattr(results.box, 'map', 0.0)
                    final_metrics['precision'] = getattr(results.box, 'mp', 0.0)
                    final_metrics['recall'] = getattr(results.box, 'mr', 0.0)
            except Exception as e:
                print(f"[WARN] 메트릭 추출 중 오류: {e}")
                # 기본값 사용
            
            print(f"[STATS] 최종 성능:")
            for metric, value in final_metrics.items():
                print(f"  {metric}: {value:.4f}")
            
            # 6. 모델 저장 (하이브리드 모델 처리)
            if isinstance(model, dict):
                print("[HYBRID] 하이브리드 모델 저장 중...")
                for stage, stage_model in model.items():
                    if stage_model and hasattr(stage_model, 'save'):
                        stage_path = Path(f"public/models/lego_yolo_{stage}_latest.pt")
                        stage_model.save(stage_path)
                        print(f"[OK] {stage} 모델 저장 완료: {stage_path}")
            else:
                save_model(model, config)
            
            # 7. 학습 상태 업데이트 (완료)
            if args.job_id:
                update_training_status(args.job_id, 'completed', {
                    'status': '학습 완료',
                    'final_metrics': final_metrics
                })
            
            # 8. 부품 학습 상태 업데이트 (중복 방지를 위해)
            update_part_training_status(args.set_num, actual_part_id, final_metrics)
            
            print("[SUCCESS] BrickBox YOLO 학습 완료!")
            
        else:
            print("[ERROR] 학습 실패")
            if args.job_id:
                update_training_status(args.job_id, 'failed', {'error': '학습 실패'})
            sys.exit(1)
            
    except Exception as e:
        print(f"[ERROR] 학습 중 오류 발생: {e}")
        if args.job_id:
            update_training_status(args.job_id, 'failed', {'error': str(e)})
        sys.exit(1)

if __name__ == "__main__":
    main()
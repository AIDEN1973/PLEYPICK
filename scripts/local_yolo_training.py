#!/usr/bin/env python3
"""
🧱 BrickBox 로컬 YOLO 학습 스크립트

웹 UI에서 자동으로 실행되는 YOLO 모델 학습 스크립트
"""

import argparse
import os
import sys
import json
import time
from pathlib import Path
from datetime import datetime

# YOLO 관련 임포트
try:
    from ultralytics import YOLO
    import torch
except ImportError as e:
    print(f"❌ 필요한 패키지가 설치되지 않았습니다: {e}")
    print("다음 명령어로 설치하세요: pip install ultralytics torch")
    sys.exit(1)

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
        print(f"📊 학습 상태 업데이트: {status}")
        if progress:
            print(f"📈 진행률: {progress}")
        if metrics:
            print(f"📊 메트릭: {metrics}")
            
    except Exception as e:
        print(f"⚠️ 상태 업데이트 실패: {e}")

def prepare_dataset(set_num, part_id=None):
    """데이터셋 준비 - 중복 부품 제거 포함"""
    print(f"📋 데이터셋 준비 시작: 세트 {set_num}, 부품 {part_id}")

    # 데이터셋 경로 설정
    if set_num == 'latest':
        # 부품 단위 학습의 경우 해당 부품 디렉토리 사용
        if part_id:
            # 먼저 part_id로 시도
            dataset_path = Path(f"output/synthetic/{part_id}")
            
            # part_id로 찾을 수 없으면 엘리먼트 ID로 시도
            if not dataset_path.exists():
                print(f"⚠️ 부품 ID {part_id} 디렉토리가 없음. 엘리먼트 ID로 검색 중...")
                
                # parts_master에서 엘리먼트 ID 조회
                try:
                    import requests
                    import os
                    
                    supabase_url = os.getenv('VITE_SUPABASE_URL', 'https://npferbxuxocbfnfbpcnz.supabase.co')
                    supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk')
                    
                    # // 🔧 수정됨: REST 메서드를 GET으로 변경하고 limit 추가
                    response = requests.get(
                        f"{supabase_url}/rest/v1/parts_master",
                        headers={
                            "apikey": supabase_key,
                            "Authorization": f"Bearer {supabase_key}",
                            "Content-Type": "application/json"
                        },
                        params={
                            "part_id": f"eq.{part_id}",
                            "select": "element_id",
                            "limit": 1
                        }
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        if data and len(data) > 0:
                            element_id = data[0].get('element_id')
                            if element_id:
                                dataset_path = Path(f"output/synthetic/{element_id}")
                                print(f"🔄 엘리먼트 ID {element_id} 디렉토리로 시도: {dataset_path}")
                except Exception as e:
                    print(f"⚠️ 엘리먼트 ID 조회 실패: {e}")
        else:
            dataset_path = Path("output/synthetic/prepared")
    else:
        dataset_path = Path(f"output/synthetic/set_{set_num}")

    if not dataset_path.exists():
        print(f"❌ 데이터셋 경로가 존재하지 않습니다: {dataset_path}")
        return None
    
    # dataset.yaml 파일 확인
    yaml_file = dataset_path / "dataset.yaml"
    if not yaml_file.exists():
        print(f"❌ dataset.yaml 파일이 없습니다: {yaml_file}")
        return None
    
    # 중복 부품 제거 처리
    if set_num != 'latest':
        filtered_yaml = remove_duplicate_parts(yaml_file, set_num, part_id)
        if filtered_yaml:
            yaml_file = filtered_yaml
    
    print(f"✅ 데이터셋 준비 완료: {dataset_path}")
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
            print("⚠️ Supabase 환경변수가 설정되지 않음 - 중복 제거 스킵")
            print("💡 SUPABASE_URL, SUPABASE_ANON_KEY 또는 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정하세요")
            return None
            
        supabase = create_client(supabase_url, supabase_key)
        
        # dataset.yaml 읽기
        with open(yaml_file, 'r', encoding='utf-8') as f:
            dataset_config = yaml.safe_load(f)
        
        # 세트 부품 목록 조회
        if part_id:
            # 부품 단위 학습: 특정 부품만 학습
            target_parts = [part_id]
            print(f"🧩 부품 단위 학습: {part_id}")
        else:
            # 세트 단위 학습: 세트 내 모든 부품
            try:
                # 세트 정보 조회
                set_response = supabase.table('lego_sets').select('id').eq('set_num', set_num).single().execute()
                if not set_response.data:
                    print(f"❌ 세트 {set_num}을 찾을 수 없음")
                    return None
                
                # 세트 부품 조회
                parts_response = supabase.table('set_parts').select('part_id').eq('set_id', set_response.data['id']).execute()
                target_parts = [p['part_id'] for p in parts_response.data] if parts_response.data else []
                print(f"📦 세트 {set_num} 부품: {len(target_parts)}개")
            except Exception as e:
                print(f"⚠️ 세트 부품 조회 실패: {e}")
                return None
        
        if not target_parts:
            print("❌ 학습할 부품이 없음")
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
                    print(f"🔍 일괄 조회로 {len(trained_parts)}개 부품 상태 확인")
            except Exception as e:
                print(f"⚠️ 일괄 조회 실패, 개별 조회로 전환: {e}")
                # 일괄 조회 실패 시 개별 조회로 fallback
                for part_id in target_parts:
                    try:
                        response = supabase.table('part_training_status').select('part_id').eq('part_id', part_id).eq('status', 'completed').execute()
                        if response.data:
                            trained_parts.extend([p['part_id'] for p in response.data])
                    except Exception as e:
                        print(f"⚠️ 부품 {part_id} 상태 조회 실패: {e}")
                        continue
            
            if trained_parts:
                print(f"⏭️ 이미 학습된 부품 {len(trained_parts)}개 스킵: {trained_parts[:5]}{'...' if len(trained_parts) > 5 else ''}")
                
                # 새로 학습할 부품만 필터링
                new_parts = [p for p in target_parts if p not in trained_parts]
                
                if not new_parts:
                    print("❌ 모든 부품이 이미 학습됨 - 학습 중단")
                    return None
                
                print(f"✅ 새로 학습할 부품 {len(new_parts)}개: {new_parts[:5]}{'...' if len(new_parts) > 5 else ''}")
                
                # 필터링된 데이터셋 생성
                filtered_yaml = create_filtered_dataset(yaml_file, new_parts)
                return filtered_yaml
            else:
                print("✅ 모든 부품이 새로 학습 대상")
                return None
                
        except Exception as e:
            print(f"⚠️ 중복 부품 확인 실패: {e}")
            return None
            
    except Exception as e:
        print(f"❌ 중복 부품 제거 실패: {e}")
        return None

def create_filtered_dataset(original_yaml, target_parts):
    """특정 부품만 포함하는 필터링된 데이터셋 생성"""
    try:
        import yaml
        import shutil
        from pathlib import Path
        import json
        
        print(f"🔍 필터링된 데이터셋 생성 시작: {len(target_parts)}개 부품")
        print(f"📦 대상 부품: {target_parts}")
        
        # 원본 파일 백업
        backup_yaml = original_yaml.replace('.yaml', '_backup.yaml')
        shutil.copy2(original_yaml, backup_yaml)
        print(f"💾 원본 백업: {backup_yaml}")
        
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
        print(f"🏷️ 클래스 매핑: {part_to_class_id}")
        
        # 필터링된 파일들 수집
        filtered_files = {'train': [], 'val': [], 'test': []}
        total_images = 0
        
        for split_name, split_path in [('train', train_path), ('val', val_path), ('test', test_path)]:
            if not split_path.exists():
                print(f"⚠️ {split_name} 경로가 존재하지 않음: {split_path}")
                continue
                
            print(f"🔍 {split_name} 폴더 스캔 중...")
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
                                print(f"  ✅ {image_file.name} (부품: {part_id})")
                        break
            
            filtered_files[split_name] = split_images
            print(f"📊 {split_name}: {len(split_images)}개 이미지")
        
        if total_images == 0:
            print("❌ 필터링된 이미지가 없음")
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
        
        print(f"✅ 필터링된 데이터셋 생성 완료: {total_images}개 이미지")
        print(f"📁 저장 위치: {temp_yaml}")
        return str(temp_yaml)
        
    except Exception as e:
        print(f"❌ 필터링된 데이터셋 생성 실패: {e}")
        import traceback
        traceback.print_exc()
        return None

def filter_labels_for_parts(label_file, target_parts, part_to_class_id):
    """라벨 파일에서 특정 부품의 라벨만 필터링"""
    try:
        filtered_lines = []
        
        # 파일명에서 부품 ID 추출
        file_name = Path(label_file).stem
        print(f"🔍 라벨 파일 처리: {file_name}")
        
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
                        print(f"  ✅ 라벨 변환: 클래스 0 → {new_class_id} (부품: {part_id})")
                        break
        
        return filtered_lines
        
    except Exception as e:
        print(f"⚠️ 라벨 필터링 실패 {label_file}: {e}")
        return []

def update_part_training_status(set_num, part_id, metrics):
    """학습 완료된 부품들의 상태를 업데이트하여 중복 학습 방지"""
    try:
        from supabase import create_client
        import os
        
        # Supabase 클라이언트 초기화
        supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_ANON_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')
        
        if not supabase_url or not supabase_key:
            print("⚠️ Supabase 환경변수가 설정되지 않음 - 부품 상태 업데이트 스킵")
            print("💡 SUPABASE_URL, SUPABASE_ANON_KEY 또는 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정하세요")
            return
            
        supabase = create_client(supabase_url, supabase_key)
        
        if part_id:
            # 부품 단위 학습: 특정 부품만 업데이트
            trained_parts = [part_id]
            print(f"🧩 부품 단위 학습 완료: {part_id}")
        else:
            # 세트 단위 학습: 세트 내 모든 부품 업데이트
            try:
                # 세트 정보 조회
                set_response = supabase.table('lego_sets').select('id').eq('set_num', set_num).single().execute()
                if not set_response.data:
                    print(f"❌ 세트 {set_num}을 찾을 수 없음")
                    return
                
                # 세트 부품 조회
                parts_response = supabase.table('set_parts').select('part_id').eq('set_id', set_response.data['id']).execute()
                trained_parts = [p['part_id'] for p in parts_response.data] if parts_response.data else []
                print(f"📦 세트 단위 학습 완료: {len(trained_parts)}개 부품")
            except Exception as e:
                print(f"⚠️ 세트 부품 조회 실패: {e}")
                return
        
        # 각 부품의 학습 상태를 'completed'로 업데이트
        for part_id in trained_parts:
            try:
                supabase.table('part_training_status').upsert({
                    'part_id': part_id,
                    'status': 'completed',
                    'map50': metrics.get('mAP50', 0.0),  # 실제 DB 필드명: map50
                    'precision': metrics.get('precision', 0.0),
                    'recall': metrics.get('recall', 0.0),
                    'last_trained_at': datetime.now().isoformat()
                }, {
                    'onConflict': 'part_id'
                }).execute()
                print(f"✅ 부품 {part_id} 학습 상태 업데이트 완료")
            except Exception as e:
                print(f"⚠️ 부품 {part_id} 상태 업데이트 실패: {e}")
        
        print(f"🎉 총 {len(trained_parts)}개 부품 학습 상태 업데이트 완료")
        
    except Exception as e:
        print(f"❌ 부품 학습 상태 업데이트 실패: {e}")

def train_yolo_model(dataset_yaml, config):
    """YOLO 모델 학습"""
    print("🚀 YOLO 모델 학습 시작...")
    
    # 디바이스 설정
    device = 'cuda' if torch.cuda.is_available() and config.get('device') == 'cuda' else 'cpu'
    print(f"🖥️ 사용 디바이스: {device}")
    
    # GPU 사용 불가 시 경고 및 CPU 설정 조정
    if device == 'cpu':
        print("⚠️ GPU를 사용할 수 없습니다. CPU로 학습을 진행합니다.")
        print("💡 GPU 가속을 원한다면 PyTorch CUDA 버전을 설치하세요.")
        print("   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121")
    
    # 하이브리드 YOLO 모델 초기화 (2단계 시스템)
    # 1단계: YOLO11n-seg (빠른 스캔)
    # 2단계: YOLO11s-seg (정밀 검증)
    model_stage = config.get('model_stage', 'stage1')  # stage1 또는 stage2
    
    if model_stage == 'stage1':
        model = YOLO('yolo11n-seg.pt')  # 1단계: 빠른 스캔용
        print("🚀 1단계 모델 (YOLO11n-seg): 빠른 전체 스캔")
    else:
        model = YOLO('yolo11s-seg.pt')  # 2단계: 정밀 검증용
        print("🎯 2단계 모델 (YOLO11s-seg): 정밀 검증")
    
    # 단계별 학습 설정
    if model_stage == 'stage1':
        # 1단계: 빠른 스캔용 설정
        # CPU 사용 시 배치 크기와 이미지 크기 조정
        batch_size = 4 if device == 'cpu' else config.get('batch_size', 32)
        imgsz = 416 if device == 'cpu' else config.get('imgsz', 640)
        
        training_args = {
            'data': dataset_yaml,
            'epochs': config.get('epochs', 80),  # 1단계는 더 적은 에폭
            'batch': batch_size,  # CPU 시 작은 배치
            'imgsz': imgsz,  # CPU 시 작은 이미지
            'device': device,
            'project': 'output/training',
            'name': f'brickbox_stage1_{config.get("set_num", "latest")}_{datetime.now().strftime("%Y%m%d_%H%M%S")}',
            'save': True,
            'plots': True,
            'val': True,
            'patience': 15,  # Early stopping
            'save_period': 10,
            'cache': True,
            'workers': 4,
            'optimizer': 'AdamW',
            'lr0': 0.01,
            'lrf': 0.01,
            'momentum': 0.937,
            'weight_decay': 0.0005,
            'warmup_epochs': 3,
            'warmup_momentum': 0.8,
            'warmup_bias_lr': 0.1,
            'box': 7.5,
            'cls': 0.5,
            'dfl': 1.5,
            'pose': 12.0,
            'kobj': 2.0,
            'label_smoothing': 0.0,
            # 1단계 데이터 증강 (속도 우선)
            'copy_paste': 0.4,  # 적은 증강
            'mosaic': 0.3,
            'fliplr': 0.5,
            'hsv_h': 0.5,
            'hsv_s': 0.3,
            'hsv_v': 0.3,
            'perspective': 0.0005,
            'erasing': 0.1,
            'nbs': 64,
            'overlap_mask': True,
            'mask_ratio': 4,
            'dropout': 0.0,
            # 'val_period': 1,  # YOLO에서 지원하지 않음
            # 1단계 추론 설정 (낮은 임계값)
            'conf': 0.3,  # 낮은 신뢰도로 후보 수집
            'iou': 0.50,
            'max_det': 50,  # 적은 탐지 수
        }
    else:
        # 2단계: 정밀 검증용 설정
        # CPU 사용 시 배치 크기와 이미지 크기 조정
        batch_size = 2 if device == 'cpu' else config.get('batch_size', 16)
        imgsz = 512 if device == 'cpu' else config.get('imgsz', 768)
        
        training_args = {
            'data': dataset_yaml,
            'epochs': config.get('epochs', 100),  # 2단계는 더 많은 에폭
            'batch': batch_size,  # CPU 시 작은 배치
            'imgsz': imgsz,  # CPU 시 작은 이미지
            'device': device,
            'project': 'output/training',
            'name': f'brickbox_stage2_{config.get("set_num", "latest")}_{datetime.now().strftime("%Y%m%d_%H%M%S")}',
            'save': True,
            'plots': True,
            'val': True,
            'patience': 15,  # Early stopping
            'save_period': 10,
            'cache': True,
            'workers': 4,
            'optimizer': 'AdamW',
            'lr0': 0.01,
            'lrf': 0.01,
            'momentum': 0.937,
            'weight_decay': 0.0005,
            'warmup_epochs': 3,
            'warmup_momentum': 0.8,
            'warmup_bias_lr': 0.1,
            'box': 7.5,
            'cls': 0.5,
            'dfl': 1.5,
            'pose': 12.0,
            'kobj': 2.0,
            'label_smoothing': 0.0,
            # 2단계 데이터 증강 (정확도 우선)
            'copy_paste': 0.6,  # 많은 증강
            'mosaic': 0.5,
            'fliplr': 0.5,
            'hsv_h': 0.7,
            'hsv_s': 0.4,
            'hsv_v': 0.4,
            'perspective': 0.001,
            'erasing': 0.2,
            'nbs': 64,
            'overlap_mask': True,
            'mask_ratio': 4,
            'dropout': 0.0,
            # 'val_period': 1,  # YOLO에서 지원하지 않음
            # 2단계 추론 설정 (높은 임계값)
            'conf': 0.5,  # 높은 신뢰도로 정확한 판정
            'iou': 0.60,
            'max_det': 20,  # 적은 탐지 수
        }
    
    print(f"📊 학습 설정: {training_args}")
    
    # 학습 시작
    start_time = time.time()
    results = model.train(**training_args)
    end_time = time.time()
    
    training_time = end_time - start_time
    print(f"⏱️ 학습 완료 시간: {training_time:.2f}초")
    
    return results, model

def save_model(model, config):
    """학습된 모델 저장"""
    print("💾 학습된 모델 저장 중...")
    
    # 모델 저장 경로
    model_dir = Path("public/models")
    model_dir.mkdir(parents=True, exist_ok=True)
    
    # ONNX 형식으로 변환하여 저장
    model_path = model_dir / f"lego_yolo_set_{config.get('set_num', 'latest')}.onnx"
    
    try:
        # ONNX 형식으로 내보내기
        model.export(format='onnx', imgsz=config.get('imgsz', 640))
        
        # 내보낸 모델을 목적지로 이동
        exported_path = model_dir / "yolo11n.onnx"
        if exported_path.exists():
            exported_path.rename(model_path)
            print(f"✅ 모델 저장 완료: {model_path}")
            
            # 자동 업로드 및 등록
            upload_and_register_model(model_path, config)
        else:
            print("⚠️ ONNX 변환된 모델을 찾을 수 없습니다")
            
    except Exception as e:
        print(f"❌ 모델 저장 실패: {e}")

def upload_and_register_model(model_path, config):
    """학습된 모델을 Supabase 스토리지에 업로드하고 model_registry에 등록"""
    try:
        from supabase import create_client
        import os
        from datetime import datetime
        
        # Supabase 클라이언트 초기화
        supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_ANON_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')
        
        if not supabase_url or not supabase_key:
            print("⚠️ Supabase 환경변수가 설정되지 않음 - 모델 업로드 스킵")
            return
            
        supabase = create_client(supabase_url, supabase_key)
        
        # 모델 파일 읽기
        with open(model_path, 'rb') as f:
            model_data = f.read()
        
        # 파일명 생성 (타임스탬프 포함)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_name = f"brickbox_s_seg_{timestamp}"
        bucket_path = f"{model_name}.pt"
        
        # Supabase 스토리지에 업로드
        print(f"📤 모델 업로드 중: {bucket_path}")
        upload_result = supabase.storage.from_('models').upload(
            bucket_path,
            model_data,
            {
                'content-type': 'application/octet-stream',
                'upsert': True
            }
        )
        
        if upload_result.error:
            print(f"❌ 모델 업로드 실패: {upload_result.error}")
            return
        
        # 공개 URL 생성
        public_url = supabase.storage.from_('models').get_public_url(bucket_path)
        
        # model_registry에 등록
        print(f"📝 모델 등록 중: {model_name}")
        model_size_mb = len(model_data) / (1024 * 1024)
        
        # 기존 모델들을 비활성화
        supabase.table('model_registry').update({
            'is_active': False,
            'status': 'inactive'
        }).execute()
        
        # 새 모델 등록
        registry_result = supabase.table('model_registry').insert({
            'model_name': model_name,
            'version': '1.0.0',
            'model_url': public_url.public_url,
            'model_path': bucket_path,
            'pt_model_path': bucket_path,
            'is_active': True,
            'status': 'active',
            'model_type': 'yolo',
            'model_size_mb': round(model_size_mb, 2),
            'segmentation_support': True,
            'model_stage': 'single',
            'created_by': 'system',
            'training_metadata': {
                'set_num': config.get('set_num', 'latest'),
                'part_id': config.get('part_id'),
                'epochs': config.get('epochs', 100),
                'batch_size': config.get('batch_size', 16),
                'imgsz': config.get('imgsz', 640),
                'device': config.get('device', 'cuda')
            }
        }).execute()
        
        if registry_result.error:
            print(f"❌ 모델 등록 실패: {registry_result.error}")
        else:
            print(f"✅ 모델 업로드 및 등록 완료: {model_name}")
            print(f"🔗 공개 URL: {public_url.public_url}")
            
    except Exception as e:
        print(f"❌ 모델 업로드 및 등록 실패: {e}")
        import traceback
        traceback.print_exc()

def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(description='BrickBox YOLO 학습 스크립트')
    parser.add_argument('--set_num', default='latest', help='레고 세트 번호')
    parser.add_argument('--part_id', help='부품 ID 또는 엘리먼트 ID (부품 단위 학습용)')
    parser.add_argument('--epochs', type=int, default=100, help='학습 에폭 수')
    parser.add_argument('--batch_size', type=int, default=24, help='배치 크기 (16~32 권장)')
    parser.add_argument('--imgsz', type=int, default=768, help='이미지 크기 (768 권장, 960 고성능)')
    parser.add_argument('--device', default='cuda', help='사용 디바이스')
    parser.add_argument('--job_id', help='학습 작업 ID')
    parser.add_argument('--model_stage', choices=['stage1', 'stage2'], default='stage1', 
                       help='하이브리드 모델 단계 (stage1: YOLO11n-seg, stage2: YOLO11s-seg)')
    
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
    
    print("🧱 BrickBox YOLO 학습 시작")
    print(f"📊 설정: {config}")
    
    try:
        # 1. 학습 상태 업데이트 (시작)
        if args.job_id:
            update_training_status(args.job_id, 'running', {'status': '학습 시작'})
        
        # 2. ID 매핑 제거: 전달받은 ID를 그대로 사용 (element_id 디렉토리 우선)
        actual_part_id = args.part_id
        
        # 3. 데이터셋 준비 (중복 부품 제거 포함)
        dataset_yaml = prepare_dataset(args.set_num, actual_part_id)
        if not dataset_yaml:
            print("❌ 데이터셋 준비 실패")
            if args.job_id:
                update_training_status(args.job_id, 'failed', {'error': '데이터셋 준비 실패'})
            sys.exit(1)
        
        # 4. YOLO 모델 학습
        print("🚀 YOLO 모델 학습 시작...")
        results, model = train_yolo_model(dataset_yaml, config)
        
        # 5. 학습 결과 처리
        if results:
            print("✅ 학습 완료!")
            
            # 최종 메트릭 추출
            final_metrics = {
                'mAP50': getattr(results, 'box', {}).get('mAP50', 0.0),
                'mAP50_95': getattr(results, 'box', {}).get('mAP50_95', 0.0),
                'precision': getattr(results, 'box', {}).get('precision', 0.0),
                'recall': getattr(results, 'box', {}).get('recall', 0.0)
            }
            
            print(f"📊 최종 성능:")
            for metric, value in final_metrics.items():
                print(f"  {metric}: {value:.4f}")
            
            # 6. 모델 저장
            save_model(model, config)
            
            # 7. 학습 상태 업데이트 (완료)
            if args.job_id:
                update_training_status(args.job_id, 'completed', {
                    'status': '학습 완료',
                    'final_metrics': final_metrics
                })
            
            # 8. 부품 학습 상태 업데이트 (중복 방지를 위해)
            update_part_training_status(args.set_num, actual_part_id, final_metrics)
            
            print("🎉 BrickBox YOLO 학습 완료!")
            
        else:
            print("❌ 학습 실패")
            if args.job_id:
                update_training_status(args.job_id, 'failed', {'error': '학습 실패'})
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ 학습 중 오류 발생: {e}")
        if args.job_id:
            update_training_status(args.job_id, 'failed', {'error': str(e)})
        sys.exit(1)

if __name__ == "__main__":
    main()
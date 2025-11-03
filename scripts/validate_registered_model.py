#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
등록된 모델의 정확도 검증 스크립트

사용법:
    python scripts/validate_registered_model.py [--version VERSION] [--test-set TEST_SET_PATH]
"""

import os
import sys
import argparse
from pathlib import Path
from supabase import create_client
from ultralytics import YOLO
import torch

# 인코딩 설정
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# 프로젝트 루트를 sys.path에 추가 (환경변수 관리 시스템 import를 위해)
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# 환경변수 관리 시스템 사용
try:
    from scripts.env_integration import get_supabase_config, apply_environment
    ENV_MANAGER_AVAILABLE = True
except ImportError as e:
    ENV_MANAGER_AVAILABLE = False
    print(f"[WARN] 환경변수 관리자를 사용할 수 없습니다: {e}", flush=True)
    print(f"[WARN] 기본 환경변수를 사용합니다.", flush=True)

def setup_supabase():
    """Supabase 클라이언트 설정 (환경변수 관리 시스템 사용)"""
    if ENV_MANAGER_AVAILABLE:
        # 환경변수 적용
        apply_environment()
        # 환경변수 관리 시스템에서 설정 가져오기
        supabase_config = get_supabase_config()
        url = supabase_config.get('url')
        key = supabase_config.get('service_role')
        
        if not url or not key:
            print(f"[ERROR] 환경변수 관리 시스템에서 Supabase 설정을 찾을 수 없습니다.", flush=True)
            raise ValueError("Supabase configuration not found in environment manager")
    else:
        # 폴백: 기본 환경변수 사용
        url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
        key = (
            os.getenv('SUPABASE_SERVICE_ROLE_KEY')
            or os.getenv('VITE_SUPABASE_SERVICE_ROLE')
            or os.getenv('SUPABASE_KEY')
        )
        
        if not url or not key:
            print(f"[ERROR] 환경변수에서 Supabase 설정을 찾을 수 없습니다.", flush=True)
            raise ValueError("Supabase configuration not found in environment variables")
    
    print(f"[OK] Supabase URL: {url}", flush=True)
    print(f"[OK] Key: {key[:20]}...", flush=True)
    
    # API 키 유효성 검증
    if not key or len(key) < 50:
        print(f"[ERROR] 유효하지 않은 API 키 (길이: {len(key) if key else 0})", flush=True)
        raise ValueError("Invalid API key")
    
    try:
        client = create_client(url, key)
        # 간단한 연결 테스트
        test_response = client.table('model_registry').select('id').limit(1).execute()
        print(f"[OK] Supabase 연결 성공", flush=True)
        return client
    except Exception as e:
        print(f"[ERROR] Supabase 연결 실패: {e}", flush=True)
        print(f"   URL: {url}", flush=True)
        print(f"   Key prefix: {key[:30]}...", flush=True)
        raise

def get_active_model(supabase, version=None):
    """활성 모델 또는 특정 버전 모델 조회"""
    try:
        if version:
            # 특정 버전 조회
            response = supabase.table('model_registry').select('*').eq('version', version).execute()
        else:
            # 활성 모델 조회
            response = supabase.table('model_registry').select('*').eq('status', 'active').order('created_at', ascending=False).limit(1).execute()
        
        if not response.data or len(response.data) == 0:
            print(f"[ERROR] 모델을 찾을 수 없습니다.")
            if version:
                print(f"   버전: {version}")
            else:
                print(f"   활성 모델이 없습니다.")
            return None
        
        model_info = response.data[0]
        print(f"✅ 모델 발견:")
        print(f"   버전: {model_info.get('version')}")
        print(f"   이름: {model_info.get('model_name')}")
        print(f"   URL: {model_info.get('model_url')}")
        print(f"   상태: {model_info.get('status')}")
        
        return model_info
        
    except Exception as e:
        print(f"[ERROR] 모델 조회 실패: {e}")
        return None

def download_model(model_url, output_path):
    """모델 파일 다운로드"""
    try:
        print(f"[DOWNLOAD] 모델 다운로드 중...")
        print(f"   URL: {model_url}")
        print(f"   저장 위치: {output_path}")
        
        import requests
        
        response = requests.get(model_url, stream=True)
        response.raise_for_status()
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        total_size = int(response.headers.get('content-length', 0))
        downloaded = 0
        
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        percent = (downloaded / total_size) * 100
                        print(f"\r   진행률: {percent:.1f}%", end='', flush=True)
        
        print(f"\n✅ 모델 다운로드 완료: {output_path}")
        print(f"   크기: {downloaded / 1024 / 1024:.1f} MB")
        
        return True
        
    except Exception as e:
        print(f"\n[ERROR] 모델 다운로드 실패: {e}")
        return False

def prepare_test_dataset(test_set_path=None):
    """테스트 데이터셋 준비 (여러 경로 자동 탐색)"""
    # 가능한 데이터셋 경로 목록 (우선순위 순)
    possible_paths = []
    
    if test_set_path:
        possible_paths.append(Path(test_set_path))
    
    # 기본 경로들 (우선순위 순)
    possible_paths.extend([
        Path("output/datasets/current"),  # 최신 데이터셋
        Path("output/synthetic/dataset_synthetic"),  # 합성 데이터셋 (검증 이미지 40개 확인됨)
        Path("output/dataset_synthetic"),
        Path("output/datasets/v1.1"),
        Path("output/datasets/v1.0"),
    ])
    
    print(f"[DATASET] 테스트 데이터셋 준비...", flush=True)
    
    # 유효한 데이터셋 경로 찾기
    dataset_path = None
    for path in possible_paths:
        if not path.exists():
            continue
            
        val_images = path / "images" / "val"
        val_labels = path / "labels" / "val"
        
        # val 폴더와 이미지가 있는지 확인
        if val_images.exists() and val_labels.exists():
            image_files = list(val_images.glob("*.webp")) + list(val_images.glob("*.jpg")) + list(val_images.glob("*.png"))
            if len(image_files) > 0:
                dataset_path = path
                print(f"✅ 데이터셋 발견: {path}", flush=True)
                print(f"   검증 이미지 수: {len(image_files)}개", flush=True)
                break
    
    if not dataset_path:
        print(f"[ERROR] 검증 데이터셋을 찾을 수 없습니다.", flush=True)
        print(f"   시도한 경로:", flush=True)
        for path in possible_paths:
            exists = path.exists()
            val_exists = (path / "images" / "val").exists() if exists else False
            print(f"     - {path}: {'존재' if exists else '없음'} (val: {'있음' if val_exists else '없음'})", flush=True)
        print(f"\n💡 해결 방법:", flush=True)
        print(f"   1. 데이터셋 생성: python scripts/prepare_yolo_dataset.py", flush=True)
        print(f"   2. 또는 --test-set 옵션으로 데이터셋 경로 지정", flush=True)
        return None
    
    # data.yaml 확인
    data_yaml = dataset_path / "data.yaml"
    if not data_yaml.exists():
        # 기본 data.yaml 생성
        print(f"[WARN] data.yaml 없음, 생성 중...", flush=True)
        
        # 디렉토리 생성 확인
        data_yaml.parent.mkdir(parents=True, exist_ok=True)
        
        # 실제 클래스 수 확인 (라벨 파일에서)
        class_ids = set()
        try:
            for label_file in (dataset_path / "labels" / "val").glob("*.txt"):
                with open(label_file, 'r') as f:
                    for line in f:
                        parts = line.strip().split()
                        if parts:
                            class_ids.add(int(parts[0]))
            num_classes = max(class_ids) + 1 if class_ids else 1
            class_names = [f'class_{i}' for i in range(num_classes)]
        except:
            num_classes = 1
            class_names = ['lego_part']
        
        data_yaml_content = f"""path: {dataset_path.absolute()}
train: images/train
val: images/val

nc: {num_classes}
names: {class_names}
"""
        try:
            data_yaml.write_text(data_yaml_content, encoding='utf-8')
            print(f"✅ data.yaml 생성 완료 (클래스 수: {num_classes})", flush=True)
        except PermissionError as e:
            print(f"[ERROR] data.yaml 파일 쓰기 권한 오류: {e}", flush=True)
            print(f"   경로: {data_yaml}", flush=True)
            raise
        except Exception as e:
            print(f"[ERROR] data.yaml 파일 쓰기 실패: {e}", flush=True)
            print(f"   경로: {data_yaml}", flush=True)
            raise
    
    # 최종 검증
    val_images = dataset_path / "images" / "val"
    val_labels = dataset_path / "labels" / "val"
    
    image_count = len(list(val_images.glob("*.webp"))) + len(list(val_images.glob("*.jpg"))) + len(list(val_images.glob("*.png")))
    label_count = len(list(val_labels.glob("*.txt")))
    
    print(f"✅ 검증 데이터셋 준비 완료:", flush=True)
    print(f"   경로: {dataset_path}", flush=True)
    print(f"   검증 이미지: {image_count}개", flush=True)
    print(f"   검증 라벨: {label_count}개", flush=True)
    
    if image_count == 0:
        print(f"[WARNING] 경고: 검증 이미지가 없습니다!", flush=True)
        return None
    
    return str(dataset_path)

def evaluate_model(model_path, dataset_path, device='cuda'):
    """모델 평가 실행"""
    try:
        print(f"[EVAL] 모델 평가 시작...", flush=True)
        print(f"   모델: {model_path}", flush=True)
        print(f"   데이터셋: {dataset_path}", flush=True)
        
        # CUDA 사용 가능 여부 확인
        if device == 'cuda':
            try:
                import torch
                if not torch.cuda.is_available():
                    print(f"[WARN] CUDA를 사용할 수 없습니다. CPU 모드로 전환합니다.", flush=True)
                    device = 'cpu'
                else:
                    print(f"[INFO] CUDA 사용 가능 (디바이스: {device})", flush=True)
            except ImportError:
                print(f"[WARN] PyTorch를 찾을 수 없습니다. CPU 모드로 전환합니다.", flush=True)
                device = 'cpu'
        
        print(f"   디바이스: {device}", flush=True)
        
        # 데이터셋 설정 먼저 확인
        dataset_yaml = Path(dataset_path) / "data.yaml"
        dataset_classes = 1
        dataset_names = ['lego_part']
        
        if dataset_yaml.exists():
            try:
                import yaml
                with open(dataset_yaml, 'r', encoding='utf-8') as f:
                    dataset_config = yaml.safe_load(f)
                dataset_classes = dataset_config.get('nc', 1)
                dataset_names = dataset_config.get('names', ['lego_part'])
                print(f"[INFO] 데이터셋 클래스 수: {dataset_classes}", flush=True)
                print(f"[INFO] 데이터셋 클래스 이름: {dataset_names}", flush=True)
            except Exception as e:
                print(f"[WARN] 데이터셋 설정 읽기 실패: {e}", flush=True)
        
        # 모델 로드 및 클래스 수 확인
        print(f"[INFO] 모델 로드 중: {model_path}", flush=True)
        try:
            model = YOLO(str(model_path))
            print(f"[INFO] 모델 로드 완료", flush=True)
            
            # 모델 클래스 수 확인
            model_classes = None
            try:
                # 방법 1: model.model.nc 확인
                if hasattr(model, 'model') and hasattr(model.model, 'nc'):
                    model_classes = model.model.nc
                    print(f"[INFO] 모델 클래스 수 (model.nc): {model_classes}", flush=True)
                # 방법 2: model.yaml 확인
                elif hasattr(model, 'model') and hasattr(model.model, 'yaml'):
                    yaml_dict = model.model.yaml if isinstance(model.model.yaml, dict) else {}
                    model_classes = yaml_dict.get('nc', None)
                    if model_classes:
                        print(f"[INFO] 모델 클래스 수 (yaml): {model_classes}", flush=True)
                # 방법 3: model.overrides 확인
                elif hasattr(model, 'overrides') and isinstance(model.overrides, dict):
                    model_classes = model.overrides.get('nc', None)
                    if model_classes:
                        print(f"[INFO] 모델 클래스 수 (overrides): {model_classes}", flush=True)
            except Exception as e:
                print(f"[WARN] 모델 클래스 수 확인 실패: {e}", flush=True)
            
            # 클래스 수 불일치 경고
            if model_classes and model_classes != dataset_classes:
                print(f"[WARNING] 경고: 모델 클래스 수({model_classes})와 데이터셋 클래스 수({dataset_classes})가 일치하지 않습니다!", flush=True)
                print(f"[INFO] 모델이 {model_classes}개 클래스를 기대하지만 데이터셋은 {dataset_classes}개 클래스만 있습니다.", flush=True)
                print(f"[INFO] 계속 진행합니다. YOLO가 자동으로 조정할 수 있습니다.", flush=True)
        except Exception as e:
            print(f"[ERROR] 모델 로드 실패: {e}", flush=True)
            import traceback
            traceback.print_exc(file=sys.stderr)
            raise
        
        # 평가 실행 (더 안전한 파라미터)
        print(f"[INFO] 모델 평가 시작...", flush=True)
        try:
            # CPU에서는 batch 크기와 half precision 조정
            batch_size = 4 if device == 'cpu' else 16  # CPU에서는 더 작은 batch
            
            # 모델 타입 감지
            model_path_str = str(model_path).lower()
            is_segment = 'seg' in model_path_str or 'segment' in model_path_str
            task_type = 'segment' if is_segment else 'detect'
            print(f"[INFO] 모델 타입: {task_type}", flush=True)
            
            # 데이터셋 YAML 업데이트 (모델과 일치하도록)
            try:
                import yaml
                yaml_data = {
                    'path': str(Path(dataset_path).absolute()),
                    'train': 'images/train',
                    'val': 'images/val',
                    'nc': dataset_classes,
                    'names': dataset_names if isinstance(dataset_names, list) else list(dataset_names) if dataset_names else ['lego_part']
                }
                # YAML 파일 재작성 (모델과 일치하도록)
                with open(dataset_yaml, 'w', encoding='utf-8') as f:
                    yaml.dump(yaml_data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
                print(f"[INFO] 데이터셋 YAML 업데이트 완료 (nc={dataset_classes})", flush=True)
            except Exception as e:
                print(f"[WARN] YAML 업데이트 실패, 계속 진행: {e}", flush=True)
            
            # 평가 실행 (단계별로 진행)
            print(f"[INFO] 평가 파라미터: batch={batch_size}, device={device}, task={task_type}", flush=True)
            
            results = model.val(
                data=str(dataset_yaml),
                imgsz=640,
                batch=batch_size,
                device=device,
                conf=0.25,
                iou=0.60,
                verbose=True,
                save=False,  # 결과 저장 비활성화
                plots=False,  # 플롯 생성 비활성화
                half=False,  # half precision 비활성화 (호환성 향상)
                task=task_type,  # 모델 타입 명시
                max_det=300,  # 최대 탐지 수 제한
                agnostic_nms=False  # 클래스별 NMS 사용
            )
            print(f"[INFO] 모델 평가 완료", flush=True)
        except Exception as e:
            print(f"[ERROR] 모델 평가 실행 실패: {e}", flush=True)
            print(f"[DEBUG] 오류 발생 위치:", flush=True)
            import traceback
            traceback.print_exc(file=sys.stderr)
            traceback.print_exc()  # stdout에도 출력
            raise
        
        # 결과 객체 구조 확인 (디버깅)
        print(f"[DEBUG] 결과 객체 타입: {type(results)}", flush=True)
        print(f"[DEBUG] 결과 객체 속성: {dir(results)}", flush=True)
        if hasattr(results, 'box'):
            print(f"[DEBUG] results.box 타입: {type(results.box)}", flush=True)
            if results.box:
                print(f"[DEBUG] results.box 속성: {[attr for attr in dir(results.box) if not attr.startswith('_')]}", flush=True)
        
        # 메트릭 추출 (안전한 방식)
        def safe_get_metric(obj, attr_name, default=0.0):
            """안전하게 메트릭 값을 가져오기"""
            try:
                value = getattr(obj, attr_name, None)
                if value is None:
                    return default
                # numpy array나 tensor인 경우 첫 번째 값 사용
                if hasattr(value, '__len__') and not isinstance(value, str):
                    if len(value) > 0:
                        return float(value[0] if hasattr(value, '__getitem__') else value)
                    return default
                return float(value)
            except (IndexError, TypeError, AttributeError) as e:
                print(f"[WARN] 메트릭 {attr_name} 추출 실패: {e}", flush=True)
                return default
        
        # 여러 소스에서 메트릭 추출 시도
        metrics = {}
        
        # 방법 1: results.box 직접 접근
        if hasattr(results, 'box') and results.box:
            try:
                metrics['mAP50'] = safe_get_metric(results.box, 'map50', 0.0)
                metrics['mAP50_95'] = safe_get_metric(results.box, 'map', 0.0)
                metrics['precision'] = safe_get_metric(results.box, 'mp', 0.0)
                metrics['recall'] = safe_get_metric(results.box, 'mr', 0.0)
            except Exception as e:
                print(f"[WARN] results.box에서 메트릭 추출 실패: {e}", flush=True)
        
        # 방법 2: results.results_dict 사용 (없으면 기본값)
        if not metrics.get('mAP50'):
            try:
                if hasattr(results, 'results_dict'):
                    metrics['mAP50'] = float(results.results_dict.get('metrics/mAP50(B)', results.results_dict.get('metrics/mAP50', 0.0)))
                    metrics['mAP50_95'] = float(results.results_dict.get('metrics/mAP50-95(B)', results.results_dict.get('metrics/mAP50-95', 0.0)))
                    metrics['precision'] = float(results.results_dict.get('metrics/precision(B)', results.results_dict.get('metrics/precision', 0.0)))
                    metrics['recall'] = float(results.results_dict.get('metrics/recall(B)', results.results_dict.get('metrics/recall', 0.0)))
            except Exception as e:
                print(f"[WARN] results_dict에서 메트릭 추출 실패: {e}", flush=True)
        
        # 방법 3: results.keys_dict 사용
        if not metrics.get('mAP50'):
            try:
                if hasattr(results, 'keys'):
                    for key in results.keys():
                        if 'map50' in key.lower() and 'box' in key.lower():
                            metrics['mAP50'] = float(results.keys()[key])
                        elif 'map' in key.lower() and 'box' in key.lower() and 'map50' not in key.lower():
                            metrics['mAP50_95'] = float(results.keys()[key])
            except Exception as e:
                print(f"[WARN] keys에서 메트릭 추출 실패: {e}", flush=True)
        
        # 기본값 설정
        metrics.setdefault('mAP50', 0.0)
        metrics.setdefault('mAP50_95', 0.0)
        metrics.setdefault('precision', 0.0)
        metrics.setdefault('recall', 0.0)
        
        # F1 Score 계산
        if metrics['precision'] > 0 or metrics['recall'] > 0:
            metrics['f1_score'] = 2 * (metrics['precision'] * metrics['recall']) / (metrics['precision'] + metrics['recall'] + 1e-10)
        else:
            metrics['f1_score'] = 0.0
        
        print(f"\n✅ 평가 완료:")
        print(f"   mAP50: {metrics['mAP50']:.4f}")
        print(f"   mAP50-95: {metrics['mAP50_95']:.4f}")
        print(f"   Precision: {metrics['precision']:.4f}")
        print(f"   Recall: {metrics['recall']:.4f}")
        print(f"   F1 Score: {metrics['f1_score']:.4f}")
        
        # 파싱을 위한 표준 형식 출력
        print(f"\n[METRICS]")
        print(f"mAP50: {metrics['mAP50']:.6f}")
        print(f"mAP50-95: {metrics['mAP50_95']:.6f}")
        print(f"Precision: {metrics['precision']:.6f}")
        print(f"Recall: {metrics['recall']:.6f}")
        
        return metrics
        
    except Exception as e:
        print(f"[ERROR] 모델 평가 실패: {e}", flush=True)
        import traceback
        print(f"\n[ERROR] Traceback:", flush=True)
        traceback.print_exc(file=sys.stderr)
        traceback.print_exc()  # stdout에도 출력
        return None

def update_model_metrics(supabase, model_id, metrics):
    """모델 레지스트리에 메트릭 업데이트"""
    try:
        print(f"[UPDATE] 모델 메트릭 업데이트 중...")
        
        # 기존 메트릭 가져오기
        current_model = supabase.table('model_registry').select('metrics').eq('id', model_id).execute()
        existing_metrics = current_model.data[0].get('metrics', {}) if current_model.data else {}
        
        # 새 메트릭 병합 (검증 메트릭 우선)
        updated_metrics = {
            **existing_metrics,
            'validation_mAP50': metrics['mAP50'],
            'validation_mAP50_95': metrics['mAP50_95'],
            'validation_precision': metrics['precision'],
            'validation_recall': metrics['recall'],
            'validation_f1_score': metrics['f1_score'],
            'last_validated': str(Path().cwd() / 'output' / 'validation')  # 타임스탬프 추가 가능
        }
        
        # 업데이트 실행
        response = supabase.table('model_registry').update({
            'metrics': updated_metrics
        }).eq('id', model_id).execute()
        
        print(f"✅ 모델 메트릭 업데이트 완료")
        print(f"   모델 ID: {model_id}")
        print(f"   검증 mAP50: {metrics['mAP50']:.4f}")
        print(f"   검증 mAP50-95: {metrics['mAP50_95']:.4f}")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] 메트릭 업데이트 실패: {e}")
        return False

def validate_model_accuracy(model_info, test_set_path=None, device='cuda'):
    """모델 정확도 검증 메인 함수"""
    try:
        print(f"\n[STEP 1/5] 모델 파일 다운로드...", flush=True)
        # 1. 모델 파일 다운로드
        model_url = model_info.get('model_url')
        if not model_url:
            print(f"[ERROR] 모델 URL이 없습니다.", flush=True)
            return False
        
        # 로컬 저장 경로
        model_dir = Path("output/validation/models")
        model_dir.mkdir(parents=True, exist_ok=True)
        
        model_filename = model_url.split('/')[-1]
        model_path = model_dir / model_filename
        
        # .onnx인 경우 직접 사용 가능 (YOLO v8+ 지원)
        if model_url.endswith('.onnx'):
            onnx_path = model_dir / model_filename
            if download_model(model_url, onnx_path):
                # ONNX 파일을 직접 사용
                model_path = onnx_path
                print(f"[INFO] ONNX 모델 다운로드 완료: {model_path}", flush=True)
            else:
                print(f"[ERROR] ONNX 모델 다운로드 실패", flush=True)
                return False
        else:
            # .pt 파일 다운로드
            if not download_model(model_url, model_path):
                print(f"[ERROR] 모델 파일 다운로드 실패", flush=True)
                return False
        
        print(f"✅ 모델 파일 준비 완료: {model_path}", flush=True)
        
        print(f"\n[STEP 2/5] 테스트 데이터셋 준비...", flush=True)
        # 2. 테스트 데이터셋 준비
        dataset_path = prepare_test_dataset(test_set_path)
        if not dataset_path:
            print(f"[ERROR] 테스트 데이터셋 준비 실패", flush=True)
            return False
        
        print(f"\n[STEP 3/5] 모델 평가 실행...", flush=True)
        # 3. 모델 평가
        metrics = evaluate_model(str(model_path), dataset_path, device)
        if not metrics:
            return False
        
        print(f"\n[STEP 4/5] 메트릭 업데이트...", flush=True)
        # 4. 메트릭 업데이트
        model_id = model_info.get('id')
        if model_id:
            # Supabase 클라이언트 재생성 (메트릭 업데이트용)
            supabase_client = setup_supabase()
            update_model_metrics(supabase_client, model_id, metrics)
        
        print(f"\n[STEP 5/5] SLO 기준 확인 및 피드백...", flush=True)
        # 5. SLO 기준 확인 및 상세 피드백
        print(f"\n📊 SLO 기준 확인:")
        
        # SLO 기준 정의
        slo_recall = 0.95
        slo_map50 = 0.90
        slo_map50_95 = 0.60
        
        checks = {
            'Recall ≥ 0.95': {
                'passed': metrics['recall'] >= slo_recall,
                'current': metrics['recall'],
                'target': slo_recall,
                'gap': slo_recall - metrics['recall'],
                'percentage': (metrics['recall'] / slo_recall * 100) if slo_recall > 0 else 0
            },
            'mAP50 ≥ 0.90': {
                'passed': metrics['mAP50'] >= slo_map50,
                'current': metrics['mAP50'],
                'target': slo_map50,
                'gap': slo_map50 - metrics['mAP50'],
                'percentage': (metrics['mAP50'] / slo_map50 * 100) if slo_map50 > 0 else 0
            },
            'mAP50-95 ≥ 0.60': {
                'passed': metrics['mAP50_95'] >= slo_map50_95,
                'current': metrics['mAP50_95'],
                'target': slo_map50_95,
                'gap': slo_map50_95 - metrics['mAP50_95'],
                'percentage': (metrics['mAP50_95'] / slo_map50_95 * 100) if slo_map50_95 > 0 else 0
            }
        }
        
        all_passed = True
        for check_name, check_data in checks.items():
            status = "✅" if check_data['passed'] else "[ERROR]"
            print(f"   {status} {check_name}: {check_data['current']:.4f} (목표: {check_data['target']:.2f}, 달성률: {check_data['percentage']:.1f}%)", flush=True)
            if not check_data['passed']:
                all_passed = False
        
        # 상세 피드백 제공
        print(f"\n📋 검증 결과 분석:", flush=True)
        
        if all_passed:
            print(f"✅ 모든 SLO 기준 통과! 모델이 프로덕션 환경에 배포 가능합니다.", flush=True)
        else:
            print(f"[ERROR] SLO 기준 미달 - 모델 개선 필요", flush=True)
            
            # Recall 분석
            if metrics['recall'] < slo_recall:
                recall_gap = slo_recall - metrics['recall']
                print(f"\n🔍 Recall 분석 (현재: {metrics['recall']:.1%}, 목표: {slo_recall:.0%}):", flush=True)
                print(f"   - 문제: 모델이 {recall_gap:.1%}만큼 객체를 놓치고 있습니다.", flush=True)
                print(f"   - 영향: 약 {100 - metrics['recall']*100:.1f}%의 객체를 탐지하지 못합니다.", flush=True)
                print(f"   - 해결 방안:", flush=True)
                print(f"     1. Confidence threshold 낮추기 (현재: 0.25 → 0.15 권장)", flush=True)
                print(f"     2. 추가 학습 데이터 수집 (특히 놓친 케이스)", flush=True)
                print(f"     3. 데이터 증강 강화 (rotation, scaling 등)", flush=True)
                print(f"     4. 학습 에폭 수 증가", flush=True)
            
            # mAP50 분석
            if metrics['mAP50'] < slo_map50:
                map50_gap = slo_map50 - metrics['mAP50']
                print(f"\n🔍 mAP50 분석 (현재: {metrics['mAP50']:.1%}, 목표: {slo_map50:.0%}):", flush=True)
                print(f"   - 문제: 평균 정밀도가 {map50_gap:.1%}만큼 부족합니다.", flush=True)
                print(f"   - 영향: 탐지 정확도가 목표보다 낮습니다.", flush=True)
                print(f"   - 해결 방안:", flush=True)
                print(f"     1. 바운딩 박스 라벨링 품질 재검토", flush=True)
                print(f"     2. 학습 데이터 다양성 확보", flush=True)
                print(f"     3. 모델 아키텍처 변경 (더 큰 모델 고려)", flush=True)
                print(f"     4. 학습률 스케줄링 최적화", flush=True)
            
            # mAP50-95 분석
            if metrics['mAP50_95'] < slo_map50_95:
                map50_95_gap = slo_map50_95 - metrics['mAP50_95']
                print(f"\n🔍 mAP50-95 분석 (현재: {metrics['mAP50_95']:.1%}, 목표: {slo_map50_95:.0%}):", flush=True)
                print(f"   - 문제: IoU 임계값 범위에서 정밀도가 {map50_95_gap:.1%}만큼 부족합니다.", flush=True)
                print(f"   - 영향: 바운딩 박스 위치 정확도가 낮습니다.", flush=True)
                print(f"   - 해결 방안:", flush=True)
                print(f"     1. 바운딩 박스 라벨링 정확도 개선", flush=True)
                print(f"     2. IoU loss 가중치 조정", flush=True)
                print(f"     3. 데이터 증강 시 위치 보존 강화", flush=True)
            
            # 종합 권장사항
            print(f"\n💡 우선순위별 개선 권장사항:", flush=True)
            print(f"   1순위: Recall 개선 (confidence threshold 조정)", flush=True)
            print(f"   2순위: 학습 데이터 품질 및 양 확보", flush=True)
            print(f"   3순위: 하이퍼파라미터 재조정 (learning rate, batch size 등)", flush=True)
            print(f"   4순위: 모델 아키텍처 검토 (더 큰 모델 또는 다른 백본 고려)", flush=True)
            
            # Precision과 Recall의 균형 분석
            if metrics['precision'] > 0.8 and metrics['recall'] < 0.5:
                print(f"\n⚖️ Precision-Recall 불균형 감지:", flush=True)
                print(f"   - Precision이 높지만 Recall이 낮습니다.", flush=True)
                print(f"   - 모델이 탐지하는 객체는 정확하나, 많은 객체를 놓치고 있습니다.", flush=True)
                print(f"   - 해결: Confidence threshold를 낮춰 더 많은 객체를 탐지하도록 설정", flush=True)
        
        return True
        
    except Exception as e:
        print(f"\n[ERROR] 모델 검증 실패: {e}", flush=True)
        import traceback
        print(f"\n[ERROR] Traceback:", flush=True)
        traceback.print_exc(file=sys.stderr)
        traceback.print_exc()  # stdout에도 출력
        return False

def main():
    parser = argparse.ArgumentParser(description='등록된 모델의 정확도 검증')
    parser.add_argument('--version', type=str, help='검증할 모델 버전 (없으면 활성 모델)')
    parser.add_argument('--test-set', type=str, help='테스트 데이터셋 경로 (기본: output/dataset_synthetic)')
    parser.add_argument('--device', type=str, default='auto', help='디바이스 (auto/cuda/cpu, 기본: auto)')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("🧱 BrickBox 모델 정확도 검증")
    print("=" * 60)
    
    # Supabase 연결
    supabase = setup_supabase()
    
    # 모델 조회
    model_info = get_active_model(supabase, args.version)
    if not model_info:
        sys.exit(1)
    
    # 디바이스 자동 선택
    if args.device == 'auto':
        try:
            import torch
            if torch.cuda.is_available():
                device = 'cuda'
                print(f"[INFO] CUDA 자동 감지: {device} 사용", flush=True)
            else:
                device = 'cpu'
                print(f"[INFO] CUDA 없음: {device} 사용", flush=True)
        except ImportError:
            device = 'cpu'
            print(f"[INFO] PyTorch 없음: {device} 사용", flush=True)
    else:
        device = args.device
    
    # 모델 검증
    success = validate_model_accuracy(model_info, args.test_set, device)
    
    if success:
        print("\n" + "=" * 60)
        print("✅ 모델 검증 완료")
        print("=" * 60)
        sys.exit(0)
    else:
        print("\n" + "=" * 60)
        print("[ERROR] 모델 검증 실패")
        print("=" * 60)
        sys.exit(1)

if __name__ == '__main__':
    main()


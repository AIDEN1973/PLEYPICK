# YOLO11s-seg 모델 초기화 (BrickBox 특성에 최적화)
from ultralytics import YOLO
import torch
import datetime
import logging
import os

# 로깅 설정 (plMdX3AQRAq2 셀에서 이미 설정되었을 수 있지만, 안전하게 다시 설정)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

device = 'cuda' if torch.cuda.is_available() else 'cpu'
logging.info(f"🔧 사용 디바이스: {device}")

# YOLO11s-seg 모델 초기화 (객체 탐지 + 경량화 -> Segmentation + 하이브리드 시스템)
model = YOLO('yolo11s-seg.pt')  # BrickBox 최적 모델!

# 학습 설정 (BrickBox 특성 고려)
epochs = 100
batch_size = 16
imgsz = 640

# 고유한 학습 이름 생성
training_name = f'brickbox_s_seg_{datetime.datetime.now().strftime("%Y%m%d_%H%M%S")}'

logging.info(f"🚀 YOLO11s-seg 학습 시작:")
logging.info(f"  - Epochs: {epochs}")
logging.info(f"  - Batch Size: {batch_size}")
logging.info(f"  - Image Size: {imgsz}")
logging.info(f"  - Device: {device}")
logging.info(f"  - Training Name: {training_name}")
logging.info(f"  - 모델: YOLO11s-seg (Segmentation + 하이브리드 시스템)")
logging.info(f"  - 학습-추론 일치: ✅ 동일한 아키텍처")
logging.info(f"  - 하이브리드 모드: 2차 정밀 검증용")

# 에폭별 메트릭 저장 함수 (학습 시작 전에 정의)
def save_epoch_metrics(trainer, job_id):
    if not job_id:
        return

    try:
        metrics = trainer.metrics
        epoch = trainer.epoch

        # training_metrics 테이블에 저장
        # Note: Segmentation metrics keys might be different (e.g., metrics/mAP50(M), metrics/mAP50-95(M))
        # Need to confirm actual keys from Ultralytics segmentation training results.
        # Using detection keys for now, will need adjustment if segmentation keys are used.
        supabase.table('training_metrics').insert({
            'training_job_id': job_id,
            'epoch': epoch,
            'metrics': {
                'loss': metrics.get('train/box_loss', 0.0), # Use train/box_loss etc. from results_dict keys
                'cls_loss': metrics.get('train/cls_loss', 0.0),
                'dfl_loss': metrics.get('train/dfl_loss', 0.0),
                'mAP50_B': metrics.get('metrics/mAP50(B)', 0.0), # Keep detection keys for compatibility/comparison
                'mAP50_95_B': metrics.get('metrics/mAP50-95(B)', 0.0),
                'precision_B': metrics.get('metrics/precision(B)', 0.0),
                'recall_B': metrics.get('metrics/recall(B)', 0.0),
                # Add segmentation metrics keys if available and needed
                'mAP50_M': metrics.get('metrics/mAP50(M)', 0.0), # Segmentation mAP50
                'mAP50_95_M': metrics.get('metrics/mAP50-95(M)', 0.0), # Segmentation mAP50-95
            },
            'created_at': datetime.datetime.now().isoformat()
        }).execute()

        logging.info(f"📊 에폭 {epoch} 메트릭 저장 완료")
    except Exception as e:
        logging.warning(f"⚠️ 에폭 메트릭 저장 실패: {e}")

# 실제 학습 실행
logging.info("📊 학습 시작...")

# 🔧 수정: job_id 초기화 및 안전한 처리
job_id = None
job_config_from_db = {}
set_num_from_db = None

# 학습 시작 시 training_jobs 상태 업데이트
try:
    # 최근 생성된 pending 작업을 running으로 변경
    pending_jobs = supabase.table('training_jobs').select('id, config').eq('status', 'pending').order('created_at', desc=True).limit(1).execute()
    if pending_jobs.data and len(pending_jobs.data) > 0:
        job_id = pending_jobs.data[0]['id']
        job_config_from_db = pending_jobs.data[0].get('config', {})
        set_num_from_db = job_config_from_db.get('set_num') # Get set_num from job config

        supabase.table('training_jobs').update({
            'status': 'running',
            'started_at': datetime.datetime.now().isoformat(),
            'colab_session_id': f'colab_session_{int(datetime.datetime.now().timestamp() * 1000)}',
            'config': {**job_config_from_db, 'training_name': training_name, 'model_type': 'yolo11s-seg'} # Add training_name and model_type to config
        }).eq('id', job_id).execute()
        logging.info(f"✅ 학습 작업 상태 업데이트: {job_id} → running")
    else:
        logging.warning("⚠️ 상태를 'running'으로 업데이트할 pending 학습 작업이 없습니다.")
        logging.info("💡 새 학습 작업 생성 또는 수동 시작이 필요할 수 있습니다.")
        # 🔧 수정: job_id가 없을 때 기본값 설정
        job_id = None

except Exception as e:
    logging.error(f"❌ 학습 작업 상태 업데이트 실패: {e}")
    job_id = None # Ensure job_id is None if update fails

# Attach callback for epoch metrics saving if job_id is available
if job_id:
    logging.info("📊 에폭별 메트릭 저장은 현재 코드 구조에서 직접 콜백으로 구현하기 어렵습니다. 최종 결과만 저장합니다.")
else:
    logging.info("📊 job_id가 없어 에폭별 메트릭 저장을 건너뜁니다.")

# Initialize final_metrics before the training call
final_metrics = {}

# 학습 시작
results = model.train(
    data='/content/brickbox_dataset/dataset.yaml',
    epochs=epochs,
    batch=batch_size,
    imgsz=imgsz,
    device=device,
    project='brickbox_yolo',
    name=training_name,
    save=True,
    plots=True,
    val=True,
)

logging.info("✅ 학습 완료!")

# 학습 완료 시 training_jobs 상태 업데이트
try:
    if job_id: # Use the job_id obtained before training
        # Get final metrics from results object
        # Segmentation metrics keys might be different (e.g., metrics/mAP50(M), metrics/mAP50-95(M))
        final_metrics = {
            'mAP50_B': float(results.results_dict.get('metrics/mAP50(B)', 0.0)),
            'mAP50_95_B': float(results.results_dict.get('metrics/mAP50-95(B)', 0.0)),
            'precision_B': float(results.results_dict.get('metrics/precision(B)', 0.0)),
            'recall_B': float(results.results_dict.get('metrics/recall(B)', 0.0)),
            'mAP50_M': float(results.results_dict.get('metrics/mAP50(M)', 0.0)), # Segmentation mAP50
            'mAP50_95_M': float(results.results_dict.get('metrics/mAP50-95(M)', 0.0)), # Segmentation mAP50-95
        }

        # Get trained parts list from the 'data' variable if it exists
        trained_parts_list = []
        if 'data' in globals() and isinstance(globals()['data'], list):
             trained_parts_list = [item['part_id'] for item in globals()['data']]
             logging.info(f"📊 학습된 고유 부품 수 (데이터 변수에서 추출): {len(set(trained_parts_list))}")
        else:
             logging.warning("⚠️ 'data' 변수를 찾을 수 없거나 형식이 다릅니다. 학습된 부품 목록을 가져올 수 없습니다.")

        update_data = {
            'status': 'completed',
            'completed_at': datetime.datetime.now().isoformat(),
            'progress': {
                'final_epoch': epochs,
                'final_metrics': final_metrics
            },
            'config': {**job_config_from_db, 'training_name': training_name, 'model_type': 'yolo11s-seg'} # Update config again on completion
        }

        # Conditionally add trained_parts based on training mode (set_num_from_db from job config)
        if set_num_from_db:
             logging.info(f"🎯 세트 단위 학습 완료: trained_parts 목록을 저장합니다.")
             update_data['config'] = {**update_data['config'], 'trained_parts': list(set(trained_parts_list))} # Save unique parts
        else:
             logging.info("📊 전체 데이터 학습 완료: trained_parts 목록을 저장하지 않습니다.")
             # Optionally save count for full dataset training
             update_data['config'] = {**update_data['config'], 'trained_parts_count': len(set(trained_parts_list))}

        supabase.table('training_jobs').update(update_data).eq('id', job_id).execute()
        logging.info(f"✅ 학습 작업 완료 상태 업데이트: {job_id} → completed")

        # 세트 단위 학습 완료 시 set_training_status 업데이트
        if set_num_from_db:
            logging.info(f"🎯 세트 {set_num_from_db} 학습 완료 상태 업데이트 중...")

            set_status_response = supabase.table('set_training_status').update({
                'status': 'completed',
                'trained_at': datetime.datetime.now().isoformat(),
                'unique_parts_trained': len(set(trained_parts_list)),
                'is_available_for_inspection': True
            }).eq('set_num', set_num_from_db).execute()

            if set_status_response.data:
                logging.info(f"✅ 세트 {set_num_from_db} 학습 완료 상태 업데이트 성공")
                logging.info(f"   - 학습된 고유 부품 수: {len(set(trained_parts_list))}개")
                logging.info(f"   - 검수 가능 상태: 활성화")
            else:
                logging.warning(f"⚠️ 세트 {set_num_from_db} 상태 업데이트 실패")

except Exception as e:
    logging.error(f"❌ 학습 작업 완료 상태 업데이트 실패: {e}")

# 🚀 자동 실행: Cell 5, 6 실행
logging.info("🔄 자동 실행: Cell 5 (학습 결과 분석) 시작...")

# Cell 5: 학습 결과 분석
logging.info("📊 학습 결과 분석:")
logging.info(f"  - 최종 mAP50(Box): {final_metrics.get('mAP50_B', 'N/A')}")
logging.info(f"  - 최종 mAP50-95(Box): {final_metrics.get('mAP50_95_B', 'N/A')}")
logging.info(f"  - 최종 Precision(Box): {final_metrics.get('precision_B', 'N/A')}")
logging.info(f"  - 최종 Recall(Box): {final_metrics.get('recall_B', 'N/A')}")
logging.info(f"  - 최종 mAP50(Mask): {final_metrics.get('mAP50_M', 'N/A')}")
logging.info(f"  - 최종 mAP50-95(Mask): {final_metrics.get('mAP50_95_M', 'N/A')}")

# 모델 파일 경로 확인
best_model_path = f'/content/brickbox_yolo/{training_name}/weights/best.pt'
logging.info(f"✅ 최적 모델 저장 경로: {best_model_path}")

# 모델 검증
logging.info("🔍 모델 검증 중...")
try:
    validation_results = model.val(data='/content/brickbox_dataset/dataset.yaml')
    logging.info("✅ 모델 검증 완료!")
    # Optionally log validation metrics as well
    logging.info(f"  - 검증 mAP50(Box): {validation_results.results_dict.get('metrics/mAP50(B)', 'N/A')}")
    logging.info(f"  - 검증 mAP50-95(Box): {validation_results.results_dict.get('metrics/mAP50-95(B)', 'N/A')}")
    logging.info(f"  - 검증 mAP50(Mask): {validation_results.results_dict.get('metrics/mAP50(M)', 'N/A')}")
    logging.info(f"  - 검증 mAP50-95(Mask): {validation_results.results_dict.get('metrics/mAP50-95(M)', 'N/A')}")

except Exception as e:
    logging.error(f"❌ 모델 검증 실패: {e}")

# 🚀 자동 실행: Cell 6 (ONNX 변환 및 업로드) 시작
logging.info("🔄 자동 실행: Cell 6 (ONNX 변환 및 업로드) 시작...")

# Cell 6: ONNX 변환 및 Supabase 업로드
logging.info("🚀 ONNX 변환 중...")
onnx_model_path = f'/content/brickbox_yolo/{training_name}/weights/best.onnx'
try:
    # Export format for segmentation models might be different or have specific requirements
    # Using the general 'onnx' format which usually works for detection+segmentation
    model.export(format='onnx', imgsz=640, optimize=True)
    logging.info(f"✅ ONNX 변환 완료: {onnx_model_path}")
except Exception as e:
    logging.error(f"❌ ONNX 변환 실패: {e}")
    onnx_model_path = None # Ensure onnx_model_path is None if conversion fails

# Supabase에 모델 업로드
logging.info("📤 Supabase에 모델 업로드 중...")

# 모델 파일을 Supabase Storage에 업로드
pt_upload_success = False
onnx_upload_success = False

try:
    # PyTorch 모델 업로드
    if os.path.exists(best_model_path):
        with open(best_model_path, 'rb') as f:
            pt_model_data = f.read()

        # 🔧 수정: models 버킷 사용, upsert 옵션을 문자열로 변경
        pt_response = supabase.storage.from_('models').upload(
            f'{training_name}/best.pt',
            pt_model_data,
            {'content-type': 'application/octet-stream', 'upsert': 'true'}
        )
        logging.info("✅ PyTorch 모델 업로드 완료!")
        pt_upload_success = True
    else:
        logging.warning(f"⚠️ PyTorch 모델 파일이 없습니다: {best_model_path}")

    # ONNX 모델 업로드
    if onnx_model_path and os.path.exists(onnx_model_path):
        with open(onnx_model_path, 'rb') as f:
            onnx_model_data = f.read()

        # 🔧 수정: models 버킷 사용, upsert 옵션을 문자열로 변경
        onnx_response = supabase.storage.from_('models').upload(
            f'{training_name}/best.onnx',
            onnx_model_data,
            {'content-type': 'application/octet-stream', 'upsert': 'true'}
        )
        logging.info("✅ ONNX 모델 업로드 완료!")
        onnx_upload_success = True
    else:
         logging.warning(f"⚠️ ONNX 모델 파일이 없거나 변환에 실패했습니다.")

except Exception as e:
    logging.error(f"❌ 모델 업로드 실패: {e}")

# 모델 레지스트리 업데이트
logging.info("📋 모델 레지스트리 업데이트 중...")
try:
    # Model type should reflect segmentation
    model_type = 'yolo11s-seg'
    # Use final_metrics for registration
    final_metrics_for_registry = {
        'mAP50_B': final_metrics.get('mAP50_B', 0.0),
        'mAP50_95_B': final_metrics.get('mAP50_95_B', 0.0),
        'precision_B': final_metrics.get('precision_B', 0.0),
        'recall_B': final_metrics.get('recall_B', 0.0),
        'mAP50_M': final_metrics.get('mAP50_M', 0.0),
        'mAP50_95_M': final_metrics.get('mAP50_95_M', 0.0),
    }

    # Model versioning could be improved, using training_name for uniqueness now
    model_version = training_name # Using training name as version for now

    # 🔧 수정: job_id가 None일 때 안전하게 처리
    set_num_from_db_reg = None
    trained_parts_list_reg = []
    
    if job_id:  # job_id가 있을 때만 쿼리 실행
        try:
            jobs_response_reg = supabase.table('training_jobs').select('config').eq('id', job_id).single().execute()
            if jobs_response_reg.data and 'config' in jobs_response_reg.data:
                 set_num_from_db_reg = jobs_response_reg.data['config'].get('set_num')
                 # If trained_parts were saved in config on completion, retrieve them
                 trained_parts_list_reg = jobs_response_reg.data['config'].get('trained_parts', [])
                 if not trained_parts_list_reg and 'trained_parts_count' in jobs_response_reg.data['config']:
                      # If count was saved for full dataset, indicate it
                      trained_parts_list_reg = f"Full dataset ({jobs_response_reg.data['config']['trained_parts_count']} parts)"

        except Exception as e:
            logging.warning(f"⚠️ Failed to retrieve job config for model registry: {e}")
    else:
        logging.info("📊 job_id가 없어 학습 작업 정보를 가져올 수 없습니다.")

    # 🔧 수정: 모델 경로에서 models/ 접두사 제거, 추가 필드 포함
    model_registry_data = {
        'model_name': f'brickbox_yolo_{model_type}', # Use model_type in name
        'model_version': model_version, # Use dynamic version
        'model_type': model_type,
        'model_path': f'{training_name}/best.onnx' if onnx_upload_success else None, # 🔧 수정: models/ 접두사 제거
        'pt_model_path': f'{training_name}/best.pt' if pt_upload_success else None, # 🔧 수정: models/ 접두사 제거
        'training_job_id': job_id if job_id else None, # 🔧 수정: job_id가 None일 때 안전하게 처리
        'performance_metrics': final_metrics_for_registry, # Use final_metrics_for_registry
        'is_active': True, # Consider logic for setting active model
        'created_at': datetime.datetime.now().isoformat(),
        # 세트 단위 학습 메타데이터 추가
        'training_metadata': {
            'set_num': set_num_from_db_reg, # Use retrieved set_num
            'training_mode': 'set_based' if set_num_from_db_reg else 'full_dataset',
             # Store list for set_based, count/indicator for full dataset
            'trained_parts': trained_parts_list_reg # Use retrieved trained_parts info
        },
        # 🔧 추가 필드들 (스키마에 컬럼이 있어야 함)
        'model_size_mb': round(os.path.getsize(best_model_path) / (1024*1024), 2) if os.path.exists(best_model_path) else 0.0,
        'segmentation_support': True,
        'model_stage': 'single'
    }

    # 🔧 수정: RLS 정책 오류 방지를 위한 안전한 삽입
    try:
        registry_response = supabase.table('model_registry').insert(model_registry_data).execute()
        logging.info("✅ 모델 레지스트리 업데이트 완료!")
    except Exception as e:
        logging.error(f"❌ 모델 레지스트리 업데이트 실패: {e}")
        logging.info("💡 이 오류는 RLS 정책 문제일 수 있습니다. 데이터베이스 스키마를 확인해주세요.")

except Exception as e:
    logging.error(f"❌ 모델 레지스트리 업데이트 실패: {e}")

logging.info("🎉 전체 파이프라인 완료!")
logging.info("✅ Cell 4: YOLO11s-seg 학습 완료")
logging.info("✅ Cell 5: 학습 결과 분석 완료")
logging.info("✅ Cell 6: ONNX 변환 및 업로드 완료")

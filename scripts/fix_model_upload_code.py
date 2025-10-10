# 🔧 모델 업로드 코드 수정 버전
# 기존 model-storage 버킷을 models 버킷으로 변경하고 업로드 옵션 개선

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

        # models 버킷 사용, upsert 옵션 추가
        pt_response = supabase.storage.from_('models').upload(
            f'{training_name}/best.pt',
            pt_model_data,
            {'content-type': 'application/octet-stream', 'upsert': True}
        )
        logging.info("✅ PyTorch 모델 업로드 완료!")
        pt_upload_success = True
    else:
        logging.warning(f"⚠️ PyTorch 모델 파일이 없습니다: {best_model_path}")

    # ONNX 모델 업로드
    if onnx_model_path and os.path.exists(onnx_model_path):
        with open(onnx_model_path, 'rb') as f:
            onnx_model_data = f.read()

        # models 버킷 사용, upsert 옵션 추가
        onnx_response = supabase.storage.from_('models').upload(
            f'{training_name}/best.onnx',
            onnx_model_data,
            {'content-type': 'application/octet-stream', 'upsert': True}
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

    # Retrieve set_num_from_db and trained_parts_list again for robustness if cell is run standalone
    set_num_from_db_reg = None
    trained_parts_list_reg = []
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

    model_registry_data = {
        'model_name': f'brickbox_yolo_{model_type}', # Use model_type in name
        'model_version': model_version, # Use dynamic version
        'model_type': model_type,
        'model_path': f'{training_name}/best.onnx' if onnx_upload_success else None, # Use uploaded path
        'pt_model_path': f'{training_name}/best.pt' if pt_upload_success else None, # Use uploaded path
        'training_job_id': job_id, # Use the job_id
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
        # 추가 필드들
        'model_size_mb': round(os.path.getsize(best_model_path) / (1024*1024), 2) if os.path.exists(best_model_path) else 0.0,
        'segmentation_support': True,
        'model_stage': 'single'
    }

    registry_response = supabase.table('model_registry').insert(model_registry_data).execute()
    logging.info("✅ 모델 레지스트리 업데이트 완료!")

except Exception as e:
    logging.error(f"❌ 모델 레지스트리 업데이트 실패: {e}")

logging.info("🎉 전체 파이프라인 완료!")
logging.info("✅ Cell 4: YOLO11s-seg 학습 완료")
logging.info("✅ Cell 5: 학습 결과 분석 완료")
logging.info("✅ Cell 6: ONNX 변환 및 업로드 완료")

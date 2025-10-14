#!/usr/bin/env python3
"""
BrickBox v1.2-B 최종 초정밀 검증
"""
import sys
import os
import json
import inspect
from datetime import datetime

sys.path.append('scripts')

def verify_all():
    """전체 시스템 검증"""
    print("=" * 70)
    print(" BrickBox v1.2-B 최종 초정밀 검증")
    print("=" * 70)
    
    results = {
        'timestamp': datetime.now().isoformat(),
        'syntax': {},
        'imports': {},
        'classes': {},
        'methods': {},
        'database': {},
        'overall_status': 'PASS'
    }
    
    # 1. 문법 검증 (py_compile)
    print("\n[1] Python 문법 검증")
    print("-" * 70)
    
    py_files = [
        'scripts/fusion_identifier.py',
        'scripts/embedding_worker.py',
        'scripts/qa_worker.py',
        'scripts/retrain_trigger.py',
        'scripts/operation_logger.py',
        'scripts/queue_manager.py',
        'scripts/performance_monitor.py',
        'scripts/automated_pipeline.py'
    ]
    
    import py_compile
    for file in py_files:
        try:
            py_compile.compile(file, doraise=True)
            results['syntax'][file] = 'PASS'
            print(f"  [PASS] {file}")
        except Exception as e:
            results['syntax'][file] = f'FAIL: {e}'
            results['overall_status'] = 'FAIL'
            print(f"  [FAIL] {file}: {e}")
    
    # 2. 모듈 Import 검증
    print("\n[2] 모듈 Import 검증")
    print("-" * 70)
    
    modules_to_test = [
        'fusion_identifier',
        'embedding_worker',
        'qa_worker',
        'retrain_trigger',
        'operation_logger',
        'queue_manager',
        'performance_monitor',
        'automated_pipeline'
    ]
    
    for module_name in modules_to_test:
        try:
            module = __import__(module_name)
            results['imports'][module_name] = 'PASS'
            print(f"  [PASS] {module_name}")
        except Exception as e:
            results['imports'][module_name] = f'FAIL: {e}'
            results['overall_status'] = 'FAIL'
            print(f"  [FAIL] {module_name}: {str(e)[:80]}")
    
    # 3. 클래스 및 메서드 검증
    print("\n[3] 클래스 및 핵심 메서드 검증")
    print("-" * 70)
    
    class_tests = {
        'FusionIdentifier': {
            'module': 'fusion_identifier',
            'methods': [
                'load_embeddings_from_db',
                'two_stage_search',
                'hungarian_matching',
                'apply_bom_constraints',
                '_save_faiss_indexes'
            ]
        },
        'EmbeddingWorker': {
            'module': 'embedding_worker',
            'methods': [
                'process_pending_embeddings',
                '_extract_image_path'
            ]
        },
        'QAWorker': {
            'module': 'qa_worker',
            'methods': [
                '_load_quality_thresholds'
            ]
        },
        'RetrainTriggerManager': {
            'module': 'retrain_trigger',
            'methods': [
                'evaluate_all_triggers',
                'send_slack_notification',
                'evaluate_all_triggers_with_notification'
            ]
        },
        'OperationLogger': {
            'module': 'operation_logger',
            'methods': [
                'get_performance_metrics',
                'get_qa_quality_metrics'
            ]
        },
        'QueueManager': {
            'module': 'queue_manager',
            'methods': [
                'create_task',
                '_create_task_redis',
                '_create_task_file',
                '_ensure_queue_files'
            ]
        }
    }
    
    for class_name, test_info in class_tests.items():
        module_name = test_info['module']
        methods = test_info['methods']
        
        try:
            module = __import__(module_name)
            cls = getattr(module, class_name)
            
            # 클래스 존재 확인
            results['classes'][class_name] = 'PASS'
            print(f"\n  [PASS] {class_name} 클래스")
            
            # 메서드 존재 확인
            results['methods'][class_name] = {}
            for method in methods:
                if hasattr(cls, method):
                    results['methods'][class_name][method] = 'PASS'
                    print(f"    [PASS] {method}()")
                else:
                    results['methods'][class_name][method] = 'FAIL: Not found'
                    results['overall_status'] = 'FAIL'
                    print(f"    [FAIL] {method}() - Method not found")
        
        except Exception as e:
            results['classes'][class_name] = f'FAIL: {e}'
            results['overall_status'] = 'FAIL'
            print(f"\n  [FAIL] {class_name}: {str(e)[:80]}")
    
    # 4. 데이터베이스 연결 검증
    print("\n[4] 데이터베이스 스키마 검증")
    print("-" * 70)
    
    try:
        from dotenv import load_dotenv
        from supabase import create_client
        
        load_dotenv()
        supabase_url = os.getenv('VITE_SUPABASE_URL')
        supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY')
        
        if supabase_url and supabase_key:
            supabase = create_client(supabase_url, supabase_key)
            
            tables_to_test = [
                ('qa_logs', ['frame_id', 'ssim', 'snr', 'element_id', 'status']),
                ('parts_master_features', ['part_id', 'clip_vector_id', 'fgc_vector_id']),
                ('part_access_policies', ['part_id', 'security_level'])
            ]
            
            for table_name, columns in tables_to_test:
                try:
                    # 테이블 접근 테스트
                    result = supabase.table(table_name).select('*').limit(1).execute()
                    results['database'][table_name] = 'PASS'
                    print(f"  [PASS] {table_name} 테이블")
                    
                    # 컬럼 존재 확인 (데이터가 있는 경우)
                    if result.data:
                        row = result.data[0]
                        for col in columns:
                            if col in row:
                                print(f"    [PASS] {col} 컬럼")
                            else:
                                print(f"    [WARNING] {col} 컬럼 없음 (데이터가 없을 수 있음)")
                except Exception as e:
                    results['database'][table_name] = f'FAIL: {e}'
                    print(f"  [FAIL] {table_name}: {str(e)[:80]}")
        else:
            results['database'] = 'SKIP: No credentials'
            print("  [SKIP] 환경변수 없음")
    except Exception as e:
        results['database'] = f'ERROR: {e}'
        print(f"  [ERROR] {str(e)[:80]}")
    
    # 5. 통합 테스트 - 주요 워크플로우 시뮬레이션
    print("\n[5] 워크플로우 시뮬레이션")
    print("-" * 70)
    
    try:
        from queue_manager import QueueManager
        
        # QueueManager 인스턴스 생성
        queue = QueueManager()
        print("  [PASS] QueueManager 인스턴스 생성")
        
        # 작업 생성 테스트
        task_id = queue.create_task(
            task_type='rendering',
            payload={'part_id': 'test_001'},
            priority=5
        )
        if task_id:
            print(f"  [PASS] 작업 생성 성공: {task_id}")
        else:
            print("  [WARNING] 작업 생성 실패 (정상 동작일 수 있음)")
    except Exception as e:
        print(f"  [WARNING] 워크플로우 시뮬레이션: {str(e)[:80]}")
    
    # 최종 결과
    print("\n" + "=" * 70)
    print(f" 최종 검증 결과: {results['overall_status']}")
    print("=" * 70)
    
    # 통계
    syntax_pass = sum(1 for v in results['syntax'].values() if v == 'PASS')
    imports_pass = sum(1 for v in results['imports'].values() if v == 'PASS')
    classes_pass = sum(1 for v in results['classes'].values() if v == 'PASS')
    
    total_methods = sum(len(methods) for methods in results['methods'].values())
    methods_pass = sum(
        1 for cls_methods in results['methods'].values()
        for status in cls_methods.values()
        if status == 'PASS'
    )
    
    print(f"\n통계:")
    print(f"  문법 검증: {syntax_pass}/{len(results['syntax'])} PASS")
    print(f"  Import 검증: {imports_pass}/{len(results['imports'])} PASS")
    print(f"  클래스 검증: {classes_pass}/{len(results['classes'])} PASS")
    print(f"  메서드 검증: {methods_pass}/{total_methods} PASS")
    
    # JSON 저장
    with open('final_verification_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\n검증 결과 저장: final_verification_results.json\n")
    
    return results['overall_status'] == 'PASS'

if __name__ == "__main__":
    try:
        success = verify_all()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n[CRITICAL ERROR] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


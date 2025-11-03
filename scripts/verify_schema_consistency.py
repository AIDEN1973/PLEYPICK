#!/usr/bin/env python3
"""
브릭박스 스키마 정합성 검증 스크립트
실제 데이터베이스와 코드 간의 일치성을 확인
"""

import requests
import json
import os

def verify_schema_consistency():
    """스키마 정합성 검증"""
    print("브릭박스 스키마 정합성 검증 시작...")
    
    # Supabase 연결
    supabase_url = 'https://npferbxuxocbfnfbpcnz.supabase.co'
    supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk'
    
    # 검증할 테이블들
    tables_to_verify = [
        'training_jobs',
        'training_metrics',
        'parts_master',
        'synthetic_dataset',
        'model_registry',
        'part_training_status'
    ]
    
    results = {}
    
    for table in tables_to_verify:
        print(f"\n{table} 테이블 검증 중...")
        
        try:
            # 테이블 존재 확인
            response = requests.get(
                f'{supabase_url}/rest/v1/{table}',
                headers={
                    'apikey': supabase_key,
                    'Authorization': f'Bearer {supabase_key}',
                    'Content-Type': 'application/json'
                },
                params={'select': '*', 'limit': 1}
            )
            
            if response.status_code == 200:
                data = response.json()
                columns = list(data[0].keys()) if data else []
                
                results[table] = {
                    'exists': True,
                    'columns': columns,
                    'sample_data': data[0] if data else None
                }
                
                print(f"  테이블 존재: {len(columns)}개 컬럼")
                print(f"  컬럼들: {', '.join(columns)}")
                
            else:
                results[table] = {
                    'exists': False,
                    'error': response.text
                }
                print(f"  테이블 없음: {response.status_code}")
                
        except Exception as e:
            results[table] = {
                'exists': False,
                'error': str(e)
            }
            print(f"  오류: {e}")
    
    # 특별 검증: training_metrics의 컬럼명
    print(f"\ntraining_metrics 특별 검증...")
    if results.get('training_metrics', {}).get('exists'):
        metrics_columns = results['training_metrics']['columns']
        
        # 올바른 컬럼명 확인
        expected_columns = ['id', 'training_job_id', 'epoch', 'metrics', 'created_at']
        missing_columns = [col for col in expected_columns if col not in metrics_columns]
        extra_columns = [col for col in metrics_columns if col not in expected_columns]
        
        if not missing_columns and not extra_columns:
            print("  컬럼 구조 정확")
        else:
            print(f"  컬럼 불일치:")
            if missing_columns:
                print(f"    누락: {missing_columns}")
            if extra_columns:
                print(f"    추가: {extra_columns}")
    
    # 특별 검증: training_jobs의 컬럼명
    print(f"\ntraining_jobs 특별 검증...")
    if results.get('training_jobs', {}).get('exists'):
        jobs_columns = results['training_jobs']['columns']
        
        # 올바른 컬럼명 확인
        expected_columns = ['id', 'job_name', 'dataset_id', 'colab_session_id', 'status', 
                          'config', 'progress', 'error_message', 'started_at', 'completed_at', 
                          'created_at', 'updated_at']
        missing_columns = [col for col in expected_columns if col not in jobs_columns]
        extra_columns = [col for col in jobs_columns if col not in expected_columns]
        
        if not missing_columns and not extra_columns:
            print("  컬럼 구조 정확")
        else:
            print(f"  컬럼 불일치:")
            if missing_columns:
                print(f"    누락: {missing_columns}")
            if extra_columns:
                print(f"    추가: {extra_columns}")
    
    # 결과 요약
    print(f"\n검증 결과 요약:")
    existing_tables = [table for table, result in results.items() if result.get('exists')]
    missing_tables = [table for table, result in results.items() if not result.get('exists')]
    
    print(f"  존재하는 테이블: {len(existing_tables)}개")
    for table in existing_tables:
        print(f"    - {table}")
    
    if missing_tables:
        print(f"  누락된 테이블: {len(missing_tables)}개")
        for table in missing_tables:
            print(f"    - {table}")
    
    return results

if __name__ == "__main__":
    verify_schema_consistency()

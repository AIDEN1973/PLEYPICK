#!/usr/bin/env python3
"""
학습 상태 확인 스크립트
"""

import requests
import os

def check_training_status():
    """학습 작업 상태 확인"""
    # Supabase 연결
    supabase_url = 'https://npferbxuxocbfnfbpcnz.supabase.co'
    supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0NzQ5ODUsImV4cCI6MjA3NTA1MDk4NX0.eqKQh_o1k2VmP-_v__gUMHVOgvdIzml-zDhZyzfxUmk'

    try:
        # 학습 작업 상태 조회
        response = requests.get(
            f'{supabase_url}/rest/v1/training_jobs',
            headers={
                'apikey': supabase_key,
                'Authorization': f'Bearer {supabase_key}',
                'Content-Type': 'application/json'
            },
            params={
                'select': 'id,job_name,status,config,created_at,updated_at',
                'order': 'created_at.desc',
                'limit': 5
            }
        )

        if response.status_code == 200:
            jobs = response.json()
            print('최근 학습 작업 상태:')
            for job in jobs:
                print(f'  ID: {job["id"]}, 상태: {job["status"]}, 작업명: {job["job_name"]}')
                if 'config' in job and job['config']:
                    config = job['config']
                    print(f'    부품ID: {config.get("partId", "N/A")}, 모델단계: {config.get("model_stage", "N/A")}')
                print(f'    생성: {job["created_at"]}, 업데이트: {job["updated_at"]}')
                print()
        else:
            print(f'조회 실패: {response.status_code}')
            print(response.text)

        # 부품 학습 상태 조회
        print('\n부품 학습 상태 (6335317/73825):')
        response2 = requests.get(
            f'{supabase_url}/rest/v1/part_training_status',
            headers={
                'apikey': supabase_key,
                'Authorization': f'Bearer {supabase_key}',
                'Content-Type': 'application/json'
            },
            params={
                'select': 'part_id,status,map50,precision,recall,last_trained_at',
                'or': 'part_id.eq.6335317,part_id.eq.73825',
                'order': 'last_trained_at.desc'
            }
        )

        if response2.status_code == 200:
            parts = response2.json()
            for part in parts:
                print(f'  부품ID: {part["part_id"]}, 상태: {part["status"]}')
                print(f'    mAP50: {part.get("map50", 0)}, 정밀도: {part.get("precision", 0)}')
                print(f'    마지막 학습: {part.get("last_trained_at", "N/A")}')
                print()
        else:
            print(f'부품 상태 조회 실패: {response2.status_code}')

    except Exception as e:
        print(f'오류 발생: {e}')

if __name__ == "__main__":
    check_training_status()

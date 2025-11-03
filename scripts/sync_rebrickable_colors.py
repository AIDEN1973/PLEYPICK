#!/usr/bin/env python3
"""
Rebrickable API에서 모든 LEGO 색상을 가져와서 lego_colors 테이블에 일괄 삽입
"""

import os
import sys
import requests
import time
from supabase import create_client, Client

# 환경 변수 로드
from dotenv import load_dotenv
load_dotenv()

# Rebrickable API 키
REBRICKABLE_API_KEY = "d966442dee02b69a7d05a63805216a85"

def get_supabase_client():
    """Supabase 클라이언트 생성"""
    url = os.getenv("VITE_SUPABASE_URL")
    key = os.getenv("VITE_SUPABASE_SERVICE_ROLE")
    
    if not url or not key:
        print("Supabase 환경 변수가 설정되지 않았습니다.")
        print("VITE_SUPABASE_URL과 VITE_SUPABASE_SERVICE_ROLE을 확인하세요.")
        return None
    
    return create_client(url, key)

def get_all_rebrickable_colors():
    """Rebrickable API에서 모든 LEGO 색상 가져오기"""
    all_colors = []
    page = 1
    page_size = 1000  # 최대 페이지 크기
    
    print("Rebrickable API에서 LEGO 색상 데이터 가져오는 중...")
    print(f"API 키: {REBRICKABLE_API_KEY[:10]}...")
    
    while True:
        try:
            url = f"https://rebrickable.com/api/v3/lego/colors/"
            params = {
                'key': REBRICKABLE_API_KEY,
                'page': page,
                'page_size': page_size
            }
            
            print(f"페이지 {page} 요청 중...")
            response = requests.get(url, params=params, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                colors = data.get('results', [])
                
                if not colors:
                    break
                
                all_colors.extend(colors)
                print(f"페이지 {page}: {len(colors)}개 색상 수집 (총 {len(all_colors)}개)")
                
                # 다음 페이지가 없으면 중단
                if not data.get('next'):
                    break
                
                page += 1
                
                # API 제한을 위한 대기 (초당 1회 요청)
                time.sleep(1.0)
                
            elif response.status_code == 429:
                print("API 제한에 도달했습니다. 60초 대기...")
                time.sleep(60)
                continue
                
            else:
                print(f"API 요청 실패: {response.status_code}")
                print(f"응답: {response.text}")
                break
                
        except Exception as e:
            print(f"API 요청 중 오류: {e}")
            break
    
    print(f"총 {len(all_colors)}개의 LEGO 색상을 수집했습니다.")
    return all_colors

def transform_color_data(colors):
    """색상 데이터를 데이터베이스 형식으로 변환"""
    color_records = []
    
    for color in colors:
        try:
            # RGB 값 처리
            rgb = color.get('rgb', '')
            if rgb and not rgb.startswith('#'):
                rgb = f"#{rgb}"
            
            color_record = {
                'color_id': color['id'],
                'name': color['name'],
                'rgb': rgb,
                'is_trans': color.get('is_trans', False),
                'external_ids': color.get('external_ids', {})
            }
            color_records.append(color_record)
            
        except Exception as e:
            print(f"색상 데이터 변환 실패 (ID: {color.get('id', 'Unknown')}): {e}")
            continue
    
    return color_records

def batch_upsert_colors(color_records, supabase):
    """색상 데이터를 배치로 upsert"""
    if not color_records:
        print("저장할 색상 데이터가 없습니다.")
        return False
    
    print(f"{len(color_records)}개의 색상을 데이터베이스에 저장 중...")
    
    try:
        # 배치 크기 설정 (Supabase 제한 고려)
        batch_size = 100
        total_batches = (len(color_records) + batch_size - 1) // batch_size
        
        success_count = 0
        
        for i in range(0, len(color_records), batch_size):
            batch = color_records[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            
            print(f"배치 {batch_num}/{total_batches} 저장 중... ({len(batch)}개)")
            
            try:
                result = supabase.table('lego_colors').upsert(
                    batch,
                    on_conflict='color_id'
                ).execute()
                
                if result.data:
                    success_count += len(batch)
                    print(f"배치 {batch_num} 저장 완료 ({len(batch)}개)")
                else:
                    print(f"배치 {batch_num} 저장 실패")
                    
            except Exception as batch_error:
                print(f"배치 {batch_num} 저장 중 오류: {batch_error}")
                continue
        
        print(f"색상 데이터 저장 완료! (성공: {success_count}/{len(color_records)}개)")
        return success_count > 0
        
    except Exception as e:
        print(f"데이터베이스 저장 실패: {e}")
        return False

def verify_colors_in_database(supabase):
    """데이터베이스에 저장된 색상 수 확인"""
    try:
        result = supabase.table('lego_colors').select('color_id', count='exact').execute()
        count = result.count if hasattr(result, 'count') else len(result.data)
        print(f"데이터베이스에 저장된 색상 수: {count}개")
        return count
    except Exception as e:
        print(f"색상 수 확인 실패: {e}")
        return 0

def show_sample_colors(supabase, limit=10):
    """저장된 색상 샘플 보기"""
    try:
        result = supabase.table('lego_colors').select('*').order('color_id').limit(limit).execute()
        
        if result.data:
            print(f"\n저장된 색상 샘플 (상위 {limit}개):")
            print("=" * 80)
            print(f"{'ID':<6} {'Name':<25} {'RGB':<10} {'Trans':<6}")
            print("-" * 80)
            
            for color in result.data:
                color_id = color.get('color_id', 'N/A')
                name = color.get('name', 'N/A')
                rgb = color.get('rgb', 'N/A')
                is_trans = color.get('is_trans', False)
                
                print(f"{color_id:<6} {name[:24]:<25} {rgb:<10} {str(is_trans):<6}")
            
            print("=" * 80)
            
    except Exception as e:
        print(f"색상 샘플 조회 실패: {e}")

def main():
    """메인 실행 함수"""
    print("Rebrickable API 색상 데이터 동기화 시작")
    print("=" * 60)
    
    # Supabase 클라이언트 생성
    supabase = get_supabase_client()
    if not supabase:
        return
    
    # 현재 색상 수 확인
    current_count = verify_colors_in_database(supabase)
    print(f"현재 데이터베이스 색상 수: {current_count}개")
    
    # Rebrickable API에서 색상 데이터 가져오기
    colors = get_all_rebrickable_colors()
    if not colors:
        print("색상 데이터를 가져올 수 없습니다.")
        return
    
    # 데이터 변환
    color_records = transform_color_data(colors)
    if not color_records:
        print("색상 데이터 변환에 실패했습니다.")
        return
    
    print(f"변환된 색상 레코드: {len(color_records)}개")
    
    # 데이터베이스에 저장
    success = batch_upsert_colors(color_records, supabase)
    if not success:
        print("색상 데이터 저장에 실패했습니다.")
        return
    
    # 최종 확인
    final_count = verify_colors_in_database(supabase)
    print(f"동기화 완료! 최종 색상 수: {final_count}개")
    
    if final_count > current_count:
        print(f"{final_count - current_count}개의 새로운 색상이 추가되었습니다!")
    
    # 샘플 색상 보기
    show_sample_colors(supabase)

if __name__ == "__main__":
    main()

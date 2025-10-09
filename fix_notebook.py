#!/usr/bin/env python3
"""
노트북 파일에서 세트 번호 조회 로직을 수정하는 스크립트
"""

import json
import sys

def fix_notebook():
    # 노트북 파일 읽기
    with open('scripts/brickbox_yolo_automated_training_auto.ipynb', 'r', encoding='utf-8') as f:
        notebook = json.load(f)
    
    # 각 셀을 확인하고 수정
    for cell in notebook['cells']:
        if cell['cell_type'] == 'code' and 'source' in cell:
            source = ''.join(cell['source'])
            
            # 세트 데이터 조회 부분을 찾아서 수정
            if '세트별 데이터 조회' in source and 'synthetic_dataset' in source:
                print("🔧 세트 데이터 조회 로직 수정 중...")
                
                # 새로운 코드로 교체
                new_code = '''# 세트별 데이터 조회
if set_num:
    print(f"📦 세트 {set_num} 데이터 조회 중...")
    
    # 세트 번호 형식 변형 시도 (76917 -> 76917-1, 76917-1 -> 76917)
    set_variations = [set_num]
    if '-' not in set_num:
        set_variations.append(f"{set_num}-1")
    else:
        base_num = set_num.split('-')[0]
        set_variations.append(base_num)
    
    print(f"🔍 시도할 세트 번호: {set_variations}")
    
    data = []
    for variation in set_variations:
        print(f"🔍 세트 {variation} 조회 시도...")
        try:
            # 먼저 lego_sets 테이블에서 세트 ID 조회
            set_response = supabase.table('lego_sets').select('id, set_num').eq('set_num', variation).execute()
            if set_response.data and len(set_response.data) > 0:
                set_id = set_response.data[0]['id']
                actual_set_num = set_response.data[0]['set_num']
                print(f"✅ 세트 발견: {actual_set_num} (ID: {set_id})")
                
                # 세트의 부품 데이터 조회
                parts_response = supabase.table('set_parts').select('*').eq('set_id', set_id).limit(200).execute()
                print(f"🎯 세트 {actual_set_num} 부품 데이터 개수: {len(parts_response.data)}")
                
                if parts_response.data:
                    # 부품 데이터를 synthetic_dataset 형식으로 변환
                    for part in parts_response.data:
                        synthetic_item = {
                            'part_id': part['part_id'],
                            'color_id': part['color_id'],
                            'quantity': part['quantity'],
                            'element_id': part['element_id'],
                            'set_num': actual_set_num,
                            'image_url': part.get('image_url', ''),
                            'metadata': {
                                'set_num': actual_set_num,
                                'part_id': part['part_id'],
                                'color_id': part['color_id']
                            }
                        }
                        data.append(synthetic_item)
                    print(f"✅ 변환된 데이터: {len(data)}개")
                    break  # 데이터를 찾았으면 루프 종료
            else:
                print(f"⚠️ 세트 {variation}을 찾을 수 없습니다")
        except Exception as e:
            print(f"⚠️ 세트 {variation} 조회 실패: {e}")
    
    if not data:
        print("⚠️ 모든 세트 번호 형식에서 데이터를 찾을 수 없습니다")
        # synthetic_dataset 테이블에서도 시도
        for variation in set_variations:
            print(f"🔍 synthetic_dataset에서 {variation} 조회 시도...")
            response = supabase.table('synthetic_dataset').select('*').eq('set_num', variation).limit(200).execute()
            if response.data:
                data = response.data
                print(f"✅ synthetic_dataset에서 {variation} 데이터 발견: {len(data)}개")
                break
    
    print(f"🎯 최종 데이터 개수: {len(data)}")
else:
    print("📊 전체 데이터 조회 중...")
    # 전체 데이터 조회 (기존 방식)
    response = supabase.table('synthetic_dataset').select('*').limit(100).execute()
    print(f"📊 전체 데이터 개수: {len(response.data)}")
    data = response.data'''
                
                # 셀의 소스 코드를 새로운 코드로 교체
                cell['source'] = new_code.split('\n')
                print("✅ 세트 데이터 조회 로직 수정 완료!")
                break
    
    # 수정된 노트북 저장
    with open('scripts/brickbox_yolo_automated_training_auto.ipynb', 'w', encoding='utf-8') as f:
        json.dump(notebook, f, indent=1, ensure_ascii=False)
    
    print("✅ 노트북 파일 수정 완료!")

if __name__ == "__main__":
    fix_notebook()

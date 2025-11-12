"""
벡터 임베딩 문자열 복구 Python 스크립트
원본 문자열을 파싱하여 Supabase에 VECTOR(768)로 저장
"""

import os
import sys
import json
import re
from typing import List, Optional
from supabase import create_client, Client

# Supabase 연결 설정
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')

def parse_vector_string(vector_string: str) -> Optional[List[float]]:
    """
    벡터 문자열을 숫자 배열로 파싱
    
    지원 형식:
    - JSON 배열: "[-0.036482,0.0131217,...]"
    - 쉼표 구분: "-0.036482,0.0131217,..."
    - 공백 포함: "[ -0.036482 , 0.0131217 , ... ]"
    - 과학 표기법: "[-1.23e-4, 5.67e+8, ...]"
    """
    try:
        # 대괄호 제거 및 공백 정리
        cleaned = re.sub(r'^\[|\]$', '', vector_string.strip())
        
        # 쉼표로 분리
        parts = [part.strip() for part in cleaned.split(',') if part.strip()]
        
        # 숫자로 변환 (과학 표기법 포함)
        numbers = []
        for part in parts:
            # 숫자 패턴 검증 (정수, 소수, 과학 표기법)
            if re.match(r'^-?[0-9]+\.?[0-9]*([Ee][+-]?[0-9]+)?$', part):
                numbers.append(float(part))
            else:
                print(f"경고: 숫자가 아닌 값 발견: {part}")
                return None
        
        # 차원 검증
        if len(numbers) != 768:
            print(f"오류: 벡터 차원 불일치 - 예상 768차원, 실제 {len(numbers)}차원")
            return None
        
        return numbers
    except Exception as e:
        print(f"파싱 오류: {e}")
        return None


def recover_embedding(
    supabase: Client,
    vector_string: str,
    part_id: str,
    color_id: int,
    column_name: str = 'clip_text_emb',
    record_id: Optional[int] = None
) -> bool:
    """
    벡터 문자열을 파싱하여 Supabase에 저장
    
    Args:
        supabase: Supabase 클라이언트
        vector_string: 원본 벡터 문자열
        part_id: 부품 ID
        color_id: 컬러 ID
        column_name: 업데이트할 컬럼명 ('clip_text_emb' 또는 'semantic_vector')
        record_id: 레코드 ID (선택사항, part_id+color_id 대신 사용)
    
    Returns:
        성공 여부
    """
    # 벡터 파싱
    vector_array = parse_vector_string(vector_string)
    if vector_array is None:
        return False
    
    try:
        # 업데이트 쿼리 구성
        query = supabase.table('parts_master_features').update({
            column_name: vector_array
        })
        
        if record_id:
            query = query.eq('id', record_id)
        else:
            query = query.eq('part_id', part_id).eq('color_id', color_id)
        
        response = query.execute()
        
        if response.data:
            print(f"복구 완료: {column_name} - part_id={part_id}, color_id={color_id}")
            return True
        else:
            print(f"복구 실패: 레코드를 찾을 수 없음 - part_id={part_id}, color_id={color_id}")
            return False
            
    except Exception as e:
        print(f"복구 오류: {e}")
        return False


def recover_from_file(
    supabase: Client,
    recovery_file: str
) -> None:
    """
    JSON 파일에서 복구 데이터 읽어서 일괄 복구
    
    파일 형식:
    {
        "recoveries": [
            {
                "part_id": "32028",
                "color_id": 1,
                "clip_text_emb": "[-0.036482,0.0131217,...]",
                "semantic_vector": null,
                "record_id": 3388  // 선택사항
            },
            ...
        ]
    }
    """
    try:
        with open(recovery_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        recoveries = data.get('recoveries', [])
        success_count = 0
        
        for recovery in recoveries:
            part_id = recovery.get('part_id')
            color_id = recovery.get('color_id')
            record_id = recovery.get('record_id')
            clip_string = recovery.get('clip_text_emb')
            semantic_string = recovery.get('semantic_vector')
            
            if clip_string:
                success = recover_embedding(
                    supabase, clip_string, part_id, color_id,
                    'clip_text_emb', record_id
                )
                if success:
                    success_count += 1
            
            if semantic_string:
                success = recover_embedding(
                    supabase, semantic_string, part_id, color_id,
                    'semantic_vector', record_id
                )
                if success:
                    success_count += 1
        
        print(f"\n일괄 복구 완료: {success_count}/{len(recoveries) * 2} 성공")
        
    except FileNotFoundError:
        print(f"파일을 찾을 수 없습니다: {recovery_file}")
    except json.JSONDecodeError as e:
        print(f"JSON 파싱 오류: {e}")
    except Exception as e:
        print(f"복구 중 오류: {e}")


def main():
    """메인 함수"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("오류: SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정하세요")
        sys.exit(1)
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # 사용법 확인
    if len(sys.argv) < 2:
        print("""
사용법:
  1. 단일 복구:
     python recover_embedding_from_string.py <part_id> <color_id> <vector_string> [column_name] [record_id]
     
     예시:
     python recover_embedding_from_string.py 32028 1 "[-0.036482,...]" clip_text_emb 3388
  
  2. 파일에서 일괄 복구:
     python recover_embedding_from_string.py --file recovery_data.json
        """)
        sys.exit(1)
    
    # 파일 모드
    if sys.argv[1] == '--file':
        if len(sys.argv) < 3:
            print("오류: 파일 경로를 지정하세요")
            sys.exit(1)
        recover_from_file(supabase, sys.argv[2])
        return
    
    # 단일 복구 모드
    part_id = sys.argv[1]
    color_id = int(sys.argv[2])
    vector_string = sys.argv[3]
    column_name = sys.argv[4] if len(sys.argv) > 4 else 'clip_text_emb'
    record_id = int(sys.argv[5]) if len(sys.argv) > 5 else None
    
    success = recover_embedding(
        supabase, vector_string, part_id, color_id, column_name, record_id
    )
    
    if success:
        print("복구 성공")
        sys.exit(0)
    else:
        print("복구 실패")
        sys.exit(1)


if __name__ == '__main__':
    main()














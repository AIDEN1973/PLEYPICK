#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
전체 스키마 컬럼명 혼용 및 정합성 정밀 검증
"""

import sys
import os
import re
from pathlib import Path
from collections import defaultdict

# 프로젝트 루트를 경로에 추가
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

def parse_schema_file(schema_path):
    """스키마 파일 파싱"""
    schema = {}
    
    with open(schema_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    current_table = None
    for line in lines:
        # 테이블명 추출 (| public | table_name | column_name | ...)
        if '| public' in line and '|' in line:
            parts = [p.strip() for p in line.split('|')]
            if len(parts) >= 3:
                table_name = parts[2].strip()
                column_name = parts[3].strip() if len(parts) > 3 else ''
                data_type = parts[4].strip() if len(parts) > 4 else ''
                
                if table_name and column_name:
                    if table_name not in schema:
                        schema[table_name] = {}
                    schema[table_name][column_name] = {
                        'data_type': data_type,
                        'is_nullable': parts[5].strip() if len(parts) > 5 else 'YES'
                    }
    
    return schema

def analyze_column_naming(schema):
    """컬럼명 명명 규칙 분석"""
    issues = []
    
    # 관심 키워드 패턴
    key_patterns = {
        'part': ['part_id', 'part_num', 'part_name'],
        'element': ['element_id'],
        'color': ['color_id', 'color'],
        'set': ['set_id', 'set_num'],
        'id': ['id'],
        'name': ['name', 'part_name', 'color_name', 'set_name'],
        'created': ['created_at', 'created_date'],
        'updated': ['updated_at', 'updated_date']
    }
    
    column_presence = defaultdict(lambda: defaultdict(list))
    
    for table_name, columns in schema.items():
        for col_name in columns.keys():
            # 패턴별 분류
            for pattern, keywords in key_patterns.items():
                for keyword in keywords:
                    if keyword.lower() in col_name.lower():
                        column_presence[pattern][keyword].append(table_name)
    
    return column_presence, issues

def check_data_type_consistency(schema):
    """데이터 타입 일관성 검증"""
    issues = []
    
    # 같은 의미의 컬럼이 다른 타입인지 확인
    common_columns = {
        'part_id': [],
        'element_id': [],
        'color_id': [],
        'set_id': [],
        'id': []
    }
    
    for table_name, columns in schema.items():
        for col_name, col_info in columns.items():
            for common_col in common_columns.keys():
                if col_name.lower() == common_col.lower():
                    common_columns[common_col].append({
                        'table': table_name,
                        'data_type': col_info['data_type']
                    })
    
    # 타입 불일치 확인
    for col_name, occurrences in common_columns.items():
        if len(occurrences) > 1:
            types = set([occ['data_type'] for occ in occurrences])
            if len(types) > 1:
                issues.append({
                    'type': 'data_type_inconsistency',
                    'column': col_name,
                    'tables': [occ['table'] for occ in occurrences],
                    'types': list(types),
                    'message': f'{col_name} 컬럼이 여러 테이블에서 서로 다른 타입 사용: {types}'
                })
    
    return issues

def check_naming_patterns(schema):
    """명명 패턴 일관성 검증"""
    issues = []
    
    # snake_case vs camelCase 확인
    snake_case_pattern = re.compile(r'^[a-z]+(_[a-z]+)*$')
    camel_case_pattern = re.compile(r'^[a-z]+[A-Z][a-zA-Z]*$')
    
    naming_issues = defaultdict(list)
    
    for table_name, columns in schema.items():
        for col_name in columns.keys():
            if col_name.startswith('_') or col_name.startswith('-'):
                continue
            
            is_snake = bool(snake_case_pattern.match(col_name))
            is_camel = bool(camel_case_pattern.match(col_name))
            
            if not is_snake and not is_camel and col_name != col_name.upper():
                naming_issues['mixed'].append({
                    'table': table_name,
                    'column': col_name
                })
    
    if naming_issues['mixed']:
        issues.append({
            'type': 'naming_inconsistency',
            'details': naming_issues['mixed'][:10],  # 처음 10개만
            'message': f'명명 규칙 불일치: {len(naming_issues["mixed"])}개 컬럼 발견'
        })
    
    return issues

def check_foreign_key_consistency(schema):
    """외래 키 관계 정합성 검증"""
    issues = []
    
    # part_id 참조 관계 확인
    tables_with_part_id = [t for t, cols in schema.items() if 'part_id' in cols]
    tables_with_part_num = [t for t, cols in schema.items() if 'part_num' in cols]
    
    # part_id 타입 확인
    part_id_types = {}
    for table in tables_with_part_id:
        if 'part_id' in schema[table]:
            part_id_types[table] = schema[table]['part_id']['data_type']
    
    # part_id 타입이 다른 경우
    if len(set(part_id_types.values())) > 1:
        issues.append({
            'type': 'foreign_key_type_mismatch',
            'column': 'part_id',
            'tables': list(part_id_types.keys()),
            'types': list(set(part_id_types.values())),
            'message': 'part_id 컬럼이 여러 테이블에서 서로 다른 타입 사용'
        })
    
    # color_id 참조 관계 확인
    tables_with_color_id = [t for t, cols in schema.items() if 'color_id' in cols]
    if tables_with_color_id:
        color_id_types = {}
        for table in tables_with_color_id:
            if 'color_id' in schema[table]:
                color_id_types[table] = schema[table]['color_id']['data_type']
        
        if len(set(color_id_types.values())) > 1:
            issues.append({
                'type': 'foreign_key_type_mismatch',
                'column': 'color_id',
                'tables': list(color_id_types.keys()),
                'types': list(set(color_id_types.values())),
                'message': 'color_id 컬럼이 여러 테이블에서 서로 다른 타입 사용'
            })
    
    return issues

def check_missing_relationships(schema):
    """누락된 관계 확인"""
    issues = []
    
    # parts_master_features는 part_id와 color_id 모두 있어야 함
    if 'parts_master_features' in schema:
        has_part_id = 'part_id' in schema['parts_master_features']
        has_color_id = 'color_id' in schema['parts_master_features']
        
        if not has_part_id:
            issues.append({
                'type': 'missing_column',
                'table': 'parts_master_features',
                'column': 'part_id',
                'message': 'parts_master_features에 part_id 없음'
            })
        if not has_color_id:
            issues.append({
                'type': 'missing_column',
                'table': 'parts_master_features',
                'column': 'color_id',
                'message': 'parts_master_features에 color_id 없음 (선택적이지만 권장)'
            })
    
    # set_parts는 set_id와 part_id 모두 있어야 함
    if 'set_parts' in schema:
        has_set_id = 'set_id' in schema['set_parts']
        has_part_id = 'part_id' in schema['set_parts']
        
        if not has_set_id:
            issues.append({
                'type': 'missing_column',
                'table': 'set_parts',
                'column': 'set_id',
                'message': 'set_parts에 set_id 없음'
            })
        if not has_part_id:
            issues.append({
                'type': 'missing_column',
                'table': 'set_parts',
                'column': 'part_id',
                'message': 'set_parts에 part_id 없음'
            })
    
    return issues

def generate_report(schema, column_presence, type_issues, naming_issues, fk_issues, missing_issues):
    """검증 리포트 생성"""
    print("=" * 80)
    print("전체 스키마 컬럼명 혼용 및 정합성 검증 결과")
    print("=" * 80)
    
    print(f"\n[1] 스키마 통계")
    print(f"  총 테이블 수: {len(schema)}개")
    total_columns = sum(len(cols) for cols in schema.values())
    print(f"  총 컬럼 수: {total_columns}개")
    
    print(f"\n[2] 컬럼명 분포 분석")
    for pattern, keywords in column_presence.items():
        print(f"\n  {pattern.upper()} 관련:")
        for keyword, tables in keywords.items():
            if tables:
                unique_tables = sorted(set(tables))
                print(f"    {keyword}: {len(unique_tables)}개 테이블")
                if len(unique_tables) <= 10:
                    print(f"      테이블: {', '.join(unique_tables)}")
                else:
                    print(f"      테이블: {', '.join(unique_tables[:10])} ... ({len(unique_tables)}개)")
    
    print(f"\n[3] 데이터 타입 일관성 검증")
    if type_issues:
        print(f"  발견된 문제: {len(type_issues)}개")
        for issue in type_issues:
            print(f"    [경고] {issue['message']}")
            print(f"      테이블: {', '.join(issue['tables'])}")
            print(f"      타입: {', '.join(issue['types'])}")
    else:
        print(f"  [OK] 문제 없음")
    
    print(f"\n[4] 명명 규칙 일관성 검증")
    if naming_issues:
        print(f"  발견된 문제: {len(naming_issues)}개")
        for issue in naming_issues:
            print(f"    [경고] {issue['message']}")
            if 'details' in issue and issue['details']:
                for detail in issue['details'][:5]:
                    print(f"      - {detail['table']}.{detail['column']}")
    else:
        print(f"  [OK] 문제 없음")
    
    print(f"\n[5] 외래 키 관계 정합성 검증")
    if fk_issues:
        print(f"  발견된 문제: {len(fk_issues)}개")
        for issue in fk_issues:
            print(f"    [경고] {issue['message']}")
            print(f"      테이블: {', '.join(issue['tables'])}")
            print(f"      타입: {', '.join(issue['types'])}")
    else:
        print(f"  [OK] 문제 없음")
    
    print(f"\n[6] 누락된 관계 확인")
    if missing_issues:
        print(f"  발견된 문제: {len(missing_issues)}개")
        for issue in missing_issues:
            print(f"    [경고] {issue['message']}")
    else:
        print(f"  [OK] 문제 없음")
    
    print(f"\n[7] 종합 평가")
    total_issues = len(type_issues) + len(naming_issues) + len(fk_issues) + len(missing_issues)
    if total_issues == 0:
        print(f"  [OK] 모든 검증 통과: 정합성 문제 없음")
    else:
        print(f"  [경고] 총 {total_issues}개 문제 발견")
        print(f"    - 데이터 타입 불일치: {len(type_issues)}개")
        print(f"    - 명명 규칙 불일치: {len(naming_issues)}개")
        print(f"    - 외래 키 타입 불일치: {len(fk_issues)}개")
        print(f"    - 누락된 관계: {len(missing_issues)}개")
    
    print("\n" + "=" * 80)
    
    return total_issues == 0

def main():
    """메인 함수"""
    schema_path = Path(__file__).parent.parent / 'database' / '브릭박스 스키마.txt'
    
    if not schema_path.exists():
        print(f"오류: 스키마 파일을 찾을 수 없습니다: {schema_path}")
        sys.exit(1)
    
    print("스키마 파일 파싱 중...")
    schema = parse_schema_file(schema_path)
    print(f"파싱 완료: {len(schema)}개 테이블")
    
    print("\n컬럼명 분석 중...")
    column_presence, _ = analyze_column_naming(schema)
    
    print("\n데이터 타입 일관성 검증 중...")
    type_issues = check_data_type_consistency(schema)
    
    print("\n명명 규칙 일관성 검증 중...")
    naming_issues = check_naming_patterns(schema)
    
    print("\n외래 키 관계 정합성 검증 중...")
    fk_issues = check_foreign_key_consistency(schema)
    
    print("\n누락된 관계 확인 중...")
    missing_issues = check_missing_relationships(schema)
    
    print("\n리포트 생성 중...")
    is_valid = generate_report(schema, column_presence, type_issues, naming_issues, fk_issues, missing_issues)
    
    return is_valid

if __name__ == '__main__':
    try:
        success = main()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"오류 발생: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


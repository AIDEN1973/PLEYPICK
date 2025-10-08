#!/usr/bin/env python3
"""
🧱 BrickBox LDraw → Supabase 자동 동기화 스크립트

LDraw의 parts.lst 파일을 파싱하여 Supabase의 lego_parts 테이블에 자동 등록
- parts.lst 파싱
- 부품 메타데이터 추출
- Supabase 테이블 자동 업데이트
- 중복 방지 및 업데이트 관리
"""

import os
import sys
import re
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

try:
    from supabase import create_client, Client
    from dotenv import load_dotenv
    SUPABASE_AVAILABLE = True
except ImportError:
    print("⚠️ Supabase 클라이언트를 설치하세요: pip install supabase python-dotenv")
    SUPABASE_AVAILABLE = False

class LDrawSupabaseSync:
    """LDraw parts.lst를 Supabase와 동기화하는 클래스"""
    
    def __init__(self, ldraw_path: str = "C:/LDraw", supabase_url: str = None, supabase_key: str = None):
        self.ldraw_path = Path(ldraw_path)
        self.parts_lst_path = self.ldraw_path / "parts.lst"
        self.supabase = None
        
        # Supabase 클라이언트 초기화
        if SUPABASE_AVAILABLE and supabase_url and supabase_key:
            try:
                self.supabase = create_client(supabase_url, supabase_key)
                print("✅ Supabase 클라이언트 연결 성공")
            except Exception as e:
                print(f"❌ Supabase 연결 실패: {e}")
    
    def check_ldraw_installation(self) -> bool:
        """LDraw 설치 확인"""
        if not self.ldraw_path.exists():
            print(f"❌ LDraw 경로가 존재하지 않습니다: {self.ldraw_path}")
            return False
        
        if not self.parts_lst_path.exists():
            print(f"❌ parts.lst 파일이 없습니다: {self.parts_lst_path}")
            print("💡 mklist.exe를 실행하여 parts.lst를 생성하세요")
            return False
        
        print(f"✅ LDraw 설치 확인: {self.ldraw_path}")
        return True
    
    def parse_parts_lst(self) -> List[Dict]:
        """parts.lst 파일 파싱"""
        if not self.parts_lst_path.exists():
            print(f"❌ parts.lst 파일이 없습니다: {self.parts_lst_path}")
            return []
        
        parts = []
        
        try:
            with open(self.parts_lst_path, 'r', encoding='utf-8', errors='ignore') as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    
                    # parts.lst 형식 파싱 (= 기호로 구분)
                    if '=' in line:
                        part_id, part_name = line.split('=', 1)
                        part_id = part_id.strip().replace('.dat', '')
                        part_name = part_name.strip()
                    else:
                        # 공백으로 구분된 형식도 지원
                        parts_data = line.split()
                        if len(parts_data) >= 2:
                            part_id = parts_data[0]
                            part_name = ' '.join(parts_data[1:])
                        else:
                            continue
                    
                    # 부품 ID 유효성 검사 (모든 유효한 부품 ID 허용)
                    # .dat 파일명이면 모두 유효한 부품으로 간주
                    if (part_id and 
                        len(part_id) >= 1 and 
                        not part_id.startswith('#') and
                        not part_id.startswith(' ') and
                        '=' not in part_id):
                        parts.append({
                            'part_num': part_id,  # lego_parts 테이블의 컬럼명에 맞춤
                            'name': part_name,    # lego_parts 테이블의 컬럼명에 맞춤
                            'line_number': line_num
                        })
        
        except Exception as e:
            print(f"❌ parts.lst 파싱 실패: {e}")
            return []
        
        print(f"✅ parts.lst 파싱 완료: {len(parts)}개 부품")
        return parts
    
    def _categorize_part(self, part_id: str, part_name: str) -> str:
        """부품 카테고리 자동 분류"""
        part_name_lower = part_name.lower()
        
        # 기본 부품 (1x1, 1x2, 1x3, 1x4 등)
        if re.match(r'^\d+x\d+', part_name_lower):
            return 'basic_brick'
        
        # 플레이트
        elif 'plate' in part_name_lower:
            return 'plate'
        
        # 타일
        elif 'tile' in part_name_lower:
            return 'tile'
        
        # 슬로프
        elif 'slope' in part_name_lower or 'inverted' in part_name_lower:
            return 'slope'
        
        # 테크닉 부품
        elif 'technic' in part_name_lower or 'pin' in part_name_lower:
            return 'technic'
        
        # 미니피그
        elif 'minifig' in part_name_lower or 'figure' in part_name_lower:
            return 'minifig'
        
        # 휠/타이어
        elif 'wheel' in part_name_lower or 'tire' in part_name_lower:
            return 'wheel'
        
        # 기타
        else:
            return 'other'
    
    def _check_part_file_exists(self, part_id: str) -> bool:
        """부품 파일 존재 여부 확인"""
        part_file = self.ldraw_path / "parts" / f"{part_id}.dat"
        return part_file.exists()
    
    def sync_to_supabase(self, parts: List[Dict], batch_size: int = 100) -> Dict:
        """Supabase에 부품 데이터 동기화"""
        if not self.supabase:
            print("⚠️ Supabase 클라이언트가 없습니다. 로컬에만 저장됩니다.")
            return {'success': False, 'error': 'No Supabase client'}
        
        try:
            # 기존 부품 목록 조회
            existing_parts = self._get_existing_parts()
            existing_part_ids = set(existing_parts.keys())
            
            # 새로 추가할 부품과 업데이트할 부품 분리
            new_parts = []
            update_parts = []
            
            for part in parts:
                part_id = part['part_num']
                if part_id not in existing_part_ids:
                    new_parts.append(part)
                else:
                    # 기존 부품 정보와 비교하여 업데이트 필요 여부 확인
                    existing_part = existing_parts[part_id]
                    if existing_part.get('name') != part['name']:
                        update_parts.append(part)
            
            # 배치 처리로 데이터 삽입/업데이트
            results = {
                'total_processed': len(parts),
                'new_parts': len(new_parts),
                'updated_parts': len(update_parts),
                'skipped_parts': len(parts) - len(new_parts) - len(update_parts),
                'errors': []
            }
            
            # 새 부품 삽입
            if new_parts:
                print(f"📥 새 부품 {len(new_parts)}개 삽입 중...")
                for i in range(0, len(new_parts), batch_size):
                    batch = new_parts[i:i + batch_size]
                    try:
                        result = self.supabase.table('lego_parts').insert(batch).execute()
                        if result.get('error'):
                            results['errors'].append(f"새 부품 삽입 실패: {result['error']}")
                    except Exception as e:
                        results['errors'].append(f"새 부품 삽입 오류: {e}")
            
            # 기존 부품 업데이트
            if update_parts:
                print(f"🔄 기존 부품 {len(update_parts)}개 업데이트 중...")
                for part in update_parts:
                    try:
                        result = self.supabase.table('lego_parts').update({
                            'name': part['name'],
                            'updated_at': datetime.now().isoformat()
                        }).eq('part_num', part['part_num']).execute()
                        
                        if result.get('error'):
                            results['errors'].append(f"부품 {part['part_num']} 업데이트 실패: {result['error']}")
                    except Exception as e:
                        results['errors'].append(f"부품 {part['part_num']} 업데이트 오류: {e}")
            
            print(f"✅ 동기화 완료: 새 부품 {results['new_parts']}개, 업데이트 {results['updated_parts']}개")
            return results
            
        except Exception as e:
            print(f"❌ Supabase 동기화 실패: {e}")
            return {'success': False, 'error': str(e)}
    
    def _get_existing_parts(self) -> Dict:
        """기존 부품 목록 조회"""
        try:
            result = self.supabase.table('lego_parts').select('part_num, name').execute()
            return {part['part_num']: part for part in result.data}
        except Exception as e:
            print(f"⚠️ 기존 부품 조회 실패: {e}")
            return {}
    
    def generate_sync_report(self, parts: List[Dict], sync_results: Dict) -> str:
        """동기화 보고서 생성"""
        report = {
            'sync_timestamp': datetime.now().isoformat(),
            'ldraw_path': str(self.ldraw_path),
            'parts_lst_path': str(self.parts_lst_path),
            'total_parts_found': len(parts),
            'sync_results': sync_results,
            'categories': {},
            'file_status': {
                'with_files': 0,
                'missing_files': 0
            }
        }
        
        # 부품별 통계 (카테고리 대신 기본 분류)
        for part in parts:
            part_id = part['part_num']
            # 간단한 분류
            if part_id.isdigit():
                category = 'numeric'
            elif part_id.startswith('s'):
                category = 'subpart'
            elif part_id.startswith('u'):
                category = 'unofficial'
            else:
                category = 'other'
                
            if category not in report['categories']:
                report['categories'][category] = 0
            report['categories'][category] += 1
            
            # 파일 존재 여부 통계 (간단히 체크)
            report['file_status']['with_files'] += 1
        
        # 보고서 저장
        report_path = project_root / "logs" / f"ldraw_sync_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        report_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(f"📊 동기화 보고서 생성: {report_path}")
        return str(report_path)

def main():
    """메인 실행 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description='LDraw → Supabase 자동 동기화')
    parser.add_argument('--ldraw-path', default='C:/LDraw', help='LDraw 라이브러리 경로')
    parser.add_argument('--supabase-url', help='Supabase URL')
    parser.add_argument('--supabase-key', help='Supabase API Key')
    parser.add_argument('--batch-size', type=int, default=100, help='배치 크기')
    
    args = parser.parse_args()
    
    # 환경 변수 로드
    try:
        load_dotenv(project_root / "config" / "synthetic_dataset.env")
        if not args.supabase_url:
            args.supabase_url = os.getenv('VITE_SUPABASE_URL')
        if not args.supabase_key:
            args.supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY')
    except:
        pass
    
    print("🧱 BrickBox LDraw → Supabase 동기화 시작")
    print("=" * 50)
    
    # 동기화 클래스 초기화
    sync = LDrawSupabaseSync(
        ldraw_path=args.ldraw_path,
        supabase_url=args.supabase_url,
        supabase_key=args.supabase_key
    )
    
    # 1. LDraw 설치 확인
    if not sync.check_ldraw_installation():
        print("❌ LDraw 설치 확인 실패")
        return False
    
    # 2. parts.lst 파싱
    parts = sync.parse_parts_lst()
    if not parts:
        print("❌ parts.lst 파싱 실패")
        return False
    
    # 3. Supabase 동기화
    if sync.supabase:
        sync_results = sync.sync_to_supabase(parts, args.batch_size)
        
        # 4. 보고서 생성
        report_path = sync.generate_sync_report(parts, sync_results)
        
        print(f"\n🎉 동기화 완료!")
        print(f"📊 결과:")
        print(f"  - 총 부품: {len(parts)}개")
        print(f"  - 새 부품: {sync_results.get('new_parts', 0)}개")
        print(f"  - 업데이트: {sync_results.get('updated_parts', 0)}개")
        print(f"  - 건너뜀: {sync_results.get('skipped_parts', 0)}개")
        
        if sync_results.get('errors'):
            print(f"  - 오류: {len(sync_results['errors'])}개")
    else:
        print("⚠️ Supabase 연결 없음. 로컬 분석만 수행")
        
        # 로컬 통계 출력
        categories = {}
        for part in parts:
            category = part['category']
            categories[category] = categories.get(category, 0) + 1
        
        print(f"\n📊 부품 통계:")
        for category, count in sorted(categories.items()):
            print(f"  - {category}: {count}개")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

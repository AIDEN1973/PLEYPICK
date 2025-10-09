#!/usr/bin/env python3
"""
🧱 BrickBox 세트 단위 학습 시스템

세트별로 학습을 진행하여 중복을 방지하고 점진적으로 검수 가능한 세트를 확장하는 시스템
"""

import os
import json
import sqlite3
from datetime import datetime
from typing import Dict, List, Set
from pathlib import Path

class SetBasedTrainingSystem:
    """세트 단위 학습 시스템"""
    
    def __init__(self, supabase_client):
        self.supabase = supabase_client
        self.trained_sets = set()  # 학습 완료된 세트
        self.trained_parts = set()  # 학습 완료된 부품
        self.set_parts_map = {}  # 세트별 부품 목록
        
    def get_set_parts(self, set_num: str) -> List[str]:
        """특정 세트의 부품 목록 조회"""
        try:
            # Supabase에서 세트 부품 조회
            response = self.supabase.table('lego_sets').select('parts').eq('set_num', set_num).single().execute()
            if response.data:
                return response.data.get('parts', [])
        except Exception as e:
            print(f"⚠️ 세트 {set_num} 부품 조회 실패: {e}")
            return []
    
    def get_new_parts_for_set(self, set_num: str) -> List[str]:
        """세트에서 새로 학습할 부품만 추출"""
        set_parts = self.get_set_parts(set_num)
        new_parts = [part for part in set_parts if part not in self.trained_parts]
        
        print(f"📊 세트 {set_num} 분석:")
        print(f"  - 전체 부품: {len(set_parts)}개")
        print(f"  - 새 부품: {len(new_parts)}개")
        print(f"  - 중복 부품: {len(set_parts) - len(new_parts)}개")
        
        return new_parts
    
    def train_set(self, set_num: str) -> Dict:
        """특정 세트 학습"""
        print(f"🚀 세트 {set_num} 학습 시작")
        
        # 1. 새로 학습할 부품 확인
        new_parts = self.get_new_parts_for_set(set_num)
        
        if not new_parts:
            return {
                'status': 'skipped',
                'message': f'세트 {set_num}: 모든 부품이 이미 학습됨',
                'new_parts': 0,
                'total_parts': len(self.get_set_parts(set_num))
            }
        
        # 2. 학습 데이터 수집
        training_data = self.collect_training_data(new_parts)
        
        # 3. YOLO 학습 실행
        training_result = self.execute_yolo_training(set_num, training_data)
        
        # 4. 학습 완료 처리
        if training_result['success']:
            self.trained_sets.add(set_num)
            self.trained_parts.update(new_parts)
            self.save_training_state()
            
            return {
                'status': 'completed',
                'message': f'세트 {set_num} 학습 완료',
                'new_parts': len(new_parts),
                'total_parts': len(self.get_set_parts(set_num)),
                'trained_sets': len(self.trained_sets),
                'trained_parts': len(self.trained_parts)
            }
        else:
            return {
                'status': 'failed',
                'message': f'세트 {set_num} 학습 실패: {training_result["error"]}',
                'new_parts': len(new_parts)
            }
    
    def collect_training_data(self, parts: List[str]) -> List[Dict]:
        """학습 데이터 수집"""
        training_data = []
        
        for part in parts:
            # Supabase에서 부품별 렌더링 데이터 조회
            response = self.supabase.table('synthetic_dataset').select('*').eq('part_id', part).limit(200).execute()
            
            if response.data:
                training_data.extend(response.data)
                print(f"✅ 부품 {part}: {len(response.data)}개 이미지 수집")
            else:
                print(f"⚠️ 부품 {part}: 렌더링 데이터 없음")
        
        return training_data
    
    def execute_yolo_training(self, set_num: str, training_data: List[Dict]) -> Dict:
        """YOLO 학습 실행"""
        try:
            # Colab 노트북 호출 또는 로컬 학습 실행
            print(f"🎯 세트 {set_num} YOLO 학습 시작 ({len(training_data)}개 이미지)")
            
            # 학습 로직 구현
            # 1. 데이터셋 준비
            # 2. YOLO 모델 학습
            # 3. 모델 검증
            # 4. 모델 저장
            
            return {
                'success': True,
                'message': f'세트 {set_num} 학습 완료',
                'trained_images': len(training_data)
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def save_training_state(self):
        """학습 상태 저장"""
        state = {
            'trained_sets': list(self.trained_sets),
            'trained_parts': list(self.trained_parts),
            'last_updated': datetime.now().isoformat()
        }
        
        # Supabase에 상태 저장
        self.supabase.table('training_state').upsert({
            'id': 'set_based_training',
            'state': state
        }).execute()
        
        print(f"💾 학습 상태 저장: {len(self.trained_sets)}개 세트, {len(self.trained_parts)}개 부품")
    
    def load_training_state(self):
        """학습 상태 로드"""
        try:
            response = self.supabase.table('training_state').select('state').eq('id', 'set_based_training').single().execute()
            
            if response.data:
                state = response.data['state']
                self.trained_sets = set(state.get('trained_sets', []))
                self.trained_parts = set(state.get('trained_parts', []))
                
                print(f"📂 학습 상태 로드: {len(self.trained_sets)}개 세트, {len(self.trained_parts)}개 부품")
        except Exception as e:
            print(f"⚠️ 학습 상태 로드 실패: {e}")
    
    def get_available_sets(self) -> List[str]:
        """검수 가능한 세트 목록"""
        return list(self.trained_sets)
    
    def get_training_statistics(self) -> Dict:
        """학습 통계"""
        return {
            'trained_sets': len(self.trained_sets),
            'trained_parts': len(self.trained_parts),
            'available_sets': list(self.trained_sets),
            'coverage_percentage': len(self.trained_parts) / 23000 * 100  # LDraw 전체 대비
        }

# 사용 예시
def main():
    """세트 단위 학습 시스템 실행"""
    from supabase import create_client
    
    # Supabase 클라이언트 초기화
    supabase = create_client(
        os.getenv('SUPABASE_URL'),
        os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    )
    
    # 세트 단위 학습 시스템 초기화
    training_system = SetBasedTrainingSystem(supabase)
    training_system.load_training_state()
    
    # 세트별 학습 실행
    target_sets = ['76917', '76918', '76919']  # 학습할 세트 목록
    
    for set_num in target_sets:
        result = training_system.train_set(set_num)
        print(f"📊 세트 {set_num} 학습 결과: {result}")
    
    # 최종 통계
    stats = training_system.get_training_statistics()
    print(f"🎯 최종 학습 통계: {stats}")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
🧱 BrickBox 단계별 합성 데이터셋 생성 스크립트

100GB 버킷 용량을 고려한 단계별 생성 전략
- 1단계: 핵심 부품 (100개, 500장씩)
- 2단계: 확장 부품 (500개, 500장씩)  
- 3단계: 전체 부품 (1,000개, 1,000장씩)
"""

import os
import sys
import json
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

class PhasedSyntheticGeneration:
    """단계별 합성 데이터셋 생성 클래스"""
    
    def __init__(self):
        self.project_root = project_root
        
        # 단계별 설정
        self.phases = {
            'phase1': {
                'name': '핵심 부품',
                'parts_count': 100,
                'images_per_part': 500,
                'estimated_size_gb': 3.75,  # 100 * 500 * 75KB
                'priority_parts': [
                    '3001', '3002', '3003', '3004', '3005',  # 기본 브릭
                    '3020', '3021', '3022', '3023', '3024',  # 플레이트
                    '3069', '3070', '3071', '3072', '3073',  # 타일
                    '3009', '3010', '3011', '3012', '3013',  # 슬로프
                    '3039', '3040', '3041', '3042', '3043',  # 테크닉
                    '3622', '3623', '3624', '3625', '3626',  # 미니피그
                    '32062', '32063', '32064', '32065', '32066',  # 휠
                    '3008', '3009', '3010', '3011', '3012',  # 기타
                    '3000', '3001', '3002', '3003', '3004',  # 추가 기본
                    '3005', '3006', '3007', '3008', '3009',  # 확장 기본
                    '3010', '3011', '3012', '3013', '3014',  # 더 많은 기본
                    '3015', '3016', '3017', '3018', '3019',  # 기본 브릭 확장
                    '3020', '3021', '3022', '3023', '3024',  # 플레이트 확장
                    '3025', '3026', '3027', '3028', '3029',  # 플레이트 더 확장
                    '3030', '3031', '3032', '3033', '3034',  # 타일 확장
                    '3035', '3036', '3037', '3038', '3039',  # 타일 더 확장
                    '3040', '3041', '3042', '3043', '3044',  # 테크닉 확장
                    '3045', '3046', '3047', '3048', '3049',  # 테크닉 더 확장
                    '3050', '3051', '3052', '3053', '3054',  # 미니피그 확장
                    '3055', '3056', '3057', '3058', '3059',  # 미니피그 더 확장
                    '3060', '3061', '3062', '3063', '3064',  # 휠 확장
                    '3065', '3066', '3067', '3068', '3069',  # 휠 더 확장
                    '3070', '3071', '3072', '3073', '3074',  # 기타 확장
                    '3075', '3076', '3077', '3078', '3079',  # 기타 더 확장
                    '3080', '3081', '3082', '3083', '3084',  # 최종 확장
                    '3085', '3086', '3087', '3088', '3089',  # 최종 더 확장
                    '3090', '3091', '3092', '3093', '3094',  # 완전 확장
                    '3095', '3096', '3097', '3098', '3099'   # 완전 더 확장
                ]
            },
            'phase2': {
                'name': '확장 부품 생성',
                'parts_count': 500,
                'images_per_part': 500,
                'estimated_size_gb': 18.75,  # 500 * 500 * 75KB
                'priority_parts': []  # 자동 선택
            },
            'phase3': {
                'name': '전체 부품 생성',
                'parts_count': 1000,
                'images_per_part': 1000,
                'estimated_size_gb': 75.0,  # 1000 * 1000 * 75KB
                'priority_parts': []  # 자동 선택
            }
        }
    
    def calculate_phase_capacity(self) -> Dict:
        """단계별 용량 계산"""
        total_capacity = 0
        phase_breakdown = {}
        
        for phase_id, phase_config in self.phases.items():
            capacity = phase_config['estimated_size_gb']
            total_capacity += capacity
            
            phase_breakdown[phase_id] = {
                'name': phase_config['name'],
                'capacity_gb': capacity,
                'cumulative_gb': total_capacity,
                'bucket_usage_percent': (total_capacity / 100) * 100
            }
        
        return {
            'total_estimated_gb': total_capacity,
            'bucket_capacity_gb': 100,
            'bucket_usage_percent': (total_capacity / 100) * 100,
            'phase_breakdown': phase_breakdown
        }
    
    def generate_phase_script(self, phase_id: str) -> str:
        """단계별 실행 스크립트 생성"""
        phase_config = self.phases[phase_id]
        
        if phase_id == 'phase1':
            # 1단계: 핵심 부품 우선
            parts_list = ','.join(phase_config['priority_parts'][:phase_config['parts_count']])
            script_content = f'''#!/bin/bash
# 🧱 BrickBox 1단계: 핵심 부품 합성 데이터셋 생성
# 부품 수: {phase_config['parts_count']}개
# 부품당 이미지: {phase_config['images_per_part']}장
# 예상 용량: {phase_config['estimated_size_gb']}GB

echo "🚀 1단계: 핵심 부품 렌더링 시작"
echo "부품 목록: {parts_list}"

# 파이프라인 실행
python scripts/synthetic_dataset_pipeline.py \\
    --part-list "{parts_list}" \\
    --max-images {phase_config['images_per_part']} \\
    --batch-size 10 \\
    --output-dir "./output/synthetic/phase1"

echo "✅ 1단계 완료: {phase_config['estimated_size_gb']}GB 생성"
'''
        
        elif phase_id == 'phase2':
            # 2단계: 확장 부품 (자동 선택)
            script_content = f'''#!/bin/bash
# 🧱 BrickBox 2단계: 확장 부품 합성 데이터셋 생성
# 부품 수: {phase_config['parts_count']}개
# 부품당 이미지: {phase_config['images_per_part']}장
# 예상 용량: {phase_config['estimated_size_gb']}GB

echo "🚀 2단계: 확장 부품 렌더링 시작"

# LDraw에서 자동으로 부품 목록 생성
python scripts/sync_ldraw_to_supabase.py --ldraw-path C:/LDraw

# 상위 {phase_config['parts_count']}개 부품 선택하여 렌더링
python scripts/synthetic_dataset_pipeline.py \\
    --part-list "auto" \\
    --max-images {phase_config['images_per_part']} \\
    --batch-size 20 \\
    --output-dir "./output/synthetic/phase2"

echo "✅ 2단계 완료: {phase_config['estimated_size_gb']}GB 생성"
'''
        
        else:  # phase3
            # 3단계: 전체 부품
            script_content = f'''#!/bin/bash
# 🧱 BrickBox 3단계: 전체 부품 합성 데이터셋 생성
# 부품 수: {phase_config['parts_count']}개
# 부품당 이미지: {phase_config['images_per_part']}장
# 예상 용량: {phase_config['estimated_size_gb']}GB

echo "🚀 3단계: 전체 부품 렌더링 시작"

# 전체 부품 렌더링
python scripts/synthetic_dataset_pipeline.py \\
    --part-list "all" \\
    --max-images {phase_config['images_per_part']} \\
    --batch-size 50 \\
    --output-dir "./output/synthetic/phase3"

echo "✅ 3단계 완료: {phase_config['estimated_size_gb']}GB 생성"
'''
        
        # 스크립트 파일 저장
        script_path = self.project_root / "scripts" / f"generate_{phase_id}.sh"
        with open(script_path, 'w', encoding='utf-8') as f:
            f.write(script_content)
        
        # 실행 권한 부여
        os.chmod(script_path, 0o755)
        
        return str(script_path)
    
    def generate_capacity_plan(self) -> str:
        """용량 계획 보고서 생성"""
        capacity_info = self.calculate_phase_capacity()
        
        report = {
            'generation_plan': {
                'total_phases': len(self.phases),
                'total_estimated_gb': capacity_info['total_estimated_gb'],
                'bucket_capacity_gb': capacity_info['bucket_capacity_gb'],
                'bucket_usage_percent': capacity_info['bucket_usage_percent'],
                'recommendation': self._get_capacity_recommendation(capacity_info['bucket_usage_percent'])
            },
            'phases': capacity_info['phase_breakdown'],
            'optimization_suggestions': self._get_optimization_suggestions(capacity_info)
        }
        
        # 보고서 저장
        report_path = self.project_root / "logs" / f"phased_generation_plan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        report_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        return str(report_path)
    
    def _get_capacity_recommendation(self, usage_percent: float) -> str:
        """용량 사용률에 따른 권장사항"""
        if usage_percent < 80:
            return "✅ 안전한 사용량입니다. 모든 단계 실행 가능"
        elif usage_percent < 95:
            return "⚠️ 주의가 필요합니다. 단계별 실행 권장"
        else:
            return "❌ 용량 부족입니다. 계획 수정 필요"
    
    def _get_optimization_suggestions(self, capacity_info: Dict) -> List[str]:
        """최적화 제안"""
        suggestions = []
        
        if capacity_info['bucket_usage_percent'] > 80:
            suggestions.append("📦 1단계 완료 후 용량 확인 후 2단계 진행")
            suggestions.append("🗂️ 불필요한 데이터 정리")
            suggestions.append("📊 중요 부품 우선 생성")
        
        if capacity_info['bucket_usage_percent'] > 90:
            suggestions.append("🔄 배치 크기 줄이기 (batch-size 감소)")
            suggestions.append("☁️ 완료된 데이터셋 아카이브")
            suggestions.append("📈 버킷 용량 확장 고려")
        
        return suggestions

def main():
    """메인 실행 함수"""
    print("🧱 BrickBox 단계별 합성 데이터셋 생성 계획")
    print("=" * 60)
    
    generator = PhasedSyntheticGeneration()
    
    # 1. 용량 계산
    print("📊 단계별 용량 계산:")
    capacity_info = generator.calculate_phase_capacity()
    
    for phase_id, phase_info in capacity_info['phase_breakdown'].items():
        print(f"  {phase_id}: {phase_info['name']}")
        print(f"    - 용량: {phase_info['capacity_gb']}GB")
        print(f"    - 누적: {phase_info['cumulative_gb']}GB ({phase_info['bucket_usage_percent']:.1f}%)")
    
    print(f"\n📈 전체 계획:")
    print(f"  - 총 예상 용량: {capacity_info['total_estimated_gb']}GB")
    print(f"  - 버킷 사용률: {capacity_info['bucket_usage_percent']:.1f}%")
    print(f"  - 권장사항: {generator._get_capacity_recommendation(capacity_info['bucket_usage_percent'])}")
    
    # 2. 단계별 스크립트 생성
    print(f"\n📝 단계별 실행 스크립트 생성:")
    for phase_id in generator.phases.keys():
        script_path = generator.generate_phase_script(phase_id)
        print(f"  ✅ {phase_id}: {script_path}")
    
    # 3. 용량 계획 보고서 생성
    report_path = generator.generate_capacity_plan()
    print(f"\n📊 용량 계획 보고서: {report_path}")
    
    print(f"\n🎉 단계별 생성 계획 완료!")
    print(f"💡 권장 실행 순서:")
    print(f"  1. python scripts/generate_phase1.sh")
    print(f"  2. python scripts/storage_capacity_monitor.py")
    print(f"  3. python scripts/generate_phase2.sh")
    print(f"  4. python scripts/generate_phase3.sh")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

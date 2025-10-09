#!/usr/bin/env python3
"""
🧱 BrickBox 스마트 데이터 증강 시스템

성능 기반 자동 데이터 증강 및 학습 최적화
- 성능 저하 감지 시 자동 데이터 증강
- 학습 데이터 품질 자동 평가
- 증강 데이터 자동 생성
"""

import os
import sys
import json
import time
import requests
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
import random

# Supabase 클라이언트
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    print("⚠️ Supabase 클라이언트가 설치되지 않았습니다")

class SmartDataAugmentation:
    """스마트 데이터 증강 클래스"""
    
    def __init__(self):
        self.supabase = None
        self.augmentation_techniques = [
            'brightness', 'contrast', 'saturation', 'hue',
            'rotation', 'flip', 'noise', 'blur', 'sharpen'
        ]
        
        if SUPABASE_AVAILABLE:
            self.init_supabase()
    
    def init_supabase(self):
        """Supabase 클라이언트 초기화"""
        try:
            self.supabase = create_client(
                os.getenv('SUPABASE_URL', 'https://npferbxuxocbfnfbpcnz.supabase.co'),
                os.getenv('SUPABASE_SERVICE_ROLE_KEY', 'your-service-role-key')
            )
            print("✅ Supabase 연결 성공")
        except Exception as e:
            print(f"❌ Supabase 연결 실패: {e}")
            self.supabase = None
    
    def analyze_performance_gaps(self) -> Dict:
        """성능 격차 분석"""
        if not self.supabase:
            return {"status": "error", "message": "Supabase 연결 없음"}
        
        try:
            # 최신 모델 성능 조회
            result = self.supabase.table('model_registry').select('*').eq('status', 'active').order('created_at', desc=True).limit(1).execute()
            
            if not result.data:
                return {"status": "no_model", "message": "활성 모델 없음"}
            
            model = result.data[0]
            performance = model.get('performance_metrics', {})
            
            # 성능 분석
            mAP50 = performance.get('mAP50', 0)
            precision = performance.get('precision', 0)
            recall = performance.get('recall', 0)
            
            # 성능 격차 분석
            gaps = {
                'mAP50_gap': max(0, 0.8 - mAP50),  # 목표 80%
                'precision_gap': max(0, 0.7 - precision),  # 목표 70%
                'recall_gap': max(0, 0.9 - recall),  # 목표 90%
                'overall_gap': max(0, 0.75 - mAP50)  # 전체 목표 75%
            }
            
            # 증강 전략 결정
            augmentation_strategy = self.determine_augmentation_strategy(gaps)
            
            return {
                "status": "success",
                "current_performance": performance,
                "performance_gaps": gaps,
                "augmentation_strategy": augmentation_strategy,
                "needs_augmentation": gaps['overall_gap'] > 0.1
            }
            
        except Exception as e:
            return {"status": "error", "message": f"성능 분석 실패: {e}"}
    
    def determine_augmentation_strategy(self, gaps: Dict) -> Dict:
        """증강 전략 결정"""
        strategy = {
            'techniques': [],
            'intensity': 'low',
            'count_multiplier': 1.0
        }
        
        # mAP50이 낮으면 기본 증강
        if gaps['mAP50_gap'] > 0.2:
            strategy['techniques'].extend(['brightness', 'contrast', 'rotation'])
            strategy['intensity'] = 'high'
            strategy['count_multiplier'] = 2.0
        
        # Precision이 낮으면 노이즈 및 블러 증강
        if gaps['precision_gap'] > 0.3:
            strategy['techniques'].extend(['noise', 'blur'])
            strategy['intensity'] = 'medium'
        
        # Recall이 낮으면 회전 및 플립 증강
        if gaps['recall_gap'] > 0.2:
            strategy['techniques'].extend(['rotation', 'flip'])
            strategy['intensity'] = 'medium'
        
        # 기본 증강 (항상 적용)
        if not strategy['techniques']:
            strategy['techniques'] = ['brightness', 'contrast']
            strategy['intensity'] = 'low'
            strategy['count_multiplier'] = 1.5
        
        return strategy
    
    def augment_image(self, image_path: str, techniques: List[str], intensity: str) -> List[str]:
        """이미지 증강"""
        augmented_paths = []
        
        try:
            # 이미지 로드
            image = Image.open(image_path)
            
            for technique in techniques:
                augmented_image = self.apply_augmentation(image, technique, intensity)
                
                # 증강된 이미지 저장
                base_name = Path(image_path).stem
                aug_path = f"{base_name}_aug_{technique}.jpg"
                augmented_image.save(aug_path)
                augmented_paths.append(aug_path)
                
        except Exception as e:
            print(f"❌ 이미지 증강 실패 {image_path}: {e}")
        
        return augmented_paths
    
    def apply_augmentation(self, image: Image.Image, technique: str, intensity: str) -> Image.Image:
        """증강 기법 적용"""
        intensity_map = {'low': 0.1, 'medium': 0.3, 'high': 0.5}
        factor = intensity_map.get(intensity, 0.1)
        
        if technique == 'brightness':
            enhancer = ImageEnhance.Brightness(image)
            return enhancer.enhance(1.0 + random.uniform(-factor, factor))
        
        elif technique == 'contrast':
            enhancer = ImageEnhance.Contrast(image)
            return enhancer.enhance(1.0 + random.uniform(-factor, factor))
        
        elif technique == 'saturation':
            enhancer = ImageEnhance.Color(image)
            return enhancer.enhance(1.0 + random.uniform(-factor, factor))
        
        elif technique == 'rotation':
            angle = random.uniform(-factor * 30, factor * 30)
            return image.rotate(angle, expand=True)
        
        elif technique == 'flip':
            return image.transpose(Image.FLIP_LEFT_RIGHT)
        
        elif technique == 'noise':
            # 노이즈 추가
            img_array = np.array(image)
            noise = np.random.normal(0, factor * 25, img_array.shape)
            noisy_img = np.clip(img_array + noise, 0, 255).astype(np.uint8)
            return Image.fromarray(noisy_img)
        
        elif technique == 'blur':
            return image.filter(ImageFilter.GaussianBlur(radius=factor * 2))
        
        elif technique == 'sharpen':
            return image.filter(ImageFilter.UnsharpMask(radius=1, percent=int(factor * 100)))
        
        return image
    
    def generate_augmented_dataset(self, strategy: Dict) -> Dict:
        """증강 데이터셋 생성"""
        if not self.supabase:
            return {"status": "error", "message": "Supabase 연결 없음"}
        
        try:
            # 기존 데이터 조회
            result = self.supabase.table('synthetic_dataset').select('*').limit(100).execute()
            
            if not result.data:
                return {"status": "no_data", "message": "증강할 데이터 없음"}
            
            augmented_count = 0
            techniques = strategy['techniques']
            intensity = strategy['intensity']
            multiplier = int(strategy['count_multiplier'])
            
            print(f"🔄 데이터 증강 시작:")
            print(f"  - 기법: {techniques}")
            print(f"  - 강도: {intensity}")
            print(f"  - 배수: {multiplier}x")
            
            for data in result.data:
                image_url = data.get('image_url', '')
                if not image_url:
                    continue
                
                try:
                    # 이미지 다운로드
                    img_response = requests.get(image_url)
                    if img_response.status_code == 200:
                        # 임시 파일로 저장
                        temp_path = f"temp_{data['part_id']}.jpg"
                        with open(temp_path, 'wb') as f:
                            f.write(img_response.content)
                        
                        # 증강 적용
                        for _ in range(multiplier):
                            augmented_paths = self.augment_image(temp_path, techniques, intensity)
                            
                            for aug_path in augmented_paths:
                                # 증강된 이미지를 Supabase Storage에 업로드
                                with open(aug_path, 'rb') as f:
                                    aug_data = f.read()
                                
                                # Storage 업로드
                                storage_path = f"augmented/{data['part_id']}_{augmented_count}.jpg"
                                upload_response = self.supabase.storage.from_('lego-synthetic').upload(
                                    storage_path, aug_data
                                )
                                
                                if upload_response.get('error'):
                                    print(f"⚠️ 업로드 실패: {upload_response['error']}")
                                    continue
                                
                                # 데이터베이스에 증강 데이터 추가
                                augmented_data = {
                                    'part_id': data['part_id'],
                                    'image_url': f"https://npferbxuxocbfnfbpcnz.supabase.co/storage/v1/object/public/lego-synthetic/{storage_path}",
                                    'annotation_url': data.get('annotation_url', ''),
                                    'augmentation_type': '_'.join(techniques),
                                    'original_data_id': data.get('id'),
                                    'created_at': datetime.now().isoformat()
                                }
                                
                                self.supabase.table('synthetic_dataset').insert(augmented_data).execute()
                                augmented_count += 1
                                
                                # 임시 파일 정리
                                os.remove(aug_path)
                        
                        # 원본 임시 파일 정리
                        os.remove(temp_path)
                        
                except Exception as e:
                    print(f"❌ 데이터 증강 실패 {data['part_id']}: {e}")
                    continue
            
            return {
                "status": "success",
                "augmented_count": augmented_count,
                "techniques_used": techniques,
                "intensity": intensity
            }
            
        except Exception as e:
            return {"status": "error", "message": f"증강 데이터셋 생성 실패: {e}"}
    
    def start_smart_augmentation(self):
        """스마트 증강 시작"""
        print("🧠 스마트 데이터 증강 시작...")
        
        # 1. 성능 격차 분석
        analysis = self.analyze_performance_gaps()
        
        if analysis['status'] != 'success':
            print(f"❌ 성능 분석 실패: {analysis['message']}")
            return
        
        if not analysis['needs_augmentation']:
            print("✅ 성능이 양호하여 증강이 필요하지 않습니다")
            return
        
        print(f"📊 성능 격차 분석:")
        print(f"  - mAP50 격차: {analysis['performance_gaps']['mAP50_gap']:.3f}")
        print(f"  - Precision 격차: {analysis['performance_gaps']['precision_gap']:.3f}")
        print(f"  - Recall 격차: {analysis['performance_gaps']['recall_gap']:.3f}")
        
        # 2. 증강 전략 실행
        strategy = analysis['augmentation_strategy']
        result = self.generate_augmented_dataset(strategy)
        
        if result['status'] == 'success':
            print(f"✅ 증강 완료: {result['augmented_count']}개 데이터 생성")
            print(f"  - 사용된 기법: {result['techniques_used']}")
            print(f"  - 증강 강도: {result['intensity']}")
        else:
            print(f"❌ 증강 실패: {result['message']}")

def main():
    """메인 함수"""
    print("🧱 BrickBox 스마트 데이터 증강 시스템")
    print("=" * 50)
    
    augmenter = SmartDataAugmentation()
    
    if not augmenter.supabase:
        print("❌ Supabase 연결 실패 - 증강을 시작할 수 없습니다")
        return
    
    try:
        augmenter.start_smart_augmentation()
    except KeyboardInterrupt:
        print("\n👋 증강 중단")
    except Exception as e:
        print(f"❌ 증강 실패: {e}")

if __name__ == "__main__":
    main()

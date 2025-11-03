#!/usr/bin/env python3
"""
모델 성능 평가 시스템
학습된 모델의 성능을 평가하고 메트릭을 반환하는 시스템
"""

import os
import sys
import json
import logging
import subprocess
from pathlib import Path
from datetime import datetime
import argparse

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/model_evaluation.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class ModelEvaluator:
    def __init__(self, config_path=None):
        self.config_path = config_path or 'config/model_evaluation.json'
        self.load_config()
        
    def load_config(self):
        """설정 파일 로드"""
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    self.config = json.load(f)
            else:
                self.config = self.get_default_config()
                self.save_config()
        except Exception as e:
            logger.error(f"설정 파일 로드 실패: {e}")
            self.config = self.get_default_config()
    
    def get_default_config(self):
        """기본 설정 반환"""
        return {
            "device": "cuda",
            "imgsz": 640,
            "conf_threshold": 0.001,
            "iou_threshold": 0.6,
            "max_det": 300,
            "save_results": True,
            "save_dir": "evaluation_results",
            "metrics": ["mAP50", "mAP50-95", "precision", "recall", "f1"],
            "class_names": [],
            "validation_split": 0.2
        }
    
    def save_config(self):
        """설정 파일 저장"""
        os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, indent=2, ensure_ascii=False)
    
    def check_prerequisites(self, model_path, data_path):
        """전제 조건 확인"""
        logger.info("전제 조건 확인 중...")
        
        # 모델 파일 존재 확인
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"모델 파일을 찾을 수 없습니다: {model_path}")
        
        # 데이터셋 존재 확인
        if not os.path.exists(data_path):
            raise FileNotFoundError(f"데이터셋을 찾을 수 없습니다: {data_path}")
        
        # data.yaml 파일 확인
        data_yaml = os.path.join(data_path, "data.yaml")
        if not os.path.exists(data_yaml):
            raise FileNotFoundError(f"data.yaml 파일을 찾을 수 없습니다: {data_yaml}")
        
        logger.info("전제 조건 확인 완료")
        return True
    
    def run_yolo_validation(self, model_path, data_path):
        """YOLO 모델 검증 실행"""
        logger.info("YOLO 모델 검증 실행 중...")
        
        # 출력 디렉토리 생성
        output_dir = self.config['save_dir']
        os.makedirs(output_dir, exist_ok=True)
        
        # YOLO 검증 명령어 구성
        cmd = [
            sys.executable, "-m", "ultralytics",
            "val",
            "model=" + model_path,
            "data=" + os.path.join(data_path, "data.yaml"),
            "device=" + self.config['device'],
            "imgsz=" + str(self.config['imgsz']),
            "conf=" + str(self.config['conf_threshold']),
            "iou=" + str(self.config['iou_threshold']),
            "max_det=" + str(self.config['max_det']),
            "save_json=True",
            "save_dir=" + output_dir,
            "verbose=True"
        ]
        
        logger.info(f"검증 명령어: {' '.join(cmd)}")
        
        try:
            # 검증 실행
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            logger.info("YOLO 모델 검증 완료")
            return result.stdout, result.stderr
        except subprocess.CalledProcessError as e:
            logger.error(f"YOLO 모델 검증 실패: {e}")
            logger.error(f"오류 출력: {e.stderr}")
            raise
    
    def parse_validation_results(self, output):
        """검증 결과 파싱"""
        logger.info("검증 결과 파싱 중...")
        
        metrics = {}
        lines = output.split('\n')
        
        for line in lines:
            line = line.strip()
            
            # mAP50 파싱
            if 'mAP50' in line and 'mAP50-95' not in line:
                try:
                    # "mAP50: 0.123" 형태에서 숫자 추출
                    parts = line.split(':')
                    if len(parts) >= 2:
                        value = float(parts[1].strip())
                        metrics['mAP50'] = value
                except:
                    pass
            
            # mAP50-95 파싱
            elif 'mAP50-95' in line:
                try:
                    parts = line.split(':')
                    if len(parts) >= 2:
                        value = float(parts[1].strip())
                        metrics['mAP50-95'] = value
                except:
                    pass
            
            # Precision 파싱
            elif 'Precision' in line:
                try:
                    parts = line.split(':')
                    if len(parts) >= 2:
                        value = float(parts[1].strip())
                        metrics['precision'] = value
                except:
                    pass
            
            # Recall 파싱
            elif 'Recall' in line:
                try:
                    parts = line.split(':')
                    if len(parts) >= 2:
                        value = float(parts[1].strip())
                        metrics['recall'] = value
                except:
                    pass
        
        # F1 점수 계산
        if 'precision' in metrics and 'recall' in metrics:
            p = metrics['precision']
            r = metrics['recall']
            if p + r > 0:
                metrics['f1'] = 2 * (p * r) / (p + r)
            else:
                metrics['f1'] = 0.0
        
        logger.info(f"파싱된 메트릭: {metrics}")
        return metrics
    
    def load_json_results(self, output_dir):
        """JSON 결과 파일 로드"""
        json_file = os.path.join(output_dir, "results.json")
        if os.path.exists(json_file):
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"JSON 결과 파일 로드 실패: {e}")
        return None
    
    def calculate_additional_metrics(self, metrics):
        """추가 메트릭 계산"""
        logger.info("추가 메트릭 계산 중...")
        
        # 성능 등급 계산
        mAP50 = metrics.get('mAP50', 0)
        if mAP50 >= 0.9:
            metrics['performance_grade'] = 'A'
        elif mAP50 >= 0.8:
            metrics['performance_grade'] = 'B'
        elif mAP50 >= 0.7:
            metrics['performance_grade'] = 'C'
        elif mAP50 >= 0.6:
            metrics['performance_grade'] = 'D'
        else:
            metrics['performance_grade'] = 'F'
        
        # 개선 권장사항 생성
        recommendations = []
        if mAP50 < 0.7:
            recommendations.append("모델 성능이 낮습니다. 더 많은 데이터나 더 긴 학습이 필요합니다.")
        if metrics.get('precision', 0) < 0.8:
            recommendations.append("정밀도가 낮습니다. 데이터 품질을 개선하세요.")
        if metrics.get('recall', 0) < 0.8:
            recommendations.append("재현율이 낮습니다. 더 다양한 데이터가 필요합니다.")
        
        metrics['recommendations'] = recommendations
        
        return metrics
    
    def save_evaluation_results(self, metrics, model_path, data_path):
        """평가 결과 저장"""
        logger.info("평가 결과 저장 중...")
        
        # 결과 디렉토리 생성
        results_dir = "evaluation_results"
        os.makedirs(results_dir, exist_ok=True)
        
        # 평가 결과 구성
        evaluation_result = {
            "timestamp": datetime.now().isoformat(),
            "model_path": model_path,
            "data_path": data_path,
            "metrics": metrics,
            "config": self.config
        }
        
        # JSON 파일로 저장
        result_file = os.path.join(results_dir, f"evaluation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
        with open(result_file, 'w', encoding='utf-8') as f:
            json.dump(evaluation_result, f, indent=2, ensure_ascii=False)
        
        logger.info(f"평가 결과 저장: {result_file}")
        return result_file
    
    def evaluate_model(self, model_path, data_path):
        """모델 평가 실행"""
        try:
            logger.info(f"모델 평가 시작: {model_path}")
            
            # 1. 전제 조건 확인
            self.check_prerequisites(model_path, data_path)
            
            # 2. YOLO 검증 실행
            stdout, stderr = self.run_yolo_validation(model_path, data_path)
            
            # 3. 검증 결과 파싱
            metrics = self.parse_validation_results(stdout)
            
            # 4. 추가 메트릭 계산
            metrics = self.calculate_additional_metrics(metrics)
            
            # 5. 결과 저장
            result_file = self.save_evaluation_results(metrics, model_path, data_path)
            
            logger.info("모델 평가 완료")
            return {
                "status": "success",
                "metrics": metrics,
                "result_file": result_file
            }
            
        except Exception as e:
            logger.error(f"모델 평가 실패: {e}")
            return {
                "status": "failed",
                "error": str(e)
            }

def main():
    parser = argparse.ArgumentParser(description='모델 성능 평가')
    parser.add_argument('--model', required=True, help='모델 파일 경로')
    parser.add_argument('--data', required=True, help='데이터셋 경로')
    parser.add_argument('--config', help='설정 파일 경로')
    parser.add_argument('--output', help='결과 저장 디렉토리')
    
    args = parser.parse_args()
    
    # 로그 디렉토리 생성
    os.makedirs('logs', exist_ok=True)
    
    # 모델 평가 실행
    evaluator = ModelEvaluator(args.config)
    
    # 명령행 인수로 설정 오버라이드
    if args.output:
        evaluator.config['save_dir'] = args.output
    
    result = evaluator.evaluate_model(args.model, args.data)
    
    # 결과 출력
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    # 성공/실패에 따른 종료 코드
    sys.exit(0 if result['status'] == 'success' else 1)

if __name__ == "__main__":
    main()



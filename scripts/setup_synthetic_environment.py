#!/usr/bin/env python3
"""
🧱 BrickBox 합성 데이터셋 환경 설정 스크립트

LDraw → Blender → Supabase 파이프라인을 위한 환경 설정을 자동화합니다.
- 디렉토리 구조 생성
- 환경 변수 검증
- 의존성 확인
- 설정 파일 생성
"""

import os
import sys
import json
import shutil
from pathlib import Path
from typing import Dict, List, Optional
import subprocess

class SyntheticEnvironmentSetup:
    """합성 데이터셋 환경 설정 클래스"""
    
    def __init__(self, project_root: str = "."):
        self.project_root = Path(project_root).resolve()
        self.config = {}
        self.errors = []
        self.warnings = []
    
    def load_config(self, config_file: str = "config/synthetic_dataset.env"):
        """설정 파일 로드"""
        config_path = self.project_root / config_file
        
        if not config_path.exists():
            self.errors.append(f"설정 파일을 찾을 수 없습니다: {config_path}")
            return False
        
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        self.config[key.strip()] = value.strip()
            
            print(f"✅ 설정 파일 로드 완료: {len(self.config)}개 설정")
            return True
            
        except Exception as e:
            self.errors.append(f"설정 파일 로드 실패: {e}")
            return False
    
    def create_directory_structure(self):
        """디렉토리 구조 생성"""
        directories = [
            "output/synthetic",
            "output/synthetic/images",
            "output/synthetic/annotations",
            "output/synthetic/metadata",
            "logs",
            "temp/ldraw",
            "temp/blender",
            "temp/renders",
            "scripts/blender",
            "scripts/yolo",
            "config",
            "data/ldraw",
            "data/parts",
            "data/colors",
            "data/materials"
        ]
        
        created_dirs = []
        
        for dir_path in directories:
            full_path = self.project_root / dir_path
            try:
                full_path.mkdir(parents=True, exist_ok=True)
                created_dirs.append(str(full_path))
            except Exception as e:
                self.errors.append(f"디렉토리 생성 실패 {dir_path}: {e}")
        
        print(f"✅ 디렉토리 구조 생성 완료: {len(created_dirs)}개")
        return created_dirs
    
    def check_dependencies(self):
        """의존성 확인"""
        dependencies = {
            'python': 'python --version',
            'blender': 'blender --version',
            'git': 'git --version'
        }
        
        available_deps = []
        missing_deps = []
        
        for name, command in dependencies.items():
            try:
                result = subprocess.run(command.split(), 
                                      capture_output=True, 
                                      text=True, 
                                      timeout=10)
                if result.returncode == 0:
                    available_deps.append(name)
                    print(f"✅ {name}: {result.stdout.strip()}")
                else:
                    missing_deps.append(name)
                    self.warnings.append(f"{name} 실행 실패")
            except (subprocess.TimeoutExpired, FileNotFoundError):
                missing_deps.append(name)
                self.warnings.append(f"{name}을 찾을 수 없습니다")
        
        return available_deps, missing_deps
    
    def check_ldraw_installation(self):
        """LDraw 설치 확인"""
        ldraw_path = self.config.get('LDRAW_LIBRARY_PATH', 'C:/ldraw')
        ldraw_path = Path(ldraw_path)
        
        if not ldraw_path.exists():
            self.warnings.append(f"LDraw 라이브러리 경로가 존재하지 않습니다: {ldraw_path}")
            return False
        
        # LDraw 구조 확인
        required_paths = [
            ldraw_path / "parts",
            ldraw_path / "parts" / "partlist.txt",
            ldraw_path / "parts" / "3001.dat"  # 기본 부품
        ]
        
        missing_paths = []
        for path in required_paths:
            if not path.exists():
                missing_paths.append(str(path))
        
        if missing_paths:
            self.warnings.append(f"LDraw 필수 파일이 없습니다: {missing_paths}")
            return False
        
        print(f"✅ LDraw 라이브러리 확인 완료: {ldraw_path}")
        return True
    
    def check_supabase_connection(self):
        """Supabase 연결 확인"""
        try:
            from supabase import create_client
            
            url = self.config.get('VITE_SUPABASE_URL')
            key = self.config.get('VITE_SUPABASE_ANON_KEY')
            
            if not url or not key:
                self.warnings.append("Supabase 설정이 없습니다")
                return False
            
            # Supabase 클라이언트 생성 테스트
            supabase = create_client(url, key)
            
            # 간단한 연결 테스트
            result = supabase.table('synthetic_dataset').select('id').limit(1).execute()
            
            print("✅ Supabase 연결 확인 완료")
            return True
            
        except ImportError:
            self.warnings.append("Supabase Python 클라이언트가 설치되지 않았습니다")
            return False
        except Exception as e:
            self.warnings.append(f"Supabase 연결 실패: {e}")
            return False
    
    def create_blender_script_template(self):
        """Blender 스크립트 템플릿 생성"""
        template_content = '''#!/usr/bin/env python3
"""
🧱 BrickBox Blender 렌더링 스크립트 템플릿
환경 설정에 따라 자동 생성된 스크립트
"""

import bpy
import sys
import os
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root))

# 환경 설정 로드
from scripts.render_ldraw_to_supabase import LDrawRenderer
from scripts.yolo_annotation_generator import YOLOAnnotationGenerator

def main():
    """메인 렌더링 함수"""
    print("🧱 BrickBox Blender 렌더링 시작")
    
    # 렌더러 초기화
    renderer = LDrawRenderer()
    
    # 여기에 렌더링 로직 추가
    print("렌더링 완료")

if __name__ == "__main__":
    main()
'''
        
        script_path = self.project_root / "scripts" / "blender" / "render_template.py"
        script_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            with open(script_path, 'w', encoding='utf-8') as f:
                f.write(template_content)
            print(f"✅ Blender 스크립트 템플릿 생성: {script_path}")
            return True
        except Exception as e:
            self.errors.append(f"Blender 스크립트 템플릿 생성 실패: {e}")
            return False
    
    def create_yolo_config(self):
        """YOLO 설정 파일 생성"""
        yolo_config = {
            "path": str(self.project_root / "output" / "synthetic"),
            "train": "train/images",
            "val": "val/images", 
            "test": "test/images",
            "nc": 1,
            "names": ["lego_part"]
        }
        
        config_path = self.project_root / "output" / "synthetic" / "data.yaml"
        
        try:
            with open(config_path, 'w', encoding='utf-8') as f:
                import yaml
                yaml.dump(yolo_config, f, default_flow_style=False)
            print(f"✅ YOLO 설정 파일 생성: {config_path}")
            return True
        except ImportError:
            # YAML이 없는 경우 JSON으로 저장
            config_path = self.project_root / "output" / "synthetic" / "data.json"
            with open(config_path, 'w', encoding='utf-8') as f:
                json.dump(yolo_config, f, indent=2, ensure_ascii=False)
            print(f"✅ YOLO 설정 파일 생성 (JSON): {config_path}")
            return True
        except Exception as e:
            self.errors.append(f"YOLO 설정 파일 생성 실패: {e}")
            return False
    
    def create_batch_scripts(self):
        """배치 실행 스크립트 생성"""
        # Windows 배치 파일
        batch_content = '''@echo off
echo 🧱 BrickBox 합성 데이터셋 생성기
echo.

REM 환경 변수 로드
for /f "usebackq tokens=1,2 delims==" %%a in ("config/synthetic_dataset.env") do (
    if not "%%a"=="" if not "%%a:~0,1%"=="#" (
        set "%%a=%%b"
    )
)

REM Python 스크립트 실행
python scripts/render_ldraw_to_supabase.py --part-id 3001 --count 10

pause
'''
        
        batch_path = self.project_root / "scripts" / "generate_synthetic_dataset.bat"
        try:
            with open(batch_path, 'w', encoding='utf-8') as f:
                f.write(batch_content)
            print(f"✅ Windows 배치 스크립트 생성: {batch_path}")
        except Exception as e:
            self.errors.append(f"배치 스크립트 생성 실패: {e}")
        
        # Linux/Mac 셸 스크립트
        shell_content = '''#!/bin/bash
echo "🧱 BrickBox 합성 데이터셋 생성기"
echo

# 환경 변수 로드
export $(grep -v '^#' config/synthetic_dataset.env | xargs)

# Python 스크립트 실행
python scripts/render_ldraw_to_supabase.py --part-id 3001 --count 10
'''
        
        shell_path = self.project_root / "scripts" / "generate_synthetic_dataset.sh"
        try:
            with open(shell_path, 'w', encoding='utf-8') as f:
                f.write(shell_content)
            # 실행 권한 부여
            os.chmod(shell_path, 0o755)
            print(f"✅ Linux/Mac 셸 스크립트 생성: {shell_path}")
        except Exception as e:
            self.errors.append(f"셸 스크립트 생성 실패: {e}")
    
    def generate_setup_report(self):
        """설정 보고서 생성"""
        report = {
            "timestamp": str(Path().cwd()),
            "project_root": str(self.project_root),
            "config_loaded": len(self.config) > 0,
            "directories_created": [],
            "dependencies": {
                "available": [],
                "missing": []
            },
            "ldraw_installed": False,
            "supabase_connected": False,
            "errors": self.errors,
            "warnings": self.warnings
        }
        
        # 디렉토리 생성 결과
        try:
            created_dirs = self.create_directory_structure()
            report["directories_created"] = created_dirs
        except Exception as e:
            report["errors"].append(f"디렉토리 생성 실패: {e}")
        
        # 의존성 확인
        try:
            available, missing = self.check_dependencies()
            report["dependencies"]["available"] = available
            report["dependencies"]["missing"] = missing
        except Exception as e:
            report["errors"].append(f"의존성 확인 실패: {e}")
        
        # LDraw 확인
        try:
            report["ldraw_installed"] = self.check_ldraw_installation()
        except Exception as e:
            report["errors"].append(f"LDraw 확인 실패: {e}")
        
        # Supabase 확인
        try:
            report["supabase_connected"] = self.check_supabase_connection()
        except Exception as e:
            report["errors"].append(f"Supabase 확인 실패: {e}")
        
        # 보고서 저장
        report_path = self.project_root / "logs" / "setup_report.json"
        try:
            with open(report_path, 'w', encoding='utf-8') as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
            print(f"✅ 설정 보고서 생성: {report_path}")
        except Exception as e:
            print(f"⚠️ 보고서 저장 실패: {e}")
        
        return report
    
    def run_full_setup(self):
        """전체 설정 실행"""
        print("🧱 BrickBox 합성 데이터셋 환경 설정 시작")
        print("=" * 50)
        
        # 1. 설정 파일 로드
        print("\n1️⃣ 설정 파일 로드...")
        if not self.load_config():
            print("❌ 설정 파일 로드 실패")
            return False
        
        # 2. 디렉토리 구조 생성
        print("\n2️⃣ 디렉토리 구조 생성...")
        self.create_directory_structure()
        
        # 3. 의존성 확인
        print("\n3️⃣ 의존성 확인...")
        available, missing = self.check_dependencies()
        
        # 4. LDraw 확인
        print("\n4️⃣ LDraw 라이브러리 확인...")
        self.check_ldraw_installation()
        
        # 5. Supabase 확인
        print("\n5️⃣ Supabase 연결 확인...")
        self.check_supabase_connection()
        
        # 6. 스크립트 템플릿 생성
        print("\n6️⃣ 스크립트 템플릿 생성...")
        self.create_blender_script_template()
        
        # 7. YOLO 설정 생성
        print("\n7️⃣ YOLO 설정 생성...")
        self.create_yolo_config()
        
        # 8. 배치 스크립트 생성
        print("\n8️⃣ 배치 스크립트 생성...")
        self.create_batch_scripts()
        
        # 9. 보고서 생성
        print("\n9️⃣ 설정 보고서 생성...")
        report = self.generate_setup_report()
        
        # 결과 출력
        print("\n" + "=" * 50)
        print("🎉 환경 설정 완료!")
        
        if self.errors:
            print(f"\n❌ 오류 ({len(self.errors)}개):")
            for error in self.errors:
                print(f"  - {error}")
        
        if self.warnings:
            print(f"\n⚠️ 경고 ({len(self.warnings)}개):")
            for warning in self.warnings:
                print(f"  - {warning}")
        
        if not self.errors:
            print("\n✅ 모든 설정이 완료되었습니다!")
            print("다음 단계:")
            print("  1. LDraw 라이브러리 설치 (필요한 경우)")
            print("  2. Blender 3.6+ 설치")
            print("  3. scripts/generate_synthetic_dataset.bat 실행")
        else:
            print("\n⚠️ 일부 설정에 문제가 있습니다. 오류를 확인하고 다시 시도하세요.")
        
        return len(self.errors) == 0

def main():
    """메인 실행 함수"""
    setup = SyntheticEnvironmentSetup()
    success = setup.run_full_setup()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()

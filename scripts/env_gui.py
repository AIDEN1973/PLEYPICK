#!/usr/bin/env python3
"""
BrickBox 환경변수 관리 GUI
tkinter를 사용한 환경변수 관리 도구
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import json
import os
import sys
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

try:
    from scripts.env_manager import env_manager
    ENV_MANAGER_AVAILABLE = True
except ImportError:
    ENV_MANAGER_AVAILABLE = False

class EnvironmentConfigGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("BrickBox 환경변수 관리자")
        self.root.geometry("1000x800")
        self.root.minsize(800, 600)
        
        # 스타일 설정
        style = ttk.Style()
        style.theme_use('clam')
        
        self.create_widgets()
        self.load_config()
    
    def create_widgets(self):
        """위젯 생성"""
        # 스크롤 가능한 캔버스 생성
        canvas = tk.Canvas(self.root)
        scrollbar = ttk.Scrollbar(self.root, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        # 메인 프레임
        main_frame = ttk.Frame(scrollable_frame, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 제목
        title_label = ttk.Label(main_frame, text="BrickBox 환경변수 관리자", 
                               font=('Arial', 16, 'bold'))
        title_label.grid(row=0, column=0, columnspan=3, pady=(0, 20))
        
        # 상태 표시
        status_frame = ttk.LabelFrame(main_frame, text="상태", padding="5")
        status_frame.grid(row=1, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
        
        self.status_label = ttk.Label(status_frame, text="환경변수 관리자 로딩 중...")
        self.status_label.grid(row=0, column=0, sticky=tk.W)
        
        # 설정 섹션들
        self.create_supabase_section(main_frame, 2)
        self.create_api_section(main_frame, 3)
        self.create_port_section(main_frame, 4)
        self.create_service_section(main_frame, 5)
        
        # 버튼들
        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=6, column=0, columnspan=3, pady=20)
        
        ttk.Button(button_frame, text="저장", command=self.save_config).grid(row=0, column=0, padx=5)
        ttk.Button(button_frame, text="로드", command=self.load_config).grid(row=0, column=1, padx=5)
        ttk.Button(button_frame, text="유효성 검사", command=self.validate_config).grid(row=0, column=2, padx=5)
        ttk.Button(button_frame, text="환경변수 적용", command=self.apply_environment).grid(row=0, column=3, padx=5)
        ttk.Button(button_frame, text="초기화", command=self.reset_config).grid(row=0, column=4, padx=5)
        
        # 캔버스와 스크롤바 배치
        canvas.grid(row=0, column=0, sticky="nsew")
        scrollbar.grid(row=0, column=1, sticky="ns")
        
        # 그리드 가중치 설정
        self.root.grid_rowconfigure(0, weight=1)
        self.root.grid_columnconfigure(0, weight=1)
        
        # 마우스 휠 스크롤 바인딩
        def _on_mousewheel(event):
            canvas.yview_scroll(int(-1*(event.delta/120)), "units")
        
        canvas.bind_all("<MouseWheel>", _on_mousewheel)
        
        # 창 닫기 시 바인딩 해제
        def _on_closing():
            canvas.unbind_all("<MouseWheel>")
            self.root.destroy()
        
        self.root.protocol("WM_DELETE_WINDOW", _on_closing)
    
    def create_supabase_section(self, parent, row):
        """Supabase 설정 섹션"""
        frame = ttk.LabelFrame(parent, text="Supabase 설정", padding="10")
        frame.grid(row=row, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=5)
        
        # URL
        ttk.Label(frame, text="URL:").grid(row=0, column=0, sticky=tk.W, padx=(0, 5))
        self.supabase_url_var = tk.StringVar()
        ttk.Entry(frame, textvariable=self.supabase_url_var, width=60).grid(row=0, column=1, sticky=(tk.W, tk.E))
        
        # Anon Key
        ttk.Label(frame, text="Anon Key:").grid(row=1, column=0, sticky=tk.W, padx=(0, 5))
        self.supabase_anon_key_var = tk.StringVar()
        ttk.Entry(frame, textvariable=self.supabase_anon_key_var, width=60, show="*").grid(row=1, column=1, sticky=(tk.W, tk.E))
        
        # Service Role
        ttk.Label(frame, text="Service Role:").grid(row=2, column=0, sticky=tk.W, padx=(0, 5))
        self.supabase_service_role_var = tk.StringVar()
        ttk.Entry(frame, textvariable=self.supabase_service_role_var, width=60, show="*").grid(row=2, column=1, sticky=(tk.W, tk.E))
        
        frame.columnconfigure(1, weight=1)
    
    def create_api_section(self, parent, row):
        """API 키 설정 섹션"""
        frame = ttk.LabelFrame(parent, text="API 키", padding="10")
        frame.grid(row=row, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=5)
        
        # OpenAI API Key
        ttk.Label(frame, text="OpenAI API Key:").grid(row=0, column=0, sticky=tk.W, padx=(0, 5))
        self.openai_api_key_var = tk.StringVar()
        ttk.Entry(frame, textvariable=self.openai_api_key_var, width=60, show="*").grid(row=0, column=1, sticky=(tk.W, tk.E))
        
        # Rebrickable API Key
        ttk.Label(frame, text="Rebrickable API Key:").grid(row=1, column=0, sticky=tk.W, padx=(0, 5))
        self.rebrickable_api_key_var = tk.StringVar()
        ttk.Entry(frame, textvariable=self.rebrickable_api_key_var, width=60, show="*").grid(row=1, column=1, sticky=(tk.W, tk.E))
        
        frame.columnconfigure(1, weight=1)
    
    def create_port_section(self, parent, row):
        """포트 설정 섹션 (동적 생성)"""
        frame = ttk.LabelFrame(parent, text="포트 설정", padding="10")
        frame.grid(row=row, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=5)
        
        # 환경변수 관리자에서 포트 설정 동적 가져오기
        self.port_vars = {}
        try:
            from scripts.env_integration import get_all_port_fields
            port_config = get_all_port_fields()
            
            # 포트 설정을 GUI에 표시할 형식으로 변환
            ports = []
            for key, value in port_config.items():
                # 키를 표시용 라벨로 변환
                label = key.replace('_', ' ').title()
                ports.append((key, label, value))
            
            # 포트를 정렬 (포트 번호 순)
            ports.sort(key=lambda x: x[2])
            
        except ImportError:
            # 폴백: 기본 포트 설정
            ports = [
                ("vite_port", "Vite Port", 3000),
                ("webp_image_api_port", "WebP Image API Port", 3004),
                ("training_api_port", "Training API Port", 3010),
                ("synthetic_api_port", "Synthetic API Port", 3011),
                ("worker_port", "Worker Port", 3020),
                ("clip_service_port", "CLIP Service Port", 3021),
                ("semantic_vector_api_port", "Semantic Vector API Port", 3022),
                ("manual_upload_port", "Manual Upload Port", 3030),
                ("monitoring_port", "Monitoring Port", 3040),
                ("preview_port", "Preview Port", 4173),
            ]
        
        # 포트 필드들을 3열로 배치 (더 많은 필드를 효율적으로 표시)
        for i, (key, label, default) in enumerate(ports):
            row = i // 3
            col = (i % 3) * 2
            ttk.Label(frame, text=f"{label}:").grid(row=row, column=col, sticky=tk.W, padx=(0, 5))
            var = tk.StringVar(value=str(default))
            self.port_vars[key] = var
            ttk.Entry(frame, textvariable=var, width=12).grid(row=row, column=col+1, sticky=tk.W, padx=(0, 15))
    
    def create_service_section(self, parent, row):
        """서비스 URL 설정 섹션 (동적 생성)"""
        frame = ttk.LabelFrame(parent, text="서비스 URL", padding="10")
        frame.grid(row=row, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=5)
        
        # 환경변수 관리자에서 서비스 URL 동적 가져오기
        self.service_vars = {}
        try:
            from scripts.env_integration import get_all_service_fields
            service_config = get_all_service_fields()
            
            # 서비스 URL을 GUI에 표시할 형식으로 변환
            services = []
            for key, value in service_config.items():
                # 키를 표시용 라벨로 변환
                label = key.replace('_', ' ').title()
                services.append((key, label, value))
            
            # 서비스를 정렬 (알파벳 순)
            services.sort(key=lambda x: x[0])
            
        except ImportError:
            # 폴백: 기본 서비스 URL 설정
            services = [
                ("clip_service_url", "CLIP Service URL", "http://localhost:3021"),
                ("semantic_vector_api_url", "Semantic Vector API URL", "http://localhost:3022"),
                ("vite_api_base", "Vite API Base", "http://localhost:3010"),
                ("vite_synthetic_api_base", "Vite Synthetic API Base", "http://localhost:3011"),
                ("vite_webp_image_api_base", "Vite WebP Image API Base", "http://localhost:3004"),
            ]
        
        # 서비스 URL 필드들을 2열로 배치 (더 효율적인 공간 활용)
        for i, (key, label, default) in enumerate(services):
            row = i // 2
            col = (i % 2) * 3
            ttk.Label(frame, text=f"{label}:").grid(row=row, column=col, sticky=tk.W, padx=(0, 5))
            var = tk.StringVar(value=default)
            self.service_vars[key] = var
            ttk.Entry(frame, textvariable=var, width=35).grid(row=row, column=col+1, sticky=(tk.W, tk.E), padx=(0, 10))
        
        # 컬럼 가중치 설정
        frame.columnconfigure(1, weight=1)
        frame.columnconfigure(4, weight=1)
    
    def load_config(self):
        """설정 로드"""
        if not ENV_MANAGER_AVAILABLE:
            self.status_label.config(text="환경변수 관리자를 사용할 수 없습니다.")
            return
        
        try:
            # Supabase 설정
            self.supabase_url_var.set(env_manager.get('supabase_url', ''))
            self.supabase_anon_key_var.set(env_manager.get('supabase_anon_key', ''))
            self.supabase_service_role_var.set(env_manager.get('supabase_service_role', ''))
            
            # API 키
            self.openai_api_key_var.set(env_manager.get('openai_api_key', ''))
            self.rebrickable_api_key_var.set(env_manager.get('rebrickable_api_key', ''))
            
            # 포트 설정
            for key, var in self.port_vars.items():
                var.set(str(env_manager.get(key, 0)))
            
            # 서비스 URL
            for key, var in self.service_vars.items():
                var.set(env_manager.get(key, ''))
            
            self.status_label.config(text="설정이 로드되었습니다.")
            
        except Exception as e:
            self.status_label.config(text=f"설정 로드 실패: {e}")
    
    def save_config(self):
        """설정 저장"""
        if not ENV_MANAGER_AVAILABLE:
            messagebox.showerror("오류", "환경변수 관리자를 사용할 수 없습니다.")
            return
        
        try:
            # Supabase 설정
            env_manager.set('supabase_url', self.supabase_url_var.get())
            env_manager.set('supabase_anon_key', self.supabase_anon_key_var.get())
            env_manager.set('supabase_service_role', self.supabase_service_role_var.get())
            
            # API 키
            env_manager.set('openai_api_key', self.openai_api_key_var.get())
            env_manager.set('rebrickable_api_key', self.rebrickable_api_key_var.get())
            
            # 포트 설정
            for key, var in self.port_vars.items():
                try:
                    port = int(var.get())
                    env_manager.set(key, port)
                except ValueError:
                    messagebox.showerror("오류", f"{key}는 유효한 숫자여야 합니다.")
                    return
            
            # 서비스 URL
            for key, var in self.service_vars.items():
                env_manager.set(key, var.get())
            
            # JSON 파일로 저장
            env_manager.save_config('json')
            
            self.status_label.config(text="설정이 저장되었습니다.")
            messagebox.showinfo("성공", "설정이 저장되었습니다.")
            
        except Exception as e:
            self.status_label.config(text=f"설정 저장 실패: {e}")
            messagebox.showerror("오류", f"설정 저장 실패: {e}")
    
    def validate_config(self):
        """설정 유효성 검사"""
        if not ENV_MANAGER_AVAILABLE:
            messagebox.showerror("오류", "환경변수 관리자를 사용할 수 없습니다.")
            return
        
        try:
            # 현재 설정을 임시로 적용
            self.save_config()
            
            errors = env_manager.validate_config()
            if errors:
                error_msg = "설정 오류:\n" + "\n".join([f"- {field}: {error}" for field, error in errors.items()])
                messagebox.showerror("유효성 검사 실패", error_msg)
                self.status_label.config(text="유효성 검사 실패")
            else:
                messagebox.showinfo("성공", "설정이 유효합니다.")
                self.status_label.config(text="유효성 검사 통과")
                
        except Exception as e:
            messagebox.showerror("오류", f"유효성 검사 실패: {e}")
            self.status_label.config(text=f"유효성 검사 실패: {e}")
    
    def apply_environment(self):
        """환경변수 적용"""
        if not ENV_MANAGER_AVAILABLE:
            messagebox.showerror("오류", "환경변수 관리자를 사용할 수 없습니다.")
            return
        
        try:
            self.save_config()
            env_manager.apply_to_environment()
            messagebox.showinfo("성공", "환경변수가 적용되었습니다.")
            self.status_label.config(text="환경변수가 적용되었습니다.")
            
        except Exception as e:
            messagebox.showerror("오류", f"환경변수 적용 실패: {e}")
            self.status_label.config(text=f"환경변수 적용 실패: {e}")
    
    def reset_config(self):
        """설정 초기화"""
        if messagebox.askyesno("확인", "설정을 초기화하시겠습니까?"):
            # 기본값으로 설정
            self.supabase_url_var.set("")
            self.supabase_anon_key_var.set("")
            self.supabase_service_role_var.set("")
            self.openai_api_key_var.set("")
            self.rebrickable_api_key_var.set("")
            
            for var in self.port_vars.values():
                var.set("0")
            
            for var in self.service_vars.values():
                var.set("")
            
            self.status_label.config(text="설정이 초기화되었습니다.")

def main():
    """메인 함수"""
    if not ENV_MANAGER_AVAILABLE:
        print("환경변수 관리자를 사용할 수 없습니다.")
        print("scripts/env_manager.py 파일이 필요합니다.")
        return
    
    root = tk.Tk()
    app = EnvironmentConfigGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()

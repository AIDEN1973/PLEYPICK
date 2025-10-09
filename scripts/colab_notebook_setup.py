# 🧱 Colab 노트북에 추가할 코드
# 이 코드를 Colab 노트북의 새 셀에 복사하세요

# Supabase 연결 설정
SUPABASE_URL = "https://npferbxuxocbfnfbpcnz.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZmVyYnh1eG9jYmZuZmJwY256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzNzQ4MDAsImV4cCI6MjA1MTk1MDgwMH0.YOUR_ANON_KEY"

# 환경 변수 설정
import os
os.environ['SUPABASE_URL'] = SUPABASE_URL
os.environ['SUPABASE_ANON_KEY'] = SUPABASE_ANON_KEY

# Supabase 클라이언트 초기화
from supabase import create_client, Client

supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

print("✅ Supabase 연결 완료")
print(f"📊 URL: {SUPABASE_URL}")

# 연결 테스트
try:
    result = supabase.table('automation_config').select('*').limit(1).execute()
    print("✅ 데이터베이스 연결 테스트 성공")
    print(f"📊 설정 개수: {len(result.data)}")
except Exception as e:
    print(f"❌ 데이터베이스 연결 실패: {e}")

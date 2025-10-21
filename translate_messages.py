#!/usr/bin/env python3
"""Translate Korean messages to English in render script"""

# Read the file
with open('scripts/render_ldraw_to_supabase.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Korean messages with English
replacements = [
    ('연결됨', 'CONNECTED'),
    ('연결 안됨', 'NOT CONNECTED'),
    ('업로드 시작', 'upload starting'),
    ('클라이언트 상태', 'client status'),
    ('정상', 'OK'),
    ('비정상', 'NOT OK'),
    ('초기화되지 않았습니다', 'not initialized'),
    ('최대 재시도 횟수 초과', 'max retries exceeded'),
    ('업로드 완료', 'upload completed'),
    ('파일 크기', 'file size'),
    ('업로드 시도', 'upload attempt'),
    ('업로드 예외', 'upload exception'),
    ('업로드 실패', 'upload failed'),
    ('예외 타입', 'exception type'),
    ('예외 상세', 'exception details'),
    ('업로드 경로', 'upload path'),
    ('최종 실패', 'final failure'),
    ('파일 경로', 'file path'),
    ('처리는 계속 진행합니다', 'processing continues'),
    ('생성 시작', 'creating'),
    ('생성 완료', 'created'),
    ('메타데이터가 비어있음', 'metadata is empty'),
    ('로컬 저장 완료', 'local save completed'),
    ('로컬 저장 실패', 'local save failed'),
    ('재시도...', 'retrying...'),
]

for korean, english in replacements:
    content = content.replace(korean, english)

# Write back
with open('scripts/render_ldraw_to_supabase.py', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"[OK] Korean messages translated to English")


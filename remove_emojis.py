#!/usr/bin/env python3
"""Remove emojis from render script"""

import re

# Read the file
with open('scripts/render_ldraw_to_supabase.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace emoji patterns
replacements = [
    ('🔍', '[CHECK]'),
    ('✅', '[OK]'),
    ('❌', '[ERROR]'),
    ('⚠️', '[WARNING]'),
    ('💡', '[INFO]'),
    ('📤', '[UPLOAD]'),
    ('🔧', '[FIX]'),
    ('📦', '[BUCKET]'),
    ('🔌', '[CONNECT]'),
    ('⏳', '[WAIT]'),
]

for emoji, replacement in replacements:
    content = content.replace(emoji, replacement)

# Write back
with open('scripts/render_ldraw_to_supabase.py', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"[OK] Emojis removed and replaced with ASCII-safe markers")


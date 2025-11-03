import re, sys, datetime, os

DB_DIR = "database"
DOCS = ["기술문서.txt", "메타데이터.txt", "어노테이션.txt", "브릭박스 스키마.txt"]

def update_doc(doc_name, find_pattern, replace_value):
    path = os.path.join(DB_DIR, doc_name)
    if not os.path.exists(path):
        return False

    with open(path, "r", encoding="utf-8") as f:
        text = f.read()

    new_text, count = re.subn(find_pattern, replace_value, text)
    if count == 0:
        return False

    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    new_text += f"\n\n# [AI Update] {ts} — {find_pattern} → {replace_value}\n"

    backup_path = path + ".bak"
    with open(backup_path, "w", encoding="utf-8") as f:
        f.write(text)

    with open(path, "w", encoding="utf-8") as f:
        f.write(new_text)
    print(f"✅ {doc_name} 업데이트 완료 ({count}개 교체됨)")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("사용법: python scripts/update_docs_from_proposal.py <찾을문자열> <대체문자열>")
        sys.exit(1)

    pattern, value = sys.argv[1], sys.argv[2]
    for doc in DOCS:
        if update_doc(doc, pattern, value):
            print(f"{doc} 수정 반영 완료.")

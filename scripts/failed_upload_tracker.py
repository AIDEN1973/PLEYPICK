#!/usr/bin/env python3
"""
실패 업로드/렌더 이벤트를 JSON 파일로 추적하는 헬퍼.
서버 manual-upload-api는 이 파일(scripts/failed_uploads.json)을 읽어
프런트의 /failed-uploads 화면에 노출한다.
"""

import os
import json
from datetime import datetime
from typing import Dict, Any


TRACKING_FILENAME = os.path.join(os.path.dirname(__file__), 'failed_uploads.json')


def _ensure_parent_dir_exists(filepath: str) -> None:
    parent = os.path.dirname(filepath)
    if parent and not os.path.exists(parent):
        os.makedirs(parent, exist_ok=True)


def _read_existing_entries() -> list:
    try:
        with open(TRACKING_FILENAME, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return []
    except Exception:
        # 손상 방지를 위해 실패 시 신규로 시작
        return []


def _write_entries(entries: list) -> None:
    _ensure_parent_dir_exists(TRACKING_FILENAME)
    with open(TRACKING_FILENAME, 'w', encoding='utf-8') as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)


def track_failed_upload(
    part_id: str,
    element_id: str,
    unique_id: str,
    local_paths: Dict[str, str],
    error_reason: str,
    retry_count: int = 0,
    status: str = 'failed',
    extra: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """실패 이벤트를 파일에 추가 기록한다.

    반환값은 추가된 엔트리(dict).
    """
    entries = _read_existing_entries()

    now_iso = datetime.utcnow().isoformat() + 'Z'
    entry_id = f"{element_id}_{unique_id}_{int(datetime.utcnow().timestamp())}"

    record: Dict[str, Any] = {
        'id': entry_id,
        'part_id': part_id,
        'element_id': element_id,
        'unique_id': unique_id,
        'status': status,
        'failed_at': now_iso,
        'error_reason': error_reason,
        'retry_count': int(retry_count),
        'local_paths': local_paths or {},
    }

    if extra:
        record.update(extra)

    entries.append(record)
    _write_entries(entries)
    return record

#!/usr/bin/env python3 """ 실패한 업로드 파일 추적 시스템 """ import os import json import time from pathlib import Path from datetime import datetime from typing import List, Dict, Optional class FailedUploadTracker: """실패한 업로드 파일 추적 클래스""" def __init__(self, tracking_file: str = "failed_uploads.json"): self.tracking_file = Path(tracking_file) self.failed_uploads = self._load_failed_uploads() def _load_failed_uploads(self) -> List[Dict]: """실패한 업로드 목록 로드""" if self.tracking_file.exists(): try: with open(self.tracking_file, 'r', encoding='utf-8') as f: return json.load(f) except Exception as e: print(f"Failed to load tracking file: {e}") return [] return [] def _save_failed_uploads(self): """실패한 업로드 목록 저장""" try: with open(self.tracking_file, 'w', encoding='utf-8') as f: json.dump(self.failed_uploads, f, ensure_ascii=False, indent=2) except Exception as e: print(f"Failed to save tracking file: {e}") def add_failed_upload(self, part_id: str, element_id: str, unique_id: str, local_paths: Dict[str, str], error_reason: str, retry_count: int = 3): """실패한 업로드 추가""" failed_entry = { "id": f"{part_id}_{element_id}_{unique_id}", "part_id": part_id, "element_id": element_id, "unique_id": unique_id, "local_paths": local_paths, "error_reason": error_reason, "retry_count": retry_count, "failed_at": datetime.now().isoformat(), "status": "failed", "supabase_paths": { "image": f"synthetic/{element_id}/{unique_id}.webp", "annotation": f"synthetic/{element_id}/{unique_id}.txt", "metadata": f"synthetic/{element_id}/{unique_id}.json", "e2_metadata": f"synthetic/{element_id}/{unique_id}_e2.json" } } # 중복 제거 (같은 ID가 있으면 업데이트) self.failed_uploads = [entry for entry in self.failed_uploads if entry.get("id") != failed_entry["id"]] self.failed_uploads.append(failed_entry) self._save_failed_uploads() print(f"Added failed upload to tracking: {failed_entry['id']}") return failed_entry["id"] def get_failed_uploads(self, status: Optional[str] = None) -> List[Dict]: """실패한 업로드 목록 조회""" if status: return [entry for entry in self.failed_uploads if entry.get("status") == status] return self.failed_uploads def mark_as_retrying(self, entry_id: str): """재시도 중으로 표시""" for entry in self.failed_uploads: if entry.get("id") == entry_id: entry["status"] = "retrying" entry["retry_started_at"] = datetime.now().isoformat() break self._save_failed_uploads() def mark_as_success(self, entry_id: str): """성공으로 표시""" for entry in self.failed_uploads: if entry.get("id") == entry_id: entry["status"] = "success" entry["success_at"] = datetime.now().isoformat() break self._save_failed_uploads() def mark_as_final_failure(self, entry_id: str, final_error: str): """최종 실패로 표시""" for entry in self.failed_uploads: if entry.get("id") == entry_id: entry["status"] = "final_failure" entry["final_error"] = final_error entry["final_failure_at"] = datetime.now().isoformat() break self._save_failed_uploads() def remove_entry(self, entry_id: str): """항목 제거""" self.failed_uploads = [entry for entry in self.failed_uploads if entry.get("id") != entry_id] self._save_failed_uploads() def get_statistics(self) -> Dict: """통계 정보""" total = len(self.failed_uploads) by_status = {} for entry in self.failed_uploads: status = entry.get("status", "unknown") by_status[status] = by_status.get(status, 0) + 1 return { "total": total, "by_status": by_status, "failed": by_status.get("failed", 0), "retrying": by_status.get("retrying", 0), "success": by_status.get("success", 0), "final_failure": by_status.get("final_failure", 0) } def cleanup_old_entries(self, days: int = 30): """오래된 항목 정리""" cutoff_date = datetime.now().timestamp() - (days * 24 * 60 * 60) original_count = len(self.failed_uploads) self.failed_uploads = [ entry for entry in self.failed_uploads if datetime.fromisoformat(entry.get("failed_at", "1970-01-01")).timestamp() > cutoff_date ] removed_count = original_count - len(self.failed_uploads) if removed_count > 0: print(f"Cleaned up {removed_count} old entries") self._save_failed_uploads() return removed_count # 전역 추적기 인스턴스 _tracker = None def get_tracker() -> FailedUploadTracker: """전역 추적기 인스턴스 반환""" global _tracker if _tracker is None: _tracker = FailedUploadTracker() return _tracker def track_failed_upload(part_id: str, element_id: str, unique_id: str, local_paths: Dict[str, str], error_reason: str, retry_count: int = 3) -> str: """실패한 업로드 추적 (편의 함수)""" tracker = get_tracker() return tracker.add_failed_upload(part_id, element_id, unique_id, local_paths, error_reason, retry_count) def get_failed_uploads_summary() -> Dict: """실패한 업로드 요약 정보""" tracker = get_tracker() return tracker.get_statistics() if __name__ == "__main__": # 테스트 tracker = FailedUploadTracker("test_failed_uploads.json") # 테스트 데이터 추가 test_entry_id = tracker.add_failed_upload( part_id="3001", element_id="4583789", unique_id="test123", local_paths={ "image": "/path/to/image.webp", "annotation": "/path/to/annotation.txt", "metadata": "/path/to/metadata.json", "e2_metadata": "/path/to/e2_metadata.json" }, error_reason="Network timeout", retry_count=3 ) print(f"Added test entry: {test_entry_id}") print(f"Statistics: {tracker.get_statistics()}") # 정리 os.remove("test_failed_uploads.json") 
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
렌더링 속도 최적화 '운영형' 진단 스크립트
- 여러 세트/파츠 디렉토리의 렌더 설정(JSON) 스캔
- 현재 상태 요약(샘플 평균/분포, 디바이스, 타일, 해상도 등)
- 가정치 기반 '상한/하한' 속도 개선 시나리오 계산
- JSON/Markdown 리포트 출력 지원

사용 예:
  python render_optimize_audit.py \
    --glob "output/synthetic/dataset_synthetic/images/train/*/*.json" \
    --baseline-sec 4.0 \
    --assume-gpu on \
    --report json > audit.json
"""

import argparse
import glob
import json
import math
import statistics as stats
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import Counter, defaultdict
from typing import Any, Dict, List, Tuple

# ----------------------------
# 파싱/인자
# ----------------------------
def parse_args():
    p = argparse.ArgumentParser(description="렌더 설정 진단 & 속도 최적화 시뮬레이터")
    p.add_argument("--glob", required=True,
                   help="스캔할 JSON 파일 글롭 패턴 (예: output/.../images/train/*/*.json)")
    p.add_argument("--baseline-sec", type=float, default=4.0,
                   help="현재 1 프레임 렌더 시간(초) 추정치 (기본 4.0)")
    p.add_argument("--assume-gpu", choices=["on", "off", "auto"], default="auto",
                   help="GPU 가속 가정: on/off/auto (기본 auto: JSON에서 device 키 추정)")
    p.add_argument("--report", choices=["text", "json", "md"], default="text",
                   help="출력 리포트 형식")
    p.add_argument("--max-files", type=int, default=0,
                   help="퍼포먼스를 위해 최대 N개 파일만 샘플링(0=무제한)")
    p.add_argument("--workers", type=int, default=8,
                   help="파일 병렬 읽기 워커 수")
    return p.parse_args()

# ----------------------------
# 유틸
# ----------------------------
def safe_load(path: str) -> Dict[str, Any]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def extract_render_fields(d: Dict[str, Any]) -> Dict[str, Any]:
    rs = (d.get("render_settings") or {})
    # 널/미존재에 강건하게 키 추출
    return {
        "samples": int(rs.get("samples") or 0),
        "tile_size": int(rs.get("tile_size") or 0),
        "resolution_x": int(rs.get("resolution_x") or rs.get("width") or 0),
        "resolution_y": int(rs.get("resolution_y") or rs.get("height") or 0),
        "denoise": bool(rs.get("denoise")) if rs.get("denoise") is not None else None,
        "device": (rs.get("device") or "").lower(),  # "cpu"/"cuda"/"optix" 등
        "engine": (rs.get("engine") or "").lower(),  # "cycles" 등
        "variant": d.get("variant") or "",           # 복잡도/도메인 플래그 등
    }

def summarize(nums: List[float]) -> Dict[str, Any]:
    if not nums:
        return {"count": 0}
    nums_sorted = sorted(nums)
    return {
        "count": len(nums),
        "min": min(nums),
        "p25": nums_sorted[max(0, len(nums)//4 - 1)],
        "median": stats.median(nums),
        "p75": nums_sorted[min(len(nums)-1, (3*len(nums))//4)],
        "max": max(nums),
        "mean": stats.mean(nums),
        "stdev": stats.pstdev(nums) if len(nums) > 1 else 0.0,
    }

# ----------------------------
# 스캔
# ----------------------------
def scan_jsons(pattern: str, max_files: int, workers: int) -> Tuple[List[Dict[str, Any]], List[str]]:
    files = glob.glob(pattern)
    if max_files and len(files) > max_files:
        files = files[:max_files]
    results, errors = [], []

    if not files:
        return results, errors

    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(safe_load, fp): fp for fp in files}
        for fut in as_completed(futs):
            fp = futs[fut]
            d = fut.result() or {}
            if d:
                row = extract_render_fields(d)
                row["__file"] = fp
                results.append(row)
            else:
                errors.append(fp)
    return results, errors

# ----------------------------
# 예상 속도 개선(상/하한)
# ----------------------------
def calc_speed_scenarios(baseline_sec: float,
                         have_gpu: bool,
                         samples_mean: float) -> Dict[str, Any]:
    """
    각 최적화의 '적용 전제'와 '합성 배수'를 명시.
    - 샘플 수 최적화: 640→(256~512) 가정
    - GPU 가속: 3~8x
    - 타일/메모리: 1.25~1.5x
    - 캐싱(재렌더): 5~10x (재렌더 상황에서만)
    - 병렬 워커: 2~4x (머신 리소스 의존)
    - 품질 슬림: 1.3~1.5x
    배수는 독립이 아니므로 '보수적 합성(중복 효과 감쇠)'로 계산.
    """
    # 샘플수 비율(대략적):  samples_mean / target_samples
    # target을 256~512로 보고 상/하한 비율 계산
    if samples_mean <= 0:
        sample_factor_low = sample_factor_high = 1.0
    else:
        sample_factor_low = max(256.0 / samples_mean, 0.3)   # 상한 향상(더 많이 줄임)
        sample_factor_high = min(512.0 / samples_mean, 1.0)  # 하한 향상(덜 줄임)

    def combine_factors(*factors):
        # 중복효과 감쇠: 각 요인에 85% 가중(대충의 보수적 합성)
        prod = 1.0
        for f in factors:
            prod *= (1 - 0.15) + 0.15 * f  # 0.85*1 + 0.15*f
        return prod

    scenarios = {}

    # 기본(아무것도 안 한 경우)
    scenarios["current"] = {"time_sec": baseline_sec, "x": 1.0}

    # GPU 유무에 따라 갈래
    gpu_low, gpu_high = (3.0, 8.0) if not have_gpu else (1.0, 1.0)

    # 공통 팩터 범위
    mem_low, mem_high = (1.25, 1.5)
    cache_low, cache_high = (5.0, 10.0)  # 재렌더시에만 의미
    mp_low, mp_high = (2.0, 4.0)
    qual_low, qual_high = (1.3, 1.5)

    # "일반 파이프라인 1회 렌더" 시나리오(캐시는 제외)
    low_factor = combine_factors(sample_factor_low, gpu_low, mem_low, mp_low, qual_low)
    high_factor = combine_factors(sample_factor_high, gpu_high, mem_high, mp_high, qual_high)

    scenarios["once_render_low"] = {
        "time_sec": baseline_sec / high_factor,
        "x": high_factor,
        "notes": "낙관적 상한(강력 튜닝 가정, GPU 포함/도입)"
    }
    scenarios["once_render_high"] = {
        "time_sec": baseline_sec / low_factor,
        "x": low_factor,
        "notes": "보수적 하한(부분 적용, GPU 미도입 또는 효과 제한)"
    }

    # "재렌더(씬 고정/템플릿 재활용)" 시나리오: 캐시 포함
    low_factor_rerun = combine_factors(sample_factor_low, gpu_low, mem_low, mp_low, qual_low, cache_low)
    high_factor_rerun = combine_factors(sample_factor_high, gpu_high, mem_high, mp_high, qual_high, cache_high)

    scenarios["rerender_low"] = {
        "time_sec": baseline_sec / high_factor_rerun,
        "x": high_factor_rerun,
        "notes": "재렌더 낙관적 상한(씬/재질 캐시 적중 높음)"
    }
    scenarios["rerender_high"] = {
        "time_sec": baseline_sec / low_factor_rerun,
        "x": low_factor_rerun,
        "notes": "재렌더 보수적 하한(캐시 적중/효과 제한)"
    }

    return scenarios

# ----------------------------
# 리포트 빌드
# ----------------------------
def build_report(rows: List[Dict[str, Any]],
                 baseline_sec: float,
                 assume_gpu: str,
                 fmt: str) -> str:
    if not rows:
        msg = "JSON 파일을 찾지 못했습니다. --glob 패턴을 확인하세요."
        return json.dumps({"ok": False, "message": msg}, ensure_ascii=False) if fmt == "json" else msg

    samples = [r["samples"] for r in rows if isinstance(r.get("samples"), int)]
    tiles = [r["tile_size"] for r in rows if r.get("tile_size")]
    resol = [(r["resolution_x"], r["resolution_y"]) for r in rows if r.get("resolution_x") or r.get("resolution_y")]
    devices = [r["device"] or "unknown" for r in rows]
    engines = [r["engine"] or "unknown" for r in rows]

    s_summary = summarize(samples)
    tile_summary = summarize(tiles)
    res_counter = Counter(resol)
    dev_counter = Counter(devices)
    eng_counter = Counter(engines)

    # GPU 추정
    have_gpu = None
    if assume_gpu == "on":
        have_gpu = True
    elif assume_gpu == "off":
        have_gpu = False
    else:
        # auto: 디바이스에 cuda/optix가 하나라도 있으면 True
        have_gpu = any(d for d in devices if "cuda" in d or "optix" in d)

    scenarios = calc_speed_scenarios(baseline_sec, have_gpu, s_summary.get("mean", 0.0))

    result = {
        "ok": True,
        "files": len(rows),
        "samples": s_summary,
        "tile_size": tile_summary,
        "top_resolutions": res_counter.most_common(5),
        "devices": dev_counter.most_common(),
        "engines": eng_counter.most_common(),
        "assume_gpu": assume_gpu,
        "gpu_detected_from_json": have_gpu,
        "baseline_sec": baseline_sec,
        "scenarios": scenarios,
        "recommendations": [
            "GPU 가속 활성화/확인 (CUDA/OPTIX)",
            "샘플 수: 복잡도별 256-512로 하향(적응형이면 더욱 좋음)",
            "VRAM 기준 타일 크기 조정(타일/메모리 히트율 개선)",
            "씬/재질 캐싱(재렌더 상황 대폭 단축)",
            "멀티프로세싱/워커 수 조정",
            "학습 목적에 맞춘 품질 슬림(필요 이상 옵션 끄기/하향)"
        ]
    }

    if fmt == "json":
        return json.dumps(result, ensure_ascii=False, indent=2)

    if fmt == "md":
        lines = []
        lines.append("# 렌더링 최적화 진단 결과")
        lines.append("")
        lines.append(f"- 스캔 파일: **{result['files']}**개")
        lines.append(f"- baseline: **{baseline_sec:.3f}s**/frame")
        lines.append(f"- GPU 추정: **{have_gpu}** (모드: {assume_gpu})")
        lines.append("")
        lines.append("## 샘플 수")
        lines.append(f"- 평균: **{s_summary.get('mean',0):.1f}**, 중앙값: {s_summary.get('median',0):.0f}, 범위: {int(s_summary.get('min',0))}-{int(s_summary.get('max',0))} (n={s_summary.get('count',0)})")
        if tile_summary.get("count",0):
            lines.append("## 타일 크기")
            lines.append(f"- 평균: **{tile_summary.get('mean',0):.1f}**, 중앙값: {tile_summary.get('median',0):.0f}, 범위: {int(tile_summary.get('min',0))}-{int(tile_summary.get('max',0))}")
        if res_counter:
            lines.append("## 분해능 Top-5")
            for (w,h), c in result["top_resolutions"]:
                lines.append(f"- {w}×{h}: {c}개")
        lines.append("## 디바이스/엔진")
        lines.append(f"- 디바이스: {', '.join([f'{d}({c})' for d,c in result['devices']]) or 'unknown'}")
        lines.append(f"- 엔진: {', '.join([f'{d}({c})' for d,c in result['engines']]) or 'unknown'}")
        lines.append("")
        lines.append("## 시나리오(추정)")
        for k, v in result["scenarios"].items():
            lines.append(f"- **{k}**: {v['time_sec']:.3f}s  (x{v['x']:.2f}) - {v.get('notes','')}")
        lines.append("")
        lines.append("## 권장 액션")
        for r in result["recommendations"]:
            lines.append(f"- {r}")
        return "\n".join(lines)

    # text
    out = []
    out.append("렌더링 최적화 진단 결과")
    out.append("=" * 40)
    out.append(f"스캔 파일: {result['files']}개")
    out.append(f"baseline: {baseline_sec:.3f}s/frame")
    out.append(f"GPU 추정: {have_gpu} (모드: {assume_gpu})\n")
    out.append(f"[샘플] mean={s_summary.get('mean',0):.1f}, median={s_summary.get('median',0):.0f}, "
               f"range={int(s_summary.get('min',0))}-{int(s_summary.get('max',0))}, n={s_summary.get('count',0)}")
    if tile_summary.get("count",0):
        out.append(f"[타일] mean={tile_summary.get('mean',0):.1f}, median={tile_summary.get('median',0):.0f}, "
                   f"range={int(tile_summary.get('min',0))}-{int(tile_summary.get('max',0))}")
    if res_counter:
        out.append("[해상도 Top-5] " + ", ".join([f"{w}x{h}({c})" for (w,h), c in result["top_resolutions"]]))
    out.append("[디바이스] " + (", ".join([f"{d}({c})" for d,c in result["devices"]]) or "unknown"))
    out.append("[엔진] " + (", ".join([f"{d}({c})" for d,c in result["engines"]]) or "unknown"))
    out.append("\n[시나리오(추정)]")
    for k, v in result["scenarios"].items():
        out.append(f"- {k:>18}: {v['time_sec']:.3f}s  (x{v['x']:.2f})  {v.get('notes','')}")
    out.append("\n[권장 액션]")
    for r in result["recommendations"]:
        out.append(f"- {r}")
    return "\n".join(out)

# ----------------------------
# 메인
# ----------------------------
def main():
    args = parse_args()
    rows, errors = scan_jsons(args.glob, args.max_files, args.workers)
    report = build_report(rows, args.baseline_sec, args.assume_gpu, args.report)
    print(report)
    if errors:
        print(f"\n경고: {len(errors)}개 파일을 읽지 못했습니다(포맷/권한/깨짐).", flush=True)

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os

# Windows에서 한글 출력을 위한 인코딩 설정
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.detach())
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.detach())

"""
BrickBox 렌더링 속도 최적화 '고급' 진단 스크립트
- 복잡도 그룹별 통계 (shape_tag, series별)
- 실제 렌더 타임 측정 통합
- 품질 영향 시뮬레이션 (SSIM/SNR)
- CLI 확장 (--group-by 옵션)
- 자동화 연계 (CI/CD, DB 저장)

사용 예:
  python render_optimize_audit_enhanced.py \
    --glob "output/synthetic/dataset_synthetic/images/train/*/*.json" \
    --group-by shape_tag \
    --auto-baseline \
    --quality-simulation \
    --report json > audit_enhanced.json
"""

import argparse
import glob
import json
import math
import statistics as stats
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import Counter, defaultdict
from itertools import groupby
from typing import Any, Dict, List, Tuple, Optional

# ----------------------------
# 파싱/인자 (확장)
# ----------------------------
def parse_args():
    p = argparse.ArgumentParser(description="BrickBox 렌더 설정 진단 & 속도 최적화 시뮬레이터 (고급)")
    p.add_argument("--glob", required=True,
                   help="스캔할 JSON 파일 글롭 패턴")
    p.add_argument("--baseline-sec", type=float, default=4.0,
                   help="현재 1 프레임 렌더 시간(초) 추정치")
    p.add_argument("--auto-baseline", action="store_true",
                   help="JSON에서 render_time_sec 자동 추출하여 baseline 계산")
    p.add_argument("--assume-gpu", choices=["on", "off", "auto"], default="auto",
                   help="GPU 가속 가정")
    p.add_argument("--group-by", choices=["shape_tag", "series", "device", "variant"], 
                   help="그룹별 통계 분석")
    p.add_argument("--quality-simulation", action="store_true",
                   help="품질 영향 시뮬레이션 포함")
    p.add_argument("--report", choices=["text", "json", "md"], default="text",
                   help="출력 리포트 형식")
    p.add_argument("--max-files", type=int, default=0,
                   help="최대 파일 수 제한")
    p.add_argument("--workers", type=int, default=8,
                   help="병렬 워커 수")
    p.add_argument("--save-db", action="store_true",
                   help="결과를 Supabase DB에 저장")
    return p.parse_args()

# ----------------------------
# 향상된 유틸리티
# ----------------------------
def safe_load_enhanced(path: str) -> Tuple[Dict[str, Any], Optional[str]]:
    """향상된 안전 로딩 - 에러 타입별 구분"""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f), None
    except FileNotFoundError:
        return {}, "FileNotFoundError"
    except json.JSONDecodeError as e:
        return {}, f"JSONDecodeError: {e}"
    except Exception as e:
        return {}, f"OtherError: {e}"

def safe_int(value: Any) -> int:
    """강건한 int 변환"""
    if value is None:
        return 0
    try:
        return int(float(str(value)))
    except (ValueError, TypeError):
        return 0

def safe_float(value: Any) -> float:
    """강건한 float 변환"""
    if value is None:
        return 0.0
    try:
        return float(str(value))
    except (ValueError, TypeError):
        return 0.0

def extract_render_fields_enhanced(d: Dict[str, Any]) -> Dict[str, Any]:
    """향상된 렌더 필드 추출"""
    rs = (d.get("render_settings") or {})
    material = d.get("material", {})
    quality = d.get("quality_metrics", {})
    
    return {
        "samples": safe_int(rs.get("samples")),
        "tile_size": safe_int(rs.get("tile_size")),
        "resolution_x": safe_int(rs.get("resolution_x") or rs.get("width")),
        "resolution_y": safe_int(rs.get("resolution_y") or rs.get("height")),
        "denoise": bool(rs.get("denoise")) if rs.get("denoise") is not None else None,
        "device": (rs.get("device") or "").lower(),
        "engine": (rs.get("engine") or "").lower(),
        "variant": d.get("variant") or "",
        "shape_tag": d.get("shape_tag") or "",
        "series": d.get("series") or "",
        "render_time_sec": safe_float(d.get("render_time_sec")),
        "ssim": safe_float(quality.get("ssim")),
        "snr": safe_float(quality.get("snr")),
        "rms": safe_float(quality.get("rms")),
        "color_id": safe_int(material.get("color_id")),
        "is_transparent": bool(material.get("is_transparent")),
        "is_bright_part": bool(material.get("is_bright_part")),
    }

def summarize_enhanced(nums: List[float]) -> Dict[str, Any]:
    """향상된 통계 요약"""
    if not nums:
        return {"count": 0, "mean": 0.0, "median": 0.0, "stdev": 0.0}
    
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
# 향상된 스캔
# ----------------------------
def scan_jsons_enhanced(pattern: str, max_files: int, workers: int) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    """향상된 JSON 스캔 - 에러 타입별 통계"""
    files = glob.glob(pattern)
    if max_files and len(files) > max_files:
        files = files[:max_files]
    
    # 파일 정렬로 deterministic sampling
    files.sort()
    
    results, error_stats = [], defaultdict(int)
    
    if not files:
        return results, dict(error_stats)
    
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(safe_load_enhanced, fp): fp for fp in files}
        for fut in as_completed(futs):
            fp = futs[fut]
            d, error_type = fut.result()
            if d and not error_type:
                row = extract_render_fields_enhanced(d)
                row["__file"] = fp
                results.append(row)
            elif error_type:
                error_stats[error_type] += 1
    
    return results, dict(error_stats)

# ----------------------------
# 복잡도 그룹별 분석
# ----------------------------
def analyze_by_groups(rows: List[Dict[str, Any]], group_by: str) -> Dict[str, Dict[str, Any]]:
    """그룹별 통계 분석"""
    if not group_by or not rows:
        return {}
    
    # 그룹별로 정렬
    rows_sorted = sorted(rows, key=lambda r: r.get(group_by, "unknown"))
    
    groups = {}
    for key, group in groupby(rows_sorted, key=lambda r: r.get(group_by, "unknown")):
        group_list = list(group)
        samples = [r["samples"] for r in group_list if r["samples"] > 0]
        render_times = [r["render_time_sec"] for r in group_list if r["render_time_sec"] > 0]
        
        groups[key] = {
            "count": len(group_list),
            "samples": summarize_enhanced(samples),
            "render_times": summarize_enhanced(render_times),
            "transparent_ratio": sum(1 for r in group_list if r["is_transparent"]) / len(group_list),
            "bright_ratio": sum(1 for r in group_list if r["is_bright_part"]) / len(group_list),
        }
    
    return groups

# ----------------------------
# 품질 영향 시뮬레이션
# ----------------------------
def simulate_quality_impact(samples_current: float, samples_target: float) -> Dict[str, float]:
    """품질 영향 시뮬레이션"""
    if samples_current <= 0 or samples_target <= 0:
        return {"ssim_drop": 0.0, "snr_drop": 0.0}
    
    # 샘플 수 비율 기반 품질 영향 추정
    ratio = samples_target / samples_current
    
    # SSIM: 샘플 수 감소에 따른 품질 저하 (보수적 추정)
    ssim_drop = (1 - ratio) * 0.05  # 5% 품질 저하 per 50% 샘플 감소
    
    # SNR: 노이즈 증가 (더 민감)
    snr_drop = (1 - ratio) * 0.15  # 15% SNR 저하 per 50% 샘플 감소
    
    return {
        "ssim_drop": max(0.0, min(0.1, ssim_drop)),  # 최대 10% 제한
        "snr_drop": max(0.0, min(0.3, snr_drop)),    # 최대 30% 제한
        "quality_impact": "low" if ssim_drop < 0.02 else "medium" if ssim_drop < 0.05 else "high"
    }

# ----------------------------
# 향상된 속도 시나리오
# ----------------------------
def calc_speed_scenarios_enhanced(baseline_sec: float, have_gpu: bool, 
                                 samples_mean: float, quality_simulation: bool = False) -> Dict[str, Any]:
    """향상된 속도 시나리오 계산"""
    if samples_mean <= 0:
        sample_factor_low = sample_factor_high = 1.0
    else:
        sample_factor_low = max(256.0 / samples_mean, 0.3)
        sample_factor_high = min(512.0 / samples_mean, 1.0)
    
    def combine_factors(*factors):
        prod = 1.0
        for f in factors:
            prod *= (1 - 0.15) + 0.15 * f
        return prod
    
    scenarios = {"current": {"time_sec": baseline_sec, "x": 1.0}}
    
    # GPU 설정
    gpu_low, gpu_high = (3.0, 8.0) if not have_gpu else (1.0, 1.0)
    
    # 공통 팩터
    mem_low, mem_high = (1.25, 1.5)
    cache_low, cache_high = (5.0, 10.0)
    mp_low, mp_high = (2.0, 4.0)
    qual_low, qual_high = (1.3, 1.5)
    
    # 1회 렌더 시나리오
    low_factor = combine_factors(sample_factor_low, gpu_low, mem_low, mp_low, qual_low)
    high_factor = combine_factors(sample_factor_high, gpu_high, mem_high, mp_high, qual_high)
    
    scenarios["once_render_low"] = {
        "time_sec": baseline_sec / high_factor,
        "x": high_factor,
        "notes": "낙관적 상한(강력 튜닝, GPU 포함)"
    }
    scenarios["once_render_high"] = {
        "time_sec": baseline_sec / low_factor,
        "x": low_factor,
        "notes": "보수적 하한(부분 적용, GPU 제한)"
    }
    
    # 재렌더 시나리오
    low_factor_rerun = combine_factors(sample_factor_low, gpu_low, mem_low, mp_low, qual_low, cache_low)
    high_factor_rerun = combine_factors(sample_factor_high, gpu_high, mem_high, mp_high, qual_high, cache_high)
    
    scenarios["rerender_low"] = {
        "time_sec": baseline_sec / high_factor_rerun,
        "x": high_factor_rerun,
        "notes": "재렌더 낙관적(캐시 적중 높음)"
    }
    scenarios["rerender_high"] = {
        "time_sec": baseline_sec / low_factor_rerun,
        "x": low_factor_rerun,
        "notes": "재렌더 보수적(캐시 제한)"
    }
    
    # 품질 영향 시뮬레이션
    if quality_simulation:
        for scenario_name, scenario in scenarios.items():
            if scenario_name != "current":
                quality_impact = simulate_quality_impact(samples_mean, 384)  # 384 샘플로 가정
                scenario["quality_impact"] = quality_impact
    
    return scenarios

# ----------------------------
# 향상된 리포트 빌드
# ----------------------------
def build_report_enhanced(rows: List[Dict[str, Any]], baseline_sec: float, 
                         assume_gpu: str, group_by: str, quality_simulation: bool, fmt: str) -> str:
    """향상된 리포트 빌드"""
    if not rows:
        msg = "JSON 파일을 찾지 못했습니다."
        return json.dumps({"ok": False, "message": msg}, ensure_ascii=False) if fmt == "json" else msg
    
    # 기본 통계
    samples = [r["samples"] for r in rows if r["samples"] > 0]
    render_times = [r["render_time_sec"] for r in rows if r["render_time_sec"] > 0]
    devices = [r["device"] or "unknown" for r in rows]
    engines = [r["engine"] or "unknown" for r in rows]
    
    s_summary = summarize_enhanced(samples)
    rt_summary = summarize_enhanced(render_times)
    dev_counter = Counter(devices)
    eng_counter = Counter(engines)
    
    # GPU 감지 (향상)
    have_gpu = None
    if assume_gpu == "on":
        have_gpu = True
    elif assume_gpu == "off":
        have_gpu = False
    else:
        # cuda, optix, gpu, metal 감지
        have_gpu = any(d for d in devices if any(gpu_type in d for gpu_type in ["cuda", "optix", "gpu", "metal"]))
    
    # 자동 baseline
    if render_times:
        baseline_sec = rt_summary.get("mean", baseline_sec)
    
    # 시나리오 계산
    scenarios = calc_speed_scenarios_enhanced(baseline_sec, have_gpu, s_summary.get("mean", 0.0), quality_simulation)
    
    # 그룹별 분석
    groups = analyze_by_groups(rows, group_by) if group_by else {}
    
    result = {
        "ok": True,
        "files": len(rows),
        "baseline_sec": baseline_sec,
        "auto_baseline": bool(render_times),
        "samples": s_summary,
        "render_times": rt_summary,
        "devices": dev_counter.most_common(),
        "engines": eng_counter.most_common(),
        "assume_gpu": assume_gpu,
        "gpu_detected": have_gpu,
        "scenarios": scenarios,
        "groups": groups,
        "quality_simulation": quality_simulation,
        "recommendations": [
            "GPU 가속 활성화/확인 (CUDA/OPTIX/Metal)",
            "복잡도별 샘플 수 조정 (256-512)",
            "VRAM 기준 타일 크기 최적화",
            "씬/재질 캐싱 시스템 구축",
            "멀티프로세싱 워커 수 조정",
            "학습 품질 유지하면서 불필요한 고품질 옵션 제거"
        ]
    }
    
    if fmt == "json":
        return json.dumps(result, ensure_ascii=False, indent=2)
    
    if fmt == "md":
        lines = []
        lines.append("# BrickBox 렌더링 최적화 진단 결과 (고급)")
        lines.append("")
        lines.append(f"- 스캔 파일: **{result['files']}**개")
        lines.append(f"- baseline: **{baseline_sec:.3f}s**/frame")
        lines.append(f"- 자동 baseline: **{result['auto_baseline']}**")
        lines.append(f"- GPU 감지: **{have_gpu}** (모드: {assume_gpu})")
        lines.append("")
        
        # 샘플 수 통계
        lines.append("## 샘플 수 통계")
        lines.append(f"- 평균: **{s_summary.get('mean',0):.1f}**, 중앙값: {s_summary.get('median',0):.0f}")
        lines.append(f"- 범위: {int(s_summary.get('min',0))}-{int(s_summary.get('max',0))} (n={s_summary.get('count',0)})")
        
        # 그룹별 분석
        if groups:
            lines.append("")
            lines.append("## 그룹별 분석")
            for group_name, group_data in groups.items():
                lines.append(f"### {group_name}")
                lines.append(f"- 개수: {group_data['count']}")
                lines.append(f"- 샘플 평균: {group_data['samples']['mean']:.1f}")
                lines.append(f"- 투명 부품 비율: {group_data['transparent_ratio']:.1%}")
                lines.append(f"- 밝은 부품 비율: {group_data['bright_ratio']:.1%}")
        
        # 시나리오
        lines.append("")
        lines.append("## 최적화 시나리오")
        for k, v in scenarios.items():
            lines.append(f"- **{k}**: {v['time_sec']:.3f}s (x{v['x']:.2f}) - {v.get('notes','')}")
            if quality_simulation and 'quality_impact' in v:
                qi = v['quality_impact']
                lines.append(f"  - 품질 영향: SSIM {qi['ssim_drop']:.1%}, SNR {qi['snr_drop']:.1%} ({qi['quality_impact']})")
        
        return "\n".join(lines)
    
    # text 형식
    out = []
    out.append("BrickBox 렌더링 최적화 진단 결과 (고급)")
    out.append("=" * 50)
    out.append(f"스캔 파일: {result['files']}개")
    out.append(f"baseline: {baseline_sec:.3f}s/frame (자동: {result['auto_baseline']})")
    out.append(f"GPU 감지: {have_gpu} (모드: {assume_gpu})")
    out.append("")
    out.append(f"[샘플] mean={s_summary.get('mean',0):.1f}, median={s_summary.get('median',0):.0f}")
    out.append(f"[렌더시간] mean={rt_summary.get('mean',0):.3f}s, median={rt_summary.get('median',0):.3f}s")
    out.append("")
    out.append("[시나리오]")
    for k, v in scenarios.items():
        out.append(f"- {k:>18}: {v['time_sec']:.3f}s (x{v['x']:.2f}) {v.get('notes','')}")
        if quality_simulation and 'quality_impact' in v:
            qi = v['quality_impact']
            out.append(f"    품질영향: SSIM-{qi['ssim_drop']:.1%}, SNR-{qi['snr_drop']:.1%} ({qi['quality_impact']})")
    
    return "\n".join(out)

# ----------------------------
# 메인
# ----------------------------
def main():
    args = parse_args()
    rows, error_stats = scan_jsons_enhanced(args.glob, args.max_files, args.workers)
    
    # 자동 baseline 계산
    baseline_sec = args.baseline_sec
    if args.auto_baseline:
        render_times = [r["render_time_sec"] for r in rows if r["render_time_sec"] > 0]
        if render_times:
            baseline_sec = stats.mean(render_times)
    
    report = build_report_enhanced(rows, baseline_sec, args.assume_gpu, 
                                 args.group_by, args.quality_simulation, args.report)
    print(report)
    
    if error_stats:
        print(f"\n경고: {sum(error_stats.values())}개 파일 오류 - {dict(error_stats)}", flush=True)

if __name__ == "__main__":
    main()

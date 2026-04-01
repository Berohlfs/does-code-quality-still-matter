#!/usr/bin/env python3
"""Analyze and compare experiment results across paths.

Usage:
    python analyze.py --results-dir ./results --problem circuit_eval
"""

import argparse
import json
import sys
from pathlib import Path

PATHS_CONFIG = {
    "A": "Slop",
    "B": "Anti-slop",
    "C": "Refactored",
    "D": "Slop+Context",
}

MANIFEST_FILENAME = "paths_manifest.json"
REFACTOR_USAGE_FILENAME = "refactor_usage.json"
CONTEXT_USAGE_FILENAME = "context_usage.json"


def get_checkpoints(problem_dir: Path) -> list[str]:
    return sorted(
        [d.name for d in problem_dir.iterdir() if d.is_dir() and d.name.startswith("checkpoint_")],
        key=lambda n: int(n.split("_")[1]),
    )


def load_manifest(results_dir: Path) -> dict:
    manifest_path = results_dir / MANIFEST_FILENAME
    if manifest_path.exists():
        return json.loads(manifest_path.read_text())
    return {}


def load_quality(quality_file: Path) -> dict | None:
    if not quality_file.exists():
        return None
    q = json.loads(quality_file.read_text())
    lines = q.get("lines", {})
    complexity = q.get("complexity", {})
    waste = q.get("waste", {})
    redundancy = q.get("redundancy", {})
    lint = q.get("lint", {})
    loc = lines.get("loc", 0)
    return {
        "loc": loc,
        "cc_max": complexity.get("cc_max"),
        "cc_mean": complexity.get("cc_mean"),
        "mi_min": complexity.get("mi_min"),
        "single_use_fns": waste.get("single_use_functions", 0),
        "trivial_wrappers": waste.get("trivial_wrappers", 0),
        "unused_vars": waste.get("unused_variables", 0),
        "clone_ratio": redundancy.get("clone_ratio_sum", 0),
        "clone_lines": redundancy.get("clone_lines", 0),
        "lint_errors": lint.get("errors", 0),
        "lint_per_loc": round(lint.get("errors", 0) / loc, 4) if loc else 0,
    }


def load_inference(inference_file: Path) -> dict | None:
    if not inference_file.exists():
        return None
    d = json.loads(inference_file.read_text())
    net = d.get("usage", {}).get("net_tokens", {})
    return {
        "input_tokens": net.get("input", 0),
        "output_tokens": net.get("output", 0),
        "cache_read_tokens": net.get("cache_read", 0),
        "steps": d.get("usage", {}).get("steps", 0),
        "elapsed": round(d.get("elapsed", 0), 1),
        "cost": round(d.get("usage", {}).get("cost", 0), 4),
        "had_error": d.get("had_error", False),
    }


def load_evaluation(eval_file: Path, last_cp: str) -> dict:
    if not eval_file.exists():
        return {"tests_passed": "N/A", "tests_pct": "N/A", "core_passed": "N/A"}
    ev = json.loads(eval_file.read_text())
    tests = ev.get("tests", {})
    total_passed = sum(len(v.get("passed", [])) for v in tests.values())
    total_tests = total_passed + sum(len(v.get("failed", [])) for v in tests.values())
    core_key = f"{last_cp}-Core"
    core = tests.get(core_key, {})
    core_passed = len(core.get("passed", []))
    core_total = core_passed + len(core.get("failed", []))
    return {
        "tests_passed": f"{total_passed}/{total_tests}" if total_tests else "N/A",
        "tests_pct": round(total_passed / total_tests * 100, 1) if total_tests else 0,
        "core_passed": f"{core_passed}/{core_total}" if core_total else "N/A",
    }


def load_metrics(results_dir: Path, problem: str) -> dict:
    manifest = load_manifest(results_dir)
    results = {}

    for path_id, label in PATHS_CONFIG.items():
        if path_id not in manifest:
            continue

        path_dir = Path(manifest[path_id])
        problem_dir = path_dir / problem
        if not problem_dir.exists():
            continue

        checkpoints = get_checkpoints(problem_dir)
        if not checkpoints:
            continue

        last_cp = checkpoints[-1]
        penultimate_cp = checkpoints[-2] if len(checkpoints) >= 2 else None

        entry = {"label": label, "checkpoint": last_cp}

        # --- Setup cost: sum of checkpoints 1 to N-1 ---
        setup_cost = 0.0
        setup_tokens = 0
        setup_steps = 0
        setup_elapsed = 0.0
        for cp in checkpoints[:-1]:
            inf = load_inference(problem_dir / cp / "inference_result.json")
            if inf:
                setup_cost += inf["cost"]
                setup_tokens += inf["output_tokens"]
                setup_steps += inf["steps"]
                setup_elapsed += inf["elapsed"]
        entry["setup_cost"] = round(setup_cost, 4)
        entry["setup_output_tokens"] = setup_tokens
        entry["setup_steps"] = setup_steps
        entry["setup_elapsed"] = round(setup_elapsed, 1)

        # --- Feature cost: final checkpoint ---
        feature_inf = load_inference(problem_dir / last_cp / "inference_result.json")
        if not feature_inf:
            continue
        for k, v in feature_inf.items():
            entry[f"feature_{k}"] = v

        # --- Total cost (setup + feature) ---
        entry["total_cost"] = round(setup_cost + feature_inf["cost"], 4)
        entry["total_output_tokens"] = setup_tokens + feature_inf["output_tokens"]
        entry["total_steps"] = setup_steps + feature_inf["steps"]

        # --- Correctness ---
        eval_data = load_evaluation(problem_dir / last_cp / "evaluation.json", last_cp)
        entry.update(eval_data)

        # --- Quality BEFORE feature (checkpoint N-1) ---
        if penultimate_cp:
            q_before = load_quality(problem_dir / penultimate_cp / "quality_analysis" / "overall_quality.json")
            if q_before:
                for k, v in q_before.items():
                    entry[f"quality_before_{k}"] = v

        # --- Quality AFTER feature (checkpoint N) ---
        q_after = load_quality(problem_dir / last_cp / "quality_analysis" / "overall_quality.json")
        if q_after:
            for k, v in q_after.items():
                entry[f"quality_after_{k}"] = v

        # --- Post-refactor quality (Path C only, from snapshot metrics) ---
        if path_id == "C" and penultimate_cp:
            snapshot_quality = load_quality(
                problem_dir / penultimate_cp / "snapshot" / "overall_quality.json"
            )
            if snapshot_quality:
                for k, v in snapshot_quality.items():
                    entry[f"quality_refactored_{k}"] = v

        results[path_id] = entry

    # --- Load transformation usage (refactor / context) ---
    refactor_usage_file = results_dir / REFACTOR_USAGE_FILENAME
    if refactor_usage_file.exists() and "C" in results:
        usage = json.loads(refactor_usage_file.read_text())
        results["C"]["refactor_cost"] = usage.get("cost", 0)
        results["C"]["refactor_output_tokens"] = usage.get("output_tokens", 0)
        results["C"]["refactor_input_tokens"] = usage.get("input_tokens", 0)

    context_usage_file = results_dir / CONTEXT_USAGE_FILENAME
    if context_usage_file.exists() and "D" in results:
        usage = json.loads(context_usage_file.read_text())
        results["D"]["context_cost"] = usage.get("cost", 0)
        results["D"]["context_output_tokens"] = usage.get("output_tokens", 0)

    return results


def fmt(val):
    if val is None:
        return "N/A"
    if isinstance(val, float):
        return f"{val:,.2f}"
    if isinstance(val, int):
        return f"{val:,}"
    return str(val)


def print_table(title: str, headers: list, metrics: list[tuple], results: dict):
    try:
        from tabulate import tabulate
    except ImportError:
        print(f"\n{title}")
        for pid, r in results.items():
            print(f"  Path {pid}: {r.get('label')}")
            for label, key in metrics:
                print(f"    {label}: {r.get(key, 'N/A')}")
        return

    rows = [[label] + [fmt(r.get(key, "N/A")) for r in results.values()] for label, key in metrics]
    print(f"\n{'=' * 80}")
    print(title)
    print("=" * 80)
    print(tabulate(rows, headers=headers, tablefmt="grid"))


def print_delta_table(title: str, baseline_id: str, delta_keys: list[tuple], results: dict):
    try:
        from tabulate import tabulate
    except ImportError:
        return

    if baseline_id not in results:
        return

    baseline = results[baseline_id]
    others = {pid: r for pid, r in results.items() if pid != baseline_id}
    if not others:
        return

    delta_headers = ["Metric"] + [f"{pid}: {r['label']}" for pid, r in others.items()]
    delta_rows = []
    for label, key in delta_keys:
        row = [label]
        base = baseline.get(key)
        for r in others.values():
            curr = r.get(key)
            if base and curr is not None and isinstance(base, (int, float)) and isinstance(curr, (int, float)):
                pct = ((curr - base) / base) * 100
                row.append(f"{pct:+.1f}%")
            else:
                row.append("N/A")
        delta_rows.append(row)

    print(f"\n{'=' * 80}")
    print(title)
    print("=" * 80)
    print(tabulate(delta_rows, headers=delta_headers, tablefmt="grid"))


def print_report(results: dict):
    headers = ["Metric"] + [f"{pid}: {r['label']}" for pid, r in results.items()]

    # --- 1. Setup Cost (before N+1) ---
    print_table("SETUP COST (Checkpoints 1 to N-1)", headers, [
        ("Output tokens", "setup_output_tokens"),
        ("Steps", "setup_steps"),
        ("Elapsed (s)", "setup_elapsed"),
        ("Cost ($)", "setup_cost"),
    ], results)

    # --- 2. Transformation Cost (Path C: refactor, Path D: context) ---
    transform_metrics = [
        ("Refactor output tokens (C only)", "refactor_output_tokens"),
        ("Refactor cost (C only)", "refactor_cost"),
        ("Context output tokens (D only)", "context_output_tokens"),
        ("Context cost (D only)", "context_cost"),
    ]
    has_transform = any(r.get("refactor_cost") or r.get("context_cost") for r in results.values())
    if has_transform:
        print_table("TRANSFORMATION COST", headers, transform_metrics, results)

    # --- 3. Feature Cost (final checkpoint) ---
    print_table("FEATURE ADDITION COST (Final Checkpoint)", headers, [
        ("Output tokens", "feature_output_tokens"),
        ("Cache read tokens", "feature_cache_read_tokens"),
        ("Steps", "feature_steps"),
        ("Elapsed (s)", "feature_elapsed"),
        ("Cost ($)", "feature_cost"),
        ("Had error", "feature_had_error"),
    ], results)

    # --- 4. Total Cost ---
    print_table("TOTAL COST (Setup + Feature)", headers, [
        ("Output tokens", "total_output_tokens"),
        ("Steps", "total_steps"),
        ("Cost ($)", "total_cost"),
    ], results)

    # --- 5. Correctness ---
    print_table("CORRECTNESS (Final Checkpoint)", headers, [
        ("All tests", "tests_passed"),
        ("Pass rate (%)", "tests_pct"),
        ("Core tests", "core_passed"),
    ], results)

    # --- 6. Code Quality BEFORE Feature ---
    has_before = any(r.get("quality_before_loc") for r in results.values())
    if has_before:
        print_table("CODE QUALITY BEFORE FEATURE (Checkpoint N-1)", headers, [
            ("LOC", "quality_before_loc"),
            ("CC max", "quality_before_cc_max"),
            ("Single-use fns", "quality_before_single_use_fns"),
            ("Unused vars", "quality_before_unused_vars"),
            ("Clone ratio", "quality_before_clone_ratio"),
            ("Lint errors", "quality_before_lint_errors"),
            ("Lint / LOC", "quality_before_lint_per_loc"),
        ], results)

    # --- 7. Refactoring Impact (Path C only) ---
    if "C" in results and results["C"].get("quality_refactored_loc"):
        c = results["C"]
        print(f"\n{'=' * 80}")
        print("REFACTORING IMPACT (Path C: before vs after refactor, same checkpoint)")
        print("=" * 80)
        refactor_metrics = ["loc", "cc_max", "single_use_fns", "unused_vars", "clone_ratio", "lint_errors", "lint_per_loc"]
        try:
            from tabulate import tabulate
            rows = []
            for key in refactor_metrics:
                before = c.get(f"quality_before_{key}")
                after = c.get(f"quality_refactored_{key}")
                delta = ""
                if before is not None and after is not None and isinstance(before, (int, float)) and before != 0:
                    pct = ((after - before) / before) * 100
                    delta = f"{pct:+.1f}%"
                rows.append([key, fmt(before), fmt(after), delta])
            print(tabulate(rows, headers=["Metric", "Before refactor", "After refactor", "Change"], tablefmt="grid"))
        except ImportError:
            for key in refactor_metrics:
                print(f"  {key}: {c.get(f'quality_before_{key}')} -> {c.get(f'quality_refactored_{key}')}")

    # --- 8. Code Quality AFTER Feature ---
    has_after = any(r.get("quality_after_loc") for r in results.values())
    if has_after:
        print_table("CODE QUALITY AFTER FEATURE (Final Checkpoint)", headers, [
            ("LOC", "quality_after_loc"),
            ("CC max", "quality_after_cc_max"),
            ("Single-use fns", "quality_after_single_use_fns"),
            ("Unused vars", "quality_after_unused_vars"),
            ("Clone ratio", "quality_after_clone_ratio"),
            ("Lint errors", "quality_after_lint_errors"),
            ("Lint / LOC", "quality_after_lint_per_loc"),
        ], results)

    # --- 9. Delta Tables ---
    print_delta_table("% CHANGE FROM PATH A — FEATURE COST", "A", [
        ("Output tokens", "feature_output_tokens"),
        ("Steps", "feature_steps"),
        ("Elapsed (s)", "feature_elapsed"),
        ("Cost ($)", "feature_cost"),
    ], results)

    if has_after:
        print_delta_table("% CHANGE FROM PATH A — CODE QUALITY AFTER FEATURE", "A", [
            ("LOC", "quality_after_loc"),
            ("CC max", "quality_after_cc_max"),
            ("Clone ratio", "quality_after_clone_ratio"),
            ("Lint errors", "quality_after_lint_errors"),
            ("Single-use fns", "quality_after_single_use_fns"),
            ("Unused vars", "quality_after_unused_vars"),
        ], results)


def print_aggregate(all_results: dict[str, dict]):
    """Print aggregate metrics across multiple problems."""
    try:
        from tabulate import tabulate
    except ImportError:
        print("Install tabulate: pip install tabulate", file=sys.stderr)
        return

    # Collect per-path averages across problems
    path_ids = list(PATHS_CONFIG.keys())
    agg = {pid: {} for pid in path_ids}
    problem_counts = {pid: 0 for pid in path_ids}

    agg_keys = [
        "feature_cost", "feature_steps", "feature_elapsed", "feature_output_tokens",
        "setup_cost", "total_cost", "tests_pct",
        "quality_after_cc_max", "quality_after_clone_ratio", "quality_after_lint_per_loc",
    ]

    for problem, results in all_results.items():
        for pid in path_ids:
            if pid not in results:
                continue
            r = results[pid]
            problem_counts[pid] += 1
            for key in agg_keys:
                val = r.get(key)
                if val is not None and isinstance(val, (int, float)):
                    agg[pid].setdefault(key, []).append(val)

    active_paths = {pid: PATHS_CONFIG[pid] for pid in path_ids if problem_counts[pid] > 0}
    if not active_paths:
        return

    headers = ["Metric"] + [f"{pid}: {label} (n={problem_counts[pid]})" for pid, label in active_paths.items()]

    def mean_fmt(pid, key):
        vals = agg[pid].get(key, [])
        if not vals:
            return "N/A"
        avg = sum(vals) / len(vals)
        return f"{avg:,.2f}" if isinstance(vals[0], float) else f"{avg:,.0f}"

    metrics = [
        ("Avg feature cost ($)", "feature_cost"),
        ("Avg feature steps", "feature_steps"),
        ("Avg feature elapsed (s)", "feature_elapsed"),
        ("Avg feature output tokens", "feature_output_tokens"),
        ("Avg setup cost ($)", "setup_cost"),
        ("Avg total cost ($)", "total_cost"),
        ("Avg test pass rate (%)", "tests_pct"),
        ("Avg CC max (after)", "quality_after_cc_max"),
        ("Avg clone ratio (after)", "quality_after_clone_ratio"),
        ("Avg lint/LOC (after)", "quality_after_lint_per_loc"),
    ]

    rows = [[label] + [mean_fmt(pid, key) for pid in active_paths] for label, key in metrics]

    print(f"\n{'=' * 80}")
    print(f"AGGREGATE RESULTS ACROSS {len(all_results)} PROBLEMS")
    print("=" * 80)
    print(f"Problems: {', '.join(all_results.keys())}")
    print(tabulate(rows, headers=headers, tablefmt="grid"))


def main():
    parser = argparse.ArgumentParser(description="Analyze experiment results")
    parser.add_argument("--results-dir", type=Path, default=Path("./results"), help="Results directory")
    parser.add_argument("--problem", default=None, help="Problem name (omit to aggregate all)")
    parser.add_argument("--json-output", type=Path, help="Save results as JSON")
    args = parser.parse_args()

    results_dir = args.results_dir.resolve()

    if args.problem:
        # Single problem mode — check both old flat layout and new namespaced layout
        problem_dir = results_dir / args.problem
        if (problem_dir / MANIFEST_FILENAME).exists():
            results = load_metrics(problem_dir, args.problem)
        else:
            results = load_metrics(results_dir, args.problem)

        if not results:
            print(f"No results found for problem '{args.problem}'", file=sys.stderr)
            sys.exit(1)

        print(f"\n### Problem: {args.problem}")
        print_report(results)

        if args.json_output:
            clean = {k: {kk: vv for kk, vv in v.items() if kk != "mi_ratings"} for k, v in results.items()}
            with open(args.json_output, "w") as f:
                json.dump(clean, f, indent=2)
            print(f"\nJSON results saved to: {args.json_output}")
    else:
        # Aggregate mode — find all problem subdirectories with manifests
        all_results = {}

        # Check namespaced layout: results/{problem}/paths_manifest.json
        for child in sorted(results_dir.iterdir()):
            if child.is_dir() and (child / MANIFEST_FILENAME).exists():
                problem = child.name
                results = load_metrics(child, problem)
                if results:
                    all_results[problem] = results

        # Also check flat layout: results/paths_manifest.json
        if (results_dir / MANIFEST_FILENAME).exists() and not all_results:
            # Try to infer problem from manifest
            manifest = load_manifest(results_dir)
            for pid, path in manifest.items():
                p = Path(path)
                for child in p.iterdir():
                    if child.is_dir() and (child / "checkpoint_1").exists():
                        problem = child.name
                        results = load_metrics(results_dir, problem)
                        if results:
                            all_results[problem] = results
                        break
                break

        if not all_results:
            print("No results found. Run with --problem to analyze a specific problem.", file=sys.stderr)
            sys.exit(1)

        # Print per-problem reports
        for problem, results in all_results.items():
            print(f"\n{'#' * 80}")
            print(f"### Problem: {problem}")
            print(f"{'#' * 80}")
            print_report(results)

        # Print aggregate
        if len(all_results) > 1:
            print_aggregate(all_results)

        if args.json_output:
            with open(args.json_output, "w") as f:
                json.dump(all_results, f, indent=2, default=str)
            print(f"\nJSON results saved to: {args.json_output}")


if __name__ == "__main__":
    main()

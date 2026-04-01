#!/usr/bin/env python3
"""Orchestrate the code quality experiment across four paths.

Usage:
    python orchestrate.py --bench-dir ../slop-code-bench --problem file_backup --model anthropic/opus-4.5
"""

import argparse
import json
import logging
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

PATHS_CONFIG = {
    "A": {"label": "Slop", "prompt": "just-solve"},
    "B": {"label": "Anti-slop", "prompt": "anti_slop"},
    "C": {"label": "Refactored", "prompt": "just-solve"},
    "D": {"label": "Slop+Context", "prompt": "just-solve"},
}

PROMPTS_DIR = Path(__file__).parent / "prompts"
CLAUDE_CREDENTIALS = Path.home() / ".claude" / ".credentials.json"
MANIFEST_FILENAME = "paths_manifest.json"
REFACTOR_USAGE_FILENAME = "refactor_usage.json"
CONTEXT_USAGE_FILENAME = "context_usage.json"


def refresh_claude_oauth_env():
    """Extract Claude Code OAuth token and set it as CLAUDE_CODE_OAUTH_TOKEN.

    Triggers a lightweight Claude CLI call to force an OAuth token refresh,
    then reads the fresh token from disk. This prevents expired token issues
    during long runs.
    """
    if os.environ.get("ANTHROPIC_API_KEY"):
        return  # Using API key, no need for OAuth

    if not CLAUDE_CREDENTIALS.exists():
        log.error("No ANTHROPIC_API_KEY or Claude Code OAuth credentials found.")
        log.error("Either export ANTHROPIC_API_KEY or authenticate with: claude auth login")
        sys.exit(1)

    # Force Claude to refresh the OAuth token by making a trivial API call
    log.info("Refreshing OAuth token...")
    subprocess.run(
        ["claude", "-p", "say ok", "--max-turns", "1", "--output-format", "json"],
        capture_output=True, text=True, timeout=30,
    )

    creds = json.loads(CLAUDE_CREDENTIALS.read_text())
    token = creds.get("claudeAiOauth", {}).get("accessToken")
    if not token:
        log.error("No OAuth access token found in %s", CLAUDE_CREDENTIALS)
        sys.exit(1)

    os.environ["CLAUDE_CODE_OAUTH_TOKEN"] = token
    log.info("OAuth token refreshed")


def get_api_key_args() -> list[str]:
    if os.environ.get("ANTHROPIC_API_KEY"):
        return []
    return ["--provider-api-key-env", "CLAUDE_CODE_OAUTH_TOKEN"]


def run_cmd(args: list[str], cwd: Path | None = None, check: bool = True,
            capture: bool = False) -> subprocess.CompletedProcess:
    log.info("Running: %s", " ".join(str(a) for a in args))
    result = subprocess.run(
        args, cwd=cwd,
        capture_output=capture, text=True, check=check,
    )
    return result


MAX_RETRIES = 3
RETRY_DELAY = 10  # seconds


def run_claude_with_usage(prompt: str, cwd: Path) -> dict:
    """Run claude -p and capture token usage via --output-format json."""
    for attempt in range(1, MAX_RETRIES + 1):
        refresh_claude_oauth_env()
        log.info("Running claude -p (with usage capture) in %s (attempt %d/%d)", cwd, attempt, MAX_RETRIES)
        result = subprocess.run(
            ["claude", "-p", prompt, "--dangerously-skip-permissions", "--output-format", "json"],
            cwd=cwd, capture_output=True, text=True,
        )

        if result.returncode == 0 and result.stdout:
            try:
                data = json.loads(result.stdout)
                # Check for auth/API errors in the result
                if data.get("is_error") and "Invalid API key" in data.get("result", ""):
                    log.warning("Auth error on attempt %d, refreshing token and retrying...", attempt)
                    import time; time.sleep(RETRY_DELAY)
                    continue
                return {
                    "input_tokens": data.get("usage", {}).get("input_tokens", 0),
                    "output_tokens": data.get("usage", {}).get("output_tokens", 0),
                    "cache_read_tokens": data.get("usage", {}).get("cache_read_input_tokens", 0),
                    "cache_write_tokens": data.get("usage", {}).get("cache_creation_input_tokens", 0),
                    "cost": data.get("total_cost_usd", 0),
                }
            except json.JSONDecodeError:
                log.warning("Could not parse claude JSON output on attempt %d", attempt)

        log.warning("claude -p failed (attempt %d/%d): %s",
                     attempt, MAX_RETRIES, (result.stderr or "")[:300])
        if attempt < MAX_RETRIES:
            import time; time.sleep(RETRY_DELAY)

    log.error("claude -p failed after %d attempts", MAX_RETRIES)
    return {}


def run_benchmark_cmd(args: list[str], cwd: Path) -> Path:
    """Run a benchmark command and extract the output directory.

    Refreshes OAuth token before each attempt and retries on failure.
    """
    for attempt in range(1, MAX_RETRIES + 1):
        refresh_claude_oauth_env()
        log.info("Running (attempt %d/%d): %s", attempt, MAX_RETRIES, " ".join(str(a) for a in args))
        result = subprocess.run(args, cwd=cwd, capture_output=True, text=True)

        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)

        combined = (result.stdout or "") + (result.stderr or "")

        if result.returncode != 0:
            # Check if it's an auth/transient error worth retrying
            if any(err in combined for err in ["Invalid API key", "authentication", "500", "503", "rate_limit"]):
                log.warning("Transient error on attempt %d/%d, retrying in %ds...", attempt, MAX_RETRIES, RETRY_DELAY)
                if attempt < MAX_RETRIES:
                    import time; time.sleep(RETRY_DELAY)
                    continue
            raise subprocess.CalledProcessError(result.returncode, args)

        match = re.search(r"Output directory:\s*(.+?)(?:\n|$)", combined)
        if match:
            out_dir = match.group(1).strip()
            out_path = Path(out_dir)
            if not out_path.is_absolute():
                out_path = cwd / out_path
            return out_path.resolve()

        match = re.search(r"path='(.+?/result\.json)'", combined)
        if match:
            return Path(match.group(1)).parent.resolve()

        raise RuntimeError("Could not determine benchmark output directory from command output")

    raise RuntimeError(f"Benchmark command failed after {MAX_RETRIES} attempts")


def load_manifest(output_dir: Path) -> dict:
    manifest_path = output_dir / MANIFEST_FILENAME
    if manifest_path.exists():
        return json.loads(manifest_path.read_text())
    return {}


def save_manifest(output_dir: Path, manifest: dict):
    manifest_path = output_dir / MANIFEST_FILENAME
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)


def get_checkpoints(problem_dir: Path) -> list[str]:
    return sorted(
        [d.name for d in problem_dir.iterdir() if d.is_dir() and d.name.startswith("checkpoint_")],
        key=lambda n: int(n.split("_")[1]),
    )


def get_last_checkpoint(problem_dir: Path) -> str:
    cps = get_checkpoints(problem_dir)
    if not cps:
        raise FileNotFoundError(f"No checkpoints found in {problem_dir}")
    return cps[-1]


def get_penultimate_checkpoint(problem_dir: Path) -> str:
    """Get the last available checkpoint (which is the one before the deleted final checkpoint)."""
    cps = get_checkpoints(problem_dir)
    if not cps:
        raise FileNotFoundError(f"No checkpoints found in {problem_dir}")
    return cps[-1]


# ---------------------------------------------------------------------------
# Phase 1: Run benchmark for paths A and B
# ---------------------------------------------------------------------------

def count_problem_checkpoints(bench_dir: Path, problem: str) -> int:
    """Count the number of checkpoint spec files for a problem."""
    problem_dir = bench_dir / "problems" / problem
    return len(list(problem_dir.glob("checkpoint_*.md")))


def count_completed_checkpoints(run_dir: Path, problem: str) -> int:
    """Count completed checkpoints in a run output."""
    problem_dir = run_dir / problem
    if not problem_dir.exists():
        return 0
    completed = 0
    for cp_dir in problem_dir.iterdir():
        if cp_dir.is_dir() and cp_dir.name.startswith("checkpoint_"):
            if (cp_dir / "inference_result.json").exists():
                completed += 1
    return completed


def run_all_checkpoints(bench_dir: Path, run_dir: Path | None, problem: str,
                        model: str, prompt: str, total_checkpoints: int,
                        path_id: str) -> Path:
    """Run all checkpoints for a path, refreshing OAuth between each attempt.

    On first call (run_dir=None), starts a fresh benchmark run.
    On subsequent calls or retries, resumes from the last completed checkpoint.
    Loops until all checkpoints are done or a non-auth error occurs.
    """
    prev_completed = 0
    stall_count = 0

    for attempt in range(total_checkpoints * MAX_RETRIES):
        refresh_claude_oauth_env()

        if run_dir is None:
            log.info("Path %s: starting fresh run", path_id)
            run_dir = run_benchmark_cmd(
                [
                    "uv", "run", "slop-code", "run",
                    "--agent", "claude_code",
                    "--model", model,
                    "--environment", "docker-python3.12-uv",
                    "--prompt", prompt,
                    "--problem", problem,
                    *get_api_key_args(),
                ],
                cwd=bench_dir,
            )
        else:
            completed = count_completed_checkpoints(run_dir, problem)
            if completed >= total_checkpoints:
                log.info("Path %s: all %d checkpoints done", path_id, total_checkpoints)
                return run_dir

            log.info("Path %s: resuming (%d/%d checkpoints done)",
                     path_id, completed, total_checkpoints)
            run_cmd(
                [
                    "uv", "run", "slop-code", "run",
                    "--resume", str(run_dir),
                    "--problem", problem,
                    *get_api_key_args(),
                ],
                cwd=bench_dir,
                check=False,
            )

        completed = count_completed_checkpoints(run_dir, problem)
        if completed >= total_checkpoints:
            log.info("Path %s: all %d checkpoints done", path_id, total_checkpoints)
            return run_dir

        # Check if we made progress
        if completed > prev_completed:
            prev_completed = completed
            stall_count = 0
        else:
            stall_count += 1
            if stall_count >= MAX_RETRIES:
                log.warning("Path %s: stalled at %d/%d checkpoints after %d retries",
                            path_id, completed, total_checkpoints, MAX_RETRIES)
                return run_dir

    return run_dir


def phase1_run_benchmark(bench_dir: Path, output_dir: Path, problem: str, model: str, paths: list[str]):
    log.info("=== Phase 1: Running benchmark for paths A and B ===")
    manifest = load_manifest(output_dir)
    total_checkpoints = count_problem_checkpoints(bench_dir, problem)
    log.info("Problem '%s' has %d checkpoints", problem, total_checkpoints)

    for path_id in ["A", "B"]:
        if path_id not in paths:
            log.info("Skipping path %s (not requested)", path_id)
            continue

        existing_dir = Path(manifest[path_id]) if path_id in manifest else None
        if existing_dir and count_completed_checkpoints(existing_dir, problem) >= total_checkpoints:
            log.info("Path %s already completed (skipping)", path_id)
            continue

        prompt = PATHS_CONFIG[path_id]["prompt"]
        log.info("Running path %s (%s) with prompt '%s'", path_id, PATHS_CONFIG[path_id]["label"], prompt)

        run_dir = run_all_checkpoints(
            bench_dir, existing_dir, problem, model, prompt, total_checkpoints, path_id,
        )

        manifest[path_id] = str(run_dir)
        save_manifest(output_dir, manifest)
        log.info("Path %s complete. Output: %s (%d/%d checkpoints)",
                 path_id, run_dir, count_completed_checkpoints(run_dir, problem), total_checkpoints)


# ---------------------------------------------------------------------------
# Phase 2: Prepare paths C and D from path A's output
# ---------------------------------------------------------------------------

def phase2_prepare_derived_paths(output_dir: Path, problem: str, paths: list[str]):
    log.info("=== Phase 2: Preparing paths C and D from path A ===")
    manifest = load_manifest(output_dir)

    if "A" not in manifest:
        log.error("Path A has not been run yet. Run phase 1 first.")
        sys.exit(1)

    path_a_dir = Path(manifest["A"])
    path_a_problem = path_a_dir / problem
    if not path_a_problem.exists():
        log.error("Path A problem dir not found: %s", path_a_problem)
        sys.exit(1)

    last_cp = get_last_checkpoint(path_a_problem)

    for path_id in ["C", "D"]:
        if path_id not in paths:
            log.info("Skipping path %s (not requested)", path_id)
            continue

        if path_id in manifest:
            log.info("Path %s already prepared at %s (skipping)", path_id, manifest[path_id])
            continue

        path_dir = output_dir / f"path_{path_id.lower()}"
        if path_dir.exists():
            shutil.rmtree(path_dir)

        log.info("Copying path A output to path %s", path_id)
        shutil.copytree(path_a_dir, path_dir)

        last_cp_dir = path_dir / problem / last_cp
        if last_cp_dir.exists():
            log.info("Deleting %s from path %s so it will be re-run", last_cp, path_id)
            shutil.rmtree(last_cp_dir)

        for cleanup_file in ["run_info.yaml", "result.json", "checkpoint_results.jsonl"]:
            f = path_dir / problem / cleanup_file
            if f.exists():
                f.unlink()

        manifest[path_id] = str(path_dir)
        save_manifest(output_dir, manifest)
        log.info("Path %s prepared at %s", path_id, path_dir)


# ---------------------------------------------------------------------------
# Phase 3: Transform snapshots for paths C and D
# ---------------------------------------------------------------------------

def phase3_transform_snapshots(bench_dir: Path, output_dir: Path, problem: str, paths: list[str]):
    log.info("=== Phase 3: Transforming snapshots ===")
    manifest = load_manifest(output_dir)

    if "C" in paths:
        if "C" not in manifest:
            log.error("Path C not prepared. Run phase 2 first.")
            sys.exit(1)

        path_c_dir = Path(manifest["C"])
        path_c_problem = path_c_dir / problem
        penultimate_cp = get_penultimate_checkpoint(path_c_problem)
        snapshot_dir = path_c_problem / penultimate_cp / "snapshot"

        # Run refactoring and capture token usage
        log.info("Path C: Refactoring code in %s", snapshot_dir)
        refactor_prompt = (PROMPTS_DIR / "refactor.txt").read_text()
        refactor_usage = run_claude_with_usage(refactor_prompt, snapshot_dir)

        # Save refactor usage
        usage_file = output_dir / REFACTOR_USAGE_FILENAME
        with open(usage_file, "w") as f:
            json.dump(refactor_usage, f, indent=2)
        log.info("Path C: Refactoring complete. Usage: %s", refactor_usage)

        # Run quality metrics on the refactored snapshot
        log.info("Path C: Computing post-refactor quality metrics")
        run_cmd(
            ["uv", "run", "slop-code", "metrics", "static", str(snapshot_dir), "--just-static", "py"],
            cwd=bench_dir,
            check=False,
        )
        log.info("Path C: Post-refactor quality metrics saved")

    if "D" in paths:
        if "D" not in manifest:
            log.error("Path D not prepared. Run phase 2 first.")
            sys.exit(1)

        path_d_dir = Path(manifest["D"])
        path_d_problem = path_d_dir / problem
        penultimate_cp = get_penultimate_checkpoint(path_d_problem)
        snapshot_dir = path_d_problem / penultimate_cp / "snapshot"

        # Generate CLAUDE.md and capture token usage
        log.info("Path D: Generating CLAUDE.md in %s", snapshot_dir)
        context_prompt = (PROMPTS_DIR / "context_init.txt").read_text()
        context_usage = run_claude_with_usage(context_prompt, snapshot_dir)

        # Save context generation usage
        usage_file = output_dir / CONTEXT_USAGE_FILENAME
        with open(usage_file, "w") as f:
            json.dump(context_usage, f, indent=2)
        log.info("Path D: CLAUDE.md complete. Usage: %s", context_usage)


# ---------------------------------------------------------------------------
# Phase 4: Resume paths C and D to run the last checkpoint
# ---------------------------------------------------------------------------

def phase4_resume_derived_paths(bench_dir: Path, output_dir: Path, problem: str, paths: list[str]):
    log.info("=== Phase 4: Resuming paths C and D for final checkpoint ===")
    manifest = load_manifest(output_dir)

    for path_id in ["C", "D"]:
        if path_id not in paths:
            log.info("Skipping path %s (not requested)", path_id)
            continue

        if path_id not in manifest:
            log.error("Path %s not prepared. Run phase 2 first.", path_id)
            sys.exit(1)

        path_dir = Path(manifest[path_id])

        total_checkpoints = count_problem_checkpoints(bench_dir, problem)
        completed = count_completed_checkpoints(path_dir, problem)
        if completed >= total_checkpoints:
            log.info("Path %s already completed (skipping)", path_id)
            continue

        log.info("Resuming path %s for final checkpoint (%d/%d done)",
                 path_id, completed, total_checkpoints)
        run_all_checkpoints(
            bench_dir, path_dir, problem, "", "", total_checkpoints, path_id,
        )
        log.info("Path %s final checkpoint complete", path_id)


# ---------------------------------------------------------------------------
# Phase 5: Collect and report metrics
# ---------------------------------------------------------------------------

def phase5_report(output_dir: Path, problem: str, paths: list[str]):
    log.info("=== Phase 5: Collecting metrics ===")

    from analyze import load_metrics, print_report
    results = load_metrics(output_dir, problem)

    if not results:
        log.error("No results collected!")
        return

    print_report(results)

    # Save raw results as JSON
    results_file = output_dir / "comparison_results.json"
    clean = {k: {kk: vv for kk, vv in v.items() if kk != "mi_ratings"} for k, v in results.items()}
    with open(results_file, "w") as f:
        json.dump(clean, f, indent=2)
    print(f"\nRaw results saved to: {results_file}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Run the code quality experiment")
    parser.add_argument("--bench-dir", type=Path, required=True, help="Path to slop-code-bench repo")
    parser.add_argument("--problem", default="file_backup", help="Benchmark problem to run")
    parser.add_argument("--model", default="anthropic/opus-4.5", help="Model identifier")
    parser.add_argument("--output-dir", type=Path, default=Path("./results"), help="Output directory")
    parser.add_argument(
        "--paths", default="A,B,C,D",
        help="Comma-separated list of paths to run (default: A,B,C,D)",
    )
    parser.add_argument(
        "--phase", type=int, default=None,
        help="Run only a specific phase (1-5) for debugging",
    )
    args = parser.parse_args()

    bench_dir = args.bench_dir.resolve()
    output_dir = args.output_dir.resolve()
    paths = [p.strip().upper() for p in args.paths.split(",")]

    if not bench_dir.exists():
        log.error("Bench dir not found: %s", bench_dir)
        sys.exit(1)

    refresh_claude_oauth_env()

    # Namespace output by problem so multiple runs can coexist
    problem_output_dir = output_dir / args.problem
    problem_output_dir.mkdir(parents=True, exist_ok=True)

    log.info("Experiment config:")
    log.info("  Bench dir: %s", bench_dir)
    log.info("  Problem: %s", args.problem)
    log.info("  Model: %s", args.model)
    log.info("  Output: %s", problem_output_dir)
    log.info("  Paths: %s", paths)

    phases = {
        1: lambda: phase1_run_benchmark(bench_dir, problem_output_dir, args.problem, args.model, paths),
        2: lambda: phase2_prepare_derived_paths(problem_output_dir, args.problem, paths),
        3: lambda: phase3_transform_snapshots(bench_dir, problem_output_dir, args.problem, paths),
        4: lambda: phase4_resume_derived_paths(bench_dir, problem_output_dir, args.problem, paths),
        5: lambda: phase5_report(problem_output_dir, args.problem, paths),
    }

    if args.phase:
        if args.phase not in phases:
            log.error("Invalid phase: %s (must be 1-5)", args.phase)
            sys.exit(1)
        log.info("Running phase %d only", args.phase)
        phases[args.phase]()
    else:
        for phase_num, phase_fn in phases.items():
            phase_fn()

    log.info("Done!")


if __name__ == "__main__":
    main()

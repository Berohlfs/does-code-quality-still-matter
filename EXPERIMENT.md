# Does Code Quality Still Matter?

## Hypothesis

When AI coding agents add features to existing code, the quality of that code affects how much effort (tokens, steps, time) the agent needs. Cleaner code should be cheaper to extend.

## Experiment Design

We use the [SlopCodeBench](https://github.com/SprocketLab/slop-code-bench) benchmark, which defines problems with progressive checkpoints — each checkpoint adds a feature to the codebase. We generate code through checkpoints 1 to N-1, then measure the cost of adding checkpoint N (the final feature) under four conditions:

| Path | Label | How code is generated | Transformation before final checkpoint |
|------|-------|-----------------------|----------------------------------------|
| A | **Slop** | Minimal prompt (`just-solve`) | None |
| B | **Anti-slop** | Clean code prompt (`anti_slop`) | None |
| C | **Refactored** | Minimal prompt (`just-solve`) | Agent refactors the code |
| D | **Slop + Context** | Minimal prompt (`just-solve`) | Agent generates a `CLAUDE.md` |

### What each path tests

- **A (Slop)** — Baseline. Agent writes code with no quality guidance, then extends it.
- **B (Anti-slop)** — Does prompting for clean code during generation reduce the cost of later changes?
- **C (Refactored)** — Does explicitly refactoring sloppy code before extending it pay off?
- **D (Slop + Context)** — Does giving the agent a project map (CLAUDE.md) help it navigate messy code more efficiently, without actually cleaning it?

### Metrics

**Setup cost** — tokens, steps, elapsed time, cost for checkpoints 1 to N-1

**Transformation cost** — tokens and cost for the refactoring step (C) or CLAUDE.md generation (D)

**Feature addition cost** — tokens, steps, elapsed time, cost for the final checkpoint only

**Total cost** — setup + transformation + feature

**Correctness** — test pass rate, core tests passed

**Code quality** — LOC, cyclomatic complexity, maintainability index, waste (single-use functions, trivial wrappers, unused variables), redundancy (clone ratio), lint errors

## Results

Model: Claude Opus 4.6 via Claude Code CLI

### `file_merger` — 4 checkpoints, Easy

A file merging tool that combines files with conflict resolution, metadata tracking, and output formatting.

|                     | A: Slop | B: Anti-slop | C: Refactored | D: Slop+Context |
|---------------------|---------|-------------|---------------|-----------------|
| **SETUP** | | | | |
| Output tokens | 95,344 | 71,519 | 95,344 | 95,344 |
| Steps | 186 | 192 | 186 | 186 |
| Elapsed (s) | 3,484 | 4,781 | 3,484 | 3,484 |
| Cost ($) | 25.19 | 20.65 | 25.19 | 25.19 |
| **TRANSFORM** | | | | |
| Refactor tokens | — | — | 54,554 | — |
| Refactor cost ($) | — | — | 2.25 | — |
| Context tokens | — | — | — | 3,085 |
| Context cost ($) | — | — | — | 0.26 |
| **FEATURE (N+1)** | | | | |
| Output tokens | 50,305 | 48,736 | 69,159 | **41,537** |
| Steps | 61 | 97 | 81 | **47** |
| Elapsed (s) | 799 | 808 | 837 | 870 |
| Cost ($) | 15.06 | 17.86 | 17.93 | **11.80** |
| Error | No | No | No | No |
| **TOTAL** | | | | |
| Total tokens | 145,649 | 120,255 | 219,057 | **139,966** |
| Total elapsed (s) | 4,282 | 5,589 | 4,321 | 4,354 |
| Total cost ($) | 40.25 | 38.52 | 45.38 | **37.25** |
| **CORRECTNESS** | | | | |
| Core tests | 13/19 | **14/19** | 13/19 | 13/19 |
| Pass rate | 85% | 84% | **86%** | **86%** |

**Takeaway**: Path D is the cheapest overall ($37.25) and uses the fewest feature tokens. All paths achieve similar correctness. The $0.26 CLAUDE.md saves $3.26 on the feature vs Path A.

---

### `code_search` — 5 checkpoints, Easy

A code search tool with pattern matching, file filtering, and result ranking.

|                     | A: Slop | B: Anti-slop | C: Refactored | D: Slop+Context |
|---------------------|---------|-------------|---------------|-----------------|
| **SETUP** | | | | |
| Output tokens | 95,078 | 84,395 | 95,078 | 95,078 |
| Steps | 176 | 172 | 176 | 176 |
| Elapsed (s) | 2,007 | 1,693 | 2,007 | 2,007 |
| Cost ($) | 26.49 | 21.95 | 26.49 | 26.49 |
| **TRANSFORM** | | | | |
| Refactor tokens | — | — | 21,345 | — |
| Refactor cost ($) | — | — | 1.20 | — |
| Context tokens | — | — | — | 2,003 |
| Context cost ($) | — | — | — | 0.24 |
| **FEATURE (N+1)** | | | | |
| Output tokens | 37,832 | **32,684** | 39,213 | 39,567 |
| Steps | 94 | **62** | 72 | **62** |
| Elapsed (s) | 888 | **619** | 698 | 742 |
| Cost ($) | 12.49 | **10.19** | 11.67 | 10.26 |
| Error | No | No | No | No |
| **TOTAL** | | | | |
| Total tokens | 132,910 | **117,079** | 155,636 | 136,648 |
| Total elapsed (s) | 2,895 | **2,312** | 2,705 | 2,750 |
| Total cost ($) | 38.98 | **32.14** | 39.36 | 36.99 |
| **CORRECTNESS** | | | | |
| Core tests | **14/14** | **14/14** | **14/14** | **14/14** |
| Pass rate | 88% | 89% | 88% | **91%** |

**Takeaway**: All paths solve the problem perfectly (14/14 core). Path B is cheapest overall ($32.14) — clean prompting during generation paid off here. Path D has the highest pass rate (91%) and fewest feature steps.

---

### `log_query` — 5 checkpoints, Easy

A log querying system with filtering, aggregation, and output formatting.

|                     | A: Slop | B: Anti-slop | C: Refactored | D: Slop+Context |
|---------------------|---------|-------------|---------------|-----------------|
| **SETUP** | | | | |
| Output tokens | 130,241 | 114,685 | 130,241 | 130,241 |
| Steps | 183 | 184 | 183 | 183 |
| Elapsed (s) | 2,355 | 2,031 | 2,355 | 2,355 |
| Cost ($) | 32.31 | 28.31 | 32.31 | 32.31 |
| **TRANSFORM** | | | | |
| Refactor tokens | — | — | 38,000 | — |
| Refactor cost ($) | — | — | 1.23 | — |
| Context tokens | — | — | — | 2,045 |
| Context cost ($) | — | — | — | 0.20 |
| **FEATURE (N+1)** | | | | |
| Output tokens | **32,860** | 50,008 | 53,242 | 42,605 |
| Steps | **29** | 97 | 54 | 49 |
| Elapsed (s) | **671** | 1,237 | 881 | 689 |
| Cost ($) | **8.84** | 15.33 | 15.94 | 13.41 |
| Error | No | No | No | No |
| **TOTAL** | | | | |
| Total tokens | **163,101** | 164,693 | 221,483 | 174,891 |
| Total elapsed (s) | **3,025** | 3,268 | 3,236 | 3,043 |
| Total cost ($) | **41.15** | 43.64 | 49.47 | 45.92 |
| **CORRECTNESS** | | | | |
| Core tests | **3/3** | **3/3** | **3/3** | **3/3** |
| Pass rate | 79% | **95%** | **96%** | **96%** |

**Takeaway**: All paths solve core tests (3/3). Path A is cheapest ($41.15) and fastest but has the lowest pass rate (79%). Paths B, C, D all achieve 95-96% — quality interventions improve correctness on edge cases. Path D offers the best balance of cost ($45.92) and quality (96%).

---

## Key Findings

1. **No single path dominates.** The best approach depends on the problem. Path D (context) is most consistent across all three problems.

2. **CLAUDE.md is high-ROI.** At $0.20-0.26 per generation, it consistently reduces feature tokens and steps while maintaining or improving correctness. It never hurts.

3. **Refactoring is expensive and inconsistent.** Path C costs $1.20-2.25 for the refactoring step plus produces the most feature tokens in 2 of 3 problems. The agent tends to write more code when working with refactored (unfamiliar) structure.

4. **Anti-slop prompting helps pass rates but costs more during feature addition.** Path B achieves the highest core test pass in `file_merger` and lowest total cost in `code_search`, but uses the most feature steps in `log_query`.

5. **Slop is cheap but less correct.** Path A consistently has the lowest feature cost but the lowest pass rates. The agent works fast through familiar (messy) code but misses edge cases.

6. **Cost without correctness is meaningless.** The cheapest path is only useful if it passes the tests.

## Prerequisites

- Python 3.12+
- Docker (running)
- [uv](https://docs.astral.sh/uv/) package manager
- Claude Code CLI (`claude`) installed and authenticated
- slop-code-bench cloned and set up alongside this repo:
  ```bash
  git clone https://github.com/SprocketLab/slop-code-bench.git ../slop-code-bench
  cd ../slop-code-bench && uv sync
  ```

## Running the Experiment

### Full run (all 4 paths)

```bash
python orchestrate.py \
  --bench-dir ../slop-code-bench \
  --problem file_merger \
  --model anthropic/opus-4.6 \
  --output-dir ./results
```

### Run multiple problems

```bash
for problem in file_merger code_search log_query; do
  python orchestrate.py --bench-dir ../slop-code-bench --problem "$problem"
done
```

### Run specific paths

```bash
# Only the baseline and anti-slop paths
python orchestrate.py --bench-dir ../slop-code-bench --paths A,B

# Only the refactored path (requires path A to exist)
python orchestrate.py --bench-dir ../slop-code-bench --paths C --phase 2
python orchestrate.py --bench-dir ../slop-code-bench --paths C --phase 3
python orchestrate.py --bench-dir ../slop-code-bench --paths C --phase 4
```

### Analyze results

```bash
# Single problem
python analyze.py --problem file_merger

# All problems at once
python analyze.py

# Export as JSON
python analyze.py --problem file_merger --json-output comparison.json
```

### Run phase by phase

| Phase | What it does |
|-------|-------------|
| 1 | Run benchmark for paths A and B (all checkpoints, with token refresh between each) |
| 2 | Copy path A's checkpoints 1 to N-1 to paths C and D |
| 3 | Refactor snapshot (C) and generate CLAUDE.md (D), capture token usage |
| 4 | Resume paths C and D to run final checkpoint only |
| 5 | Collect metrics and print comparison table |

## Output Structure

```
results/
├── file_merger/
│   ├── paths_manifest.json    # Maps path IDs to output directories
│   ├── refactor_usage.json    # Refactoring token usage (Path C)
│   ├── context_usage.json     # CLAUDE.md generation usage (Path D)
│   ├── path_c/                # Refactored (copied from A, final checkpoint re-run)
│   └── path_d/                # Slop + CLAUDE.md (copied from A, final checkpoint re-run)
├── code_search/
│   └── ...
└── log_query/
    └── ...
```

Paths A and B outputs live in the slop-code-bench `outputs/` directory (tracked via manifest).

## Using a Different Problem

Any slop-code-bench problem with 2+ checkpoints works:

```bash
python orchestrate.py --bench-dir ../slop-code-bench --problem database_migration
```

List available problems:

```bash
cd ../slop-code-bench && uv run slop-code problems ls
```

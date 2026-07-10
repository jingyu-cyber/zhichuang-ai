# AI Infrastructure Interactive Course — Design Spec

> Version 1.0 | 2026-07-08 | 12 interactive HTML lesson pages

---

## Architecture Overview

Each lesson is a self-contained HTML page with no external dependencies (no JS frameworks, no CSS libraries). Every page follows the same layout and interaction model:

```
┌──────────────────────────────────────────────┐
│ demo-header: breadcrumb + title + badges     │
├──────────────────┬───────────────────────────┤
│ panel-explain    │ panel-stage               │
│ (320px)          │ (flex: 1)                 │
│                  │                           │
│ step-title       │ <svg> diagrams            │
│ badge-row        │   - rect/circle/line      │
│ code-line        │   - text labels           │
│ step-desc        │   - polygon for 3D/       │
│                  │     topology              │
│                  │                           │
├──────────────────┴───────────────────────────┤
│ demo-controls: prev · step-dots · next       │
└──────────────────────────────────────────────┘
```

## Color System (Extreme Dark HPC Theme)

| Variable | Hex | Purpose |
|----------|-----|---------|
| `--bg` | `#0a0e14` | Page background (near-black) |
| `--bg-soft` | `#141b22` | Panel/card background |
| `--bg-code` | `#06080c` | SVG stage background (deeper) |
| `--fg` | `#d0e0e8` | Primary text |
| `--fg-dim` | `#607888` | Secondary/dimmed text |
| `--line` | `#1c2836` | Borders and separators |
| `--accent` | `#00e5a0` | Neon green (primary accent) |
| `--accent-2` | `#b050ff` | Purple (compute) |
| `--grad` | `#40a0ff` | Blue (communication) |
| `--success` | `#30d060` | Green (success/completion) |
| `--danger` | `#ff8020` | Orange (bottleneck/warning) |

## JavaScript Step System

Each page defines `const S = [{t, l, d, b, r(svg)}]` where:

| Field | Type | Description |
|-------|------|-------------|
| `t` | string | Step title (displayed in explain panel) |
| `l` | string | Code line (monospace, accent-colored) |
| `d` | string | Detailed description (fg-dim text) |
| `b` | string[] | Badge labels (rendered as tip badges) |
| `r` | function | Render function receiving SVG element — clears and redraws |

**Controls:**
- Left/Right arrow keys navigate steps
- Prev/Next buttons with disabled states
- Step dots with active/done states
- Auto-numbered (0-based index)

## Lesson Inventory

### Chapter 1: 高性能算子基础 (High-Performance Operator Fundamentals)

| # | File | Key SVG Elements |
|---|------|------------------|
| 1.1 | `01-operator-abstract.html` | Tensor blocks (stacked rects), operator nodes (MatMul/ReLU/LayerNorm), dimension labels (BxSxD), flow arrows with markers, fused kernel preview |
| 1.2 | `02-memory-access.html` | Sequential cell grid (40 cells), strided column highlight, random scatter plot, 6-bar bandwidth comparison chart with percentage labels |
| 1.3 | `03-parallel-exec.html` | Grid→Block→Warp hierarchy (nested rects), SM occupancy bars (registers/shared-mem/threads/blocks), bank conflict visualization (32 banks + thread access patterns), memory hierarchy latency pyramid |

### Chapter 2: AI编译优化 (AI Compilation Optimization)

| # | File | Key SVG Elements |
|---|------|------------------|
| 2.1 | `04-compute-graph.html` | ResNet DAG (8 nodes with color-coded rects, directed edges with arrow markers, skip connection as dashed curve), IR pipeline stages, optimization passes list |
| 2.2 | `05-operator-fusion.html` | Before: 3 separate kernel blocks + HBM reads/writes per kernel. After: single fused kernel block + 1 read/1 write. Register-level flow. Side-by-side stats comparison (6→2 memory ops, -67%) |
| 2.3 | `06-graph-rewrite.html` | Constant folding (before→after graph), CSE (duplicate→shared MatMul with red X), Layout transform pipeline (NCHW⟷NHWC arrows), algebraic simplification rules table |

### Chapter 3: 分布式通信 (Distributed Communication)

| # | File | Key SVG Elements |
|---|------|------------------|
| 3.1 | `07-data-parallel.html` | Batch split visualization (top→4 GPU arrows), per-GPU forward/backward block diagram, AllReduce aggregation hub, training step timeline (Fwd→Bwd→AllReduce→SGD) |
| 3.2 | `08-allreduce-ring.html` | Ring topology (4 GPUs in circle with curved arrows), Scatter-Reduce phase (3 steps with send/recv chunk labels), AllGather phase (3 steps with accummulated chunks), bandwidth formula box |
| 3.3 | `09-comm-bottleneck.html` | Multi-GPU timeline (compute blue bars + communication orange bars), bubble highlight with dashed stroke, donut chart (compute 55%/comm 25%/idle 20%), overlap comparison (no overlap vs with overlap), optimization strategies table |

### Chapter 4: 性能分析综合实验 (Performance Analysis Lab)

| # | File | Key SVG Elements |
|---|------|------------------|
| 4.1 | `10-performance-metrics.html` | 4-quadrant KPI cards (throughput/latency/memory/utilization) with large numeric values, TFLOPS line chart (20 data points + peak line), roofline model scatter plot with 5 operators (memory-bound vs compute-bound regions) |
| 4.2 | `11-profiling-hotspot.html` | Kernel timeline bars (Stream Default/14/21/15) colored by duration, hotspot highlight box, call stack trace (5 levels), memory bandwidth gauge (semi-circular arc with needle), bottleneck diagnosis decision tree (box-and-arrow flow) |
| 4.3 | `12-optimization-report.html` | 4-column bottleneck→solution→gain→risk table (4 rows), impact vs effort scatter chart with 5 labeled points + quadrant labels (Quick Wins/Strategic Invest), cumulative gain stacked bar chart, verification pipeline flow with rollback loop, checklist items |

## SVG Conventions

- All elements created via `document.createElementNS("http://www.w3.org/2000/svg", ...)`
- Helper `function E(tag, attrs, text)` used in most pages
- ViewBox typically `0 0 800 420`
- Arrow markers defined in `<defs>` with unique IDs
- Font used throughout: `JetBrains Mono, monospace` for code/metrics; system sans-serif for labels
- No external fonts loaded — relies on system-installed JetBrains Mono

## Responsive Behavior

- At `max-width: 860px`, the two-column layout collapses to single column
- SVG scales with `max-width: 100%; max-height: 100%`
- All interactive elements remain functional at mobile widths

## Interaction Design

- **Keyboard navigation**: ArrowLeft (prev step), ArrowRight (next step)
- **Button navigation**: Prev/Next with disabled states at boundaries
- **Dot indicators**: 3 states — inactive (line color), active (accent green + glow), done (green)
- **Auto-play**: Not implemented in v1 (planned for future)
- **No page reloads**: All step transitions are instant in-memory SVG redraws

## File Size Target

Each page ~6-10 KB (HTML + CSS + JS + SVG all inline). Total course: ~120 KB for 12 lessons + index.

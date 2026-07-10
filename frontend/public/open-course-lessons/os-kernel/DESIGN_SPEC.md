# OS Kernel Course — Design Specification

> 操作系统内核构建 | 交互式教学页面

## Color Palette

| Variable | Hex | Usage |
|---|---|---|
| `--bg` | `#0d1117` | Page background |
| `--bg-soft` | `#161b22` | Panel backgrounds |
| `--bg-code` | `#0a0c10` | Code block / stage backgrounds |
| `--fg` | `#e6edf3` | Primary text |
| `--fg-dim` | `#8b949e` | Secondary text |
| `--line` | `#30363d` | Borders / dividers |
| `--accent` | `#58a6ff` | Primary accent (kernel space, links) |
| `--accent-2` | `#3fb950` | Green (user mode, success, active) |
| `--grad` | `#d29922` | Orange (interrupts, warnings, IRQ) |
| `--danger` | `#f85149` | Red (errors, faults, blocked) |
| `--success` | `#3fb950` | Green (success, ready, open) |

## Layout Structure

Every page follows the same shell:

```
┌─────────────────────────────────────────────────────┐
│ .demo-header: title + breadcrumb                     │
├──────────────────────┬──────────────────────────────┤
│ .panel-explain (320) │ .panel-stage (flex)           │
│  - step-title        │  - SVG diagram                │
│  - code-line         │                               │
│  - step-desc         │                               │
│  - badge-row         │                               │
├──────────────────────┴──────────────────────────────┤
│ .demo-controls: ←prev · dots · next→ · auto-play    │
└─────────────────────────────────────────────────────┘
```

## JavaScript Step Format

Each page defines a global `S` array:

```js
const S = [
  {
    t: "Step Title",                    // shown in .step-title
    l: "/* code snippet */",            // .code-line
    d: "HTML description with <br>",    // .step-desc (innerHTML)
    b: [{t:"Tag", c:"badge--tip"}],     // badge array: t=text, c=class
    r(svg) { /* SVG render function */ }
  },
  // ... 3-5 steps total
];
```

## SVG Conventions

- ViewBox: 800x520 (landscape) or 800x480
- Kernel-space elements: `fill="var(--accent)"` or `stroke="var(--accent)"`
- User-space elements: `fill="var(--accent-2)"` or `stroke="var(--accent-2)"`
- Interrupt/IRQ elements: `fill="var(--grad)"` or `stroke="var(--grad)"`
- Error/fault elements: `fill="var(--danger)"` or `stroke="var(--danger)"`
- All text: `fill="var(--fg)"`, labels use `fill="var(--fg-dim)"`
- Rectangles: rounded with `rx="6"`
- Use `<g>` groups with descriptive ids
- Animate critical paths with dashed lines (`stroke-dasharray`)

## Keyboard Controls (every page)

| Key | Action |
|---|---|
| `→` or `Space` | Next step |
| `←` | Previous step |
| `R` | Restart (go to step 0) |
| `A` | Toggle auto-play (3s interval) |

## Step Dot States

- Inactive: `background: var(--line)` (gray)
- Active: `background: var(--accent)` with `box-shadow: 0 0 10px var(--accent)` (blue glow)
- Done: `background: var(--success)` (green)

## Responsive

- Above 860px: two-column grid (320px sidebar + flexible stage)
- Below 860px: single column, sidebar on top

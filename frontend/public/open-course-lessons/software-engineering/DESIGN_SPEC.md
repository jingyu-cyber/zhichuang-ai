# Software Engineering Interactive Lessons - Design Spec

## Overview
12 interactive HTML lesson pages covering 4 chapters of Software Engineering (软件工程). Each page uses SVG-based interactive diagrams with a step-by-step progression system.

## Color Palette
| Token | Hex | Usage |
|-------|-----|-------|
| --bg | #1c2128 | Page background |
| --bg-soft | #252c35 | Card/panel background |
| --bg-code | #141820 | Code block / diagram background |
| --fg | #e6edf3 | Primary text |
| --fg-dim | #8b949e | Secondary text |
| --line | #30363d | Borders |
| --accent | #539bf5 | Primary accent (blue) |
| --accent-2 / --success | #57ab5a | Success state (green) |
| --grad | #c69026 | Warning / amber |
| --danger | #e5534b | Error (red) |
| --purple | #986ee2 | Purple accent |

## Page Layout
- `.demo-shell` - max-width 1280px centered container
- `.demo-header` - top bar with breadcrumb
- `.demo-main` - 2-column grid: `.panel-explain` (320px) + `.panel-stage` (flex)
- `.demo-controls` - bottom controls with prev/next/auto-play

## Step System
Each page defines `const S = [{t, l, d, b, r(sv)}]`:
- `t`: step title (shown in panel)
- `l`: label for dot indicator
- `d`: description text
- `b`: badge array (strings)
- `r(sv)`: render function receiving SVG element reference

## Keyboard Controls
- Left/Right arrows: prev/next step
- Space: toggle auto-play
- 1-4: jump to step directly

## SVG Requirements
All diagrams must be real SVG elements with:
- `<rect>`, `<circle>`, `<line>`, `<path>`, `<polygon>` shapes
- `<text>` labels with proper font settings
- Color coding matching the palette
- Animated transitions on step change

# 计算思维 (Computational Thinking) — 交互课程设计规范

> 浅色主题，面向低年级本科生 | 12 课时 | 每课 3-5 步交互演示

---

## 1. 整体架构

```
computational-thinking/
├── index.html          # 课程总览页（12 课卡片导航）
├── DESIGN_SPEC.md      # 本文件
└── pages/
    ├── 01-problem-boundary.html   # Ch1: 问题分解与抽象
    ├── 02-abstract-model.html
    ├── 03-subtask-breakdown.html
    ├── 04-loop-state.html         # Ch2: 算法状态与控制
    ├── 05-branch-decision.html
    ├── 06-state-machine.html
    ├── 07-recursion-stack.html    # Ch3: 递归与搜索
    ├── 08-bfs-vs-dfs.html
    ├── 09-pruning.html
    ├── 10-debug-trace.html        # Ch4: 调试与迁移
    ├── 11-error-classify.html
    └── 12-analogy-transfer.html
```

---

## 2. 设计 Token (CSS 变量)

| 变量 | 值 | 用途 |
|------|-----|------|
| `--bg` | `#f5f5f8` | 页面背景 |
| `--bg-soft` | `#ffffff` | 卡片/面板背景 |
| `--bg-code` | `#f0f0f4` | 代码区 / stage 背景 |
| `--fg` | `#2c2c38` | 正文 |
| `--fg-dim` | `#6c6c80` | 辅助文字 |
| `--line` | `#dcdce4` | 分割线 / 边框 |
| `--accent` | `#5b6abf` | 主色 (indigo) |
| `--accent-2` | `#36a2b8` | 辅色 (teal) |
| `--grad` | `#f09840` | 递归/搜索强调 (orange) |
| `--success` | `#40c878` | 正确/完成 |
| `--danger` | `#e04860` | 错误/警告 |
| `--shadow` | `0 2px 12px rgba(0,0,0,.06)` | 卡片投影 |

---

## 3. 页面布局

```
┌─────────────────────────────────────────────┐
│  Header: 面包屑 + 课程标题                    │
├──────────────────┬──────────────────────────┤
│  Panel-Explain   │  Panel-Stage (SVG)       │
│  ─────────────── │                          │
│  Step Title      │  主演示区                  │
│  Description     │  (算法图 / 状态表 /       │
│  Badges          │   决策树 / 调用栈)         │
│  Code Line       │                          │
├──────────────────┴──────────────────────────┤
│  Demo-Controls: [上一步] [dots] [下一步]      │
│  [自动播放] [键盘← →]                        │
└─────────────────────────────────────────────┘
```

- **max-width**: 1280px 居中
- **响应式**: <860px → 单列布局
- **字体**: Noto Sans SC / PingFang SC (正文), JetBrains Mono (代码)

---

## 4. 步骤系统 (JS)

### 数据结构

```js
const S = [
  {
    t: "步骤标题",              // title
    l: "伪代码 / 关键行",        // code line
    d: "描述 <em>HTML</em>",    // description (HTML 安全)
    b: [{t:"标签",c:"def|tip|warn"}], // badges
    r(svg){ /* 绘制 SVG */ }
  },
  // ... 3-5 步
];
```

### 类名映射

| c 值 | CSS 类 | 含义 |
|------|--------|------|
| `def` | `badge--def` | 定义/概念 (indigo) |
| `tip` | `badge--tip` | 提示/技巧 (green) |
| `warn` | `badge--warn` | 注意/警告 (orange) |

### 交互

- **键盘**: `←` 上一步, `→` 下一步
- **自动播放**: 每 3 秒自动前进，到末尾循环（toggle 按钮）
- **点击 dots**: 直接跳转
- **禁用态**: 第一步"上一步"置灰，最后一步"下一步"置灰

---

## 5. SVG 绘制规范

### 通用尺寸

- **viewBox**: `"0 0 700 400"` (宽屏) 或 `"0 0 600 380"` (方屏)
- 所有坐标为 viewBox 坐标，响应式缩放

### 颜色约定

| 元素 | 颜色 |
|------|------|
| 矩形填充 | `#ffffff` 或 `var(--bg-soft)` |
| 矩形描边 | `var(--accent)` / `var(--line)` |
| 文字 | `var(--fg)` |
| 高亮矩形 | `fill="var(--accent)"` + 白色文字 |
| 完成态 | `fill="var(--success)"` / `stroke="var(--success)"` |
| 错误/禁用 | `fill="#e0e0e0"` / `stroke="var(--danger)"` |
| 箭头/连线 | `stroke="var(--fg-dim)"` |
| 橙色强调 | `fill="var(--grad)"` |

### 模式

- 描述性文字嵌入 SVG 内部
- 使用 `<g>` 分组
- 动画用 CSS transition（opacity / transform）

---

## 6. 每课预期内容

### Ch1: 问题分解与抽象

| # | 文件 | 核心演示 |
|---|------|---------|
| 01 | problem-boundary | NL→结构化提取：输入/输出/约束/评判四卡片 |
| 02 | abstract-model | 实物→数据结构映射：地图→图、队伍→队列、表格→二维数组 |
| 03 | subtask-breakdown | 大问题切分：输入处理→核心计算→输出格式化，各自展开伪代码 |

### Ch2: 算法状态与控制

| # | 文件 | 核心演示 |
|---|------|---------|
| 04 | loop-state | 循环执行追踪：变量表逐行更新，终止条件检查高亮 |
| 05 | branch-decision | 决策树：输入沿树流动，覆盖路径高亮 |
| 06 | state-machine | 状态机构建：订单/游戏状态节点 + 事件箭头 |

### Ch3: 递归与搜索

| # | 文件 | 核心演示 |
|---|------|---------|
| 07 | recursion-stack | 调用栈：斐波那契/汉诺塔帧压栈弹栈，栈高度垂直动画 |
| 08 | bfs-vs-dfs | 同图对比：队列 vs 栈，节点按访问顺序着色，左右并列 |
| 09 | pruning | 剪枝策略：搜索树中违反约束的分支变灰，剪枝前后节点计数 |

### Ch4: 调试与迁移

| # | 文件 | 核心演示 |
|---|------|---------|
| 10 | debug-trace | 断点调试：时间线断点快照，变量值、条件结果、错误传播 |
| 11 | error-classify | 错误分类：拖入边界遗漏/状态遗漏/条件翻转/类型错误四桶 |
| 12 | analogy-transfer | 类比迁移：两相似问题左右对齐，共同结构高亮 |

---

## 7. 实现约定

- **零依赖**: 纯 HTML+CSS+JS，不引入任何外部库
- **内联一切**: CSS/JS/SVG 全部内联到单一 HTML 文件
- **中文内容**: 所有用户可见文字使用中文
- **可访问性**: 按钮有 aria-label，SVG 有 title/desc
- **打印友好**: @media print 隐藏控制栏

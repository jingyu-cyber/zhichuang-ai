# 计算机系统导论 · 交互式开源课堂

一套围绕计算机系统导论课程的可交互 HTML 教学课件，共 4 章 12 节。每节都是独立页面，可直接投屏授课，也可以嵌入智创开源课堂。

## 快速开始

双击 `index.html` 打开课程目录，从中进入各个课节。全部页面为纯前端静态文件，无需构建、无需后端服务。

## 目录结构

```
computer-systems/
├── index.html
├── README.md
├── assets/common.css
├── 01-machine-repr/index.html
├── 02-binary-analysis/index.html
├── 03-buffer-overflow/index.html
├── 04-x86-simulator/index.html
├── 05-integer-float/index.html
├── 06-register-watch/index.html
├── 07-calling-convention/index.html
├── 08-stack-frame/index.html
├── 09-control-flow-graph/index.html
├── 10-crash-replay/index.html
├── 11-instruction-set-model/index.html
└── 12-execution-trace/index.html
```

## 12 个课节

| # | 章节 | 课节 | 课堂交互 |
|---|---|---|---|
| 1 | 数据表示与机器级执行 | 整数与浮点表示 | 32 位位模式、补码、uint32、float32 同步解释 |
| 2 | 数据表示与机器级执行 | 指令生命周期 | C 源码、汇编、机器码字段三级联动 |
| 3 | 数据表示与机器级执行 | 寄存器观察 | 函数执行中寄存器、内存和数据通路同步变化 |
| 4 | 函数调用与栈帧 | 调用约定 | ABI 参数分配、栈上传参和调用双方职责 |
| 5 | 函数调用与栈帧 | 栈帧布局 | 函数序言、局部变量、%rbp/%rsp 和返回过程 |
| 6 | 函数调用与栈帧 | 缓冲区越界 | 栈帧动画、返回地址覆盖和防御机制对比 |
| 7 | 二进制程序分析 | 反汇编读法 | 迷你 Bomb Lab、反汇编、CFG、单步执行 |
| 8 | 二进制程序分析 | 控制流图 | 从跳转指令和基本块还原 if/while |
| 9 | 二进制程序分析 | 简单漏洞复现 | 输入、栈快照、寄存器和日志组成崩溃证据链 |
| 10 | 模拟器实验 | 指令集建模 | opcode、寄存器编号、立即数和执行语义拆解 |
| 11 | 模拟器实验 | 状态转移 | Y86-64 数据通路、SEQ/PIPE 和 CPI 统计 |
| 12 | 模拟器实验 | 执行日志 | trace 快照、寄存器差异和错误指令定位 |

## 使用建议

- 课堂投屏：教师按章节顺序演示，学生即时回答页面中的判断问题。
- 实验课：学生自行打开对应课节，配合 CSAPP Data / Bomb / Attack / Arch Lab 类型实验使用。
- 课程建设：每节课件都是独立 HTML，可以按本校教材案例替换示例代码和状态数据。

---

© 2026 · 计算机系统导论交互式开源课堂

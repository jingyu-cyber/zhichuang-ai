import { useEffect, useMemo, useState } from "react";

type OpenCourseView = "catalog" | "course" | "chapter" | "lesson";

type OpenCourseRoute = {
  view: OpenCourseView;
  courseId: string;
  chapterIndex: number;
  lessonIndex: number;
};

type DedicatedLessonPage = {
  title: string;
  url: string;
  detail: string;
  source: "compiler-demos" | "ics-demos";
};

type CourseLesson = {
  title: string;
  duration: string;
  focus: string;
  interaction: string;
  classroomUse: string;
  output: string;
  resource?: DedicatedLessonPage;
};

type CourseChapter = {
  title: string;
  goal: string;
  lessons: CourseLesson[];
};

type OpenCourse = {
  id: string;
  order: string;
  title: string;
  subtitle: string;
  coursePosition: string;
  courseGoal: string;
  designLanguage: string;
  keyInteractions: string[];
  chapters: CourseChapter[];
};

const compilerLessons: Record<string, DedicatedLessonPage> = {
  "0:0": {
    title: "词法分析 · 从正则到 DFA",
    url: "/open-course-lessons/compiler-principles/pages/01-lexical.html",
    detail: "围绕 NFA、DFA、token 流和扫描过程设计的独立课堂页面。",
    source: "compiler-demos",
  },
  "0:1": {
    title: "语法分析 · LL(1) 与 LR(0)",
    url: "/open-course-lessons/compiler-principles/pages/02-parsing.html",
    detail: "展示 First/Follow、预测分析表、项集族和移进归约过程。",
    source: "compiler-demos",
  },
  "0:2": {
    title: "AST 构建 · 解析树到抽象语法树",
    url: "/open-course-lessons/compiler-principles/pages/06-ast.html",
    detail: "围绕解析树裁剪、运算符树折叠、优先级保留和 JSON AST 输出设计。",
    source: "compiler-demos",
  },
  "1:1": {
    title: "语义分析 · 符号表与类型检查",
    url: "/open-course-lessons/compiler-principles/pages/03-semantic.html",
    detail: "用作用域栈、符号表和类型错误定位讲清语义分析。",
    source: "compiler-demos",
  },
  "1:2": {
    title: "类型检查 · AST 类型传播与错误定位",
    url: "/open-course-lessons/compiler-principles/pages/08-type-check.html",
    detail: "展示符号表查找、表达式类型自底向上传播、错误阻断和诊断输出。",
    source: "compiler-demos",
  },
  "1:0": {
    title: "作用域规则 · 声明绑定与遮蔽",
    url: "/open-course-lessons/compiler-principles/pages/07-scope.html",
    detail: "通过源码扫描、作用域栈、符号查找路径和遮蔽关系讲清块级作用域。",
    source: "compiler-demos",
  },
  "2:0": {
    title: "中间代码 · AST 与三地址码",
    url: "/open-course-lessons/compiler-principles/pages/04-ir.html",
    detail: "把 AST、临时变量、回填和控制流图放在同一条转换链路中。",
    source: "compiler-demos",
  },
  "2:1": {
    title: "控制流生成 · if/while 到标签与基本块",
    url: "/open-course-lessons/compiler-principles/pages/09-control-flow.html",
    detail: "把 if/else 和 while 降成标签、条件跳转、基本块和 CFG 回边。",
    source: "compiler-demos",
  },
  "2:2": {
    title: "代码优化 · 五种经典技术",
    url: "/open-course-lessons/compiler-principles/pages/05-optimize.html",
    detail: "对比常量折叠、公共子表达式、死代码删除、循环外提和 DAG 优化。",
    source: "compiler-demos",
  },
  "3:0": {
    title: "表达式编译器 · 从源码到三地址码",
    url: "/open-course-lessons/compiler-principles/pages/10-expression-compiler.html",
    detail: "把源码、token、AST、类型检查和三地址码输出串成一个最小编译器闭环。",
    source: "compiler-demos",
  },
  "3:1": {
    title: "错误恢复 · 语法错误定位与继续分析",
    url: "/open-course-lessons/compiler-principles/pages/11-error-recovery.html",
    detail: "展示错误 token 定位、同步集合、panic-mode 恢复和后续语句继续分析。",
    source: "compiler-demos",
  },
  "3:2": {
    title: "编译器测试与回归验证 · 综合实验验收",
    url: "/open-course-lessons/compiler-principles/pages/12-compiler-regression.html",
    detail: "围绕 token、AST、诊断和 IR 金标准输出验证学生编译器的完整性。",
    source: "compiler-demos",
  },
};

const systemLessons: Record<string, DedicatedLessonPage> = {
  "0:0": {
    title: "整数与浮点表示 · 位模式实验台",
    url: "/open-course-lessons/computer-systems/05-integer-float/index.html",
    detail: "把同一 32 位模式分别解释为补码整数、无符号整数和 IEEE-754 单精度浮点数。",
    source: "ics-demos",
  },
  "0:1": {
    title: "程序的机器级表示 · C / 汇编 / 机器码三级联动",
    url: "/open-course-lessons/computer-systems/01-machine-repr/index.html",
    detail: "C 源码、x86-64 汇编和机器码字段同步高亮，适合讲指令编码。",
    source: "ics-demos",
  },
  "0:2": {
    title: "寄存器观察 · 函数执行显微镜",
    url: "/open-course-lessons/computer-systems/06-register-watch/index.html",
    detail: "单步观察参数寄存器、返回值寄存器、地址计算和内存读写的状态变化。",
    source: "ics-demos",
  },
  "1:0": {
    title: "调用约定 · 参数传递与调用双方职责",
    url: "/open-course-lessons/computer-systems/07-calling-convention/index.html",
    detail: "展示 System V AMD64 ABI 中寄存器传参、栈上传参和 caller/callee saved 规则。",
    source: "ics-demos",
  },
  "1:1": {
    title: "栈帧布局 · 函数进入与返回",
    url: "/open-course-lessons/computer-systems/08-stack-frame/index.html",
    detail: "展示函数序言、局部变量分配、%rbp/%rsp 变化和返回过程。",
    source: "ics-demos",
  },
  "1:2": {
    title: "缓冲区溢出 · 栈帧动画与防御机制",
    url: "/open-course-lessons/computer-systems/03-buffer-overflow/index.html",
    detail: "动态观察越界写入、返回地址覆盖以及常见防护机制的影响。",
    source: "ics-demos",
  },
  "2:0": {
    title: "二进制程序分析 · 反汇编 / CFG / 单步执行",
    url: "/open-course-lessons/computer-systems/02-binary-analysis/index.html",
    detail: "通过迷你拆弹实验理解反汇编阅读、控制流图和寄存器状态变化。",
    source: "ics-demos",
  },
  "2:1": {
    title: "控制流图 · 从跳转指令还原 if/while",
    url: "/open-course-lessons/computer-systems/09-control-flow-graph/index.html",
    detail: "把基本块、条件跳转和回边映射到 if/while 伪代码结构。",
    source: "ics-demos",
  },
  "2:2": {
    title: "简单漏洞复现 · 崩溃证据链",
    url: "/open-course-lessons/computer-systems/10-crash-replay/index.html",
    detail: "从输入字节、栈快照、寄存器和日志构建一次可解释的崩溃复现证据链。",
    source: "ics-demos",
  },
  "3:0": {
    title: "指令集建模 · 从文本到操作码字段",
    url: "/open-course-lessons/computer-systems/11-instruction-set-model/index.html",
    detail: "把教学 ISA 的汇编文本拆成 opcode、寄存器编号、立即数和执行语义。",
    source: "ics-demos",
  },
  "3:1": {
    title: "x86 模拟器设计 · 数据通路与流水线",
    url: "/open-course-lessons/computer-systems/04-x86-simulator/index.html",
    detail: "展示 Y86-64 教学 CPU 的 SEQ、PIPE、数据通路和 CPI 统计。",
    source: "ics-demos",
  },
  "3:2": {
    title: "执行日志 · 从 Trace 定位错误指令",
    url: "/open-course-lessons/computer-systems/12-execution-trace/index.html",
    detail: "通过状态快照、寄存器差异和写回日志定位模拟器实现错误。",
    source: "ics-demos",
  },
};

function lesson(
  title: string,
  duration: string,
  focus: string,
  interaction: string,
  classroomUse: string,
  output: string,
  resource?: DedicatedLessonPage,
): CourseLesson {
  return { title, duration, focus, interaction, classroomUse, output, resource };
}

const openCourses: OpenCourse[] = [
  {
    id: "deep-learning",
    order: "01",
    title: "深度学习框架与编程",
    subtitle: "张量、计算图、自动求导、训练工程",
    coursePosition: "面向框架学习与编程实践的实验课程，适合二、三年级学生。",
    courseGoal: "让学生把框架代码、张量形状、计算图、梯度传播和训练指标建立对应关系。",
    designLanguage: "张量形状、计算图节点、梯度流、训练时间线、指标曲线。",
    keyInteractions: ["shape 追踪", "计算图拼装", "backward 链路", "优化器路径", "loss 曲线对比"],
    chapters: [
      {
        title: "张量与计算图",
        goal: "理解框架中数据如何从数组变成可计算、可求导的对象。",
        lessons: [
          lesson("张量对象与 shape", "40 分钟", "区分标量、向量、矩阵和 batch 张量。", "维度块在不同算子之间流动，错误 shape 会在对应连线上亮起。", "教师现场切换输入 batch，学生判断每一步输出形状。", "shape 追踪表和数据加载代码。"),
          lesson("算子组合与计算图", "45 分钟", "理解算子节点、边和中间结果。", "学生拖动算子节点拼出两层 MLP，页面同步显示输入输出维度。", "教师用错误连线讲解图结构约束。", "计算图截图、模型代码和节点说明。"),
          lesson("前向传播可视化", "45 分钟", "把 forward 函数和图上的数据流对应起来。", "输入样本沿计算图流动，节点颜色表示激活值范围。", "教师暂停在关键节点，学生解释当前数学运算。", "两组输出分布截图和对比说明。"),
        ],
      },
      {
        title: "自动求导与优化",
        goal: "理解 loss、backward 和 optimizer 的分工。",
        lessons: [
          lesson("loss 标量化", "40 分钟", "理解训练目标为什么通常汇总为标量损失。", "多个样本误差聚合成 batch loss，切换损失函数可观察曲面变化。", "学生预测不同 loss 对梯度方向的影响。", "loss 代码、训练曲线和适用场景说明。"),
          lesson("backward 梯度链", "50 分钟", "理解链式法则如何沿计算图反向传播。", "从 loss 节点反向点亮边权，显示每层梯度范数。", "教师遮住部分梯度，学生推断缺失方向。", "梯度日志和异常定位说明。"),
          lesson("optimizer 参数更新", "45 分钟", "理解学习率、动量和参数更新的作用。", "参数点在损失曲面上移动，三组学习率路径并排比较。", "学生判断震荡、停滞和收敛路径。", "指标表、曲线和参数选择理由。"),
        ],
      },
      {
        title: "模型训练工程",
        goal: "从可运行脚本走向可复现实验。",
        lessons: [
          lesson("数据加载与划分", "40 分钟", "掌握训练集、验证集、batch 和 shuffle 的关系。", "样本池被切分、打乱并组成 batch，页面标出数据泄漏风险。", "学生判断划分不均衡和泄漏问题。", "loader 代码和数据分布表。"),
          lesson("训练循环结构", "45 分钟", "掌握 epoch、batch、zero_grad、backward、step 的顺序。", "训练循环时间轴展示每一步调用顺序，乱序步骤可拖拽纠正。", "学生给错误训练步骤排序并说明后果。", "修复前后代码差异和运行结果。"),
          lesson("checkpoint 与指标", "45 分钟", "理解模型保存、验证指标和实验可复现。", "多个 checkpoint 与指标曲线同步展示，标出最佳模型选择点。", "学生根据指标表判断是否过拟合。", "checkpoint 文件说明和指标表。"),
        ],
      },
      {
        title: "框架编程综合实验",
        goal: "完成一次从代码到报告的框架实践闭环。",
        lessons: [
          lesson("手写线性层", "50 分钟", "理解层封装背后的参数和前向计算。", "权重矩阵、偏置项和输入向量逐步参与线性变换。", "学生从公式还原层代码。", "层实现、测试记录和公式说明。"),
          lesson("改造训练脚本", "50 分钟", "根据任务改变模型结构、损失函数和评价指标。", "任务变化引起数据、模型、loss、metric 的同步调整。", "学生分组选择改造目标并说明改动点。", "改造代码、运行日志和指标对比。"),
          lesson("实验报告整理", "40 分钟", "用证据说明训练过程、问题和改进方向。", "代码、曲线、日志和结论汇总成报告结构。", "教师展示两份报告，学生判断证据是否充分。", "最终报告和引用的代码/日志证据。"),
        ],
      },
    ],
  },
  {
    id: "computer-systems",
    order: "02",
    title: "计算机系统导论",
    subtitle: "机器级表示、栈帧、二进制分析、模拟器",
    coursePosition: "面向 C 语言、汇编和系统安全实验的系统基础课程。",
    courseGoal: "让学生看到高级语言如何落到机器指令，以及内存错误为什么会改变程序行为。",
    designLanguage: "机器状态、寄存器、栈帧、机器码字段、控制流图、数据通路。",
    keyInteractions: ["C/汇编/机器码联动", "寄存器单步", "栈帧覆盖", "控制流图", "CPU 数据通路"],
    chapters: [
      {
        title: "数据表示与机器级执行",
        goal: "理解数值表示、指令执行和寄存器状态。",
        lessons: [
          lesson("整数与浮点表示", "40 分钟", "掌握补码、溢出和浮点误差的可观察表现。", "十进制、二进制位模式和解释结果并排变化。", "学生预测加法溢出后的机器结果。", "运行结果、位模式截图和解释。", systemLessons["0:0"]),
          lesson("指令生命周期", "45 分钟", "理解取指、译码、执行和写回的状态变化。", "C 源码、汇编、机器码字段和寄存器状态同步高亮。", "教师暂停在译码阶段，学生判断下一步状态。", "指令表和状态变化说明。", systemLessons["0:1"]),
          lesson("寄存器观察", "40 分钟", "理解通用寄存器、栈指针、返回值寄存器的分工。", "函数执行中寄存器读写被逐步标注。", "学生根据寄存器变化推断源代码语句。", "调试日志和源代码对应关系。", systemLessons["0:2"]),
        ],
      },
      {
        title: "函数调用与栈帧",
        goal: "理解调用约定、局部变量、返回地址和栈风险。",
        lessons: [
          lesson("调用约定", "45 分钟", "理解参数传递、返回值和调用双方职责。", "函数调用前后参数寄存器和栈空间变化。", "学生判断参数位于寄存器还是栈上。", "参数传递说明和调用路径图。", systemLessons["1:0"]),
          lesson("栈帧布局", "50 分钟", "理解局部变量、保存寄存器和返回地址的位置。", "函数进入和返回时栈帧展开与回收。", "学生在栈图上标注局部变量和返回地址。", "栈帧图和断点截图。", systemLessons["1:1"]),
          lesson("缓冲区越界", "50 分钟", "理解越界写入如何破坏相邻内存。", "输入字节逐步覆盖缓冲区、保存值和返回地址。", "学生比较防护机制开启前后的行为差异。", "风险位置、修复代码和验证结果。", systemLessons["1:2"]),
        ],
      },
      {
        title: "二进制程序分析",
        goal: "掌握基本反汇编阅读和控制流分析。",
        lessons: [
          lesson("反汇编读法", "45 分钟", "从反汇编结果中识别函数、跳转和常量。", "反汇编、控制流图和寄存器状态形成单步分析界面。", "学生标注函数边界并推断伪代码。", "伪代码和关键指令说明。", systemLessons["2:0"]),
          lesson("控制流图", "45 分钟", "理解条件跳转和基本块如何组成控制流图。", "汇编跳转指令生成基本块边。", "学生根据 CFG 还原 if/while 结构。", "CFG 和源代码结构解释。", systemLessons["2:1"]),
          lesson("简单漏洞复现", "50 分钟", "理解风险复现需要输入、状态和证据。", "输入触发异常路径时，调用栈、寄存器和日志同步变化。", "教师展示崩溃日志，学生定位触发条件。", "复现步骤、日志和修复建议。", systemLessons["2:2"]),
        ],
      },
      {
        title: "模拟器实验",
        goal: "通过实现简化模拟器理解机器状态转移。",
        lessons: [
          lesson("指令集建模", "45 分钟", "抽象指令格式、操作码和操作数。", "一条指令被拆成 opcode、src、dst 和 immediate。", "学生为三条指令设计数据结构。", "指令定义和解析结果。", systemLessons["3:0"]),
          lesson("状态转移", "50 分钟", "理解每条指令如何改变 PC、寄存器和内存。", "Y86-64 数据通路和流水线阶段逐拍高亮。", "学生预测下一条指令后的状态。", "模拟器代码和状态测试。", systemLessons["3:1"]),
          lesson("执行日志", "40 分钟", "用日志解释程序运行过程。", "状态快照串联成完整执行轨迹。", "学生从日志定位错误指令。", "trace 日志和错误定位说明。", systemLessons["3:2"]),
        ],
      },
    ],
  },
  {
    id: "compiler",
    order: "03",
    title: "编译原理",
    subtitle: "词法、语法、符号表、中间代码、优化",
    coursePosition: "面向编译原理实验课，适合做小型语言或表达式编译器项目。",
    courseGoal: "让学生把文法、树结构、语义检查和中间表示串成可运行的编译流水线。",
    designLanguage: "编译流水线、文法推导、树结构、符号表、IR、优化前后对照。",
    keyInteractions: ["token 流", "LL/LR 分析表", "AST", "符号表", "三地址码", "基本块优化"],
    chapters: [
      {
        title: "词法与语法基础",
        goal: "从源码文本构建可分析的 token 流和语法结构。",
        lessons: [
          lesson("token 规则设计", "40 分钟", "理解关键字、标识符、字面量和运算符的识别规则。", "正则、NFA、DFA 和扫描过程分步联动。", "学生为一段代码标注 token 类型。", "扫描器代码和 token 输出样例。", compilerLessons["0:0"]),
          lesson("文法与优先级", "45 分钟", "理解产生式、递归和运算符优先级。", "First/Follow、分析表和移进归约过程同步变化。", "学生判断一个文法是否会产生二义性。", "文法规则和测试样例。", compilerLessons["0:1"]),
          lesson("AST 构建", "50 分钟", "区分解析树和抽象语法树。", "解析树裁剪为只保留语义节点的 AST。", "学生从表达式手绘 AST。", "AST 输出和可视化截图。", compilerLessons["0:2"]),
        ],
      },
      {
        title: "语义分析",
        goal: "维护作用域、类型和符号信息。",
        lessons: [
          lesson("作用域规则", "45 分钟", "理解全局、局部和嵌套作用域查找。", "变量引用沿作用域链查找定义。", "学生判断变量绑定到哪个声明。", "作用域栈日志和测试结果。", compilerLessons["1:0"]),
          lesson("符号表管理", "45 分钟", "理解声明、引用、重定义和未定义错误。", "嵌套作用域、符号插入、查询和错误定位同步展示。", "学生根据代码片段更新符号表。", "符号表快照和错误样例。", compilerLessons["1:1"]),
          lesson("类型检查", "45 分钟", "理解表达式类型推导和类型不匹配。", "AST 节点自底向上传递类型信息。", "学生定位类型错误产生的位置。", "类型规则和错误报告。", compilerLessons["1:2"]),
        ],
      },
      {
        title: "中间代码与优化",
        goal: "把 AST 转换为可分析、可优化的中间表示。",
        lessons: [
          lesson("三地址码", "50 分钟", "理解临时变量和顺序化表达式求值。", "AST 被展开为三地址码，if/while 回填同步显示。", "学生把一棵 AST 手工翻译为三地址码。", "IR 输出和源代码对应说明。", compilerLessons["2:0"]),
          lesson("控制流生成", "50 分钟", "理解条件语句和循环如何变成标签与跳转。", "if/while 结构转化为基本块和跳转边。", "学生为 if/else 设计标签。", "IR、CFG 图和测试样例。", compilerLessons["2:1"]),
          lesson("局部优化", "45 分钟", "理解常量折叠、公共子表达式和死代码删除。", "优化前后 IR、基本块 DAG 和规则命中点并排比较。", "学生判断哪些语句可以安全优化。", "优化规则、测试和对比结果。", compilerLessons["2:2"]),
        ],
      },
      {
        title: "编译器综合实验",
        goal: "完成一个可测试的小型编译器实验。",
        lessons: [
          lesson("表达式编译器", "60 分钟", "整合词法、语法、AST 和 IR。", "源码从输入框进入完整编译流水线。", "学生分组说明每个模块接口。", "项目代码、模块说明和运行截图。", compilerLessons["3:0"]),
          lesson("错误恢复", "45 分钟", "让编译器给出可理解的错误位置和修复建议。", "错误 token 被定位并映射到源码位置。", "学生改写晦涩错误信息。", "错误样例和报告结果。", compilerLessons["3:1"]),
          lesson("编译器测试与回归验证", "45 分钟", "验收词法、语法、AST、语义诊断和 IR 输出是否稳定。", "输入样例逐项穿过编译流水线，页面标出通过、诊断和未进入阶段。", "学生用金标准输出解释自己的编译器为什么通过或失败。", "编译器验收矩阵、回归记录和失败定位说明。", compilerLessons["3:2"]),
        ],
      },
    ],
  },
  {
    id: "database",
    order: "04",
    title: "数据库系统概论",
    subtitle: "建模、SQL、优化、事务应用",
    coursePosition: "面向数据库系统课程设计，适合结合真实业务项目。",
    courseGoal: "让学生从业务问题进入数据建模、SQL 编写、执行计划和事务一致性。",
    designLanguage: "查询计划、关系代数、索引路径、事务时间线、锁等待图。",
    keyInteractions: ["ER 转关系表", "SQL 结果追踪", "执行计划树", "B+Tree 查找", "事务并发轨迹"],
    chapters: [
      {
        title: "真实场景数据建模",
        goal: "从业务叙述抽取实体、关系、约束和表结构。",
        lessons: [
          lesson("场景到实体", "40 分钟", "从校园项目管理场景识别实体和关系。", "业务文本中的名词和动词映射到实体关系图。", "学生标注需求文本中的实体、属性和关系。", "ER 图和实体关系说明。"),
          lesson("ER 到关系表", "45 分钟", "理解主键、外键和多对多关系拆表。", "ER 图逐步转换为关系表结构。", "学生判断多对多关系是否需要中间表。", "DDL 脚本和约束说明。"),
          lesson("约束与数据质量", "45 分钟", "理解 not null、unique、check 和外键约束的价值。", "错误数据进入表时被约束拦截。", "学生为异常数据选择合适约束。", "约束 SQL 和测试结果。"),
        ],
      },
      {
        title: "SQL 能力培养",
        goal: "掌握查询、连接、聚合和复杂条件表达。",
        lessons: [
          lesson("select 与条件查询", "40 分钟", "理解投影、筛选、排序和分页。", "查询条件逐层过滤数据表行。", "学生根据业务问题写查询草稿。", "SQL 脚本和结果截图。"),
          lesson("join 与聚合", "50 分钟", "理解多表连接、group by 和聚合统计。", "两张表按外键连接并形成统计结果。", "学生预测 join 后行数变化。", "查询 SQL 和统计结果说明。"),
          lesson("窗口函数与排名", "45 分钟", "理解窗口函数如何在分组内保留明细。", "同一班级内项目得分排名的窗口计算过程。", "学生比较 group by 和 window 的差异。", "窗口函数 SQL 和结果解释。"),
        ],
      },
      {
        title: "查询优化",
        goal: "看懂执行计划，知道索引何时有效。",
        lessons: [
          lesson("EXPLAIN 读法", "45 分钟", "理解扫描、连接、过滤和代价估计。", "SQL 被转换成树状执行计划。", "学生标注执行计划中的瓶颈节点。", "计划截图和瓶颈说明。"),
          lesson("索引选择", "45 分钟", "理解 B+Tree 索引、组合索引和选择度。", "查询条件沿索引树定位目标行。", "学生为不同 where 条件选择索引。", "优化前后计划和耗时对比。"),
          lesson("慢查询诊断", "45 分钟", "从业务、SQL 和索引三层定位慢查询原因。", "慢查询被拆成数据量、过滤条件、连接方式和排序代价。", "学生给出三种优化方案并比较风险。", "诊断报告和优化 SQL。"),
        ],
      },
      {
        title: "事务与应用开发",
        goal: "把数据库能力接入真实应用。",
        lessons: [
          lesson("事务隔离", "45 分钟", "理解脏读、不可重复读、幻读和隔离级别。", "两个事务并发读写同一数据的时间线。", "学生判断并发现象属于哪一类。", "事务脚本和现象解释。"),
          lesson("应用接口设计", "45 分钟", "理解 API 如何安全读写数据库。", "前端请求进入服务层、校验、事务和返回结果。", "学生为一个接口设计请求和响应结构。", "接口代码和测试记录。"),
          lesson("运维与备份", "40 分钟", "理解备份、恢复、迁移和基础监控。", "数据库从快照恢复到指定版本。", "学生制定一次实验库备份计划。", "备份文件说明和恢复记录。"),
        ],
      },
    ],
  },
  {
    id: "os-kernel",
    order: "05",
    title: "操作系统内核构建",
    subtitle: "系统调用、进程、内存、文件与 I/O",
    coursePosition: "面向操作系统课程实验，适合从可视化路径过渡到内核补丁。",
    courseGoal: "让学生把操作系统机制、内核代码路径和实验调试证据对应起来。",
    designLanguage: "内核路径、进程状态、页表映射、文件对象、设备队列。",
    keyInteractions: ["Trap 路径", "调度队列", "虚拟地址翻译", "文件描述符表", "I/O 中断链路"],
    chapters: [
      {
        title: "内核启动与系统调用",
        goal: "理解应用如何通过 trap 进入内核。",
        lessons: [
          lesson("内核启动路径", "45 分钟", "理解 bootloader、入口函数和初始化顺序。", "启动入口逐步初始化内存、时钟和控制台。", "学生给内核启动日志排序。", "日志和启动流程图。"),
          lesson("trap 与系统调用", "50 分钟", "理解用户态到内核态的切换。", "应用调用 syscall 后寄存器、栈和处理函数的变化。", "学生在调用路径图上标注边界。", "调用路径和关键函数说明。"),
          lesson("新增系统调用", "60 分钟", "掌握系统调用号、分发器和处理函数的连接。", "系统调用表新增入口并被用户程序触发。", "学生说明新增调用需要改哪些文件。", "补丁、用户态测试和运行结果。"),
        ],
      },
      {
        title: "进程管理",
        goal: "理解进程状态、调度和上下文切换。",
        lessons: [
          lesson("进程状态模型", "40 分钟", "理解 ready、running、blocked、exit 状态转换。", "进程在状态机中随事件迁移。", "学生根据事件判断下一个状态。", "状态迁移表和日志。"),
          lesson("调度器", "50 分钟", "理解调度队列、时间片和优先级。", "多个进程从就绪队列进入 CPU。", "学生手工模拟轮转调度。", "调度记录和对比说明。"),
          lesson("上下文切换", "45 分钟", "理解寄存器保存和恢复。", "进程 A 的寄存器被保存，进程 B 的上下文被恢复。", "学生标注切换前后寄存器值。", "trace 和切换说明。"),
        ],
      },
      {
        title: "内存管理",
        goal: "理解虚拟地址、页表和物理页。",
        lessons: [
          lesson("虚拟地址空间", "45 分钟", "理解用户空间、内核空间和段布局。", "一个进程地址空间被分为 text、data、heap、stack。", "学生判断变量落在哪个区域。", "地址记录和区域解释。"),
          lesson("页表映射", "50 分钟", "理解虚拟页到物理页的映射过程。", "虚拟地址被拆成页号和偏移，沿页表找到物理页。", "学生手工完成一次地址翻译。", "地址翻译表和代码位置。"),
          lesson("缺页与分配", "45 分钟", "理解缺页异常、页面分配和权限检查。", "访问未映射页面触发异常并分配新页。", "学生判断一次异常是否应分配页面。", "缺页日志和原因解释。"),
        ],
      },
      {
        title: "文件系统与 I/O",
        goal: "理解文件抽象和设备访问路径。",
        lessons: [
          lesson("文件描述符", "40 分钟", "理解进程文件表和打开文件对象。", "fd 映射到文件对象和 inode。", "学生判断 dup 后的共享关系。", "fd 表和运行日志。"),
          lesson("文件系统路径", "45 分钟", "理解路径解析、目录项和 inode。", "路径名逐级查找到 inode。", "学生追踪一个路径解析过程。", "路径解析日志。"),
          lesson("设备 I/O", "45 分钟", "理解驱动、缓冲区和中断处理。", "读写请求进入设备队列并由中断完成。", "学生说明同步和异步 I/O 差异。", "I/O 路径图和日志。"),
        ],
      },
    ],
  },
  {
    id: "computational-thinking",
    order: "06",
    title: "计算思维相关方向",
    subtitle: "分解、抽象、状态、调试迁移",
    coursePosition: "面向低年级程序设计和计算思维课程。",
    courseGoal: "让学生通过可见状态理解抽象算法，并形成调试和迁移能力。",
    designLanguage: "问题分解、状态转移、递归栈、搜索树、调试轨迹。",
    keyInteractions: ["状态表", "循环不变式", "BFS/DFS 轨迹", "递归调用栈", "错因分类"],
    chapters: [
      {
        title: "问题分解与抽象",
        goal: "把复杂问题拆成输入、输出、约束和子任务。",
        lessons: [
          lesson("问题边界", "35 分钟", "识别输入、输出、限制条件和评价标准。", "自然语言题目被拆成结构化问题卡片。", "学生为一道题补全输入输出说明。", "问题卡片和边界说明。"),
          lesson("抽象模型", "40 分钟", "从现实对象抽象出变量、关系和操作。", "地图、队列、表格等现实对象转成数据结构。", "学生为场景选择合适抽象模型。", "模型说明和示例数据。"),
          lesson("子任务拆解", "40 分钟", "把目标拆成可实现、可测试的小步骤。", "大问题被切成输入处理、核心逻辑和输出展示。", "学生重排解决步骤并解释依赖关系。", "拆解清单和伪代码。"),
        ],
      },
      {
        title: "算法状态与控制",
        goal: "用状态变化理解循环、分支和不变式。",
        lessons: [
          lesson("循环状态", "40 分钟", "理解循环变量、终止条件和不变式。", "循环每轮更新状态表并检查终止条件。", "学生预测下一轮循环变量。", "状态表和不变式说明。"),
          lesson("分支决策", "35 分钟", "理解条件判断如何改变执行路径。", "输入数据进入决策树，不同条件触发不同路径。", "学生为边界输入选择分支路径。", "测试用例和路径覆盖说明。"),
          lesson("状态机", "45 分钟", "用状态机描述流程型问题。", "订单、游戏或任务状态随事件迁移。", "学生发现非法状态迁移。", "状态图和状态机代码。"),
        ],
      },
      {
        title: "递归、搜索与图",
        goal: "理解递归调用、搜索边界和图遍历轨迹。",
        lessons: [
          lesson("递归调用栈", "45 分钟", "理解递归进入、返回和基线条件。", "递归调用帧层层压栈再回收。", "学生标注每一层递归参数。", "调用树和终止条件说明。"),
          lesson("BFS 与 DFS", "50 分钟", "理解队列、栈和访问标记的区别。", "图节点按 BFS/DFS 两种策略被访问。", "学生预测下一次访问节点。", "轨迹表和差异说明。"),
          lesson("剪枝与搜索边界", "45 分钟", "理解剪枝如何减少无效搜索。", "搜索树中不满足条件的分支被剪掉。", "学生指出哪些分支可提前停止。", "剪枝前后搜索次数对比。"),
        ],
      },
      {
        title: "调试与迁移",
        goal: "把错误分析和同类迁移变成可训练能力。",
        lessons: [
          lesson("调试轨迹", "40 分钟", "用变量快照定位错误步骤。", "断点、变量表和输出共同形成调试时间线。", "学生根据轨迹找出第一处错误状态。", "错误定位和修复说明。"),
          lesson("错因分类", "35 分钟", "区分边界错误、状态遗漏、条件反转和类型错误。", "错误样例进入错因分类面板。", "学生给错题贴标签并说明原因。", "错因卡片和修复策略。"),
          lesson("同类迁移", "40 分钟", "把一种解法迁移到结构相似的问题。", "两个题目的状态结构被对齐比较。", "学生找出新题与旧题的相同结构。", "练习记录和迁移总结。"),
        ],
      },
    ],
  },
  {
    id: "software-engineering",
    order: "07",
    title: "软件工程",
    subtitle: "需求、设计、编码、测试、项目管理",
    coursePosition: "面向真实项目实践，直接服务学生项目上传、分析和改进。",
    courseGoal: "让学生把软件工程生命周期落到真实项目证据和持续改进任务。",
    designLanguage: "项目证据、需求流、模块边界、测试矩阵、协作图。",
    keyInteractions: ["用户故事地图", "架构依赖图", "仓库结构剖析", "测试矩阵", "贡献图"],
    chapters: [
      {
        title: "需求工程",
        goal: "从真实场景抽取用户、场景、功能和优先级。",
        lessons: [
          lesson("用户与场景", "40 分钟", "识别目标用户、使用场景和核心痛点。", "用户旅程从触发点到完成目标逐步展开。", "学生为项目写 3 个用户故事。", "用户故事和检查结果。"),
          lesson("功能范围", "45 分钟", "区分核心功能、扩展功能和暂不实现功能。", "功能池按价值和实现成本进入优先级矩阵。", "学生把功能卡片拖到不同优先级。", "功能清单和取舍理由。"),
          lesson("需求验收标准", "45 分钟", "把需求写成可测试、可验收的条件。", "模糊需求转化为 Given-When-Then 验收项。", "学生重写 3 条不可验收需求。", "验收标准和测试映射。"),
        ],
      },
      {
        title: "软件设计",
        goal: "形成模块、数据、接口和交互设计。",
        lessons: [
          lesson("原型与流程", "45 分钟", "用流程图说明用户如何完成关键任务。", "页面节点和操作路径形成交互流程图。", "学生找出流程中的断点和回退路径。", "流程图和检查报告。"),
          lesson("模块划分", "45 分钟", "理解前端、后端、数据和智能分析模块边界。", "功能需求映射到模块和接口边界。", "学生判断功能应该归属哪个模块。", "模块图和职责说明。"),
          lesson("接口与数据模型", "50 分钟", "让接口、实体和权限边界互相匹配。", "请求从页面到接口再到数据表的路径。", "学生检查一组接口是否缺少权限条件。", "API 草案和数据模型。"),
        ],
      },
      {
        title: "实现与测试",
        goal: "让项目可运行、可测试、可交付。",
        lessons: [
          lesson("代码结构", "45 分钟", "理解目录结构、入口文件、依赖和配置。", "项目目录被解析成前端、后端、测试、文档区域。", "学生判断一个目录结构的维护风险。", "项目分析报告。"),
          lesson("测试设计", "50 分钟", "覆盖正常路径、异常输入和边界条件。", "功能需求映射到测试用例矩阵。", "学生为上传、查询、分析各写一条测试。", "测试代码和运行记录。"),
          lesson("运行与部署", "45 分钟", "确保项目能被他人复现运行。", "依赖安装、环境变量、数据库初始化和启动流程。", "学生互换 README 尝试运行项目。", "运行说明和复现记录。"),
        ],
      },
      {
        title: "项目管理与讲评",
        goal: "将项目证据转化为团队改进和课堂讲评。",
        lessons: [
          lesson("团队分工", "40 分钟", "把成员职责、提交证据和模块成果对应起来。", "团队成员、模块、提交记录和产出形成分工图。", "学生补全团队分工和贡献说明。", "分工表和项目贡献说明。"),
          lesson("项目分析报告", "45 分钟", "读懂系统给出的多维度分数和证据片段。", "代码结构、测试、文档、需求证据汇总成报告。", "学生找出报告中最需要立即处理的问题。", "改进任务和执行计划。"),
          lesson("班级讲评", "45 分钟", "教师基于班级共性问题组织讲评和补充练习。", "班级项目报告汇总成维度分布和共性短板。", "教师选择一个共性问题现场展开讲评。", "讲评材料和课后任务。"),
        ],
      },
    ],
  },
  {
    id: "ai-infra",
    order: "08",
    title: "AI 基础设施",
    subtitle: "算子、编译优化、通信、性能分析",
    coursePosition: "面向 AI 系统与基础设施实践课程，适合作为高年级综合实验。",
    courseGoal: "让学生理解大模型背后的系统能力，能解释算子性能、编译优化和分布式通信瓶颈。",
    designLanguage: "算子执行、访存模式、编译图优化、分布式通信、性能剖析。",
    keyInteractions: ["算子热力图", "kernel 时间线", "图级重写", "AllReduce 环路", "Profile 时间图"],
    chapters: [
      {
        title: "高性能算子基础",
        goal: "理解算子、内存访问和并行执行。",
        lessons: [
          lesson("算子抽象", "45 分钟", "理解矩阵乘法、激活函数和归一化等算子的输入输出。", "张量块进入算子并输出新张量块。", "学生标注算子的输入维度和输出维度。", "算子代码和输入输出说明。"),
          lesson("内存访问", "50 分钟", "理解连续访问、缓存命中和访存瓶颈。", "线程访问矩阵元素时的内存带宽变化。", "学生判断哪个访问模式更友好。", "性能对比表和解释。"),
          lesson("并行执行", "50 分钟", "理解线程划分、block/grid 和同步。", "矩阵块分配到并行执行单元。", "学生设计一个 block 划分方案。", "并行代码和加速比。"),
        ],
      },
      {
        title: "AI 编译优化",
        goal: "理解计算图和编译优化如何影响性能。",
        lessons: [
          lesson("计算图表示", "45 分钟", "理解模型被拆成算子图。", "模型结构转化为有向无环计算图。", "学生识别图中的可融合算子。", "计算图和算子列表。"),
          lesson("算子融合", "50 分钟", "理解融合如何减少内存读写和调度开销。", "多个相邻算子合并为一个 kernel。", "学生判断哪些算子可以安全融合。", "性能数据和融合说明。"),
          lesson("图级优化", "45 分钟", "理解常量折叠、公共子图和布局转换。", "计算图经过规则重写变得更短。", "学生找出冗余计算节点。", "优化前后图和理由。"),
        ],
      },
      {
        title: "分布式通信",
        goal: "理解数据并行和梯度同步。",
        lessons: [
          lesson("数据并行", "45 分钟", "理解 batch 被拆分到多个设备训练。", "样本分片进入不同设备并产生局部梯度。", "学生计算每个设备处理的数据量。", "流程图和数据分片说明。"),
          lesson("AllReduce", "50 分钟", "理解梯度聚合和同步通信。", "多个设备的梯度在环形通信中被归约。", "学生标注每轮通信的数据流向。", "通信示意和步骤表。"),
          lesson("通信瓶颈", "45 分钟", "理解带宽、延迟和计算通信重叠。", "训练时间线展示计算段和通信段。", "学生判断瓶颈来自计算还是通信。", "瓶颈分析和优化建议。"),
        ],
      },
      {
        title: "性能分析综合实验",
        goal: "用数据驱动优化判断。",
        lessons: [
          lesson("性能指标", "40 分钟", "理解吞吐率、延迟、显存占用和利用率。", "训练过程中的核心指标同步变化。", "学生根据指标判断系统状态。", "指标表和采集方法。"),
          lesson("profiling 读法", "50 分钟", "从 profile 中定位耗时算子和通信热点。", "时间线中热点 kernel 被高亮。", "学生标注 profile 中最耗时阶段。", "热点列表和定位依据。"),
          lesson("优化报告", "45 分钟", "把性能数据转化为可验证优化方案。", "瓶颈、方案、风险和预期收益形成优化报告。", "学生为一个瓶颈选择最合适优化策略。", "报告和验证计划。"),
        ],
      },
    ],
  },
];

function clampIndex(index: number, length: number) {
  if (Number.isNaN(index) || length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

function getLessonCount(course: OpenCourse) {
  return course.chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0);
}

function getReadyLessonCount(course: OpenCourse) {
  return course.chapters.reduce(
    (sum, chapter) => sum + chapter.lessons.filter((item) => item.resource).length,
    0,
  );
}

function readOpenCourseRoute(): OpenCourseRoute | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [moduleName, routeView, routeCourseId, routeChapter, routeLesson] = hash.split("/");
  if (moduleName !== "open-course") return null;

  const course = openCourses.find((item) => item.id === routeCourseId) ?? openCourses[0];
  const chapterIndex = clampIndex(Number(routeChapter ?? 0), course.chapters.length);
  const chapter = course.chapters[chapterIndex] ?? course.chapters[0];
  const lessonIndex = clampIndex(Number(routeLesson ?? 0), chapter.lessons.length);
  const validView = routeView === "course" || routeView === "chapter" || routeView === "lesson" ? routeView : "catalog";

  return {
    view: validView,
    courseId: course.id,
    chapterIndex,
    lessonIndex,
  };
}

function writeOpenCourseRoute(route: OpenCourseRoute) {
  if (typeof window === "undefined") return;
  const hash =
    route.view === "catalog"
      ? "#/open-course/catalog"
      : `#/open-course/${route.view}/${route.courseId}/${route.chapterIndex}/${route.lessonIndex}`;
  if (window.location.hash !== hash) {
    window.history.pushState(null, "", hash);
  }
}

function findAdjacentLesson(course: OpenCourse, chapterIndex: number, lessonIndex: number, offset: -1 | 1) {
  const flat = course.chapters.flatMap((chapter, nextChapterIndex) =>
    chapter.lessons.map((_, nextLessonIndex) => ({ chapterIndex: nextChapterIndex, lessonIndex: nextLessonIndex })),
  );
  const currentIndex = flat.findIndex((item) => item.chapterIndex === chapterIndex && item.lessonIndex === lessonIndex);
  const nextIndex = (currentIndex + offset + flat.length) % flat.length;
  return flat[nextIndex] ?? flat[0];
}

export function OpenCourseStudio() {
  const initialRoute = readOpenCourseRoute();
  const [view, setView] = useState<OpenCourseView>(initialRoute?.view ?? "catalog");
  const [courseId, setCourseId] = useState(initialRoute?.courseId ?? openCourses[0].id);
  const [chapterIndex, setChapterIndex] = useState(initialRoute?.chapterIndex ?? 0);
  const [lessonIndex, setLessonIndex] = useState(initialRoute?.lessonIndex ?? 0);

  const activeCourse = openCourses.find((course) => course.id === courseId) ?? openCourses[0];
  const safeChapterIndex = clampIndex(chapterIndex, activeCourse.chapters.length);
  const activeChapter = activeCourse.chapters[safeChapterIndex] ?? activeCourse.chapters[0];
  const safeLessonIndex = clampIndex(lessonIndex, activeChapter.lessons.length);
  const activeLesson = activeChapter.lessons[safeLessonIndex] ?? activeChapter.lessons[0];
  const suiteChapterCount = useMemo(() => openCourses.reduce((sum, course) => sum + course.chapters.length, 0), []);
  const suiteLessonCount = useMemo(() => openCourses.reduce((sum, course) => sum + getLessonCount(course), 0), []);
  const suiteReadyCount = useMemo(() => openCourses.reduce((sum, course) => sum + getReadyLessonCount(course), 0), []);

  useEffect(() => {
    const handleHashChange = () => {
      const nextRoute = readOpenCourseRoute();
      if (!nextRoute) return;
      setView(nextRoute.view);
      setCourseId(nextRoute.courseId);
      setChapterIndex(nextRoute.chapterIndex);
      setLessonIndex(nextRoute.lessonIndex);
    };

    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("popstate", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("popstate", handleHashChange);
    };
  }, []);

  const navigate = (nextRoute: OpenCourseRoute) => {
    setView(nextRoute.view);
    setCourseId(nextRoute.courseId);
    setChapterIndex(nextRoute.chapterIndex);
    setLessonIndex(nextRoute.lessonIndex);
    writeOpenCourseRoute(nextRoute);
  };

  const openCatalog = () => navigate({ view: "catalog", courseId: activeCourse.id, chapterIndex: 0, lessonIndex: 0 });
  const openCourse = (nextCourseId: string) => navigate({ view: "course", courseId: nextCourseId, chapterIndex: 0, lessonIndex: 0 });
  const openChapter = (nextChapterIndex: number) =>
    navigate({ view: "chapter", courseId: activeCourse.id, chapterIndex: nextChapterIndex, lessonIndex: 0 });
  const openLesson = (nextLessonIndex: number) =>
    navigate({ view: "lesson", courseId: activeCourse.id, chapterIndex: safeChapterIndex, lessonIndex: nextLessonIndex });
  const openActiveCourse = () => navigate({ view: "course", courseId: activeCourse.id, chapterIndex: 0, lessonIndex: 0 });
  const openActiveChapter = () =>
    navigate({ view: "chapter", courseId: activeCourse.id, chapterIndex: safeChapterIndex, lessonIndex: 0 });
  const openAdjacentLesson = (offset: -1 | 1) => {
    const next = findAdjacentLesson(activeCourse, safeChapterIndex, safeLessonIndex, offset);
    navigate({ view: "lesson", courseId: activeCourse.id, chapterIndex: next.chapterIndex, lessonIndex: next.lessonIndex });
  };

  const breadcrumb = (
    <nav className="open-course-breadcrumb" aria-label="开源课堂路径">
      <button type="button" onClick={openCatalog}>课程目录</button>
      {view !== "catalog" && (
        <button type="button" onClick={openActiveCourse}>{activeCourse.title}</button>
      )}
      {(view === "chapter" || view === "lesson") && (
        <button type="button" onClick={openActiveChapter}>第 {safeChapterIndex + 1} 章</button>
      )}
      {view === "lesson" && <span>{activeLesson.title}</span>}
    </nav>
  );

  if (view === "catalog") {
    return (
      <section className="open-course-studio open-course-view view-catalog">
        <section className="open-course-hero catalog-hero">
          <div>
            <span className="section-label">智创开源课堂</span>
            <h2>按学科分别设计的课程课件库</h2>
            <p>从课程进入章节，再进入具体课节。已完成的课节直接打开独立 HTML 课堂页面，未完成的课节只保留建设说明，不复用通用演示界面。</p>
          </div>
          <div className="open-course-hero-metrics" aria-label="课程规模">
            <article>
              <strong>{openCourses.length}</strong>
              <span>课程方向</span>
            </article>
            <article>
              <strong>{suiteChapterCount}</strong>
              <span>章节</span>
            </article>
            <article>
              <strong>{suiteReadyCount}/{suiteLessonCount}</strong>
              <span>已接入课节</span>
            </article>
          </div>
        </section>

        <section className="course-catalog-grid" aria-label="课程列表">
          {openCourses.map((course) => {
            const lessonCount = getLessonCount(course);
            const readyCount = getReadyLessonCount(course);
            return (
              <button
                key={course.id}
                className={`course-catalog-card course-${course.id}`}
                type="button"
                onClick={() => openCourse(course.id)}
              >
                <span>{course.order}</span>
                <div>
                  <strong>{course.title}</strong>
                  <small>{course.subtitle}</small>
                </div>
                <em>{course.chapters.length} 章 · {lessonCount} 节 · {readyCount} 个已接入</em>
              </button>
            );
          })}
        </section>
      </section>
    );
  }

  if (view === "course") {
    return (
      <section className="open-course-studio open-course-view view-course">
        {breadcrumb}
        <section className="course-detail-head">
          <button type="button" onClick={openCatalog}>返回课程目录</button>
          <div>
            <span className="section-label">{activeCourse.coursePosition}</span>
            <h2>{activeCourse.title}</h2>
            <p>{activeCourse.courseGoal}</p>
          </div>
          <div className="course-detail-stats" aria-label="课程结构">
            <span>{activeCourse.chapters.length} 章</span>
            <span>{getLessonCount(activeCourse)} 节</span>
            <span>{getReadyLessonCount(activeCourse)} 个已接入</span>
          </div>
        </section>

        <section className="course-design-panel">
          <article>
            <span className="section-label">本课程交互语言</span>
            <h3>{activeCourse.designLanguage}</h3>
          </article>
          <div className="course-design-chips" aria-label="核心交互">
            {activeCourse.keyInteractions.map((item) => <span key={item}>{item}</span>)}
          </div>
        </section>

        <section className="chapter-grid" aria-label={`${activeCourse.title}章节`}>
          {activeCourse.chapters.map((chapter, index) => {
            const readyCount = chapter.lessons.filter((item) => item.resource).length;
            return (
              <button
                key={chapter.title}
                className="chapter-card"
                type="button"
                onClick={() => openChapter(index)}
              >
                <span>第 {index + 1} 章</span>
                <strong>{chapter.title}</strong>
                <p>{chapter.goal}</p>
                <em>{readyCount}/{chapter.lessons.length} 个已接入</em>
              </button>
            );
          })}
        </section>
      </section>
    );
  }

  if (view === "chapter") {
    return (
      <section className="open-course-studio open-course-view view-chapter">
        {breadcrumb}
        <section className="chapter-detail-head">
          <button type="button" onClick={openActiveCourse}>返回课程</button>
          <div>
            <span className="section-label">{activeCourse.title}</span>
            <h2>第 {safeChapterIndex + 1} 章 · {activeChapter.title}</h2>
            <p>{activeChapter.goal}</p>
          </div>
        </section>

        <section className="lesson-entry-grid" aria-label={`${activeChapter.title}课节`}>
          {activeChapter.lessons.map((item, index) => (
            <button
              key={item.title}
              className={`lesson-entry-card${item.resource ? " has-dedicated-page" : " is-planned"}`}
              type="button"
              onClick={() => openLesson(index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.resource ? item.resource.detail : item.focus}</p>
              </div>
              <em>{item.resource ? "打开课件" : "待独立设计"}</em>
            </button>
          ))}
        </section>
      </section>
    );
  }

  return (
    <section className="open-course-studio open-course-view view-lesson">
      {breadcrumb}
      <section className="lesson-screen-head">
        <button type="button" onClick={openActiveChapter}>返回章节</button>
        <div>
          <span className="section-label">
            {activeCourse.title} · 第 {safeChapterIndex + 1} 章 · 第 {safeLessonIndex + 1} 节
          </span>
          <h2>{activeLesson.title}</h2>
        </div>
        {activeLesson.resource ? (
          <a href={activeLesson.resource.url} target="_blank" rel="noreferrer">全屏打开</a>
        ) : (
          <strong>{activeLesson.duration}</strong>
        )}
      </section>

      {activeLesson.resource ? (
        <section className="lesson-frame-shell">
          <div className="dedicated-lesson-panel">
            <div>
              <span className="section-label">已接入独立课件</span>
              <h3>{activeLesson.resource.title}</h3>
              <p>{activeLesson.resource.detail}</p>
            </div>
            <a href={activeLesson.resource.url} target="_blank" rel="noreferrer">进入全屏课件</a>
          </div>
          <iframe
            className="dedicated-lesson-frame"
            src={activeLesson.resource.url}
            title={activeLesson.resource.title}
          />
        </section>
      ) : (
        <section className="lesson-detail-grid">
          <article className="lesson-state-panel">
            <span className="section-label">待建设课节</span>
            <h3>{activeCourse.designLanguage}</h3>
            <p>本节还没有接入独立 HTML 课件。后续需要围绕本学科的核心对象单独设计页面，而不是复用其他课程的布局。</p>
          </article>
          <article className="lesson-brief-card">
            <span>知识重点</span>
            <p>{activeLesson.focus}</p>
          </article>
          <article className="lesson-brief-card">
            <span>交互形式</span>
            <p>{activeLesson.interaction}</p>
          </article>
          <article className="lesson-brief-card">
            <span>课堂使用</span>
            <p>{activeLesson.classroomUse}</p>
          </article>
          <article className="lesson-brief-card">
            <span>学生产出</span>
            <p>{activeLesson.output}</p>
          </article>
        </section>
      )}

      <nav className="lesson-nav-strip" aria-label="课节切换">
        <button type="button" onClick={() => openAdjacentLesson(-1)}>上一节</button>
        <span>{activeChapter.title} · {safeLessonIndex + 1}/{activeChapter.lessons.length}</span>
        <button type="button" onClick={() => openAdjacentLesson(1)}>下一节</button>
      </nav>
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";

import { askAgent } from "../shared/api/agent";
import { fetchClasses, fetchCourses, fetchStudents } from "../shared/api/academic";
import { analyzeDemoAssignment, fetchAssignmentDashboard } from "../shared/api/assignments";
import { createDemoSession, fetchDemoAccounts } from "../shared/api/auth";
import {
  fetchGrowthProfile,
  generateLearningPlan,
  recommendCompetitions,
  recommendTeam,
} from "../shared/api/growth";
import { fetchKnowledgeDocuments, searchKnowledge } from "../shared/api/knowledge";
import { fetchStudentTasks, generateReview, saveTask } from "../shared/api/tasks";
import type { ChatResponse } from "../shared/types/agent";
import type { ClassListResponse, CourseListResponse, StudentListResponse } from "../shared/types/academic";
import type { AssignmentDashboard, AssignmentReport } from "../shared/types/assignments";
import type { DemoAccount } from "../shared/types/auth";
import type {
  CompetitionRecommendResponse,
  GrowthProfile,
  LearningPlan,
  TeamRecommendResponse,
} from "../shared/types/growth";
import type { KnowledgeDocumentsResponse, KnowledgeSearchResponse } from "../shared/types/knowledge";
import type { ViewMode } from "../shared/types/navigation";
import type { LearningTask, ReviewResponse, TaskListResponse } from "../shared/types/tasks";

export function Dashboard() {
  const [mode, setMode] = useState<ViewMode>("teacher");
  const [report, setReport] = useState<AssignmentReport | null>(null);
  const [dashboard, setDashboard] = useState<AssignmentDashboard | null>(null);
  const [profile, setProfile] = useState<GrowthProfile | null>(null);
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [competitions, setCompetitions] = useState<CompetitionRecommendResponse | null>(null);
  const [team, setTeam] = useState<TeamRecommendResponse | null>(null);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocumentsResponse | null>(null);
  const [knowledgeSearch, setKnowledgeSearch] = useState<KnowledgeSearchResponse | null>(null);
  const [knowledgeQuery, setKnowledgeQuery] = useState("作业 Rubric");
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [currentAccount, setCurrentAccount] = useState<DemoAccount | null>(null);
  const [taskList, setTaskList] = useState<TaskListResponse | null>(null);
  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [taskLoading, setTaskLoading] = useState(false);
  const [courses, setCourses] = useState<CourseListResponse | null>(null);
  const [classes, setClasses] = useState<ClassListResponse | null>(null);
  const [students, setStudents] = useState<StudentListResponse | null>(null);
  const [chatQuestion, setChatQuestion] = useState("如何准备算法竞赛？");
  const [chatResponse, setChatResponse] = useState<ChatResponse | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const [
          reportData,
          dashboardData,
          profileData,
          planData,
          competitionData,
          teamData,
          knowledgeData,
          searchData,
          accountsData,
          taskData,
          coursesData,
          classesData,
          studentsData,
        ] = await Promise.all([
          analyzeDemoAssignment(),
          fetchAssignmentDashboard(),
          fetchGrowthProfile(),
          generateLearningPlan(),
          recommendCompetitions(),
          recommendTeam(),
          fetchKnowledgeDocuments(),
          searchKnowledge("作业 Rubric"),
          fetchDemoAccounts(),
          fetchStudentTasks(),
          fetchCourses(),
          fetchClasses(),
          fetchStudents(),
        ]);

        if (mounted) {
          setReport(reportData);
          setDashboard(dashboardData);
          setProfile(profileData);
          setPlan(planData);
          setCompetitions(competitionData);
          setTeam(teamData);
          setKnowledgeDocs(knowledgeData);
          setKnowledgeSearch(searchData);
          setAccounts(accountsData.accounts);
          setCurrentAccount(
            accountsData.accounts.find((account) => account.role === "teacher") ??
              accountsData.accounts[0],
          );
          setTaskList(taskData);
          setCourses(coursesData);
          setClasses(classesData);
          setStudents(studentsData);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "加载失败");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const averageScore = useMemo(() => {
    if (!report) return 0;
    const total = report.scores.reduce((sum, score) => sum + score.score, 0);
    return Math.round(total / report.scores.length);
  }, [report]);

  async function handleAskAgent(question = chatQuestion) {
    try {
      setChatLoading(true);
      setError(null);
      setChatQuestion(question);
      const response = await askAgent(question);
      setChatResponse(response);
      setMode("knowledge");
    } catch (err) {
      setError(err instanceof Error ? err.message : "知识库问答加载失败");
    } finally {
      setChatLoading(false);
    }
  }

  async function handleAccountChange(userId: string) {
    try {
      setError(null);
      const session = await createDemoSession(userId);
      setCurrentAccount(session.account);
      setMode(session.account.default_view);
    } catch (err) {
      setError(err instanceof Error ? err.message : "演示账号切换失败");
    }
  }

  async function handleKnowledgeSearch(query = knowledgeQuery) {
    try {
      setKnowledgeLoading(true);
      setError(null);
      setKnowledgeQuery(query);
      const response = await searchKnowledge(query);
      setKnowledgeSearch(response);
      setMode("kb");
    } catch (err) {
      setError(err instanceof Error ? err.message : "知识库检索失败");
    } finally {
      setKnowledgeLoading(false);
    }
  }

  async function handleGenerateReview() {
    try {
      setTaskLoading(true);
      setError(null);
      const response = await generateReview();
      setReview(response);
      setMode("tasks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "复盘生成失败");
    } finally {
      setTaskLoading(false);
    }
  }

  async function handleSaveTask() {
    try {
      setTaskLoading(true);
      setError(null);
      const task = await saveTask("补充一次课程作业自动化测试记录");
      setTaskList((current) =>
        current
          ? {
              ...current,
              total: current.total + 1,
              tasks: [task, ...current.tasks],
            }
          : current,
      );
      setMode("tasks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "任务保存失败");
    } finally {
      setTaskLoading(false);
    }
  }

  return (
    <main className="workspace">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">Z</span>
          <div>
            <strong>智创Agent</strong>
            <span>教学智能体工作台</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="主导航">
          <button className={mode === "teacher" ? "active" : ""} onClick={() => setMode("teacher")}>
            教师看板
          </button>
          <button className={mode === "student" ? "active" : ""} onClick={() => setMode("student")}>
            学生报告
          </button>
          <button className={mode === "growth" ? "active" : ""} onClick={() => setMode("growth")}>
            成长路径
          </button>
          <button className={mode === "tasks" ? "active" : ""} onClick={() => setMode("tasks")}>
            任务复盘
          </button>
          <button
            className={mode === "academic" ? "active" : ""}
            onClick={() => setMode("academic")}
          >
            课程班级
          </button>
          <button className={mode === "kb" ? "active" : ""} onClick={() => setMode("kb")}>
            知识库管理
          </button>
          <button
            className={mode === "knowledge" ? "active" : ""}
            onClick={() => {
              setMode("knowledge");
              if (!chatResponse) {
                handleAskAgent();
              }
            }}
          >
            知识库问答
          </button>
        </nav>

        <div className="side-note">
          <span>当前样例</span>
          <strong>Flask Web 项目实践</strong>
          <p>系统分析作业代码与说明，教师直接查看学情诊断。</p>
        </div>

        {currentAccount && (
          <div className="account-panel">
            <label htmlFor="demo-account">演示账号</label>
            <select
              id="demo-account"
              value={currentAccount.user_id}
              onChange={(event) => handleAccountChange(event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.user_id} value={account.user_id}>
                  {account.name} · {account.title}
                </option>
              ))}
            </select>
            <div className="account-scope">
              <strong>{currentAccount.role.toUpperCase()}</strong>
              <span>{currentAccount.authorized_courses.join(" / ")}</span>
              <span>{currentAccount.authorized_classes.join(" / ")}</span>
            </div>
          </div>
        )}
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">智创Agent·计算机学科垂类大模型与双创能力赋能平台</p>
            <h1>
              {mode === "teacher"
                ? "课程作业学情诊断"
                : mode === "student"
                  ? "学生作业分析报告"
                  : mode === "growth"
                    ? "学生成长路径"
                    : mode === "tasks"
                      ? "任务中心与定期复盘"
                      : mode === "academic"
                        ? "课程班级与学生列表"
                        : mode === "kb"
                          ? "知识库资料管理"
                          : "学科知识库问答"}
            </h1>
          </div>
          <button
            className="primary-action"
            onClick={() =>
              mode === "knowledge"
                ? handleAskAgent()
                : mode === "kb"
                  ? handleKnowledgeSearch()
                  : window.location.reload()
            }
          >
            {mode === "knowledge" || mode === "kb"
              ? "重新检索"
              : mode === "academic"
                ? "刷新数据"
                : "重新分析"}
          </button>
        </header>

        {loading && <div className="state-box">正在生成演示报告...</div>}
        {error && <div className="state-box error">接口未连接：{error}</div>}

        {!loading && !error && mode === "teacher" && dashboard && (
          <TeacherDashboard dashboard={dashboard} />
        )}

        {!loading && !error && mode === "student" && report && (
          <StudentReport report={report} averageScore={averageScore} />
        )}

        {!loading && !error && mode === "knowledge" && (
          <KnowledgeAssistant
            question={chatQuestion}
            response={chatResponse}
            loading={chatLoading}
            onQuestionChange={setChatQuestion}
            onAsk={handleAskAgent}
          />
        )}

        {!loading && !error && mode === "growth" && profile && plan && competitions && team && (
          <GrowthPath
            profile={profile}
            plan={plan}
            competitions={competitions}
            team={team}
          />
        )}

        {!loading && !error && mode === "kb" && knowledgeDocs && (
          <KnowledgeAdmin
            documents={knowledgeDocs}
            search={knowledgeSearch}
            query={knowledgeQuery}
            loading={knowledgeLoading}
            onQueryChange={setKnowledgeQuery}
            onSearch={handleKnowledgeSearch}
          />
        )}

        {!loading && !error && mode === "tasks" && taskList && (
          <TaskCenter
            taskList={taskList}
            review={review}
            loading={taskLoading}
            onSaveTask={handleSaveTask}
            onGenerateReview={handleGenerateReview}
          />
        )}

        {!loading && !error && mode === "academic" && courses && classes && students && (
          <AcademicDirectory courses={courses} classes={classes} students={students} />
        )}
      </section>
    </main>
  );
}

function TeacherDashboard({ dashboard }: { dashboard: AssignmentDashboard }) {
  return (
    <>
      <section className="summary-strip">
        {dashboard.metrics.map((metric) => (
          <article className="metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.trend}</small>
          </article>
        ))}
      </section>
      <AiGeneratedNotice text="本页班级诊断和讲评建议为 AI 生成，仅供参考；需结合课程要求和作业提交物核验。" />

      <section className="panel-grid">
        <article className="panel wide">
          <div className="panel-header">
            <div>
              <span className="section-label">班级维度分布</span>
              <h2>{dashboard.class_name}</h2>
            </div>
            <strong className="score-pill">{dashboard.average_score}</strong>
          </div>
          <div className="score-list">
            {dashboard.dimension_averages.map((score) => (
              <ScoreBar key={score.dimension} label={score.dimension} score={score.score} />
            ))}
          </div>
        </article>

        <article className="panel">
          <span className="section-label">共性问题</span>
          <div className="finding-list">
            {dashboard.common_findings.map((finding) => (
              <div className="finding-item" key={finding.title}>
                <strong>{finding.title}</strong>
                <p>{finding.detail}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="section-label">学生报告</span>
            <h2>提交情况与个人分析</h2>
          </div>
          <span className="muted">
            {dashboard.submitted_count}/{dashboard.total_students} 已提交
          </span>
        </div>
        <div className="report-table">
          {dashboard.reports.map((report) => (
            <div className="report-row" key={report.report_id}>
              <strong>{report.student_name}</strong>
              <span>{report.status}</span>
              <ScoreBar label="综合" score={report.overall_score} compact />
              <p>{report.summary}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function StudentReport({
  report,
  averageScore,
}: {
  report: AssignmentReport;
  averageScore: number;
}) {
  return (
    <>
      <section className="report-hero">
        <div>
          <span className="section-label">{report.course_name}</span>
          <h2>
            {report.student_name} · {report.assignment_title}
          </h2>
          <p>{report.summary}</p>
        </div>
        <strong className="big-score">{averageScore}</strong>
      </section>
      <AiGeneratedNotice text="本页作业报告和评分为 AI 生成，仅供参考；分数是基于证据的相对画像，需结合提交物核验。" />

      <section className="panel-grid">
        <article className="panel wide">
          <span className="section-label">多维度评分</span>
          <div className="score-list">
            {report.scores.map((score) => (
              <div className="score-detail" key={score.dimension}>
                <ScoreBar label={score.dimension} score={score.score} />
                <p>{score.summary}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <span className="section-label">能力证据</span>
          <div className="evidence-list">
            {report.capability_evidence.map((item) => (
              <div key={item.dimension}>
                <strong>{item.dimension}</strong>
                <p>{item.evidence}</p>
                <small>{item.source}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <span className="section-label">主要问题</span>
          <div className="finding-list">
            {report.findings.map((finding) => (
              <div className={`finding-item ${finding.severity}`} key={finding.title}>
                <strong>{finding.title}</strong>
                <p>{finding.detail}</p>
                <small>{finding.suggestion}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <span className="section-label">下一步任务</span>
          <ol className="task-list">
            {report.improvement_tasks.map((task) => (
              <li key={task}>{task}</li>
            ))}
          </ol>
        </article>
      </section>
    </>
  );
}

function ScoreBar({
  label,
  score,
  compact = false,
}: {
  label: string;
  score: number;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "score-bar compact" : "score-bar"}>
      <div className="score-meta">
        <span>{label}</span>
        <strong>{score}</strong>
      </div>
      <div className="score-track">
        <span style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function AiGeneratedNotice({ text }: { text: string }) {
  return (
    <div className="ai-notice" role="note">
      <strong>AI 生成</strong>
      <span>{text}</span>
    </div>
  );
}

function KnowledgeAssistant({
  question,
  response,
  loading,
  onQuestionChange,
  onAsk,
}: {
  question: string;
  response: ChatResponse | null;
  loading: boolean;
  onQuestionChange: (question: string) => void;
  onAsk: (question?: string) => void;
}) {
  const examples = ["如何准备算法竞赛？", "教师怎么看本次代码作业共性问题？", "AI 应用开发首个 Demo 做什么？"];

  return (
    <>
      <section className="ask-panel">
        <div>
          <span className="section-label">RAG 知识库</span>
          <h2>围绕课程、作业、竞赛和项目案例给出可追溯回答</h2>
        </div>
        <div className="ask-box">
          <input
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onAsk();
              }
            }}
            aria-label="知识库问题"
          />
          <button onClick={() => onAsk()} disabled={loading || !question.trim()}>
            {loading ? "检索中" : "提问"}
          </button>
        </div>
        <div className="quick-questions">
          {examples.map((example) => (
            <button key={example} onClick={() => onAsk(example)}>
              {example}
            </button>
          ))}
        </div>
      </section>

      <section className="panel-grid">
        <article className="panel wide">
          <span className="section-label">回答</span>
          <div className="answer-box">
            {response ? (
              response.answer.split("\n").map((line) => <p key={line}>{line}</p>)
            ) : (
              <p>选择一个问题，系统会从首批知识库资料中检索并生成回答。</p>
            )}
          </div>
        </article>

        <article className="panel">
          <span className="section-label">引用来源</span>
          <div className="citation-list">
            {response?.citations.map((citation) => (
              <div className="citation-card" key={`${citation.title}-${citation.source_type}`}>
                <strong>{citation.title}</strong>
                <span>{citation.source_type}</span>
                <p>{citation.snippet}</p>
              </div>
            ))}
            {!response && <p className="muted">等待检索结果。</p>}
          </div>
        </article>
      </section>
      <AiGeneratedNotice text="回答为 AI 生成，仅供参考；事实性内容需结合引用来源和官方信息核验。" />
    </>
  );
}

function GrowthPath({
  profile,
  plan,
  competitions,
  team,
}: {
  profile: GrowthProfile;
  plan: LearningPlan;
  competitions: CompetitionRecommendResponse;
  team: TeamRecommendResponse;
}) {
  return (
    <>
      <section className="growth-hero">
        <div>
          <span className="section-label">能力画像</span>
          <h2>
            {profile.student_name} · {profile.target_path}
          </h2>
          <p>{plan.overview}</p>
        </div>
        <div className="growth-actions">
          {profile.next_actions.map((action) => (
            <span key={action}>{action}</span>
          ))}
        </div>
      </section>
      <AiGeneratedNotice text="成长路径、竞赛推荐和组队推荐为 AI 生成，仅供参考；需结合目标、时间和官方通知核验。" />

      <section className="panel-grid">
        <article className="panel wide">
          <span className="section-label">画像维度</span>
          <div className="score-list">
            {profile.dimensions.map((dimension) => (
              <div className="score-detail" key={dimension.dimension}>
                <ScoreBar label={dimension.dimension} score={dimension.score} />
                <p>{dimension.summary}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <span className="section-label">风险提醒</span>
          <div className="risk-list">
            {profile.risks.map((risk) => (
              <div key={risk}>{risk}</div>
            ))}
          </div>
          <span className="section-label block-label">优势</span>
          <div className="tag-list">
            {profile.strengths.map((strength) => (
              <span key={strength}>{strength}</span>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="section-label">学习计划</span>
            <h2>{plan.goal}</h2>
          </div>
          <span className="muted">{plan.weeks} 周</span>
        </div>
        <div className="timeline">
          {plan.tasks.map((task) => (
            <article className="timeline-item" key={`${task.week}-${task.title}`}>
              <strong>W{task.week}</strong>
              <div>
                <h3>{task.title}</h3>
                <p>{task.outcome}</p>
                <small>{task.resources.join(" / ")}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <span className="section-label">竞赛推荐</span>
          <div className="recommend-list">
            {competitions.recommendations.map((item) => (
              <div className="recommend-card" key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.category}</span>
                </div>
                <b>{item.match_score}</b>
                <p>{item.reason}</p>
                <small>{item.risk}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <span className="section-label">组队推荐</span>
          <div className="recommend-list">
            {team.candidates.map((candidate) => (
              <div className="recommend-card" key={candidate.student_id}>
                <div>
                  <strong>{candidate.name}</strong>
                  <span>{candidate.role}</span>
                </div>
                <b>{candidate.match_score}</b>
                <p>{candidate.complement}</p>
                <small>{candidate.evidence.join(" / ")}</small>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

function KnowledgeAdmin({
  documents,
  search,
  query,
  loading,
  onQueryChange,
  onSearch,
}: {
  documents: KnowledgeDocumentsResponse;
  search: KnowledgeSearchResponse | null;
  query: string;
  loading: boolean;
  onQueryChange: (query: string) => void;
  onSearch: (query?: string) => void;
}) {
  const paths = Array.from(new Set(documents.documents.map((document) => document.path)));

  return (
    <>
      <section className="kb-overview">
        <article className="metric">
          <span>资料总数</span>
          <strong>{documents.total}</strong>
          <small>首批知识库样例</small>
        </article>
        <article className="metric">
          <span>重点路径</span>
          <strong>{paths.length}</strong>
          <small>{paths.join(" / ")}</small>
        </article>
        <div className="ask-box kb-search">
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSearch();
              }
            }}
            aria-label="知识库检索"
          />
          <button onClick={() => onSearch()} disabled={loading || !query.trim()}>
            {loading ? "检索中" : "检索"}
          </button>
        </div>
      </section>

      <section className="panel-grid">
        <article className="panel wide">
          <div className="panel-header">
            <div>
              <span className="section-label">资料清单</span>
              <h2>首批知识库资料</h2>
            </div>
            <span className="muted">课程 / 竞赛 / 项目案例</span>
          </div>
          <div className="doc-table">
            {documents.documents.map((document) => (
              <div className="doc-row" key={document.document_id}>
                <strong>{document.title}</strong>
                <span>{document.path}</span>
                <span>{document.source_type}</span>
                <span>{document.status}</span>
                <small>{document.tags.join(" / ")}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <span className="section-label">检索命中</span>
          <div className="citation-list">
            {search?.results.map((result) => (
              <div className="citation-card" key={`${result.title}-${result.score}`}>
                <strong>{result.title}</strong>
                <span>
                  {result.path} · {result.score}
                </span>
                <p>{result.snippet}</p>
              </div>
            ))}
            {!search && <p className="muted">输入关键词检索知识库。</p>}
          </div>
        </article>
      </section>
    </>
  );
}

function TaskCenter({
  taskList,
  review,
  loading,
  onSaveTask,
  onGenerateReview,
}: {
  taskList: TaskListResponse;
  review: ReviewResponse | null;
  loading: boolean;
  onSaveTask: () => void;
  onGenerateReview: () => void;
}) {
  const completion = Math.round((taskList.completed / taskList.total) * 100);

  return (
    <>
      <section className="task-hero">
        <div>
          <span className="section-label">任务中心</span>
          <h2>把计划、报告建议和竞赛准备落到可执行任务</h2>
          <p>当前完成 {taskList.completed} / {taskList.total}，系统会根据任务证据生成阶段复盘。</p>
        </div>
        <div className="task-actions">
          <button onClick={onSaveTask} disabled={loading}>保存推荐任务</button>
          <button onClick={onGenerateReview} disabled={loading}>生成本周复盘</button>
        </div>
      </section>
      <AiGeneratedNotice text="复盘与任务建议为 AI 生成，仅供参考；需结合个人计划和课程安排调整。" />

      <section className="panel-grid">
        <article className="panel wide">
          <div className="panel-header">
            <div>
              <span className="section-label">任务进度</span>
              <h2>本周学习与项目任务</h2>
            </div>
            <strong className="score-pill">{completion}</strong>
          </div>
          <div className="task-board">
            {taskList.tasks.map((task) => (
              <TaskCard key={task.task_id} task={task} />
            ))}
          </div>
        </article>

        <article className="panel">
          <span className="section-label">复盘结果</span>
          {review ? (
            <div className="review-box">
              <strong>{review.period}</strong>
              <p>{review.summary}</p>
              <small>{review.risk}</small>
              <div className="review-next">
                {review.next_tasks.map((task) => (
                  <span key={task.task_id}>{task.title}</span>
                ))}
              </div>
            </div>
          ) : (
            <p className="muted">点击“生成本周复盘”，系统会汇总已完成任务、风险和下一步任务。</p>
          )}
        </article>
      </section>
    </>
  );
}

function TaskCard({ task }: { task: LearningTask }) {
  return (
    <article className={`task-card ${task.status}`}>
      <div>
        <strong>{task.title}</strong>
        <span>{task.source} · {task.priority}</span>
      </div>
      <b>{task.progress}%</b>
      <p>{task.evidence_required}</p>
      <small>{task.due_date}</small>
    </article>
  );
}

function AcademicDirectory({
  courses,
  classes,
  students,
}: {
  courses: CourseListResponse;
  classes: ClassListResponse;
  students: StudentListResponse;
}) {
  return (
    <>
      <section className="academic-hero">
        <div>
          <span className="section-label">课程与班级</span>
          <h2>学校真实使用的基础数据入口</h2>
          <p>课程、班级和学生列表共同构成教师看板、作业报告和学生画像的授权边界。</p>
        </div>
        <div className="academic-metrics">
          <article className="metric">
            <span>课程</span>
            <strong>{courses.courses.length}</strong>
            <small>演示课程</small>
          </article>
          <article className="metric">
            <span>学生</span>
            <strong>{students.students.length}</strong>
            <small>演示学生</small>
          </article>
        </div>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <span className="section-label">课程</span>
          <div className="academic-list">
            {courses.courses.map((course) => (
              <div className="academic-card" key={course.course_id}>
                <strong>{course.name}</strong>
                <span>{course.term} · {course.teacher_name}</span>
                <p>{course.description}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <span className="section-label">班级</span>
          <div className="academic-list">
            {classes.classes.map((classItem) => (
              <div className="academic-card" key={`${classItem.course_id}-${classItem.class_id}`}>
                <strong>{classItem.name}</strong>
                <span>{classItem.major} · {classItem.grade}</span>
                <p>{classItem.student_count} 名学生</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="section-label">学生列表</span>
            <h2>能力方向与标签</h2>
          </div>
          <span className="muted">{students.class_id}</span>
        </div>
        <div className="student-grid">
          {students.students.map((student) => (
            <article className="student-card" key={student.student_id}>
              <strong>{student.name}</strong>
              <span>{student.student_no}</span>
              <p>{student.target_path}</p>
              <div>
                {student.tags.map((tag) => (
                  <small key={tag}>{tag}</small>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

import { useEffect, useMemo, useState } from "react";

import { askAgent } from "../shared/api/agent";
import { fetchClasses, fetchCourses, fetchStudents, importAcademicData } from "../shared/api/academic";
import {
  analyzeRepositoryAssignment,
  createAssignment,
  exportAssignmentDashboard,
  exportAssignmentReport,
  fetchAssignmentDashboard,
  fetchAssignmentDashboardById,
  fetchAssignmentReport,
  fetchAssignments,
  uploadAssignmentArchive,
} from "../shared/api/assignments";
import {
  createSchoolAccountSession,
  createLocalSession,
  createSchoolIdentitySession,
  fetchSchoolAccounts,
  fetchLocalAccounts,
} from "../shared/api/auth";
import {
  createTeamRequest,
  fetchCompetitionCatalog,
  fetchTeamPoolStatus,
  fetchGrowthProfile,
  fetchLearningPlans,
  generateCompetitionPreparationPlan,
  generateLearningPlan,
  recommendCompetitions,
  recommendTeam,
  reviseLearningPlan,
  screenTeacherCandidates,
  updateTeamPoolStatus,
  upsertBasicProfile,
} from "../shared/api/growth";
import {
  createEvaluationCase,
  createEvaluationRecord,
  exportEvaluationReport,
  fetchEvaluationDashboard,
} from "../shared/api/evaluations";
import {
  createKnowledgeDocument,
  fetchKnowledgeDocumentVersions,
  fetchKnowledgeDocuments,
  offlineKnowledgeDocument,
  searchKnowledge,
  updateKnowledgeDocument,
} from "../shared/api/knowledge";
import { fetchStudentTasks, generateReview, saveTask, updateLearningTask } from "../shared/api/tasks";
import { OpenCourseStudio } from "./OpenCourseStudio";
import type { ChatMessage, ChatResponse } from "../shared/types/agent";
import type {
  AcademicImportRequest,
  ClassListResponse,
  CourseListResponse,
  StudentListResponse,
} from "../shared/types/academic";
import type {
  AssignmentCreatePayload,
  AssignmentDashboard,
  AssignmentItem,
  AssignmentReport,
} from "../shared/types/assignments";
import type { SchoolAccount } from "../shared/types/auth";
import type {
  EvaluationCaseCreate,
  EvaluationDashboardResponse,
  EvaluationRecordCreate,
} from "../shared/types/evaluations";
import type {
  BasicProfilePayload,
  CompetitionCatalogResponse,
  CompetitionPreparationPlan,
  CompetitionRecommendResponse,
  GrowthProfile,
  LearningPlan,
  ProfileEvidence,
  TeacherCandidateScreenResponse,
  TeamPoolStatus,
  TeamRecommendResponse,
  TeamRequestCard,
} from "../shared/types/growth";
import type {
  KnowledgeDocument,
  KnowledgeDocumentCreate,
  KnowledgeDocumentUpdate,
  KnowledgeDocumentVersionsResponse,
  KnowledgeDocumentsResponse,
  KnowledgeSearchResponse,
} from "../shared/types/knowledge";
import type { ViewMode } from "../shared/types/navigation";
import type {
  LearningTask,
  ReviewGeneratePayload,
  ReviewResponse,
  SaveTaskPayload,
  TaskListResponse,
} from "../shared/types/tasks";

type AssignmentSubmissionPayload = {
  assignmentId?: string;
  assignmentTitle: string;
  courseId?: string;
  classId?: string;
  studentId: string;
  description: string;
  projectType: string;
  projectContext: string;
  authors: string;
  teamRoles: string;
  archive?: File;
  repositoryUrl?: string;
};

type ProjectSourceOption = {
  value: string;
  title: string;
  detail: string;
};

type ProjectUploadDraft = {
  sourceMode: "zip" | "repo";
  assignmentTitle: string;
  projectType: string;
  projectContext: string;
  authors: string;
  teamRoles: string;
  targetStudentId: string;
  description: string;
  repositoryUrl: string;
  archiveName: string;
  updatedAt: string;
};

type ProjectSection = "assets" | "submit" | "report" | "evidence" | "tasks";
type ProjectStatusFilter = "all" | "analyzed" | "pending";
type ProjectSourceFilter = "all" | "course" | "competition" | "personal" | "venture";
type GrowthSection = "profile" | "plan" | "competition" | "team" | "execution";
type TeacherReportScoreFilter = "all" | "high" | "medium" | "risk";
type TeacherReportSort = "score_asc" | "score_desc" | "name";

type AppNotice = {
  id: number;
  tone: "success" | "error" | "info";
  title: string;
  text?: string;
};

type ConfirmDialogState = {
  title: string;
  text: string;
  confirmLabel: string;
  tone?: "danger" | "default";
  onConfirm: () => void | Promise<void>;
};

type StoredSession = {
  account: SchoolAccount;
  token: string;
  mode: ViewMode;
  savedAt: string;
  expiresAt: string;
};

type AccountSession = {
  account: SchoolAccount;
  token: string;
  expires_in?: number;
};

type LoginView = "school" | "account";

const defaultStudentId = "student_001";
const sessionStorageKey = "zhichuang-agent-session";
const projectUploadDraftPrefix = "zhichuang-project-upload-draft";
const schoolIdentitySecret =
  import.meta.env.VITE_SCHOOL_IDENTITY_SECRET ?? "change-me-school-identity-secret";
const fallbackStudentAccount: SchoolAccount = {
  user_id: defaultStudentId,
  name: "林一舟",
  role: "student",
  title: "学生",
  default_view: "student",
  authorized_courses: ["Web 应用开发", "算法设计与分析"],
  authorized_classes: ["2024 级计算机科学与技术 1 班"],
  modules: ["成长规划", "项目管理", "知识库问答"],
};

function roleLabel(role: string) {
  if (role === "student") return "学生";
  if (role === "teacher") return "教师";
  if (role === "admin") return "管理员";
  return role;
}

function accountSubtitle(account: SchoolAccount) {
  if (account.role === "student") {
    return account.authorized_classes[0] ?? "学生";
  }
  if (account.role === "teacher") {
    return account.authorized_courses[0] ?? "授课教师";
  }
  if (account.role === "admin") {
    return "平台管理";
  }
  return account.title.replace(/试用账号|账号/g, "").trim() || "用户";
}

function readableScopeValue(values: string[], fallback: string) {
  return values.find((value) => !value.includes("_")) ?? values[0] ?? fallback;
}

function scopeIdValue(values: string[], fallback?: string) {
  return values.find((value) => value.includes("_")) ?? fallback;
}

function evidenceLabels(items: ProfileEvidence[]) {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const label = item.source_title || item.source_type;
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
    if (labels.length >= 3) break;
  }
  return labels;
}

function reportStudentIdForAccount(account: SchoolAccount | null) {
  return account?.role === "student" ? account.user_id : defaultStudentId;
}

function titleForMode(mode: ViewMode) {
  if (mode === "teacher") return "项目学情诊断";
  if (mode === "student") return "项目管理";
  if (mode === "open-course") return "开源课堂";
  if (mode === "growth") return "成长规划";
  if (mode === "evaluations") return "测试评测与输出记录";
  if (mode === "academic") return "课程班级与学生列表";
  if (mode === "profile") return "个人中心";
  if (mode === "kb") return "知识库资料管理";
  return "学科知识库问答";
}

function descriptionForMode(mode: ViewMode) {
  if (mode === "teacher") return "查看班级项目报告、能力分布和教学建议。";
  if (mode === "student") return "管理项目资产，上传代码或仓库并生成分析报告。";
  if (mode === "open-course") return "进入课程目录，按课程、章节和课节打开交互课堂。";
  if (mode === "growth") return "按模块查看画像、计划、竞赛、组队和执行事项。";
  if (mode === "evaluations") return "记录系统输出质量和评测结果。";
  if (mode === "academic") return "维护课程、班级和学生基础数据。";
  if (mode === "profile") return "维护账号、学习目标和基础画像信息。";
  if (mode === "kb") return "维护课程、竞赛和项目案例资料。";
  return "围绕课程、项目、竞赛和案例进行可追溯问答。";
}

function stepsForMode(mode: ViewMode) {
  if (mode === "teacher") return ["项目报告", "班级画像", "学情诊断", "教学建议"];
  if (mode === "open-course") return ["课程选择", "章节小节", "实验任务", "课堂讲评"];
  if (mode === "growth") return ["能力画像", "学习计划", "竞赛组队", "计划执行"];
  if (mode === "knowledge" || mode === "kb") return ["资料入库", "语义检索", "引用追踪", "版本维护"];
  if (mode === "academic") return ["课程数据", "班级数据", "学生名单", "账号授权"];
  if (mode === "profile") return ["账号信息", "基础画像", "学习目标", "项目经历"];
  if (mode === "evaluations") return ["测试案例", "输出记录", "人工评分", "质量报告"];
  return ["项目资产", "智能分析", "能力证据", "计划执行"];
}

function joinProfileItems(items: string[] | undefined) {
  return (items ?? []).join("、");
}

function splitProfileItems(value: string) {
  return value
    .split(/[、,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function nextDateString(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function profileCompletion(profile: GrowthProfile) {
  const summary = profile.profile_summary;
  const checks = [
    Boolean(profile.student_name.trim()),
    Boolean(summary?.grade?.trim()),
    Boolean(summary?.major?.trim()),
    Boolean(summary?.target_direction?.trim() || profile.target_path.trim()),
    Boolean(summary?.weekly_hours && summary.weekly_hours > 0),
    Boolean(summary?.course_foundation?.length),
    Boolean(summary?.skill_tags?.length),
    Boolean(summary?.project_experiences?.length),
    Boolean(summary?.competition_experiences?.length),
    Boolean(summary?.github_url),
  ];
  const completed = checks.filter(Boolean).length;
  return {
    completed,
    total: checks.length,
    percent: Math.round((completed / checks.length) * 100),
  };
}

function profileReadinessItems(profile: GrowthProfile) {
  const summary = profile.profile_summary;
  return [
    {
      label: "身份信息",
      done: Boolean(profile.student_name.trim() && summary?.grade?.trim() && summary?.major?.trim()),
      text: summary?.grade && summary?.major ? `${summary.grade} · ${summary.major}` : "补全年级和专业",
    },
    {
      label: "目标方向",
      done: Boolean(summary?.target_direction?.trim() || profile.target_path.trim()),
      text: summary?.target_direction ?? profile.target_path ?? "填写目标方向",
    },
    {
      label: "每周投入",
      done: Boolean(summary?.weekly_hours && summary.weekly_hours > 0),
      text: summary?.weekly_hours ? `${summary.weekly_hours} 小时/周` : "填写可投入时间",
    },
    {
      label: "课程基础",
      done: Boolean(summary?.course_foundation?.length),
      text: summary?.course_foundation?.join(" / ") || "补充已掌握课程",
    },
    {
      label: "技能标签",
      done: Boolean(summary?.skill_tags?.length),
      text: summary?.skill_tags?.slice(0, 4).join(" / ") || "补充技能标签",
    },
    {
      label: "项目经历",
      done: Boolean(summary?.project_experiences?.length),
      text: summary?.project_experiences?.slice(0, 3).join(" / ") || "补充项目经历",
    },
    {
      label: "竞赛经历",
      done: Boolean(summary?.competition_experiences?.length),
      text: summary?.competition_experiences?.slice(0, 3).join(" / ") || "可选填竞赛经历",
    },
    {
      label: "代码仓库",
      done: Boolean(summary?.github_url),
      text: summary?.github_url || "补充 GitHub/Gitee 等链接",
    },
  ];
}

function sessionLabel(token: string) {
  if (token.startsWith("school-token-")) return "统一身份";
  if (token.startsWith("local-token-")) return "学校账号";
  return "学校账号";
}

function downloadMarkdownFile(markdown: string, contentType: string, filename: string) {
  const blob = new Blob([markdown], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(sessionStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed.token || !parsed.account?.user_id) return null;
    const savedAt = parsed.savedAt ?? new Date().toISOString();
    const expiresAt =
      parsed.expiresAt ??
      new Date(new Date(savedAt).getTime() + 8 * 60 * 60 * 1000).toISOString();
    return {
      account: parsed.account,
      token: parsed.token,
      mode: parsed.mode ?? parsed.account.default_view ?? "student",
      savedAt,
      expiresAt,
    };
  } catch {
    return null;
  }
}

function writeStoredSession(
  account: SchoolAccount,
  token: string,
  mode: ViewMode,
  expiresInSeconds = 8 * 60 * 60,
) {
  const savedAt = new Date();
  const session: StoredSession = {
    account,
    token,
    mode,
    savedAt: savedAt.toISOString(),
    expiresAt: new Date(savedAt.getTime() + expiresInSeconds * 1000).toISOString(),
  };
  window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
}

function clearStoredSession() {
  window.localStorage.removeItem(sessionStorageKey);
}

function projectUploadDraftKey(
  variant: "student" | "teacher",
  studentId: string | undefined,
  assignmentId: string | undefined,
  assignmentTitle: string,
) {
  const projectRef = assignmentId || assignmentTitle || "new-project";
  return [projectUploadDraftPrefix, variant, studentId || "unknown", projectRef].join(":");
}

function readProjectUploadDraft(key: string): ProjectUploadDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ProjectUploadDraft>;
    if (!value || (value.sourceMode !== "zip" && value.sourceMode !== "repo")) return null;
    return {
      sourceMode: value.sourceMode,
      assignmentTitle: value.assignmentTitle ?? "",
      projectType: value.projectType ?? "",
      projectContext: value.projectContext ?? "",
      authors: value.authors ?? "",
      teamRoles: value.teamRoles ?? "",
      targetStudentId: value.targetStudentId ?? "",
      description: value.description ?? "",
      repositoryUrl: value.repositoryUrl ?? "",
      archiveName: value.archiveName ?? "",
      updatedAt: value.updatedAt ?? "",
    };
  } catch {
    return null;
  }
}

function writeProjectUploadDraft(key: string, draft: ProjectUploadDraft) {
  const sanitizedDraft: ProjectUploadDraft = {
    ...draft,
    targetStudentId: "",
  };
  window.localStorage.setItem(key, JSON.stringify(sanitizedDraft));
}

function removeProjectUploadDraft(key: string) {
  window.localStorage.removeItem(key);
}

function initialProjectTypeForContext(assignment: UploadAssignmentContext) {
  if (!assignment.assignment_id || assignment.title === "新的项目") return "个人作品";
  if (assignment.course_name && !["个人项目", "个人空间", "项目空间"].includes(assignment.course_name)) {
    return "课程项目";
  }
  return "个人作品";
}

function initialProjectContextForContext(assignment: UploadAssignmentContext) {
  if (!assignment.assignment_id || assignment.title === "新的项目") return "个人项目";
  return assignment.course_name || "个人项目";
}

function formatSessionExpiry(expiresAt: string | null) {
  if (!expiresAt) return "未记录";
  const time = new Date(expiresAt).getTime();
  if (Number.isNaN(time)) return "未记录";
  const remainingMs = time - Date.now();
  if (remainingMs <= 0) return "已过期";
  const remainingMinutes = Math.max(1, Math.round(remainingMs / 60000));
  if (remainingMinutes >= 60) {
    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;
    return minutes ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
  }
  return `${remainingMinutes} 分钟`;
}

export function Dashboard() {
  const [mode, setMode] = useState<ViewMode>("student");
  const [report, setReport] = useState<AssignmentReport | null>(null);
  const [teacherSelectedReport, setTeacherSelectedReport] = useState<AssignmentReport | null>(null);
  const [dashboard, setDashboard] = useState<AssignmentDashboard | null>(null);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [assignmentCreateLoading, setAssignmentCreateLoading] = useState(false);
  const [assignmentExportLoading, setAssignmentExportLoading] = useState(false);
  const [assignmentExportResult, setAssignmentExportResult] = useState<string | null>(null);
  const [reportExportLoading, setReportExportLoading] = useState(false);
  const [reportExportResult, setReportExportResult] = useState<string | null>(null);
  const [studentReportLoading, setStudentReportLoading] = useState(false);
  const [teacherReportLoading, setTeacherReportLoading] = useState(false);
  const [archiveUploadLoading, setArchiveUploadLoading] = useState(false);
  const [archiveUploadResult, setArchiveUploadResult] = useState<string | null>(null);
  const [profile, setProfile] = useState<GrowthProfile | null>(null);
  const [profileEvidence, setProfileEvidence] = useState<ProfileEvidence | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [planRevisionLoading, setPlanRevisionLoading] = useState(false);
  const [competitions, setCompetitions] = useState<CompetitionRecommendResponse | null>(null);
  const [competitionPreparation, setCompetitionPreparation] =
    useState<CompetitionPreparationPlan | null>(null);
  const [competitionCatalog, setCompetitionCatalog] =
    useState<CompetitionCatalogResponse | null>(null);
  const [team, setTeam] = useState<TeamRecommendResponse | null>(null);
  const [candidateScreening, setCandidateScreening] =
    useState<TeacherCandidateScreenResponse | null>(null);
  const [teamRequest, setTeamRequest] = useState<TeamRequestCard | null>(null);
  const [teamStatus, setTeamStatus] = useState<TeamPoolStatus | null>(null);
  const [teamStatusLoading, setTeamStatusLoading] = useState(false);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocumentsResponse | null>(null);
  const [knowledgeSearch, setKnowledgeSearch] = useState<KnowledgeSearchResponse | null>(null);
  const [knowledgeVersions, setKnowledgeVersions] =
    useState<KnowledgeDocumentVersionsResponse | null>(null);
  const [knowledgeQuery, setKnowledgeQuery] = useState("项目 Rubric");
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeCreateLoading, setKnowledgeCreateLoading] = useState(false);
  const [accounts, setAccounts] = useState<SchoolAccount[]>([]);
  const [localAccounts, setLocalAccounts] = useState<SchoolAccount[]>([]);
  const [currentAccount, setCurrentAccount] = useState<SchoolAccount | null>(null);
  const [currentToken, setCurrentToken] = useState("");
  const [schoolIdentity, setSchoolIdentity] = useState("");
  const [schoolLoginLoading, setSchoolLoginLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(defaultStudentId);
  const [accountLoginLoading, setAccountLoginLoading] = useState(false);
  const [loginView, setLoginView] = useState<LoginView>("school");
  const [taskList, setTaskList] = useState<TaskListResponse | null>(null);
  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskStatusUpdatingId, setTaskStatusUpdatingId] = useState<string | null>(null);
  const [growthInitialSection, setGrowthInitialSection] = useState<GrowthSection>("profile");
  const [taskSaveResult, setTaskSaveResult] = useState<string | null>(null);
  const [evaluationDashboard, setEvaluationDashboard] =
    useState<EvaluationDashboardResponse | null>(null);
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [evaluationExportLoading, setEvaluationExportLoading] = useState(false);
  const [evaluationExportResult, setEvaluationExportResult] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseListResponse | null>(null);
  const [classes, setClasses] = useState<ClassListResponse | null>(null);
  const [students, setStudents] = useState<StudentListResponse | null>(null);
  const [academicImportLoading, setAcademicImportLoading] = useState(false);
  const [academicImportResult, setAcademicImportResult] = useState<string | null>(null);
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatResponse, setChatResponse] = useState<ChatResponse | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<AppNotice[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const activeStudentId =
    currentAccount?.role === "student" ? currentAccount.user_id : defaultStudentId;

  function pushNotice(tone: AppNotice["tone"], title: string, text?: string) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setNotices((current) => [...current.slice(-2), { id, tone, title, text }]);
    window.setTimeout(() => {
      setNotices((current) => current.filter((notice) => notice.id !== id));
    }, tone === "error" ? 6500 : 4300);
  }

  function dismissNotice(id: number) {
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }

  async function runConfirmedAction() {
    if (!confirmDialog) return;
    try {
      setConfirmLoading(true);
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作确认失败");
    } finally {
      setConfirmLoading(false);
    }
  }

  useEffect(() => {
    if (error) {
      pushNotice("error", "操作未完成", error);
    }
  }, [error]);

  useEffect(() => {
    if (currentAccount && currentToken) {
      const expiresAt =
        sessionExpiresAt ?? new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      const remainingSeconds = Math.max(
        60,
        Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000),
      );
      writeStoredSession(currentAccount, currentToken, mode, remainingSeconds);
    }
  }, [currentAccount, currentToken, mode, sessionExpiresAt]);

  useEffect(() => {
    if (!sessionExpiresAt || !currentAccount || !currentToken) return undefined;
    const delay = new Date(sessionExpiresAt).getTime() - Date.now();
    if (delay <= 0) {
      clearStoredSession();
      setCurrentAccount(null);
      setCurrentToken("");
      setSessionExpiresAt(null);
      setSessionRestored(false);
      pushNotice("info", "登录状态已过期", "请重新登录后继续使用");
      setSessionMessage("登录状态已过期，请重新登录后继续使用。");
      return undefined;
    }
    const timer = window.setTimeout(() => {
      clearStoredSession();
      setCurrentAccount(null);
      setCurrentToken("");
      setSessionExpiresAt(null);
      setSessionRestored(false);
      pushNotice("info", "登录状态已过期", "请重新登录后继续使用");
      setSessionMessage("登录状态已过期，请重新登录后继续使用。");
    }, delay);
    return () => window.clearTimeout(timer);
  }, [sessionExpiresAt, currentAccount, currentToken]);

  async function loadStudentWorkspace(account: SchoolAccount, token?: string) {
    const studentId = account.user_id;
    const [
      profileData,
      plansData,
      competitionCatalogData,
      teamStatusData,
      taskData,
    ] = await Promise.all([
      fetchGrowthProfile(studentId, token),
      fetchLearningPlans(studentId, token),
      fetchCompetitionCatalog(),
      fetchTeamPoolStatus(studentId, token),
      fetchStudentTasks(studentId, token),
    ]);
    setProfile(profileData);
    setProfileEvidence(null);
    setPlan(plansData.plans[0] ?? null);
    setCompetitionCatalog(competitionCatalogData);
    setCompetitions(null);
    setCompetitionPreparation(null);
    setTeam(null);
    setTeamRequest(null);
    setTeamStatus(teamStatusData);
    setTaskList(taskData);
  }

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const [
          knowledgeData,
          searchData,
          accountsData,
          evaluationData,
          coursesData,
          classesData,
          studentsData,
        ] = await Promise.all([
          fetchKnowledgeDocuments(),
          searchKnowledge("项目 Rubric"),
          fetchSchoolAccounts(),
          fetchEvaluationDashboard(),
          fetchCourses(),
          fetchClasses(),
          fetchStudents(),
        ]);

        const storedSession = readStoredSession();
        if (mounted) {
          setKnowledgeDocs(knowledgeData);
          setKnowledgeSearch(searchData);
          setAccounts(accountsData.accounts);
          setSelectedAccountId(
            accountsData.accounts.find((account) => account.role === "student")?.user_id ??
              defaultStudentId,
          );
          setLocalAccounts([]);
          setEvaluationDashboard(evaluationData);
          setCourses(coursesData);
          setClasses(classesData);
          setStudents(studentsData);
        }
        if (mounted && storedSession) {
          if (new Date(storedSession.expiresAt).getTime() <= Date.now()) {
            clearStoredSession();
            setSessionMessage("登录状态已过期，请重新登录后继续使用。");
            pushNotice("info", "登录状态已过期", "请重新登录后继续使用");
            return;
          }
          setSessionLoading(true);
          await applyAccountSession({
            account: storedSession.account,
            token: storedSession.token,
          });
          setMode(storedSession.mode);
          setSessionExpiresAt(storedSession.expiresAt);
          setSessionRestored(true);
          pushNotice("info", "已恢复上次会话", `${storedSession.account.name} · ${sessionLabel(storedSession.token)}`);
        }
      } catch (err) {
        if (mounted) {
          clearStoredSession();
          setError(err instanceof Error ? err.message : "加载失败");
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setSessionLoading(false);
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

  const growthPayload =
    !loading &&
    mode === "growth" &&
    profile &&
    competitionCatalog &&
    teamStatus
      ? {
          profile,
          profileEvidence,
          plan,
          competitionCatalog,
          competitions,
          competitionPreparation,
          team,
          teamRequest,
          teamStatus,
          taskList,
          review,
          initialSection: growthInitialSection,
          planRevisionLoading,
          teamStatusLoading,
          taskLoading,
          taskStatusUpdatingId,
          taskSaveResult,
          planCreateLoading: planRevisionLoading,
          onRevisePlan: handleRevisePlan,
          onOpenProfile: () => setMode("profile"),
          onGeneratePlan: handleGeneratePlan,
          onGenerateCompetition: handleGenerateCompetition,
          onGenerateTeam: handleGenerateTeam,
          onUpdateTeamStatus: handleUpdateTeamStatus,
          onSaveTask: handleSaveTask,
          onUpdateTaskStatus: handleUpdateTaskStatus,
          onGenerateReview: handleGenerateReview,
        }
      : null;

  async function handleAskAgent(question = chatQuestion) {
    try {
      setChatLoading(true);
      setError(null);
      setChatQuestion(question);
      const response = await askAgent(question, "student", chatHistory);
      setChatResponse(response);
      setChatHistory((current) => [
        ...current,
        { role: "user", content: question },
        { role: "assistant", content: response.answer },
      ]);
      setMode("knowledge");
      pushNotice("success", "知识库回答已生成", response.context_summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "知识库问答加载失败");
    } finally {
      setChatLoading(false);
    }
  }

  function handleClearKnowledgeSession() {
    setChatQuestion("");
    setChatResponse(null);
    setChatHistory([]);
    pushNotice("info", "问答会话已清空", "可以围绕新的课程、项目或竞赛问题重新开始");
  }

  async function handleRefreshCurrentView() {
    try {
      setError(null);
      if (mode === "knowledge") {
        if (chatQuestion.trim()) {
          await handleAskAgent();
        }
        return;
      }
      if (mode === "open-course") {
        pushNotice("info", "开源课堂已就绪", "可切换课程方向、课堂模式和动画步骤");
        return;
      }
      if (mode === "kb") {
        await handleKnowledgeSearch();
        return;
      }
      if (mode === "student" && report) {
        setStudentReportLoading(true);
        const [nextReport, nextAssignments] = await Promise.all([
          fetchAssignmentReport(report.assignment_id, activeStudentId, currentToken),
          fetchAssignments(currentToken),
        ]);
        setReport(nextReport);
        setAssignments(nextAssignments.assignments);
        return;
      }
      if (mode === "teacher" && dashboard) {
        const [nextDashboard, nextAssignments, nextCandidateScreening] = await Promise.all([
          fetchAssignmentDashboardById(dashboard.assignment_id, currentToken),
          fetchAssignments(currentToken),
          currentAccount?.role === "student"
            ? Promise.resolve(null)
            : screenTeacherCandidates(currentToken),
        ]);
        setDashboard(nextDashboard);
        setAssignments(nextAssignments.assignments);
        setCandidateScreening(nextCandidateScreening);
        setTeacherSelectedReport(null);
        return;
      }
      if (mode === "growth" && currentAccount?.role === "student") {
        await loadStudentWorkspace(currentAccount, currentToken);
        return;
      }
      if (mode === "profile" && profile) {
        const nextProfile = await fetchGrowthProfile(activeStudentId, currentToken);
        setProfile(nextProfile);
        return;
      }
      if (mode === "evaluations") {
        setEvaluationLoading(true);
        setEvaluationDashboard(await fetchEvaluationDashboard());
        return;
      }
      if (mode === "academic") {
        const [nextCourses, nextClasses, nextStudents] = await Promise.all([
          fetchCourses(),
          fetchClasses(),
          fetchStudents(),
        ]);
        setCourses(nextCourses);
        setClasses(nextClasses);
        setStudents(nextStudents);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "刷新失败");
    } finally {
      setStudentReportLoading(false);
      setEvaluationLoading(false);
    }
  }

  async function applyAccountSession(session: AccountSession) {
    setCurrentAccount(session.account);
    setCurrentToken(session.token);
    const nextAssignments = await fetchAssignments(session.token);
    setAssignments(nextAssignments.assignments);
    let nextReport: AssignmentReport | null = null;
    if (session.account.role === "student") {
      for (const assignment of nextAssignments.assignments) {
        try {
          nextReport = await fetchAssignmentReport(
            assignment.assignment_id,
            session.account.user_id,
            session.token,
          );
          break;
        } catch {
          // Keep looking; imported students may have project shells without reports yet.
        }
      }
    } else {
      try {
        nextReport = await fetchAssignmentReport(
          "assignment_flask_mvp",
          reportStudentIdForAccount(session.account),
          session.token,
        );
      } catch {
        nextReport = null;
      }
    }
    setReport(nextReport);
    if (session.account.role === "teacher" || session.account.role === "admin") {
      const nextDashboard = await fetchAssignmentDashboard(session.token);
      const nextCandidateScreening = await screenTeacherCandidates(session.token);
      setDashboard(nextDashboard);
      setCandidateScreening(nextCandidateScreening);
      setTeacherSelectedReport(null);
    } else {
      setCandidateScreening(null);
    }
    if (session.account.role === "student") {
      await loadStudentWorkspace(session.account, session.token);
    }
    if (session.account.role !== "student") {
      const profileData = await fetchGrowthProfile(defaultStudentId, session.token);
      setProfile(profileData);
      setProfileEvidence(null);
    }
    if (session.account.role === "admin") {
      const nextLocalAccounts = await fetchLocalAccounts(session.token);
      setLocalAccounts(nextLocalAccounts.accounts);
    }
    setMode(session.account.default_view);
  }

  async function loginWithSession(session: AccountSession) {
    try {
      setSessionLoading(true);
      setError(null);
      setSessionRestored(false);
      setSessionMessage(null);
      const expiresAt = new Date(
        Date.now() + (session.expires_in ?? 8 * 60 * 60) * 1000,
      ).toISOString();
      setSessionExpiresAt(expiresAt);
      await applyAccountSession(session);
      pushNotice("success", "已进入系统", `${session.account.name} · ${roleLabel(session.account.role)}`);
    } finally {
      setSessionLoading(false);
    }
  }

  async function handleAccountChange(userId: string) {
    try {
      setAccountLoginLoading(true);
      setError(null);
      setSessionMessage(null);
      const session = await createSchoolAccountSession(userId);
      await loginWithSession(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "身份切换失败");
    } finally {
      setAccountLoginLoading(false);
    }
  }

  async function handleLocalAccountChange(userId: string) {
    try {
      setAccountLoginLoading(true);
      setError(null);
      setSessionMessage(null);
      const session = await createLocalSession(userId);
      await loginWithSession(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "学校账号进入失败");
    } finally {
      setAccountLoginLoading(false);
    }
  }

  async function handleSchoolIdentityLogin() {
    const identity = schoolIdentity.trim();
    if (!identity) return;
    try {
      setSchoolLoginLoading(true);
      setError(null);
      setSessionMessage(null);
      const session = await createSchoolIdentitySession(
        {
          user_id: identity,
          student_no: identity,
          teacher_no: identity,
          email: identity.includes("@") ? identity : undefined,
        },
        schoolIdentitySecret,
      );
      await loginWithSession(session);
      setSchoolIdentity("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "统一身份登录失败，请确认账号已导入。");
    } finally {
      setSchoolLoginLoading(false);
    }
  }

  function performLogout() {
    const name = currentAccount?.name;
    setCurrentAccount(null);
    setCurrentToken("");
    setLocalAccounts([]);
    setMode("student");
    setReport(null);
    setAssignments([]);
    setProfile(null);
    setProfileEvidence(null);
    setPlan(null);
    setCompetitions(null);
    setCompetitionPreparation(null);
    setTeam(null);
    setCandidateScreening(null);
    setTeamRequest(null);
    setTeamStatus(null);
    setTaskList(null);
    setReview(null);
    setGrowthInitialSection("profile");
    setTaskSaveResult(null);
    setError(null);
    clearStoredSession();
    setSessionRestored(false);
    setSessionExpiresAt(null);
    setSessionMessage(null);
    setConfirmDialog(null);
    if (name) {
      pushNotice("info", "已退出登录", name);
    }
  }

  function handleLogout() {
    setConfirmDialog({
      title: "退出当前账号",
      text: "退出后会返回登录页，当前页面上的筛选条件和未提交表单内容不会保留。",
      confirmLabel: "退出登录",
      tone: "danger",
      onConfirm: performLogout,
    });
  }

  async function handleKnowledgeSearch(query = knowledgeQuery) {
    try {
      setKnowledgeLoading(true);
      setError(null);
      setKnowledgeQuery(query);
      const response = await searchKnowledge(query);
      setKnowledgeSearch(response);
      setMode("kb");
      pushNotice("success", "检索完成", `命中 ${response.results.length} 条知识库资料`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "知识库检索失败");
    } finally {
      setKnowledgeLoading(false);
    }
  }

  async function handleCreateKnowledgeDocument(payload: KnowledgeDocumentCreate) {
    try {
      setKnowledgeCreateLoading(true);
      setError(null);
      const response = await createKnowledgeDocument(payload, currentToken);
      const [documents, search] = await Promise.all([
        fetchKnowledgeDocuments(),
        searchKnowledge(payload.title),
      ]);
      const created =
        documents.documents.find((document) => document.document_id === response.document.document_id) ??
        documents.documents.find((document) => document.title === payload.title);
      if (created) {
        const versions = await fetchKnowledgeDocumentVersions(created.document_id);
        setKnowledgeVersions(versions);
      }
      setKnowledgeDocs(documents);
      setKnowledgeSearch(search);
      setKnowledgeQuery(payload.title);
      setMode("kb");
      pushNotice("success", "资料已入库", payload.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : "知识库资料入库失败");
    } finally {
      setKnowledgeCreateLoading(false);
    }
  }

  async function handleUpdateKnowledgeDocument(documentId: string, payload: KnowledgeDocumentUpdate) {
    try {
      setKnowledgeCreateLoading(true);
      setError(null);
      const response = await updateKnowledgeDocument(documentId, payload, currentToken);
      const nextQuery = payload.title ?? response.document.title;
      const [documents, search, versions] = await Promise.all([
        fetchKnowledgeDocuments(),
        searchKnowledge(nextQuery),
        fetchKnowledgeDocumentVersions(response.document.document_id),
      ]);
      setKnowledgeDocs(documents);
      setKnowledgeSearch(search);
      setKnowledgeVersions(versions);
      setKnowledgeQuery(nextQuery);
      setMode("kb");
      pushNotice("success", "资料已更新", response.document.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : "知识库资料编辑失败");
    } finally {
      setKnowledgeCreateLoading(false);
    }
  }

  async function handleOfflineKnowledgeDocument(documentId: string, documentTitle: string) {
    setConfirmDialog({
      title: "下线知识库资料",
      text: `确认下线《${documentTitle}》？下线后资料不会进入默认检索结果，可通过版本记录追踪。`,
      confirmLabel: "确认下线",
      tone: "danger",
      onConfirm: async () => {
        await performOfflineKnowledgeDocument(documentId, documentTitle);
      },
    });
  }

  async function performOfflineKnowledgeDocument(documentId: string, documentTitle: string) {
    try {
      setKnowledgeCreateLoading(true);
      setError(null);
      const response = await offlineKnowledgeDocument(documentId, currentToken);
      const [documents, versions] = await Promise.all([
        fetchKnowledgeDocuments(),
        fetchKnowledgeDocumentVersions(response.document.document_id),
      ]);
      setKnowledgeDocs(documents);
      setKnowledgeVersions(versions);
      setMode("kb");
      pushNotice("success", "资料已下线", documentTitle);
    } catch (err) {
      setError(err instanceof Error ? err.message : "知识库资料下线失败");
      throw err;
    } finally {
      setKnowledgeCreateLoading(false);
    }
  }

  async function handleRevisePlan(feedback: string) {
    if (!plan) {
      await handleGeneratePlan();
      return;
    }
    try {
      setPlanRevisionLoading(true);
      setError(null);
      const revisedPlan = await reviseLearningPlan(
        plan.plan_id,
        feedback,
        plan.student_id,
        currentToken,
      );
      setPlan(revisedPlan);
      setMode("growth");
      pushNotice("success", "学习计划已调整", feedback);
    } catch (err) {
      setError(err instanceof Error ? err.message : "学习计划更新失败");
    } finally {
      setPlanRevisionLoading(false);
    }
  }

  async function handleSaveProfile(payload: BasicProfilePayload) {
    try {
      setProfileSaving(true);
      setError(null);
      const updatedProfile = await upsertBasicProfile(activeStudentId, payload, currentToken);
      setProfile(updatedProfile);
      setProfileEvidence(null);
      setPlan(null);
      setCompetitions(null);
      setCompetitionPreparation(null);
      setTeam(null);
      setTeamRequest(null);
      setMode("growth");
      pushNotice("success", "个人资料已保存", "成长规划、竞赛推荐和组队匹配会按新资料更新");
    } catch (err) {
      setError(err instanceof Error ? err.message : "基础画像保存失败");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleGeneratePlan() {
    try {
      setPlanRevisionLoading(true);
      setError(null);
      const generatedPlan = await generateLearningPlan(activeStudentId, currentToken);
      setPlan(generatedPlan);
      setMode("growth");
      pushNotice("success", "学习计划已生成", `${generatedPlan.weeks} 周计划已保存`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "学习计划生成失败");
    } finally {
      setPlanRevisionLoading(false);
    }
  }

  async function handleGenerateCompetition() {
    try {
      setPlanRevisionLoading(true);
      setError(null);
      const [competitionData, preparationData] = await Promise.all([
        recommendCompetitions(activeStudentId, currentToken),
        generateCompetitionPreparationPlan(activeStudentId, currentToken),
      ]);
      setCompetitions(competitionData);
      setCompetitionPreparation(preparationData);
      setMode("growth");
      pushNotice("success", "竞赛建议已生成", `${competitionData.recommendations.length} 个推荐`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "竞赛建议生成失败");
    } finally {
      setPlanRevisionLoading(false);
    }
  }

  async function handleGenerateTeam() {
    try {
      setTeamStatusLoading(true);
      setError(null);
      const [teamData, requestData] = await Promise.all([
        recommendTeam(activeStudentId, currentToken),
        createTeamRequest(activeStudentId, currentToken),
      ]);
      setTeam(teamData);
      setTeamRequest(requestData);
      setMode("growth");
      pushNotice("success", "组队建议已生成", `${teamData.candidates.length} 位候选同学`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "组队建议生成失败");
    } finally {
      setTeamStatusLoading(false);
    }
  }

  function canAccessModule(module: string, ...aliases: string[]) {
    const modules = currentAccount?.modules;
    if (!modules) return true;
    return [module, ...aliases].some((name) => modules.includes(name));
  }

  async function handleUpdateTeamStatus(enabled: boolean) {
    try {
      setTeamStatusLoading(true);
      setError(null);
      const nextStatus = await updateTeamPoolStatus(activeStudentId, enabled, currentToken);
      setTeamStatus(nextStatus);
      const nextTeam = await recommendTeam(activeStudentId, currentToken);
      setTeam(nextTeam);
      pushNotice(
        "success",
        enabled ? "已进入组队推荐池" : "已退出组队推荐池",
        nextStatus.visibility_note,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "组队授权状态更新失败");
    } finally {
      setTeamStatusLoading(false);
    }
  }

  async function handleArchiveUpload(payload: AssignmentSubmissionPayload) {
    try {
      setArchiveUploadLoading(true);
      setArchiveUploadResult(null);
      setError(null);
      const isStudentSubmission = currentAccount?.role === "student";
      const projectDescription = [
        payload.description,
        `项目来源：${payload.projectType}`,
        `绑定场景：${payload.projectContext}`,
        `项目作者：${payload.authors}`,
        payload.teamRoles ? `团队分工：${payload.teamRoles}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const commonPayload = {
        assignmentTitle: payload.assignmentTitle,
        assignmentId: payload.assignmentId,
        studentId: isStudentSubmission ? activeStudentId : payload.studentId,
        courseId: payload.courseId,
        classId: payload.classId,
        description: projectDescription,
      };
      const uploadedReport = payload.archive
        ? await uploadAssignmentArchive(
            {
              ...commonPayload,
              archive: payload.archive,
            },
            currentToken,
          )
        : await analyzeRepositoryAssignment(
            {
              ...commonPayload,
              repositoryUrl: payload.repositoryUrl ?? "",
            },
            currentToken,
          );
      const nextAssignments = await fetchAssignments(currentToken);
      setReport(uploadedReport);
      setAssignments(nextAssignments.assignments);
      if (isStudentSubmission) {
        setArchiveUploadResult(
          `已生成项目分析报告，${uploadedReport.code_structure.file_count} 个文件完成解析`,
        );
        setMode("student");
        pushNotice(
          "success",
          "项目分析完成",
          `${uploadedReport.assignment_title} · ${uploadedReport.code_structure.file_count} 个文件`,
        );
      } else {
        const nextDashboard = await fetchAssignmentDashboardById(
          uploadedReport.assignment_id,
          currentToken,
        );
        setDashboard(nextDashboard);
        setArchiveUploadResult(
          `${uploadedReport.student_name} 的 ${uploadedReport.code_structure.file_count} 个文件已分析`,
        );
        setTeacherSelectedReport(uploadedReport);
        setMode("teacher");
        pushNotice("success", "学生项目已分析", uploadedReport.student_name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "项目分析失败");
    } finally {
      setArchiveUploadLoading(false);
    }
  }

  async function handleCreateAssignment(payload: AssignmentCreatePayload) {
    try {
      setAssignmentCreateLoading(true);
      setError(null);
      const created = await createAssignment(payload, currentToken);
      const [nextAssignments, nextDashboard] = await Promise.all([
        fetchAssignments(currentToken),
        fetchAssignmentDashboardById(created.assignment_id, currentToken),
      ]);
      setAssignments(nextAssignments.assignments);
      setDashboard(nextDashboard);
      setTeacherSelectedReport(null);
      setMode("teacher");
      pushNotice("success", "项目已发布", created.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : "项目发布失败");
    } finally {
      setAssignmentCreateLoading(false);
    }
  }

  async function handleSelectAssignment(assignmentId: string) {
    try {
      setError(null);
      const nextDashboard = await fetchAssignmentDashboardById(assignmentId, currentToken);
      setDashboard(nextDashboard);
      setTeacherSelectedReport(null);
      setMode("teacher");
      pushNotice("info", "已切换项目看板", nextDashboard.assignment_title);
    } catch (err) {
      setError(err instanceof Error ? err.message : "项目看板切换失败");
    }
  }

  async function handleExportAssignment() {
    if (!dashboard) return;
    try {
      setAssignmentExportLoading(true);
      setAssignmentExportResult(null);
      setError(null);
      const exported = await exportAssignmentDashboard(dashboard.assignment_id, currentToken);
      downloadMarkdownFile(exported.markdown, exported.content_type, exported.filename);
      setAssignmentExportResult(`${exported.filename} 已生成`);
      pushNotice("success", "学情报告已导出", exported.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "项目学情报告导出失败");
    } finally {
      setAssignmentExportLoading(false);
    }
  }

  async function handleExportReport(targetReport = report) {
    if (!targetReport) return;
    try {
      setReportExportLoading(true);
      setReportExportResult(null);
      setError(null);
      const exported = await exportAssignmentReport(
        targetReport.assignment_id,
        targetReport.student_id,
        currentToken,
      );
      downloadMarkdownFile(exported.markdown, exported.content_type, exported.filename);
      setReportExportResult(`${exported.filename} 已生成`);
      pushNotice("success", "项目报告已导出", exported.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "项目报告导出失败");
    } finally {
      setReportExportLoading(false);
    }
  }

  async function handleSelectStudentReport(assignmentId: string) {
    if (!currentAccount) return;
    try {
      setStudentReportLoading(true);
      setError(null);
      const nextReport = await fetchAssignmentReport(
        assignmentId,
        currentAccount.user_id,
        currentToken,
      );
      setReport(nextReport);
      setMode("student");
    } catch (err) {
      setError(err instanceof Error ? err.message : "项目分析报告切换失败");
    } finally {
      setStudentReportLoading(false);
    }
  }

  async function handleSelectTeacherReport(assignmentId: string, studentId: string) {
    try {
      setTeacherReportLoading(true);
      setError(null);
      const nextReport = await fetchAssignmentReport(assignmentId, studentId, currentToken);
      setTeacherSelectedReport(nextReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : "学生项目报告加载失败");
    } finally {
      setTeacherReportLoading(false);
    }
  }

  async function handleGenerateReview(payload: ReviewGeneratePayload) {
    try {
      setTaskLoading(true);
      setError(null);
      const response = await generateReview(activeStudentId, currentToken, payload);
      setReview(response);
      setMode("growth");
      pushNotice("success", "阶段反馈已生成", response.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "阶段反馈生成失败");
    } finally {
      setTaskLoading(false);
    }
  }

  async function handleSaveTask(payload: SaveTaskPayload, options?: { openExecution?: boolean }) {
    try {
      setTaskLoading(true);
      setError(null);
      const task = await saveTask(payload, activeStudentId, currentToken);
      setTaskList((current) =>
        current
          ? {
              ...current,
              total: current.total + 1,
              tasks: [task, ...current.tasks],
            }
          : current,
      );
      if (options?.openExecution !== false) {
        setGrowthInitialSection("execution");
        setTaskSaveResult(`${task.title} 已保存到计划执行`);
        setMode("growth");
      }
      pushNotice("success", "事项已保存", task.title);
      return task;
    } catch (err) {
      setError(err instanceof Error ? err.message : "任务保存失败");
      throw err;
    } finally {
      setTaskLoading(false);
    }
  }

  async function handleUpdateTaskStatus(taskId: string, status: "todo" | "doing" | "done") {
    try {
      setTaskStatusUpdatingId(taskId);
      setError(null);
      const updatedTask = await updateLearningTask(
        activeStudentId,
        taskId,
        { status },
        currentToken,
      );
      setTaskList((current) => {
        if (!current) return current;
        const tasks = current.tasks.map((task) =>
          task.task_id === updatedTask.task_id ? updatedTask : task,
        );
        return {
          ...current,
          completed: tasks.filter((task) => task.status === "done").length,
          tasks,
        };
      });
      setTaskSaveResult(
        status === "done" ? `${updatedTask.title} 已标记完成` : `${updatedTask.title} 已恢复执行`,
      );
      setGrowthInitialSection("execution");
      setMode("growth");
      pushNotice(
        "success",
        status === "done" ? "事项已完成" : "事项已恢复执行",
        updatedTask.title,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "任务状态更新失败");
    } finally {
      setTaskStatusUpdatingId(null);
    }
  }

  async function handleCreateEvaluationArtifact(
    casePayload: EvaluationCaseCreate,
    recordPayload: Omit<EvaluationRecordCreate, "case_id">,
  ) {
    try {
      setEvaluationLoading(true);
      setError(null);
      const caseResponse = await createEvaluationCase(casePayload, currentToken);
      await createEvaluationRecord(
        {
          ...recordPayload,
          case_id: caseResponse.item_id,
        },
        currentToken,
      );
      setEvaluationDashboard(await fetchEvaluationDashboard());
      setMode("evaluations");
      pushNotice("success", "评测记录已保存", casePayload.scenario);
    } catch (err) {
      setError(err instanceof Error ? err.message : "评测记录保存失败");
    } finally {
      setEvaluationLoading(false);
    }
  }

  async function handleExportEvaluationReport() {
    try {
      setEvaluationExportLoading(true);
      setEvaluationExportResult(null);
      setError(null);
      const exported = await exportEvaluationReport(currentToken);
      const blob = new Blob([exported.markdown], { type: exported.content_type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exported.filename;
      link.click();
      URL.revokeObjectURL(url);
      setEvaluationExportResult(`${exported.filename} 已生成`);
      pushNotice("success", "评测报告已导出", exported.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "评测报告导出失败");
    } finally {
      setEvaluationExportLoading(false);
    }
  }

  async function handleAcademicImport(payload: AcademicImportRequest) {
    const courseId = payload.courses?.[0]?.course_id || "course_web_2026";
    const classId = payload.classes?.[0]?.class_id || "class_cs_2024_01";
    try {
      setAcademicImportLoading(true);
      setAcademicImportResult(null);
      setError(null);
      const response = await importAcademicData(payload, currentToken);
      const [nextCourses, nextClasses, nextStudents] = await Promise.all([
        fetchCourses(),
        fetchClasses(courseId),
        fetchStudents(classId),
      ]);
      const nextLocalAccounts = await fetchLocalAccounts(currentToken);
      setCourses(nextCourses);
      setClasses(nextClasses);
      setStudents(nextStudents);
      setLocalAccounts(nextLocalAccounts.accounts);
      setAcademicImportResult(
        `${response.imported_courses} 门课程 / ${response.imported_classes} 个班级 / ${response.imported_students} 名学生已处理`,
      );
      setMode("academic");
      pushNotice("success", "教学基础数据已导入", `${response.imported_students} 名学生已处理`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "教学基础数据导入失败");
    } finally {
      setAcademicImportLoading(false);
    }
  }

  async function handleLocalTeacherSession() {
    try {
      setAcademicImportLoading(true);
      setError(null);
      const session = await createLocalSession("teacher_school_001");
      setCurrentAccount(session.account);
      setCurrentToken(session.token);
      setSessionExpiresAt(
        new Date(Date.now() + (session.expires_in ?? 8 * 60 * 60) * 1000).toISOString(),
      );
      const [nextDashboard, nextCandidateScreening] = await Promise.all([
        fetchAssignmentDashboard(session.token),
        screenTeacherCandidates(session.token),
      ]);
      setDashboard(nextDashboard);
      setCandidateScreening(nextCandidateScreening);
      setAcademicImportResult(`${session.account.name} 已通过学校账号进入系统`);
      setMode("teacher");
      pushNotice("success", "教师账号已进入系统", session.account.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "教师账号登录失败，请先导入课程数据");
    } finally {
      setAcademicImportLoading(false);
    }
  }

  if (!currentAccount || !currentToken) {
    return (
      <LoginPage
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        schoolIdentity={schoolIdentity}
        loginView={loginView}
        loading={loading || schoolLoginLoading || accountLoginLoading || sessionLoading}
        restoring={sessionLoading && !currentAccount}
        sessionMessage={sessionMessage}
        error={error}
        onSelectedAccountChange={setSelectedAccountId}
        onSchoolIdentityChange={setSchoolIdentity}
        onLoginViewChange={setLoginView}
        onSchoolLogin={handleSchoolIdentityLogin}
        onAccountLogin={() => handleAccountChange(selectedAccountId)}
      />
    );
  }

  const activeAccount = currentAccount;

  return (
    <main className="workspace">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">Z</span>
          <div>
            <strong>智创Agent</strong>
            <span>学生成长与双创能力平台</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="主导航">
          <span className="sidebar-section-label">工作区</span>
          {canAccessModule("项目管理") && (
            <button
              className={mode === "student" ? "active" : ""}
              onClick={() => setMode("student")}
            >
              项目管理
            </button>
          )}
          {canAccessModule("成长规划") && (
            <button
              className={mode === "growth" ? "active" : ""}
              onClick={() => setMode("growth")}
            >
              成长规划
            </button>
          )}
          {canAccessModule("知识库问答") && (
            <button
              className={mode === "knowledge" ? "active" : ""}
              onClick={() => setMode("knowledge")}
            >
              知识库问答
            </button>
          )}
          {canAccessModule("开源课堂", "知识库问答", "教师看板") && (
            <button
              className={mode === "open-course" ? "active" : ""}
              onClick={() => setMode("open-course")}
            >
              开源课堂
            </button>
          )}
          {canAccessModule("教师看板") && (
            <button
              className={mode === "teacher" ? "active" : ""}
              onClick={() => setMode("teacher")}
            >
              教师看板
            </button>
          )}
          {canAccessModule("测试评测") && (
            <button
              className={mode === "evaluations" ? "active" : ""}
              onClick={() => setMode("evaluations")}
            >
              测试评测
            </button>
          )}
          {canAccessModule("课程班级") && (
            <button
              className={mode === "academic" ? "active" : ""}
              onClick={() => setMode("academic")}
            >
              课程班级
            </button>
          )}
          {canAccessModule("知识库管理") && (
            <button className={mode === "kb" ? "active" : ""} onClick={() => setMode("kb")}>
              知识库管理
            </button>
          )}
          <button
            className={mode === "profile" ? "active" : ""}
            onClick={() => setMode("profile")}
          >
            个人中心
          </button>
        </nav>

        <section className="sidebar-context" aria-label="当前工作区">
          <span>当前模块</span>
          <strong>{titleForMode(mode)}</strong>
          <p>{descriptionForMode(mode)}</p>
          <div className="sidebar-mini-flow" aria-label="学生项目闭环">
            {stepsForMode(mode).map((step) => (
              <small key={step}>{step}</small>
            ))}
          </div>
        </section>

        <section className="sidebar-account-card" aria-label="当前账号">
          <span>当前账号</span>
          <strong>{activeAccount.name}</strong>
          <small>
            {roleLabel(activeAccount.role)} · {sessionLabel(currentToken)}
          </small>
          <small>会话有效期：{formatSessionExpiry(sessionExpiresAt)}</small>
          {sessionRestored && <em>会话已恢复</em>}
          <button type="button" onClick={handleLogout}>
            退出登录
          </button>
        </section>

      </aside>

      <section className="content">
        <NoticeStack notices={notices} onDismiss={dismissNotice} />
        <ConfirmDialog
          dialog={confirmDialog}
          loading={confirmLoading}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={runConfirmedAction}
        />

        <header className="topbar">
          <div>
            <p className="eyebrow">智创Agent·计算机学科垂类大模型与双创能力赋能平台</p>
            <h1>{titleForMode(mode)}</h1>
          </div>
          <div className="topbar-actions">
            <button
              className="account-chip"
              onClick={() => setMode("profile")}
            >
              <span>{activeAccount.name.slice(0, 1)}</span>
              <strong>{activeAccount.name}</strong>
              <small>{roleLabel(activeAccount.role)}</small>
            </button>
            <button
              className="primary-action"
              onClick={handleRefreshCurrentView}
              disabled={
                loading ||
                sessionLoading ||
                studentReportLoading ||
                teacherReportLoading ||
                evaluationLoading ||
                knowledgeLoading
              }
            >
              {mode === "knowledge" || mode === "kb"
                ? "重新检索"
                : mode === "open-course"
                  ? "课堂状态"
                : mode === "academic" || mode === "evaluations"
                  ? "刷新数据"
                  : mode === "teacher"
                    ? "刷新学情"
                    : mode === "student"
                      ? "刷新项目"
                      : mode === "profile"
                        ? "刷新资料"
                        : "刷新规划"}
            </button>
          </div>
        </header>

        {loading && <div className="state-box">正在加载账号数据...</div>}
        {sessionLoading && <div className="state-box">正在加载账号数据...</div>}
        {error && <div className="state-box error">当前操作未完成：{error}</div>}

        {!loading && mode === "teacher" && dashboard && (
          <TeacherDashboard
            dashboard={dashboard}
            assignments={assignments}
            assignmentCreateLoading={assignmentCreateLoading}
            exportLoading={assignmentExportLoading}
            exportResult={assignmentExportResult}
            candidateScreening={candidateScreening}
            uploadLoading={archiveUploadLoading}
            uploadResult={archiveUploadResult}
            selectedReport={teacherSelectedReport}
            reportLoading={teacherReportLoading}
            reportExportLoading={reportExportLoading}
            reportExportResult={reportExportResult}
            onCreateAssignment={handleCreateAssignment}
            onSelectAssignment={handleSelectAssignment}
            onExportAssignment={handleExportAssignment}
            onExportReport={handleExportReport}
            onArchiveUpload={handleArchiveUpload}
            onSelectReport={handleSelectTeacherReport}
          />
        )}

        {!loading && mode === "student" && report && (
          <StudentReport
            report={report}
            assignments={assignments}
            loading={studentReportLoading}
            averageScore={averageScore}
            uploadLoading={archiveUploadLoading}
            uploadResult={archiveUploadResult}
            exportLoading={reportExportLoading}
            exportResult={reportExportResult}
            onSelectAssignment={handleSelectStudentReport}
            onExportReport={() => handleExportReport(report)}
            onArchiveUpload={handleArchiveUpload}
            taskSaving={taskLoading}
            onSaveTaskFromProject={(payload) =>
              handleSaveTask(payload, { openExecution: true })
            }
          />
        )}

        {!loading && mode === "student" && !report && currentAccount?.role === "student" && (
          <ProjectStart
            account={currentAccount}
            assignments={assignments}
            loading={archiveUploadLoading || studentReportLoading}
            result={archiveUploadResult}
            onArchiveUpload={handleArchiveUpload}
            onSelectAssignment={handleSelectStudentReport}
          />
        )}

        {!loading && mode === "knowledge" && (
          <KnowledgeAssistant
            question={chatQuestion}
            response={chatResponse}
            loading={chatLoading}
            history={chatHistory}
            onQuestionChange={setChatQuestion}
            onAsk={handleAskAgent}
            onClear={handleClearKnowledgeSession}
          />
        )}

        {growthPayload && <GrowthPath {...growthPayload} />}

        {!loading && mode === "open-course" && <OpenCourseStudio />}

        {!loading && mode === "kb" && knowledgeDocs && (
          <KnowledgeAdmin
            documents={knowledgeDocs}
            search={knowledgeSearch}
            versions={knowledgeVersions}
            query={knowledgeQuery}
            loading={knowledgeLoading}
            createLoading={knowledgeCreateLoading}
            onQueryChange={setKnowledgeQuery}
            onSearch={handleKnowledgeSearch}
            onCreateDocument={handleCreateKnowledgeDocument}
            onUpdateDocument={handleUpdateKnowledgeDocument}
            onOfflineDocument={handleOfflineKnowledgeDocument}
          />
        )}

        {!loading && mode === "evaluations" && evaluationDashboard && (
          <EvaluationDashboard
            dashboard={evaluationDashboard}
            isAdmin={activeAccount.role === "admin"}
            loading={evaluationLoading}
            exportLoading={evaluationExportLoading}
            exportResult={evaluationExportResult}
            onCreateArtifact={handleCreateEvaluationArtifact}
            onExportReport={handleExportEvaluationReport}
          />
        )}

        {!loading && mode === "academic" && courses && classes && students && (
          <AcademicDirectory
            courses={courses}
            classes={classes}
            students={students}
            isAdmin={currentAccount?.role === "admin"}
            importLoading={academicImportLoading}
            importResult={academicImportResult}
            onImportAcademicData={handleAcademicImport}
            onLocalTeacherSession={handleLocalTeacherSession}
          />
        )}

        {!loading && mode === "profile" && profile && (
          <ProfileCenter
            account={activeAccount}
            token={currentToken}
            sessionExpiresAt={sessionExpiresAt}
            localAccounts={localAccounts}
            profile={profile}
            saving={profileSaving}
            accountLoading={accountLoginLoading || sessionLoading}
            onSaveProfile={handleSaveProfile}
            onLocalAccountChange={handleLocalAccountChange}
            onLogout={handleLogout}
          />
        )}
      </section>
    </main>
  );
}

function LoginPage({
  accounts,
  selectedAccountId,
  schoolIdentity,
  loginView,
  loading,
  restoring,
  sessionMessage,
  error,
  onSelectedAccountChange,
  onSchoolIdentityChange,
  onLoginViewChange,
  onSchoolLogin,
  onAccountLogin,
}: {
  accounts: SchoolAccount[];
  selectedAccountId: string;
  schoolIdentity: string;
  loginView: LoginView;
  loading: boolean;
  restoring: boolean;
  sessionMessage: string | null;
  error: string | null;
  onSelectedAccountChange: (userId: string) => void;
  onSchoolIdentityChange: (identity: string) => void;
  onLoginViewChange: (view: LoginView) => void;
  onSchoolLogin: () => void;
  onAccountLogin: () => void;
}) {
  const accountCount = accounts.length;
  const [accountQuery, setAccountQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "student" | "teacher" | "admin">("all");
  const normalizedAccountQuery = accountQuery.trim().toLowerCase();
  const roleFilters = [
    { value: "all", label: "全部" },
    { value: "student", label: "学生" },
    { value: "teacher", label: "教师" },
    { value: "admin", label: "管理员" },
  ] as const;
  const filteredAccounts = accounts.filter((account) => {
    const matchesRole = roleFilter === "all" || account.role === roleFilter;
    const matchesQuery =
      !normalizedAccountQuery ||
      [account.name, account.user_id, accountSubtitle(account), account.authorized_classes.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(normalizedAccountQuery);
    return matchesRole && matchesQuery;
  });
  const selectedAccount = accounts.find((account) => account.user_id === selectedAccountId);
  const roleCounts = roleFilters
    .filter((item) => item.value !== "all")
    .map((item) => ({
      label: item.label,
      count: accounts.filter((account) => account.role === item.value).length,
    }));

  return (
    <main className="login-shell">
      <section className="login-brand-panel">
        <div className="brand login-brand">
          <span className="brand-mark">Z</span>
          <div>
            <strong>智创Agent</strong>
            <span>学生成长与双创能力平台</span>
          </div>
        </div>
        <div>
          <p className="eyebrow">计算机学科垂类大模型与双创能力赋能平台</p>
          <h1>面向学生项目成长闭环的智能体平台</h1>
          <p>
            学生以项目资产为主线完成代码分析、能力画像、成长规划、竞赛准备和组队协作；教师直接查看班级项目报告和学情诊断。
          </p>
        </div>
        <div className="login-feature-grid">
          <span>项目管理</span>
          <span>能力画像</span>
          <span>竞赛准备</span>
          <span>计划执行</span>
        </div>
        <div className="login-flow-strip" aria-label="系统工作流">
          <span>项目提交</span>
          <span>智能分析</span>
          <span>成长规划</span>
          <span>持续改进</span>
        </div>
        <div className="login-access-strip" aria-label="接入能力">
          <article>
            <span>统一身份</span>
            <strong>学校账号映射</strong>
          </article>
          <article>
            <span>权限边界</span>
            <strong>课程 / 班级 / 角色</strong>
          </article>
          <article>
            <span>数据基础</span>
            <strong>课程、学生、项目报告</strong>
          </article>
        </div>
      </section>

      <section className="login-card">
        <div className="login-card-head">
          <span className="section-label">学校入口</span>
          <h2>进入智创Agent</h2>
          <p>
            推荐使用学校统一身份进入个人工作区；已接入账号可通过学校账号入口进入对应角色工作区。
          </p>
        </div>

        <div className="login-tabs" role="tablist" aria-label="登录方式">
          <button
            className={loginView === "school" ? "active" : ""}
            onClick={() => onLoginViewChange("school")}
            type="button"
          >
            统一身份登录
          </button>
          <button
            className={loginView === "account" ? "active" : ""}
            onClick={() => onLoginViewChange("account")}
            type="button"
          >
            学校账号进入
          </button>
        </div>

        {loginView === "school" ? (
          <div className="login-form">
            <div className="identity-status-card">
              <strong>统一身份入口</strong>
              <span>支持学号、工号、邮箱或学校用户 ID 映射到系统账号。</span>
            </div>
            <label>
              <span>学号、工号或邮箱</span>
              <input
                value={schoolIdentity}
                placeholder="学号、工号或邮箱"
                onChange={(event) => onSchoolIdentityChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && schoolIdentity.trim()) {
                    onSchoolLogin();
                  }
                }}
              />
            </label>
            <button onClick={onSchoolLogin} disabled={loading || !schoolIdentity.trim()}>
              {restoring ? "恢复会话中" : loading ? "登录中" : "登录"}
            </button>
          </div>
        ) : (
          <div className="login-form">
            <div className="account-directory-summary">
              <strong>{accountCount}</strong>
              <span>个已接入学校账号，按课程、班级和角色控制可访问范围</span>
            </div>
            <div className="account-role-summary" aria-label="学校账号角色分布">
              {roleCounts.map((item) => (
                <span key={item.label}>{item.label} {item.count}</span>
              ))}
            </div>
            <label>
              <span>检索账号</span>
              <input
                value={accountQuery}
                placeholder="姓名、学号、工号或班级"
                onChange={(event) => setAccountQuery(event.target.value)}
              />
            </label>
            <div className="account-role-tabs" role="tablist" aria-label="账号角色筛选">
              {roleFilters.map((item) => (
                <button
                  key={item.value}
                  className={roleFilter === item.value ? "active" : ""}
                  type="button"
                  onClick={() => setRoleFilter(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="account-card-list" aria-label="学校账号列表">
              {filteredAccounts.slice(0, 6).map((account) => (
                <button
                  key={account.user_id}
                  className={selectedAccountId === account.user_id ? "selected" : ""}
                  type="button"
                  onClick={() => onSelectedAccountChange(account.user_id)}
                >
                  <span>{account.name.slice(0, 1)}</span>
                  <div>
                    <strong>{account.name}</strong>
                    <small>{roleLabel(account.role)} · {accountSubtitle(account)}</small>
                    <em>
                      {account.authorized_courses.slice(0, 2).join(" / ") || "未配置课程"} ·{" "}
                      {account.modules.length} 个模块
                    </em>
                  </div>
                </button>
              ))}
              {!filteredAccounts.length && (
                <div className="account-directory-empty">
                  <strong>没有匹配账号</strong>
                  <span>请调整关键词或角色筛选。</span>
                </div>
              )}
            </div>
            {selectedAccount && (
              <div className="selected-account-scope">
                <span>将进入</span>
                <strong>{selectedAccount.name} · {roleLabel(selectedAccount.role)}</strong>
                <small>{selectedAccount.authorized_classes.join(" / ") || "未配置班级"}</small>
              </div>
            )}
            <button onClick={onAccountLogin} disabled={loading || !selectedAccountId}>
              {restoring ? "恢复会话中" : loading ? "进入中" : "进入系统"}
            </button>
          </div>
        )}

        {restoring && (
          <div className="login-session-restore">正在恢复上次登录状态...</div>
        )}
        {sessionMessage && <div className="login-session-restore">{sessionMessage}</div>}
        {error && <div className="login-error">登录未完成：{error}</div>}
      </section>
    </main>
  );
}

function ProfileCenter({
  account,
  token,
  sessionExpiresAt,
  localAccounts,
  profile,
  saving,
  accountLoading,
  onSaveProfile,
  onLocalAccountChange,
  onLogout,
}: {
  account: SchoolAccount;
  token: string;
  sessionExpiresAt: string | null;
  localAccounts: SchoolAccount[];
  profile: GrowthProfile;
  saving: boolean;
  accountLoading: boolean;
  onSaveProfile: (payload: BasicProfilePayload) => void;
  onLocalAccountChange: (userId: string) => void;
  onLogout: () => void;
}) {
  const isLocalToken = token.startsWith("local-token-");
  const canSwitchLocalAccount = account.role === "admin" || account.role === "teacher";
  const completion = profileCompletion(profile);
  const readinessItems = profileReadinessItems(profile);
  const pendingReadinessItems = readinessItems.filter((item) => !item.done);
  const topDimensions = [...profile.dimensions]
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);

  return (
    <>
      <section className="profile-overview">
        <div>
          <span className="section-label">账号信息</span>
          <h2>{account.name}</h2>
          <p>
            {accountSubtitle(account)} · {sessionLabel(token)}
          </p>
          <small className="profile-session-expiry">
            会话有效期：{formatSessionExpiry(sessionExpiresAt)}
          </small>
        </div>
        <div className="profile-account-actions">
          <strong>{roleLabel(account.role)}</strong>
          <button onClick={onLogout}>退出登录</button>
        </div>
      </section>

      <section className="profile-status-grid">
        <article>
          <span>资料完整度</span>
          <strong>{completion.percent}%</strong>
          <div className="profile-progress-track">
            <i style={{ width: `${completion.percent}%` }} />
          </div>
          <small>
            {completion.completed}/{completion.total} 项已完善
          </small>
        </article>
        <article>
          <span>目标方向</span>
          <strong>{profile.target_path}</strong>
          <small>影响学习计划、竞赛推荐和组队匹配</small>
        </article>
        <article>
          <span>能力证据</span>
          <strong>{profile.dimensions.length} 个维度</strong>
          <small>{profile.generated_at}</small>
        </article>
      </section>

      <section className="profile-readiness-panel">
        <div className="profile-readiness-head">
          <div>
            <span className="section-label">资料检查</span>
            <h2>这些信息会影响成长规划、竞赛推荐和组队匹配</h2>
          </div>
          <strong>{pendingReadinessItems.length ? `${pendingReadinessItems.length} 项待完善` : "资料已完整"}</strong>
        </div>
        <div className="profile-readiness-grid">
          {readinessItems.map((item) => (
            <article className={item.done ? "done" : ""} key={item.label}>
              <span>{item.done ? "已完成" : "待完善"}</span>
              <strong>{item.label}</strong>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel-grid">
        {account.role === "student" ? (
          <article className="panel wide">
            <div className="panel-header">
              <div>
                <span className="section-label">基础画像</span>
                <h2>学习目标与能力证据</h2>
              </div>
            </div>
            <BasicProfileEditor profile={profile} saving={saving} onSave={onSaveProfile} />
          </article>
        ) : (
          <article className="panel wide">
            <div className="panel-header">
              <div>
                <span className="section-label">账号资料</span>
                <h2>教学与管理权限</h2>
              </div>
            </div>
            <div className="profile-role-card">
              <strong>{roleLabel(account.role)}</strong>
              <p>
                当前账号用于访问授权课程、班级、知识库和平台管理模块。学生基础画像由学生本人在个人中心维护。
              </p>
            </div>
          </article>
        )}

        <article className="panel">
          <span className="section-label">资料用途</span>
          <div className="profile-usage-list">
            <div>
              <strong>成长规划</strong>
              <span>目标方向、课程基础和每周投入会影响计划节奏。</span>
            </div>
            <div>
              <strong>项目分析</strong>
              <span>项目经历和技能标签会作为能力画像的参考上下文。</span>
            </div>
            <div>
              <strong>竞赛组队</strong>
              <span>竞赛经历、目标方向和技能标签会影响推荐匹配。</span>
            </div>
          </div>

          <span className="section-label">画像摘要</span>
          <div className="profile-dimension-mini-list">
            {topDimensions.map((dimension) => (
              <div key={dimension.dimension}>
                <strong>{dimension.dimension}</strong>
                <span>{dimension.score}</span>
                <small>{dimension.summary}</small>
              </div>
            ))}
          </div>

          <span className="section-label">授权范围</span>
          <div className="profile-scope-list">
            <div>
              <strong>课程</strong>
              <span>{account.authorized_courses.join(" / ") || "未配置"}</span>
            </div>
            <div>
              <strong>班级</strong>
              <span>{account.authorized_classes.join(" / ") || "未配置"}</span>
            </div>
            <div>
              <strong>可用模块</strong>
              <span>{account.modules.join(" / ")}</span>
            </div>
          </div>

          {canSwitchLocalAccount && localAccounts.length > 0 && (
            <div className="profile-switcher">
              <label htmlFor="profile-local-account">已导入学校账号</label>
              <select
                id="profile-local-account"
                value={isLocalToken ? account.user_id : ""}
                onChange={(event) => {
                  if (event.target.value) {
                    onLocalAccountChange(event.target.value);
                  }
                }}
                disabled={accountLoading}
              >
                <option value="">选择已导入账号</option>
                {localAccounts.map((item) => (
                  <option key={item.user_id} value={item.user_id}>
                    {item.name} · {accountSubtitle(item)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </article>
      </section>
    </>
  );
}

function TeacherDashboard({
  dashboard,
  assignments,
  assignmentCreateLoading,
  exportLoading,
  exportResult,
  candidateScreening,
  uploadLoading,
  uploadResult,
  selectedReport,
  reportLoading,
  reportExportLoading,
  reportExportResult,
  onCreateAssignment,
  onSelectAssignment,
  onExportAssignment,
  onExportReport,
  onArchiveUpload,
  onSelectReport,
}: {
  dashboard: AssignmentDashboard;
  assignments: AssignmentItem[];
  assignmentCreateLoading: boolean;
  exportLoading: boolean;
  exportResult: string | null;
  candidateScreening: TeacherCandidateScreenResponse | null;
  uploadLoading: boolean;
  uploadResult: string | null;
  selectedReport: AssignmentReport | null;
  reportLoading: boolean;
  reportExportLoading: boolean;
  reportExportResult: string | null;
  onCreateAssignment: (payload: AssignmentCreatePayload) => void;
  onSelectAssignment: (assignmentId: string) => void;
  onExportAssignment: () => void;
  onExportReport: (report: AssignmentReport) => void;
  onArchiveUpload: (payload: AssignmentSubmissionPayload) => void;
  onSelectReport: (assignmentId: string, studentId: string) => void;
}) {
  const [reportQuery, setReportQuery] = useState("");
  const [scoreFilter, setScoreFilter] = useState<TeacherReportScoreFilter>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reportSort, setReportSort] = useState<TeacherReportSort>("score_asc");
  const [reportPage, setReportPage] = useState(1);
  const [reportPageSize, setReportPageSize] = useState(10);
  const statuses = Array.from(new Set(dashboard.reports.map((report) => report.status)));
  const filteredReports = dashboard.reports
    .filter((summary) => {
      const normalizedQuery = reportQuery.trim().toLowerCase();
      const matchesQuery =
        !normalizedQuery ||
        [summary.student_name, summary.student_id, summary.summary]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesScore =
        scoreFilter === "all" ||
        (scoreFilter === "high" && summary.overall_score >= 85) ||
        (scoreFilter === "medium" &&
          summary.overall_score >= 70 &&
          summary.overall_score < 85) ||
        (scoreFilter === "risk" && summary.overall_score < 70);
      const matchesStatus = statusFilter === "all" || summary.status === statusFilter;
      return matchesQuery && matchesScore && matchesStatus;
    })
    .sort((left, right) => {
      if (reportSort === "score_desc") return right.overall_score - left.overall_score;
      if (reportSort === "name") return left.student_name.localeCompare(right.student_name, "zh-CN");
      return left.overall_score - right.overall_score;
    });
  const activeFilterCount = [
    reportQuery.trim(),
    scoreFilter !== "all",
    statusFilter !== "all",
  ].filter(Boolean).length;
  const reportPageCount = Math.max(1, Math.ceil(filteredReports.length / reportPageSize));
  const currentReportPage = Math.min(reportPage, reportPageCount);
  const reportStartIndex = filteredReports.length
    ? (currentReportPage - 1) * reportPageSize
    : 0;
  const pagedReports = filteredReports.slice(reportStartIndex, reportStartIndex + reportPageSize);
  const firstVisibleReportPage = Math.max(
    1,
    Math.min(currentReportPage - 3, reportPageCount - 6),
  );
  const visibleReportPages = Array.from(
    { length: Math.min(reportPageCount, 7) },
    (_, index) => firstVisibleReportPage + index,
  );
  const riskReportCount = dashboard.reports.filter((summary) => summary.overall_score < 70).length;
  const submittedRatio = dashboard.total_students
    ? Math.round((dashboard.submitted_count / dashboard.total_students) * 100)
    : 0;
  const topAnomaly = dashboard.anomalies[0];
  const topWeakness = dashboard.class_profile.common_weaknesses[0] ?? "暂无集中短板";
  const teacherNextAction =
    riskReportCount > 0
      ? "优先查看低分项目报告"
      : dashboard.anomalies.length > 0
        ? "处理异常项目提示"
        : "安排共性问题讲评";

  useEffect(() => {
    setReportPage(1);
  }, [reportQuery, scoreFilter, statusFilter, reportSort, reportPageSize, dashboard.assignment_id]);

  useEffect(() => {
    if (reportPage > reportPageCount) {
      setReportPage(reportPageCount);
    }
  }, [reportPage, reportPageCount]);

  return (
    <>
      <section className="teacher-command-panel">
        <div className="teacher-command-main">
          <span className="section-label">教师诊断总览</span>
          <h2>{dashboard.assignment_title}</h2>
          <p>{dashboard.course_name} · {dashboard.class_name}</p>
          <strong>{teacherNextAction}</strong>
        </div>
        <div className="teacher-command-metrics" aria-label="教师诊断关键指标">
          <article>
            <span>提交率</span>
            <strong>{submittedRatio}%</strong>
            <small>{dashboard.submitted_count}/{dashboard.total_students} 已分析</small>
          </article>
          <article>
            <span>风险学生</span>
            <strong>{riskReportCount}</strong>
            <small>70 分以下项目</small>
          </article>
          <article>
            <span>异常提示</span>
            <strong>{dashboard.anomalies.length}</strong>
            <small>{topAnomaly?.title ?? "暂无异常"}</small>
          </article>
          <article>
            <span>共性短板</span>
            <strong>{topWeakness}</strong>
            <small>{dashboard.teaching_suggestions.length} 条教学建议</small>
          </article>
        </div>
      </section>

      <section className="summary-strip">
        {dashboard.metrics.map((metric) => (
          <article className="metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.trend}</small>
          </article>
        ))}
      </section>
      <section className="panel export-panel">
        <div>
          <span className="section-label">诊断报告</span>
          <h2>导出班级项目学情报告</h2>
        </div>
        <button onClick={onExportAssignment} disabled={exportLoading}>
          {exportLoading ? "导出中" : "导出 Markdown"}
        </button>
        {exportResult && <strong>{exportResult}</strong>}
      </section>
      <AssignmentManager
        assignments={assignments}
        currentAssignmentId={dashboard.assignment_id}
        loading={assignmentCreateLoading}
        onCreateAssignment={onCreateAssignment}
        onSelectAssignment={onSelectAssignment}
      />
      <AssignmentArchiveUploader
        assignment={{
          assignment_id: dashboard.assignment_id,
          title: dashboard.assignment_title,
          course_id: dashboard.course_id,
          course_name: dashboard.course_name,
          class_id: dashboard.class_id,
          class_name: dashboard.class_name,
        }}
        variant="teacher"
        loading={uploadLoading}
        result={uploadResult}
        onUpload={onArchiveUpload}
      />

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

      <section className="panel class-profile-panel">
        <div className="panel-header">
          <div>
            <span className="section-label">班级能力画像</span>
            <h2>能力热力图、方向分布和数据覆盖率</h2>
          </div>
          <span className="muted">{dashboard.class_profile.summary}</span>
        </div>
        <div className="class-profile-layout">
          <div className="ability-heatmap">
            {dashboard.class_profile.heatmap.map((cell) => (
              <div
                className={`ability-cell ${cell.level}`}
                key={`${cell.student_id}-${cell.dimension}`}
                title={`${cell.student_name} · ${cell.dimension} · ${cell.score}`}
              >
                <span>{cell.student_name.slice(0, 1)}</span>
                <small>{cell.dimension.slice(0, 2)}</small>
                <b>{cell.score}</b>
              </div>
            ))}
          </div>
          <div className="class-profile-side">
            <div className="class-profile-block">
              <strong>方向分布</strong>
              {dashboard.class_profile.direction_distribution.map((item) => (
                <div className="distribution-row" key={item.direction}>
                  <span>{item.direction}</span>
                  <small>
                    {item.count} 人 · {Math.round(item.ratio * 100)}%
                  </small>
                </div>
              ))}
            </div>
            <div className="class-profile-block">
              <strong>数据覆盖率</strong>
              {dashboard.class_profile.data_coverage.map((metric) => (
                <div className="coverage-row" key={metric.label}>
                  <span>{metric.label}</span>
                  <small>
                    {metric.covered}/{metric.total}
                  </small>
                  <div>
                    <i style={{ width: `${Math.round(metric.ratio * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="class-profile-block">
              <strong>共性短板</strong>
              {dashboard.class_profile.common_weaknesses.map((weakness) => (
                <p key={weakness}>{weakness}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="panel anomaly-panel">
        <div className="panel-header">
          <div>
            <span className="section-label">异常项目提示</span>
            <h2>需要教师优先关注的提交</h2>
          </div>
          <span className="muted">{dashboard.anomalies.length} 条提示</span>
        </div>
        <div className="anomaly-list">
          {dashboard.anomalies.map((anomaly) => (
            <article className={`anomaly-card ${anomaly.severity}`} key={anomaly.title}>
              <div>
                <strong>{anomaly.title}</strong>
                <span>{anomaly.evidence}</span>
              </div>
              <p>{anomaly.suggested_action}</p>
              {anomaly.affected_students.length > 0 && (
                <small>{anomaly.affected_students.join(" / ")}</small>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="panel teaching-panel">
        <div className="panel-header">
          <div>
            <span className="section-label">教学改进建议</span>
            <h2>讲评安排与课后练习</h2>
          </div>
          <span className="muted">基于班级共性证据</span>
        </div>
        <div className="teaching-suggestion-list">
          {dashboard.teaching_suggestions.map((suggestion) => (
            <div className="teaching-suggestion" key={suggestion.knowledge_point}>
              <div>
                <strong>{suggestion.knowledge_point}</strong>
                <span>{suggestion.class_evidence}</span>
              </div>
              <p>{suggestion.suggested_activity}</p>
              <small>{suggestion.practice_task}</small>
              <em>{suggestion.expected_improvement}</em>
            </div>
          ))}
        </div>
      </section>

      {candidateScreening && (
        <section className="panel candidate-panel">
          <div className="panel-header">
            <div>
              <span className="section-label">竞赛梯队筛选</span>
              <h2>{candidateScreening.target_name}</h2>
            </div>
            <span className="muted">{candidateScreening.source_note}</span>
          </div>
          <div className="candidate-grid">
            {candidateScreening.candidates.map((candidate) => (
              <div className="candidate-card" key={candidate.student_id}>
                <div className="candidate-card-head">
                  <div>
                    <strong>{candidate.student_name}</strong>
                    <span>{candidate.tier}</span>
                  </div>
                  <b>{candidate.match_score}</b>
                </div>
                <p>{candidate.match_reason}</p>
                <div className="candidate-tags">
                  {candidate.matched_abilities.map((ability) => (
                    <small key={ability}>{ability}</small>
                  ))}
                </div>
                <div className="candidate-evidence">
                  {candidate.evidence.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
                <div className="candidate-gaps">
                  {candidate.gap_reminders.map((gap) => (
                    <em key={gap}>{gap}</em>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="section-label">项目分析报告</span>
            <h2>学生项目报告与分析结果</h2>
          </div>
          <span className="muted">
            {filteredReports.length}/{dashboard.reports.length} 份报告
          </span>
        </div>
        <div className="teacher-report-toolbar" aria-label="项目报告筛选">
          <label className="teacher-report-search">
            <span>检索学生或摘要</span>
            <input
              value={reportQuery}
              placeholder="姓名、学号、问题关键词"
              onChange={(event) => setReportQuery(event.target.value)}
            />
          </label>
          <label>
            <span>分数区间</span>
            <select
              value={scoreFilter}
              onChange={(event) => setScoreFilter(event.target.value as TeacherReportScoreFilter)}
            >
              <option value="all">全部分数</option>
              <option value="risk">70 分以下</option>
              <option value="medium">70-84 分</option>
              <option value="high">85 分以上</option>
            </select>
          </label>
          <label>
            <span>状态</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">全部状态</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>排序</span>
            <select
              value={reportSort}
              onChange={(event) => setReportSort(event.target.value as TeacherReportSort)}
            >
              <option value="score_asc">低分优先</option>
              <option value="score_desc">高分优先</option>
              <option value="name">姓名排序</option>
            </select>
          </label>
          <label>
            <span>每页</span>
            <select
              value={reportPageSize}
              onChange={(event) => setReportPageSize(Number(event.target.value))}
            >
              <option value={5}>5 条</option>
              <option value={10}>10 条</option>
              <option value={20}>20 条</option>
              <option value={50}>50 条</option>
            </select>
          </label>
          <button
            type="button"
            disabled={activeFilterCount === 0}
            onClick={() => {
              setReportQuery("");
              setScoreFilter("all");
              setStatusFilter("all");
              setReportSort("score_asc");
              setReportPage(1);
            }}
          >
            清除筛选
          </button>
        </div>
        <div className="teacher-report-filter-summary">
          <span>{dashboard.submitted_count}/{dashboard.total_students} 已提交</span>
          <span>{filteredReports.length} 份当前可见</span>
          <span>
            第 {currentReportPage}/{reportPageCount} 页
          </span>
          {filteredReports.length > 0 && (
            <span>
              显示 {reportStartIndex + 1}-
              {Math.min(reportStartIndex + reportPageSize, filteredReports.length)}
            </span>
          )}
          {activeFilterCount > 0 && <strong>{activeFilterCount} 个筛选条件</strong>}
        </div>
        <div className="report-table">
          {pagedReports.map((summary) => (
            <button
              className={
                selectedReport?.report_id === summary.report_id ? "report-row active" : "report-row"
              }
              key={summary.report_id}
              type="button"
              onClick={() => onSelectReport(dashboard.assignment_id, summary.student_id)}
              disabled={reportLoading}
            >
              <strong>{summary.student_name}</strong>
              <span>{summary.status}</span>
              <ScoreBar label="综合" score={summary.overall_score} compact />
              <p>{summary.summary}</p>
            </button>
          ))}
          {!dashboard.reports.length && (
            <ActionEmptyState
              label="项目报告"
              title="暂无学生项目报告"
              text="学生提交项目后，教师可以在这里点开查看完整分析。"
            />
          )}
          {dashboard.reports.length > 0 && !filteredReports.length && (
            <ActionEmptyState
              label="筛选结果"
              title="没有匹配的项目报告"
              text="调整关键词、分数区间或状态后再查看。"
              action="清除筛选"
              onAction={() => {
                setReportQuery("");
                setScoreFilter("all");
                setStatusFilter("all");
                setReportSort("score_asc");
                setReportPage(1);
              }}
            />
          )}
        </div>
        {filteredReports.length > 0 && (
          <div className="teacher-report-pagination" aria-label="项目报告分页">
            <button
              type="button"
              disabled={currentReportPage <= 1}
              onClick={() => setReportPage((page) => Math.max(1, page - 1))}
            >
              上一页
            </button>
            <div>
              {visibleReportPages.map((page) => (
                <button
                  key={page}
                  type="button"
                  className={page === currentReportPage ? "active" : ""}
                  onClick={() => setReportPage(page)}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={currentReportPage >= reportPageCount}
              onClick={() => setReportPage((page) => Math.min(reportPageCount, page + 1))}
            >
              下一页
            </button>
          </div>
        )}
      </section>

      <TeacherReportDetail
        report={selectedReport}
        loading={reportLoading}
        exportLoading={reportExportLoading}
        exportResult={reportExportResult}
        onExportReport={onExportReport}
      />
    </>
  );
}

function TeacherReportDetail({
  report,
  loading,
  exportLoading,
  exportResult,
  onExportReport,
}: {
  report: AssignmentReport | null;
  loading: boolean;
  exportLoading: boolean;
  exportResult: string | null;
  onExportReport: (report: AssignmentReport) => void;
}) {
  const averageScore = report
    ? Math.round(report.scores.reduce((sum, score) => sum + score.score, 0) / report.scores.length)
    : 0;

  return (
    <section className="panel teacher-report-detail">
      <div className="panel-header">
        <div>
          <span className="section-label">学生项目报告</span>
          <h2>{report ? `${report.student_name} · ${report.assignment_title}` : "选择一份报告查看详情"}</h2>
        </div>
        {report && (
          <div className="teacher-report-actions">
            <strong className="score-pill">{averageScore}</strong>
            <button type="button" onClick={() => onExportReport(report)} disabled={exportLoading}>
              {exportLoading ? "导出中" : "下载报告"}
            </button>
          </div>
        )}
      </div>
      {report && exportResult && <InlineNotice label="报告已生成" text={exportResult} />}
      {loading && <div className="state-box compact">正在加载学生项目报告...</div>}
      {!loading && !report && (
        <ActionEmptyState
          label="报告详情"
          title="尚未选择学生项目"
          text="点击上方项目报告列表中的学生，可查看评分、问题、证据和改进任务。"
        />
      )}
      {!loading && report && (
        <>
          <p className="teacher-report-summary">{report.summary}</p>
          <div className="teacher-report-grid">
            <article>
              <span>文件数量</span>
              <strong>{report.code_structure.file_count}</strong>
            </article>
            <article>
              <span>问题数</span>
              <strong>{report.findings.length}</strong>
            </article>
            <article>
              <span>证据片段</span>
              <strong>{report.evidence_snippets.length}</strong>
            </article>
            <article>
              <span>改进任务</span>
              <strong>{report.improvement_tasks.length}</strong>
            </article>
          </div>
          <section className="teacher-report-layout">
            <article>
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
            <article>
              <span className="section-label">主要问题</span>
              <div className="finding-list">
                {report.findings.slice(0, 4).map((finding) => (
                  <div className={`finding-item ${finding.severity}`} key={finding.title}>
                    <strong>{finding.title}</strong>
                    <p>{finding.detail}</p>
                    <small>{finding.suggestion}</small>
                  </div>
                ))}
              </div>
            </article>
          </section>
          <section className="teacher-report-layout">
            <article>
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
            <article>
              <span className="section-label">改进任务</span>
              <ol className="task-list">
                {report.improvement_tasks.map((task) => (
                  <li key={task}>{task}</li>
                ))}
              </ol>
            </article>
          </section>
        </>
      )}
    </section>
  );
}

function AssignmentManager({
  assignments,
  currentAssignmentId,
  loading,
  onCreateAssignment,
  onSelectAssignment,
}: {
  assignments: AssignmentItem[];
  currentAssignmentId: string;
  loading: boolean;
  onCreateAssignment: (payload: AssignmentCreatePayload) => void;
  onSelectAssignment: (assignmentId: string) => void;
}) {
  const currentAssignment = assignments.find((assignment) => assignment.assignment_id === currentAssignmentId);
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState(currentAssignment?.course_id ?? "course_web_2026");
  const [classId, setClassId] = useState(currentAssignment?.class_id ?? "class_cs_2024_01");
  const [rubricId, setRubricId] = useState("rubric_project_analysis");
  const [description, setDescription] = useState("");
  const canPublish = Boolean(title.trim() && courseId.trim() && classId.trim());

  useEffect(() => {
    if (!currentAssignment) return;
    setCourseId(currentAssignment.course_id);
    setClassId(currentAssignment.class_id);
  }, [currentAssignment?.assignment_id]);

  function submitAssignment() {
    if (!canPublish) return;
    onCreateAssignment({
      title: title.trim(),
      courseId: courseId.trim(),
      classId: classId.trim(),
      description: description.trim() || undefined,
      rubricId: rubricId.trim() || undefined,
    });
    setTitle("");
    setDescription("");
  }

  return (
    <section className="panel assignment-manager">
      <div className="panel-header">
        <div>
          <span className="section-label">项目看板</span>
          <h2>发布项目并切换学情看板</h2>
        </div>
        <button onClick={submitAssignment} disabled={loading || !canPublish}>
          {loading ? "发布中" : "发布项目"}
        </button>
      </div>
      <div className="assignment-publish-form">
        <label className="assignment-title-field">
          <span>项目名称</span>
          <input
            value={title}
            placeholder="项目名称"
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          <span>课程 ID</span>
          <input value={courseId} onChange={(event) => setCourseId(event.target.value)} />
        </label>
        <label>
          <span>班级 ID</span>
          <input value={classId} onChange={(event) => setClassId(event.target.value)} />
        </label>
        <label>
          <span>Rubric ID</span>
          <input value={rubricId} onChange={(event) => setRubricId(event.target.value)} />
        </label>
        <label className="assignment-description-field">
          <span>项目说明</span>
          <textarea
            rows={2}
            value={description}
            placeholder="目标、提交范围、评分关注点"
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
      </div>
      <div className="assignment-list">
        {assignments.map((assignment) => (
          <button
            key={assignment.assignment_id}
            className={assignment.assignment_id === currentAssignmentId ? "active" : ""}
            onClick={() => onSelectAssignment(assignment.assignment_id)}
          >
            <strong>{assignment.title}</strong>
            <span>
              {assignment.course_name} · {assignment.class_name}
            </span>
            <small>{assignment.submitted_count} 份已分析</small>
          </button>
        ))}
      </div>
    </section>
  );
}

type UploadAssignmentContext = {
  assignment_id?: string;
  title: string;
  course_id?: string;
  course_name: string;
  class_id?: string;
  class_name: string;
};

function AssignmentArchiveUploader({
  assignment,
  variant,
  studentId,
  authorName,
  loading,
  result,
  onUpload,
}: {
  assignment: UploadAssignmentContext;
  variant: "student" | "teacher";
  studentId?: string;
  authorName?: string;
  loading: boolean;
  result: string | null;
  onUpload: (payload: AssignmentSubmissionPayload) => void;
}) {
  const projectTypeOptions: ProjectSourceOption[] = [
    {
      value: "个人作品",
      title: "个人作品",
      detail: "绑定个人项目、原型或作品主题",
    },
    {
      value: "课程项目",
      title: "课程项目",
      detail: "绑定课程实践、实验或阶段项目",
    },
    {
      value: "竞赛获奖作品",
      title: "竞赛获奖作品",
      detail: "绑定比赛、赛道或获奖项目",
    },
    {
      value: "双创项目",
      title: "双创项目",
      detail: "绑定创新创业项目方向",
    },
  ];
  const defaultProjectType = initialProjectTypeForContext(assignment);
  const defaultProjectContext = initialProjectContextForContext(assignment);
  const [sourceMode, setSourceMode] = useState<"zip" | "repo">("zip");
  const [assignmentTitle, setAssignmentTitle] = useState(assignment.title);
  const [projectType, setProjectType] = useState(defaultProjectType);
  const [projectContext, setProjectContext] = useState(defaultProjectContext);
  const [authors, setAuthors] = useState(authorName ?? "");
  const [teamRoles, setTeamRoles] = useState("");
  const [targetStudentId, setTargetStudentId] = useState(studentId ?? "");
  const [description, setDescription] = useState("");
  const [archive, setArchive] = useState<File | null>(null);
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [draftStatus, setDraftStatus] = useState<string | null>(null);
  const [submittedDraftSignature, setSubmittedDraftSignature] = useState<string | null>(null);
  const draftKey = useMemo(
    () => projectUploadDraftKey(variant, studentId, assignment.assignment_id, assignment.title),
    [assignment.assignment_id, assignment.title, studentId, variant],
  );

  useEffect(() => {
    const draft = readProjectUploadDraft(draftKey);
    if (draft) {
      setSourceMode(draft.sourceMode);
      setAssignmentTitle(draft.assignmentTitle || assignment.title);
      setProjectType(draft.projectType || defaultProjectType);
      setProjectContext(draft.projectContext || defaultProjectContext);
      setAuthors(draft.authors || authorName || "");
      setTeamRoles(draft.teamRoles);
      setTargetStudentId(draft.targetStudentId || studentId || "");
      setDescription(draft.description);
      setRepositoryUrl(draft.repositoryUrl);
      setArchive(null);
      setDraftStatus(draft.archiveName ? `已恢复草稿，${draft.archiveName} 文件需重新选择` : "已恢复草稿");
      setSubmittedDraftSignature(null);
      return;
    }
    setSourceMode("zip");
    setAssignmentTitle(assignment.title);
    setProjectType(defaultProjectType);
    setProjectContext(defaultProjectContext);
    setAuthors(authorName ?? "");
    setTeamRoles("");
    setTargetStudentId(studentId ?? "");
    setDescription("");
    setArchive(null);
    setRepositoryUrl("");
    setDraftStatus(null);
    setSubmittedDraftSignature(null);
  }, [assignment.title, authorName, defaultProjectContext, defaultProjectType, draftKey, studentId]);

  const hasMeaningfulDraft = useMemo(() => {
    const archiveName = sourceMode === "zip" ? archive?.name ?? "" : "";
    return Boolean(
      sourceMode !== "zip" ||
        assignmentTitle.trim() !== assignment.title.trim() ||
        projectType !== defaultProjectType ||
        projectContext.trim() !== defaultProjectContext.trim() ||
        authors.trim() !== (authorName ?? "").trim() ||
        teamRoles.trim() ||
        targetStudentId.trim() !== (studentId ?? "").trim() ||
        description.trim() ||
        repositoryUrl.trim() ||
        archiveName,
    );
  }, [
    archive,
    assignment.title,
    assignmentTitle,
    authorName,
    authors,
    defaultProjectContext,
    defaultProjectType,
    description,
    projectContext,
    projectType,
    repositoryUrl,
    sourceMode,
    studentId,
    targetStudentId,
    teamRoles,
  ]);
  const draftSignature = useMemo(
    () =>
      JSON.stringify({
        sourceMode,
        assignmentTitle,
        projectType,
        projectContext,
        authors,
        teamRoles,
        targetStudentId,
        description,
        repositoryUrl,
        archiveName: sourceMode === "zip" ? archive?.name ?? "" : "",
      }),
    [
      archive,
      assignmentTitle,
      authors,
      description,
      projectContext,
      projectType,
      repositoryUrl,
      sourceMode,
      targetStudentId,
      teamRoles,
    ],
  );

  useEffect(() => {
    if (!hasMeaningfulDraft || submittedDraftSignature === draftSignature) return undefined;
    const timer = window.setTimeout(() => {
      writeProjectUploadDraft(draftKey, {
        sourceMode,
        assignmentTitle,
        projectType,
        projectContext,
        authors,
        teamRoles,
        targetStudentId,
        description,
        repositoryUrl,
        archiveName: sourceMode === "zip" ? archive?.name ?? "" : "",
        updatedAt: new Date().toISOString(),
      });
      setDraftStatus(sourceMode === "zip" && archive ? "草稿已保存，文件需重新选择" : "草稿已保存");
    }, 600);
    return () => window.clearTimeout(timer);
  }, [
    archive,
    assignmentTitle,
    authors,
    description,
    draftKey,
    draftSignature,
    hasMeaningfulDraft,
    projectContext,
    projectType,
    repositoryUrl,
    sourceMode,
    submittedDraftSignature,
    targetStudentId,
    teamRoles,
  ]);

  useEffect(() => {
    if (!result) return;
    removeProjectUploadDraft(draftKey);
    setDraftStatus("分析已提交，草稿已清空");
    setSubmittedDraftSignature(draftSignature);
  }, [draftKey, draftSignature, result]);

  useEffect(() => {
    if (!hasMeaningfulDraft || loading || submittedDraftSignature === draftSignature) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [draftSignature, hasMeaningfulDraft, loading, submittedDraftSignature]);

  function clearDraft() {
    removeProjectUploadDraft(draftKey);
    setSourceMode("zip");
    setAssignmentTitle(assignment.title);
    setProjectType(defaultProjectType);
    setProjectContext(defaultProjectContext);
    setAuthors(authorName ?? "");
    setTeamRoles("");
    setTargetStudentId(studentId ?? "");
    setDescription("");
    setArchive(null);
    setRepositoryUrl("");
    setDraftStatus("草稿已清空");
    setSubmittedDraftSignature(null);
  }

  const canSubmit =
    !loading &&
    (variant === "student" || targetStudentId.trim()) &&
    assignmentTitle.trim() &&
    projectType.trim() &&
    projectContext.trim() &&
    authors.trim() &&
    (sourceMode === "zip" ? archive : repositoryUrl.trim());
  const archiveTooLarge = Boolean(archive && archive.size > 5 * 1024 * 1024);
  const archiveInvalidType = Boolean(
    archive &&
      !archive.name.toLowerCase().endsWith(".zip") &&
      !["application/zip", "application/x-zip-compressed", "multipart/x-zip", "application/octet-stream"].includes(
        archive.type,
      ),
  );
  const repositoryUrlInvalid =
    sourceMode === "repo" &&
    repositoryUrl.trim().length > 0 &&
    !/^https?:\/\/.+/i.test(repositoryUrl.trim());
  function getValidationMessage() {
    if (sourceMode === "zip" && archiveTooLarge) {
      return "zip 文件超过 5MB，请压缩后重新上传。";
    }
    if (sourceMode === "zip" && archiveInvalidType) {
      return "请上传 .zip 格式的项目压缩包。";
    }
    if (repositoryUrlInvalid) {
      return "仓库链接需要以 http:// 或 https:// 开头。";
    }
    if (!assignmentTitle.trim()) return "请填写项目名称。";
    if (!projectContext.trim()) return "请填写绑定场景。";
    if (!authors.trim()) return "请填写项目作者。";
    if (variant === "teacher" && !targetStudentId.trim()) return "请填写学生 ID。";
    if (sourceMode === "zip" && !archive) return "请选择项目 zip 文件。";
    if (sourceMode === "repo" && !repositoryUrl.trim()) return "请填写项目仓库链接。";
    return null;
  }

  const validationMessage = getValidationMessage();
  const canSubmitValidated = Boolean(
    canSubmit && !archiveTooLarge && !archiveInvalidType && !repositoryUrlInvalid,
  );
  const uploadReadinessItems = [
    {
      label: "项目档案",
      ready: Boolean(assignmentTitle.trim() && projectType.trim() && projectContext.trim()),
      text: "项目名称、来源和绑定场景",
    },
    {
      label: "作者信息",
      ready: Boolean(authors.trim()),
      text: "项目作者和团队分工",
    },
    {
      label: sourceMode === "zip" ? "zip 文件" : "仓库链接",
      ready:
        sourceMode === "zip"
          ? Boolean(archive && !archiveTooLarge && !archiveInvalidType)
          : Boolean(repositoryUrl.trim() && !repositoryUrlInvalid),
      text: sourceMode === "zip" ? "5MB 内项目压缩包" : "公开可访问的 Git 仓库",
    },
  ];
  const uploadRuleItems =
    sourceMode === "zip"
      ? ["zip 最大 5MB", "单个文本文件不超过 200KB", "文本总量不超过 1MB", "最多分析 80 个文本文件"]
      : ["支持公开 Git 仓库", "自动忽略 .git/node_modules/venv", "单个文本文件不超过 200KB", "最多分析 80 个文本文件"];

  return (
    <section className={`panel upload-panel ${variant === "student" ? "student-upload-panel" : ""}`}>
      <div className="panel-header">
        <div>
          <span className="section-label">项目分析</span>
          <h2>{variant === "student" ? "项目入库并生成分析报告" : "录入学生项目资产"}</h2>
        </div>
        <span className="muted">
          {assignment.course_name} · {assignment.class_name}
        </span>
      </div>
      <div className="upload-stepper" aria-label="项目分析流程">
        <span className={assignmentTitle.trim() && authors.trim() ? "complete" : ""}>1 建立项目档案</span>
        <span
          className={
            sourceMode === "zip"
              ? archive && !archiveTooLarge
                ? "complete"
                : ""
              : repositoryUrl.trim() && !repositoryUrlInvalid
                ? "complete"
                : ""
          }
        >
          2 提交代码资产
        </span>
        <span className={result ? "complete" : ""}>3 生成分析报告</span>
      </div>
      <div className="upload-draft-bar" role="status" aria-live="polite">
        <div>
          <strong>{draftStatus ?? (hasMeaningfulDraft ? "入库草稿待保存" : "项目入库草稿")}</strong>
          <span>
            {sourceMode === "zip" && archive ? "文件需重新选择" : "表单字段自动保留"}
          </span>
        </div>
        <button type="button" onClick={clearDraft} disabled={loading || (!hasMeaningfulDraft && !draftStatus)}>
          清空草稿
        </button>
      </div>
      <div className="upload-readiness-panel" aria-label="项目提交准备">
        {uploadReadinessItems.map((item) => (
          <article className={item.ready ? "ready" : ""} key={item.label}>
            <strong>{item.label}</strong>
            <span>{item.text}</span>
          </article>
        ))}
      </div>
      <div className="upload-form">
        <div className="source-mode-toggle">
          {[
            ["zip", "zip 文件"],
            ["repo", "Git 仓库"],
          ].map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={sourceMode === mode ? "active" : ""}
              onClick={() => {
                const nextMode = mode as "zip" | "repo";
                setSourceMode(nextMode);
                if (nextMode === "repo") {
                  setArchive(null);
                  return;
                }
                setRepositoryUrl("");
              }}
              disabled={loading}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          <span>项目名称</span>
          <input
            value={assignmentTitle}
            onChange={(event) => setAssignmentTitle(event.target.value)}
          />
        </label>
        <div className="project-source-field">
          <span>项目来源</span>
          <div className="project-source-picker">
            {projectTypeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={projectType === option.value ? "active" : ""}
                onClick={() => setProjectType(option.value)}
                disabled={loading}
              >
                <strong>{option.title}</strong>
                <small>{option.detail}</small>
              </button>
            ))}
          </div>
        </div>
        <label>
          <span>绑定场景</span>
          <input
            value={projectContext}
            placeholder="课程名称、竞赛名称、个人作品主题或双创方向"
            onChange={(event) => setProjectContext(event.target.value)}
          />
        </label>
        <label>
          <span>项目作者</span>
          <input
            value={authors}
            placeholder={variant === "student" ? "项目作者或团队成员姓名" : "学生或团队成员姓名"}
            onChange={(event) => setAuthors(event.target.value)}
          />
        </label>
        {variant === "teacher" && (
          <label>
            <span>学生 ID</span>
            <input
              value={targetStudentId}
              placeholder="学号或系统 ID"
              onChange={(event) => setTargetStudentId(event.target.value)}
            />
          </label>
        )}
        <label className="upload-team-roles">
          <span>团队分工</span>
          <textarea
            value={teamRoles}
            onChange={(event) => setTeamRoles(event.target.value)}
            placeholder="成员职责与贡献说明"
            rows={2}
          />
        </label>
        <label className="upload-description">
          <span>项目说明</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={
              variant === "student"
                ? "补充运行方式、完成范围或特殊说明"
                : "补充项目背景或分析要求"
            }
            rows={3}
          />
        </label>
        {sourceMode === "zip" ? (
          <label className="file-picker">
            <span>{archive ? archive.name : "选择 zip 文件"}</span>
            {archive && <small>{formatFileSize(archive.size)}</small>}
            <input
              type="file"
              accept=".zip,application/zip"
              onChange={(event) => setArchive(event.target.files?.[0] ?? null)}
            />
          </label>
        ) : (
          <label className="upload-description">
            <span>仓库链接</span>
            <input
              value={repositoryUrl}
              placeholder="https://github.com/example/ai-project-demo.git"
              onChange={(event) => setRepositoryUrl(event.target.value)}
            />
          </label>
        )}
        <button
          onClick={() => {
            if (!canSubmitValidated) return;
            if (sourceMode === "zip" && !archive) return;
            if (sourceMode === "repo" && !repositoryUrl.trim()) return;
            const sourcePayload =
              sourceMode === "zip"
                ? { archive: archive ?? undefined }
                : { repositoryUrl: repositoryUrl.trim() };
            onUpload({
              assignmentId: assignment.assignment_id,
              assignmentTitle,
              courseId: assignment.course_id,
              classId: assignment.class_id,
              studentId: variant === "student" ? studentId ?? "" : targetStudentId,
              description,
              projectType,
              projectContext,
              authors,
              teamRoles,
              ...sourcePayload,
            });
          }}
          disabled={!canSubmitValidated}
        >
          {loading ? "分析中" : "提交分析"}
        </button>
      </div>
      {validationMessage && <p className="upload-validation">{validationMessage}</p>}
      {loading && (
        <div className="analysis-progress" role="status" aria-live="polite">
          <strong>正在分析项目资产</strong>
          <span>解析代码结构、项目文档、团队分工、能力证据和改进事项。</span>
          <i />
        </div>
      )}
      <div className="upload-rules">
        {uploadRuleItems.map((item) => (
          <span key={item}>{item}</span>
        ))}
        <span>{variant === "student" ? "生成项目分析报告" : "同步到教师看板"}</span>
        {result && <strong>{result}</strong>}
      </div>
    </section>
  );
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function projectProfileFromDescription(description: string | undefined, report: AssignmentReport) {
  const metadata = new Map<string, string>();
  for (const line of (description ?? "").split("\n")) {
    const [rawKey, ...rest] = line.split("：");
    const value = rest.join("：").trim();
    if (rawKey && value) {
      metadata.set(rawKey.trim(), value);
    }
  }
  return {
    type: metadata.get("项目来源") ?? metadata.get("项目类型") ?? "未标注来源",
    context:
      metadata.get("绑定场景") ??
      metadata.get("关联场景") ??
      report.course_name,
    authors: metadata.get("项目作者") ?? metadata.get("作者") ?? report.student_name,
    teamRoles: metadata.get("团队分工") ?? "",
  };
}

function projectSourceLabel(assignment: AssignmentItem) {
  const description = assignment.description ?? "";
  if (description.includes("竞赛获奖作品") || description.includes("竞赛作品")) return "竞赛作品";
  if (description.includes("个人作品") || description.includes("个人项目")) return "个人作品";
  if (description.includes("双创项目")) return "双创项目";
  if (description.includes("课程项目") || description.includes("课程作业")) return "课程项目";
  return "项目";
}

function projectMatchesSource(assignment: AssignmentItem, filter: ProjectSourceFilter) {
  if (filter === "all") return true;
  const source = projectSourceLabel(assignment);
  if (filter === "course") return source === "课程项目";
  if (filter === "competition") return source === "竞赛作品";
  if (filter === "personal") return source === "个人作品";
  return source === "双创项目";
}

function projectNextActionLabel(assignment: AssignmentItem) {
  return assignment.submitted_count > 0 ? "查看报告" : "提交材料";
}

function projectStateLabel(assignment: AssignmentItem) {
  return assignment.submitted_count > 0 ? "已分析" : "待分析";
}

function projectStateTone(assignment: AssignmentItem) {
  return assignment.submitted_count > 0 ? "ready" : "pending";
}

function ProjectNavigator({
  assignments,
  activeAssignmentId,
  loading,
  onSelectAssignment,
  onCreateProject,
}: {
  assignments: AssignmentItem[];
  activeAssignmentId?: string;
  loading: boolean;
  onSelectAssignment: (assignmentId: string) => void;
  onCreateProject?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<ProjectSourceFilter>("all");
  const analyzedCount = assignments.filter((assignment) => assignment.submitted_count > 0).length;
  const pendingCount = assignments.length - analyzedCount;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredAssignments = assignments.filter((assignment) => {
    const matchesQuery =
      !normalizedQuery ||
      [
        assignment.title,
        assignment.course_name,
        assignment.class_name,
        assignment.description,
        projectSourceLabel(assignment),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "analyzed" && assignment.submitted_count > 0) ||
      (statusFilter === "pending" && assignment.submitted_count === 0);
    return matchesQuery && matchesStatus && projectMatchesSource(assignment, sourceFilter);
  });

  return (
    <div className="project-navigator">
      <div className="project-navigator-head">
        <div>
          <strong>项目库</strong>
          <span>
            {assignments.length} 个项目 · {analyzedCount} 个已分析
          </span>
        </div>
        {onCreateProject && (
          <button type="button" onClick={onCreateProject}>
            新建项目
          </button>
        )}
      </div>
      <div className="project-navigator-search">
        <label>
          <span>搜索项目</span>
          <input
            value={query}
            placeholder="项目名、课程、竞赛或来源"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span>来源</span>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value as ProjectSourceFilter)}
          >
            <option value="all">全部来源</option>
            <option value="course">课程项目</option>
            <option value="competition">竞赛作品</option>
            <option value="personal">个人作品</option>
            <option value="venture">双创项目</option>
          </select>
        </label>
        <label>
          <span>状态</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ProjectStatusFilter)}
          >
            <option value="all">全部状态</option>
            <option value="analyzed">已分析</option>
            <option value="pending">待分析</option>
          </select>
        </label>
      </div>
      <div className="project-navigator-stats" aria-label="项目状态统计">
        <span>{filteredAssignments.length} 个匹配</span>
        <span>{analyzedCount} 个已分析</span>
        <span>{pendingCount} 个待分析</span>
      </div>
      <div className="project-switcher-list">
        {filteredAssignments.map((assignment) => (
          <button
            key={assignment.assignment_id}
            className={[
              assignment.assignment_id === activeAssignmentId ? "active" : "",
              `state-${projectStateTone(assignment)}`,
            ]
              .filter(Boolean)
              .join(" ")}
            type="button"
            disabled={loading}
            onClick={() => onSelectAssignment(assignment.assignment_id)}
          >
            <span className="project-switcher-title">{assignment.title}</span>
            <small>{projectSourceLabel(assignment)} · {assignment.course_name}</small>
            <span className="project-switcher-foot">
              <b>{projectStateLabel(assignment)}</b>
              <em>{projectNextActionLabel(assignment)}</em>
            </span>
          </button>
        ))}
        {!filteredAssignments.length && (
          <ActionEmptyState
            label="项目库"
            title="没有匹配的项目"
            text="调整关键词、来源或状态筛选后再查看。"
          />
        )}
      </div>
    </div>
  );
}

function ProjectStart({
  account,
  assignments,
  loading,
  result,
  onArchiveUpload,
  onSelectAssignment,
}: {
  account: SchoolAccount;
  assignments: AssignmentItem[];
  loading: boolean;
  result: string | null;
  onArchiveUpload: (payload: AssignmentSubmissionPayload) => void;
  onSelectAssignment: (assignmentId: string) => void;
}) {
  const defaultContext: UploadAssignmentContext = {
    title: "新的项目",
    course_id: scopeIdValue(account.authorized_courses),
    course_name: "个人项目",
    class_id: scopeIdValue(account.authorized_classes),
    class_name: readableScopeValue(account.authorized_classes, "个人空间"),
  };
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const selectedAssignment = assignments.find(
    (assignment) => assignment.assignment_id === selectedAssignmentId,
  );
  const selectedContext: UploadAssignmentContext | null = selectedAssignment
    ? {
        assignment_id: selectedAssignment.assignment_id,
        title: selectedAssignment.title,
        course_id: selectedAssignment.course_id,
        course_name: selectedAssignment.course_name,
        class_id: selectedAssignment.class_id,
        class_name: selectedAssignment.class_name,
      }
    : null;
  const uploadContext = selectedContext ?? defaultContext;
  const hasProjectShells = assignments.length > 0;

  return (
    <section className="project-start-workspace">
      <aside className="project-start-sidebar">
        <span className="section-label">项目管理</span>
        <h2>项目中心</h2>
        <p>
          上传代码、文档或仓库后，可绑定课程项目、竞赛获奖作品、个人作品或双创项目，并记录项目作者与团队分工。系统会分析项目材料，生成项目分析报告、能力证据和改进事项。
        </p>
        <div className="project-start-flow">
          <span>项目入库</span>
          <span>绑定来源与场景</span>
          <span>记录作者与分工</span>
          <span>生成分析报告</span>
        </div>
        {hasProjectShells && (
          <ProjectNavigator
            assignments={assignments}
            activeAssignmentId={selectedAssignmentId ?? undefined}
            loading={loading}
            onSelectAssignment={(assignmentId) => {
              const target = assignments.find((assignment) => assignment.assignment_id === assignmentId);
              if (target && target.submitted_count > 0) {
                onSelectAssignment(assignmentId);
                return;
              }
              setSelectedAssignmentId(assignmentId);
            }}
            onCreateProject={() => setSelectedAssignmentId(null)}
          />
        )}
      </aside>

      <section className="project-start-main">
        {selectedContext && (
          <InlineNotice
            label="已选择项目"
            text={`${selectedContext.title} 还没有分析报告，提交代码或仓库后会生成项目分析报告。`}
          />
        )}
        <AssignmentArchiveUploader
          assignment={uploadContext}
          variant="student"
          studentId={account.user_id}
          authorName={account.name}
          loading={loading}
          result={result}
          onUpload={onArchiveUpload}
        />
        <div className="project-start-support">
          <article>
            <span>资产来源</span>
            <strong>课程项目、竞赛获奖作品、个人作品、双创项目</strong>
          </article>
          <article>
            <span>分析对象</span>
            <strong>代码结构、文档质量、团队分工、能力证据</strong>
          </article>
          <article>
            <span>教师视图</span>
            <strong>教师可直接查看学生项目报告和班级学情</strong>
          </article>
        </div>
      </section>
    </section>
  );
}

function StudentReport({
  report,
  assignments,
  loading,
  averageScore,
  uploadLoading,
  uploadResult,
  exportLoading,
  exportResult,
  taskSaving,
  onSelectAssignment,
  onExportReport,
  onArchiveUpload,
  onSaveTaskFromProject,
}: {
  report: AssignmentReport;
  assignments: AssignmentItem[];
  loading: boolean;
  averageScore: number;
  uploadLoading: boolean;
  uploadResult: string | null;
  exportLoading: boolean;
  exportResult: string | null;
  taskSaving: boolean;
  onSelectAssignment: (assignmentId: string) => void;
  onExportReport: () => void;
  onArchiveUpload: (payload: AssignmentSubmissionPayload) => void;
  onSaveTaskFromProject: (payload: SaveTaskPayload) => void;
}) {
  const highPriorityFindings = report.findings.filter((finding) => finding.severity === "high").length;
  const primaryFinding = report.findings[0];
  const strongestScore = [...report.scores].sort((left, right) => right.score - left.score)[0];
  const weakestScore = [...report.scores].sort((left, right) => left.score - right.score)[0];
  const taskDueDate = nextDateString(7);
  const currentAssignment =
    assignments.find((assignment) => assignment.assignment_id === report.assignment_id) ?? {
      assignment_id: report.assignment_id,
      title: report.assignment_title,
      course_id: report.course_id,
      course_name: report.course_name,
      class_id: report.class_id,
      class_name: report.class_name,
      description: "",
      created_at: report.generated_at,
      submitted_count: 1,
      access_scope: report.access_scope,
    };
  const projectProfile = projectProfileFromDescription(currentAssignment.description, report);
  const currentProjectState = projectStateLabel(currentAssignment);
  const currentProjectAction = highPriorityFindings > 0 ? "处理高优先级问题" : "继续完善项目材料";
  const [activeSection, setActiveSection] = useState<ProjectSection>("assets");
  const [uploadContext, setUploadContext] = useState<UploadAssignmentContext | null>(null);
  const projectSections = [
    {
      id: "assets",
      label: "项目资产",
      summary: "来源、项目作者与团队分工",
      status: `${assignments.length} 个项目`,
    },
    {
      id: "submit",
      label: "项目入库",
      summary: "提交代码、文档或仓库",
      status: uploadLoading ? "分析中" : "可提交",
    },
    {
      id: "report",
      label: "分析报告",
      summary: "评分、结构与问题定位",
      status: `${averageScore} 分`,
    },
    {
      id: "evidence",
      label: "证据追踪",
      summary: "代码片段与分析过程",
      status: `${report.evidence_snippets.length} 条`,
    },
    {
      id: "tasks",
      label: "改进任务",
      summary: "下一步修复和完善",
      status: `${report.improvement_tasks.length} 项`,
    },
  ] as const;

  useEffect(() => {
    if (uploadResult) {
      setActiveSection("report");
    }
  }, [uploadResult]);

  const selectedUploadContext = uploadContext ?? currentAssignment;

  return (
    <>
      <section className="project-workspace">
        <aside className="project-sidebar-panel">
          <div className="project-sidebar-head">
            <div>
              <span className="section-label">当前项目</span>
              <h2>{report.assignment_title}</h2>
            </div>
            <strong>{averageScore}</strong>
          </div>
          <p>{report.summary}</p>
          <div className="project-focus-strip">
            <span>{currentProjectState}</span>
            <strong>{currentProjectAction}</strong>
            <small>{highPriorityFindings} 个高优先级问题 · {report.improvement_tasks.length} 项改进任务</small>
          </div>
          <div className="project-meta-list">
            <span>{projectProfile.type}</span>
            <span>{projectProfile.context}</span>
            <span>{projectProfile.authors}</span>
            <span>{report.generated_at}</span>
          </div>
          {projectProfile.teamRoles && (
            <div className="project-profile-note">
              <strong>团队分工</strong>
              <p>{projectProfile.teamRoles}</p>
            </div>
          )}
          <div className="project-health-grid">
            <article>
              <span>待处理问题</span>
              <strong>{report.findings.length}</strong>
            </article>
            <article>
              <span>高优先级</span>
              <strong>{highPriorityFindings}</strong>
            </article>
            <article>
              <span>文件数量</span>
              <strong>{report.code_structure.file_count}</strong>
            </article>
            <article>
              <span>证据片段</span>
              <strong>{report.evidence_snippets.length}</strong>
            </article>
          </div>
          {assignments.length > 0 && (
            <ProjectNavigator
              assignments={assignments}
              activeAssignmentId={report.assignment_id}
              loading={loading}
              onSelectAssignment={(assignmentId) => {
                setUploadContext(null);
                onSelectAssignment(assignmentId);
              }}
              onCreateProject={() => {
                setUploadContext({
                  title: "新的项目",
                  course_id: report.course_id,
                  course_name: report.course_name || "个人项目",
                  class_id: report.class_id,
                  class_name: report.class_name || "个人空间",
                });
                setActiveSection("submit");
              }}
            />
          )}
        </aside>

        <section className="project-main-panel">
          <div className="project-topline">
            <div>
              <span className="section-label">项目管理</span>
              <h2>项目工作区</h2>
            </div>
            <div className="project-topline-actions">
              <div className="project-topline-summary">
                <span>优势：{strongestScore?.dimension ?? "待补充"}</span>
                <span>优先补齐：{weakestScore?.dimension ?? "待补充"}</span>
              </div>
              <button type="button" onClick={onExportReport} disabled={exportLoading}>
                {exportLoading ? "导出中" : "下载报告"}
              </button>
            </div>
          </div>
          {exportResult && <InlineNotice label="报告已生成" text={exportResult} />}
          <div className="project-section-nav" role="tablist" aria-label="项目管理分区">
            {projectSections.map((section) => (
              <button
                key={section.id}
                className={activeSection === section.id ? "active" : ""}
                onClick={() => setActiveSection(section.id)}
                type="button"
              >
                <strong>{section.label}</strong>
                <span>{section.summary}</span>
                <small>{section.status}</small>
              </button>
            ))}
          </div>

          {activeSection === "assets" && (
            <div className="project-section-body">
              <section className="project-assets-grid">
                <article className="project-identity-card">
                  <span>项目来源</span>
                  <strong>{projectProfile.type}</strong>
                  <p>{report.assignment_title}</p>
                </article>
                <article className="project-identity-card">
                  <span>绑定场景</span>
                  <strong>{projectProfile.context}</strong>
                  <p>{report.course_name} · {report.class_name}</p>
                </article>
                <article className="project-identity-card">
                  <span>项目作者</span>
                  <strong>{projectProfile.authors}</strong>
                  <p>{report.student_name}</p>
                </article>
                <article className="project-identity-card">
                  <span>综合评分</span>
                  <strong>{averageScore}</strong>
                  <p>基于项目证据生成</p>
                </article>
              </section>

              <section className="project-asset-layout">
                <article className="panel wide">
                  <div className="panel-header">
                    <div>
                      <span className="section-label">项目分析状态</span>
                      <h2>项目材料、报告与能力证据</h2>
                    </div>
                    <span className="muted">{report.generated_at}</span>
                  </div>
                  <div className="project-status-lane">
                    <div>
                      <span>材料解析</span>
                      <strong>{report.code_structure.file_count} 个文件</strong>
                      <small>{report.code_structure.detected_frameworks.join(" / ") || "待识别框架"}</small>
                    </div>
                    <div>
                      <span>问题定位</span>
                      <strong>{report.findings.length} 条</strong>
                      <small>{primaryFinding?.title ?? "暂无高优先级问题"}</small>
                    </div>
                    <div>
                      <span>能力证据</span>
                      <strong>{report.capability_evidence.length} 组</strong>
                      <small>{strongestScore?.dimension ?? "待补充"}</small>
                    </div>
                    <div>
                      <span>改进任务</span>
                      <strong>{report.improvement_tasks.length} 项</strong>
                      <small>{weakestScore?.dimension ?? "待补齐"}</small>
                    </div>
                  </div>
                </article>

                <article className="panel">
                  <span className="section-label">团队分工</span>
                  {projectProfile.teamRoles ? (
                    <p className="project-team-copy">{projectProfile.teamRoles}</p>
                  ) : (
                    <ActionEmptyState
                      label="团队信息"
                      title="暂未记录团队分工"
                      text="再次提交项目资产时可补充项目作者与团队角色，报告会同步展示。"
                    />
                  )}
                  <div className="project-quick-actions">
                    <button type="button" onClick={() => setActiveSection("submit")}>
                      提交新资产
                    </button>
                    <button type="button" onClick={() => setActiveSection("report")}>
                      查看报告
                    </button>
                    <button type="button" onClick={() => setActiveSection("tasks")}>
                      改进事项
                    </button>
                  </div>
                </article>
              </section>
            </div>
          )}

          {activeSection === "submit" && (
            <div className="project-section-body">
              <AssignmentArchiveUploader
                assignment={selectedUploadContext}
                variant="student"
                studentId={report.student_id}
                authorName={report.student_name}
                loading={uploadLoading}
                result={uploadResult}
                onUpload={onArchiveUpload}
              />
              <div className="project-submit-guide">
                <article>
                  <span>可绑定</span>
                  <strong>课程项目 / 竞赛获奖作品 / 个人作品 / 双创项目</strong>
                  <p>入库时填写绑定场景、项目作者和团队分工，系统会把这些信息纳入项目分析报告和画像证据。</p>
                </article>
                <article>
                  <span>分析范围</span>
                  <strong>代码结构、质量问题、能力证据</strong>
                  <p>支持 zip 与公开 Git 仓库，完成后自动进入项目分析报告。</p>
                </article>
              </div>
            </div>
          )}

          {activeSection === "report" && (
            <div className="project-section-body">
              <InlineNotice label="评分口径" text="基于提交物证据形成的相对画像，用于定位改进方向。" />
              <section className="code-structure-panel compact">
                <div>
                  <span className="section-label">代码结构摘要</span>
                  <strong>{report.code_structure.file_count} 个文件</strong>
                </div>
                <StructureGroup label="入口" values={report.code_structure.entry_files} />
                <StructureGroup label="测试" values={report.code_structure.test_files} />
                <StructureGroup label="文档" values={report.code_structure.documentation_files} />
                <StructureGroup label="配置" values={report.code_structure.config_files} />
                <StructureGroup label="框架" values={report.code_structure.detected_frameworks} />
                <StructureGroup label="能力信号" values={report.code_structure.detected_capabilities} />
                <StructureGroup label="风险信号" values={report.code_structure.risk_signals} tone="warning" />
              </section>
              <section className="project-report-grid">
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
              </section>
            </div>
          )}

          {activeSection === "evidence" && (
            <div className="project-section-body">
              <section className="panel analysis-trace-panel">
                <div className="panel-header">
                  <div>
                    <span className="section-label">分析过程</span>
                    <h2>从文件解析到报告生成的分阶段轨迹</h2>
                  </div>
                  <span className="muted">{report.analysis_trace.length} 个分析节点</span>
                </div>
                <div className="analysis-trace-list">
                  {report.analysis_trace.map((step, index) => (
                    <article className="analysis-trace-step" key={step.node}>
                      <b>{index + 1}</b>
                      <div>
                        <strong>{step.title}</strong>
                        <span>{step.summary}</span>
                        <div>
                          {step.evidence.slice(0, 3).map((item) => (
                            <small key={item}>{item}</small>
                          ))}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
              <section className="project-report-grid">
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
                <article className="panel wide">
                  <div className="panel-header">
                    <div>
                      <span className="section-label">代码证据片段</span>
                      <h2>关联到具体文件、模块和代码行</h2>
                    </div>
                    <span className="muted">共 {report.evidence_snippets.length} 条</span>
                  </div>
                  <div className="snippet-grid">
                    {report.evidence_snippets.map((snippet) => (
                      <article
                        className="snippet-card"
                        key={`${snippet.path}-${snippet.line_start}-${snippet.capability}`}
                      >
                        <div>
                          <strong>{snippet.capability}</strong>
                          <span>
                            {snippet.path} · {snippet.module} · L{snippet.line_start}
                          </span>
                        </div>
                        <code>{snippet.snippet}</code>
                      </article>
                    ))}
                  </div>
                </article>
              </section>
            </div>
          )}

          {activeSection === "tasks" && (
            <div className="project-section-body">
              <section className="project-task-board">
                <article className="project-priority-card">
                  <span>当前优先处理</span>
                  <strong>{primaryFinding?.title ?? "暂无高优先级问题"}</strong>
                  <p>{primaryFinding?.suggestion ?? "继续完善项目说明、测试记录和可复现材料。"}</p>
                </article>
                <article className="panel">
                  <div className="panel-header">
                    <div>
                      <span className="section-label">下一步任务</span>
                      <h2>保存到计划执行</h2>
                    </div>
                    <span className="muted">建议截止 {taskDueDate}</span>
                  </div>
                  <div className="project-task-save-list">
                    {report.improvement_tasks.map((task, index) => (
                      <article key={task}>
                        <div>
                          <strong>{task}</strong>
                          <span>{index === 0 ? "高优先级" : "中优先级"} · {report.assignment_title}</span>
                        </div>
                        <button
                          type="button"
                          disabled={taskSaving}
                          onClick={() =>
                            onSaveTaskFromProject({
                              title: task,
                              source: `项目分析：${report.assignment_title}`,
                              priority: index === 0 ? "high" : "medium",
                              due_date: taskDueDate,
                              evidence_required: `提交 ${report.assignment_title} 的修订记录、代码链接或截图`,
                            })
                          }
                        >
                          {taskSaving ? "保存中" : "保存事项"}
                        </button>
                      </article>
                    ))}
                  </div>
                </article>
              </section>
            </div>
          )}
        </section>
      </section>
    </>
  );
}

function InlineNotice({ label, text }: { label: string; text: string }) {
  return (
    <div className="ai-notice" role="note">
      <strong>{label}</strong>
      <span>{text}</span>
    </div>
  );
}

function NoticeStack({
  notices,
  onDismiss,
}: {
  notices: AppNotice[];
  onDismiss: (id: number) => void;
}) {
  if (!notices.length) return null;
  return (
    <div className="notice-stack" role="status" aria-label="系统通知">
      {notices.map((notice) => (
        <article className={`notice-card ${notice.tone}`} key={notice.id}>
          <div>
            <strong>{notice.title}</strong>
            {notice.text && <span>{notice.text}</span>}
          </div>
          <button type="button" onClick={() => onDismiss(notice.id)} aria-label="关闭通知">
            关闭
          </button>
        </article>
      ))}
    </div>
  );
}

function ConfirmDialog({
  dialog,
  loading,
  onCancel,
  onConfirm,
}: {
  dialog: ConfirmDialogState | null;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!dialog) return null;
  return (
    <div className="confirm-dialog-backdrop" role="presentation">
      <section
        className={`confirm-dialog ${dialog.tone === "danger" ? "danger" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={dialog.title}
      >
        <div>
          <span className="section-label">操作确认</span>
          <h2>{dialog.title}</h2>
          <p>{dialog.text}</p>
        </div>
        <footer>
          <button type="button" onClick={onCancel} disabled={loading}>
            取消
          </button>
          <button type="button" onClick={onConfirm} disabled={loading}>
            {loading ? "处理中" : dialog.confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}

function StructureGroup({
  label,
  values,
  tone = "default",
}: {
  label: string;
  values: string[];
  tone?: "default" | "warning";
}) {
  return (
    <div className="structure-group">
      <span>{label}</span>
      <div>
        {values.length ? (
          values.slice(0, 4).map((value) => (
            <small className={tone === "warning" ? "warning" : undefined} key={value}>
              {value}
            </small>
          ))
        ) : (
          <small>未识别</small>
        )}
      </div>
    </div>
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

function KnowledgeAssistant({
  question,
  response,
  loading,
  history,
  onQuestionChange,
  onAsk,
  onClear,
}: {
  question: string;
  response: ChatResponse | null;
  loading: boolean;
  history: ChatMessage[];
  onQuestionChange: (question: string) => void;
  onAsk: (question?: string) => void;
  onClear: () => void;
}) {
  const quickQuestions = ["如何准备算法竞赛？", "这个项目应该先改哪里？", "AI 应用开发第一个项目做什么？"];
  const queryScenarios = [
    {
      label: "项目改进",
      question: "我的项目已经能运行，下一步应该优先补哪些工程能力？",
      scope: "项目案例 / Rubric / 工程规范",
    },
    {
      label: "竞赛准备",
      question: "如果目标是蓝桥杯和计算机设计大赛，应该怎么安排四周准备？",
      scope: "竞赛资料 / 准备计划 / 能力短板",
    },
    {
      label: "课程学习",
      question: "数据结构基础薄弱，怎么补到能支撑项目开发？",
      scope: "课程资料 / 知识点 / 项目练习",
    },
  ];
  const turns = history.length
    ? history
    : response
      ? [{ role: "assistant", content: response.answer } satisfies ChatMessage]
      : [];
  const citations = response?.citations ?? [];
  const turnCount = Math.floor(history.length / 2);
  const citationStatus =
    loading ? "检索中" : response?.is_uncertain ? "资料不足" : citations.length ? `${citations.length} 条引用` : "待检索";
  const retrievalStatus =
    loading ? "检索中" : response?.retrieval_status === "matched" ? "已命中资料" : "待检索";
  const activeScope = response?.context_summary ?? "课程资料、竞赛资料、项目案例";
  const answerBasisItems = [
    {
      label: "资料命中",
      value: loading ? "检索中" : response?.retrieval_status === "matched" ? "已命中" : "未命中",
      ready: Boolean(response?.retrieval_status === "matched"),
    },
    {
      label: "引用数量",
      value: `${citations.length} 条`,
      ready: citations.length > 0,
    },
    {
      label: "回答状态",
      value: loading ? "生成中" : response?.is_uncertain ? "需要补充资料" : response ? "可追溯" : "待提问",
      ready: Boolean(response && !response.is_uncertain),
    },
  ];

  return (
    <section className="knowledge-workspace">
      <div className="knowledge-chat-panel">
        <header className="knowledge-chat-head">
          <div>
            <span className="section-label">学科知识库</span>
            <h2>围绕课程、项目、竞赛和案例给出可追溯回答</h2>
          </div>
          <div className="knowledge-status-strip">
            <span>{response?.context_summary ?? "等待你的问题"}</span>
            <span>{retrievalStatus}</span>
          </div>
        </header>

        <div className="knowledge-session-bar" aria-label="问答会话概览">
          <div>
            <span>当前会话</span>
            <strong>{turnCount} 轮问答</strong>
          </div>
          <div>
            <span>引用状态</span>
            <strong>{citationStatus}</strong>
          </div>
          <div>
            <span>检索范围</span>
            <strong>{activeScope}</strong>
          </div>
          <button type="button" onClick={onClear} disabled={loading || (!history.length && !response && !question.trim())}>
            清空对话
          </button>
        </div>

        <div className="knowledge-basis-panel" aria-label="回答依据检查">
          {answerBasisItems.map((item) => (
            <article className={item.ready ? "ready" : ""} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
          <p>
            {response?.is_uncertain
              ? "当前知识库资料不足，建议换用更具体的问题，或在知识库管理中补充课程、竞赛或项目案例资料。"
              : response
                ? "回答会优先基于知识库命中资料，并在右侧保留引用来源。"
                : "提问后系统会先检索知识库，再生成带引用的回答。"}
          </p>
        </div>

        {!turns.length && (
          <div className="knowledge-scenario-grid" aria-label="常用检索场景">
            {queryScenarios.map((scenario) => (
              <button
                key={scenario.label}
                type="button"
                onClick={() => onQuestionChange(scenario.question)}
              >
                <strong>{scenario.label}</strong>
                <span>{scenario.scope}</span>
                <small>{scenario.question}</small>
              </button>
            ))}
          </div>
        )}

        <div className="knowledge-thread" aria-live="polite">
          {turns.length ? (
            turns.map((message, index) => (
              <article
                className={`knowledge-message ${message.role}`}
                key={`${message.role}-${index}-${message.content.slice(0, 16)}`}
              >
                <span>{message.role === "user" ? "提问" : "回答"}</span>
                {message.content.split("\n").map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </article>
            ))
          ) : (
            <div className="knowledge-empty-state">
              <strong>从一个具体问题开始</strong>
              <p>可以询问课程知识、项目改进、竞赛准备、组队方向或知识库里的案例材料。</p>
            </div>
          )}
          {loading && (
            <article className="knowledge-message assistant loading">
              <span>回答</span>
              <p>正在检索知识库并整理可追溯回答...</p>
            </article>
          )}
        </div>

        <div className="knowledge-input-bar">
          <input
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            placeholder="课程、项目、竞赛或案例问题"
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
      </div>

      <aside className="knowledge-side-panel">
        <section className="knowledge-side-card">
          <div className="panel-header">
            <div>
              <span className="section-label">快捷问题</span>
              <h2>继续追问</h2>
            </div>
            <span className="muted">上下文 {Math.floor(history.length / 2)} 轮</span>
          </div>
          <div className="quick-questions">
            {(response?.suggested_next_questions.length
              ? response.suggested_next_questions
              : quickQuestions
            ).map((quickQuestion) => (
              <button key={quickQuestion} onClick={() => onAsk(quickQuestion)}>
                {quickQuestion}
              </button>
            ))}
          </div>
        </section>

        <section className="knowledge-side-card">
          <span className="section-label">引用来源</span>
          <div className="citation-list">
            {response?.is_uncertain && (
              <div className="citation-card citation-card-warning">
                <strong>资料不足</strong>
                <span>未命中</span>
                <p>当前知识库没有找到可引用资料。</p>
              </div>
            )}
            {citations.map((citation) => (
              <div className="citation-card" key={`${citation.title}-${citation.source_type}`}>
                <strong>{citation.title}</strong>
                <span>
                  {citation.source_type} · {citation.path} · {citation.updated_at}
                </span>
                <p>{citation.snippet}</p>
              </div>
            ))}
            {!response && <p className="muted">等待检索结果。</p>}
          </div>
        </section>
      </aside>
    </section>
  );
}

function BasicProfileEditor({
  profile,
  saving,
  onSave,
}: {
  profile: GrowthProfile;
  saving: boolean;
  onSave: (payload: BasicProfilePayload) => void;
}) {
  const summary = profile.profile_summary;
  const [studentName, setStudentName] = useState(profile.student_name);
  const [grade, setGrade] = useState(summary?.grade ?? "大二");
  const [major, setMajor] = useState(summary?.major ?? "计算机科学与技术");
  const [targetDirection, setTargetDirection] = useState(
    summary?.target_direction ?? profile.target_path,
  );
  const [weeklyHours, setWeeklyHours] = useState(summary?.weekly_hours ?? 8);
  const [courseFoundation, setCourseFoundation] = useState(
    joinProfileItems(summary?.course_foundation ?? ["程序设计基础", "数据结构"]),
  );
  const [skillTags, setSkillTags] = useState(
    joinProfileItems(summary?.skill_tags ?? ["Flask", "RAG"]),
  );
  const [projectExperiences, setProjectExperiences] = useState(
    joinProfileItems(summary?.project_experiences ?? ["课程项目", "个人作品"]),
  );
  const [competitionExperiences, setCompetitionExperiences] = useState(
    joinProfileItems(summary?.competition_experiences ?? []),
  );
  const [githubUrl, setGithubUrl] = useState(summary?.github_url ?? "");

  useEffect(() => {
    setStudentName(profile.student_name);
    setGrade(summary?.grade ?? "大二");
    setMajor(summary?.major ?? "计算机科学与技术");
    setTargetDirection(summary?.target_direction ?? profile.target_path);
    setWeeklyHours(summary?.weekly_hours ?? 8);
    setCourseFoundation(joinProfileItems(summary?.course_foundation ?? ["程序设计基础", "数据结构"]));
    setSkillTags(joinProfileItems(summary?.skill_tags ?? ["Flask", "RAG"]));
    setProjectExperiences(joinProfileItems(summary?.project_experiences ?? ["课程项目", "个人作品"]));
    setCompetitionExperiences(joinProfileItems(summary?.competition_experiences ?? []));
    setGithubUrl(summary?.github_url ?? "");
  }, [profile.student_id, profile.student_name, profile.target_path, summary]);

  const skillTagList = splitProfileItems(skillTags);
  const canSave =
    studentName.trim() &&
    grade.trim() &&
    major.trim() &&
    targetDirection.trim() &&
    weeklyHours > 0;

  return (
    <section className="basic-profile-editor">
      <div className="basic-profile-editor-head">
        <div>
          <span className="section-label">基础画像</span>
          <h3>完善学习目标与能力证据</h3>
        </div>
        <span>{summary ? "已保存" : "待完善"}</span>
      </div>
      <div className="profile-form-grid">
        <label>
          <span>姓名</span>
          <input value={studentName} onChange={(event) => setStudentName(event.target.value)} />
        </label>
        <label>
          <span>年级</span>
          <input value={grade} onChange={(event) => setGrade(event.target.value)} />
        </label>
        <label>
          <span>专业</span>
          <input value={major} onChange={(event) => setMajor(event.target.value)} />
        </label>
        <label>
          <span>每周投入</span>
          <input
            min={1}
            max={40}
            type="number"
            value={weeklyHours}
            onChange={(event) => setWeeklyHours(Number(event.target.value))}
          />
        </label>
      </div>
      <label className="profile-form-field">
        <span>目标方向</span>
        <input
          value={targetDirection}
          onChange={(event) => setTargetDirection(event.target.value)}
        />
      </label>
      <label className="profile-form-field">
        <span>课程基础</span>
        <textarea
          rows={2}
          value={courseFoundation}
          onChange={(event) => setCourseFoundation(event.target.value)}
        />
      </label>
      <label className="profile-form-field">
        <span>技能标签</span>
        <textarea rows={2} value={skillTags} onChange={(event) => setSkillTags(event.target.value)} />
      </label>
      {skillTagList.length > 0 && (
        <div className="profile-tag-preview">
          {skillTagList.slice(0, 8).map((tag) => (
            <small key={tag}>{tag}</small>
          ))}
        </div>
      )}
      <label className="profile-form-field">
        <span>项目经历</span>
        <textarea
          rows={2}
          value={projectExperiences}
          onChange={(event) => setProjectExperiences(event.target.value)}
        />
      </label>
      <label className="profile-form-field">
        <span>竞赛经历</span>
        <textarea
          rows={2}
          value={competitionExperiences}
          onChange={(event) => setCompetitionExperiences(event.target.value)}
        />
      </label>
      <label className="profile-form-field">
        <span>代码仓库</span>
        <input value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} />
      </label>
      <button
        type="button"
        disabled={saving || !canSave}
        onClick={() =>
          onSave({
            student_name: studentName.trim(),
            grade: grade.trim(),
            major: major.trim(),
            course_foundation: splitProfileItems(courseFoundation),
            target_direction: targetDirection.trim(),
            weekly_hours: Math.max(1, Math.min(40, weeklyHours || 1)),
            skill_tags: skillTagList,
            project_experiences: splitProfileItems(projectExperiences),
            competition_experiences: splitProfileItems(competitionExperiences),
            github_url: githubUrl.trim() || null,
          })
        }
      >
        {saving ? "保存中" : "保存画像"}
      </button>
    </section>
  );
}

function GrowthPath({
  profile,
  profileEvidence,
  plan,
  competitionCatalog,
  competitions,
  competitionPreparation,
  team,
  teamRequest,
  teamStatus,
  taskList,
  review,
  initialSection,
  planRevisionLoading,
  teamStatusLoading,
  taskLoading,
  taskStatusUpdatingId,
  taskSaveResult,
  planCreateLoading,
  onRevisePlan,
  onOpenProfile,
  onGeneratePlan,
  onGenerateCompetition,
  onGenerateTeam,
  onUpdateTeamStatus,
  onSaveTask,
  onUpdateTaskStatus,
  onGenerateReview,
}: {
  profile: GrowthProfile;
  profileEvidence: ProfileEvidence | null;
  plan: LearningPlan | null;
  competitionCatalog: CompetitionCatalogResponse;
  competitions: CompetitionRecommendResponse | null;
  competitionPreparation: CompetitionPreparationPlan | null;
  team: TeamRecommendResponse | null;
  teamRequest: TeamRequestCard | null;
  teamStatus: TeamPoolStatus;
  taskList: TaskListResponse | null;
  review: ReviewResponse | null;
  initialSection: GrowthSection;
  planRevisionLoading: boolean;
  teamStatusLoading: boolean;
  taskLoading: boolean;
  taskStatusUpdatingId: string | null;
  taskSaveResult: string | null;
  planCreateLoading: boolean;
  onRevisePlan: (feedback: string) => void;
  onOpenProfile: () => void;
  onGeneratePlan: () => void;
  onGenerateCompetition: () => void;
  onGenerateTeam: () => void;
  onUpdateTeamStatus: (enabled: boolean) => void;
  onSaveTask: (payload: SaveTaskPayload) => Promise<LearningTask>;
  onUpdateTaskStatus: (taskId: string, status: "todo" | "doing" | "done") => void;
  onGenerateReview: (payload: ReviewGeneratePayload) => void;
}) {
  const [activeSection, setActiveSection] = useState<GrowthSection>(initialSection);
  const [planFeedbackDraft, setPlanFeedbackDraft] = useState("");
  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);
  const profileAverage = profile.dimensions.length
    ? Math.round(
        profile.dimensions.reduce((sum, dimension) => sum + dimension.score, 0) /
          profile.dimensions.length,
      )
    : 0;
  const strongestDimension = [...profile.dimensions]
    .sort((left, right) => right.score - left.score)[0];
  const weakestDimension = [...profile.dimensions]
    .sort((left, right) => left.score - right.score)[0];
  const growthSections: Array<{
    id: GrowthSection;
    label: string;
    summary: string;
    status: string;
    action: string;
  }> = [
    {
      id: "profile",
      label: "能力画像",
      summary: "维度、证据、风险与优势",
      status: `${profile.dimensions.length} 个维度`,
      action: "查看画像",
    },
    {
      id: "plan",
      label: "学习计划",
      summary: "目标拆解与计划调整",
      status: plan ? `${plan.weeks} 周` : "待生成",
      action: plan ? "查看计划" : "生成计划",
    },
    {
      id: "competition",
      label: "竞赛准备",
      summary: "竞赛清单、推荐与准备计划",
      status: competitions ? `${competitions.recommendations.length} 个推荐` : "待生成",
      action: competitions ? "查看推荐" : "生成推荐",
    },
    {
      id: "team",
      label: "组队协作",
      summary: "组队需求与队友推荐",
      status: team ? `${team.candidates.length} 位候选` : "待生成",
      action: team ? "查看队友" : "创建需求",
    },
    {
      id: "execution",
      label: "计划执行",
      summary: "任务保存与阶段反馈",
      status: taskList ? `${taskList.completed}/${taskList.total}` : "待记录",
      action: "查看事项",
    },
  ];
  const activeSectionMeta =
    growthSections.find((section) => section.id === activeSection) ?? growthSections[0];
  const activeSectionIndex = growthSections.findIndex((section) => section.id === activeSection);
  const renderGrowthPrimaryAction = () => {
    if (activeSection === "profile") {
      return (
        <button type="button" onClick={onOpenProfile}>
          维护个人资料
        </button>
      );
    }
    if (activeSection === "plan") {
      return (
        <button type="button" onClick={onGeneratePlan} disabled={planCreateLoading}>
          {planCreateLoading ? "生成中" : plan ? "更新学习计划" : "生成学习计划"}
        </button>
      );
    }
    if (activeSection === "competition") {
      return (
        <button type="button" onClick={onGenerateCompetition} disabled={planRevisionLoading}>
          {planRevisionLoading ? "生成中" : "更新竞赛建议"}
        </button>
      );
    }
    if (activeSection === "team") {
      return (
        <button type="button" onClick={onGenerateTeam} disabled={teamStatusLoading}>
          {teamStatusLoading ? "生成中" : "更新组队推荐"}
        </button>
      );
    }
    return (
      <button type="button" onClick={() => setActiveSection("plan")}>
        查看学习计划
      </button>
    );
  };
  const canSubmitPlanFeedback = Boolean(planFeedbackDraft.trim() && !planRevisionLoading);
  function submitPlanFeedback(feedback: string) {
    const value = feedback.trim();
    if (!value) return;
    onRevisePlan(value);
    setPlanFeedbackDraft("");
  }

  const renderProfileSection = () => (
    <section className="panel-grid">
      <article className="panel wide">
        <span className="section-label">画像维度</span>
        <div className="score-list">
          {profile.dimensions.map((dimension) => (
            <div className="score-detail" key={dimension.dimension}>
              <ScoreBar label={dimension.dimension} score={dimension.score} />
              <p>{dimension.summary}</p>
              <div className="profile-evidence-list">
                {evidenceLabels(dimension.evidence_items).map((label) => (
                  <small key={label}>{label}</small>
                ))}
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="panel">
        <div className="profile-center-link">
          <span className="section-label">个人资料</span>
          <strong>基础画像在个人中心维护</strong>
          <p>学习目标、课程基础、技能标签、项目经历和竞赛经历统一在个人中心编辑。</p>
          <button onClick={onOpenProfile}>进入个人中心</button>
        </div>
        {profileEvidence ? (
          <>
            <span className="section-label">最近补充</span>
            <div className="profile-evidence-card">
              <strong>{profileEvidence.dimension}</strong>
              <p>{profileEvidence.evidence_text}</p>
              <small>{profileEvidence.source_title}</small>
            </div>
          </>
        ) : (
          <ActionEmptyState
            label="补充证据"
            title="暂无本次会话新增证据"
            text="项目分析报告、训练记录和项目材料会进入画像证据。"
          />
        )}
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
  );

  const renderPlanSection = () =>
    plan ? (
      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="section-label">学习计划</span>
            <h2>{plan.goal}</h2>
          </div>
          <span className="muted">{plan.weeks} 周</span>
        </div>
        <div className="plan-control-strip">
          {plan.basis.map((item) => (
            <small key={item}>{item}</small>
          ))}
        </div>
        {plan.revision_note && <p className="plan-revision-note">{plan.revision_note}</p>}
        <div className="plan-feedback-actions">
          {["时间不足，需要压缩每周任务", "基础薄弱，需要先补基础", "想转方向到 AI 应用开发"].map(
            (feedback) => (
              <button
                key={feedback}
                onClick={() => submitPlanFeedback(feedback)}
                disabled={planRevisionLoading}
              >
                {feedback}
              </button>
            ),
          )}
        </div>
        <div className="plan-feedback-panel">
          <label>
            <span>自定义调整意见</span>
            <textarea
              rows={3}
              value={planFeedbackDraft}
              placeholder="调整周期、投入时间或目标方向"
              onChange={(event) => setPlanFeedbackDraft(event.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={!canSubmitPlanFeedback}
            onClick={() => submitPlanFeedback(planFeedbackDraft)}
          >
            {planRevisionLoading ? "调整中" : "提交调整"}
          </button>
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
    ) : (
      <ActionEmptyState
        label="学习计划"
        title="还没有保存的学习计划"
        text="当前账号暂无已保存计划。"
        action="生成学习计划"
        loading={planCreateLoading}
        onAction={onGeneratePlan}
      />
    );

  const renderCompetitionSection = () => (
    <>
      {competitionPreparation ? (
        <section className="panel competition-prep-panel">
          <div className="panel-header">
            <div>
              <span className="section-label">竞赛准备计划</span>
              <h2>{competitionPreparation.competition_name}</h2>
            </div>
            <span className="muted">{competitionPreparation.registration_time}</span>
          </div>
          <p className="competition-prep-overview">{competitionPreparation.overview}</p>
          <div className="competition-prep-grid">
            {competitionPreparation.milestones.map((milestone) => (
              <article className="competition-prep-card" key={`${milestone.week}-${milestone.focus}`}>
                <strong>W{milestone.week}</strong>
                <h3>{milestone.focus}</h3>
                <ul>
                  {milestone.tasks.map((task) => (
                    <li key={task}>{task}</li>
                  ))}
                </ul>
                <p>{milestone.deliverable}</p>
                <small>{milestone.official_basis}</small>
              </article>
            ))}
          </div>
          <div className="competition-citation-strip">
            {competitionPreparation.citations.map((citation) => (
              <small key={citation}>{citation}</small>
            ))}
          </div>
          <p className="plan-revision-note">{competitionPreparation.risk}</p>
        </section>
      ) : (
        <ActionEmptyState
          label="竞赛准备"
          title="按需生成竞赛建议"
          text="结合画像、目标方向和竞赛清单生成推荐与准备计划。"
          action="生成竞赛建议"
          loading={planRevisionLoading}
          onAction={onGenerateCompetition}
        />
      )}

      <section className="panel-grid">
        <article className="panel wide">
          <div className="panel-header">
            <div>
              <span className="section-label">竞赛信息库</span>
              <h2>首批 {competitionCatalog.total} 个计算机相关竞赛或赛道</h2>
            </div>
            <span className="muted">更新 {competitionCatalog.updated_at}</span>
          </div>
          <div className="competition-catalog">
            {competitionCatalog.competitions.map((item) => (
              <article className="competition-card" key={item.competition_id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.category}</span>
                </div>
                <p>{item.registration_time}</p>
                <small>{item.tracks.join(" / ")}</small>
              </article>
            ))}
          </div>
        </article>

        <article className="panel">
          <span className="section-label">竞赛推荐</span>
          {competitions ? (
            <div className="recommend-list">
              {competitions.recommendations.map((item) => (
                <div className="recommend-card" key={item.name}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.category}</span>
                  </div>
                  <b>{item.match_score}</b>
                  <p>{item.reason}</p>
                  <div className="recommend-detail-list">
                    <strong>适合原因</strong>
                    {item.fit_reasons.map((reason) => (
                      <small key={reason}>{reason}</small>
                    ))}
                  </div>
                  <div className="recommend-detail-list warning">
                    <strong>需要补足</strong>
                    {item.gap_abilities.map((gap) => (
                      <small key={gap}>{gap}</small>
                    ))}
                  </div>
                  <small>{item.risk}</small>
                </div>
              ))}
            </div>
          ) : (
            <ActionEmptyState
              label="待生成"
              title="根据画像生成推荐"
              text="包含适合原因和需要补足的能力。"
              action="生成推荐"
              loading={planRevisionLoading}
              onAction={onGenerateCompetition}
            />
          )}
        </article>
      </section>
    </>
  );

  const renderTeamSection = () => (
    <section className="panel-grid">
      <article className="panel">
        <span className="section-label">组队需求</span>
        {teamRequest ? (
          <div className="team-request-card">
            <div>
              <strong>{teamRequest.competition_name}</strong>
              <span>{teamRequest.status}</span>
            </div>
            <p>{teamRequest.project_direction}</p>
            <div className="team-tags">
              {teamRequest.missing_roles.map((role) => (
                <small key={role}>{role}</small>
              ))}
            </div>
            <small>
              {teamRequest.weekly_hours} 小时/周 · {teamRequest.communication}
            </small>
          </div>
        ) : (
          <ActionEmptyState
            label="未发布"
            title="创建组队需求卡片"
            text="用于匹配技能互补的同学。"
            action="创建组队需求"
            loading={teamStatusLoading}
            onAction={onGenerateTeam}
          />
        )}
        <div className="team-privacy">
          <strong>{teamStatus.team_status_enabled ? "已进入推荐池" : "未进入推荐池"}</strong>
          <span>{teamStatus.visibility_note}</span>
          <button
            onClick={() => onUpdateTeamStatus(!teamStatus.team_status_enabled)}
            disabled={teamStatusLoading}
          >
            {teamStatus.team_status_enabled ? "撤回授权" : "开启授权"}
          </button>
        </div>
      </article>

      <article className="panel wide">
        <div className="panel-header">
          <div>
            <span className="section-label">队友推荐</span>
            <h2>基于技能互补、方向一致和项目经历匹配</h2>
          </div>
          <span className="muted">联系方式默认不公开</span>
        </div>
        {team ? (
          <div className="recommend-list">
            {team.candidates.map((candidate) => (
              <div className="recommend-card" key={candidate.student_id}>
                <div>
                  <strong>{candidate.name}</strong>
                  <span>{candidate.role}</span>
                </div>
                <b>{candidate.match_score}</b>
                <p>{candidate.complement}</p>
                <div className="team-graph">
                  {candidate.skill_complement_graph.map((item) => (
                    <small key={item}>{item}</small>
                  ))}
                </div>
                <div className="team-questions">
                  {candidate.suggested_questions.map((question) => (
                    <small key={question}>{question}</small>
                  ))}
                </div>
                <small>{candidate.evidence.join(" / ")}</small>
              </div>
            ))}
          </div>
        ) : (
          <ActionEmptyState
            label="队友推荐"
            title="尚未生成队友推荐"
            text="按技能互补、方向一致和项目经历匹配。"
            action="生成队友推荐"
            loading={teamStatusLoading}
            onAction={onGenerateTeam}
          />
        )}
      </article>
    </section>
  );

  return (
    <section className="growth-workbench">
      <aside className="growth-workbench-sidebar">
        <div className="growth-workbench-head">
          <span className="section-label">发展工作台</span>
          <h2>{profile.target_path}</h2>
          <p>围绕能力画像、学习计划、竞赛准备、组队协作和执行事项切换处理。</p>
        </div>
        <div className="growth-command-metrics" aria-label="成长规划摘要">
          <article>
            <span>画像均分</span>
            <strong>{profileAverage}</strong>
          </article>
          <article>
            <span>优势</span>
            <strong>{strongestDimension?.dimension ?? "待补充"}</strong>
          </article>
          <article>
            <span>优先补齐</span>
            <strong>{weakestDimension?.dimension ?? "待补充"}</strong>
          </article>
          <article>
            <span>执行进度</span>
            <strong>{taskList ? `${taskList.completed}/${taskList.total}` : "待记录"}</strong>
          </article>
        </div>
        <nav className="growth-module-switcher" aria-label="发展模块入口">
          {growthSections.map((section, index) => (
            <button
              key={section.id}
              className={activeSection === section.id ? "active" : ""}
              onClick={() => setActiveSection(section.id)}
              type="button"
            >
              <b>{String(index + 1).padStart(2, "0")}</b>
              <strong>{section.label}</strong>
              <span>{section.summary}</span>
              <small>{section.status}</small>
            </button>
          ))}
        </nav>
      </aside>

      <section className="growth-section-content">
        <header className="growth-section-title">
          <div>
            <span className="section-label">当前模块</span>
            <h2>{activeSectionMeta.label}</h2>
            <p>{activeSectionMeta.summary}</p>
          </div>
          <div className="growth-section-controls">
            <strong>
              {activeSectionIndex + 1}/{growthSections.length} · {activeSectionMeta.status}
            </strong>
            {renderGrowthPrimaryAction()}
          </div>
        </header>
        {activeSection === "profile" && renderProfileSection()}
        {activeSection === "plan" && renderPlanSection()}
        {activeSection === "competition" && renderCompetitionSection()}
        {activeSection === "team" && renderTeamSection()}
        {activeSection === "execution" &&
          (taskList ? (
            <>
              {taskSaveResult && <InlineNotice label="已保存事项" text={taskSaveResult} />}
              <PlanExecution
                taskList={taskList}
                review={review}
                loading={taskLoading}
                updatingTaskId={taskStatusUpdatingId}
                onSaveTask={onSaveTask}
                onUpdateTaskStatus={onUpdateTaskStatus}
                onGenerateReview={onGenerateReview}
              />
            </>
          ) : (
            <ActionEmptyState
              label="计划执行"
              title="暂无执行事项"
              text="生成或保存任务后，可在这里查看进度并形成阶段反馈。"
            />
          ))}
      </section>
    </section>
  );
}

function ActionEmptyState({
  label,
  title,
  text,
  action,
  loading = false,
  onAction,
}: {
  label: string;
  title: string;
  text: string;
  action?: string;
  loading?: boolean;
  onAction?: () => void;
}) {
  return (
    <div className="action-empty-state">
      <span>{label}</span>
      <strong>{title}</strong>
      <p>{text}</p>
      {action && onAction && (
        <button onClick={onAction} disabled={loading}>
          {loading ? "处理中" : action}
        </button>
      )}
    </div>
  );
}

function KnowledgeAdmin({
  documents,
  search,
  versions,
  query,
  loading,
  createLoading,
  onQueryChange,
  onSearch,
  onCreateDocument,
  onUpdateDocument,
  onOfflineDocument,
}: {
  documents: KnowledgeDocumentsResponse;
  search: KnowledgeSearchResponse | null;
  versions: KnowledgeDocumentVersionsResponse | null;
  query: string;
  loading: boolean;
  createLoading: boolean;
  onQueryChange: (query: string) => void;
  onSearch: (query?: string) => void;
  onCreateDocument: (payload: KnowledgeDocumentCreate) => void;
  onUpdateDocument: (documentId: string, payload: KnowledgeDocumentUpdate) => void;
  onOfflineDocument: (documentId: string, title: string) => void;
}) {
  const paths = Array.from(new Set(documents.documents.map((document) => document.path)));
  const sourceTypes = Array.from(new Set(documents.documents.map((document) => document.source_type)));
  const statuses = Array.from(new Set(documents.documents.map((document) => document.status)));
  const [docQuery, setDocQuery] = useState("");
  const [pathFilter, setPathFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [docPage, setDocPage] = useState(1);
  const [docPageSize, setDocPageSize] = useState(10);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftSourceType, setDraftSourceType] = useState("project_case");
  const [draftPath, setDraftPath] = useState("软件项目实践");
  const [draftTags, setDraftTags] = useState("项目案例、软件工程");
  const [draftMaintainer, setDraftMaintainer] = useState("平台管理员");
  const [draftSourceUrl, setDraftSourceUrl] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftMode, setDraftMode] = useState<"create" | "edit">("create");
  const sourceCount = (sourceType: string) =>
    documents.documents.filter((document) => document.source_type === sourceType).length;
  const customDocuments = documents.documents.filter((document) =>
    document.document_id.startsWith("custom_doc_"),
  );
  const activeDocuments = documents.documents.filter((document) => document.status === "已入库");
  const offlineDocuments = documents.documents.filter((document) => document.status !== "已入库");
  const selectedDocument = selectedDocumentId
    ? documents.documents.find((document) => document.document_id === selectedDocumentId) ?? null
    : null;
  const selectedDocumentEditable = Boolean(
    selectedDocument?.document_id.startsWith("custom_doc_"),
  );
  const normalizedDocQuery = docQuery.trim().toLowerCase();
  const filteredDocuments = documents.documents.filter((document) => {
    const matchesQuery =
      !normalizedDocQuery ||
      [
        document.title,
        document.path,
        document.source_type,
        document.status,
        document.maintainer,
        document.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedDocQuery);
    const matchesPath = pathFilter === "all" || document.path === pathFilter;
    const matchesSource = sourceFilter === "all" || document.source_type === sourceFilter;
    const matchesStatus = statusFilter === "all" || document.status === statusFilter;
    return matchesQuery && matchesPath && matchesSource && matchesStatus;
  });
  const docPageCount = Math.max(1, Math.ceil(filteredDocuments.length / docPageSize));
  const currentDocPage = Math.min(docPage, docPageCount);
  const docStartIndex = filteredDocuments.length ? (currentDocPage - 1) * docPageSize : 0;
  const pagedDocuments = filteredDocuments.slice(docStartIndex, docStartIndex + docPageSize);
  const firstVisibleDocPage = Math.max(1, Math.min(currentDocPage - 3, docPageCount - 6));
  const visibleDocPages = Array.from(
    { length: Math.min(docPageCount, 7) },
    (_, index) => firstVisibleDocPage + index,
  );
  const activeDocFilterCount = [
    docQuery.trim(),
    pathFilter !== "all",
    sourceFilter !== "all",
    statusFilter !== "all",
  ].filter(Boolean).length;
  const parsedDraftTags = draftTags
    .split(/[、,，\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  const draftValid = Boolean(
    draftTitle.trim() &&
      draftSourceType.trim() &&
      draftPath.trim() &&
      draftMaintainer.trim() &&
      (draftMode === "edit" || draftContent.trim()),
  );

  useEffect(() => {
    setDocPage(1);
  }, [docQuery, pathFilter, sourceFilter, statusFilter, docPageSize]);

  useEffect(() => {
    if (docPage > docPageCount) {
      setDocPage(docPageCount);
    }
  }, [docPage, docPageCount]);

  function startCreateDocument() {
    setDraftMode("create");
    setSelectedDocumentId(null);
    setDraftTitle("");
    setDraftSourceType("project_case");
    setDraftPath("软件项目实践");
    setDraftTags("项目案例、软件工程");
    setDraftMaintainer("平台管理员");
    setDraftSourceUrl("");
    setDraftContent("");
  }

  function startEditDocument(document: KnowledgeDocument) {
    setDraftMode("edit");
    setSelectedDocumentId(document.document_id);
    setDraftTitle(document.title);
    setDraftSourceType(document.source_type);
    setDraftPath(document.path);
    setDraftTags(document.tags.join("、"));
    setDraftMaintainer(document.maintainer);
    setDraftSourceUrl(document.source_url ?? "");
    setDraftContent("");
  }

  function submitKnowledgeDraft() {
    if (!draftValid) return;
    if (draftMode === "edit" && selectedDocumentEditable && selectedDocument) {
      onUpdateDocument(selectedDocument.document_id, {
        title: draftTitle.trim(),
        source_type: draftSourceType.trim(),
        path: draftPath.trim(),
        tags: parsedDraftTags,
        content: draftContent.trim() || undefined,
        source_url: draftSourceUrl.trim() || null,
        maintainer: draftMaintainer.trim(),
      });
      return;
    }
    onCreateDocument({
      title: draftTitle.trim(),
      source_type: draftSourceType.trim(),
      path: draftPath.trim(),
      tags: parsedDraftTags,
      content: draftContent.trim(),
      source_url: draftSourceUrl.trim() || null,
      maintainer: draftMaintainer.trim(),
    });
  }

  function clearDocFilters() {
    setDocQuery("");
    setPathFilter("all");
    setSourceFilter("all");
    setStatusFilter("all");
    setDocPage(1);
  }

  return (
    <>
      <section className="kb-overview">
        <article className="metric">
          <span>资料总数</span>
          <strong>{documents.total}</strong>
          <small>首批知识库资料</small>
        </article>
        <article className="metric">
          <span>重点路径</span>
          <strong>{paths.length}</strong>
          <small>{paths.join(" / ")}</small>
        </article>
        <article className="metric">
          <span>课程资料</span>
          <strong>{sourceCount("course_material")}</strong>
          <small>核心课程</small>
        </article>
        <article className="metric">
          <span>竞赛资料</span>
          <strong>{sourceCount("competition_material")}</strong>
          <small>竞赛与赛道</small>
        </article>
        <article className="metric">
          <span>项目案例</span>
          <strong>{sourceCount("project_case")}</strong>
          <small>案例或资源</small>
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

      <section className="kb-governance-panel">
        <div className="kb-governance-main">
          <span className="section-label">资料治理总览</span>
          <h2>资料入库工作流</h2>
          <p>
            资料围绕算法竞赛、AI 应用开发、软件项目实践三个重点路径维护，并保留维护人、版本和状态记录。
          </p>
        </div>
        <div className="kb-governance-metrics">
          <article>
            <span>可检索资料</span>
            <strong>{activeDocuments.length}</strong>
            <small>{offlineDocuments.length} 条未进入检索</small>
          </article>
          <article>
            <span>自建资料</span>
            <strong>{customDocuments.length}</strong>
            <small>支持编辑和下线</small>
          </article>
          <article>
            <span>维护人</span>
            <strong>{new Set(documents.documents.map((document) => document.maintainer)).size}</strong>
            <small>按资料记录归属</small>
          </article>
        </div>
      </section>

      <section className="kb-maintenance-shell">
        <article className="panel kb-form-panel">
          <div className="panel-header">
            <div>
              <span className="section-label">新建资料</span>
              <h2>{draftMode === "edit" ? "编辑资料元数据" : "资料入库表单"}</h2>
            </div>
            <button type="button" onClick={startCreateDocument} disabled={createLoading}>
              新建资料
            </button>
          </div>
          <div className="kb-form-grid">
            <label className="kb-title-field">
              <span>资料标题</span>
              <input
                value={draftTitle}
                placeholder="资料标题"
                onChange={(event) => setDraftTitle(event.target.value)}
              />
            </label>
            <label>
              <span>资料类型</span>
              <select
                value={draftSourceType}
                onChange={(event) => setDraftSourceType(event.target.value)}
              >
                <option value="course_material">course_material</option>
                <option value="competition_material">competition_material</option>
                <option value="project_case">project_case</option>
                <option value="school_policy">school_policy</option>
              </select>
            </label>
            <label>
              <span>重点路径</span>
              <select value={draftPath} onChange={(event) => setDraftPath(event.target.value)}>
                <option value="算法竞赛">算法竞赛</option>
                <option value="AI 应用开发">AI 应用开发</option>
                <option value="软件项目实践">软件项目实践</option>
                <option value="课程基础">课程基础</option>
              </select>
            </label>
            <label>
              <span>维护人</span>
              <input
                value={draftMaintainer}
                onChange={(event) => setDraftMaintainer(event.target.value)}
              />
            </label>
            <label>
              <span>来源链接</span>
              <input
                value={draftSourceUrl}
                placeholder="https://..."
                onChange={(event) => setDraftSourceUrl(event.target.value)}
              />
            </label>
            <label className="kb-title-field">
              <span>标签</span>
              <input
                value={draftTags}
                placeholder="用顿号或逗号分隔"
                onChange={(event) => setDraftTags(event.target.value)}
              />
            </label>
            <label className="kb-content-field">
              <span>{draftMode === "edit" ? "资料正文更新" : "资料正文"}</span>
              <textarea
                rows={5}
                value={draftContent}
                placeholder={
                  draftMode === "edit"
                    ? "留空则保留原正文；填写后会生成新版本。"
                    : "课程、竞赛或项目案例正文。"
                }
                onChange={(event) => setDraftContent(event.target.value)}
              />
            </label>
          </div>
          <div className="kb-form-actions">
            <div>
              <span>{draftMode === "edit" ? "编辑模式" : "入库模式"}</span>
              <strong>{parsedDraftTags.length || 0} 个标签 · {draftPath}</strong>
            </div>
            <button type="button" onClick={submitKnowledgeDraft} disabled={createLoading || !draftValid}>
              {createLoading ? "保存中" : draftMode === "edit" ? "保存版本" : "提交入库"}
            </button>
          </div>
          {!draftValid && (
            <p className="kb-form-hint">
              {draftMode === "edit"
                ? "编辑资料需要标题、类型、路径和维护人。"
                : "新建资料需要标题、类型、路径、维护人和正文。"}
            </p>
          )}
        </article>

        <article className="panel kb-selected-panel">
          <span className="section-label">当前资料</span>
          {selectedDocument ? (
            <>
              <strong>{selectedDocument.title}</strong>
              <div className="kb-selected-meta">
                <span>{selectedDocument.path}</span>
                <span>{selectedDocument.source_type}</span>
                <span>{selectedDocument.status}</span>
                <span>维护人：{selectedDocument.maintainer}</span>
              </div>
              <small>v{selectedDocument.version} · {selectedDocument.updated_at}</small>
              <div className="kb-action-buttons">
                <button
                  type="button"
                  disabled={!selectedDocumentEditable || createLoading}
                  onClick={() => startEditDocument(selectedDocument)}
                >
                  编辑
                </button>
                <button
                  type="button"
                  disabled={!selectedDocumentEditable || createLoading}
                  onClick={() => onOfflineDocument(selectedDocument.document_id, selectedDocument.title)}
                >
                  下线
                </button>
                <button
                  type="button"
                  onClick={() => onSearch(selectedDocument.title)}
                  disabled={loading}
                >
                  检索
                </button>
              </div>
              {!selectedDocumentEditable && (
                <p>内置首批资料可检索和查看；自建资料支持编辑、下线和版本记录。</p>
              )}
            </>
          ) : (
            <ActionEmptyState
              label="资料选择"
              title="选择一条资料"
              text="从资料清单中选择资料后，可查看维护状态、检索命中或编辑自建资料。"
            />
          )}
        </article>
      </section>

      <section className="panel-grid">
        <article className="panel wide">
          <div className="panel-header">
            <div>
              <span className="section-label">资料清单</span>
              <h2>首批知识库资料</h2>
            </div>
            <span className="muted">{filteredDocuments.length}/{documents.total} 条资料</span>
          </div>
          <div className="doc-filter-toolbar" aria-label="知识库资料筛选">
            <label className="doc-search-field">
              <span>关键词</span>
              <input
                value={docQuery}
                placeholder="标题、标签、路径或维护人"
                onChange={(event) => setDocQuery(event.target.value)}
              />
            </label>
            <label>
              <span>重点路径</span>
              <select value={pathFilter} onChange={(event) => setPathFilter(event.target.value)}>
                <option value="all">全部路径</option>
                {paths.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>来源</span>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
              >
                <option value="all">全部来源</option>
                {sourceTypes.map((sourceType) => (
                  <option key={sourceType} value={sourceType}>
                    {sourceType}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>状态</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">全部状态</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>每页</span>
              <select
                value={docPageSize}
                onChange={(event) => setDocPageSize(Number(event.target.value))}
              >
                <option value={10}>10 条</option>
                <option value={20}>20 条</option>
                <option value={50}>50 条</option>
              </select>
            </label>
            <button type="button" disabled={activeDocFilterCount === 0} onClick={clearDocFilters}>
              清除筛选
            </button>
          </div>
          <div className="doc-filter-summary">
            <span>{filteredDocuments.length} 条当前可见</span>
            <span>
              第 {currentDocPage}/{docPageCount} 页
            </span>
            {filteredDocuments.length > 0 && (
              <span>
                显示 {docStartIndex + 1}-{Math.min(docStartIndex + docPageSize, filteredDocuments.length)}
              </span>
            )}
            {activeDocFilterCount > 0 && <strong>{activeDocFilterCount} 个筛选条件</strong>}
          </div>
          <div className="doc-table">
            {pagedDocuments.map((document) => (
              <button
                type="button"
                className={[
                  "doc-row",
                  selectedDocumentId === document.document_id ? "active" : "",
                  document.document_id.startsWith("custom_doc_") ? "editable" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={document.document_id}
                onClick={() => {
                  setSelectedDocumentId(document.document_id);
                  if (document.document_id.startsWith("custom_doc_")) {
                    startEditDocument(document);
                  }
                }}
              >
                <strong>{document.title}</strong>
                <span>{document.path}</span>
                <span>{document.source_type}</span>
                <span>{document.status}</span>
                <small>
                  v{document.version} · {document.maintainer} · {document.updated_at} ·{" "}
                  {document.tags.join(" / ")}
                </small>
              </button>
            ))}
            {!pagedDocuments.length && (
              <ActionEmptyState
                label="资料清单"
                title="没有匹配的知识库资料"
                text="调整关键词、路径、来源或状态筛选后再查看。"
                action="清除筛选"
                onAction={clearDocFilters}
              />
            )}
          </div>
          {filteredDocuments.length > 0 && (
            <div className="doc-pagination" aria-label="知识库资料分页">
              <button
                type="button"
                disabled={currentDocPage <= 1}
                onClick={() => setDocPage((page) => Math.max(1, page - 1))}
              >
                上一页
              </button>
              <div>
                {visibleDocPages.map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={page === currentDocPage ? "active" : ""}
                    onClick={() => setDocPage(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={currentDocPage >= docPageCount}
                onClick={() => setDocPage((page) => Math.min(docPageCount, page + 1))}
              >
                下一页
              </button>
            </div>
          )}
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
            {!search && <p className="muted">等待检索。</p>}
          </div>
          {versions && (
            <div className="version-list">
              <span className="section-label">版本记录</span>
              {versions.versions.map((version) => (
                <div className="version-item" key={`${versions.document_id}-${version.version}`}>
                  <strong>
                    v{version.version} · {version.action}
                  </strong>
                  <p>{version.summary}</p>
                  <small>
                    {version.maintainer} · {version.updated_at}
                  </small>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </>
  );
}

function PlanExecution({
  taskList,
  review,
  loading,
  updatingTaskId,
  onSaveTask,
  onUpdateTaskStatus,
  onGenerateReview,
}: {
  taskList: TaskListResponse;
  review: ReviewResponse | null;
  loading: boolean;
  updatingTaskId: string | null;
  onSaveTask: (payload: SaveTaskPayload) => Promise<LearningTask>;
  onUpdateTaskStatus: (taskId: string, status: "todo" | "doing" | "done") => void;
  onGenerateReview: (payload: ReviewGeneratePayload) => void;
}) {
  const [taskTitle, setTaskTitle] = useState("");
  const [taskSource, setTaskSource] = useState("");
  const [taskPriority, setTaskPriority] = useState<"high" | "medium" | "low">("medium");
  const [taskDueDate, setTaskDueDate] = useState("2026-07-12");
  const [taskEvidence, setTaskEvidence] = useState("");
  const [reviewPeriod, setReviewPeriod] = useState("本周");
  const [reviewNotes, setReviewNotes] = useState("");
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>(
    taskList.tasks.filter((task) => task.status === "done").map((task) => task.task_id),
  );
  const completion = taskList.total ? Math.round((taskList.completed / taskList.total) * 100) : 0;
  const canSaveTask = Boolean(taskTitle.trim() && taskDueDate.trim() && taskEvidence.trim());

  useEffect(() => {
    setCompletedTaskIds(taskList.tasks.filter((task) => task.status === "done").map((task) => task.task_id));
  }, [taskList.tasks]);

  function toggleCompletedTask(taskId: string) {
    if (updatingTaskId) return;
    const isCurrentlyCompleted = completedTaskIds.includes(taskId);
    setCompletedTaskIds((current) =>
      isCurrentlyCompleted
        ? current.filter((id) => id !== taskId)
        : [...current, taskId],
    );
    onUpdateTaskStatus(taskId, isCurrentlyCompleted ? "doing" : "done");
  }

  return (
    <>
      <section className="task-hero">
        <div>
          <span className="section-label">计划执行</span>
          <h2>把学习计划、项目建议和竞赛准备落到可执行事项</h2>
          <p>当前完成 {taskList.completed} / {taskList.total}，已完成事项和证据记录可用于阶段反馈。</p>
        </div>
        <div className="task-actions">
          <button
            onClick={() =>
              onGenerateReview({
                period: reviewPeriod,
                completed_task_ids: completedTaskIds,
                notes: reviewNotes,
              })
            }
            disabled={loading}
          >
            生成阶段反馈
          </button>
        </div>
      </section>
      <section className="panel task-create-panel">
        <div className="panel-header">
          <div>
            <span className="section-label">新增事项</span>
            <h2>记录新的学习、项目或竞赛执行事项</h2>
          </div>
          <button
            onClick={async () => {
              await onSaveTask({
                title: taskTitle.trim(),
                source: taskSource.trim() || "手动记录",
                priority: taskPriority,
                due_date: taskDueDate,
                evidence_required: taskEvidence.trim(),
              });
              setTaskTitle("");
              setTaskSource("");
              setTaskEvidence("");
            }}
            disabled={loading || !canSaveTask}
          >
            {loading ? "保存中" : "保存事项"}
          </button>
        </div>
        <div className="task-form-grid">
          <label className="task-title-field">
            <span>事项标题</span>
            <input
              value={taskTitle}
              placeholder="事项标题"
              onChange={(event) => setTaskTitle(event.target.value)}
            />
          </label>
          <label>
            <span>来源</span>
            <input
              value={taskSource}
              placeholder="成长规划、项目分析或手动记录"
              onChange={(event) => setTaskSource(event.target.value)}
            />
          </label>
          <label>
            <span>优先级</span>
            <select
              value={taskPriority}
              onChange={(event) => setTaskPriority(event.target.value as "high" | "medium" | "low")}
            >
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </label>
          <label>
            <span>截止日期</span>
            <input
              type="date"
              value={taskDueDate}
              onChange={(event) => setTaskDueDate(event.target.value)}
            />
          </label>
          <label className="task-evidence-field">
            <span>完成证据</span>
            <textarea
              rows={2}
              value={taskEvidence}
              placeholder="提交链接、截图、测试记录或项目产物"
              onChange={(event) => setTaskEvidence(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="panel-grid">
        <article className="panel wide">
          <div className="panel-header">
            <div>
              <span className="section-label">执行进度</span>
              <h2>本周学习与项目事项</h2>
            </div>
            <strong className="score-pill">{completion}</strong>
          </div>
          <div className="task-board">
            {taskList.tasks.map((task) => (
              <TaskCard
                key={task.task_id}
                task={task}
                loading={updatingTaskId === task.task_id}
                disabled={Boolean(updatingTaskId && updatingTaskId !== task.task_id)}
                onUpdateStatus={onUpdateTaskStatus}
              />
            ))}
          </div>
        </article>

        <article className="panel">
          <span className="section-label">阶段反馈</span>
          <div className="review-form">
            <label>
              <span>反馈周期</span>
              <input value={reviewPeriod} onChange={(event) => setReviewPeriod(event.target.value)} />
            </label>
            <label>
              <span>执行备注</span>
              <textarea
                rows={4}
                value={reviewNotes}
                placeholder="记录完成情况、遇到的问题和下一步计划"
                onChange={(event) => setReviewNotes(event.target.value)}
              />
            </label>
            <div className="review-task-picker">
              <strong>本轮已完成事项</strong>
              {taskList.tasks.map((task) => (
                <label key={task.task_id}>
                  <input
                    type="checkbox"
                    checked={completedTaskIds.includes(task.task_id)}
                    disabled={Boolean(loading || (updatingTaskId && updatingTaskId !== task.task_id))}
                    onChange={() => toggleCompletedTask(task.task_id)}
                  />
                  <span>{task.title}</span>
                </label>
              ))}
            </div>
            <button
              onClick={() =>
                onGenerateReview({
                  period: reviewPeriod,
                  completed_task_ids: completedTaskIds,
                  notes: reviewNotes,
                })
              }
              disabled={loading}
            >
              {loading ? "生成中" : "生成阶段反馈"}
            </button>
          </div>
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
            <p className="muted">完成事项与备注后可生成阶段反馈。</p>
          )}
        </article>
      </section>
    </>
  );
}

function TaskCard({
  task,
  loading,
  disabled,
  onUpdateStatus,
}: {
  task: LearningTask;
  loading: boolean;
  disabled: boolean;
  onUpdateStatus: (taskId: string, status: "todo" | "doing" | "done") => void;
}) {
  const isDone = task.status === "done";
  const statusLabel =
    task.status === "done" ? "已完成" : task.status === "doing" ? "进行中" : "待开始";
  const priorityLabel =
    task.priority === "high" ? "高优先级" : task.priority === "low" ? "低优先级" : "中优先级";
  return (
    <article className={`task-card ${task.status}`}>
      <div>
        <strong>{task.title}</strong>
        <span>{task.source} · {priorityLabel}</span>
      </div>
      <b>{statusLabel}</b>
      <p>{task.evidence_required}</p>
      <div className="task-progress-line" aria-label={`${task.title} 完成进度 ${task.progress}%`}>
        <span style={{ width: `${task.progress}%` }} />
      </div>
      <footer>
        <small>截止 {task.due_date} · 进度 {task.progress}%</small>
        <button
          type="button"
          disabled={loading || disabled}
          onClick={() => onUpdateStatus(task.task_id, isDone ? "doing" : "done")}
        >
          {loading ? "更新中" : isDone ? "恢复执行" : "标记完成"}
        </button>
      </footer>
    </article>
  );
}

function EvaluationDashboard({
  dashboard,
  isAdmin,
  loading,
  exportLoading,
  exportResult,
  onCreateArtifact,
  onExportReport,
}: {
  dashboard: EvaluationDashboardResponse;
  isAdmin: boolean;
  loading: boolean;
  exportLoading: boolean;
  exportResult: string | null;
  onCreateArtifact: (
    casePayload: EvaluationCaseCreate,
    recordPayload: Omit<EvaluationRecordCreate, "case_id">,
  ) => void;
  onExportReport: () => void;
}) {
  const [caseQuery, setCaseQuery] = useState("");
  const [caseScenarioFilter, setCaseScenarioFilter] = useState("all");
  const [casePriorityFilter, setCasePriorityFilter] = useState("all");
  const [caseStatusFilter, setCaseStatusFilter] = useState("all");
  const [recordQuery, setRecordQuery] = useState("");
  const [recordScenarioFilter, setRecordScenarioFilter] = useState("all");
  const [recordScoreFilter, setRecordScoreFilter] = useState<"all" | "risk" | "pass" | "excellent">("all");
  const [recordPage, setRecordPage] = useState(1);
  const [recordPageSize, setRecordPageSize] = useState(5);
  const [draftScenario, setDraftScenario] = useState("项目分析");
  const [draftQuestion, setDraftQuestion] = useState("");
  const [draftFocus, setDraftFocus] = useState("证据引用、评分口径、改进任务");
  const [draftPriority, setDraftPriority] = useState("P0");
  const [draftStatus, setDraftStatus] = useState("待评测");
  const [draftOutput, setDraftOutput] = useState("");
  const [draftScore, setDraftScore] = useState(85);
  const [draftIssues, setDraftIssues] = useState("");
  const [draftReviewer, setDraftReviewer] = useState("项目评测组");
  const caseScenarios = Array.from(new Set(dashboard.cases.map((item) => item.scenario)));
  const casePriorities = Array.from(new Set(dashboard.cases.map((item) => item.priority)));
  const caseStatuses = Array.from(new Set(dashboard.cases.map((item) => item.status)));
  const recordScenarios = Array.from(new Set(dashboard.records.map((item) => item.scenario)));
  const normalizedCaseQuery = caseQuery.trim().toLowerCase();
  const normalizedRecordQuery = recordQuery.trim().toLowerCase();
  const filteredCases = dashboard.cases.filter((item) => {
    const matchesQuery =
      !normalizedCaseQuery ||
      [item.scenario, item.input_question, item.expected_focus.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(normalizedCaseQuery);
    const matchesScenario = caseScenarioFilter === "all" || item.scenario === caseScenarioFilter;
    const matchesPriority = casePriorityFilter === "all" || item.priority === casePriorityFilter;
    const matchesStatus = caseStatusFilter === "all" || item.status === caseStatusFilter;
    return matchesQuery && matchesScenario && matchesPriority && matchesStatus;
  });
  const filteredRecords = dashboard.records.filter((record) => {
    const matchesQuery =
      !normalizedRecordQuery ||
      [
        record.scenario,
        record.input_question,
        record.system_output,
        record.issue_notes,
        record.reviewer,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedRecordQuery);
    const matchesScenario =
      recordScenarioFilter === "all" || record.scenario === recordScenarioFilter;
    const matchesScore =
      recordScoreFilter === "all" ||
      (recordScoreFilter === "risk" && record.manual_score < 80) ||
      (recordScoreFilter === "pass" && record.manual_score >= 80 && record.manual_score < 90) ||
      (recordScoreFilter === "excellent" && record.manual_score >= 90);
    return matchesQuery && matchesScenario && matchesScore;
  });
  const recordPageCount = Math.max(1, Math.ceil(filteredRecords.length / recordPageSize));
  const currentRecordPage = Math.min(recordPage, recordPageCount);
  const recordStartIndex = filteredRecords.length ? (currentRecordPage - 1) * recordPageSize : 0;
  const pagedRecords = filteredRecords.slice(recordStartIndex, recordStartIndex + recordPageSize);
  const firstVisibleRecordPage = Math.max(
    1,
    Math.min(currentRecordPage - 3, recordPageCount - 6),
  );
  const visibleRecordPages = Array.from(
    { length: Math.min(recordPageCount, 7) },
    (_, index) => firstVisibleRecordPage + index,
  );
  const activeCaseFilterCount = [
    caseQuery.trim(),
    caseScenarioFilter !== "all",
    casePriorityFilter !== "all",
    caseStatusFilter !== "all",
  ].filter(Boolean).length;
  const activeRecordFilterCount = [
    recordQuery.trim(),
    recordScenarioFilter !== "all",
    recordScoreFilter !== "all",
  ].filter(Boolean).length;
  const parsedFocus = draftFocus
    .split(/[、,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const canSubmitEvaluation = Boolean(
    draftScenario.trim() &&
      draftQuestion.trim() &&
      parsedFocus.length &&
      draftPriority.trim() &&
      draftStatus.trim() &&
      draftOutput.trim() &&
      draftIssues.trim() &&
      draftReviewer.trim(),
  );

  useEffect(() => {
    setRecordPage(1);
  }, [recordQuery, recordScenarioFilter, recordScoreFilter, recordPageSize]);

  useEffect(() => {
    if (recordPage > recordPageCount) {
      setRecordPage(recordPageCount);
    }
  }, [recordPage, recordPageCount]);

  function clearCaseFilters() {
    setCaseQuery("");
    setCaseScenarioFilter("all");
    setCasePriorityFilter("all");
    setCaseStatusFilter("all");
  }

  function clearRecordFilters() {
    setRecordQuery("");
    setRecordScenarioFilter("all");
    setRecordScoreFilter("all");
    setRecordPage(1);
  }

  function submitEvaluationArtifact() {
    if (!canSubmitEvaluation) return;
    onCreateArtifact(
      {
        scenario: draftScenario.trim(),
        input_question: draftQuestion.trim(),
        expected_focus: parsedFocus,
        priority: draftPriority.trim(),
        status: draftStatus.trim(),
      },
      {
        scenario: draftScenario.trim(),
        input_question: draftQuestion.trim(),
        system_output: draftOutput.trim(),
        manual_score: draftScore,
        issue_notes: draftIssues.trim(),
        reviewer: draftReviewer.trim(),
      },
    );
    setDraftQuestion("");
    setDraftOutput("");
    setDraftIssues("");
  }

  return (
    <>
      <section className="summary-strip">
        <article className="metric">
          <span>测试案例</span>
          <strong>{dashboard.summary.total_cases}</strong>
          <small>典型问题</small>
        </article>
        <article className="metric">
          <span>输出记录</span>
          <strong>{dashboard.summary.completed_records}</strong>
          <small>含引用与评价</small>
        </article>
        <article className="metric">
          <span>平均评分</span>
          <strong>{dashboard.summary.average_score}</strong>
          <small>人工评价</small>
        </article>
        <article className="metric">
          <span>通过率</span>
          <strong>{dashboard.summary.pass_rate}%</strong>
          <small>80 分以上</small>
        </article>
      </section>
      <section className="panel-grid">
        <article className="panel wide">
          <div className="panel-header">
            <div>
              <span className="section-label">测试案例</span>
              <h2>覆盖问答、项目分析和推荐闭环</h2>
            </div>
            <span className="muted">{filteredCases.length}/{dashboard.cases.length} 个案例</span>
          </div>
          <div className="eval-filter-toolbar" aria-label="测试案例筛选">
            <label className="eval-search-field">
              <span>关键词</span>
              <input
                value={caseQuery}
                placeholder="场景、问题或关注点"
                onChange={(event) => setCaseQuery(event.target.value)}
              />
            </label>
            <label>
              <span>场景</span>
              <select
                value={caseScenarioFilter}
                onChange={(event) => setCaseScenarioFilter(event.target.value)}
              >
                <option value="all">全部场景</option>
                {caseScenarios.map((scenario) => (
                  <option key={scenario} value={scenario}>
                    {scenario}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>优先级</span>
              <select
                value={casePriorityFilter}
                onChange={(event) => setCasePriorityFilter(event.target.value)}
              >
                <option value="all">全部优先级</option>
                {casePriorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>状态</span>
              <select
                value={caseStatusFilter}
                onChange={(event) => setCaseStatusFilter(event.target.value)}
              >
                <option value="all">全部状态</option>
                {caseStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" disabled={activeCaseFilterCount === 0} onClick={clearCaseFilters}>
              清除筛选
            </button>
          </div>
          <div className="eval-case-list">
            {filteredCases.map((item) => (
              <article className="eval-case" key={item.case_id}>
                <div>
                  <strong>{item.scenario}</strong>
                  <span>{item.priority} · {item.status}</span>
                </div>
                <p>{item.input_question}</p>
                <div>
                  {item.expected_focus.map((focus) => (
                    <small key={focus}>{focus}</small>
                  ))}
                </div>
              </article>
            ))}
            {!filteredCases.length && (
              <ActionEmptyState
                label="测试案例"
                title="没有匹配的测试案例"
                text="调整场景、优先级、状态或关键词后再查看。"
                action="清除筛选"
                onAction={clearCaseFilters}
              />
            )}
          </div>
        </article>

        <article className="panel">
          <span className="section-label">评测口径</span>
          <div className="evaluation-rubric">
            <p>记录输入、系统输出、引用来源、人工评分和问题记录。</p>
            <p>事实性内容重点检查是否可追溯，推荐类内容重点检查是否解释适合原因与短板。</p>
          </div>
          {isAdmin && (
            <div className="evaluation-admin-card">
              <strong>评测记录工作台</strong>
              <span>新增测试案例，并同步保存一次系统输出记录。</span>
              <label>
                <small>场景</small>
                <select value={draftScenario} onChange={(event) => setDraftScenario(event.target.value)}>
                  <option value="知识库问答">知识库问答</option>
                  <option value="项目分析">项目分析</option>
                  <option value="成长与双创推荐">成长与双创推荐</option>
                  <option value="计划执行">计划执行</option>
                </select>
              </label>
              <label>
                <small>测试问题</small>
                <textarea
                  rows={2}
                  value={draftQuestion}
                  placeholder="学生问题、项目分析请求或推荐请求"
                  onChange={(event) => setDraftQuestion(event.target.value)}
                />
              </label>
              <label>
                <small>关注点</small>
                <input
                  value={draftFocus}
                  placeholder="用顿号或逗号分隔"
                  onChange={(event) => setDraftFocus(event.target.value)}
                />
              </label>
              <div className="evaluation-admin-inline">
                <label>
                  <small>优先级</small>
                  <select value={draftPriority} onChange={(event) => setDraftPriority(event.target.value)}>
                    <option value="P0">P0</option>
                    <option value="P1">P1</option>
                    <option value="P2">P2</option>
                  </select>
                </label>
                <label>
                  <small>状态</small>
                  <select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)}>
                    <option value="待评测">待评测</option>
                    <option value="已记录">已记录</option>
                    <option value="需复测">需复测</option>
                  </select>
                </label>
              </div>
              <label>
                <small>系统输出</small>
                <textarea
                  rows={4}
                  value={draftOutput}
                  placeholder="系统输出摘要"
                  onChange={(event) => setDraftOutput(event.target.value)}
                />
              </label>
              <div className="evaluation-admin-inline">
                <label>
                  <small>人工评分</small>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={draftScore}
                    onChange={(event) => setDraftScore(Number(event.target.value))}
                  />
                </label>
                <label>
                  <small>评审人</small>
                  <input
                    value={draftReviewer}
                    onChange={(event) => setDraftReviewer(event.target.value)}
                  />
                </label>
              </div>
              <label>
                <small>问题记录</small>
                <textarea
                  rows={2}
                  value={draftIssues}
                  placeholder="事实性、引用、评分口径或交互问题"
                  onChange={(event) => setDraftIssues(event.target.value)}
                />
              </label>
              <button onClick={submitEvaluationArtifact} disabled={loading || !canSubmitEvaluation}>
                {loading ? "保存中" : "保存案例与记录"}
              </button>
              <button onClick={onExportReport} disabled={exportLoading}>
                {exportLoading ? "导出中" : "导出 Markdown"}
              </button>
              {exportResult && <small>{exportResult}</small>}
            </div>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <span className="section-label">输出记录</span>
            <h2>完整评测记录</h2>
          </div>
          <span className="muted">{filteredRecords.length}/{dashboard.records.length} 条记录</span>
        </div>
        <div className="eval-record-toolbar" aria-label="输出记录筛选">
          <label className="eval-search-field">
            <span>关键词</span>
            <input
              value={recordQuery}
              placeholder="场景、问题、输出、问题记录或评审人"
              onChange={(event) => setRecordQuery(event.target.value)}
            />
          </label>
          <label>
            <span>场景</span>
            <select
              value={recordScenarioFilter}
              onChange={(event) => setRecordScenarioFilter(event.target.value)}
            >
              <option value="all">全部场景</option>
              {recordScenarios.map((scenario) => (
                <option key={scenario} value={scenario}>
                  {scenario}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>分数</span>
            <select
              value={recordScoreFilter}
              onChange={(event) =>
                setRecordScoreFilter(event.target.value as "all" | "risk" | "pass" | "excellent")
              }
            >
              <option value="all">全部分数</option>
              <option value="risk">80 分以下</option>
              <option value="pass">80-89 分</option>
              <option value="excellent">90 分以上</option>
            </select>
          </label>
          <label>
            <span>每页</span>
            <select
              value={recordPageSize}
              onChange={(event) => setRecordPageSize(Number(event.target.value))}
            >
              <option value={5}>5 条</option>
              <option value={10}>10 条</option>
              <option value={20}>20 条</option>
            </select>
          </label>
          <button type="button" disabled={activeRecordFilterCount === 0} onClick={clearRecordFilters}>
            清除筛选
          </button>
        </div>
        <div className="eval-filter-summary">
          <span>{filteredRecords.length} 条当前可见</span>
          <span>
            第 {currentRecordPage}/{recordPageCount} 页
          </span>
          {filteredRecords.length > 0 && (
            <span>
              显示 {recordStartIndex + 1}-{Math.min(recordStartIndex + recordPageSize, filteredRecords.length)}
            </span>
          )}
          {activeRecordFilterCount > 0 && <strong>{activeRecordFilterCount} 个筛选条件</strong>}
        </div>
        <div className="eval-record-list">
          {pagedRecords.map((record) => (
            <article className="eval-record" key={record.record_id}>
              <div className="eval-record-head">
                <div>
                  <strong>{record.scenario}</strong>
                  <span>{record.input_question}</span>
                </div>
                <b>{record.manual_score}</b>
              </div>
              <p>{record.system_output}</p>
              <div className="eval-citations">
                {record.citations.map((citation) => (
                  <small key={`${record.record_id}-${citation.title}`}>
                    {citation.title} · {citation.path}
                  </small>
                ))}
              </div>
              <footer>
                <span>{record.issue_notes}</span>
                <small>
                  {record.reviewer} · {record.evaluated_at}
                </small>
              </footer>
            </article>
          ))}
          {!pagedRecords.length && (
            <ActionEmptyState
              label="输出记录"
              title="没有匹配的输出记录"
              text="调整场景、分数区间或关键词后再查看。"
              action="清除筛选"
              onAction={clearRecordFilters}
            />
          )}
        </div>
        {filteredRecords.length > 0 && (
          <div className="eval-pagination" aria-label="输出记录分页">
            <button
              type="button"
              disabled={currentRecordPage <= 1}
              onClick={() => setRecordPage((page) => Math.max(1, page - 1))}
            >
              上一页
            </button>
            <div>
              {visibleRecordPages.map((page) => (
                <button
                  key={page}
                  type="button"
                  className={page === currentRecordPage ? "active" : ""}
                  onClick={() => setRecordPage(page)}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={currentRecordPage >= recordPageCount}
              onClick={() => setRecordPage((page) => Math.min(recordPageCount, page + 1))}
            >
              下一页
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function AcademicDirectory({
  courses,
  classes,
  students,
  isAdmin,
  importLoading,
  importResult,
  onImportAcademicData,
  onLocalTeacherSession,
}: {
  courses: CourseListResponse;
  classes: ClassListResponse;
  students: StudentListResponse;
  isAdmin: boolean;
  importLoading: boolean;
  importResult: string | null;
  onImportAcademicData: (payload: AcademicImportRequest) => void;
  onLocalTeacherSession: () => void;
}) {
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("all");
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [selectedDirection, setSelectedDirection] = useState("all");
  const [importCourseId, setImportCourseId] = useState("course_school_ai_2026");
  const [importCourseName, setImportCourseName] = useState("AI 应用开发");
  const [importTerm, setImportTerm] = useState("2025-2026 春季学期");
  const [importTeacherId, setImportTeacherId] = useState("teacher_school_001");
  const [importTeacherName, setImportTeacherName] = useState("王老师");
  const [importTeacherNo, setImportTeacherNo] = useState("T-SCHOOL-001");
  const [importCourseDescription, setImportCourseDescription] =
    useState("面向项目实践、RAG 应用和智能体协作完成综合实践。");
  const [importClassId, setImportClassId] = useState("class_school_ai_2024_01");
  const [importClassName, setImportClassName] = useState("2024 级人工智能 1 班");
  const [importGrade, setImportGrade] = useState("2024");
  const [importMajor, setImportMajor] = useState("人工智能");
  const [importStudentId, setImportStudentId] = useState("student_school_001");
  const [importStudentName, setImportStudentName] = useState("赵清河");
  const [importStudentNo, setImportStudentNo] = useState("2024019901");
  const [importTargetPath, setImportTargetPath] = useState("AI 应用开发");
  const [importTags, setImportTags] = useState("RAG、智能体、项目实践");
  const normalizedQuery = directoryQuery.trim().toLowerCase();
  const courseById = new Map(courses.courses.map((course) => [course.course_id, course]));
  const classById = new Map(classes.classes.map((classItem) => [classItem.class_id, classItem]));
  const directions = Array.from(new Set(students.students.map((student) => student.target_path)))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "zh-CN"));
  const studentsWithTags = students.students.filter((student) => student.tags.length > 0).length;
  const studentsWithDirection = students.students.filter((student) => student.target_path.trim()).length;
  const averageClassSize = classes.classes.length
    ? Math.round(students.students.length / classes.classes.length)
    : 0;
  const filteredCourses = courses.courses.filter((course) => {
    const matchesCourse = selectedCourseId === "all" || course.course_id === selectedCourseId;
    const matchesQuery =
      !normalizedQuery ||
      [course.name, course.term, course.teacher_name, course.description]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    return matchesCourse && matchesQuery;
  });
  const filteredClasses = classes.classes.filter((classItem) => {
    const course = courseById.get(classItem.course_id);
    const matchesCourse = selectedCourseId === "all" || classItem.course_id === selectedCourseId;
    const matchesClass = selectedClassId === "all" || classItem.class_id === selectedClassId;
    const matchesQuery =
      !normalizedQuery ||
      [
        classItem.name,
        classItem.major,
        classItem.grade,
        classItem.student_count,
        course?.name,
        course?.teacher_name,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    return matchesCourse && matchesClass && matchesQuery;
  });
  const filteredStudents = students.students.filter((student) => {
    const classItem = classById.get(student.class_id);
    const course = classItem ? courseById.get(classItem.course_id) : undefined;
    const matchesCourse = selectedCourseId === "all" || classItem?.course_id === selectedCourseId;
    const matchesClass = selectedClassId === "all" || student.class_id === selectedClassId;
    const matchesDirection =
      selectedDirection === "all" || student.target_path === selectedDirection;
    const matchesQuery =
      !normalizedQuery ||
      [
        student.name,
        student.student_no,
        student.student_id,
        student.target_path,
        student.tags.join(" "),
        classItem?.name,
        course?.name,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    return matchesCourse && matchesClass && matchesDirection && matchesQuery;
  });
  const activeDirectoryFilterCount = [
    directoryQuery.trim(),
    selectedCourseId !== "all",
    selectedClassId !== "all",
    selectedDirection !== "all",
  ].filter(Boolean).length;

  function clearDirectoryFilters() {
    setDirectoryQuery("");
    setSelectedCourseId("all");
    setSelectedClassId("all");
    setSelectedDirection("all");
  }

  const importTagList = splitProfileItems(importTags);
  const canImportAcademicData = Boolean(
    importCourseId.trim() &&
      importCourseName.trim() &&
      importTeacherId.trim() &&
      importTeacherName.trim() &&
      importClassId.trim() &&
      importClassName.trim() &&
      importStudentId.trim() &&
      importStudentName.trim() &&
      importStudentNo.trim(),
  );

  function submitAcademicImport() {
    if (!canImportAcademicData) return;
    onImportAcademicData({
      courses: [
        {
          course_id: importCourseId.trim(),
          name: importCourseName.trim(),
          term: importTerm.trim(),
          teacher_id: importTeacherId.trim(),
          teacher_name: importTeacherName.trim(),
          teacher_no: importTeacherNo.trim() || undefined,
          description: importCourseDescription.trim(),
        },
      ],
      classes: [
        {
          class_id: importClassId.trim(),
          course_id: importCourseId.trim(),
          name: importClassName.trim(),
          grade: importGrade.trim(),
          major: importMajor.trim(),
        },
      ],
      students: [
        {
          student_id: importStudentId.trim(),
          name: importStudentName.trim(),
          student_no: importStudentNo.trim(),
          class_id: importClassId.trim(),
          course_ids: [importCourseId.trim()],
          target_path: importTargetPath.trim() || "软件项目实践",
          tags: importTagList,
        },
      ],
    });
  }

  return (
    <>
      <section className="academic-hero">
        <div>
          <span className="section-label">课程与班级</span>
          <h2>学校真实使用的基础数据入口</h2>
          <p>课程、班级和学生列表共同构成教师看板、项目分析报告和学生画像的授权边界。</p>
        </div>
        <div className="academic-metrics">
          <article className="metric">
            <span>课程</span>
            <strong>{courses.courses.length}</strong>
            <small>已接入课程</small>
          </article>
          <article className="metric">
            <span>学生</span>
            <strong>{students.students.length}</strong>
            <small>已接入学生</small>
          </article>
        </div>
      </section>

      <section className="academic-command-panel">
        <div className="academic-command-main">
          <span className="section-label">目录数据总览</span>
          <h2>授权边界与数据覆盖</h2>
          <p>当前筛选会同步影响课程、班级和学生列表，便于核对教师看板和学生画像的基础数据范围。</p>
        </div>
        <div className="academic-command-metrics" aria-label="目录数据覆盖指标">
          <article>
            <span>当前课程</span>
            <strong>{filteredCourses.length}</strong>
            <small>共 {courses.courses.length} 门</small>
          </article>
          <article>
            <span>当前班级</span>
            <strong>{filteredClasses.length}</strong>
            <small>平均 {averageClassSize} 人/班</small>
          </article>
          <article>
            <span>方向覆盖</span>
            <strong>{directions.length}</strong>
            <small>{studentsWithDirection}/{students.students.length} 名学生已记录</small>
          </article>
          <article>
            <span>标签覆盖</span>
            <strong>{studentsWithTags}</strong>
            <small>用于画像和组队匹配</small>
          </article>
        </div>
      </section>

      <section className="panel academic-filter-panel">
        <div className="panel-header">
          <div>
            <span className="section-label">目录检索</span>
            <h2>按课程、班级、学生和方向定位基础数据</h2>
          </div>
          <button
            type="button"
            disabled={activeDirectoryFilterCount === 0}
            onClick={clearDirectoryFilters}
          >
            清除筛选
          </button>
        </div>
        <div className="academic-filter-grid">
          <label className="academic-search-field">
            <span>关键词</span>
            <input
              value={directoryQuery}
              placeholder="课程、教师、班级、姓名、学号或标签"
              onChange={(event) => setDirectoryQuery(event.target.value)}
            />
          </label>
          <label>
            <span>课程</span>
            <select
              value={selectedCourseId}
              onChange={(event) => {
                setSelectedCourseId(event.target.value);
                setSelectedClassId("all");
              }}
            >
              <option value="all">全部课程</option>
              {courses.courses.map((course) => (
                <option key={course.course_id} value={course.course_id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>班级</span>
            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
            >
              <option value="all">全部班级</option>
              {classes.classes
                .filter(
                  (classItem) =>
                    selectedCourseId === "all" || classItem.course_id === selectedCourseId,
                )
                .map((classItem) => (
                  <option key={classItem.class_id} value={classItem.class_id}>
                    {classItem.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>方向</span>
            <select
              value={selectedDirection}
              onChange={(event) => setSelectedDirection(event.target.value)}
            >
              <option value="all">全部方向</option>
              {directions.map((direction) => (
                <option key={direction} value={direction}>
                  {direction}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="academic-filter-summary">
          <span>{filteredCourses.length}/{courses.courses.length} 门课程</span>
          <span>{filteredClasses.length}/{classes.classes.length} 个班级</span>
          <span>{filteredStudents.length}/{students.students.length} 名学生</span>
          {activeDirectoryFilterCount > 0 && <strong>{activeDirectoryFilterCount} 个筛选条件</strong>}
        </div>
      </section>

      {isAdmin && (
        <section className="panel academic-import-panel">
          <div className="panel-header">
            <div>
              <span className="section-label">教学基础数据导入</span>
              <h2>接入课程、班级、教师和学生</h2>
            </div>
            <button onClick={submitAcademicImport} disabled={importLoading || !canImportAcademicData}>
              {importLoading ? "导入中" : "提交数据接入"}
            </button>
          </div>
          <div className="academic-import-form">
            <label>
              <span>课程 ID</span>
              <input value={importCourseId} onChange={(event) => setImportCourseId(event.target.value)} />
            </label>
            <label>
              <span>课程名称</span>
              <input value={importCourseName} onChange={(event) => setImportCourseName(event.target.value)} />
            </label>
            <label>
              <span>学期</span>
              <input value={importTerm} onChange={(event) => setImportTerm(event.target.value)} />
            </label>
            <label>
              <span>教师 ID</span>
              <input value={importTeacherId} onChange={(event) => setImportTeacherId(event.target.value)} />
            </label>
            <label>
              <span>教师姓名</span>
              <input value={importTeacherName} onChange={(event) => setImportTeacherName(event.target.value)} />
            </label>
            <label>
              <span>教师工号</span>
              <input value={importTeacherNo} onChange={(event) => setImportTeacherNo(event.target.value)} />
            </label>
            <label>
              <span>班级 ID</span>
              <input value={importClassId} onChange={(event) => setImportClassId(event.target.value)} />
            </label>
            <label>
              <span>班级名称</span>
              <input value={importClassName} onChange={(event) => setImportClassName(event.target.value)} />
            </label>
            <label>
              <span>年级</span>
              <input value={importGrade} onChange={(event) => setImportGrade(event.target.value)} />
            </label>
            <label>
              <span>专业</span>
              <input value={importMajor} onChange={(event) => setImportMajor(event.target.value)} />
            </label>
            <label>
              <span>学生 ID</span>
              <input value={importStudentId} onChange={(event) => setImportStudentId(event.target.value)} />
            </label>
            <label>
              <span>学生姓名</span>
              <input value={importStudentName} onChange={(event) => setImportStudentName(event.target.value)} />
            </label>
            <label>
              <span>学号</span>
              <input value={importStudentNo} onChange={(event) => setImportStudentNo(event.target.value)} />
            </label>
            <label>
              <span>目标方向</span>
              <input value={importTargetPath} onChange={(event) => setImportTargetPath(event.target.value)} />
            </label>
            <label className="academic-import-tags">
              <span>学生标签</span>
              <input
                value={importTags}
                placeholder="用顿号或逗号分隔"
                onChange={(event) => setImportTags(event.target.value)}
              />
            </label>
            <label className="academic-import-description">
              <span>课程说明</span>
              <textarea
                rows={3}
                value={importCourseDescription}
                onChange={(event) => setImportCourseDescription(event.target.value)}
              />
            </label>
          </div>
          <div className="academic-import-workflow">
            {importResult && (
              <div className="academic-import-result">
                <strong>导入结果</strong>
                <span>{importResult}</span>
              </div>
            )}
            <div className="academic-import-checklist" aria-label="导入字段预检">
              <strong>导入字段预检</strong>
              <span className={importCourseId.trim() && importCourseName.trim() ? "ready" : ""}>
                课程 ID 与课程名称
              </span>
              <span className={importTeacherId.trim() && importTeacherName.trim() ? "ready" : ""}>
                教师 ID、姓名与授课关系
              </span>
              <span className={importClassId.trim() && importClassName.trim() ? "ready" : ""}>
                班级 ID、专业与年级
              </span>
              <span className={importStudentId.trim() && importStudentNo.trim() ? "ready" : ""}>
                学生学号、姓名、方向与标签
              </span>
            </div>
            <div className="academic-import-steps" aria-label="数据接入步骤">
              {["填写基础数据", "提交数据接入", "核对授权范围", "以教师账号验收"].map((step, index) => (
                <article key={step}>
                  <b>{index + 1}</b>
                  <span>{step}</span>
                </article>
              ))}
            </div>
          </div>
          <div className="academic-import-actions">
            <button onClick={onLocalTeacherSession} disabled={importLoading}>
              以导入教师进入
            </button>
          </div>
        </section>
      )}

      <section className="panel-grid">
        <article className="panel">
          <span className="section-label">课程</span>
          <div className="academic-list">
            {filteredCourses.map((course) => (
              <div className="academic-card" key={course.course_id}>
                <strong>{course.name}</strong>
                <span>{course.term} · {course.teacher_name}</span>
                <p>{course.description}</p>
              </div>
            ))}
            {!filteredCourses.length && (
              <ActionEmptyState
                label="课程"
                title="没有匹配的课程"
                text="调整关键词或课程筛选后再查看。"
                action="清除筛选"
                onAction={clearDirectoryFilters}
              />
            )}
          </div>
        </article>

        <article className="panel">
          <span className="section-label">班级</span>
          <div className="academic-list">
            {filteredClasses.map((classItem) => (
              <div className="academic-card" key={`${classItem.course_id}-${classItem.class_id}`}>
                <strong>{classItem.name}</strong>
                <span>
                  {classItem.major} · {classItem.grade} ·{" "}
                  {courseById.get(classItem.course_id)?.name ?? "未关联课程"}
                </span>
                <p>{classItem.student_count} 名学生</p>
              </div>
            ))}
            {!filteredClasses.length && (
              <ActionEmptyState
                label="班级"
                title="没有匹配的班级"
                text="调整课程、班级或关键词筛选后再查看。"
                action="清除筛选"
                onAction={clearDirectoryFilters}
              />
            )}
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
          {filteredStudents.map((student) => {
            const classItem = classById.get(student.class_id);
            return (
            <article className="student-card" key={student.student_id}>
              <strong>{student.name}</strong>
              <span>
                {student.student_no} · {classItem?.name ?? "未关联班级"}
              </span>
              <p>{student.target_path}</p>
              <div>
                {student.tags.map((tag) => (
                  <small key={tag}>{tag}</small>
                ))}
              </div>
            </article>
            );
          })}
          {!filteredStudents.length && (
            <ActionEmptyState
              label="学生"
              title="没有匹配的学生"
              text="调整关键词、课程、班级或方向筛选后再查看。"
              action="清除筛选"
              onAction={clearDirectoryFilters}
            />
          )}
        </div>
      </section>
    </>
  );
}

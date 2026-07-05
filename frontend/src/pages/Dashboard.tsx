import { useEffect, useMemo, useState } from "react";

import { askAgent } from "../shared/api/agent";
import { fetchClasses, fetchCourses, fetchStudents, importAcademicData } from "../shared/api/academic";
import {
  analyzeRepositoryAssignment,
  createAssignment,
  exportAssignmentDashboard,
  fetchAssignmentDashboard,
  fetchAssignmentDashboardById,
  fetchAssignmentReport,
  fetchAssignments,
  uploadAssignmentArchive,
} from "../shared/api/assignments";
import {
  createDemoSession,
  createLocalSession,
  fetchDemoAccounts,
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
import { fetchStudentTasks, generateReview, saveTask } from "../shared/api/tasks";
import type { ChatMessage, ChatResponse } from "../shared/types/agent";
import type { ClassListResponse, CourseListResponse, StudentListResponse } from "../shared/types/academic";
import type {
  AssignmentDashboard,
  AssignmentItem,
  AssignmentReport,
} from "../shared/types/assignments";
import type { DemoAccount } from "../shared/types/auth";
import type { EvaluationDashboardResponse } from "../shared/types/evaluations";
import type {
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
  KnowledgeDocumentVersionsResponse,
  KnowledgeDocumentsResponse,
  KnowledgeSearchResponse,
} from "../shared/types/knowledge";
import type { ViewMode } from "../shared/types/navigation";
import type { LearningTask, ReviewResponse, TaskListResponse } from "../shared/types/tasks";

type AssignmentSubmissionPayload = {
  assignmentId: string;
  assignmentTitle: string;
  courseId: string;
  classId: string;
  studentId: string;
  description: string;
  archive?: File;
  repositoryUrl?: string;
};

const demoStudentId = "student_001";
const demoStudentAccount: DemoAccount = {
  user_id: demoStudentId,
  name: "林一舟",
  role: "student",
  title: "学生",
  default_view: "growth",
  authorized_courses: ["Web 应用开发", "算法设计与分析"],
  authorized_classes: ["2024 级计算机科学与技术 1 班"],
  modules: ["成长路径", "作业报告", "任务复盘", "知识库问答"],
};

function roleLabel(role: string) {
  if (role === "student") return "学生";
  if (role === "teacher") return "教师";
  if (role === "admin") return "管理员";
  return role;
}

function accountSubtitle(account: DemoAccount) {
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

function workspaceLabel(account: DemoAccount | null) {
  if (account?.role === "teacher") return "授课视角";
  if (account?.role === "admin") return "管理视角";
  return "学生端概览";
}

function workspaceTitle(account: DemoAccount | null) {
  if (!account) return demoStudentAccount.name;
  if (account.role === "teacher") return account.authorized_courses[0] ?? account.name;
  if (account.role === "admin") return "平台配置与资料维护";
  return account.name;
}

function workspaceDescription(account: DemoAccount | null) {
  if (account?.role === "teacher") {
    return "查看课程作业学情、作业报告、班级能力画像和教学改进建议。";
  }
  if (account?.role === "admin") {
    return "维护课程班级、知识库资料、评测记录和学校账号接入。";
  }
  return "从课程作业、能力画像、竞赛准备和组队建议形成学生成长闭环。";
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

function reportStudentIdForAccount(account: DemoAccount | null) {
  return account?.role === "student" ? account.user_id : demoStudentId;
}

export function Dashboard() {
  const [mode, setMode] = useState<ViewMode>("growth");
  const [report, setReport] = useState<AssignmentReport | null>(null);
  const [dashboard, setDashboard] = useState<AssignmentDashboard | null>(null);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [assignmentCreateLoading, setAssignmentCreateLoading] = useState(false);
  const [assignmentExportLoading, setAssignmentExportLoading] = useState(false);
  const [assignmentExportResult, setAssignmentExportResult] = useState<string | null>(null);
  const [studentReportLoading, setStudentReportLoading] = useState(false);
  const [archiveUploadLoading, setArchiveUploadLoading] = useState(false);
  const [archiveUploadResult, setArchiveUploadResult] = useState<string | null>(null);
  const [profile, setProfile] = useState<GrowthProfile | null>(null);
  const [profileEvidence, setProfileEvidence] = useState<ProfileEvidence | null>(null);
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
  const [knowledgeQuery, setKnowledgeQuery] = useState("作业 Rubric");
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeCreateLoading, setKnowledgeCreateLoading] = useState(false);
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [localAccounts, setLocalAccounts] = useState<DemoAccount[]>([]);
  const [currentAccount, setCurrentAccount] = useState<DemoAccount | null>(demoStudentAccount);
  const [currentToken, setCurrentToken] = useState("demo-token-student_001");
  const [taskList, setTaskList] = useState<TaskListResponse | null>(null);
  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [taskLoading, setTaskLoading] = useState(false);
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
  const [chatQuestion, setChatQuestion] = useState("如何准备算法竞赛？");
  const [chatResponse, setChatResponse] = useState<ChatResponse | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeStudentId =
    currentAccount?.role === "student" ? currentAccount.user_id : demoStudentId;

  async function loadStudentWorkspace(account: DemoAccount, token?: string) {
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
          reportData,
          dashboardData,
          assignmentsData,
          profileData,
          plansData,
          competitionCatalogData,
          teamStatusData,
          knowledgeData,
          searchData,
          accountsData,
          taskData,
          evaluationData,
          coursesData,
          classesData,
          studentsData,
        ] = await Promise.all([
          fetchAssignmentReport(
            "assignment_flask_mvp",
            demoStudentId,
            "demo-token-student_001",
          ),
          fetchAssignmentDashboard("demo-token-teacher_001"),
          fetchAssignments("demo-token-student_001"),
          fetchGrowthProfile(demoStudentId, "demo-token-student_001"),
          fetchLearningPlans(demoStudentId, "demo-token-student_001"),
          fetchCompetitionCatalog(),
          fetchTeamPoolStatus(demoStudentId, "demo-token-student_001"),
          fetchKnowledgeDocuments(),
          searchKnowledge("作业 Rubric"),
          fetchDemoAccounts(),
          fetchStudentTasks(demoStudentId, "demo-token-student_001"),
          fetchEvaluationDashboard(),
          fetchCourses(),
          fetchClasses(),
          fetchStudents(),
        ]);

        if (mounted) {
          setReport(reportData);
          setDashboard(dashboardData);
          setAssignments(assignmentsData.assignments);
          setProfile(profileData);
          setProfileEvidence(null);
          setPlan(plansData.plans[0] ?? null);
          setCompetitionCatalog(competitionCatalogData);
          setCompetitions(null);
          setCompetitionPreparation(null);
          setTeam(null);
          setCandidateScreening(null);
          setTeamRequest(null);
          setTeamStatus(teamStatusData);
          setKnowledgeDocs(knowledgeData);
          setKnowledgeSearch(searchData);
          setAccounts(accountsData.accounts);
          setLocalAccounts([]);
          setCurrentAccount(
            accountsData.accounts.find((account) => account.role === "student") ??
              demoStudentAccount,
          );
          setCurrentToken("demo-token-student_001");
          setTaskList(taskData);
          setEvaluationDashboard(evaluationData);
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

  const growthPayload =
    !loading &&
    !error &&
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
          planRevisionLoading,
          teamStatusLoading,
          planCreateLoading: planRevisionLoading,
          onRevisePlan: handleRevisePlan,
          onGeneratePlan: handleGeneratePlan,
          onGenerateCompetition: handleGenerateCompetition,
          onGenerateTeam: handleGenerateTeam,
          onUpdateTeamStatus: handleUpdateTeamStatus,
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
      setCurrentToken(session.token);
      const reportStudentId = reportStudentIdForAccount(session.account);
      const [nextReport, nextAssignments] = await Promise.all([
        fetchAssignmentReport("assignment_flask_mvp", reportStudentId, session.token),
        fetchAssignments(session.token),
      ]);
      setReport(nextReport);
      setAssignments(nextAssignments.assignments);
      if (session.account.role === "teacher" || session.account.role === "admin") {
        const nextDashboard = await fetchAssignmentDashboard(session.token);
        const nextCandidateScreening = await screenTeacherCandidates(session.token);
        setDashboard(nextDashboard);
        setCandidateScreening(nextCandidateScreening);
      } else {
        setCandidateScreening(null);
      }
      if (session.account.role === "student") {
        await loadStudentWorkspace(session.account, session.token);
      }
      if (session.account.role === "admin") {
        const nextLocalAccounts = await fetchLocalAccounts(session.token);
        setLocalAccounts(nextLocalAccounts.accounts);
      }
      setMode(session.account.default_view);
    } catch (err) {
      setError(err instanceof Error ? err.message : "身份切换失败");
    }
  }

  async function handleLocalAccountChange(userId: string) {
    try {
      setError(null);
      const session = await createLocalSession(userId);
      setCurrentAccount(session.account);
      setCurrentToken(session.token);
      const reportStudentId = reportStudentIdForAccount(session.account);
      const [nextReport, nextAssignments] = await Promise.all([
        fetchAssignmentReport("assignment_flask_mvp", reportStudentId, session.token),
        fetchAssignments(session.token),
      ]);
      setReport(nextReport);
      setAssignments(nextAssignments.assignments);
      if (session.account.role === "teacher" || session.account.role === "admin") {
        const nextDashboard = await fetchAssignmentDashboard(session.token);
        const nextCandidateScreening = await screenTeacherCandidates(session.token);
        setDashboard(nextDashboard);
        setCandidateScreening(nextCandidateScreening);
      } else {
        setCandidateScreening(null);
      }
      if (session.account.role === "student") {
        await loadStudentWorkspace(session.account, session.token);
      }
      if (session.account.role === "admin") {
        const nextLocalAccounts = await fetchLocalAccounts(session.token);
        setLocalAccounts(nextLocalAccounts.accounts);
      }
      setMode(session.account.default_view);
    } catch (err) {
      setError(err instanceof Error ? err.message : "学校账号切换失败");
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

  async function handleCreateKnowledgeDocument() {
    try {
      setKnowledgeCreateLoading(true);
      setError(null);
      const payload = {
        title: "课程项目复盘模板",
        source_type: "project_case",
        path: "软件项目实践",
        tags: ["复盘", "项目文档"],
        content: "课程项目复盘需要记录目标、完成情况、阻塞问题、下周任务和证据链接。",
        source_url: "https://example.edu/templates/review",
      };
      await createKnowledgeDocument(payload, currentToken);
      const [documents, search] = await Promise.all([
        fetchKnowledgeDocuments(),
        searchKnowledge(payload.title),
      ]);
      const created = documents.documents.find((document) => document.title === payload.title);
      if (created) {
        const versions = await fetchKnowledgeDocumentVersions(created.document_id);
        setKnowledgeVersions(versions);
      }
      setKnowledgeDocs(documents);
      setKnowledgeSearch(search);
      setKnowledgeQuery(payload.title);
      setMode("kb");
    } catch (err) {
      setError(err instanceof Error ? err.message : "知识库资料入库失败");
    } finally {
      setKnowledgeCreateLoading(false);
    }
  }

  async function handleUpdateKnowledgeDocument() {
    const editableDocument = knowledgeDocs?.documents.find((document) =>
      document.document_id.startsWith("custom_doc_"),
    );
    if (!editableDocument) {
      await handleCreateKnowledgeDocument();
      return;
    }
    try {
      setKnowledgeCreateLoading(true);
      setError(null);
      const title = "课程项目复盘模板 v2";
      const response = await updateKnowledgeDocument(editableDocument.document_id, {
        title,
        tags: ["复盘", "项目文档", "版本管理"],
        content: "课程项目复盘模板 v2 增加版本记录、维护人、最近更新时间和下线状态说明。",
        maintainer: "平台管理员",
      }, currentToken);
      const [documents, search, versions] = await Promise.all([
        fetchKnowledgeDocuments(),
        searchKnowledge(title),
        fetchKnowledgeDocumentVersions(response.document.document_id),
      ]);
      setKnowledgeDocs(documents);
      setKnowledgeSearch(search);
      setKnowledgeVersions(versions);
      setKnowledgeQuery(title);
      setMode("kb");
    } catch (err) {
      setError(err instanceof Error ? err.message : "知识库资料编辑失败");
    } finally {
      setKnowledgeCreateLoading(false);
    }
  }

  async function handleOfflineKnowledgeDocument() {
    const editableDocument = knowledgeDocs?.documents.find((document) =>
      document.document_id.startsWith("custom_doc_"),
    );
    if (!editableDocument) {
      await handleCreateKnowledgeDocument();
      return;
    }
    try {
      setKnowledgeCreateLoading(true);
      setError(null);
      const response = await offlineKnowledgeDocument(editableDocument.document_id, currentToken);
      const [documents, versions] = await Promise.all([
        fetchKnowledgeDocuments(),
        fetchKnowledgeDocumentVersions(response.document.document_id),
      ]);
      setKnowledgeDocs(documents);
      setKnowledgeVersions(versions);
      setMode("kb");
    } catch (err) {
      setError(err instanceof Error ? err.message : "知识库资料下线失败");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "学习计划更新失败");
    } finally {
      setPlanRevisionLoading(false);
    }
  }

  async function handleGeneratePlan() {
    try {
      setPlanRevisionLoading(true);
      setError(null);
      const generatedPlan = await generateLearningPlan(activeStudentId, currentToken);
      setPlan(generatedPlan);
      setMode("growth");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "组队建议生成失败");
    } finally {
      setTeamStatusLoading(false);
    }
  }

  function canAccessModule(module: string) {
    return currentAccount?.modules.includes(module) ?? true;
  }

  const canSwitchWorkspace = accounts.length > 1;

  async function handleUpdateTeamStatus(enabled: boolean) {
    try {
      setTeamStatusLoading(true);
      setError(null);
      const nextStatus = await updateTeamPoolStatus(activeStudentId, enabled, currentToken);
      setTeamStatus(nextStatus);
      const nextTeam = await recommendTeam(activeStudentId, currentToken);
      setTeam(nextTeam);
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
      const commonPayload = {
        assignmentTitle: payload.assignmentTitle,
        assignmentId: payload.assignmentId,
        studentId: isStudentSubmission ? activeStudentId : payload.studentId,
        courseId: payload.courseId,
        classId: payload.classId,
        description: payload.description,
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
          `已生成作业分析报告，${uploadedReport.code_structure.file_count} 个文件完成解析`,
        );
        setMode("student");
      } else {
        const nextDashboard = await fetchAssignmentDashboardById(
          uploadedReport.assignment_id,
          currentToken,
        );
        setDashboard(nextDashboard);
        setArchiveUploadResult(
          `${uploadedReport.student_name} 的 ${uploadedReport.code_structure.file_count} 个文件已分析`,
        );
        setMode("teacher");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "作业提交分析失败");
    } finally {
      setArchiveUploadLoading(false);
    }
  }

  async function handleCreateAssignment() {
    try {
      setAssignmentCreateLoading(true);
      setError(null);
      const created = await createAssignment(currentToken);
      const [nextAssignments, nextDashboard] = await Promise.all([
        fetchAssignments(currentToken),
        fetchAssignmentDashboardById(created.assignment_id, currentToken),
      ]);
      setAssignments(nextAssignments.assignments);
      setDashboard(nextDashboard);
      setMode("teacher");
    } catch (err) {
      setError(err instanceof Error ? err.message : "课程作业发布失败");
    } finally {
      setAssignmentCreateLoading(false);
    }
  }

  async function handleSelectAssignment(assignmentId: string) {
    try {
      setError(null);
      const nextDashboard = await fetchAssignmentDashboardById(assignmentId, currentToken);
      setDashboard(nextDashboard);
      setMode("teacher");
    } catch (err) {
      setError(err instanceof Error ? err.message : "作业看板切换失败");
    }
  }

  async function handleExportAssignment() {
    if (!dashboard) return;
    try {
      setAssignmentExportLoading(true);
      setAssignmentExportResult(null);
      setError(null);
      const exported = await exportAssignmentDashboard(dashboard.assignment_id, currentToken);
      const blob = new Blob([exported.markdown], { type: exported.content_type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exported.filename;
      link.click();
      URL.revokeObjectURL(url);
      setAssignmentExportResult(`${exported.filename} 已生成`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "作业报告导出失败");
    } finally {
      setAssignmentExportLoading(false);
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
      setError(err instanceof Error ? err.message : "学生作业报告切换失败");
    } finally {
      setStudentReportLoading(false);
    }
  }

  async function handleGenerateReview() {
    try {
      setTaskLoading(true);
      setError(null);
      const response = await generateReview(activeStudentId, currentToken);
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
      const task = await saveTask("补充一次课程作业自动化测试记录", activeStudentId, currentToken);
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

  async function handleCreateEvaluationArtifact() {
    try {
      setEvaluationLoading(true);
      setError(null);
      const caseResponse = await createEvaluationCase(
        {
          scenario: "竞赛准备计划",
          input_question: "为中国大学生计算机设计大赛生成 4 周准备计划",
          expected_focus: ["时间节点", "官方依据", "交付物"],
          priority: "P0",
          status: "已记录",
        },
        currentToken,
      );
      await createEvaluationRecord(
        {
          case_id: caseResponse.item_id,
          scenario: "竞赛准备计划",
          input_question: "为中国大学生计算机设计大赛生成 4 周准备计划",
          system_output: "系统生成 4 周准备计划，包含报名节点、作品交付物和官方依据。",
          manual_score: 88,
          issue_notes: "计划结构完整，引用依据明确。",
          reviewer: "项目评测组",
        },
        currentToken,
      );
      setEvaluationDashboard(await fetchEvaluationDashboard());
      setMode("evaluations");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "评测报告导出失败");
    } finally {
      setEvaluationExportLoading(false);
    }
  }

  async function handleAcademicImportSample() {
    const courseId = "course_school_ai_2026";
    const classId = "class_school_ai_2024_01";
    try {
      setAcademicImportLoading(true);
      setAcademicImportResult(null);
      setError(null);
      const response = await importAcademicData(
        {
          courses: [
            {
              course_id: courseId,
              name: "AI 应用开发",
              term: "2025-2026 春季学期",
              teacher_id: "teacher_school_001",
              teacher_name: "王老师",
              teacher_no: "T-SCHOOL-001",
              description: "面向课程项目、RAG 应用和智能体协作完成综合实践。",
            },
          ],
          classes: [
            {
              class_id: classId,
              course_id: courseId,
              name: "2024 级人工智能 1 班",
              grade: "2024",
              major: "人工智能",
            },
          ],
          students: [
            {
              student_id: "student_school_001",
              name: "赵清河",
              student_no: "2024019901",
              class_id: classId,
              target_path: "AI 应用开发",
              tags: ["RAG", "智能体", "项目实践"],
            },
          ],
        },
        currentToken,
      );
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
      const [nextDashboard, nextCandidateScreening] = await Promise.all([
        fetchAssignmentDashboard(session.token),
        screenTeacherCandidates(session.token),
      ]);
      setDashboard(nextDashboard);
      setCandidateScreening(nextCandidateScreening);
      setAcademicImportResult(`${session.account.name} 已通过本地账号进入系统`);
      setMode("teacher");
    } catch (err) {
      setError(err instanceof Error ? err.message : "教师账号登录失败，请先导入课程数据");
    } finally {
      setAcademicImportLoading(false);
    }
  }

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
          {canAccessModule("成长路径") && (
            <button
              className={mode === "growth" ? "active" : ""}
              onClick={() => setMode("growth")}
            >
              成长路径
            </button>
          )}
          {canAccessModule("作业报告") && (
            <button
              className={mode === "student" ? "active" : ""}
              onClick={() => setMode("student")}
            >
              作业报告
            </button>
          )}
          {canAccessModule("任务复盘") && (
            <button className={mode === "tasks" ? "active" : ""} onClick={() => setMode("tasks")}>
              任务复盘
            </button>
          )}
          {canAccessModule("知识库问答") && (
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
        </nav>

        <div className="side-note">
          <span>{workspaceLabel(currentAccount)}</span>
          <strong>{workspaceTitle(currentAccount)}</strong>
          <p>{workspaceDescription(currentAccount)}</p>
        </div>

        {currentAccount && (
          <div className="account-panel">
            <div className="identity-summary">
              <span>工作空间</span>
              <strong>{currentAccount.name}</strong>
              <small>{accountSubtitle(currentAccount)}</small>
            </div>
            {canSwitchWorkspace && (
              <>
                <label htmlFor="demo-account">切换工作空间</label>
                <select
                  id="demo-account"
                  value={currentToken.startsWith("demo-token-") ? currentAccount.user_id : ""}
                  onChange={(event) => {
                    if (event.target.value) {
                      handleAccountChange(event.target.value);
                    }
                  }}
                >
                  <option value="">学校统一身份</option>
                  {accounts.map((account) => (
                    <option key={account.user_id} value={account.user_id}>
                      {account.name} · {accountSubtitle(account)}
                    </option>
                  ))}
                </select>
              </>
            )}
            {localAccounts.length > 0 && (
              <>
                <label htmlFor="local-account">学校账号</label>
                <select
                  id="local-account"
                  value={
                    currentToken.startsWith("local-token-") ? currentAccount.user_id : ""
                  }
                  onChange={(event) => {
                    if (event.target.value) {
                      handleLocalAccountChange(event.target.value);
                    }
                  }}
                >
                  <option value="">选择已导入账号</option>
                  {localAccounts.map((account) => (
                    <option key={account.user_id} value={account.user_id}>
                      {account.name} · {accountSubtitle(account)}
                    </option>
                  ))}
                </select>
              </>
            )}
            <div className="account-scope">
              <strong>{roleLabel(currentAccount.role)}</strong>
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
                  ? "作业分析报告"
                  : mode === "growth"
                    ? "成长路径"
                    : mode === "tasks"
                      ? "任务复盘"
                      : mode === "evaluations"
                        ? "测试评测与输出记录"
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
              : mode === "academic" || mode === "evaluations"
                ? "刷新数据"
                : mode === "teacher"
                  ? "刷新学情"
                  : mode === "student"
                    ? "刷新报告"
                    : "刷新路径"}
          </button>
        </header>

        {loading && <div className="state-box">正在加载学习空间...</div>}
        {error && <div className="state-box error">当前操作未完成：{error}</div>}

        {!loading && !error && mode === "teacher" && dashboard && (
          <TeacherDashboard
            dashboard={dashboard}
            assignments={assignments}
            assignmentCreateLoading={assignmentCreateLoading}
            exportLoading={assignmentExportLoading}
            exportResult={assignmentExportResult}
            candidateScreening={candidateScreening}
            uploadLoading={archiveUploadLoading}
            uploadResult={archiveUploadResult}
            onCreateAssignment={handleCreateAssignment}
            onSelectAssignment={handleSelectAssignment}
            onExportAssignment={handleExportAssignment}
            onArchiveUpload={handleArchiveUpload}
          />
        )}

        {!loading && !error && mode === "student" && report && (
          <StudentReport
            report={report}
            assignments={assignments}
            loading={studentReportLoading}
            averageScore={averageScore}
            uploadLoading={archiveUploadLoading}
            uploadResult={archiveUploadResult}
            onSelectAssignment={handleSelectStudentReport}
            onArchiveUpload={handleArchiveUpload}
          />
        )}

        {!loading && !error && mode === "knowledge" && (
          <KnowledgeAssistant
            question={chatQuestion}
            response={chatResponse}
            loading={chatLoading}
            history={chatHistory}
            onQuestionChange={setChatQuestion}
            onAsk={handleAskAgent}
          />
        )}

        {growthPayload && <GrowthPath {...growthPayload} />}

        {!loading && !error && mode === "kb" && knowledgeDocs && (
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

        {!loading && !error && mode === "tasks" && taskList && (
          <TaskCenter
            taskList={taskList}
            review={review}
            loading={taskLoading}
            onSaveTask={handleSaveTask}
            onGenerateReview={handleGenerateReview}
          />
        )}

        {!loading && !error && mode === "evaluations" && evaluationDashboard && (
          <EvaluationDashboard
            dashboard={evaluationDashboard}
            isAdmin={currentAccount?.role === "admin"}
            loading={evaluationLoading}
            exportLoading={evaluationExportLoading}
            exportResult={evaluationExportResult}
            onCreateArtifact={handleCreateEvaluationArtifact}
            onExportReport={handleExportEvaluationReport}
          />
        )}

        {!loading && !error && mode === "academic" && courses && classes && students && (
          <AcademicDirectory
            courses={courses}
            classes={classes}
            students={students}
            isAdmin={currentAccount?.role === "admin"}
            importLoading={academicImportLoading}
            importResult={academicImportResult}
            onImportSample={handleAcademicImportSample}
            onLocalTeacherSession={handleLocalTeacherSession}
          />
        )}
      </section>
    </main>
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
  onCreateAssignment,
  onSelectAssignment,
  onExportAssignment,
  onArchiveUpload,
}: {
  dashboard: AssignmentDashboard;
  assignments: AssignmentItem[];
  assignmentCreateLoading: boolean;
  exportLoading: boolean;
  exportResult: string | null;
  candidateScreening: TeacherCandidateScreenResponse | null;
  uploadLoading: boolean;
  uploadResult: string | null;
  onCreateAssignment: () => void;
  onSelectAssignment: (assignmentId: string) => void;
  onExportAssignment: () => void;
  onArchiveUpload: (payload: AssignmentSubmissionPayload) => void;
}) {
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
      <InlineNotice label="生成说明" text="班级诊断会结合提交物、评分维度和共性问题生成，建议教师按课程要求复核。" />
      <section className="panel export-panel">
        <div>
          <span className="section-label">诊断报告</span>
          <h2>导出班级作业学情报告</h2>
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
            <span className="section-label">异常作业提示</span>
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
            <span className="section-label">作业报告</span>
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
  onCreateAssignment: () => void;
  onSelectAssignment: (assignmentId: string) => void;
}) {
  return (
    <section className="panel assignment-manager">
      <div className="panel-header">
        <div>
          <span className="section-label">课程作业</span>
          <h2>发布作业并切换学情看板</h2>
        </div>
        <button onClick={onCreateAssignment} disabled={loading}>
          {loading ? "发布中" : "发布课程作业"}
        </button>
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
  assignment_id: string;
  title: string;
  course_id: string;
  course_name: string;
  class_id: string;
  class_name: string;
};

function AssignmentArchiveUploader({
  assignment,
  variant,
  studentId,
  loading,
  result,
  onUpload,
}: {
  assignment: UploadAssignmentContext;
  variant: "student" | "teacher";
  studentId?: string;
  loading: boolean;
  result: string | null;
  onUpload: (payload: AssignmentSubmissionPayload) => void;
}) {
  const [sourceMode, setSourceMode] = useState<"zip" | "repo">("zip");
  const [assignmentTitle, setAssignmentTitle] = useState(assignment.title);
  const [targetStudentId, setTargetStudentId] = useState(studentId ?? "");
  const [description, setDescription] = useState(
    variant === "student"
      ? "提交课程作业代码，系统将提取代码结构、测试、文档和能力证据生成分析报告。"
      : "教师代录学生作业代码，系统提取代码、测试、文档和配置文件生成班级学情分析。",
  );
  const [archive, setArchive] = useState<File | null>(null);
  const [repositoryUrl, setRepositoryUrl] = useState("");

  useEffect(() => {
    setAssignmentTitle(assignment.title);
  }, [assignment.title]);

  useEffect(() => {
    setTargetStudentId(studentId ?? "");
  }, [studentId]);

  const canSubmit =
    !loading &&
    (variant === "student" || targetStudentId.trim()) &&
    assignmentTitle.trim() &&
    (sourceMode === "zip" ? archive : repositoryUrl.trim());
  const archiveTooLarge = Boolean(archive && archive.size > 5 * 1024 * 1024);
  const repositoryUrlInvalid =
    sourceMode === "repo" &&
    repositoryUrl.trim().length > 0 &&
    !/^https?:\/\/.+/i.test(repositoryUrl.trim());
  const validationMessage =
    sourceMode === "zip" && archiveTooLarge
      ? "zip 文件超过 5MB，请压缩后重新上传。"
      : repositoryUrlInvalid
        ? "仓库链接需要以 http:// 或 https:// 开头。"
        : !assignmentTitle.trim()
          ? "请填写作业标题。"
          : variant === "teacher" && !targetStudentId.trim()
            ? "请填写学生 ID。"
            : null;
  const canSubmitValidated = Boolean(canSubmit && !archiveTooLarge && !repositoryUrlInvalid);

  return (
    <section className={`panel upload-panel ${variant === "student" ? "student-upload-panel" : ""}`}>
      <div className="panel-header">
        <div>
          <span className="section-label">{variant === "student" ? "提交作业" : "作业上传分析"}</span>
          <h2>{variant === "student" ? "上传代码并生成分析报告" : "录入学生作业代码"}</h2>
        </div>
        <span className="muted">
          {assignment.course_name} · {assignment.class_name}
        </span>
      </div>
      <div className="upload-stepper" aria-label="作业分析流程">
        <span className={assignmentTitle.trim() ? "complete" : ""}>1 选择作业</span>
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
          2 提交代码
        </span>
        <span className={result ? "complete" : ""}>3 查看报告</span>
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
              onClick={() => setSourceMode(mode as "zip" | "repo")}
              disabled={loading}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          <span>作业标题</span>
          <input
            value={assignmentTitle}
            onChange={(event) => setAssignmentTitle(event.target.value)}
          />
        </label>
        {variant === "teacher" && (
          <label>
            <span>学生 ID</span>
            <input
              value={targetStudentId}
              placeholder="输入学号或系统学生 ID"
              onChange={(event) => setTargetStudentId(event.target.value)}
            />
          </label>
        )}
        <label className="upload-description">
          <span>提交说明</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
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
              placeholder="https://github.com/example/course-homework.git"
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
              ...sourcePayload,
            });
          }}
          disabled={!canSubmitValidated}
        >
          {loading ? "分析中" : "提交并分析"}
        </button>
      </div>
      {validationMessage && <p className="upload-validation">{validationMessage}</p>}
      <div className="upload-rules">
        <span>zip 最大 5MB</span>
        <span>支持公开 Git 仓库</span>
        <span>最多 80 个文本文件</span>
        <span>{variant === "student" ? "提交后进入作业报告" : "分析后进入班级看板"}</span>
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

function StudentReport({
  report,
  assignments,
  loading,
  averageScore,
  uploadLoading,
  uploadResult,
  onSelectAssignment,
  onArchiveUpload,
}: {
  report: AssignmentReport;
  assignments: AssignmentItem[];
  loading: boolean;
  averageScore: number;
  uploadLoading: boolean;
  uploadResult: string | null;
  onSelectAssignment: (assignmentId: string) => void;
  onArchiveUpload: (payload: AssignmentSubmissionPayload) => void;
}) {
  const highPriorityFindings = report.findings.filter((finding) => finding.severity === "high").length;
  const currentAssignment =
    assignments.find((assignment) => assignment.assignment_id === report.assignment_id) ?? {
      assignment_id: report.assignment_id,
      title: report.assignment_title,
      course_id: report.course_id,
      course_name: report.course_name,
      class_id: report.class_id,
      class_name: report.class_name,
    };

  return (
    <>
      <section className="student-report-overview">
        <div className="student-report-copy">
          <span className="section-label">{report.course_name}</span>
          <h2>{report.assignment_title}</h2>
          <p>{report.summary}</p>
        </div>
        <div className="student-report-stats">
          <article>
            <span>综合评分</span>
            <strong>{averageScore}</strong>
          </article>
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
        </div>
      </section>

      <AssignmentArchiveUploader
        assignment={currentAssignment}
        variant="student"
        studentId={report.student_id}
        loading={uploadLoading}
        result={uploadResult}
        onUpload={onArchiveUpload}
      />

      {assignments.length > 0 && (
        <section className="panel student-assignment-switcher">
          <div className="panel-header">
            <div>
              <span className="section-label">课程作业</span>
              <h2>选择作业报告</h2>
            </div>
            <span className="muted">{loading ? "加载中" : `${assignments.length} 个可查看作业`}</span>
          </div>
          <div className="assignment-list">
            {assignments.map((assignment) => (
              <button
                key={assignment.assignment_id}
                className={assignment.assignment_id === report.assignment_id ? "active" : ""}
                onClick={() => onSelectAssignment(assignment.assignment_id)}
                disabled={loading}
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
      )}

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
      <InlineNotice label="报告说明" text="评分是基于代码结构、测试、文档和问题证据形成的相对画像，用于帮助定位改进方向。" />

      <section className="code-structure-panel">
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

      <section className="panel analysis-trace-panel">
        <div className="panel-header">
          <div>
            <span className="section-label">分析过程</span>
            <h2>从文件解析到报告生成的分阶段轨迹</h2>
          </div>
          <span className="muted">
            {report.analysis_trace.length} 个分析节点
            {report.agent_task_id ? ` · ${report.agent_task_id}` : ""}
          </span>
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

      <section className="panel">
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
}: {
  question: string;
  response: ChatResponse | null;
  loading: boolean;
  history: ChatMessage[];
  onQuestionChange: (question: string) => void;
  onAsk: (question?: string) => void;
}) {
  const examples = ["如何准备算法竞赛？", "这次作业我应该先改哪里？", "AI 应用开发第一个项目做什么？"];

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
        <div className="conversation-meta">
          <span>{response?.context_summary ?? "当前为首轮问题。"}</span>
          <span>已记录 {Math.floor(history.length / 2)} 轮上下文</span>
        </div>
        <div className="quick-questions">
          {(response?.suggested_next_questions.length
            ? response.suggested_next_questions
            : examples
          ).map((example) => (
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
            {response?.is_uncertain && (
              <div className="citation-card citation-card-warning">
                <strong>资料不足</strong>
                <span>no_match</span>
                <p>当前知识库没有找到可引用资料，建议补充对应课程资料、竞赛通知或项目案例后再检索。</p>
              </div>
            )}
            {response?.citations.map((citation) => (
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
        </article>
      </section>
      <InlineNotice label="回答依据" text="回答会优先展示引用来源，事实性内容建议继续查看原始资料。" />
    </>
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
  planRevisionLoading,
  teamStatusLoading,
  planCreateLoading,
  onRevisePlan,
  onGeneratePlan,
  onGenerateCompetition,
  onGenerateTeam,
  onUpdateTeamStatus,
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
  planRevisionLoading: boolean;
  teamStatusLoading: boolean;
  planCreateLoading: boolean;
  onRevisePlan: (feedback: string) => void;
  onGeneratePlan: () => void;
  onGenerateCompetition: () => void;
  onGenerateTeam: () => void;
  onUpdateTeamStatus: (enabled: boolean) => void;
}) {
  return (
    <>
      <section className="growth-hero">
        <div>
          <span className="section-label">能力画像</span>
          <h2>
            {profile.student_name} · {profile.target_path}
          </h2>
          <p>
            {plan
              ? plan.overview
              : "先查看已有画像和证据，需要时再生成学习计划、竞赛建议或组队推荐。"}
          </p>
        </div>
        <div className="growth-actions">
          {profile.next_actions.map((action) => (
            <span key={action}>{action}</span>
          ))}
        </div>
      </section>
      <InlineNotice label="路径说明" text="页面打开时优先读取已有画像和记录；计划、竞赛和组队建议会在你点击后生成并保存。" />

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
                    <small key={label}>
                      {label}
                    </small>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          {profile.profile_summary && (
            <>
              <span className="section-label">基础画像采集</span>
              <div className="basic-profile-card">
                <strong>
                  {profile.profile_summary.grade} · {profile.profile_summary.major}
                </strong>
                <p>{profile.profile_summary.target_direction}</p>
                <small>{profile.profile_summary.weekly_hours} 小时/周 · 预计 5 分钟完成</small>
                <div>
                  {profile.profile_summary.skill_tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <small>
                  课程基础：{profile.profile_summary.course_foundation.join(" / ")}
                </small>
                {profile.profile_summary.github_url && (
                  <small>{profile.profile_summary.github_url}</small>
                )}
              </div>
            </>
          )}
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
              text="作业报告、训练记录和项目材料会持续补充到画像中。"
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
          text="系统会结合画像、目标方向和竞赛清单生成推荐与准备计划。"
          action="生成竞赛建议"
          loading={planRevisionLoading}
          onAction={onGenerateCompetition}
        />
      )}

      {plan ? (
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
                  onClick={() => onRevisePlan(feedback)}
                  disabled={planRevisionLoading}
                >
                  {feedback}
                </button>
              ),
            )}
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
          text="生成后会保存到当前学生账号，后续打开页面会直接读取。"
          action="生成学习计划"
          loading={planCreateLoading}
          onAction={onGeneratePlan}
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
              text="推荐会同时说明适合原因和需要补足的能力。"
              action="生成推荐"
              loading={planRevisionLoading}
              onAction={onGenerateCompetition}
            />
          )}
        </article>

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
            <small>{teamRequest.weekly_hours} 小时/周 · {teamRequest.communication}</small>
            </div>
          ) : (
            <ActionEmptyState
              label="未发布"
              title="创建组队需求卡片"
              text="生成后可进入推荐池，并用于匹配技能互补的同学。"
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
      </section>

      <section className="panel">
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
            text="推荐会基于技能互补、方向一致和项目经历匹配，联系方式默认不公开。"
            action="生成队友推荐"
            loading={teamStatusLoading}
            onAction={onGenerateTeam}
          />
        )}
      </section>
    </>
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
  onCreateDocument: () => void;
  onUpdateDocument: () => void;
  onOfflineDocument: () => void;
}) {
  const paths = Array.from(new Set(documents.documents.map((document) => document.path)));
  const sourceCount = (sourceType: string) =>
    documents.documents.filter((document) => document.source_type === sourceType).length;

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
        <div className="kb-action-panel">
          <span className="section-label">资料维护</span>
          <strong>课程项目复盘模板</strong>
          <small>支持新增、编辑、下线和版本记录。</small>
          <div className="kb-action-buttons">
            <button onClick={onCreateDocument} disabled={createLoading}>
              {createLoading ? "处理中" : "新增"}
            </button>
            <button onClick={onUpdateDocument} disabled={createLoading}>
              编辑
            </button>
            <button onClick={onOfflineDocument} disabled={createLoading}>
              下线
            </button>
          </div>
        </div>
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
                <small>
                  v{document.version} · {document.maintainer} · {document.updated_at} ·{" "}
                  {document.tags.join(" / ")}
                </small>
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
      <InlineNotice label="复盘说明" text="复盘会结合已完成任务和证据记录生成，适合每周更新一次。" />

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
  onCreateArtifact: () => void;
  onExportReport: () => void;
}) {
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
      <InlineNotice label="评测说明" text="评测中心用于记录测试案例、系统输出和问题记录，便于版本复现。" />

      <section className="panel-grid">
        <article className="panel wide">
          <div className="panel-header">
            <div>
              <span className="section-label">测试案例</span>
              <h2>覆盖问答、作业分析和推荐闭环</h2>
            </div>
            <span className="muted">{dashboard.cases.length} 个案例</span>
          </div>
          <div className="eval-case-list">
            {dashboard.cases.map((item) => (
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
          </div>
        </article>

        <article className="panel">
          <span className="section-label">评测口径</span>
          <div className="evaluation-rubric">
            <p>每条记录保留输入、系统输出、引用来源、人工评分和问题记录。</p>
            <p>事实性内容重点检查是否可追溯，推荐类内容重点检查是否解释适合原因与短板。</p>
          </div>
          {isAdmin && (
            <div className="evaluation-admin-card">
              <strong>维护评测记录</strong>
              <span>新增竞赛准备计划测试案例和输出记录。</span>
              <button onClick={onCreateArtifact} disabled={loading}>
                {loading ? "保存中" : "新增案例与记录"}
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
          <span className="muted">{dashboard.records.length} 条记录</span>
        </div>
        <div className="eval-record-list">
          {dashboard.records.map((record) => (
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
        </div>
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
  onImportSample,
  onLocalTeacherSession,
}: {
  courses: CourseListResponse;
  classes: ClassListResponse;
  students: StudentListResponse;
  isAdmin: boolean;
  importLoading: boolean;
  importResult: string | null;
  onImportSample: () => void;
  onLocalTeacherSession: () => void;
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
            <small>已接入课程</small>
          </article>
          <article className="metric">
            <span>学生</span>
            <strong>{students.students.length}</strong>
            <small>已接入学生</small>
          </article>
        </div>
      </section>

      {isAdmin && (
        <section className="panel academic-import-panel">
          <div className="panel-header">
            <div>
              <span className="section-label">教学基础数据导入</span>
              <h2>管理员导入课程、班级、教师和学生</h2>
            </div>
            <button onClick={onImportSample} disabled={importLoading}>
              {importLoading ? "导入中" : "导入课程数据"}
            </button>
          </div>
          <div className="academic-import-grid">
            <div>
              <strong>课程</strong>
              <span>AI 应用开发 · 2025-2026 春季学期</span>
            </div>
            <div>
              <strong>班级</strong>
              <span>2024 级人工智能 1 班</span>
            </div>
            <div>
              <strong>学生</strong>
              <span>赵清河 · AI 应用开发</span>
            </div>
            {importResult && (
              <div className="academic-import-result">
                <strong>导入结果</strong>
                <span>{importResult}</span>
              </div>
            )}
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

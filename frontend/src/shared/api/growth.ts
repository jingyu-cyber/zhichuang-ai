import type {
  CompetitionCatalogResponse,
  CompetitionPreparationPlan,
  CompetitionRecommendResponse,
  GrowthProfile,
  LearningPlan,
  LearningPlanListResponse,
  ProfileEvidence,
  TeacherCandidateScreenResponse,
  TeamPoolStatus,
  TeamRecommendResponse,
  TeamRequestCard,
} from "../types/growth";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function authHeaders(token?: string): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type BasicProfileSeed = {
  studentName?: string;
  targetDirection?: string;
};

export function fetchGrowthProfile(
  studentId = "student_001",
  token?: string,
): Promise<GrowthProfile> {
  return requestJson<GrowthProfile>(`/students/${studentId}/profile`, {
    headers: authHeaders(token),
  });
}

export function upsertBasicProfile(
  studentId = "student_001",
  token?: string,
  seed: BasicProfileSeed = {},
): Promise<GrowthProfile> {
  return requestJson<GrowthProfile>(`/students/${studentId}/profile`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({
      student_name: seed.studentName ?? "林一舟",
      grade: "大二",
      major: "计算机科学与技术",
      course_foundation: ["程序设计基础", "数据结构", "数据库系统"],
      skill_tags: ["Flask", "RAG", "GitHub", "README"],
      project_experiences: ["Flask Web 作业项目", "RAG 文档问答 Demo"],
      competition_experiences: ["蓝桥杯校内训练"],
      target_direction: seed.targetDirection ?? "AI 应用开发 / 软件项目实践",
      weekly_hours: 8,
      github_url: "https://github.com/demo/zhichuang-agent",
    }),
  });
}

export function addProfileEvidence(
  studentId = "student_001",
  token?: string,
): Promise<ProfileEvidence> {
  return requestJson<ProfileEvidence>(`/students/${studentId}/profile/evidence`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      dimension: "工程实践",
      source_type: "student_self_report",
      source_title: "学生补充自评",
      evidence_text: "补充了 Flask 作业测试截图和 README 运行说明。",
      confidence: 0.42,
    }),
  });
}

export function generateLearningPlan(
  studentId = "student_001",
  token?: string,
): Promise<LearningPlan> {
  return requestJson<LearningPlan>("/plans/generate", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      student_id: studentId,
      goal: "三个月内完成 AI 应用开发 Demo 并准备校级双创项目",
      weeks: 8,
    }),
  });
}

export function fetchLearningPlans(
  studentId = "student_001",
  token?: string,
): Promise<LearningPlanListResponse> {
  return requestJson<LearningPlanListResponse>(`/students/${studentId}/plans`, {
    headers: authHeaders(token),
  });
}

export function reviseLearningPlan(
  planId: string,
  feedback: string,
  studentId = "student_001",
  token?: string,
): Promise<LearningPlan> {
  return requestJson<LearningPlan>(`/plans/${planId}/revise`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      student_id: studentId,
      feedback,
      weeks: feedback.includes("时间不足") ? 4 : 8,
      weekly_hours: feedback.includes("时间不足") ? 3 : 8,
    }),
  });
}

export function recommendCompetitions(
  studentId = "student_001",
  token?: string,
): Promise<CompetitionRecommendResponse> {
  return requestJson<CompetitionRecommendResponse>("/competitions/recommend", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      student_id: studentId,
      target: "AI 应用开发与软件项目实践",
      available_weeks: 8,
    }),
  });
}

export function fetchCompetitionCatalog(): Promise<CompetitionCatalogResponse> {
  return requestJson<CompetitionCatalogResponse>("/competitions");
}

export function generateCompetitionPreparationPlan(
  studentId = "student_001",
  token?: string,
): Promise<CompetitionPreparationPlan> {
  return requestJson<CompetitionPreparationPlan>("/competitions/preparation-plan", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      student_id: studentId,
      competition_name: "中国大学生计算机设计大赛",
      weeks: 4,
      weekly_hours: 8,
    }),
  });
}

export function screenTeacherCandidates(
  token = "demo-token-teacher_001",
): Promise<TeacherCandidateScreenResponse> {
  return requestJson<TeacherCandidateScreenResponse>("/teacher/candidate-screening", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      target_name: "中国大学生计算机设计大赛",
      target_type: "competition",
      target_abilities: ["工程实践", "AI 与数据能力", "协作表达"],
      class_id: "class_cs_2024_01",
      min_score: 60,
    }),
  });
}

export function recommendTeam(
  studentId = "student_001",
  token?: string,
): Promise<TeamRecommendResponse> {
  return requestJson<TeamRecommendResponse>("/teams/recommend", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      student_id: studentId,
      project_goal: "做一个课程作业代码分析与教师看板 Demo",
    }),
  });
}

export function createTeamRequest(
  studentId = "student_001",
  token?: string,
): Promise<TeamRequestCard> {
  return requestJson<TeamRequestCard>("/teams/requests", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      student_id: studentId,
      competition_name: "中国大学生计算机设计大赛",
      project_direction: "AI 应用开发与教学智能体",
      missing_roles: ["前端与交互", "算法与评测"],
      expected_skills: ["React", "RAG", "测试评测"],
      weekly_hours: 8,
      communication: "每周一次线上同步，平时使用项目文档和任务看板沟通",
      team_status_enabled: true,
    }),
  });
}

export function fetchTeamPoolStatus(
  studentId = "student_001",
  token?: string,
): Promise<TeamPoolStatus> {
  return requestJson<TeamPoolStatus>(`/students/${studentId}/team-status`, {
    headers: authHeaders(token),
  });
}

export function updateTeamPoolStatus(
  studentId = "student_001",
  enabled: boolean,
  token?: string,
): Promise<TeamPoolStatus> {
  return requestJson<TeamPoolStatus>(`/students/${studentId}/team-status`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      team_status_enabled: enabled,
      contact_visible: false,
    }),
  });
}

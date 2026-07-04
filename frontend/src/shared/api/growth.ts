import type {
  CompetitionCatalogResponse,
  CompetitionRecommendResponse,
  GrowthProfile,
  LearningPlan,
  ProfileEvidence,
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

export function fetchGrowthProfile(studentId = "student_001"): Promise<GrowthProfile> {
  return requestJson<GrowthProfile>(`/students/${studentId}/profile`);
}

export function addProfileEvidence(studentId = "student_001"): Promise<ProfileEvidence> {
  return requestJson<ProfileEvidence>(`/students/${studentId}/profile/evidence`, {
    method: "POST",
    body: JSON.stringify({
      dimension: "工程实践",
      source_type: "student_self_report",
      source_title: "学生补充自评",
      evidence_text: "补充了 Flask 作业测试截图和 README 运行说明。",
      confidence: 0.42,
    }),
  });
}

export function generateLearningPlan(studentId = "student_001"): Promise<LearningPlan> {
  return requestJson<LearningPlan>("/plans/generate", {
    method: "POST",
    body: JSON.stringify({
      student_id: studentId,
      goal: "三个月内完成 AI 应用开发 Demo 并准备校级双创项目",
      weeks: 8,
    }),
  });
}

export function reviseLearningPlan(
  planId: string,
  feedback: string,
  studentId = "student_001",
): Promise<LearningPlan> {
  return requestJson<LearningPlan>(`/plans/${planId}/revise`, {
    method: "POST",
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
): Promise<CompetitionRecommendResponse> {
  return requestJson<CompetitionRecommendResponse>("/competitions/recommend", {
    method: "POST",
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

export function recommendTeam(studentId = "student_001"): Promise<TeamRecommendResponse> {
  return requestJson<TeamRecommendResponse>("/teams/recommend", {
    method: "POST",
    body: JSON.stringify({
      student_id: studentId,
      project_goal: "做一个课程作业代码分析与教师看板 Demo",
    }),
  });
}

export function createTeamRequest(studentId = "student_001"): Promise<TeamRequestCard> {
  return requestJson<TeamRequestCard>("/teams/requests", {
    method: "POST",
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

export function fetchTeamPoolStatus(studentId = "student_001"): Promise<TeamPoolStatus> {
  return requestJson<TeamPoolStatus>(`/students/${studentId}/team-status`);
}

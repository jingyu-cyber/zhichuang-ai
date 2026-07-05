export type LearningTask = {
  task_id: string;
  student_id: string;
  title: string;
  source: string;
  status: "todo" | "doing" | "done" | string;
  priority: "high" | "medium" | "low" | string;
  due_date: string;
  evidence_required: string;
  progress: number;
};

export type TaskListResponse = {
  student_id: string;
  total: number;
  completed: number;
  tasks: LearningTask[];
};

export type ReviewResponse = {
  review_id: string;
  student_id: string;
  period: string;
  summary: string;
  completed_count: number;
  risk: string;
  next_tasks: LearningTask[];
  ai_generated: boolean;
};

export type AgentTaskCreateRequest = {
  task_type: string;
  owner_id: string;
  input?: Record<string, unknown>;
};

export type AgentTaskStatus = {
  task_id: string;
  task_type: string;
  status: string;
  owner_id?: string | null;
  input: Record<string, unknown>;
  state: Record<string, unknown>;
  result_ref?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentTaskActionResponse = {
  task: AgentTaskStatus;
  message: string;
};

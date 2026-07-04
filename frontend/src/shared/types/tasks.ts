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

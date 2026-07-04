export type AssignmentScore = {
  dimension: string;
  score: number;
  summary: string;
  evidence: string[];
};

export type AssignmentFinding = {
  severity: "high" | "medium" | "low" | string;
  title: string;
  detail: string;
  suggestion: string;
};

export type CapabilityEvidence = {
  dimension: string;
  evidence: string;
  source: string;
};

export type CodeStructureSummary = {
  file_count: number;
  entry_files: string[];
  test_files: string[];
  documentation_files: string[];
  config_files: string[];
  detected_frameworks: string[];
  detected_capabilities: string[];
  risk_signals: string[];
};

export type Citation = {
  title: string;
  source_type: string;
  snippet: string;
};

export type AssignmentReport = {
  report_id: string;
  assignment_id: string;
  assignment_title: string;
  course_id: string;
  course_name: string;
  class_id: string;
  class_name: string;
  student_id: string;
  student_name: string;
  generated_at: string;
  summary: string;
  code_structure: CodeStructureSummary;
  scores: AssignmentScore[];
  findings: AssignmentFinding[];
  capability_evidence: CapabilityEvidence[];
  improvement_tasks: string[];
  citations: Citation[];
  ai_generated: boolean;
};

export type AssignmentReportSummary = {
  report_id: string;
  student_id: string;
  student_name: string;
  overall_score: number;
  status: string;
  summary: string;
};

export type AssignmentDashboardMetric = {
  label: string;
  value: string;
  trend?: string | null;
};

export type AssignmentDashboard = {
  assignment_id: string;
  assignment_title: string;
  course_id: string;
  course_name: string;
  class_id: string;
  class_name: string;
  generated_at: string;
  submitted_count: number;
  total_students: number;
  average_score: number;
  metrics: AssignmentDashboardMetric[];
  dimension_averages: AssignmentScore[];
  common_findings: AssignmentFinding[];
  reports: AssignmentReportSummary[];
  ai_generated: boolean;
};

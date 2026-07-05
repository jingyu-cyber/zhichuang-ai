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

export type CodeEvidenceSnippet = {
  path: string;
  module: string;
  capability: string;
  line_start: number;
  line_end: number;
  snippet: string;
};

export type CapabilityEvidence = {
  dimension: string;
  evidence: string;
  source: string;
};

export type AnalysisTraceStep = {
  node: string;
  title: string;
  status: string;
  summary: string;
  evidence: string[];
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
  evidence_snippets: CodeEvidenceSnippet[];
  capability_evidence: CapabilityEvidence[];
  analysis_trace: AnalysisTraceStep[];
  improvement_tasks: string[];
  citations: Citation[];
  access_scope: string;
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

export type AssignmentItem = {
  assignment_id: string;
  title: string;
  course_id: string;
  course_name: string;
  class_id: string;
  class_name: string;
  description: string;
  rubric_id?: string | null;
  created_at: string;
  submitted_count: number;
  access_scope: string;
};

export type AssignmentListResponse = {
  assignments: AssignmentItem[];
};

export type AssignmentExportResponse = {
  assignment_id: string;
  filename: string;
  content_type: string;
  markdown: string;
  generated_at: string;
  access_scope: string;
};

export type AssignmentDashboardMetric = {
  label: string;
  value: string;
  trend?: string | null;
};

export type TeachingSuggestion = {
  knowledge_point: string;
  class_evidence: string;
  suggested_activity: string;
  practice_task: string;
  expected_improvement: string;
};

export type AssignmentAnomaly = {
  severity: "high" | "medium" | "low" | string;
  title: string;
  affected_students: string[];
  evidence: string;
  suggested_action: string;
};

export type AbilityHeatmapCell = {
  student_id: string;
  student_name: string;
  dimension: string;
  score: number;
  level: "strong" | "stable" | "weak" | string;
};

export type DirectionDistributionItem = {
  direction: string;
  count: number;
  ratio: number;
};

export type DataCoverageMetric = {
  label: string;
  covered: number;
  total: number;
  ratio: number;
};

export type ClassAbilityProfile = {
  heatmap: AbilityHeatmapCell[];
  direction_distribution: DirectionDistributionItem[];
  data_coverage: DataCoverageMetric[];
  common_weaknesses: string[];
  summary: string;
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
  anomalies: AssignmentAnomaly[];
  teaching_suggestions: TeachingSuggestion[];
  class_profile: ClassAbilityProfile;
  reports: AssignmentReportSummary[];
  access_scope: string;
  ai_generated: boolean;
};

export type AssignmentUploadArchivePayload = {
  assignmentId?: string;
  assignmentTitle: string;
  archive: File;
  courseId?: string;
  classId?: string;
  studentId?: string;
  rubricId?: string;
  repositoryUrl?: string;
  description?: string;
};

export type RepositoryAnalysisPayload = {
  assignmentId?: string;
  assignmentTitle: string;
  courseId?: string;
  classId?: string;
  studentId?: string;
  repositoryUrl: string;
  description?: string;
};

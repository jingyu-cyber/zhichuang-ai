export type EvaluationCitation = {
  title: string;
  source_type: string;
  path: string;
  snippet: string;
};

export type EvaluationCase = {
  case_id: string;
  scenario: string;
  input_question: string;
  expected_focus: string[];
  priority: string;
  status: string;
};

export type EvaluationCaseCreate = {
  scenario: string;
  input_question: string;
  expected_focus: string[];
  priority: string;
  status: string;
};

export type EvaluationRecord = {
  record_id: string;
  case_id: string;
  scenario: string;
  input_question: string;
  system_output: string;
  citations: EvaluationCitation[];
  manual_score: number;
  issue_notes: string;
  reviewer: string;
  evaluated_at: string;
  ai_generated: boolean;
};

export type EvaluationRecordCreate = {
  case_id: string;
  scenario: string;
  input_question: string;
  system_output: string;
  citations?: EvaluationCitation[];
  manual_score: number;
  issue_notes: string;
  reviewer: string;
};

export type EvaluationUpsertResponse = {
  item_id: string;
  message: string;
};

export type EvaluationSummary = {
  total_cases: number;
  completed_records: number;
  average_score: number;
  pass_rate: number;
};

export type EvaluationDashboardResponse = {
  summary: EvaluationSummary;
  cases: EvaluationCase[];
  records: EvaluationRecord[];
};

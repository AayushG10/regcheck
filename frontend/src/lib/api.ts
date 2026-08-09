/**
 * Typed fetch client for the RegCheck FastAPI backend.
 * Every function maps 1:1 to a backend endpoint in backend/app/api/routes.py.
 */

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

export type Tier = "auto" | "evidence" | "judgment";
export type RuleStatus = "approved" | "needs_review";
export type Verdict = "PASS" | "FAIL" | "NOT_APPLICABLE";

export interface ClauseCitation {
  circular: string;
  para: string;
}

export interface Rule {
  id: string;
  clause_id: string;
  title: string;
  description: string;
  citation: ClauseCitation;
  category: string;
  check_type: string | null;
  params: Record<string, unknown>;
  confidence: number;
  tier: Tier;
  status: RuleStatus;
  amendable?: boolean;
  version: number;
  effective_from: string;
  effective_to: string | null;
  supersedes: string | null;
  drafted_by: string;
  approved_by: string | null;
  approved_at: string | null;
}

export interface CheckResult {
  rule_id: string;
  rule_title: string;
  rule_version: number;
  clause_id: string;
  citation: ClauseCitation;
  category: string;
  tier: Tier;
  verdict: Verdict;
  evidence: Record<string, unknown>;
  explanation: string;
}

export interface ReportResponse {
  broker_name: string;
  as_of_date: string;
  total_checked: number;
  passed: number;
  failed: number;
  results: CheckResult[];
}

export interface CoverageResponse {
  total: number;
  auto: number;
  evidence: number;
  judgment: number;
  coverage_pct: number;
}

export interface EarlyWarning {
  rule_id: string;
  rule_title: string;
  clause_id: string;
  citation: ClauseCitation;
  deadline_date: string;
  days_remaining: number;
  message: string;
}

export interface RemediationTask {
  id: string;
  rule_id: string;
  rule_title: string;
  clause_id: string;
  citation: ClauseCitation;
  owner: string;
  fix: string;
  due_date: string;
  priority: "high" | "medium" | "low";
}

export interface ClauseText {
  clause_id: string;
  para: string;
  title: string;
  text: string;
}

export interface CircularCorpus {
  circular_name: string;
  note: string;
  clauses: ClauseText[];
}

export interface ScorecardDiffEntry {
  rule_id: string;
  rule_title: string;
  before_verdict: Verdict;
  after_verdict: Verdict;
}

export interface ScorecardDiff {
  total_checked: number;
  before_passed: number;
  after_passed: number;
  changed_count: number;
  unchanged_count: number;
  changed: ScorecardDiffEntry[];
}

export interface AmendmentResult {
  rule_id: string;
  rule_title: string;
  clause_id: string;
  citation: ClauseCitation;
  original_params: Record<string, unknown>;
  amended_params: Record<string, unknown>;
  before: CheckResult;
  after: CheckResult;
  flipped: boolean;
  scorecard_diff: ScorecardDiff;
}

export interface CheckRun {
  run_id: string;
  run_at: string;
  as_of_date: string;
  engine_version: string;
  broker_name: string;
  total_checked: number;
  passed: number;
  failed: number;
  results: CheckResult[];
}

export type CheckRunSummary = Omit<CheckRun, "results">;

export interface AmendmentCommitResult {
  rule: Rule;
  run: CheckRun;
}

export interface AgenticDetectResult {
  matched_rule: Rule;
  proposal: {
    params: Record<string, unknown>;
    confidence: number;
    rationale: string;
  };
  provider_used: string;
}

export interface ExtractionResponse {
  clause_id: string;
  extraction: {
    title: string;
    description: string;
    category: string;
    check_type: string | null;
    params: Record<string, unknown>;
    confidence: number;
    tier: Tier;
    schema_warning?: string | null;
  };
  final_tier: Tier;
  final_status: RuleStatus;
  provider_used: string;
  raw_llm_output: string;
  schema_warning?: string | null;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? `Request to ${path} failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),
  getClauses: () => request<CircularCorpus>("/api/clauses"),
  getRules: () => request<Rule[]>("/api/rules"),
  getRule: (id: string) => request<Rule>(`/api/rules/${id}`),
  getRuleHistory: (id: string) => request<Rule[]>(`/api/rules/${id}/history`),
  approveRule: (id: string, status: RuleStatus = "approved", approved_by?: string) =>
    request<Rule>(`/api/rules/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ status, ...(approved_by ? { approved_by } : {}) }),
    }),
  extractRule: (clause_id: string, llm_tier: "fast" | "strong" = "fast") =>
    request<ExtractionResponse>("/api/extract", { method: "POST", body: JSON.stringify({ clause_id, llm_tier }) }),
  runChecks: () => request<CheckRun>("/api/checks/run", { method: "POST" }),
  getReport: () => request<ReportResponse>("/api/report"),
  getCoverage: () => request<CoverageResponse>("/api/coverage"),
  getWarnings: () => request<EarlyWarning[]>("/api/warnings"),
  getRemediation: () => request<RemediationTask[]>("/api/remediation"),
  simulateAmendment: (rule_id: string, param_overrides: Record<string, unknown>) =>
    request<AmendmentResult>("/api/amendment/simulate", {
      method: "POST",
      body: JSON.stringify({ rule_id, param_overrides }),
    }),
  commitAmendment: (rule_id: string, param_overrides: Record<string, unknown>, approved_by?: string, source?: string) =>
    request<AmendmentCommitResult>("/api/amendment/commit", {
      method: "POST",
      body: JSON.stringify({
        rule_id,
        param_overrides,
        ...(approved_by ? { approved_by } : {}),
        ...(source ? { source } : {}),
      }),
    }),
  getBroker: () => request<Record<string, unknown>>("/api/broker"),
  resetDemo: () => request<{ status: string }>("/api/reset", { method: "POST" }),
  getRuns: () => request<CheckRunSummary[]>("/api/runs"),
  getRun: (runId: string) => request<CheckRun>(`/api/runs/${runId}`),
  agenticDetect: (notice_text: string, llm_tier: "fast" | "strong" = "fast") =>
    request<AgenticDetectResult>("/api/agentic/detect", {
      method: "POST",
      body: JSON.stringify({ notice_text, llm_tier }),
    }),
};

export { ApiError };

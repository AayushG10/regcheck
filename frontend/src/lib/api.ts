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
}

export interface CheckResult {
  rule_id: string;
  rule_title: string;
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
  };
  final_tier: Tier;
  final_status: RuleStatus;
  provider_used: string;
  raw_llm_output: string;
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
  approveRule: (id: string, status: RuleStatus = "approved") =>
    request<Rule>(`/api/rules/${id}/approve`, { method: "POST", body: JSON.stringify({ status }) }),
  extractRule: (clause_id: string, llm_tier: "fast" | "strong" = "fast") =>
    request<ExtractionResponse>("/api/extract", { method: "POST", body: JSON.stringify({ clause_id, llm_tier }) }),
  runChecks: () => request<ReportResponse>("/api/checks/run", { method: "POST" }),
  getReport: () => request<ReportResponse>("/api/report"),
  getCoverage: () => request<CoverageResponse>("/api/coverage"),
  getWarnings: () => request<EarlyWarning[]>("/api/warnings"),
  getRemediation: () => request<RemediationTask[]>("/api/remediation"),
  simulateAmendment: (rule_id: string, param_overrides: Record<string, unknown>) =>
    request<AmendmentResult>("/api/amendment/simulate", {
      method: "POST",
      body: JSON.stringify({ rule_id, param_overrides }),
    }),
  getBroker: () => request<Record<string, unknown>>("/api/broker"),
};

export { ApiError };

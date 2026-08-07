import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, ShieldAlert, ShieldCheck, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "./PageHeader";
import ErrorCard from "./ErrorCard";
import ClauseLink from "./ClauseLink";
import { api, ApiError, type Rule } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const TIER_BADGE = { auto: "teal", evidence: "default", judgment: "warning" } as const;

export default function RulesExplorer() {
  const { data, loading, error, refetch } = useApi(() => api.getRules());
  const [extracting, setExtracting] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  async function handleReExtract(rule: Rule) {
    setExtracting(rule.id);
    try {
      const result = await api.extractRule(rule.clause_id, "fast");
      toast.success(`Re-extracted "${result.extraction.title}"`, {
        description: `Confidence ${result.extraction.confidence.toFixed(2)} · ${result.provider_used}`,
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Extraction failed";
      toast.error("LLM extraction unavailable", { description: message });
    } finally {
      setExtracting(null);
    }
  }

  async function handleApprove(rule: Rule) {
    setApproving(rule.id);
    try {
      await api.approveRule(rule.id, "approved");
      toast.success(`Approved "${rule.title}"`, {
        description: "This rule can now run in the deterministic engine.",
      });
      refetch();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Approval failed";
      toast.error("Could not approve rule", { description: message });
    } finally {
      setApproving(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Rules Explorer"
        subtitle="Every structured rule the extraction stage produced, with its confidence score and source clause."
        onRefresh={refetch}
      />

      {error ? (
        <ErrorCard message={error} onRetry={refetch} />
      ) : loading || !data ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((rule) => (
            <Card key={rule.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{rule.title}</span>
                    <Badge variant={TIER_BADGE[rule.tier]}>{rule.tier}</Badge>
                    {rule.status === "needs_review" ? (
                      <Badge variant="warning"><ShieldAlert className="h-3 w-3" /> needs review</Badge>
                    ) : (
                      <Badge variant="pass"><ShieldCheck className="h-3 w-3" /> approved</Badge>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{rule.description}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <ClauseLink clauseId={rule.clause_id} citation={rule.citation} />
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-400">{rule.category}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <ConfidenceBar confidence={rule.confidence} />
                  <div className="flex gap-2">
                    {rule.status === "needs_review" && (
                      <Button
                        size="sm"
                        disabled={approving === rule.id}
                        onClick={() => handleApprove(rule)}
                      >
                        <Check className="h-3.5 w-3.5" />
                        {approving === rule.id ? "Approving…" : "Approve"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={extracting === rule.id}
                      onClick={() => handleReExtract(rule)}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {extracting === rule.id ? "Extracting…" : "Re-extract via LLM"}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          <Card className="p-5 text-xs text-slate-400">
            <CardContent className="p-0">
              "Re-extract via LLM" re-runs the ingest → extract → triage pipeline for that clause through
              the configured provider (Groq fast tier by default). If no API key is set in{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">backend/.env</code>, it
              will show a clear error — the dashboard's scorecard keeps working from the pre-approved seed
              rules either way.
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = confidence >= 0.85 ? "#0d9488" : "#f59e0b";
  return (
    <div className="w-32 text-right">
      <div className="mb-1 text-xs font-semibold" style={{ color }}>{pct}% confidence</div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={cn("h-full rounded-full")} style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

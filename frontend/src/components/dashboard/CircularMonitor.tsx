import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Radar, Sparkles, ArrowRight, ShieldCheck, History, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import PageHeader from "./PageHeader";
import ClauseLink from "./ClauseLink";
import { api, ApiError, type AgenticDetectResult } from "@/lib/api";

const SAMPLE_NOTICES = [
  {
    label: "VAPT tightened to quarterly",
    text: "SEBI Circular No. SEBI/HO/MIRSD/2026/045 dated August 5, 2026: In partial modification of para 18.5.5.8-9 of the Master Circular for Stock Brokers, Qualified Stock Brokers shall henceforth conduct Vulnerability Assessment and Penetration Testing (VAPT) at least once every three months instead of six months, effective immediately, in view of rising cybersecurity incidents in the securities market.",
  },
  {
    label: "Net worth threshold raised",
    text: "SEBI Circular No. SEBI/HO/MIRSD/2026/051 dated August 6, 2026: In partial modification of para 15.8.1.1 of the Master Circular for Stock Brokers, the minimum net worth a stock broker must maintain at all times is revised from 75% to 85% of the applicable prescribed minimum, effective from the next reporting cycle.",
  },
  {
    label: "Upload window shortened",
    text: "SEBI Circular No. SEBI/HO/MIRSD/2026/058 dated August 7, 2026: In partial modification of para 15.9.1.4 of the Master Circular for Stock Brokers, stock brokers shall upload client funds and securities balance data to the exchange within 5 days from the end of every month, instead of the previously prescribed 7 days.",
  },
];

/**
 * The full agentic loop, end to end: a new SEBI circular notice comes in
 * (here, simulated) -> pipeline/monitor.py + diff.py deterministically
 * identify which existing rule it amends -> pipeline/propose.py has the
 * LLM draft the parameter change -> a human approves -> the same
 * POST /api/amendment/commit used by the manual simulator creates a new
 * rule version and a fresh audit-trail run. No one has to manually
 * re-read the circular and figure out which check to update by hand.
 */
export default function CircularMonitor() {
  const [noticeText, setNoticeText] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [result, setResult] = useState<AgenticDetectResult | null>(null);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  async function handleDetect() {
    if (!noticeText.trim()) return;
    setDetecting(true);
    setDetectError(null);
    setResult(null);
    setApproved(false);
    try {
      const res = await api.agenticDetect(noticeText, "fast");
      setResult(res);
    } catch (err) {
      setDetectError(err instanceof ApiError ? err.message : "Detection failed");
    } finally {
      setDetecting(false);
    }
  }

  async function handleApprove() {
    if (!result) return;
    setApproving(true);
    try {
      const res = await api.commitAmendment(result.matched_rule.id, result.proposal.params, "Rohan Mehta, CFO");
      setApproved(true);
      toast.success(`Amendment approved — rule now at v${res.rule.version}`, {
        description: `New run recorded: ${res.run.passed} passed, ${res.run.failed} failed. See Run History for the full audit trail.`,
      });
    } catch (err) {
      toast.error("Approval failed", { description: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setApproving(false);
    }
  }

  const changedKeys = result
    ? Object.keys(result.proposal.params).filter(
        (k) => JSON.stringify(result.matched_rule.params[k]) !== JSON.stringify(result.proposal.params[k])
      )
    : [];

  return (
    <div>
      <PageHeader
        title="Circular Monitor"
        subtitle="The agentic loop, closed: a new circular comes in, RegCheck finds the obligation it amends and drafts the fix — a human still approves before anything runs."
      />

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Radar className="h-4 w-4 text-brand-600" /> Simulate a new SEBI circular
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {SAMPLE_NOTICES.map((s) => (
              <button
                key={s.label}
                onClick={() => setNoticeText(s.text)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <FileText className="mr-1 inline h-3 w-3" /> {s.label}
              </button>
            ))}
          </div>

          <textarea
            value={noticeText}
            onChange={(e) => setNoticeText(e.target.value)}
            placeholder="Paste or select a sample SEBI circular notice…"
            rows={5}
            className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          />

          <Button className="mt-4" disabled={detecting || !noticeText.trim()} onClick={handleDetect}>
            <Sparkles className="h-4 w-4" /> {detecting ? "Monitoring → diffing → drafting…" : "Detect impact"}
          </Button>

          {detectError && <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">{detectError}</p>}
        </CardContent>
      </Card>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-teal-600 dark:text-teal-400">
                      Matched obligation
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {result.matched_rule.title}
                    </div>
                  </div>
                  <ClauseLink clauseId={result.matched_rule.clause_id} citation={result.matched_rule.citation} />
                </div>

                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                    <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">Current params</div>
                    {changedKeys.map((k) => (
                      <div key={k} className="text-xs text-slate-600 dark:text-slate-300">
                        <span className="font-mono">{k}</span>: {String(result.matched_rule.params[k])}
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl bg-brand-50 p-3 dark:bg-brand-900/20">
                    <div className="mb-1 text-[10px] uppercase tracking-wide text-brand-500">Proposed params</div>
                    {changedKeys.map((k) => (
                      <div key={k} className="text-xs font-semibold text-brand-800 dark:text-brand-300">
                        <span className="font-mono font-normal">{k}</span>: {String(result.proposal.params[k])}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-4 flex items-center gap-2">
                  <Badge variant={result.proposal.confidence >= 0.85 ? "teal" : "warning"}>
                    {(result.proposal.confidence * 100).toFixed(0)}% confidence
                  </Badge>
                  <Badge variant="outline">{result.provider_used}</Badge>
                </div>

                <p className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  {result.proposal.rationale}
                </p>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                    <ShieldCheck className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      The LLM drafted this — nothing has changed yet.
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Approving creates a new rule version, closes out the old one in the audit trail, and
                      re-runs the scorecard.
                    </div>
                  </div>
                </div>
                <Button variant={approved ? "secondary" : "default"} disabled={approving || approved} onClick={handleApprove}>
                  {approved ? (
                    <>
                      <History className="h-4 w-4" /> Approved — view in Run History
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4" /> {approving ? "Applying…" : "Approve & apply"}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

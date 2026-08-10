import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Radar, Sparkles, ArrowRight, ShieldCheck, History, FileText, Globe, ExternalLink, CheckCircle2, Loader2, Search, CircleDot, AlertTriangle, Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import PageHeader from "./PageHeader";
import ClauseLink from "./ClauseLink";
import { api, ApiError, type AgenticDetectResult, type SebiCircularSource, type SebiFeedItem } from "@/lib/api";

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

  // Real SEBI polling — fetches SEBI's actual, live circulars listing page,
  // downloads and extracts whichever circular hasn't been processed yet, and
  // runs it through the exact same monitor -> diff -> propose pipeline as the
  // sample buttons above. `realSource` carries the genuine circular's title/
  // date/number/link so the UI can prove the match came from a real document,
  // not a canned string.
  const [polling, setPolling] = useState(false);
  const [pollMessage, setPollMessage] = useState<string | null>(null);
  const [realSource, setRealSource] = useState<SebiCircularSource | null>(null);

  // Date range (YYYY-MM-DD, matching <input type="date">) — passed straight
  // through to SEBI's own search form (fromDate/toDate) on the backend, not
  // filtered client-side, so "3 circulars in this range" genuinely means
  // SEBI's site returned exactly those 3.
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [previewItems, setPreviewItems] = useState<SebiFeedItem[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  async function handlePreviewRange() {
    setPreviewing(true);
    setPreviewError(null);
    setPreviewItems(null);
    try {
      const res = await api.getSebiFeed(fromDate || undefined, toDate || undefined);
      setPreviewItems(res.items);
    } catch (err) {
      setPreviewError(err instanceof ApiError ? err.message : "Could not reach SEBI's site");
    } finally {
      setPreviewing(false);
    }
  }

  async function handlePollSebi() {
    setPolling(true);
    setPollMessage(null);
    setDetectError(null);
    try {
      const res = await api.pollSebi("fast", fromDate || undefined, toDate || undefined);
      if (!res.new_circular_found) {
        setPollMessage(res.message ?? "No unprocessed circulars found right now.");
        setResult(null);
        setRealSource(null);
        return;
      }
      if (res.error || !res.matched_rule || !res.proposal) {
        setPollMessage(
          `Fetched a real SEBI circular — "${res.source?.title}" — but ${res.error ?? "could not match it to any rule"}.`
        );
        setResult(null);
        setRealSource(res.source ?? null);
        return;
      }
      setResult({
        matched_rule: res.matched_rule,
        proposal: res.proposal,
        provider_used: res.provider_used ?? "",
        match_type: res.match_type ?? "citation",
        match_score: res.match_score,
      });
      setRealSource(res.source ?? null);
      setApproved(false);
      toast.success("Fetched a real SEBI circular", { description: res.source?.title });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not reach SEBI's site";
      setPollMessage(message);
    } finally {
      setPolling(false);
    }
  }

  async function handleDetect() {
    if (!noticeText.trim()) return;
    setDetecting(true);
    setDetectError(null);
    setResult(null);
    setApproved(false);
    setRealSource(null);
    setPollMessage(null);
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
      const res = await api.commitAmendment(
        result.matched_rule.id,
        result.proposal.params,
        "Rohan Mehta, CFO",
        "Agentic amendment loop"
      );
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
  const isNoOpProposal = result !== null && changedKeys.length === 0;

  return (
    <div>
      <PageHeader
        title="Circular Monitor"
        subtitle="The agentic loop, closed: a new circular comes in, RegCheck finds the obligation it amends and drafts the fix — a human still approves before anything runs."
      />

      <Card className="mb-6 border-teal-200 dark:border-teal-900/50">
        <CardContent className="p-6">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Globe className="h-4 w-4 text-teal-600" /> Fetch a real circular from SEBI
          </div>
          <p className="mb-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Polls SEBI's actual, live circulars index (sebi.gov.in), downloads whichever circular
            hasn't been processed yet, extracts its real PDF text, and runs it through the same
            monitor → diff → propose pipeline as the samples below — no canned text.
          </p>

          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400" htmlFor="fromDate">
                From
              </label>
              <input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                max={toDate || undefined}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-teal-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400" htmlFor="toDate">
                To
              </label>
              <input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                min={fromDate || undefined}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-teal-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
            <Button variant="secondary" size="sm" disabled={previewing} onClick={handlePreviewRange}>
              {previewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              {previewing ? "Checking sebi.gov.in…" : "Preview what's in range"}
            </Button>
            {(fromDate || toDate) && (
              <button
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                  setPreviewItems(null);
                  setPreviewError(null);
                }}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Clear range
              </button>
            )}
          </div>

          {previewError && <p className="mb-3 text-xs text-rose-600 dark:text-rose-400">{previewError}</p>}

          {previewItems && (
            <div className="mb-4 max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-slate-100 p-3 dark:border-slate-800">
              {previewItems.length === 0 ? (
                <p className="text-xs text-slate-400">No circulars found on sebi.gov.in in that range.</p>
              ) : (
                <>
                  <p className="mb-1 text-[11px] font-medium text-slate-400">
                    {previewItems.length} circular{previewItems.length === 1 ? "" : "s"} found on sebi.gov.in
                    {fromDate || toDate ? " in this range" : ""}:
                  </p>
                  {previewItems.map((item) => (
                    <div key={item.link} className="flex items-start gap-2 text-xs">
                      <CircleDot
                        className={`mt-0.5 h-3 w-3 shrink-0 ${item.already_processed ? "text-slate-300 dark:text-slate-600" : "text-teal-500"}`}
                      />
                      <div className="min-w-0">
                        <span className={item.already_processed ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-300"}>
                          {item.title}
                        </span>
                        <span className="ml-1.5 text-slate-400">· {item.pub_date}</span>
                        {item.already_processed && <span className="ml-1.5 text-slate-400">(already processed)</span>}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          <Button variant="teal" disabled={polling} onClick={handlePollSebi}>
            {polling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            {polling
              ? "Fetching from sebi.gov.in…"
              : fromDate || toDate
                ? "Fetch next unprocessed circular in range"
                : "Poll SEBI's live feed"}
          </Button>
          {pollMessage && (
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{pollMessage}</p>
          )}
        </CardContent>
      </Card>

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
            {realSource && (
              <Card className="border-teal-200 bg-teal-50/50 dark:border-teal-900/50 dark:bg-teal-900/10">
                <CardContent className="flex flex-wrap items-start justify-between gap-3 p-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-teal-600 dark:text-teal-400" />
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
                        Real SEBI circular
                      </div>
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{realSource.title}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {realSource.circular_no && <>Circular No. {realSource.circular_no} · </>}
                        {realSource.date}
                      </div>
                    </div>
                  </div>
                  <a
                    href={realSource.link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex shrink-0 items-center gap-1 text-xs font-medium text-teal-700 hover:underline dark:text-teal-400"
                  >
                    View on sebi.gov.in <ExternalLink className="h-3 w-3" />
                  </a>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-teal-600 dark:text-teal-400">
                      Matched obligation
                      {result.match_type === "fuzzy" ? (
                        <Badge variant="warning">
                          <AlertTriangle className="h-3 w-3" /> keyword match, not cited
                        </Badge>
                      ) : (
                        <Badge variant="teal">
                          <Quote className="h-3 w-3" /> clause explicitly cited
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {result.matched_rule.title}
                    </div>
                  </div>
                  <ClauseLink clauseId={result.matched_rule.clause_id} citation={result.matched_rule.citation} />
                </div>

                {result.match_type === "fuzzy" && (
                  <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      This circular doesn&apos;t explicitly cite Para {result.matched_rule.citation.para} — RegCheck
                      matched it by keyword similarity only ({result.match_score} overlapping term
                      {result.match_score === 1 ? "" : "s"}), because no rule&apos;s paragraph was cited anywhere in
                      the text. That&apos;s a guess, not a fact — confidence is capped and you should read the
                      source circular yourself before approving.
                    </span>
                  </p>
                )}

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

                {isNoOpProposal && (
                  <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
                    No parameter changes detected in this proposal — the drafted params are identical to the
                    matched rule&apos;s current params, so there is nothing to approve.
                  </p>
                )}

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
                <Button
                  variant={approved ? "secondary" : "default"}
                  disabled={approving || approved || isNoOpProposal}
                  onClick={handleApprove}
                  title={isNoOpProposal ? "No parameter changes detected in this proposal — nothing to approve." : undefined}
                >
                  {approved ? (
                    <>
                      <History className="h-4 w-4" /> Approved — view in Run History
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4" />{" "}
                      {approving ? "Applying…" : isNoOpProposal ? "Nothing to approve" : "Approve & apply"}
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

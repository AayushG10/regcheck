import { useState } from "react";
import { FileText, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { api, type ClauseText, type ClauseCitation } from "@/lib/api";

/**
 * The "proof" link: every verdict can point to the exact source paragraph.
 * Clicking it fetches the clause text on demand and shows it in a dialog —
 * this is what makes a RegCheck verdict auditable rather than asserted.
 */
export default function ClauseLink({ clauseId, citation }: { clauseId: string; citation: ClauseCitation }) {
  const [clause, setClause] = useState<ClauseText | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadClause() {
    if (clause || loading) return;
    setLoading(true);
    try {
      const corpus = await api.getClauses();
      setClause(corpus.clauses.find((c) => c.clause_id === clauseId) ?? null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog onOpenChange={(open) => open && loadClause()}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 underline decoration-brand-300 decoration-dotted underline-offset-4 transition-colors hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300">
          <FileText className="h-3 w-3" /> Para {citation.para}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="mb-1">
            <Badge variant="neutral">{citation.circular}</Badge>
          </div>
          <DialogTitle>{loading ? "Loading clause…" : clause?.title ?? "Clause not found"}</DialogTitle>
          <DialogDescription>Paragraph {citation.para} — source of this obligation</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
          {loading ? "…" : clause?.text ?? "This clause could not be located in the corpus."}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <ExternalLink className="h-3 w-3" /> This is the exact evidentiary source RegCheck used to draft
          and run this check.
        </p>
      </DialogContent>
    </Dialog>
  );
}

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { User, CalendarDays, PartyPopper, Users, ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "./PageHeader";
import ErrorCard from "./ErrorCard";
import ClauseLink from "./ClauseLink";
import { api, type RemediationTask } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const PRIORITY_BADGE = { high: "fail", medium: "warning", low: "neutral" } as const;
const PRIORITY_DOT = { high: "#f43f5e", medium: "#f59e0b", low: "#94a3b8" } as const;

export default function RemediationList() {
  const { data, loading, error, refetch } = useApi(() => api.getRemediation());
  const [groupByOwner, setGroupByOwner] = useState(false);

  const priorityCounts = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };
    for (const t of data ?? []) counts[t.priority] += 1;
    return counts;
  }, [data]);

  const grouped = useMemo(() => {
    if (!data || !groupByOwner) return null;
    const byOwner = new Map<string, RemediationTask[]>();
    for (const t of data) {
      const list = byOwner.get(t.owner) ?? [];
      list.push(t);
      byOwner.set(t.owner, list);
    }
    return Array.from(byOwner.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [data, groupByOwner]);

  return (
    <div>
      <PageHeader
        title="Remediation"
        subtitle="Every FAIL, turned into an owned work item with a fix and a due date."
        onRefresh={refetch}
      />

      {error ? (
        <ErrorCard message={error} onRetry={refetch} />
      ) : loading || !data ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : data.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <PartyPopper className="h-8 w-8 text-teal-500" />
          <p className="text-sm text-slate-500 dark:text-slate-400">No open remediation tasks — every rule passes.</p>
        </Card>
      ) : (
        <>
          {/* Priority summary strip */}
          <div className="mb-6 grid grid-cols-3 gap-4">
            {(["high", "medium", "low"] as const).map((p) => (
              <Card key={p} className="p-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PRIORITY_DOT[p] }} />
                  <span className="text-xs font-medium capitalize text-slate-500 dark:text-slate-400">{p} priority</span>
                </div>
                <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{priorityCounts[p]}</div>
              </Card>
            ))}
          </div>

          <div className="mb-4 flex items-center justify-end">
            <button
              onClick={() => setGroupByOwner((g) => !g)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                groupByOwner
                  ? "border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-700 dark:bg-brand-900/20 dark:text-brand-200"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
            >
              {groupByOwner ? <ListChecks className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
              {groupByOwner ? "Flat list" : "Group by owner"}
            </button>
          </div>

          {grouped ? (
            <div className="space-y-6">
              {grouped.map(([owner, tasks]) => (
                <div key={owner}>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {owner.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{owner}</span>
                    <Badge variant="neutral">{tasks.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {tasks.map((task, i) => <TaskCard key={task.id} task={task} index={i} showOwner={false} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {data.map((task, i) => <TaskCard key={task.id} task={task} index={i} showOwner />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TaskCard({ task, index, showOwner }: { task: RemediationTask; index: number; showOwner: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
    >
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">{task.rule_title}</span>
              <Badge variant={PRIORITY_BADGE[task.priority]}>{task.priority} priority</Badge>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{task.fix}</p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              {showOwner && (
                <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> {task.owner}</span>
              )}
              <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Due {task.due_date}</span>
              <ClauseLink clauseId={task.clause_id} citation={task.citation} />
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

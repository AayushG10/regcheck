import { useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Menu, Search, Bell, ChevronDown, ChevronRight, Building2 } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "Scorecard",
  "/dashboard/coverage": "Coverage Map",
  "/dashboard/rules": "Rules Explorer",
  "/dashboard/amendment": "Amendment Simulator",
  "/dashboard/warnings": "Early Warnings",
  "/dashboard/remediation": "Remediation",
};

export default function TopBar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const location = useLocation();
  const { data: report } = useApi(() => api.getReport());
  const { data: warnings } = useApi(() => api.getWarnings());
  const [searchValue, setSearchValue] = useState("");

  const currentLabel = ROUTE_LABELS[location.pathname] ?? "Dashboard";
  const warningCount = warnings?.length ?? 0;

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    if (searchValue.trim()) {
      toast.info(`Searching rules for "${searchValue}"`, { description: "Jump to Rules Explorer to see matches." });
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/85 lg:px-8">
      <button
        onClick={onOpenMobileNav}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-4.5 w-4.5" />
      </button>

      <div className="hidden items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 md:flex">
        <span>Dashboard</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-800 dark:text-slate-200">{currentLabel}</span>
      </div>

      <form onSubmit={handleSearchSubmit} className="ml-2 hidden flex-1 max-w-sm items-center sm:flex">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            type="text"
            placeholder="Search rules, clauses, obligations…"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-400 focus:bg-white dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 dark:focus:bg-slate-900"
          />
        </div>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => toast.info("Single-broker demo", { description: "Multi-broker support is on the roadmap." })}
          className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 sm:flex"
        >
          <Building2 className="h-3.5 w-3.5 text-slate-400" />
          {report?.broker_name ?? "Loading…"}
          <ChevronDown className="h-3 w-3 text-slate-400" />
        </button>

        <div className="hidden items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400 lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
          Synced {report ? report.as_of_date : "…"}
        </div>

        <button
          onClick={() => toast.message(`${warningCount} obligation(s) approaching deadline`, {
            description: warningCount > 0 ? "Open Early Warnings to review." : "Nothing due soon.",
          })}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {warningCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
              {warningCount}
            </span>
          )}
        </button>

        <button
          onClick={() => toast.info("Compliance Officer", { description: "Single-user demo — multi-user accounts on the roadmap." })}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-700 to-teal-600 text-xs font-bold text-white",
            "ring-2 ring-white dark:ring-slate-900"
          )}
          aria-label="User menu"
        >
          CO
        </button>
      </div>
    </header>
  );
}

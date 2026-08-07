import { useState, type FormEvent } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Menu, Search, Bell, ChevronDown, ChevronRight, Building2, PartyPopper, CalendarClock } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import Dropdown from "./Dropdown";

const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "Scorecard",
  "/dashboard/coverage": "Coverage Map",
  "/dashboard/rules": "Rules Explorer",
  "/dashboard/monitor": "Circular Monitor",
  "/dashboard/amendment": "Amendment Simulator",
  "/dashboard/warnings": "Early Warnings",
  "/dashboard/remediation": "Remediation",
  "/dashboard/runs": "Run History",
};

export default function TopBar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: report } = useApi(() => api.getReport());
  const { data: warnings } = useApi(() => api.getWarnings());
  const [searchValue, setSearchValue] = useState("");

  const currentLabel = ROUTE_LABELS[location.pathname] ?? "Dashboard";
  const warningCount = warnings?.length ?? 0;

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const q = searchValue.trim();
    if (q) navigate(`/dashboard/rules?q=${encodeURIComponent(q)}`);
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
        <Dropdown
          align="left"
          trigger={({ open }) => (
            <div
              className={cn(
                "hidden items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors sm:flex",
                open
                  ? "border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/20"
                  : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              {report?.broker_name ?? "Loading…"}
              <ChevronDown className={cn("h-3 w-3 text-slate-400 transition-transform", open && "rotate-180")} />
            </div>
          )}
        >
          <div className="p-2">
            <div className="flex items-center justify-between gap-2 rounded-lg bg-brand-50 px-3 py-2.5 dark:bg-brand-900/20">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">{report?.broker_name}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Member ID · Category I broker</div>
              </div>
              <span className="h-2 w-2 shrink-0 rounded-full bg-teal-500" />
            </div>
          </div>
          <div className="border-t border-slate-100 px-3 py-2.5 text-[11px] text-slate-400 dark:border-slate-800">
            Multi-entity switching for broker groups is on the roadmap — see Pricing → Enterprise.
          </div>
        </Dropdown>

        <div className="hidden items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400 lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
          Synced {report ? report.as_of_date : "…"}
        </div>

        <Dropdown
          trigger={({ open }) => (
            <div
              className={cn(
                "relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400",
                open ? "bg-slate-100 dark:bg-slate-800" : "hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {warningCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                  {warningCount}
                </span>
              )}
            </div>
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</span>
            {warningCount > 0 && <span className="text-xs text-slate-400">{warningCount} pending</span>}
          </div>
          {warningCount === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <PartyPopper className="h-5 w-5 text-teal-500" />
              <p className="text-xs text-slate-400">Nothing due soon.</p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {(warnings ?? []).map((w) => (
                <Link
                  key={w.rule_id}
                  to="/dashboard/warnings"
                  className="flex items-start gap-3 border-b border-slate-50 px-4 py-3 last:border-0 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/60"
                >
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">{w.rule_title}</div>
                    <div className="text-[11px] text-slate-400">
                      Due in {w.days_remaining} day{w.days_remaining === 1 ? "" : "s"} · {w.deadline_date}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Dropdown>

        <Dropdown
          trigger={({ open }) => (
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-700 to-teal-600 text-xs font-bold text-white ring-2 ring-white dark:ring-slate-900",
                open && "ring-brand-300 dark:ring-brand-700"
              )}
              aria-label="User menu"
            >
              CO
            </div>
          )}
        >
          <div className="p-4">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Priya Sharma</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Compliance Officer</div>
          </div>
          <div className="border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-400 dark:border-slate-800">
            Single-user demo — multi-user accounts with RBAC are on the roadmap.
          </div>
        </Dropdown>
      </div>
    </header>
  );
}

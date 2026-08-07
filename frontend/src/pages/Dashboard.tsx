import { useState } from "react";
import { NavLink, Route, Routes, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ShieldCheck,
  ClipboardCheck,
  PieChart,
  BookOpen,
  Wand2,
  BellRing,
  ListTodo,
  Moon,
  Sun,
  ArrowLeft,
  RotateCcw,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";

import Scorecard from "@/components/dashboard/Scorecard";
import CoverageMap from "@/components/dashboard/CoverageMap";
import RulesExplorer from "@/components/dashboard/RulesExplorer";
import AmendmentSimulator from "@/components/dashboard/AmendmentSimulator";
import EarlyWarningCalendar from "@/components/dashboard/EarlyWarningCalendar";
import RemediationList from "@/components/dashboard/RemediationList";

const NAV_ITEMS = [
  { to: "/dashboard", end: true, icon: ClipboardCheck, label: "Scorecard" },
  { to: "/dashboard/coverage", icon: PieChart, label: "Coverage Map" },
  { to: "/dashboard/rules", icon: BookOpen, label: "Rules Explorer" },
  { to: "/dashboard/amendment", icon: Wand2, label: "Amendment Simulator" },
  { to: "/dashboard/warnings", icon: BellRing, label: "Early Warnings" },
  { to: "/dashboard/remediation", icon: ListTodo, label: "Remediation" },
];

export default function Dashboard() {
  const { theme, toggleTheme } = useTheme();
  const [resetting, setResetting] = useState(false);
  const navigate = useNavigate();

  async function handleReset() {
    setResetting(true);
    try {
      await api.resetDemo();
      toast.success("Demo data reset", { description: "All rules restored to their seed state." });
      navigate(0); // full reload so every view refetches clean state
    } catch (err) {
      toast.error("Reset failed", { description: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5 dark:border-slate-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-700 to-teal-600 text-white">
            <ShieldCheck className="h-4.5 w-4.5" />
          </span>
          <span className="font-semibold tracking-tight">RegCheck</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1 border-t border-slate-200 p-3 dark:border-slate-800">
          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <RotateCcw className={cn("h-4 w-4", resetting && "animate-spin")} />
            {resetting ? "Resetting…" : "Reset demo"}
          </button>
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <Link
            to="/"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to site
          </Link>
        </div>
      </aside>

      <main className="ml-64 flex-1 px-8 py-8">
        <div className="mx-auto max-w-6xl">
          <Routes>
            <Route index element={<Scorecard />} />
            <Route path="coverage" element={<CoverageMap />} />
            <Route path="rules" element={<RulesExplorer />} />
            <Route path="amendment" element={<AmendmentSimulator />} />
            <Route path="warnings" element={<EarlyWarningCalendar />} />
            <Route path="remediation" element={<RemediationList />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

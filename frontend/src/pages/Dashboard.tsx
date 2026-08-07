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
  X,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";

import TopBar from "@/components/dashboard/TopBar";
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Mobile nav scrim */}
      {mobileNavOpen && (
        <button
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900",
          "md:w-[76px] lg:w-64 md:translate-x-0",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-slate-200 px-5 dark:border-slate-800 md:px-0 md:justify-center lg:justify-start lg:px-5">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-700 to-teal-600 text-white">
              <ShieldCheck className="h-4.5 w-4.5" />
            </span>
            <span className="font-semibold tracking-tight md:hidden lg:inline">RegCheck</span>
          </Link>
          <button
            onClick={() => setMobileNavOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              onClick={() => setMobileNavOpen(false)}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  "md:justify-center lg:justify-start",
                  isActive
                    ? "bg-brand-50 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="md:hidden lg:inline">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1 border-t border-slate-200 p-3 dark:border-slate-800">
          <button
            onClick={handleReset}
            disabled={resetting}
            title="Reset demo"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 md:justify-center lg:justify-start"
          >
            <RotateCcw className={cn("h-4 w-4 shrink-0", resetting && "animate-spin")} />
            <span className="md:hidden lg:inline">{resetting ? "Resetting…" : "Reset demo"}</span>
          </button>
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:justify-center lg:justify-start"
          >
            {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
            <span className="md:hidden lg:inline">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
          <Link
            to="/"
            title="Back to site"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:justify-center lg:justify-start"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="md:hidden lg:inline">Back to site</span>
          </Link>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col md:pl-[76px] lg:pl-64">
        <TopBar onOpenMobileNav={() => setMobileNavOpen(true)} />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
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
    </div>
  );
}

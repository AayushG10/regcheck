import { Link } from "react-router-dom";
import { ShieldCheck, Moon, Sun, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";

export default function Nav() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/75 backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-950/75">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <a href="#top" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-700 to-teal-600 text-white shadow-[var(--shadow-soft)]">
            <ShieldCheck className="h-4.5 w-4.5" />
          </span>
          <span className="text-lg">RegCheck</span>
        </a>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex dark:text-slate-300">
          <a href="#how-it-works" className="transition-colors hover:text-slate-900 dark:hover:text-white">How it works</a>
          <a href="#features" className="transition-colors hover:text-slate-900 dark:hover:text-white">Features</a>
          <a href="#comparison" className="transition-colors hover:text-slate-900 dark:hover:text-white">Why RegCheck</a>
          <a href="#pricing" className="transition-colors hover:text-slate-900 dark:hover:text-white">Pricing</a>
          <a href="#faq" className="transition-colors hover:text-slate-900 dark:hover:text-white">FAQ</a>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Button asChild size="sm">
            <Link to="/dashboard">
              Launch Dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

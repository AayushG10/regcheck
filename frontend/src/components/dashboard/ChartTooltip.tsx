/**
 * A recharts tooltip styled to match the app's actual card surface
 * (rounded-xl, border, shadow, dark-mode aware) instead of recharts'
 * generic inline-styled default box — used by every chart on the
 * dashboard so they read as one design system rather than one-off
 * recharts defaults per chart.
 */
export default function ChartTooltip({
  active,
  label,
  rows,
}: {
  active?: boolean;
  label?: string;
  rows: Array<{ name: string; value: number | string; color: string }>;
}) {
  if (!active || rows.length === 0) return null;

  return (
    <div className="min-w-[140px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-[var(--shadow-soft-lg)] dark:border-slate-800 dark:bg-slate-900">
      {label && (
        <div className="mb-1.5 text-xs font-semibold text-slate-900 dark:text-white">{label}</div>
      )}
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
              {r.name}
            </span>
            <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

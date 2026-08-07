import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A minimal, dependency-free dropdown: trigger + panel, closes on outside
 * click or Escape. Used for the top bar's notification/broker/user menus —
 * these previously fired a toast on click ("coming soon") instead of
 * showing real content, which reads worse than not having the affordance
 * at all.
 */
export default function Dropdown({
  trigger,
  children,
  align = "right",
  panelClassName,
}: {
  trigger: (props: { open: boolean }) => ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}>
        {trigger({ open })}
      </button>
      {open && (
        <div
          className={cn(
            "absolute top-full z-30 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-soft-lg)] dark:border-slate-800 dark:bg-slate-900",
            align === "right" ? "right-0" : "left-0",
            panelClassName
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number counting up (or down) to `target` whenever it changes,
 * using requestAnimationFrame with an ease-out curve. Dependency-free —
 * used for the Scorecard's headline stats (compliance %, passed/failed
 * counts) so they read as "live" rather than snapping straight to the
 * final value on every data refresh.
 */
export function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;

    const start = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const current = from + (target - from) * eased;
      setValue(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}

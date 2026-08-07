import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { Tier } from "@/lib/api";

const TIER_BADGE_VARIANT = { auto: "teal", evidence: "default", judgment: "warning" } as const;

const TIER_EXPLANATION: Record<Tier, string> = {
  auto: "Auto-checkable: fully deterministic — the engine verifies this against broker data with no human step.",
  evidence: "Evidence-tracked: data-driven, but a human must confirm the underlying evidence is genuine (e.g. a certificate).",
  judgment: "Human judgment: qualitative — cannot be reduced to a deterministic data check.",
};

/** A tier badge with a hover explanation, so "evidence tier" / "judgment tier"
 * jargon is self-explanatory anywhere it appears rather than only on the
 * Coverage Map. */
export default function TierBadge({ tier }: { tier: Tier }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Badge variant={TIER_BADGE_VARIANT[tier]} className="cursor-help">
            {tier}
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{TIER_EXPLANATION[tier]}</TooltipContent>
    </Tooltip>
  );
}

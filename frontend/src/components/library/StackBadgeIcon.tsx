import React from "react";
import { Layers } from "lucide-react";

/**
 * The Stacks button's icon, with a "+" badge when the album is in no
 * stack yet but could go in one (`stackBadge`).
 */
export const StackBadgeIcon: React.FC<{
  badge?: "add" | null;
  className?: string;
}> = ({ badge, className = "h-[18px] w-[18px]" }) => (
  <span className="relative inline-flex">
    <Layers className={className} aria-hidden="true" />
    {badge && (
      <span
        aria-hidden="true"
        className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 font-mono text-xs font-semibold leading-none text-primary-foreground ring-2 ring-surface"
      >
        +
      </span>
    )}
  </span>
);

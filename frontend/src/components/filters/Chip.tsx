import React from "react";
import { cn } from "@/lib/utils";

interface ChipProps {
  label: string;
  /** Not switched off by the user. */
  included: boolean;
  /** Can count towards results with the other filters as they are. */
  available: boolean;
  /** Matching albums, shown in mono. */
  count?: number;
  /** Extra words for screen readers, e.g. the contributor's roles. */
  description?: string;
  /** Read out when the chip is unavailable, saying why. */
  unavailableNote: string;
  onToggle: () => void;
}

/**
 * A filter chip. The three states differ in more than colour: included has a
 * raised fill and an emphasis border, excluded is struck through, and
 * unavailable has a dashed border.
 */
export const Chip: React.FC<ChipProps> = ({
  label,
  included,
  available,
  count,
  description,
  unavailableNote,
  onToggle,
}) => {
  const on = included && available;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={cn(
        "inline-flex h-9 max-w-full items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors duration-150 lg:h-[34px]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
        on
          ? "border-border-emphasis bg-secondary text-foreground hover:border-border-strong"
          : "bg-transparent text-faint hover:text-muted-foreground",
        !available && "border-dashed",
        !included && "line-through",
      )}
    >
      <span className="truncate">{label}</span>{" "}
      {count !== undefined && (
        <span className="font-mono text-xs text-faint">{count}</span>
      )}
      <span className="sr-only">
        {count !== undefined && ` ${count === 1 ? "album" : "albums"}`}
        {description && `, ${description}`}
        {!available && `, ${unavailableNote}`}
      </span>
    </button>
  );
};

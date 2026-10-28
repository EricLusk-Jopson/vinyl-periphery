import React from "react";
import { Lock } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { HoldVia, useHoldToOpen } from "@/hooks/useHoldToOpen";
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
  /**
   * On "must include": locked on, shown filled red with a lock. Pressing it
   * does nothing; it changes only from the "must include" list.
   */
  required?: boolean;
  /**
   * Shown after a one-second hold (or hover, with a mouse): who did what.
   * Holding never toggles the chip.
   */
  details?: React.ReactNode;
  /** Called when the details open, and how. */
  onDetails?: (via: HoldVia) => void;
  onToggle: () => void;
}

/**
 * A filter chip. The states differ in more than colour: included has a
 * raised fill and an emphasis border, excluded is struck through,
 * unavailable has a dashed border, and required is filled red with a lock.
 */
export const Chip: React.FC<ChipProps> = ({
  label,
  included,
  available,
  count,
  description,
  unavailableNote,
  required = false,
  details,
  onDetails,
  onToggle,
}) => {
  const on = required || (included && available);
  const hold = useHoldToOpen(onDetails);
  const ref = React.useRef<HTMLButtonElement>(null);
  const button = (
    <button
      ref={ref}
      type="button"
      {...(details ? hold.handlers : {})}
      aria-pressed={on}
      // Stays focusable so screen readers can say why it's locked.
      aria-disabled={required || undefined}
      onClick={required ? undefined : onToggle}
      className={cn(
        "inline-flex h-9 max-w-full items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors duration-150 lg:h-[34px]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        required
          ? "cursor-not-allowed border-primary bg-primary text-primary-foreground"
          : on
            ? "border-border-emphasis bg-secondary text-foreground hover:border-border-strong"
            : "bg-transparent text-faint hover:text-muted-foreground",
        !required && !available && "border-dashed",
        !required && !included && "line-through",
        // No text selection or iOS callout while holding for details.
        details && "select-none [-webkit-touch-callout:none]",
      )}
    >
      {required && <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span className="truncate">{label}</span>{" "}
      {count !== undefined && (
        <span
          className={cn(
            "font-mono text-xs",
            required ? "text-primary-foreground" : "text-faint",
          )}
        >
          {count}
        </span>
      )}
      <span className="sr-only">
        {count !== undefined && ` ${count === 1 ? "album" : "albums"}`}
        {description && `, ${description}`}
        {required
          ? ", required: change it in Must include"
          : !available && `, ${unavailableNote}`}
      </span>
    </button>
  );
  if (!details) return button;
  return (
    <Popover open={hold.open} onOpenChange={hold.setOpen}>
      <PopoverAnchor asChild>{button}</PopoverAnchor>
      <PopoverContent
        // Read-only: focus stays on the chip.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        // Presses on the chip itself are the hold's to handle.
        onInteractOutside={(e) => {
          if (ref.current?.contains(e.target as Node)) e.preventDefault();
        }}
        className="w-max max-w-[min(20rem,calc(100vw-32px))]"
      >
        {details}
      </PopoverContent>
    </Popover>
  );
};

import React, { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface FilterGroupProps {
  title: string;
  /** How many are on, of how many; shown even when collapsed. */
  on: number;
  total: number;
  /** "all" by default; "matches" while a name filter narrows the list. */
  scope?: "all" | "matches";
  /** Disabled when everything in scope is already on or off. */
  canSelect: boolean;
  canDeselect: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  children: React.ReactNode;
}

const action =
  "h-11 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:text-faint disabled:opacity-60 disabled:hover:text-faint lg:h-8";

/**
 * A collapsible group of filter chips with "Select all" and "Deselect all".
 * Starts open.
 */
export const FilterGroup: React.FC<FilterGroupProps> = ({
  title,
  on,
  total,
  scope = "all",
  canSelect,
  canDeselect,
  onSelect,
  onDeselect,
  children,
}) => {
  const [open, setOpen] = useState(true);
  const headingId = useId();

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section aria-labelledby={headingId} className="flex flex-col">
        <h3 id={headingId}>
          <CollapsibleTrigger
            className={cn(
              "flex min-h-11 w-full items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring lg:min-h-9",
            )}
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150",
                !open && "-rotate-90",
              )}
              aria-hidden="true"
            />
            <span className="text-xs font-medium uppercase tracking-[1px] text-muted-foreground lg:text-[13px]">
              {title}
            </span>
            <span className="ml-auto font-mono text-xs text-faint">
              {on} of {total} on
            </span>
          </CollapsibleTrigger>
        </h3>
        <CollapsibleContent className="flex flex-col gap-2.5 pt-1 lg:gap-3">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onSelect}
              disabled={!canSelect}
              className={action}
            >
              {scope === "all" ? "Select all" : "Select matches"}
            </button>
            <button
              type="button"
              onClick={onDeselect}
              disabled={!canDeselect}
              className={action}
            >
              {scope === "all" ? "Deselect all" : "Deselect matches"}
            </button>
          </div>
          {children}
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
};

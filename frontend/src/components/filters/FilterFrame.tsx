import React from "react";
import { ChevronLeft, SlidersHorizontal } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  useCache,
  useFilteredAndScoredReleases,
} from "@/contexts/cache/CacheContext";
import { activeFilterCount } from "@/lib/filters";
import { resetFilterState } from "@/lib/results";
import { cn } from "@/lib/utils";
import { FilterPanel } from "./FilterPanel";

interface FilterFrameProps {
  searchId: string;
}

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

/**
 * Below `lg`: a Filters button (with the active filter count) that slides in
 * the filters from the right. Full screen on phones, a 420px panel on
 * tablets. A top bar with back and Reset, the panel scrolling in between, and
 * "Show N albums" pinned at the bottom. Radix traps focus and closes it on
 * Escape.
 */
export const FilterFrame: React.FC<FilterFrameProps> = ({ searchId }) => {
  const { searches, updateFilterState } = useCache();
  const { count } = useFilteredAndScoredReleases(searchId);
  const search = searches[searchId];
  if (!search) return null;

  const active = activeFilterCount(search);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-border-strong px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary",
            focusRing,
          )}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters{" "}
          {active > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              {active}
              <span className="sr-only"> active</span>
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-l bg-background p-0 sm:max-w-none md:max-w-[420px]"
      >
        <div className="flex h-14 shrink-0 items-center gap-1 border-b bg-surface pl-1 pr-2">
          <SheetClose
            aria-label="Close filters"
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-secondary",
              focusRing,
            )}
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </SheetClose>
          <SheetTitle className="flex-1 text-lg font-semibold">
            Filters
          </SheetTitle>
          <SheetDescription className="sr-only">
            Choose which contributors and roles count towards the results.
          </SheetDescription>
          <button
            type="button"
            onClick={() =>
              updateFilterState(searchId, resetFilterState(search))
            }
            className={cn(
              "h-11 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              focusRing,
            )}
          >
            Reset
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <FilterPanel searchId={searchId} variant="frame" />
        </div>

        <div className="shrink-0 border-t bg-surface px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <SheetClose asChild>
            <button
              type="button"
              className={cn(
                "h-12 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-dark",
                focusRing,
              )}
            >
              Show {count.toLocaleString("en-US")}{" "}
              {count === 1 ? "album" : "albums"}
            </button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
};

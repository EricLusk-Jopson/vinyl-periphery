import React from "react";
import { X } from "lucide-react";
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
import { FilterPanel } from "./FilterPanel";

interface FilterSheetProps {
  searchId: string;
}

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Below `lg`: a sticky "Filters" bar at the bottom of the results, showing
 * how many filters are active, which opens the filters as a bottom sheet.
 * Radix traps focus in the sheet and closes it on Escape.
 */
export const FilterSheet: React.FC<FilterSheetProps> = ({ searchId }) => {
  const { searches, updateFilterState } = useCache();
  const { count } = useFilteredAndScoredReleases(searchId);
  const search = searches[searchId];
  if (!search) return null;

  const active = activeFilterCount(search);

  return (
    <Sheet>
      <div className="sticky bottom-0 z-10 border-t bg-background px-4 pb-5 pt-3 lg:hidden">
        <SheetTrigger asChild>
          <button
            type="button"
            className={`flex h-12 w-full items-center justify-center gap-2.5 rounded-lg bg-foreground text-base font-semibold text-background ${focusRing}`}
          >
            Filters{" "}
            {active > 0 && (
              <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-primary px-1.5 text-[13px] text-primary-foreground">
                {active}
                <span className="sr-only"> active</span>
              </span>
            )}
          </button>
        </SheetTrigger>
      </div>

      <SheetContent
        side="bottom"
        className="flex max-h-[90dvh] flex-col gap-0 rounded-t-2xl border-t bg-surface p-0"
      >
        <div
          aria-hidden="true"
          className="flex h-5 shrink-0 items-center justify-center"
        >
          <span className="h-1 w-10 rounded-full bg-border-strong" />
        </div>
        <div className="flex shrink-0 items-center justify-between pb-2 pl-4 pr-2 pt-1">
          <SheetTitle className="text-lg font-semibold">Filters</SheetTitle>
          <SheetDescription className="sr-only">
            Choose which contributors and roles count towards the results.
          </SheetDescription>
          <SheetClose
            aria-label="Close filters"
            className={`flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-secondary ${focusRing}`}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </SheetClose>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          <FilterPanel searchId={searchId} variant="sheet" />
        </div>

        <div className="flex shrink-0 gap-2.5 border-t px-4 pb-5 pt-3">
          <button
            type="button"
            onClick={() =>
              updateFilterState(searchId, resetFilterState(search))
            }
            className={`h-12 shrink-0 rounded-lg border border-border-strong px-[18px] text-[15px] font-medium text-foreground hover:bg-secondary ${focusRing}`}
          >
            Reset
          </button>
          <SheetClose asChild>
            <button
              type="button"
              className={`h-12 flex-1 rounded-lg bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-dark ${focusRing}`}
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

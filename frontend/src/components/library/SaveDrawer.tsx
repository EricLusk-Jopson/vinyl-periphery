import React, { useEffect, useId, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCache } from "@/contexts/cache/CacheContext";
import { SearchCache } from "@/contexts/cache/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { track } from "@/lib/analytics";
import { lineageOf } from "@/lib/lineage";
import { ancestorsAvailableToSave, stackIdOf } from "@/lib/stacks";
import { cn } from "@/lib/utils";
import { dialogButton } from "../common/buttons";
import { SearchCover } from "../search/SearchCover";

interface SaveDrawerProps {
  search: SearchCache;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Saving a search that has ancestors here: save it with its trail as a
 * stack (this search and the ancestors still in the session, preselected;
 * ancestors already saved shown checked), or on its own, without lineage.
 * A bottom sheet on phones, a side panel from md.
 */
export const SaveDrawer: React.FC<SaveDrawerProps> = ({
  search,
  open,
  onOpenChange,
}) => {
  const { searches, savedSearchIds, saveSearch } = useCache();
  const wide = useMediaQuery("(min-width: 768px)");
  const id = useId();
  const [busy, setBusy] = useState(false);

  const ancestors = useMemo(
    () => ancestorsAvailableToSave(search, searches, savedSearchIds),
    [search, searches, savedSearchIds],
  );
  const rows = useMemo(
    () => [
      ...ancestors.map((a) => ({
        search: a.search,
        saved: a.saved,
        depth: lineageOf(a.search).depth,
      })),
      { search, saved: false, depth: lineageOf(search).depth },
    ],
    [ancestors, search],
  );
  const savable = rows.filter((r) => !r.saved).map((r) => r.search.searchId);

  const [selected, setSelected] = useState<Set<string>>(new Set(savable));
  // Preselect everything each time it opens.
  useEffect(() => {
    if (open) setSelected(new Set(savable));
    // savable is derived from rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (searchId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(searchId)) next.delete(searchId);
      else next.add(searchId);
      return next;
    });

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setBusy(false);
    }
  };

  const saveToStack = () =>
    run(async () => {
      // Root first, so the stack's order matches the trail.
      const ids = rows
        .map((r) => r.search.searchId)
        .filter((searchId) => selected.has(searchId));
      for (const searchId of ids) await saveSearch(searchId);
      const stackId = stackIdOf(search);
      const members =
        Object.values(searches).filter(
          (s) => savedSearchIds.has(s.searchId) && stackIdOf(s) === stackId,
        ).length + ids.length;
      track("stack_saved", { members, depth: lineageOf(search).depth });
    });

  const saveAlone = () =>
    run(async () => {
      await saveSearch(search.searchId, { withoutLineage: true });
      track("search_saved", { saved: true, from: "results", alone: true });
    });

  const count = selected.size;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={cn(
          "flex flex-col gap-5 bg-background p-5 md:w-[420px] md:max-w-[420px] md:p-6",
          !wide && "max-h-[85vh] overflow-y-auto rounded-t-xl",
        )}
      >
        <div className="flex flex-col gap-1.5 pr-8">
          <SheetTitle className="text-left text-lg font-semibold">
            Save this search
          </SheetTitle>
          <SheetDescription className="text-left text-sm text-muted-foreground">
            You reached it from other searches. Save them together as a stack,
            or save this one on its own.
          </SheetDescription>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 font-mono text-xs uppercase tracking-[1px] text-muted-foreground">
            Save to stack
          </legend>
          <ul className="flex flex-col divide-y rounded-lg border bg-surface">
            {rows.map((row) => {
              const rowId = `${id}-${row.search.searchId}`;
              const checked = row.saved || selected.has(row.search.searchId);
              return (
                <li key={row.search.searchId}>
                  <label
                    htmlFor={rowId}
                    className={cn(
                      "flex min-h-11 items-center gap-3 px-3 py-2",
                      row.saved ? "cursor-default" : "cursor-pointer",
                    )}
                  >
                    <input
                      id={rowId}
                      type="checkbox"
                      checked={checked}
                      disabled={row.saved || busy}
                      onChange={() => toggle(row.search.searchId)}
                      className="h-5 w-5 shrink-0 accent-primary"
                    />
                    <SearchCover
                      search={row.search}
                      className="h-10 w-10 rounded-[3px] text-xs"
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">
                        {row.search.searchParams.album}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {row.search.searchParams.artist}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-faint">
                      {row.saved
                        ? "Saved"
                        : row.search.searchId === search.searchId
                          ? "This search"
                          : row.depth === 0
                            ? "Start"
                            : `Step ${row.depth}`}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={saveToStack}
            disabled={busy || count === 0}
            className={dialogButton.primary}
          >
            {count === 1
              ? "Save 1 search to stack"
              : `Save ${count} searches to stack`}
          </button>
        </fieldset>

        <div className="flex flex-col gap-2 border-t pt-5">
          <button
            type="button"
            onClick={saveAlone}
            disabled={busy}
            className={dialogButton.secondary}
          >
            Save on its own
          </button>
          <p className="text-[13px] text-faint">
            Saved without its trail, it won't group with these searches.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

import React, { useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { stackPath } from "@/lib/routes";
import {
  ancestorsAvailableToSave,
  fitViaText,
  LibraryStack,
  savedInStack,
  StackFit,
  stackIdOf,
  stackLabel,
  stackLayout,
  stackRoot,
  stacksThisFits,
} from "@/lib/stacks";
import { cn } from "@/lib/utils";
import { dialogButton } from "../common/buttons";
import { SearchCover } from "../search/SearchCover";
import { StackRootCover } from "./StackCard";

interface SaveDrawerProps {
  search: SearchCache;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * "save" (default): saving an unsaved search. "stack": for a saved
   * search, putting it into a stack or starting one, or, when it's in a
   * stack, taking it out or moving it.
   */
  mode?: "save" | "stack";
  /** Where it was opened, for analytics. */
  from?: "results" | "library";
}

/**
 * Saving a search that has ancestors here, or that fits an existing stack.
 * With ancestors: save it with its trail as a stack (this search and the
 * ancestors still in the session, preselected; ancestors already saved
 * shown checked), the default. Fitting stacks (a member has this album in
 * its results) are offered next, to add it to as if searched from there.
 * Or save it on its own, without lineage. Without a trail, the best fit is
 * the main choice.
 *
 * In "stack" mode, for a saved search: the stack it's in, with Remove; the
 * other stacks it fits; and saved searches on their own it could follow
 * to start a stack.
 *
 * A bottom sheet on phones, a side panel from md.
 */
export const SaveDrawer: React.FC<SaveDrawerProps> = ({
  search,
  open,
  onOpenChange,
  mode = "save",
  from = "results",
}) => {
  const stacking = mode === "stack";
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
  const hasTrail = !stacking && ancestors.length > 0;
  // The stack it's in now (two or more saved), in "stack" mode.
  const current = useMemo((): LibraryStack | null => {
    if (!stacking) return null;
    const stackId = stackIdOf(search);
    const members = savedInStack(searches, savedSearchIds, stackId);
    return members.length > 1 ? { kind: "stack", stackId, members } : null;
  }, [stacking, search, searches, savedSearchIds]);
  const fits = useMemo(
    () =>
      stacksThisFits(search, searches, savedSearchIds, { singles: stacking }),
    [search, searches, savedSearchIds, stacking],
  );
  // The main choice: the trail when there is one, otherwise the best fit.
  const bestFit = hasTrail || current ? null : fits[0];
  const currentStep = current
    ? (stackLayout(current).levels.get(search.searchId) ?? 0)
    : 0;
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
      track("stack_saved", {
        members,
        depth: lineageOf(search).depth,
        from,
      });
    });

  const addToStack = (fit: StackFit) =>
    run(async () => {
      await saveSearch(search.searchId, { lineage: fit.lineage });
      track("stack_saved", {
        members: fit.stack.members.length + 1,
        depth: fit.lineage.depth,
        joined: true,
        from,
        ...(stacking ? { new_stack: fit.kind === "single" } : {}),
        ...(current ? { moved: true } : {}),
      });
    });

  // Out of its stack: a trail of its own, still saved.
  const removeFromStack = () =>
    run(async () => {
      await saveSearch(search.searchId, { withoutLineage: true });
      track("search_unstacked", {
        from,
        members: (current?.members.length ?? 1) - 1,
        depth: currentStep,
      });
    });

  const saveAlone = () =>
    run(async () => {
      await saveSearch(search.searchId, { withoutLineage: true });
      track("search_saved", { saved: true, from, alone: true });
    });

  const count = selected.size;

  /** A list of places it fits, each with its own button. */
  const fitSection = (
    kind: StackFit["kind"],
    heading: string,
    ruled: boolean,
  ) => {
    const list = fits.filter((f) => f.kind === kind);
    return (
      list.length > 0 && (
        <section
          aria-labelledby={`${id}-${kind}`}
          className={cn("flex flex-col gap-3", ruled && "border-t pt-5")}
        >
          <h3
            id={`${id}-${kind}`}
            className="font-mono text-xs uppercase tracking-[1px] text-muted-foreground"
          >
            {heading}
          </h3>
          <ul className="flex flex-col divide-y rounded-lg border bg-surface">
            {list.map((fit) => {
              const single = fit.kind === "single";
              const name = single
                ? fit.parent.searchParams.album
                : stackLabel(fit.stack);
              return (
                <li
                  key={fit.stack.stackId}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  {single ? (
                    <SearchCover
                      search={fit.parent}
                      className="h-10 w-10 rounded-[3px] text-xs"
                    />
                  ) : (
                    <StackRootCover
                      root={stackRoot(fit.stack)}
                      className="h-10 w-10 rounded-[3px] text-xs"
                    />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {single
                        ? fit.parent.searchParams.artist
                        : `After ${fit.parent.searchParams.album}`}
                    </span>
                    {fit.via.length > 0 && (
                      <span className="truncate font-mono text-xs text-faint">
                        {fitViaText(fit)}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => addToStack(fit)}
                    disabled={busy}
                    className={cn(
                      fit === bestFit
                        ? dialogButton.primary
                        : dialogButton.secondary,
                      "shrink-0 px-3",
                    )}
                  >
                    Add
                    <span className="sr-only">
                      {single ? ` after ${name}` : ` to ${name}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )
    );
  };

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
            {current
              ? "Stack"
              : stacking
                ? "Add to a stack"
                : "Save this search"}
          </SheetTitle>
          <SheetDescription className="text-left text-sm text-muted-foreground">
            {current
              ? fits.length > 0
                ? `${search.searchParams.album} is in ${stackLabel(current)}. Take it out, or move it after another saved album whose results include it.`
                : `${search.searchParams.album} is in ${stackLabel(current)}. Take it out to keep it saved on its own.`
              : stacking
                ? fits.length > 0
                  ? `Place ${search.searchParams.album} after a saved album whose results include it.`
                  : `No saved album has ${search.searchParams.album} in its results.`
                : hasTrail
                  ? "You reached it from other searches. Save them together as a stack, or save this one on its own."
                  : fits.length === 1
                    ? "This album is in the results of a saved stack. Add it there, or save it on its own."
                    : "This album is in the results of saved stacks. Add it to one, or save it on its own."}
          </SheetDescription>
        </div>

        {hasTrail && (
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
        )}

        {current && (
          <section
            aria-labelledby={`${id}-current`}
            className="flex flex-col gap-3"
          >
            <h3
              id={`${id}-current`}
              className="font-mono text-xs uppercase tracking-[1px] text-muted-foreground"
            >
              In this stack
            </h3>
            <div className="flex items-center gap-3 rounded-lg border bg-surface px-3 py-2">
              <StackRootCover
                root={stackRoot(current)}
                className="h-10 w-10 rounded-[3px] text-xs"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <Link
                  to={stackPath(current.stackId)}
                  onClick={() => onOpenChange(false)}
                  className="truncate text-sm font-medium underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {stackLabel(current)}
                </Link>
                <span className="truncate font-mono text-xs text-faint">
                  {currentStep === 0 ? "Its start" : `Step ${currentStep}`} ·{" "}
                  {current.members.length} saved
                </span>
              </span>
              <button
                type="button"
                onClick={removeFromStack}
                disabled={busy}
                className={cn(dialogButton.secondary, "shrink-0 px-3")}
              >
                Remove
                <span className="sr-only"> from {stackLabel(current)}</span>
              </button>
            </div>
            <p className="text-[13px] text-faint">
              It stays saved, on its own.{" "}
              {current.members.length === 2
                ? "The other search is left on its own too, so the stack goes."
                : "The rest of the stack stays as it is."}
            </p>
          </section>
        )}

        {fitSection(
          "stack",
          current
            ? "Move to another stack"
            : stacking
              ? "Existing stacks"
              : hasTrail
                ? "Or add to a stack it fits"
                : "Add to a stack",
          hasTrail || Boolean(current),
        )}
        {fitSection(
          "single",
          current ? "Move to a new stack after" : "Start a stack after",
          Boolean(current) || fits.some((f) => f.kind === "stack"),
        )}

        {!stacking && (
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
              {hasTrail
                ? "Saved without its trail, it won't group with these searches."
                : "It won't group with any stack."}
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

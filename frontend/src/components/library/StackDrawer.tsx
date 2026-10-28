import React, { useId, useMemo, useState } from "react";
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
import { stackPath } from "@/lib/routes";
import {
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

interface StackDrawerProps {
  search: SearchCache;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where it was opened, for analytics. */
  from?: "results" | "library";
}

/**
 * Stack: where a search sits among the others. In a stack: that stack,
 * with Remove (it stays in the library, on its own), and the other stacks
 * or searches on their own it could move after. On its own: the stacks it
 * fits, and searches on their own it could follow to start a stack. The
 * best fit is the main choice. A bottom sheet on phones, a side panel
 * from md.
 */
export const StackDrawer: React.FC<StackDrawerProps> = ({
  search,
  open,
  onOpenChange,
  from = "results",
}) => {
  const { searches, savedSearchIds, saveSearch } = useCache();
  const wide = useMediaQuery("(min-width: 768px)");
  const id = useId();
  const [busy, setBusy] = useState(false);

  // The stack it's in now (two or more searches).
  const current = useMemo((): LibraryStack | null => {
    const stackId = stackIdOf(search);
    const members = savedInStack(searches, savedSearchIds, stackId);
    return members.length > 1 ? { kind: "stack", stackId, members } : null;
  }, [search, searches, savedSearchIds]);
  const fits = useMemo(
    () => stacksThisFits(search, searches, savedSearchIds, { singles: true }),
    [search, searches, savedSearchIds],
  );
  // The main choice when it's on its own: the best fit.
  const bestFit = current ? null : fits[0];
  const currentStep = current
    ? (stackLayout(current).levels.get(search.searchId) ?? 0)
    : 0;
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to change the stack:", error);
    } finally {
      setBusy(false);
    }
  };

  const addToStack = (fit: StackFit) =>
    run(async () => {
      await saveSearch(search.searchId, { lineage: fit.lineage });
      track("stack_saved", {
        members: fit.stack.members.length + 1,
        depth: fit.lineage.depth,
        joined: true,
        from,
        new_stack: fit.kind === "single",
        ...(current ? { moved: true } : {}),
      });
    });

  // Out of its stack: a trail of its own, still in the library.
  const removeFromStack = () =>
    run(async () => {
      await saveSearch(search.searchId, { withoutLineage: true });
      track("search_unstacked", {
        from,
        members: (current?.members.length ?? 1) - 1,
        depth: currentStep,
      });
    });

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
            {current ? "Stack" : "Add to a stack"}
          </SheetTitle>
          <SheetDescription className="text-left text-sm text-muted-foreground">
            {current
              ? fits.length > 0
                ? `${search.searchParams.album} is in ${stackLabel(current)}. Take it out, or move it after another album whose results include it.`
                : `${search.searchParams.album} is in ${stackLabel(current)}. Take it out to keep it on its own.`
              : fits.length > 0
                ? `Place ${search.searchParams.album} after an album in your library whose results include it.`
                : `No album in your library has ${search.searchParams.album} in its results.`}
          </SheetDescription>
        </div>

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
                  {current.members.length} searches
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
              It stays in your library, on its own.{" "}
              {current.members.length === 2
                ? "The other search is left on its own too, so the stack goes."
                : "The rest of the stack stays as it is."}
            </p>
          </section>
        )}

        {fitSection(
          "stack",
          current ? "Move to another stack" : "Existing stacks",
          Boolean(current),
        )}
        {fitSection(
          "single",
          current ? "Move to a new stack after" : "Start a stack after",
          Boolean(current) || fits.some((f) => f.kind === "stack"),
        )}
      </SheetContent>
    </Sheet>
  );
};

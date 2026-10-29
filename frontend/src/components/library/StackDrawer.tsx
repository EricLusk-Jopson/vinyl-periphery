import React, { useMemo, useState } from "react";
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
  fitLinkText,
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
import { LayersOff } from "../common/icons";
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
 * Stack: every place a search could sit, in one list. First where it is
 * now (its stack, marked Current); then every stack it fits, and every
 * search on its own it could follow to start one, each with Switch; then,
 * below a rule, Standalone, with Destack when it's in a stack. A bottom
 * sheet on phones, a side panel from md.
 */
export const StackDrawer: React.FC<StackDrawerProps> = ({
  search,
  open,
  onOpenChange,
  from = "results",
}) => {
  const { searches, savedSearchIds, saveSearch } = useCache();
  const wide = useMediaQuery("(min-width: 768px)");
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

  const name = search.searchParams.album;
  const row = "flex min-h-[60px] items-center gap-3 px-3 py-2";
  const currentTag = (
    <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 font-mono text-xs text-foreground">
      Current
    </span>
  );
  const button = (label: string, onClick: () => void, sr: string) => (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(dialogButton.secondary, "shrink-0 px-3")}
    >
      {label}
      <span className="sr-only"> {sr}</span>
    </button>
  );

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
            Stack
          </SheetTitle>
          <SheetDescription className="text-left text-sm text-muted-foreground">
            {current
              ? `${name} is in ${stackLabel(current)}.`
              : `${name} is on its own.`}{" "}
            {fits.length > 0
              ? "Switch it to any stack whose albums have it in their results."
              : "No other album in your library has it in its results."}
          </SheetDescription>
        </div>

        <ul
          aria-label="Stacks"
          className="flex flex-col divide-y rounded-lg border bg-surface"
        >
          {current && (
            <li className={row}>
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
              {currentTag}
            </li>
          )}
          {fits.map((fit) => {
            const single = fit.kind === "single";
            const label = single
              ? fit.parent.searchParams.album
              : stackLabel(fit.stack);
            return (
              <li key={fit.stack.stackId} className={row}>
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
                  <span className="truncate text-sm font-medium">{label}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {single
                      ? "New stack, after this album"
                      : `After ${fit.parent.searchParams.album}`}
                  </span>
                  {fit.via.length > 0 && (
                    <span className="truncate font-mono text-xs text-faint">
                      {fitLinkText(fit)}
                    </span>
                  )}
                </span>
                {button(
                  "Switch",
                  () => addToStack(fit),
                  single ? `to a new stack after ${label}` : `to ${label}`,
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-2 border-t pt-5">
          <div className={cn(row, "rounded-lg border bg-surface")}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] bg-secondary text-muted-foreground">
              <LayersOff className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">Standalone</span>
              <span className="truncate text-xs text-muted-foreground">
                On its own, in no stack
              </span>
            </span>
            {current
              ? button("Destack", removeFromStack, `${name}`)
              : currentTag}
          </div>
          {current && (
            <p className="text-[13px] text-faint">
              It stays in your library.{" "}
              {current.members.length === 2
                ? "The other search is left on its own too, so the stack goes."
                : "The rest of the stack stays as it is."}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

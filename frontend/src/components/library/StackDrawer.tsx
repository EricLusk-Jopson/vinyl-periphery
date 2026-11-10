import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCache } from "@/contexts/cache/CacheContext";
import { SearchCache } from "@/contexts/cache/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useLibraryStacks } from "@/hooks/useLibraryStacks";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";
import { stackPath } from "@/lib/routes";
import { memberFor } from "@/lib/stackRecords";
import { fitLinkText, stackOptionsFor, stackRoot } from "@/lib/stacks";
import { cn } from "@/lib/utils";
import { dialogButton } from "../common/buttons";
import { StackRootCover } from "./StackCard";
import { StackEditor } from "./StackEditor";
import { useRemoveFromStack } from "./useStackRemoval";

interface StackDrawerProps {
  search: SearchCache;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where it was opened, for analytics. */
  from?: "results" | "library" | "stack";
}

/**
 * Stacks, for one album: every stack, with Remove for those holding it and
 * Add for those it links to (an album there has it among its results, or
 * the other way round). Stacks it doesn't link to are listed, greyed, so
 * it's clear why they can't take it. "New stack with this album" opens the
 * stack editor with it as the start. An album can be in any number of
 * stacks. A bottom sheet on phones, a side panel from md.
 */
export const StackDrawer: React.FC<StackDrawerProps> = ({
  search,
  open,
  onOpenChange,
  from = "results",
}) => {
  const { updateStack } = useCache();
  const { toast } = useToast();
  const wide = useMediaQuery("(min-width: 768px)");
  const stacks = useLibraryStacks();
  const options = useMemo(
    () => stackOptionsFor(search, stacks),
    [search, stacks],
  );
  const { remove, dialog } = useRemoveFromStack();
  const [creating, setCreating] = useState(false);
  const name = search.searchParams.album;
  const holding = options.filter((o) => o.join.member).length;

  const add = async (option: (typeof options)[number]) => {
    const { stack } = option;
    await updateStack({
      ...stack.record,
      members: [...stack.record.members, memberFor(search)],
    });
    track("stack_album_added", { from, members: stack.members.length + 1 });
    toast({
      title: "Added",
      description: `${name} is in ${stack.record.name}.`,
    });
  };

  const row = "flex min-h-[64px] items-center gap-3 px-3 py-2";

  return (
    <>
      <Sheet open={open && !creating} onOpenChange={onOpenChange}>
        <SheetContent
          side={wide ? "right" : "bottom"}
          className={cn(
            "flex flex-col gap-5 overflow-y-auto bg-background p-5 md:w-[440px] md:max-w-[440px] md:p-6",
            !wide && "max-h-[85vh] rounded-t-xl",
          )}
        >
          <div className="flex flex-col gap-1.5 pr-8">
            <SheetTitle className="text-left text-lg font-semibold">
              Stacks
            </SheetTitle>
            <SheetDescription className="text-left text-sm text-muted-foreground">
              {holding > 0
                ? `${name} is in ${holding} ${holding === 1 ? "stack" : "stacks"}.`
                : `${name} isn't in a stack yet.`}{" "}
              It can go in any stack it links to: someone credited on it worked
              on an album already there.
            </SheetDescription>
          </div>

          {options.length > 0 && (
            <ul
              aria-label="Stacks"
              className="flex flex-col divide-y rounded-lg border bg-surface"
            >
              {options.map((option) => {
                const { stack, join } = option;
                const off = !join.member && !join.ok;
                return (
                  <li
                    key={stack.stackId}
                    className={cn(row, off && "opacity-60")}
                  >
                    <StackRootCover
                      root={stackRoot(stack)}
                      className="h-10 w-10 rounded-[3px] text-xs"
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <Link
                        to={stackPath(stack.stackId)}
                        onClick={() => onOpenChange(false)}
                        className="truncate text-sm font-medium underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {stack.record.name}
                      </Link>
                      <span className="truncate text-xs text-muted-foreground">
                        {join.member
                          ? "In this stack"
                          : join.ok && join.via
                            ? `Links to ${join.via.searchParams.album}`
                            : join.ok
                              ? "An empty stack: it would be the start"
                              : "Doesn't link to any album here yet"}
                      </span>
                      {join.ok && join.via && join.people.length > 0 && (
                        <span className="truncate font-mono text-xs text-faint">
                          {fitLinkText({ parent: join.via, via: join.people })}
                        </span>
                      )}
                    </span>
                    {join.member ? (
                      <button
                        type="button"
                        onClick={() => remove(stack, search, from)}
                        className={cn(dialogButton.secondary, "shrink-0 px-3")}
                      >
                        Remove
                        <span className="sr-only">
                          {" "}
                          {name} from {stack.record.name}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void add(option)}
                        disabled={off}
                        aria-disabled={off}
                        className={cn(
                          dialogButton.secondary,
                          "shrink-0 px-3 disabled:cursor-not-allowed",
                        )}
                      >
                        Add
                        <span className="sr-only">
                          {" "}
                          {name} to {stack.record.name}
                          {off && ": it doesn't link to any album there"}
                        </span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setCreating(true)}
            className={cn(dialogButton.secondary, "gap-2 self-start")}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New stack with this album
          </button>
        </SheetContent>
      </Sheet>
      {dialog}
      {creating && (
        <StackEditor
          open
          initial={[search]}
          onOpenChange={(next) => {
            if (!next) setCreating(false);
          }}
          onSaved={() => {
            setCreating(false);
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
};

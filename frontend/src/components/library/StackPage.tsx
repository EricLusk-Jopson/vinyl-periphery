import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Search, Trash2, Ungroup } from "lucide-react";
import { SearchParams } from "@/api/types";
import { useCache } from "@/contexts/cache/CacheContext";
import { SearchCache } from "@/contexts/cache/types";
import { KnownAlbum } from "@/hooks/useSearchRun";
import { track } from "@/lib/analytics";
import { libraryPath, stackPath } from "@/lib/routes";
import { ShareButton } from "../share/ShareButton";
import { targetFromKey } from "@/lib/searchTarget";
import {
  GhostStep,
  LibraryStack,
  savedInStack,
  StackOrder,
  stackLabel,
  stackLayout,
  stackMembersByDepth,
  stackRoot,
} from "@/lib/stacks";
import { cn } from "@/lib/utils";
import { SaveDrawer } from "./SaveDrawer";
import { StackAction, StackConfirm } from "./StackConfirm";
import { ToastAction } from "../ui/toast";
import { useToast } from "@/hooks/use-toast";
import { AlbumCover } from "../search/AlbumCover";
import { LibraryCard } from "./LibraryCard";
import { StackRootCover } from "./StackCard";
import { useCoverArt } from "@/hooks/useCoverArt";
import { usableImageUrl } from "@/lib/searches";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

const ORDERS: { id: StackOrder; label: string }[] = [
  { id: "depth", label: "By step" },
  { id: "time", label: "Newest first" },
];

const stepLabel = (depth: number) => (depth === 0 ? "Start" : `Step ${depth}`);

interface StackPageProps {
  /** Searches a ghosted step again, rejoining this stack. */
  onSearchStep: (params: SearchParams, known?: KnownAlbum) => void;
  isSearching: boolean;
}

/** An unsaved ancestor: ghosted, with a way to search it again. */
const GhostCard: React.FC<{
  ghost: GhostStep;
  onSearch: () => void;
  disabled: boolean;
}> = ({ ghost, onSearch, disabled }) => {
  const { step } = ghost;
  const own = usableImageUrl(step.thumb);
  const key = !own ? step.targetKey : "";
  const cover = useCoverArt(key ? [key] : []);
  return (
    <li className="flex min-w-0 items-center gap-3 rounded-[10px] border border-dashed p-2.5 lg:gap-4 lg:p-3.5">
      <AlbumCover
        src={own || (key && cover(key)) || ""}
        title={step.title}
        className="h-12 w-12 rounded-[3px] text-xs opacity-60 lg:h-16 lg:w-16 lg:rounded lg:text-sm"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:gap-1">
        <span className="truncate text-[15px] font-semibold text-muted-foreground md:text-base">
          {step.title}
        </span>
        <span className="truncate text-[13px] text-faint md:text-sm">
          {step.artist}
        </span>
        <span className="font-mono text-xs text-faint">Not saved</span>
      </span>
      <button
        type="button"
        onClick={onSearch}
        disabled={disabled}
        className={cn(
          "inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-border-strong px-3 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-60",
          focusRing,
        )}
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        Search
        <span className="sr-only"> {step.title} again</span>
      </button>
    </li>
  );
};

/**
 * /library/stack/:stackId — the saved searches from one trail, in trail
 * order or newest first. Ancestors that aren't saved show ghosted, with a
 * Search action that rejoins the stack.
 */
export const StackPage: React.FC<StackPageProps> = ({
  onSearchStep,
  isSearching,
}) => {
  const { stackId = "" } = useParams();
  const navigate = useNavigate();
  const {
    searches,
    savedSearchIds,
    savedSearchesLoaded,
    saveSearch,
    unsaveSearch,
    clearSearch,
    restoreSearch,
  } = useCache();
  const { toast } = useToast();
  const [order, setOrder] = useState<StackOrder>("depth");
  const [confirming, setConfirming] = useState<StackAction | null>(null);
  // The member whose Stack drawer is open.
  const [stacking, setStacking] = useState<SearchCache | null>(null);

  const members = useMemo(
    () => savedInStack(searches, savedSearchIds, stackId),
    [searches, savedSearchIds, stackId],
  );
  const stack: LibraryStack = { kind: "stack", stackId, members };
  const { levels, ghosts } = useMemo(
    () =>
      members.length
        ? stackLayout(stack)
        : { levels: new Map<string, number>(), ghosts: [] },
    // stack is built from members.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [members],
  );

  const reported = useRef(false);
  useEffect(() => {
    if (reported.current || members.length === 0) return;
    reported.current = true;
    track("stack_opened", { members: members.length, ghosts: ghosts.length });
  }, [members.length, ghosts.length]);

  if (!savedSearchesLoaded) return null;
  if (members.length === 0)
    return <Navigate to={libraryPath("saved")} replace />;

  const root = stackRoot(stack);
  const sorted = stackMembersByDepth(stack, order, levels);
  // The share image draws the trail to the deepest saved search.
  const deepest = stackMembersByDepth(stack, "depth", levels).at(-1)!;

  // In step order, ghosts sit at their step among the saved searches.
  type Entry =
    | { kind: "member"; search: SearchCache; depth: number }
    | { kind: "ghost"; ghost: GhostStep; depth: number };
  const memberEntries: Entry[] = sorted.map((search) => ({
    kind: "member",
    search,
    depth: levels.get(search.searchId) ?? 0,
  }));
  const ghostEntries: Entry[] = ghosts.map((ghost) => ({
    kind: "ghost",
    ghost,
    depth: ghost.depth,
  }));
  const entries: Entry[] =
    order === "depth"
      ? [...memberEntries, ...ghostEntries].sort((a, b) => a.depth - b.depth)
      : [...memberEntries, ...ghostEntries];

  const searchGhost = (ghost: GhostStep) => {
    const target = targetFromKey(ghost.step.targetKey);
    onSearchStep(
      { artist: ghost.step.artist, album: ghost.step.title },
      target
        ? { target, thumb: ghost.step.thumb, lineage: ghost.lineage }
        : undefined,
    );
  };

  const toggleSave = async (searchId: string) => {
    const wasSaved = savedSearchIds.has(searchId);
    await (wasSaved ? unsaveSearch : saveSearch)(searchId);
    track("search_saved", { saved: !wasSaved, from: "library" });
  };

  // No warning for one search: the toast can undo it.
  const remove = async (searchId: string) => {
    const search = searches[searchId];
    if (savedSearchIds.has(searchId)) await unsaveSearch(searchId);
    clearSearch(searchId);
    if (!search) return;
    toast({
      title: "Search deleted",
      description: `${search.searchParams.album} by ${search.searchParams.artist}`,
      action: (
        <ToastAction
          altText="Undo delete"
          onClick={() => void restoreSearch(search, true)}
        >
          Undo
        </ToastAction>
      ),
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-4 md:px-6 md:pt-8">
      <Link
        to={libraryPath("saved")}
        className={cn(
          "-ml-2 inline-flex h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
          focusRing,
        )}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to library
      </Link>

      <header className="mt-3 flex flex-wrap items-center gap-4 md:mt-5 md:gap-6">
        <StackRootCover
          root={root}
          className="h-16 w-16 rounded-[3px] text-sm md:h-24 md:w-24 md:rounded md:text-base"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-mono text-xs uppercase tracking-[2px] text-primary-text md:text-[13px]">
            Stack
          </p>
          <h1 className="break-words font-display text-[30px] font-normal leading-none tracking-[0.3px] md:text-[48px] md:tracking-[0.5px]">
            {stackLabel(stack)}
          </h1>
          <p className="text-[13px] text-muted-foreground md:text-base">
            {root.artist} · {members.length} saved
            {ghosts.length > 0 && ` · ${ghosts.length} not saved`}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 md:w-auto">
          <ShareButton
            search={deepest}
            to={stackPath(stackId)}
            defaultLayout="trail"
          />
          <button
            type="button"
            onClick={() => setConfirming("disband")}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-lg border border-border-strong px-4 text-sm font-medium text-foreground hover:bg-secondary",
              focusRing,
            )}
          >
            <Ungroup className="h-4 w-4" aria-hidden="true" />
            Disband
          </button>
          <button
            type="button"
            onClick={() => setConfirming("delete")}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-lg border border-border-strong px-4 text-sm font-medium text-foreground hover:bg-secondary",
              focusRing,
            )}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete stack
          </button>
        </div>
      </header>

      <div
        role="radiogroup"
        aria-label="Order"
        className="mt-6 flex w-fit rounded-lg border p-1 md:mt-8"
      >
        {ORDERS.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={order === o.id}
            onClick={() => setOrder(o.id)}
            className={cn(
              "h-11 rounded-md px-4 text-sm font-medium transition-colors md:h-9",
              focusRing,
              order === o.id
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      <ol className="mt-4 flex flex-col gap-2.5 md:gap-3">
        {entries.map((entry) => (
          <li
            key={
              entry.kind === "member"
                ? entry.search.searchId
                : `ghost-${entry.ghost.step.searchId}`
            }
            className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-4"
          >
            <span className="w-16 shrink-0 font-mono text-xs text-faint">
              {stepLabel(entry.depth)}
            </span>
            <ul className="min-w-0 flex-1">
              {entry.kind === "member" ? (
                <LibraryCard
                  search={entry.search}
                  saved
                  from={{ from: "stack", stackId }}
                  onToggleSave={() => toggleSave(entry.search.searchId)}
                  onDelete={() => remove(entry.search.searchId)}
                  onStack={() => setStacking(entry.search)}
                />
              ) : (
                <GhostCard
                  ghost={entry.ghost}
                  onSearch={() => searchGhost(entry.ghost)}
                  disabled={isSearching}
                />
              )}
            </ul>
          </li>
        ))}
      </ol>

      <StackConfirm
        request={confirming && { stack, action: confirming }}
        onClose={() => setConfirming(null)}
        onDone={() => navigate(libraryPath("saved"))}
      />

      {stacking && (
        <SaveDrawer
          search={searches[stacking.searchId] ?? stacking}
          mode="stack"
          from="library"
          open
          onOpenChange={(open) => !open && setStacking(null)}
        />
      )}
    </div>
  );
};

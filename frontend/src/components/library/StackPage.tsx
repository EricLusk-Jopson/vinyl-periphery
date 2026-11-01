import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { LayersOff } from "../common/icons";
import { SearchParams } from "@/api/types";
import { useCache } from "@/contexts/cache/CacheContext";
import { SearchCache } from "@/contexts/cache/types";
import { KnownAlbum } from "@/hooks/useSearchRun";
import { track } from "@/lib/analytics";
import { libraryPath, stackPath, StackView, stackView } from "@/lib/routes";
import { ShareButton } from "../share/ShareButton";
import { targetFromKey } from "@/lib/searchTarget";
import {
  GhostStep,
  LibraryStack,
  linkLineLabel,
  linkLineText,
  savedInStack,
  StackParent,
  stackLabel,
  stackLayout,
  stackMembersByDepth,
  stackRoot,
} from "@/lib/stacks";
import { cn } from "@/lib/utils";
import { StackDrawer } from "./StackDrawer";
import { StackConfirm } from "./StackConfirm";
import { ToastAction } from "../ui/toast";
import { useToast } from "@/hooks/use-toast";
import { AlbumCover } from "../search/AlbumCover";
import { LibraryCard } from "./LibraryCard";
import { StackRootCover } from "./StackCard";
import { useCoverArt } from "@/hooks/useCoverArt";
import { useLikes } from "@/hooks/useLikes";
import { useHidden } from "@/hooks/useHidden";
import { useStackFilters } from "@/hooks/useStackFilters";
import { useStackSort } from "@/hooks/useStackSort";
import { metaAlbum } from "@/lib/metaAlbum";
import {
  albumsOn,
  filteredStackResults,
  sortStackResults,
} from "@/lib/stackFilters";
import { StackResults } from "./StackResults";
import { usableImageUrl } from "@/lib/searches";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { LIBRARY_GRID } from "./grid";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

const stepLabel = (depth: number) => (depth === 0 ? "Start" : `Step ${depth}`);

interface StackPageProps {
  /** Searches a ghosted step again, rejoining this stack. */
  onSearchStep: (params: SearchParams, known?: KnownAlbum) => void;
  isSearching: boolean;
}

/** A deleted step: ghosted, with a way to search it again. */
const GhostCard: React.FC<{
  ghost: GhostStep;
  parents: StackParent[];
  onSearch: () => void;
  disabled: boolean;
}> = ({ ghost, parents, onSearch, disabled }) => {
  const note = linkLineText(parents);
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
        <span className="font-mono text-xs text-faint">Deleted</span>
        {note && (
          <>
            <span
              className="line-clamp-2 break-words font-mono text-xs text-faint"
              aria-hidden="true"
            >
              {note}
            </span>
            <span className="sr-only">{linkLineLabel(parents)}</span>
          </>
        )}
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
 * /library/stack/:stackId — one stack, as a meta-album. The header sits
 * above two tabs: Results (the default) and Albums (`?view=albums`), its
 * searches in a section per step, each saying what links it to the step
 * before. Steps that were deleted show ghosted, with a Search action that
 * rejoins the stack.
 */
export const StackPage: React.FC<StackPageProps> = ({
  onSearchStep,
  isSearching,
}) => {
  const { stackId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const view = stackView(location.search);
  const headingId = useId();
  const {
    searches,
    savedSearchIds,
    savedSearchesLoaded,
    deleteSearch,
    restoreSearch,
  } = useCache();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  // The member whose Stack drawer is open.
  const [stacking, setStacking] = useState<SearchCache | null>(null);

  const members = useMemo(
    () => savedInStack(searches, savedSearchIds, stackId),
    [searches, savedSearchIds, stackId],
  );
  const stack: LibraryStack = { kind: "stack", stackId, members };
  const { levels, ghosts, parents } = useMemo(
    () =>
      members.length
        ? stackLayout(stack)
        : {
            levels: new Map<string, number>(),
            ghosts: [],
            parents: new Map<string, StackParent[]>(),
          },
    // stack is built from members.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [members],
  );

  // The Results tab: the members read as one album, filtered and sorted.
  const stackFilters = useStackFilters(stackId);
  const order = useStackSort();
  const likes = useLikes();
  const hidden = useHidden();
  const meta = useMemo(
    () => metaAlbum(stackMembersByDepth(stack, levels)),
    // stack is built from members.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [members, levels],
  );
  const results = useMemo(
    () =>
      sortStackResults(
        filteredStackResults(meta, stackFilters.filters, likes, hidden),
        order.sort,
        order.then,
      ),
    [meta, stackFilters.filters, likes, hidden, order.sort, order.then],
  );

  const reported = useRef(false);
  useEffect(() => {
    if (reported.current || members.length === 0) return;
    reported.current = true;
    track("stack_opened", { members: members.length, ghosts: ghosts.length });
  }, [members.length, ghosts.length]);

  if (!savedSearchesLoaded) return null;
  if (members.length === 0) return <Navigate to={libraryPath()} replace />;

  const root = stackRoot(stack);
  const sorted = stackMembersByDepth(stack, levels);

  // A section per step; deleted steps sit in theirs, after the searches.
  type Entry =
    | { kind: "member"; search: SearchCache }
    | { kind: "ghost"; ghost: GhostStep };
  const steps = new Map<number, Entry[]>();
  const add = (depth: number, entry: Entry) =>
    steps.set(depth, [...(steps.get(depth) ?? []), entry]);
  for (const search of sorted) {
    add(levels.get(search.searchId) ?? 0, { kind: "member", search });
  }
  for (const ghost of ghosts) add(ghost.depth, { kind: "ghost", ghost });
  const sections = Array.from(steps).sort(([a], [b]) => a - b);

  const changeView = (next: string) => {
    const tab: StackView = next === "albums" ? "albums" : "results";
    if (tab === view) return;
    track("stack_view_changed", { view: tab });
    navigate(stackPath(stackId, tab), { replace: true });
  };

  const searchGhost = (ghost: GhostStep) => {
    const target = targetFromKey(ghost.step.targetKey);
    onSearchStep(
      { artist: ghost.step.artist, album: ghost.step.title },
      target
        ? { target, thumb: ghost.step.thumb, lineage: ghost.lineage }
        : undefined,
    );
  };

  // No warning for one search: the toast can undo it.
  const remove = async (searchId: string) => {
    const search = searches[searchId];
    await deleteSearch(searchId);
    if (!search) return;
    toast({
      title: "Search deleted",
      description: `${search.searchParams.album} by ${search.searchParams.artist}`,
      action: (
        <ToastAction
          altText="Undo delete"
          onClick={() => void restoreSearch(search)}
        >
          Undo
        </ToastAction>
      ),
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-4 md:px-6 md:pt-8">
      <Link
        to={libraryPath()}
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
            {root.artist} · {members.length} searches
            {ghosts.length > 0 && ` · ${ghosts.length} deleted`}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 md:w-auto">
          <ShareButton
            search={root.search ?? sorted[0]}
            map={{
              centre: {
                key: root.targetKey,
                title: root.title,
                artist: root.artist,
                thumb: root.thumb,
              },
              members,
              levels,
              results,
            }}
            to={stackPath(stackId)}
          />
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-lg border border-border-strong px-4 text-sm font-medium text-foreground hover:bg-secondary",
              focusRing,
            )}
          >
            <LayersOff className="h-4 w-4" aria-hidden="true" />
            Destack
          </button>
        </div>
      </header>

      <Tabs value={view} onValueChange={changeView} className="mt-6 md:mt-8">
        <TabsList aria-label="Stack view">
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="albums">Albums</TabsTrigger>
        </TabsList>

        <TabsContent value="results" className="pt-6 lg:pt-8">
          {stackFilters.loaded && (
            <StackResults
              stackId={stackId}
              meta={meta}
              levels={levels}
              stackFilters={stackFilters}
              order={order}
              results={results}
              of={albumsOn(meta, stackFilters.filters)}
              onSearchFrom={onSearchStep}
              isSearching={isSearching}
            />
          )}
        </TabsContent>

        <TabsContent
          value="albums"
          className="flex flex-col gap-6 pt-6 md:gap-8"
        >
          {sections.map(([depth, entries]) => (
            <section
              key={depth}
              aria-labelledby={`${headingId}-step-${depth}`}
              className="flex flex-col gap-2.5 md:gap-3"
            >
              <h2
                id={`${headingId}-step-${depth}`}
                className="font-mono text-xs uppercase tracking-[1px] text-muted-foreground"
              >
                {stepLabel(depth)}
              </h2>
              <ul className={LIBRARY_GRID}>
                {entries.map((entry) => {
                  if (entry.kind === "ghost") {
                    return (
                      <GhostCard
                        key={`ghost-${entry.ghost.step.searchId}`}
                        ghost={entry.ghost}
                        parents={parents.get(entry.ghost.step.searchId) ?? []}
                        onSearch={() => searchGhost(entry.ghost)}
                        disabled={isSearching}
                      />
                    );
                  }
                  const links = parents.get(entry.search.searchId) ?? [];
                  return (
                    <LibraryCard
                      key={entry.search.searchId}
                      search={entry.search}
                      from={{ from: "stack", stackId }}
                      note={linkLineText(links) || undefined}
                      noteLabel={linkLineLabel(links) || undefined}
                      onDelete={() => remove(entry.search.searchId)}
                      onStack={() => setStacking(entry.search)}
                    />
                  );
                })}
              </ul>
            </section>
          ))}
        </TabsContent>
      </Tabs>

      <StackConfirm
        stack={confirming ? stack : null}
        onClose={() => setConfirming(false)}
        onDone={() => navigate(libraryPath())}
      />

      {stacking && (
        <StackDrawer
          search={searches[stacking.searchId] ?? stacking}
          from="library"
          open
          onOpenChange={(open) => !open && setStacking(null)}
        />
      )}
    </div>
  );
};

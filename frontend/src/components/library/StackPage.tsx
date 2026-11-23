import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { pageAction } from "../common/buttons";
import { PageBack } from "../layout/PageBack";
import { PageHero } from "../layout/PageHero";
import { SearchParams } from "@/api/types";
import { useCache } from "@/contexts/cache/CacheContext";
import { SearchCache } from "@/contexts/cache/types";
import { KnownAlbum } from "@/hooks/useSearchRun";
import { track } from "@/lib/analytics";
import {
  artistIdFromRoute,
  artistPath,
  libraryPath,
  ResultFrom,
  stackPath,
  StackView,
  stackView,
} from "@/lib/routes";
import { ShareButton } from "../share/ShareButton";
import { PageSort } from "@/lib/share";
import {
  STACK_SORT_OPTIONS,
  StackSortKey,
  stackTiebreakOptions,
} from "@/lib/stackFilters";
import { SortKey } from "@/lib/results";
import { targetFromKey } from "@/lib/searchTarget";
import {
  activeAlbumsText,
  albumsOnOf,
  artistStack,
  GhostStep,
  LibraryStack,
  linkLineLabel,
  linkLineText,
  stackLabel,
  stackLayout,
  stackMembersByDepth,
  stackBadge,
  stackRoot,
  UNLINKED,
} from "@/lib/stacks";
import { useLibraryStacks } from "@/hooks/useLibraryStacks";
import { useLibraryArtists } from "@/hooks/useLibraryArtists";
import { ArtistCard } from "./ArtistCard";
import { ArtistAlbumToggles } from "./ArtistAlbumToggles";
import { cn } from "@/lib/utils";
import { StackDrawer } from "./StackDrawer";
import { DeleteStackConfirm } from "./DeleteStackConfirm";
import { StackEditor } from "./StackEditor";
import { AlbumCover } from "../search/AlbumCover";
import { LibraryCard } from "./LibraryCard";
import { StackRootCover } from "./StackCard";
import { useCoverArt } from "@/hooks/useCoverArt";
import { useLikes } from "@/hooks/useLikes";
import { useHidden } from "@/hooks/useHidden";
import { useStackFilters } from "@/hooks/useStackFilters";
import { filtersRequested, onFilterRequest } from "@/lib/filterRequest";
import { useStackSort } from "@/hooks/useStackSort";
import { metaAlbum } from "@/lib/metaAlbum";
import {
  albumsOn,
  countedByAlbum,
  filteredStackResults,
  sortStackResults,
} from "@/lib/stackFilters";
import { StackResults } from "./StackResults";
import { usableImageUrl } from "@/lib/searches";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { LIBRARY_GRID } from "./grid";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

const stepLabel = (depth: number) =>
  depth === UNLINKED
    ? "Not linked to the start"
    : depth === 0
      ? "Start"
      : `Step ${depth}`;

interface StackPageProps {
  /** Searches an album again (a deleted one, or from a result). */
  onSearchStep: (params: SearchParams, known?: KnownAlbum) => void;
  isSearching: boolean;
}

/**
 * An album deleted from the library, still in the stack: ghosted, with a
 * way to search it again (the new search takes its place in the stack).
 */
const GhostCard: React.FC<{
  ghost: GhostStep;
  onSearch: () => void;
  disabled: boolean;
}> = ({ ghost, onSearch, disabled }) => {
  const { member } = ghost;
  const own = usableImageUrl(member.thumb);
  const key = !own ? member.targetKey : "";
  const cover = useCoverArt(key ? [key] : []);
  return (
    <li className="flex min-w-0 items-center gap-3 rounded-[10px] border border-dashed p-2.5 lg:gap-4 lg:p-3.5">
      <AlbumCover
        src={own || (key && cover(key)) || ""}
        title={member.title}
        className="h-12 w-12 rounded-[3px] text-xs opacity-60 lg:h-16 lg:w-16 lg:rounded lg:text-sm"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:gap-1">
        <span className="truncate text-[15px] font-semibold text-muted-foreground md:text-base">
          {member.title}
        </span>
        <span className="truncate text-[13px] text-faint md:text-sm">
          {member.artist}
        </span>
        <span className="font-mono text-xs text-faint">
          Deleted from your library
        </span>
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
        <span className="sr-only"> {member.title} again</span>
      </button>
    </li>
  );
};

/**
 * /library/stack/:stackId — one stack (a record: see lib/stackRecords),
 * as a meta-album. The header has Share, Edit (name and albums) and
 * Delete (the stack only: its albums stay). Two tabs: Albums (the
 * default), a section per step from the start, each card saying what
 * links it to the step before, then any not linked to the start and any
 * deleted from the library (ghosted, with Search); and Results
 * (`?view=results`), the stack's results together. Albums are added and
 * taken out with Edit, or each card's Stacks drawer. A stack starting
 * from an artist shows them as one card at the start, with their albums
 * switched on and off there (the stack's own filters).
 */
export const StackPage: React.FC<StackPageProps> = (props) => {
  const { stackId = "" } = useParams();
  const { savedSearchesLoaded } = useCache();
  const found = useLibraryStacks().find((s) => s.stackId === stackId);
  if (!savedSearchesLoaded) return null;
  if (!found) return <Navigate to={libraryPath()} replace />;
  return <StackBody key={stackId} {...props} stack={found} mode="stack" />;
};

/**
 * /library/artist/:artist — every album of one main artist in the
 * library, read as a stack starting from the artist: the same Albums and
 * Results tabs, every album at step 0. Nothing to keep or edit: a new
 * search by them joins as it finishes. Its albums are switched on and off
 * in the header or the filters (its own, kept under the artist's id), and
 * New stack starts a stack from the artist for further steps.
 */
export const ArtistPage: React.FC<StackPageProps> = (props) => {
  const { artist: param = "" } = useParams();
  const artistId = artistIdFromRoute(param);
  const { savedSearchesLoaded } = useCache();
  const found = useLibraryArtists().find((a) => a.artistId === artistId);
  const stack = useMemo(() => found && artistStack(found), [found]);
  if (!savedSearchesLoaded) return null;
  if (!stack) return <Navigate to={libraryPath()} replace />;
  return <StackBody key={artistId} {...props} stack={stack} mode="artist" />;
};

const StackBody: React.FC<
  StackPageProps & { stack: LibraryStack; mode: "stack" | "artist" }
> = ({ onSearchStep, isSearching, stack, mode }) => {
  const stackId = stack.stackId;
  const artistMode = mode === "artist";
  const pathFor = (tab: StackView) =>
    artistMode ? artistPath(stackId, tab) : stackPath(stackId, tab);
  const from: ResultFrom = artistMode
    ? { from: "artist", artistId: stackId }
    : { from: "stack", stackId };
  const navigate = useNavigate();
  const location = useLocation();
  const view = stackView(location.search);
  const headingId = useId();
  const { searches } = useCache();
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  // A new stack starting from this artist.
  const [creating, setCreating] = useState(false);
  // The member whose Stacks drawer is open.
  const [stacking, setStacking] = useState<SearchCache | null>(null);

  const stacks = useLibraryStacks();
  const members = stack.members;
  const { levels, ghosts, parents } = useMemo(
    () => stackLayout(stack),
    [stack],
  );
  // The share map rings albums by step: unlinked ones go one step out.
  const shareLevels = useMemo(() => {
    const deepest = Math.max(0, ...levels.values());
    return new Map(
      Array.from(levels, ([id, level]) => [
        id,
        level === UNLINKED ? deepest + 1 : level,
      ]),
    );
  }, [levels]);

  // The Results tab: the members read as one album, filtered and sorted.
  const stackFilters = useStackFilters(stackId);
  const order = useStackSort();
  // The same sort, as the share sheet shows and changes it.
  const pageSort = useMemo<PageSort>(
    () => ({
      sort: order.sort,
      then: order.then,
      options: STACK_SORT_OPTIONS,
      tiebreaks: stackTiebreakOptions(order.sort),
      setSort: (sort) => order.setSort(sort as StackSortKey),
      setThen: (then) => order.setThen(then as SortKey | null),
    }),
    // The setters are stable state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [order.sort, order.then],
  );
  const likes = useLikes();
  const hidden = useHidden();
  const meta = useMemo(
    () => metaAlbum(stackMembersByDepth(stack, levels)),
    [stack, levels],
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

  // "More filters" in the share sheet: the filters are on the Results tab.
  useEffect(
    () =>
      onFilterRequest(() => {
        if (filtersRequested() && view !== "results") {
          navigate(pathFor("results"), { replace: true });
        }
      }),
    // pathFor follows stackId and mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, navigate, stackId, mode],
  );

  // Who counts on each stack album, for the People and Transit images.
  const counted = useMemo(
    () => countedByAlbum(meta, stackFilters.filters),
    [meta, stackFilters.filters],
  );

  const reported = useRef(false);
  useEffect(() => {
    if (reported.current || members.length === 0) return;
    reported.current = true;
    if (artistMode) track("artist_opened", { albums: members.length });
    else
      track("stack_opened", {
        members: members.length,
        ghosts: ghosts.length,
        ...(stack.artist ? { artist: true } : {}),
      });
  }, [members.length, ghosts.length, artistMode, stack.artist]);

  // An artist's albums switched on or off, from the header or a card.
  const toggleAlbum = (key: string, on: boolean) => {
    track("artist_albums_toggled", { on, from: mode });
    stackFilters.update({
      albums: { ...stackFilters.filters.albums, [key]: on },
    });
  };
  const artistAlbums = stack.artist?.albums ?? [];
  const artistOn = albumsOnOf(artistAlbums, stackFilters.filters.albums);

  const root = stackRoot(stack);
  const sorted = stackMembersByDepth(stack, levels);

  // A section per step, then albums not linked to the start, then those
  // deleted from the library.
  const steps = new Map<number, SearchCache[]>();
  for (const search of sorted) {
    const depth = levels.get(search.searchId) ?? UNLINKED;
    steps.set(depth, [...(steps.get(depth) ?? []), search]);
  }
  // The artist a stack starts from keeps its card with no albums left.
  if (stack.artist && !artistMode && !steps.has(0)) steps.set(0, []);
  const sections = Array.from(steps).sort(([a], [b]) =>
    a === UNLINKED ? 1 : b === UNLINKED ? -1 : a - b,
  );

  const changeView = (next: string) => {
    const tab: StackView = next === "results" ? "results" : "albums";
    if (tab === view) return;
    track("stack_view_changed", {
      view: tab,
      ...(artistMode ? { artist: true } : {}),
    });
    navigate(pathFor(tab), { replace: true });
  };

  // A deleted album searched again: the new search is found by its album,
  // so it takes its place in the stack.
  const searchGhost = (ghost: GhostStep) => {
    const target = targetFromKey(ghost.member.targetKey);
    onSearchStep(
      { artist: ghost.member.artist, album: ghost.member.title },
      target ? { target, thumb: ghost.member.thumb } : undefined,
    );
  };

  return (
    <>
      <PageBack />
      <PageHero
        cover={
          <StackRootCover
            root={root}
            className="h-16 w-16 rounded-[3px] text-[13px] md:h-[88px] md:w-[88px] md:rounded md:text-base lg:h-28 lg:w-28"
          />
        }
        eyebrow={artistMode ? "Artist" : "Stack"}
        title={stackLabel(stack)}
        meta={
          artistMode ? (
            <>
              {activeAlbumsText(artistOn.length, artistAlbums.length)} in your
              library
            </>
          ) : (
            <>
              {members.length} {members.length === 1 ? "album" : "albums"} ·
              from {root.title}
              {stack.artist && " (artist)"}
              {ghosts.length > 0 && ` · ${ghosts.length} deleted`}
            </>
          )
        }
        actions={
          <>
            {members.length > 0 && (
              <ShareButton
                search={root.search ?? sorted[0]}
                map={{
                  centre: {
                    key: root.targetKey,
                    title: root.title,
                    artist: root.artist,
                    thumb: root.thumb,
                  },
                  name: stack.record.name,
                  members,
                  levels: shareLevels,
                  results,
                  counted,
                }}
                order={pageSort}
                draftKey={`${artistMode ? "artist" : "stack"}:${stackId}`}
                stackFilters={{
                  filters: stackFilters.filters,
                  update: stackFilters.update,
                  meta,
                }}
              />
            )}
            {artistMode ? (
              <>
                {artistAlbums.length > 1 && stackFilters.loaded && (
                  <ArtistAlbumToggles
                    artist={stack.record.name}
                    albums={artistAlbums}
                    states={stackFilters.filters.albums}
                    onToggle={toggleAlbum}
                    className="px-4 text-[15px]"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className={pageAction}
                >
                  <Plus
                    className="h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  New stack
                  <span className="sr-only"> from {stack.record.name}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className={pageAction}
                >
                  <Pencil
                    className="h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className={pageAction}
                >
                  <Trash2
                    className="h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Delete stack
                </button>
              </>
            )}
          </>
        }
      />
      <div className="mx-auto w-full max-w-[1280px] px-4 pb-24 md:px-6">
        <Tabs value={view} onValueChange={changeView} className="mt-4 md:mt-6">
          <TabsList aria-label={artistMode ? "Artist view" : "Stack view"}>
            <TabsTrigger value="albums">Albums</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="pt-6 lg:pt-8">
            {stackFilters.loaded && (
              <StackResults
                stackId={stackId}
                from={from}
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
                  {artistMode ? "Albums" : stepLabel(depth)}
                </h2>
                {depth === UNLINKED && (
                  <p className="text-[13px] text-muted-foreground">
                    Nothing links these to the start since an album was taken
                    out. Add an album that links them, or take them out with
                    Edit.
                  </p>
                )}
                <ul className={LIBRARY_GRID}>
                  {/* A stack starting from an artist: them, as one card. */}
                  {depth === 0 && stack.artist && !artistMode && (
                    <ArtistCard
                      name={stack.artist.member.title}
                      albums={artistAlbums}
                      states={stackFilters.filters.albums}
                      to={artistPath(stack.artist.member.targetKey)}
                      state={from}
                      onToggle={stackFilters.loaded ? toggleAlbum : undefined}
                    />
                  )}
                  {entries
                    .filter(
                      (search) =>
                        artistMode ||
                        depth !== 0 ||
                        !stack.artist?.albums.includes(search),
                    )
                    .map((search) => {
                      const links = parents.get(search.searchId) ?? [];
                      const off =
                        artistMode &&
                        !artistOn.includes(search) &&
                        stackFilters.loaded;
                      return (
                        <LibraryCard
                          key={search.searchId}
                          search={search}
                          from={from}
                          note={
                            off
                              ? "Switched off here"
                              : linkLineText(links) || undefined
                          }
                          noteLabel={
                            off ? undefined : linkLineLabel(links) || undefined
                          }
                          onStack={() => setStacking(search)}
                          stackBadge={stackBadge(search, stacks)}
                        />
                      );
                    })}
                </ul>
              </section>
            ))}
            {ghosts.length > 0 && (
              <section
                aria-labelledby={`${headingId}-deleted`}
                className="flex flex-col gap-2.5 md:gap-3"
              >
                <h2
                  id={`${headingId}-deleted`}
                  className="font-mono text-xs uppercase tracking-[1px] text-muted-foreground"
                >
                  Deleted from your library
                </h2>
                <ul className={LIBRARY_GRID}>
                  {ghosts.map((ghost) => (
                    <GhostCard
                      key={`ghost-${ghost.member.searchId}`}
                      ghost={ghost}
                      onSearch={() => searchGhost(ghost)}
                      disabled={isSearching}
                    />
                  ))}
                </ul>
              </section>
            )}
          </TabsContent>
        </Tabs>

        <DeleteStackConfirm
          stack={confirming ? stack : null}
          onClose={() => setConfirming(false)}
          onDone={() => navigate(libraryPath())}
        />
        {editing && (
          <StackEditor
            open
            stack={stack}
            onOpenChange={(open) => !open && setEditing(false)}
          />
        )}
        {creating && stack.artist && (
          <StackEditor
            open
            startArtist={stack.artist.member}
            initialFilters={{ albums: stackFilters.filters.albums }}
            onOpenChange={(open) => !open && setCreating(false)}
          />
        )}

        {stacking && (
          <StackDrawer
            search={searches[stacking.searchId] ?? stacking}
            from="stack"
            open
            onOpenChange={(open) => !open && setStacking(null)}
          />
        )}
      </div>
    </>
  );
};

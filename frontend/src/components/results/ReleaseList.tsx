import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { SearchParams } from "@/api/types";
import { KnownAlbum } from "@/hooks/useSearchRun";
import { useCoverArt } from "@/hooks/useCoverArt";
import { searchTarget } from "@/lib/searchTarget";
import { resultPath } from "@/lib/routes";
import { SearchCache } from "@/contexts/cache/types";
import {
  useCache,
  useFilteredAndScoredReleases,
} from "@/contexts/cache/CacheContext";
import {
  SORT_OPTIONS,
  ScoredRelease,
  SortKey,
  hasPopularity,
  resetFilterState,
  sharedPeople,
  sortReleases,
  tiebreakOptions,
} from "@/lib/results";
import { track } from "@/lib/analytics";
import { useLikes } from "@/hooks/useLikes";
import { setLiked } from "@/services/likes";
import { cn } from "@/lib/utils";
import { pinToTop } from "@/lib/resultSearch";
import { iconButton } from "../common/buttons";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ReleaseRow } from "./ReleaseRow";
import { ResultSearch } from "./ResultSearch";

const PAGE_SIZE = 20;

interface ReleaseListProps {
  searchId: string;
  /** Starts a search for exactly the row's album, by its Discogs id. */
  onSearchFrom: (params: SearchParams, known: KnownAlbum) => void;
  isSearching: boolean;
  /** Shown at the end of the toolbar, e.g. the Filters button below lg. */
  toolbarAction?: React.ReactNode;
}

const quietButton =
  "h-11 rounded-lg border bg-surface px-6 text-[15px] font-medium text-foreground transition-colors hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

/** Count, find, sort, the result rows, and "Show more". */
export const ReleaseList: React.FC<ReleaseListProps> = ({
  searchId,
  onSearchFrom,
  isSearching,
  toolbarAction,
}) => {
  const { searches, updateFilterState } = useCache();
  const likes = useLikes();
  const { releases } = useFilteredAndScoredReleases(searchId);
  const search = searches[searchId];
  const sortId = useId();

  const [sort, setSort] = useState<SortKey>("shared");
  // "Then by": a second sort for ties, offered on desktop only.
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [thenBy, setThenBy] = useState<SortKey | null>(null);
  const tiebreaks = tiebreakOptions(sort);
  const then =
    desktop && tiebreaks.some((o) => o.value === thenBy) ? thenBy : null;
  const [visible, setVisible] = useState(PAGE_SIZE);
  // By release key: masters and releases can share a numeric id.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  // Picked in the results search: shown first, whatever the sort.
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  // Below md the results search opens from a button.
  const [findOpen, setFindOpen] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!isSearching) setPendingKey(null);
  }, [isSearching]);

  const sorted = useMemo(
    () =>
      pinToTop(
        sortReleases(releases as ScoredRelease[], sort, then),
        pinnedKey,
      ),
    [releases, sort, then, pinnedKey],
  );
  const visibleKeys = useMemo(
    () => new Set(releases.map((r) => r.key)),
    [releases],
  );

  const pin = (key: string | null) => {
    setPinnedKey(key);
    if (!key) return;
    setOpenKey(key);
    setVisible(PAGE_SIZE);
    // After the list re-renders with it on top: if the list's top has
    // scrolled away (or under the sticky toolbar), bring it back.
    requestAnimationFrame(() => {
      const list = listRef.current;
      if (list && list.getBoundingClientRect().top < 80) {
        list.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    });
  };

  // Albums already searched (this session or saved), by target key, so
  // their rows open that search instead of running another.
  const searchedByKey = useMemo(() => {
    const byKey = new Map<string, SearchCache>();
    for (const s of Object.values(searches)) {
      if (s.target && s.searchId !== searchId) byKey.set(s.target.key, s);
    }
    return byKey;
  }, [searches, searchId]);

  // Art for rows on screen first, then the rest of the list.
  const coverKeys = useMemo(() => sorted.map((r) => r.key), [sorted]);
  const shownKeys = coverKeys.slice(0, visible);
  const cover = useCoverArt(
    [...shownKeys, ...coverKeys.slice(visible)],
    searchId,
  );

  if (!search) return null;

  const total = sorted.length;
  const current =
    SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0];
  const shown = sorted.slice(0, visible);
  const hasAnyReleases = Object.keys(search.releases).length > 0;

  const searchFrom = (release: ScoredRelease) => {
    setPendingKey(release.key);
    onSearchFrom(
      { artist: release.artist, album: release.title },
      {
        target: searchTarget(release.type, release.id),
        thumb: cover(release.key) || release.thumb,
        // Lineage: this search, and who linked the row to it.
        from: { parentSearchId: searchId, via: release.activeContributors },
      },
    );
  };

  return (
    <section
      aria-labelledby={`${sortId}-count`}
      className="flex flex-col gap-4"
    >
      {/* Below lg the toolbar sticks to the top of the screen while the list
          scrolls, so sorting and filters stay in reach. */}
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background px-4 py-2 md:-mx-6 md:gap-3 md:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
        <h2
          id={`${sortId}-count`}
          className="mr-auto shrink-0 text-[15px] font-semibold md:text-lg"
        >
          {total.toLocaleString("en-US")} {total === 1 ? "album" : "albums"}
        </h2>
        <ResultSearch
          searchId={searchId}
          visibleKeys={visibleKeys}
          onPin={pin}
          expanded={findOpen}
          onCollapse={() => setFindOpen(false)}
        />
        <div className="flex min-w-0 items-center gap-2 md:gap-2.5">
          {!findOpen && (
            <button
              type="button"
              onClick={() => setFindOpen(true)}
              aria-label="Find an album in these results"
              className={cn(iconButton, "border bg-surface md:hidden")}
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <label
            htmlFor={sortId}
            className="sr-only text-sm text-muted-foreground md:not-sr-only"
          >
            Sort by
          </label>
          <Select
            value={sort}
            onValueChange={(value) => {
              setSort(value as SortKey);
              setVisible(PAGE_SIZE);
            }}
          >
            <SelectTrigger id={sortId} className="lg:h-10">
              {/* Short when closed; the menu shows the full labels. */}
              <SelectValue>{current.short}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {desktop && (
            <>
              <label
                htmlFor={`${sortId}-then`}
                className="shrink-0 text-sm text-muted-foreground"
              >
                then
              </label>
              <Select
                value={then ?? "ranking"}
                onValueChange={(value) => {
                  setThenBy(value === "ranking" ? null : (value as SortKey));
                  setVisible(PAGE_SIZE);
                }}
              >
                <SelectTrigger id={`${sortId}-then`} className="lg:h-10">
                  <SelectValue>
                    {tiebreaks.find((o) => o.value === then)?.short ??
                      "Ranking"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="ranking">
                    Ranking (no tiebreaker)
                  </SelectItem>
                  {tiebreaks.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          {toolbarAction}
        </div>
      </div>

      {sort === "popular" &&
        total > 0 &&
        !hasPopularity(Object.values(search.releases)) && (
          <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
            This search was run before Discogs want and have counts were kept,
            so it can't be sorted by popularity. Delete it and search for the
            album again to get them.
          </p>
        )}

      {total > 0 ? (
        <ul ref={listRef} className="scroll-mt-20 lg:scroll-mt-6 lg:border-t">
          {shown.map((release, i) => {
            const people = sharedPeople(release, search.contributors);
            const position = {
              rank: i + 1,
              shared: people.length,
              sort,
              ...(then ? { then } : {}),
            };
            return (
              <ReleaseRow
                key={release.key}
                release={release}
                cover={cover(release.key)}
                existing={(() => {
                  const found = searchedByKey.get(release.key);
                  return found
                    ? {
                        to: resultPath(found.searchParams, found.target),
                        state: { from: "home" },
                        onOpen: () =>
                          track("search_jumped", { from: "result" }),
                      }
                    : undefined;
                })()}
                people={people}
                searchedAlbum={search.searchParams.album}
                open={openKey === release.key}
                onToggle={() => {
                  if (openKey !== release.key) track("result_opened", position);
                  setOpenKey((key) =>
                    key === release.key ? null : release.key,
                  );
                }}
                onSearchFrom={() => searchFrom(release)}
                onOpenDiscogs={() => track("discogs_opened", position)}
                searching={isSearching}
                searchingFromHere={isSearching && pendingKey === release.key}
                liked={Boolean(likes[release.key])}
                onToggleLike={() => {
                  const liked = setLiked(release.key, !likes[release.key], {
                    title: release.title,
                    artist: release.artist,
                  });
                  track("result_liked", { liked, ...position });
                }}
              />
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
          <p className="text-base font-semibold">
            {hasAnyReleases
              ? "No albums match these filters"
              : "No connected albums found"}
          </p>
          {hasAnyReleases ? (
            <button
              type="button"
              onClick={() => {
                track("filter_changed", { filter: "reset", on: true });
                updateFilterState(searchId, resetFilterState(search));
              }}
              className={cn(quietButton, "bg-transparent px-4 text-sm")}
            >
              Reset filters
            </button>
          ) : (
            <p className="max-w-md text-sm text-muted-foreground">
              Discogs didn't list other releases for the people credited on this
              album.
            </p>
          )}
        </div>
      )}

      {total > 0 && (
        <div className="flex flex-col items-center gap-2.5 pt-3">
          {visible < total && (
            <button
              type="button"
              onClick={() => setVisible((n) => n + PAGE_SIZE)}
              className={quietButton}
            >
              Show more
            </button>
          )}
          <span className="font-mono text-xs text-faint" aria-live="polite">
            Showing {shown.length.toLocaleString("en-US")} of{" "}
            {total.toLocaleString("en-US")}
          </span>
        </div>
      )}
    </section>
  );
};

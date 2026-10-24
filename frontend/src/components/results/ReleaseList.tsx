import React, { useEffect, useId, useMemo, useState } from "react";
import { SearchParams } from "@/api/types";
import {
  useCache,
  useFilteredAndScoredReleases,
} from "@/contexts/cache/CacheContext";
import {
  SORT_OPTIONS,
  ScoredRelease,
  SortKey,
  resetFilterState,
  sharedPeople,
  sortReleases,
} from "@/lib/results";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ReleaseRow } from "./ReleaseRow";

const PAGE_SIZE = 20;

interface ReleaseListProps {
  searchId: string;
  onSearchFrom: (params: SearchParams) => void;
  isSearching: boolean;
  /** Shown at the end of the toolbar, e.g. the Filters button below lg. */
  toolbarAction?: React.ReactNode;
}

const quietButton =
  "h-11 rounded-lg border bg-surface px-6 text-[15px] font-medium text-foreground transition-colors hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

/** Count, sort, the result rows, and "Show more". */
export const ReleaseList: React.FC<ReleaseListProps> = ({
  searchId,
  onSearchFrom,
  isSearching,
  toolbarAction,
}) => {
  const { searches, updateFilterState } = useCache();
  const { releases } = useFilteredAndScoredReleases(searchId);
  const search = searches[searchId];
  const sortId = useId();
  // Short sort labels on phones, where the toolbar shares one row.
  const wide = useMediaQuery("(min-width: 768px)");

  const [sort, setSort] = useState<SortKey>("shared");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [openId, setOpenId] = useState<number | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  useEffect(() => {
    if (!isSearching) setPendingId(null);
  }, [isSearching]);

  const sorted = useMemo(
    () => sortReleases(releases as ScoredRelease[], sort),
    [releases, sort],
  );

  if (!search) return null;

  const total = sorted.length;
  const current =
    SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0];
  const shown = sorted.slice(0, visible);
  const hasAnyReleases = Object.keys(search.releases).length > 0;

  const searchFrom = (release: ScoredRelease) => {
    setPendingId(release.id);
    onSearchFrom({ artist: release.artist, album: release.title });
  };

  return (
    <section
      aria-labelledby={`${sortId}-count`}
      className="flex flex-col gap-4"
    >
      {/* Below lg the toolbar sticks to the top of the screen while the list
          scrolls, so sorting and filters stay in reach. */}
      <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-2 border-b bg-background px-4 py-2 md:-mx-6 md:gap-3 md:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
        <h2
          id={`${sortId}-count`}
          className="shrink-0 text-[15px] font-semibold md:text-lg"
        >
          {total.toLocaleString("en-US")} {total === 1 ? "album" : "albums"}
        </h2>
        <div className="flex min-w-0 items-center gap-2 md:gap-2.5">
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
              {/* Short label on phones; the menu always shows the full one. */}
              <SelectValue>{wide ? current.label : current.short}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {toolbarAction}
        </div>
      </div>

      {total > 0 ? (
        <ul className="lg:border-t">
          {shown.map((release) => (
            <ReleaseRow
              key={release.id}
              release={release}
              people={sharedPeople(release, search.contributors)}
              searchedAlbum={search.searchParams.album}
              open={openId === release.id}
              onToggle={() =>
                setOpenId((id) => (id === release.id ? null : release.id))
              }
              onSearchFrom={() => searchFrom(release)}
              searching={isSearching}
              searchingFromHere={isSearching && pendingId === release.id}
            />
          ))}
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
              onClick={() =>
                updateFilterState(searchId, resetFilterState(search))
              }
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

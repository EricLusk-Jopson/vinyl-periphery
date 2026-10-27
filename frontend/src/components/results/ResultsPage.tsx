import React, { useEffect, useMemo } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SearchParams, SearchTarget } from "@/api/types";
import { KnownAlbum } from "@/hooks/useSearchRun";
import { useCache } from "@/contexts/cache/CacheContext";
import {
  HOME_PATH,
  backLink,
  legacyResultParams,
  resultParams,
  resultPath,
  resultTarget,
} from "@/lib/routes";
import { matchingSearchIds } from "@/lib/searchTarget";
import { cn } from "@/lib/utils";
import { FilterPanel } from "../filters/FilterPanel";
import { FilterFrame } from "../filters/FilterFrame";
import { AlbumHeader } from "./AlbumHeader";
import { ReleaseList } from "./ReleaseList";

interface ResultsPageProps {
  onSearchFrom: (params: SearchParams, known: KnownAlbum) => void;
  /** Runs the search named in the URL, when it isn't cached here. */
  onRunSearch: (params: SearchParams, target: SearchTarget | null) => void;
  isSearching: boolean;
}

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

const primaryButton = cn(
  "inline-flex h-11 items-center rounded-lg bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-dark disabled:pointer-events-none disabled:opacity-60",
  focusRing,
);

const secondaryButton = cn(
  "inline-flex h-11 items-center rounded-lg border border-border-strong px-4 font-medium text-foreground hover:bg-secondary",
  focusRing,
);

/**
 * /results?artist=…&album=… — one search's results, with a way back. The URL
 * names the album, so on a device without that search cached (a shared link,
 * or a session that has ended) the page offers to run it.
 */
export const ResultsPage: React.FC<ResultsPageProps> = ({
  onSearchFrom,
  onRunSearch,
  isSearching,
}) => {
  const location = useLocation();
  const params = useMemo(
    () => resultParams(location.search),
    [location.search],
  );
  // `&master=` / `&release=` when the link names the exact album.
  const target = useMemo(
    () => resultTarget(location.search),
    [location.search],
  );
  const { searches, setActiveSearch, savedSearchesLoaded } = useCache();
  // One cached search per album: a repeat run replaces the earlier one.
  const searchId = params
    ? (matchingSearchIds(searches, params, target)[0] ?? "")
    : "";
  const search = searches[searchId];
  const back = backLink(location.state);

  // Keep the cache's active search in step with the URL.
  useEffect(() => {
    if (searchId) setActiveSearch(searchId);
  }, [searchId, setActiveSearch]);

  if (!params) return <Navigate to={HOME_PATH} replace />;

  if (!search) {
    // A saved search may still be loading from IndexedDB.
    if (!savedSearchesLoaded) return null;
    return (
      <div className="mx-auto flex max-w-[640px] flex-col items-center gap-3 px-4 py-20 text-center">
        <p className="text-sm text-muted-foreground">{params.artist}</p>
        <h1 className="font-display text-[30px] font-normal leading-none md:text-[34px]">
          {params.album}
        </h1>
        <p className="mt-2 text-muted-foreground">
          This search isn't on this device yet. Running it reads everyone
          credited on the album and their other work, which takes about a
          minute.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => onRunSearch(params, target)}
            disabled={isSearching}
            className={primaryButton}
          >
            {isSearching ? "Search in progress" : "Run this search"}
          </button>
          <Link to={HOME_PATH} className={secondaryButton}>
            New search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div key={searchId} className="duration-200 animate-in fade-in">
      {/* On phones the back link sits in the header instead. */}
      <div className="mx-auto hidden max-w-[1280px] px-2 md:block md:px-4">
        <Link
          to={back.to}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
            focusRing,
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {back.label}
        </Link>
      </div>
      <AlbumHeader search={search} />
      <div className="mx-auto max-w-[1280px] px-4 pb-12 md:px-6 lg:flex lg:pt-8 lg:items-start lg:gap-8 lg:pb-24">
        <aside
          aria-label="Filters"
          className="hidden lg:block lg:w-[300px] lg:shrink-0"
        >
          <FilterPanel searchId={searchId} variant="sidebar" />
        </aside>
        <div className="min-w-0 flex-1">
          <ReleaseList
            searchId={searchId}
            onSearchFrom={onSearchFrom}
            isSearching={isSearching}
            toolbarAction={
              <div className="lg:hidden">
                <FilterFrame searchId={searchId} />
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
};

/**
 * /results/:searchId, the URL before it named the album. Sends the link on to
 * the new URL: from the cached search, the one that replaced it, or the
 * names in the id where they split one way.
 */
export const LegacyResultsRedirect: React.FC = () => {
  const { searchId = "" } = useParams();
  const { state } = useLocation();
  const { searches, savedSearchesLoaded, replacedBy } = useCache();
  const cached = searches[searchId] ?? searches[replacedBy[searchId]];
  const params = cached?.searchParams ?? legacyResultParams(searchId);

  if (!params && !savedSearchesLoaded) return null;
  return (
    <Navigate
      to={params ? resultPath(params, cached?.target) : HOME_PATH}
      state={state}
      replace
    />
  );
};

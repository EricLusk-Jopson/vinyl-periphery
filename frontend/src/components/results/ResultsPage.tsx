import React, { useEffect } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SearchParams } from "@/api/types";
import { useCache } from "@/contexts/cache/CacheContext";
import { LIBRARY_PATH, HOME_PATH, backLink } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { FilterPanel } from "../filters/FilterPanel";
import { FilterSheet } from "../filters/FilterSheet";
import { AlbumHeader } from "./AlbumHeader";
import { ReleaseList } from "./ReleaseList";

interface ResultsPageProps {
  onSearchFrom: (params: SearchParams) => void;
  isSearching: boolean;
}

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

/** /results/:searchId — one search's results, with a way back. */
export const ResultsPage: React.FC<ResultsPageProps> = ({
  onSearchFrom,
  isSearching,
}) => {
  const { searchId = "" } = useParams();
  const location = useLocation();
  const { searches, setActiveSearch, savedSearchesLoaded } = useCache();
  const search = searches[searchId];
  const back = backLink(location.state);

  // Keep the cache's active search in step with the URL.
  const found = Boolean(search);
  useEffect(() => {
    if (found) setActiveSearch(searchId);
  }, [found, searchId, setActiveSearch]);

  if (!search) {
    // A saved search opened by URL may still be loading from IndexedDB.
    if (!savedSearchesLoaded) return null;
    return (
      <div className="mx-auto flex max-w-[640px] flex-col items-center gap-3 px-4 py-20 text-center">
        <h1 className="font-display text-[30px] font-normal leading-none md:text-[34px]">
          This search isn't available
        </h1>
        <p className="text-muted-foreground">
          Searches last until you close the tab, unless you save them. Run it
          again, or look in your library.
        </p>
        <div className="mt-2 flex gap-3">
          <Link
            to={HOME_PATH}
            className={cn(
              "inline-flex h-11 items-center rounded-lg bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-dark",
              focusRing,
            )}
          >
            New search
          </Link>
          <Link
            to={LIBRARY_PATH}
            className={cn(
              "inline-flex h-11 items-center rounded-lg border border-border-strong px-4 font-medium text-foreground hover:bg-secondary",
              focusRing,
            )}
          >
            Library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div key={searchId} className="duration-200 animate-in fade-in">
      <div className="mx-auto max-w-[1280px] px-2 md:px-4">
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
      <div className="mx-auto max-w-[1280px] px-4 pb-12 pt-3 md:px-6 md:pt-8 lg:flex lg:items-start lg:gap-8 lg:pb-24">
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
          />
        </div>
      </div>
      <FilterSheet searchId={searchId} />
    </div>
  );
};

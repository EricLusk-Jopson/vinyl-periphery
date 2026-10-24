import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Star } from "lucide-react";
import { useCache } from "@/contexts/cache/CacheContext";
import { LIBRARY_PATH, ResultFrom, resultPath } from "@/lib/routes";
import { recentSearches } from "@/lib/searches";
import { AlbumCover } from "../search/AlbumCover";

const RECENT_LIMIT = 3;

const FROM_HOME: ResultFrom = { from: "home" };

/** The last few searches from this session and the saved library. */
export const RecentSearches: React.FC = () => {
  const { searches, isSearchSaved } = useCache();
  const recent = recentSearches(searches, RECENT_LIMIT);

  if (recent.length === 0) return null;

  return (
    <section
      aria-labelledby="recent-heading"
      className="mx-auto w-full max-w-[1200px] px-4 pt-1 md:px-6 md:pb-6 md:pt-[72px]"
    >
      <div className="mb-2.5 flex items-center justify-between gap-4 md:mb-5 md:items-baseline">
        <h2
          id="recent-heading"
          className="text-[13px] font-medium uppercase tracking-[1px] text-muted-foreground md:font-display md:text-[34px] md:font-normal md:normal-case md:tracking-[0.5px] md:text-foreground"
        >
          <span className="md:hidden">Recent</span>
          <span className="hidden md:inline">Your recent searches</span>
        </h2>
        <Link
          to={LIBRARY_PATH}
          className="inline-flex h-11 items-center rounded-lg px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        >
          View library
        </Link>
      </div>

      <ul className="grid gap-2.5 md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] md:gap-4">
        {recent.map((search) => {
          const { artist, album } = search.searchParams;
          const albumCount = Object.keys(search.releases).length;
          const saved = isSearchSaved(search.searchId);
          const meta = `${albumCount} ${albumCount === 1 ? "album" : "albums"}${
            saved ? " · saved" : ""
          }`;

          return (
            <li key={search.searchId}>
              <Link
                to={resultPath(search.searchId)}
                state={FROM_HOME}
                className="flex w-full items-center gap-3 rounded-[10px] border bg-surface p-2.5 text-left transition-colors hover:border-border-strong hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring md:gap-4 md:p-3.5"
              >
                <AlbumCover
                  src={search.thumb}
                  title={album}
                  className="h-12 w-12 rounded-[3px] text-xs md:h-16 md:w-16 md:rounded md:text-sm"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:gap-1">
                  <span className="truncate text-[15px] font-semibold md:text-base">
                    {album}
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground md:text-sm">
                    {artist}
                    <span className="md:hidden"> · {meta}</span>
                  </span>
                  <span className="hidden font-mono text-xs text-faint md:block">
                    {meta}
                  </span>
                </span>
                {saved && (
                  <Star
                    className="hidden h-[18px] w-[18px] shrink-0 fill-primary text-primary md:block"
                    aria-hidden="true"
                  />
                )}
                <ChevronRight
                  className="h-[18px] w-[18px] shrink-0 text-faint md:hidden"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

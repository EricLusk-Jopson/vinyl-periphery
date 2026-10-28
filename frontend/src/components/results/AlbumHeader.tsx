import React, { useState } from "react";
import { Star } from "lucide-react";
import { useCache } from "@/contexts/cache/CacheContext";
import { SearchCache } from "@/contexts/cache/types";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { Grain } from "../layout/Grain";
import { SearchCover } from "../search/SearchCover";

interface AlbumHeaderProps {
  search: SearchCache;
}

/** The searched album above its results: cover, title, meta and Save. */
export const AlbumHeader: React.FC<AlbumHeaderProps> = ({ search }) => {
  const { isSearchSaved, saveSearch, unsaveSearch } = useCache();
  const [busy, setBusy] = useState(false);
  const saved = isSearchSaved(search.searchId);
  const { artist, album } = search.searchParams;
  const contributorCount = Object.keys(search.contributors).length;

  const toggleSave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await (saved ? unsaveSearch : saveSearch)(search.searchId);
      track("search_saved", { saved: !saved, from: "results" });
    } catch (error) {
      console.error("Failed to update saved search:", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="relative overflow-hidden border-b">
      <Grain className="opacity-10" />
      <div className="relative mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 md:flex-wrap md:gap-5 md:px-6 md:py-6 lg:gap-6 lg:py-9">
        <SearchCover
          search={search}
          className="h-14 w-14 rounded-[3px] text-[13px] md:h-[88px] md:w-[88px] md:rounded md:text-base lg:h-28 lg:w-28"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 md:flex-[1_1_360px] md:gap-1.5">
          <p className="font-mono text-xs uppercase tracking-[2px] text-primary-text md:text-[13px]">
            Connections from
          </p>
          <h1 className="line-clamp-2 break-words font-display text-[24px] font-normal leading-none tracking-[0.3px] md:line-clamp-none md:text-[40px] md:tracking-[0.5px] lg:text-[56px]">
            {album}
          </h1>
          <p className="text-[13px] text-muted-foreground md:text-base">
            {artist} · {contributorCount.toLocaleString("en-US")}{" "}
            <span className="hidden md:inline">credited </span>
            {contributorCount === 1 ? "contributor" : "contributors"}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleSave}
          disabled={busy}
          aria-pressed={saved}
          aria-label={saved ? "Saved" : "Save"}
          className={cn(
            "inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-lg text-[15px] font-medium text-foreground transition-colors",
            "hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60",
            "md:w-auto md:border md:border-border-strong md:px-4",
          )}
        >
          <Star
            className={cn(
              "h-5 w-5 md:h-4 md:w-4",
              saved ? "fill-primary text-primary" : "text-muted-foreground",
            )}
            aria-hidden="true"
          />
          <span className="hidden md:inline" aria-hidden="true">
            {saved ? "Saved" : "Save"}
          </span>
        </button>
      </div>
    </section>
  );
};

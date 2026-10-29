import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, Trash2 } from "lucide-react";
import { useCache } from "@/contexts/cache/CacheContext";
import { SearchCache } from "@/contexts/cache/types";
import { cn } from "@/lib/utils";
import { Grain } from "../layout/Grain";
import { SearchCover } from "../search/SearchCover";
import { StackDrawer } from "../library/StackDrawer";
import { ShareButton } from "../share/ShareButton";
import { ResultsSort } from "@/hooks/useResultsSort";
import { isInStack } from "@/lib/stacks";
import { libraryPath, resultPath } from "@/lib/routes";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "../ui/toast";

interface AlbumHeaderProps {
  search: SearchCache;
  /** The results' order: Share draws the top albums in it. */
  order: ResultsSort;
}

/**
 * The searched album above its results: cover, title, meta, Share, Stack
 * (put it into a stack, move it, or take it out), and Delete. Every search
 * is in the library, so there's nothing to save.
 */
export const AlbumHeader: React.FC<AlbumHeaderProps> = ({ search, order }) => {
  const { deleteSearch, restoreSearch, searches, savedSearchIds } = useCache();
  const navigate = useNavigate();
  // The share map: this album in the middle, its liked results around it.
  const map = useMemo(
    () => ({
      centre: {
        key: search.target?.key ?? "",
        title: search.searchParams.album,
        artist: search.searchParams.artist,
      },
      members: [search],
    }),
    [search],
  );
  // What Share draws: the top albums in the list's order.
  const selection = useMemo(
    () => ({ sort: order.sort, then: order.then }),
    [order.sort, order.then],
  );
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [stacking, setStacking] = useState(false);
  const stacked = isInStack(search, searches, savedSearchIds);
  const { artist, album } = search.searchParams;
  const contributorCount = Object.keys(search.contributors).length;

  // As on the library: no warning, the toast can undo it. Goes to the
  // library, since this page has nothing left to show.
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    // Off this page first: it has nothing to show once the search is gone.
    navigate(libraryPath());
    try {
      await deleteSearch(search.searchId);
    } catch (error) {
      console.error("Failed to delete search:", error);
      return;
    }
    toast({
      title: "Search deleted",
      description: `${album} by ${artist}`,
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
    <section className="relative overflow-hidden border-b">
      <Grain className="opacity-10" />
      <div className="relative mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 px-4 py-3 md:gap-5 md:px-6 md:py-6 lg:gap-6 lg:py-9">
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
        <div className="flex shrink-0 items-center gap-1 md:gap-2">
          <ShareButton
            search={search}
            map={map}
            selection={selection}
            to={resultPath(search.searchParams, search.target)}
            compact
          />
          <button
            type="button"
            onClick={() => setStacking(true)}
            aria-label={stacked ? "Stack: in a stack" : "Stack: add to a stack"}
            className={cn(
              "inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-lg text-[15px] font-medium text-foreground transition-colors",
              "hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
              "md:w-auto md:border md:border-border-strong md:px-4",
            )}
          >
            <Layers
              className={cn(
                "h-5 w-5 md:h-4 md:w-4",
                stacked ? "text-primary" : "text-muted-foreground",
              )}
              aria-hidden="true"
            />
            <span className="hidden md:inline" aria-hidden="true">
              {stacked ? "Stacked" : "Stack"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            aria-label={`Delete ${album}`}
            className={cn(
              "inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-lg text-[15px] font-medium text-foreground transition-colors",
              "hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60",
              "md:w-auto md:border md:border-border-strong md:px-4",
            )}
          >
            <Trash2
              className="h-5 w-5 text-muted-foreground md:h-4 md:w-4"
              aria-hidden="true"
            />
            <span className="hidden md:inline" aria-hidden="true">
              Delete
            </span>
          </button>
        </div>
      </div>
      <StackDrawer
        search={search}
        open={stacking}
        onOpenChange={setStacking}
        from="results"
      />
    </section>
  );
};

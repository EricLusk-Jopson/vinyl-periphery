import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, Trash2 } from "lucide-react";
import { useCache } from "@/contexts/cache/CacheContext";
import { SearchCache } from "@/contexts/cache/types";
import { cn } from "@/lib/utils";
import { PageHero } from "../layout/PageHero";
import { pageAction } from "../common/buttons";
import { SearchCover } from "../search/SearchCover";
import { StackDrawer } from "../library/StackDrawer";
import { ShareButton } from "../share/ShareButton";
import { ResultsSort } from "@/hooks/useResultsSort";
import { isInStack } from "@/lib/stacks";
import { libraryPath } from "@/lib/routes";
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
    <>
      <PageHero
        cover={
          <SearchCover
            search={search}
            className="h-16 w-16 rounded-[3px] text-[13px] md:h-[88px] md:w-[88px] md:rounded md:text-base lg:h-28 lg:w-28"
          />
        }
        eyebrow="Connections from"
        title={album}
        meta={
          <>
            {artist} · {contributorCount.toLocaleString("en-US")}{" "}
            <span className="hidden md:inline">credited </span>
            {contributorCount === 1 ? "contributor" : "contributors"}
          </>
        }
        actions={
          <>
            <ShareButton
              search={search}
              map={map}
              selection={selection}
              draftKey={`search:${search.searchId}`}
            />
            <button
              type="button"
              onClick={() => setStacking(true)}
              aria-label={
                stacked ? "Stack: in a stack" : "Stack: add to a stack"
              }
              className={pageAction}
            >
              <Layers
                className={cn(
                  "h-4 w-4",
                  stacked ? "text-primary" : "text-muted-foreground",
                )}
                aria-hidden="true"
              />
              <span aria-hidden="true">{stacked ? "Stacked" : "Stack"}</span>
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              aria-label={`Delete ${album}`}
              className={pageAction}
            >
              <Trash2
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <span aria-hidden="true">Delete</span>
            </button>
          </>
        }
      />
      <StackDrawer
        search={search}
        open={stacking}
        onOpenChange={setStacking}
        from="results"
      />
    </>
  );
};

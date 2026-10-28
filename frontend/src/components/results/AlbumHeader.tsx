import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, Star, Trash2 } from "lucide-react";
import { useCache } from "@/contexts/cache/CacheContext";
import { SearchCache } from "@/contexts/cache/types";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { Grain } from "../layout/Grain";
import { SearchCover } from "../search/SearchCover";
import { SaveDrawer } from "../library/SaveDrawer";
import { ShareButton } from "../share/ShareButton";
import { isInStack, savingNeedsChoice } from "@/lib/stacks";
import { libraryPath, resultPath } from "@/lib/routes";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "../ui/toast";

interface AlbumHeaderProps {
  search: SearchCache;
}

/**
 * The searched album above its results: cover, title, meta, Share, Save, once
 * saved Stack (put it into a stack, move it, or take it out), and Delete.
 */
export const AlbumHeader: React.FC<AlbumHeaderProps> = ({ search }) => {
  const {
    isSearchSaved,
    saveSearch,
    unsaveSearch,
    clearSearch,
    restoreSearch,
    searches,
    savedSearchIds,
  } = useCache();
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
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState<"save" | "stack" | null>(null);
  const saved = isSearchSaved(search.searchId);
  const stacked = saved && isInStack(search, searches, savedSearchIds);
  const { artist, album } = search.searchParams;
  const contributorCount = Object.keys(search.contributors).length;

  const toggleSave = async () => {
    if (busy) return;
    // With ancestors in the session or library, or a saved stack it fits,
    // ask how to save it; otherwise it's one tap.
    if (!saved && savingNeedsChoice(search, searches, savedSearchIds)) {
      setDrawer("save");
      return;
    }
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

  // As on the library: no warning, the toast can undo it. Goes to the
  // library, since this page has nothing left to show.
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (saved) await unsaveSearch(search.searchId);
    } catch (error) {
      console.error("Failed to delete search:", error);
      setBusy(false);
      return;
    }
    navigate(libraryPath(saved ? "saved" : "session"));
    clearSearch(search.searchId);
    toast({
      title: "Search deleted",
      description: `${album} by ${artist}`,
      action: (
        <ToastAction
          altText="Undo delete"
          onClick={() => void restoreSearch(search, saved)}
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
        {/* Phones: a row of their own, so the title keeps its width. */}
        <div className="-mt-1 flex w-full shrink-0 items-center justify-end gap-1 md:mt-0 md:w-auto md:gap-2">
          <ShareButton
            search={search}
            map={map}
            to={resultPath(search.searchParams, search.target)}
            compact
          />
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
          {saved && (
            <button
              type="button"
              onClick={() => setDrawer("stack")}
              aria-label={
                stacked ? "Stack: in a stack" : "Stack: add to a stack"
              }
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
          )}
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
      <SaveDrawer
        search={search}
        mode={drawer === "stack" ? "stack" : "save"}
        open={drawer !== null}
        onOpenChange={(open) => !open && setDrawer(null)}
      />
    </section>
  );
};

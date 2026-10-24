import React, { useId, useRef, useState } from "react";
import { Star, Trash2, X } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCache } from "@/contexts/cache/CacheContext";
import { SearchCache } from "@/contexts/cache/types";
import { recentSearches, searchStartedAt, timeAgo } from "@/lib/searches";
import { cn } from "@/lib/utils";
import { AlbumCover } from "../search/AlbumCover";

interface HistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSearch: (searchId: string) => void;
  /** The button that opens the drawer. */
  trigger: React.ReactNode;
}

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";
const iconButton = cn(
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-secondary disabled:opacity-60",
  focusRing,
);

interface HistoryItemProps {
  search: SearchCache;
  saved: boolean;
  active: boolean;
  onOpen: () => void;
  onToggleSave: () => Promise<void>;
  onDelete: () => Promise<void>;
}

const HistoryItem: React.FC<HistoryItemProps> = ({
  search,
  saved,
  active,
  onOpen,
  onToggleSave,
  onDelete,
}) => {
  const [busy, setBusy] = useState(false);
  const { artist, album } = search.searchParams;
  const albums = Object.keys(search.releases).length;

  const run = (action: () => Promise<void>) => async () => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      className={cn(
        "flex items-center gap-1 rounded-lg pr-1 transition-colors",
        active ? "bg-secondary" : "hover:bg-surface",
      )}
    >
      <SheetClose asChild>
        <button
          type="button"
          data-history-open
          onClick={onOpen}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 text-left",
            focusRing,
          )}
        >
          <AlbumCover
            src={search.thumb}
            title={album}
            className="h-12 w-12 rounded-[3px] text-xs"
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[15px] font-semibold">{album}</span>
            <span className="truncate text-[13px] text-muted-foreground">
              {artist}
            </span>
            <span className="font-mono text-xs text-faint">
              {active && <span className="text-primary-text">Viewing · </span>}
              {albums.toLocaleString("en-US")}{" "}
              {albums === 1 ? "album" : "albums"} ·{" "}
              {timeAgo(searchStartedAt(search.searchId))}
            </span>
          </span>
        </button>
      </SheetClose>
      {/* Always visible, not only on hover, so touch and keyboard users
          can reach them. */}
      <button
        type="button"
        onClick={run(onToggleSave)}
        disabled={busy}
        aria-pressed={saved}
        aria-label={`Save ${album}`}
        className={iconButton}
      >
        <Star
          className={cn(
            "h-[18px] w-[18px]",
            saved ? "fill-primary text-primary" : "text-muted-foreground",
          )}
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        onClick={run(onDelete)}
        disabled={busy}
        aria-label={`Delete ${album}`}
        className={cn(
          iconButton,
          "text-muted-foreground hover:text-foreground",
        )}
      >
        <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>
    </li>
  );
};

/**
 * Left drawer listing saved searches and this visit's searches, newest
 * first. Each one opens with a click; Save and Delete sit beside it.
 */
export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  open,
  onOpenChange,
  onOpenSearch,
  trigger,
}) => {
  const {
    searches,
    activeSearchId,
    savedSearchIds,
    saveSearch,
    unsaveSearch,
    clearSearch,
  } = useCache();
  const listRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  const all = recentSearches(searches, Number.POSITIVE_INFINITY);
  const saved = all.filter((s) => savedSearchIds.has(s.searchId));
  const recent = all.filter((s) => !savedSearchIds.has(s.searchId));

  const remove = async (searchId: string) => {
    const buttons = [
      ...(listRef.current?.querySelectorAll<HTMLButtonElement>(
        "[data-history-open]",
      ) ?? []),
    ];
    const index = buttons.findIndex((b) =>
      b.closest("li")?.contains(document.activeElement),
    );
    try {
      if (savedSearchIds.has(searchId)) await unsaveSearch(searchId);
      clearSearch(searchId);
    } catch (error) {
      console.error("Failed to delete search:", error);
      return;
    }
    // The deleted row's buttons are gone; move focus to the next row, or the
    // close button when the list is empty.
    requestAnimationFrame(() => {
      const left = listRef.current?.querySelectorAll<HTMLButtonElement>(
        "[data-history-open]",
      );
      const next = left?.[Math.min(Math.max(index, 0), left.length - 1)];
      (next ?? closeRef.current)?.focus();
    });
  };

  const toggleSave = (searchId: string) =>
    savedSearchIds.has(searchId)
      ? unsaveSearch(searchId)
      : saveSearch(searchId);

  const group = (
    key: string,
    title: string,
    items: SearchCache[],
    empty: string,
  ) => (
    <section aria-labelledby={`${id}-${key}`} className="flex flex-col gap-1">
      <h3
        id={`${id}-${key}`}
        className="flex items-baseline justify-between px-2 py-2 text-xs font-medium uppercase tracking-[1px] text-muted-foreground"
      >
        {title}
        <span className="font-mono normal-case tracking-normal text-faint">
          {items.length}
        </span>
      </h3>
      {items.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {items.map((search) => (
            <HistoryItem
              key={search.searchId}
              search={search}
              saved={savedSearchIds.has(search.searchId)}
              active={search.searchId === activeSearchId}
              onOpen={() => onOpenSearch(search.searchId)}
              onToggleSave={() => toggleSave(search.searchId)}
              onDelete={() => remove(search.searchId)}
            />
          ))}
        </ul>
      ) : (
        <p className="px-2 pb-2 text-sm text-faint">{empty}</p>
      )}
    </section>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="left"
        className="flex w-full flex-col gap-0 border-r bg-background p-0 sm:max-w-sm"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b py-2 pl-4 pr-2 md:pl-6">
          <SheetTitle className="text-lg font-semibold">History</SheetTitle>
          <SheetDescription className="sr-only">
            Your saved searches and the searches from this visit.
          </SheetDescription>
          <SheetClose
            ref={closeRef}
            aria-label="Close history"
            className={iconButton}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </SheetClose>
        </div>
        <div
          ref={listRef}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 py-3 md:px-4"
        >
          {group(
            "saved",
            "Saved",
            saved,
            "Star a search to keep it after you close the tab.",
          )}
          {group(
            "recent",
            "This visit",
            recent,
            "Searches you run show up here until you close the tab.",
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

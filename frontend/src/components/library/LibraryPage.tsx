import React, { useId, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Star, Trash2 } from "lucide-react";
import { useCache } from "@/contexts/cache/CacheContext";
import { SearchCache } from "@/contexts/cache/types";
import {
  HOME_PATH,
  LibraryTab,
  ResultFrom,
  libraryTab,
  resultPath,
} from "@/lib/routes";
import { recentSearches, searchStartedAt, timeAgo } from "@/lib/searches";
import { cn } from "@/lib/utils";
import { AlbumCover } from "../search/AlbumCover";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";
const iconButton = cn(
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-secondary disabled:opacity-60",
  focusRing,
);

const TABS: { id: LibraryTab; label: string }[] = [
  { id: "session", label: "This session" },
  { id: "saved", label: "Saved" },
];

interface LibraryCardProps {
  search: SearchCache;
  saved: boolean;
  tab: LibraryTab;
  onToggleSave: () => Promise<void>;
  onDelete: () => Promise<void>;
}

const LibraryCard: React.FC<LibraryCardProps> = ({
  search,
  saved,
  tab,
  onToggleSave,
  onDelete,
}) => {
  const [busy, setBusy] = useState(false);
  const { artist, album } = search.searchParams;
  const albums = Object.keys(search.releases).length;
  const from: ResultFrom = { from: "library", tab };

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
    <li className="flex min-w-0 items-center gap-1 rounded-[10px] border bg-surface pr-2 transition-colors hover:border-border-strong">
      <Link
        to={resultPath(search.searchId)}
        state={from}
        data-library-open
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 rounded-[10px] p-2.5 lg:gap-4 lg:p-3.5",
          focusRing,
        )}
      >
        <AlbumCover
          src={search.thumb}
          title={album}
          className="h-12 w-12 rounded-[3px] text-xs lg:h-16 lg:w-16 lg:rounded lg:text-sm"
        />
        <span className="flex min-w-0 flex-col gap-0.5 md:gap-1">
          <span className="truncate text-[15px] font-semibold md:text-base">
            {album}
          </span>
          <span className="truncate text-[13px] text-muted-foreground md:text-sm">
            {artist}
          </span>
          <span className="font-mono text-xs text-faint">
            {albums.toLocaleString("en-US")} {albums === 1 ? "album" : "albums"}{" "}
            · {timeAgo(searchStartedAt(search.searchId))}
          </span>
        </span>
      </Link>
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
 * Every search from this session, and the saved ones, as tabs. The chosen tab
 * is in the URL (?tab=saved) so "Back to library" returns to it.
 */
export const LibraryPage: React.FC = () => {
  const { searches, savedSearchIds, saveSearch, unsaveSearch, clearSearch } =
    useCache();
  const [params, setParams] = useSearchParams();
  const tab = libraryTab(`?${params.toString()}`);
  const id = useId();
  const tabRefs = useRef<Record<LibraryTab, HTMLButtonElement | null>>({
    session: null,
    saved: null,
  });
  const panelRef = useRef<HTMLDivElement>(null);

  const all = recentSearches(searches, Number.POSITIVE_INFINITY);
  const lists: Record<LibraryTab, SearchCache[]> = {
    session: all.filter((s) => !savedSearchIds.has(s.searchId)),
    saved: all.filter((s) => savedSearchIds.has(s.searchId)),
  };
  const items = lists[tab];

  const selectTab = (next: LibraryTab, focus = false) => {
    setParams(next === "saved" ? { tab: "saved" } : {}, { replace: true });
    if (focus) tabRefs.current[next]?.focus();
  };

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    const index = TABS.findIndex((t) => t.id === tab);
    const last = TABS.length - 1;
    const next =
      e.key === "ArrowRight"
        ? (index + 1) % TABS.length
        : e.key === "ArrowLeft"
          ? (index + last) % TABS.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    selectTab(TABS[next].id, true);
  };

  const remove = async (searchId: string) => {
    const links = [
      ...(panelRef.current?.querySelectorAll<HTMLAnchorElement>(
        "[data-library-open]",
      ) ?? []),
    ];
    const index = links.findIndex((a) =>
      a.closest("li")?.contains(document.activeElement),
    );
    try {
      if (savedSearchIds.has(searchId)) await unsaveSearch(searchId);
      clearSearch(searchId);
    } catch (error) {
      console.error("Failed to delete search:", error);
      return;
    }
    // The deleted card is gone; move focus to the next one, or the tab.
    requestAnimationFrame(() => {
      const left = panelRef.current?.querySelectorAll<HTMLAnchorElement>(
        "[data-library-open]",
      );
      const next = left?.[Math.min(Math.max(index, 0), left.length - 1)];
      (next ?? tabRefs.current[tab])?.focus();
    });
  };

  const toggleSave = (searchId: string) =>
    savedSearchIds.has(searchId)
      ? unsaveSearch(searchId)
      : saveSearch(searchId);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-8 md:px-6 md:pt-14">
      <h1 className="font-display text-[30px] font-normal leading-none tracking-[0.3px] md:text-[56px] md:tracking-[0.5px]">
        Library
      </h1>

      <div
        role="tablist"
        aria-label="Library"
        className="mt-5 flex gap-6 border-b md:mt-8"
      >
        {TABS.map((t) => {
          const selected = t.id === tab;
          return (
            <button
              key={t.id}
              ref={(el) => (tabRefs.current[t.id] = el)}
              type="button"
              role="tab"
              id={`${id}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(t.id)}
              onKeyDown={onTabKeyDown}
              className={cn(
                // The underline, not just the colour, marks the open tab.
                "-mb-px flex h-11 items-center gap-2 border-b-2 text-[15px] font-medium transition-colors",
                focusRing,
                selected
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span className="font-mono text-xs text-faint">
                {lists[t.id].length}
              </span>
            </button>
          );
        })}
      </div>

      <div
        ref={panelRef}
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${tab}`}
        className="pt-5 md:pt-6"
      >
        {items.length > 0 ? (
          <ul className="grid gap-2.5 md:grid-cols-2 md:gap-4 lg:grid-cols-[repeat(auto-fill,minmax(360px,1fr))]">
            {items.map((search) => (
              <LibraryCard
                key={search.searchId}
                search={search}
                saved={savedSearchIds.has(search.searchId)}
                tab={tab}
                onToggleSave={() => toggleSave(search.searchId)}
                onDelete={() => remove(search.searchId)}
              />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
            <p className="text-base font-semibold">
              {tab === "saved" ? "No saved searches" : "No searches yet"}
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              {tab === "saved"
                ? "Star a search to keep it after you close the tab."
                : "Searches you run show up here until you close the tab."}
            </p>
            <Link
              to={HOME_PATH}
              className={cn(
                "mt-1 inline-flex h-11 items-center rounded-lg border border-border-strong px-4 text-sm font-medium text-foreground hover:bg-secondary",
                focusRing,
              )}
            >
              Start a search
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { useCache } from "@/contexts/cache/CacheContext";
import { SearchCache } from "@/contexts/cache/types";
import { useToast } from "@/hooks/use-toast";
import { HOME_PATH } from "@/lib/routes";
import { recentSearches } from "@/lib/searches";
import {
  groupStacks,
  LibraryStack,
  searchLibrary,
  isInStack,
  stackLabel,
  stacksThisFits,
} from "@/lib/stacks";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { ToastAction } from "../ui/toast";
import { LibraryCard } from "./LibraryCard";
import { StackDrawer } from "./StackDrawer";
import { StackCard } from "./StackCard";
import { StackAction, StackConfirm } from "./StackConfirm";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

type SavedView = "stacked" | "flat";
const VIEW_STORAGE_KEY = "vinyl-periphery-library-view";

/** The viewer's stacked/flat choice; stacked when unknown or unreadable. */
const readView = (): SavedView => {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === "flat"
      ? "flat"
      : "stacked";
  } catch {
    return "stacked";
  }
};

const writeView = (view: SavedView) => {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // Blocked storage: the choice lasts until reload.
  }
};

const VIEWS: { id: SavedView; label: string }[] = [
  { id: "stacked", label: "Stacks" },
  { id: "flat", label: "All" },
];

/**
 * Every search: each one is kept as it finishes, until it's deleted. They
 * group into stacks by lineage (or show flat), and can be searched.
 */
export const LibraryPage: React.FC = () => {
  const {
    searches,
    savedSearchIds,
    savedSearchesLoaded,
    deleteSearch,
    restoreSearch,
  } = useCache();
  const { toast } = useToast();
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<SavedView>(readView);
  const [query, setQuery] = useState("");
  const [stackRequest, setStackRequest] = useState<{
    stack: LibraryStack;
    action: StackAction;
    /** The focused card when asked, to keep focus nearby afterwards. */
    index: number;
  } | null>(null);

  const saved = useMemo(
    () => recentSearches(searches, Number.POSITIVE_INFINITY),
    [searches],
  );
  const searching = query.trim() !== "";
  const found = useMemo(() => searchLibrary(saved, query), [saved, query]);
  const entries = useMemo(() => groupStacks(saved), [saved]);
  // Which stack (two or more searches) each search is in, for search results.
  const stackNotes = useMemo(() => {
    const notes = new Map<string, string>();
    for (const entry of entries) {
      if (entry.kind !== "stack") continue;
      const label = `In ${stackLabel(entry)}`;
      entry.members.forEach((m) => notes.set(m.searchId, label));
    }
    return notes;
  }, [entries]);

  // Report a library search once typing pauses; the text isn't sent.
  useEffect(() => {
    if (!searching) return;
    const timer = setTimeout(
      () =>
        track("library_searched", {
          results: found.length,
          length: query.trim().length,
        }),
      1000,
    );
    return () => clearTimeout(timer);
  }, [searching, query, found.length]);

  /** After a card goes, focus the next one, or the heading. */
  const keepFocus = (index: number) =>
    requestAnimationFrame(() => {
      const left = panelRef.current?.querySelectorAll<HTMLAnchorElement>(
        "[data-library-open]",
      );
      const next = left?.[Math.min(Math.max(index, 0), left.length - 1)];
      (next ?? headingRef.current)?.focus();
    });

  const focusedIndex = () =>
    [
      ...(panelRef.current?.querySelectorAll<HTMLAnchorElement>(
        "[data-library-open]",
      ) ?? []),
    ].findIndex((a) => a.closest("li")?.contains(document.activeElement));

  // Deleting one search needs no warning: the toast can undo it.
  const remove = async (searchId: string) => {
    const index = focusedIndex();
    const search = searches[searchId];
    try {
      await deleteSearch(searchId);
    } catch (error) {
      console.error("Failed to delete search:", error);
      return;
    }
    keepFocus(index);
    if (!search) return;
    toast({
      title: "Search deleted",
      description: `${search.searchParams.album} by ${search.searchParams.artist}`,
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

  // The search whose Stack drawer is open.
  const [stacking, setStacking] = useState<SearchCache | null>(null);

  const chooseView = (next: SavedView) => {
    if (next === view) return;
    setView(next);
    writeView(next);
    track("library_view_toggled", { view: next });
  };

  // Searches in a stack get a Stack button (to take them out or move
  // them); those on their own get one when they fit somewhere.
  const canStack = (search: SearchCache) =>
    isInStack(search, searches, savedSearchIds) ||
    stacksThisFits(search, searches, savedSearchIds, { singles: true }).length >
      0;

  const card = (search: SearchCache, note?: string) => (
    <LibraryCard
      key={search.searchId}
      search={search}
      from={{ from: "library" }}
      note={note}
      onDelete={() => remove(search.searchId)}
      onStack={canStack(search) ? () => setStacking(search) : undefined}
    />
  );

  const grid =
    "grid gap-2.5 md:grid-cols-2 md:gap-4 lg:grid-cols-[repeat(auto-fill,minmax(360px,1fr))]";

  let body: React.ReactNode;
  if (searching) {
    body =
      found.length > 0 ? (
        <ul className={grid}>
          {found.map((s) => card(s, stackNotes.get(s.searchId)))}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No searches match "{query.trim()}".
        </p>
      );
  } else if (view === "stacked") {
    body = saved.length > 0 && (
      <ul className={grid}>
        {entries.map((entry) =>
          entry.kind === "stack" ? (
            <StackCard
              key={entry.stackId}
              stack={entry}
              onDelete={() =>
                setStackRequest({
                  stack: entry,
                  action: "delete",
                  index: focusedIndex(),
                })
              }
              onDisband={() =>
                setStackRequest({
                  stack: entry,
                  action: "disband",
                  index: focusedIndex(),
                })
              }
            />
          ) : (
            card(entry.search)
          ),
        )}
      </ul>
    );
  } else {
    body = saved.length > 0 && (
      <ul className={grid}>
        {saved.map((s) => card(s, stackNotes.get(s.searchId)))}
      </ul>
    );
  }

  const empty = saved.length === 0;
  // Not "no searches yet" while the library is still loading.
  if (!savedSearchesLoaded) return null;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-8 md:px-6 md:pt-14">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-[30px] font-normal leading-none tracking-[0.3px] focus:outline-none md:text-[56px] md:tracking-[0.5px]"
      >
        Library
      </h1>

      <div ref={panelRef} className="pt-5 md:pt-8">
        {!empty && (
          <div className="mb-4 flex flex-col gap-3 md:mb-5 md:flex-row md:items-center md:justify-between">
            <div className="relative md:w-[320px]">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
                aria-hidden="true"
              />
              <label htmlFor={`${id}-search`} className="sr-only">
                Search your library
              </label>
              <input
                id={`${id}-search`}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search albums and artists"
                autoComplete="off"
                className={cn(
                  "h-11 w-full rounded-lg border bg-surface pl-9 pr-3 text-[15px] text-foreground placeholder:text-faint md:text-sm",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                )}
              />
            </div>
            {!searching && (
              <div
                role="radiogroup"
                aria-label="Show searches as"
                className="flex self-start rounded-lg border p-1"
              >
                {VIEWS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={view === v.id}
                    onClick={() => chooseView(v.id)}
                    className={cn(
                      "h-11 rounded-md px-4 text-sm font-medium transition-colors md:h-9",
                      focusRing,
                      view === v.id
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {empty ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
            <p className="text-base font-semibold">No searches yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Every search you run is kept here until you delete it.
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
        ) : (
          body
        )}
      </div>

      {stacking && (
        <StackDrawer
          search={searches[stacking.searchId] ?? stacking}
          from="library"
          open
          onOpenChange={(open) => !open && setStacking(null)}
        />
      )}

      <StackConfirm
        request={stackRequest}
        onClose={() => setStackRequest(null)}
        onDone={() => keepFocus(stackRequest?.index ?? 0)}
      />
    </div>
  );
};

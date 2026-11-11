import React, { useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckSquare, Plus, Search, Trash2 } from "lucide-react";
import { useCache } from "@/contexts/cache/CacheContext";
import { SearchCache } from "@/contexts/cache/types";
import { useLibraryStacks } from "@/hooks/useLibraryStacks";
import { HOME_PATH } from "@/lib/routes";
import { recentSearches } from "@/lib/searches";
import { searchLibrary, searchStacks, stacksWith } from "@/lib/stacks";
import { track } from "@/lib/analytics";
import {
  allSelected,
  deletedToast,
  selectionLabel,
  stackedNote,
  toggleAll,
  toggled,
} from "@/lib/librarySelection";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "../ui/toast";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { LibraryCard } from "./LibraryCard";
import { LIBRARY_GRID } from "./grid";
import { StackDrawer } from "./StackDrawer";
import { StackCard } from "./StackCard";
import { StackEditor } from "./StackEditor";
import { dialogButton, pageAction } from "../common/buttons";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

type LibraryTab = "stacks" | "albums";
const VIEW_STORAGE_KEY = "vinyl-periphery-library-view";

/** The viewer's last tab; Albums when unknown or unreadable. */
const readTab = (): LibraryTab => {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === "stacks"
      ? "stacks"
      : "albums";
  } catch {
    return "albums";
  }
};

const writeTab = (tab: LibraryTab) => {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, tab);
  } catch {
    // Blocked storage: the choice lasts until reload.
  }
};

/**
 * The library, in two tabs, Albums first. Albums: every search, kept as it finishes
 * until it's deleted (from its own page, or several at once with Select
 * here, with Undo); each card's Stacks button adds it to stacks or takes
 * it out. Stacks: named groups of albums linked by
 * their credits, made with New stack (or from an album's Stacks drawer),
 * edited and deleted on their own pages. One search box filters both.
 */
export const LibraryPage: React.FC = () => {
  const { searches, savedSearchesLoaded, deleteSearches, restoreSearches } =
    useCache();
  const { toast } = useToast();
  const id = useId();
  const stacks = useLibraryStacks();
  const [tab, setTab] = useState<LibraryTab>(readTab);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  // The album whose Stacks drawer is open.
  const [stacking, setStacking] = useState<SearchCache | null>(null);
  // Choosing albums to delete: null when not, else the chosen search ids.
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [deleting, setDeleting] = useState(false);

  const saved = useMemo(
    () => recentSearches(searches, Number.POSITIVE_INFINITY),
    [searches],
  );
  const searching = query.trim() !== "";
  const albums = useMemo(() => searchLibrary(saved, query), [saved, query]);
  const shownStacks = useMemo(
    () => searchStacks(stacks, query),
    [stacks, query],
  );

  // Report a library search once typing pauses; the text isn't sent.
  useEffect(() => {
    if (!searching) return;
    const timer = setTimeout(
      () =>
        track("library_searched", {
          results: tab === "albums" ? albums.length : shownStacks.length,
          length: query.trim().length,
          tab,
        }),
      1000,
    );
    return () => clearTimeout(timer);
  }, [searching, query, albums.length, shownStacks.length, tab]);

  // Albums deleted elsewhere leave the selection; Escape ends it.
  const selecting = selected !== null;
  const chosen = useMemo(
    () =>
      selected ? saved.filter((search) => selected.has(search.searchId)) : [],
    [selected, saved],
  );
  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting]);
  const shownIds = albums.map((search) => search.searchId);
  const inStacks = chosen.filter(
    (s) => stacksWith(s, stacks).length > 0,
  ).length;

  const deleteChosen = async () => {
    if (deleting || chosen.length === 0) return;
    setDeleting(true);
    const gone = chosen;
    try {
      await deleteSearches(gone.map((s) => s.searchId));
    } catch (error) {
      console.error("Failed to delete albums:", error);
    } finally {
      setDeleting(false);
    }
    setSelected(null);
    track("albums_deleted", { count: gone.length, inStacks });
    toast({
      ...deletedToast(gone.map((s) => s.searchParams.album)),
      action: (
        <ToastAction
          altText="Undo delete"
          onClick={() => void restoreSearches(gone)}
        >
          Undo
        </ToastAction>
      ),
    });
  };

  const chooseTab = (next: string) => {
    const value: LibraryTab = next === "albums" ? "albums" : "stacks";
    if (value === tab) return;
    setSelected(null);
    setTab(value);
    writeTab(value);
    track("library_view_toggled", { view: value });
  };

  const stackNote = (search: SearchCache) => {
    const holding = stacksWith(search, stacks);
    return holding.length === 0
      ? undefined
      : holding.length === 1
        ? `In ${holding[0].record.name}`
        : `In ${holding.length} stacks`;
  };

  const newStack = (
    <button
      type="button"
      onClick={() => setCreating(true)}
      className={pageAction}
    >
      <Plus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      New stack
    </button>
  );

  const nothing = (what: string) => (
    <p className="py-8 text-center text-sm text-muted-foreground">
      No {what} match "{query.trim()}".
    </p>
  );

  const empty = saved.length === 0;
  // Not "no searches yet" while the library is still loading.
  if (!savedSearchesLoaded) return null;

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1200px] px-4 pt-8 md:px-6 md:pt-14",
        // Room for the selection bar over the last cards.
        selecting ? "pb-48" : "pb-24",
      )}
    >
      <h1
        tabIndex={-1}
        className="font-display text-[30px] font-normal leading-none tracking-[0.3px] focus:outline-none md:text-[56px] md:tracking-[0.5px]"
      >
        Library
      </h1>

      <div className="pt-5 md:pt-8">
        {empty ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
            <p className="text-base font-semibold">No searches yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Every album you search is kept here until you delete it. Group
              them into stacks: albums linked by their credits.
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
          <Tabs value={tab} onValueChange={chooseTab}>
            <div className="mb-4 flex flex-col gap-3 md:mb-5 md:flex-row md:items-end md:justify-between">
              <TabsList aria-label="Library">
                <TabsTrigger value="albums">
                  Albums
                  <span className="ml-1.5 font-mono text-xs text-faint">
                    {saved.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="stacks">
                  Stacks
                  <span className="ml-1.5 font-mono text-xs text-faint">
                    {stacks.length}
                  </span>
                </TabsTrigger>
              </TabsList>
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
                  placeholder={
                    tab === "stacks"
                      ? "Search stacks and their albums"
                      : "Search albums and artists"
                  }
                  autoComplete="off"
                  className={cn(
                    "h-11 w-full rounded-lg border bg-surface pl-9 pr-3 text-[15px] text-foreground placeholder:text-faint md:text-sm",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                  )}
                />
              </div>
            </div>

            <TabsContent value="stacks" className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-xl text-sm text-muted-foreground">
                  Stacks group albums linked by their credits: a band's whole
                  discography, or a trail out from an album you love. An album
                  can be in any number of them.
                </p>
                {newStack}
              </div>
              {stacks.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
                  <p className="text-base font-semibold">No stacks yet</p>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Start one from any album in your library, then add the
                    albums that link to it.
                  </p>
                </div>
              ) : shownStacks.length === 0 ? (
                nothing("stacks")
              ) : (
                <ul className={LIBRARY_GRID}>
                  {shownStacks.map((stack) => (
                    <StackCard key={stack.stackId} stack={stack} />
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="albums" className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-xl text-sm text-muted-foreground">
                  {selecting
                    ? "Choose the albums to delete."
                    : "Every album you've searched."}
                </p>
                {selecting ? (
                  <button
                    type="button"
                    onClick={() =>
                      setSelected((current) =>
                        toggleAll(current ?? new Set(), shownIds),
                      )
                    }
                    disabled={shownIds.length === 0}
                    className={pageAction}
                  >
                    {allSelected(selected, shownIds)
                      ? "Select none"
                      : "Select all"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className={pageAction}
                  >
                    <CheckSquare
                      className="h-4 w-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    Select
                  </button>
                )}
              </div>
              {albums.length === 0 ? (
                nothing("albums")
              ) : (
                <ul className={LIBRARY_GRID}>
                  {albums.map((search) => (
                    <LibraryCard
                      key={search.searchId}
                      search={search}
                      from={{ from: "library" }}
                      note={stackNote(search)}
                      onStack={() => setStacking(search)}
                      select={
                        selected
                          ? {
                              selected: selected.has(search.searchId),
                              onToggle: () =>
                                setSelected((current) =>
                                  toggled(
                                    current ?? new Set(),
                                    search.searchId,
                                  ),
                                ),
                            }
                          : undefined
                      }
                    />
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {selecting && tab === "albums" && !empty && (
        <div
          role="region"
          aria-label="Selected albums"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border-strong bg-background/95 backdrop-blur"
        >
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:px-6">
            <div className="flex items-center gap-2">
              <p
                aria-live="polite"
                className="min-w-0 flex-1 truncate text-[15px] font-medium"
              >
                {selectionLabel(chosen.length)}
              </p>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className={dialogButton.secondary}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deleteChosen()}
                disabled={chosen.length === 0 || deleting}
                className={cn(dialogButton.primary, "gap-2")}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
                {chosen.length > 0 && (
                  <span className="sr-only"> {chosen.length} albums</span>
                )}
              </button>
            </div>
            {stackedNote(inStacks) && (
              <p className="text-[13px] text-muted-foreground">
                {stackedNote(inStacks)}
              </p>
            )}
          </div>
        </div>
      )}
      {stacking && (
        <StackDrawer
          search={searches[stacking.searchId] ?? stacking}
          from="library"
          open
          onOpenChange={(open) => !open && setStacking(null)}
        />
      )}
      {creating && (
        <StackEditor
          open
          onOpenChange={(open) => !open && setCreating(false)}
        />
      )}
    </div>
  );
};

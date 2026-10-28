import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { useCache } from "@/contexts/cache/CacheContext";
import { SearchCache } from "@/contexts/cache/types";
import { useToast } from "@/hooks/use-toast";
import { HOME_PATH, LibraryTab, libraryTab } from "@/lib/routes";
import { recentSearches } from "@/lib/searches";
import {
  groupStacks,
  LibraryStack,
  searchLibrary,
  isInStack,
  savingNeedsChoice,
  stackLabel,
  stacksThisFits,
} from "@/lib/stacks";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { ToastAction } from "../ui/toast";
import { ChoiceDialog } from "../common/ChoiceDialog";
import { dialogButton } from "../common/buttons";
import { LibraryCard } from "./LibraryCard";
import { SaveDrawer } from "./SaveDrawer";
import { StackCard } from "./StackCard";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

const TABS: { id: LibraryTab; label: string }[] = [
  { id: "session", label: "This session" },
  { id: "saved", label: "Saved" },
];

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
 * Every search from this session, and the saved ones, as tabs. The chosen tab
 * is in the URL (?tab=saved) so "Back to library" returns to it. Saved
 * searches group into stacks by lineage (or show flat), and can be searched.
 */
export const LibraryPage: React.FC = () => {
  const {
    searches,
    savedSearchIds,
    saveSearch,
    unsaveSearch,
    clearSearch,
    deleteStack,
    restoreSearch,
  } = useCache();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const tab = libraryTab(`?${params.toString()}`);
  const id = useId();
  const tabRefs = useRef<Record<LibraryTab, HTMLButtonElement | null>>({
    session: null,
    saved: null,
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<SavedView>(readView);
  const [query, setQuery] = useState("");
  const [stackToDelete, setStackToDelete] = useState<LibraryStack | null>(null);

  const all = recentSearches(searches, Number.POSITIVE_INFINITY);
  const lists: Record<LibraryTab, SearchCache[]> = {
    session: all.filter((s) => !savedSearchIds.has(s.searchId)),
    saved: all.filter((s) => savedSearchIds.has(s.searchId)),
  };
  const saved = lists.saved;
  const searching = tab === "saved" && query.trim() !== "";
  const found = useMemo(() => searchLibrary(saved, query), [saved, query]);
  const entries = useMemo(() => groupStacks(saved), [saved]);
  // Which stack (two or more saved) each saved search is in, for search results.
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

  /** After a card goes, focus the next one, or the tab. */
  const keepFocus = (index: number) =>
    requestAnimationFrame(() => {
      const left = panelRef.current?.querySelectorAll<HTMLAnchorElement>(
        "[data-library-open]",
      );
      const next = left?.[Math.min(Math.max(index, 0), left.length - 1)];
      (next ?? tabRefs.current[tab])?.focus();
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
    const wasSaved = savedSearchIds.has(searchId);
    try {
      if (wasSaved) await unsaveSearch(searchId);
      clearSearch(searchId);
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
          onClick={() => void restoreSearch(search, wasSaved)}
        >
          Undo
        </ToastAction>
      ),
    });
  };

  const confirmDeleteStack = async () => {
    if (!stackToDelete) return;
    const index = focusedIndex();
    const removed = await deleteStack(stackToDelete.stackId);
    track("stack_deleted", { members: removed });
    setStackToDelete(null);
    keepFocus(index);
  };

  // The search the save drawer is open for, and how.
  const [drawer, setDrawer] = useState<{
    search: SearchCache;
    mode: "save" | "stack";
  } | null>(null);

  const toggleSave = async (searchId: string) => {
    const wasSaved = savedSearchIds.has(searchId);
    // As on the results page: with a trail or a stack it fits, ask how.
    const search = searches[searchId];
    if (
      !wasSaved &&
      search &&
      savingNeedsChoice(search, searches, savedSearchIds)
    ) {
      setDrawer({ search, mode: "save" });
      return;
    }
    await (wasSaved ? unsaveSearch : saveSearch)(searchId);
    track("search_saved", { saved: !wasSaved, from: "library" });
  };

  const chooseView = (next: SavedView) => {
    if (next === view) return;
    setView(next);
    writeView(next);
    track("library_view_toggled", { view: next });
  };

  // Saved searches on their own that fit somewhere get a Stack button.
  const canStack = (search: SearchCache) =>
    savedSearchIds.has(search.searchId) &&
    !isInStack(search, searches, savedSearchIds) &&
    stacksThisFits(search, searches, savedSearchIds, { singles: true }).length >
      0;

  const card = (search: SearchCache, note?: string) => (
    <LibraryCard
      key={search.searchId}
      search={search}
      saved={savedSearchIds.has(search.searchId)}
      from={{ from: "library", tab }}
      note={note}
      onToggleSave={() => toggleSave(search.searchId)}
      onDelete={() => remove(search.searchId)}
      onStack={
        canStack(search)
          ? () => setDrawer({ search, mode: "stack" })
          : undefined
      }
    />
  );

  const grid =
    "grid gap-2.5 md:grid-cols-2 md:gap-4 lg:grid-cols-[repeat(auto-fill,minmax(360px,1fr))]";

  let body: React.ReactNode;
  if (tab === "session") {
    body = lists.session.length > 0 && (
      <ul className={grid}>{lists.session.map((s) => card(s))}</ul>
    );
  } else if (searching) {
    body =
      found.length > 0 ? (
        <ul className={grid}>
          {found.map((s) => card(s, stackNotes.get(s.searchId)))}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No saved searches match "{query.trim()}".
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
              onDelete={() => setStackToDelete(entry)}
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

  const empty = lists[tab].length === 0;

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
        {tab === "saved" && !empty && (
          <div className="mb-4 flex flex-col gap-3 md:mb-5 md:flex-row md:items-center md:justify-between">
            <div className="relative md:w-[320px]">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
                aria-hidden="true"
              />
              <label htmlFor={`${id}-search`} className="sr-only">
                Search saved searches
              </label>
              <input
                id={`${id}-search`}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search saved albums and artists"
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
                aria-label="Show saved searches as"
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
        ) : (
          body
        )}
      </div>

      {drawer && (
        <SaveDrawer
          search={searches[drawer.search.searchId] ?? drawer.search}
          mode={drawer.mode}
          from="library"
          open
          onOpenChange={(open) => !open && setDrawer(null)}
        />
      )}

      <ChoiceDialog
        open={stackToDelete !== null}
        onOpenChange={(open) => !open && setStackToDelete(null)}
        title="Delete this stack?"
        description={
          stackToDelete &&
          `This removes ${stackToDelete.members.length} saved searches from the ${stackLabel(stackToDelete)} stack. Searches still open in this session stay there.`
        }
      >
        <button
          type="button"
          onClick={() => setStackToDelete(null)}
          className={dialogButton.secondary}
        >
          Keep it
        </button>
        <button
          type="button"
          onClick={() => void confirmDeleteStack()}
          className={dialogButton.primary}
        >
          Delete {stackToDelete?.members.length} searches
        </button>
      </ChoiceDialog>
    </div>
  );
};

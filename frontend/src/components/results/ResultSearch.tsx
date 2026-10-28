import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useCache } from "@/contexts/cache/CacheContext";
import { track } from "@/lib/analytics";
import { filtersToShow, ResultMatch, searchResults } from "@/lib/resultSearch";
import { cn } from "@/lib/utils";
import { ChoiceDialog } from "../common/ChoiceDialog";
import { dialogButton } from "../common/buttons";

interface ResultSearchProps {
  searchId: string;
  /** Results the filters let through. */
  visibleKeys: ReadonlySet<string>;
  /** Puts a result on top of the list (null: back to the usual order). */
  onPin: (key: string | null) => void;
  /** Below md the field is a row of its own, shown from a button. */
  expanded: boolean;
  onCollapse: () => void;
}

/**
 * Finds a result by title or artist, whatever the filters. Picking one puts
 * it on top of the list and opens it; its name stays in the field, and
 * clearing or editing it goes back to the usual order. A result the
 * filters hide asks first, then resets the filters to exactly its people
 * and their roles.
 */
export const ResultSearch: React.FC<ResultSearchProps> = ({
  searchId,
  visibleKeys,
  onPin,
  expanded,
  onCollapse,
}) => {
  const { searches, updateFilterState } = useCache();
  const search = searches[searchId];
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [pinned, setPinned] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ResultMatch | null>(null);

  const matches = useMemo(
    () => (search ? searchResults(search, query, visibleKeys) : []),
    [search, query, visibleKeys],
  );
  const searching = query.trim() !== "";

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  // Reported once typing pauses; the text isn't sent.
  useEffect(() => {
    if (!searching || !showOptions) return;
    const timer = setTimeout(
      () =>
        track("results_searched", {
          results: matches.length,
          hidden: matches.filter((m) => !m.visible).length,
          length: query.trim().length,
        }),
      1200,
    );
    return () => clearTimeout(timer);
  }, [searching, showOptions, query, matches]);

  if (!search) return null;

  const pin = (match: ResultMatch, filtered: boolean) => {
    track("result_picked", { filtered });
    setPinned(match.key);
    setQuery(match.title);
    setShowOptions(false);
    onPin(match.key);
  };

  const pick = (match: ResultMatch) => {
    if (match.visible) pin(match, false);
    else setConfirming(match);
  };

  const showAnyway = () => {
    if (!confirming) return;
    const filterState = filtersToShow(search, confirming.key);
    if (filterState) updateFilterState(searchId, filterState);
    pin(confirming, true);
    setConfirming(null);
  };

  const clear = () => {
    setQuery("");
    setShowOptions(false);
    if (pinned) {
      setPinned(null);
      onPin(null);
    }
    onCollapse();
  };

  const hidden = matches.filter((m) => !m.visible).length;

  return (
    <div
      className={cn(
        "relative order-last basis-full md:order-none md:basis-auto md:w-[240px] lg:w-[260px]",
        !expanded && "hidden md:block",
      )}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setShowOptions(false);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && showOptions) {
          e.stopPropagation();
          setShowOptions(false);
        }
      }}
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
        aria-hidden="true"
      />
      <label htmlFor={`${id}-input`} className="sr-only">
        Find an album in these results
      </label>
      <input
        ref={inputRef}
        id={`${id}-input`}
        type="text"
        role="combobox"
        aria-expanded={showOptions && searching}
        aria-controls={`${id}-options`}
        aria-autocomplete="list"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowOptions(true);
          // Editing the picked name goes back to the usual order.
          if (pinned) {
            setPinned(null);
            onPin(null);
          }
        }}
        onFocus={() => {
          if (!pinned) setShowOptions(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches.length > 0 && showOptions) {
            e.preventDefault();
            pick(matches[0]);
          }
        }}
        placeholder="Find an album"
        autoComplete="off"
        className={cn(
          "h-11 w-full rounded-lg border bg-surface pl-9 pr-11 text-[15px] text-foreground placeholder:text-faint md:text-sm lg:h-10",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
          pinned && "border-border-emphasis",
        )}
      />
      {(searching || expanded) && (
        <button
          type="button"
          onClick={clear}
          aria-label={pinned ? "Clear, back to the usual order" : "Clear"}
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring lg:h-10"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      {showOptions && searching && (
        <div
          id={`${id}-options`}
          className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-border-strong bg-surface shadow-xl md:left-auto md:w-[min(400px,calc(100vw-48px))]"
        >
          <p
            className="border-b px-3 py-2 font-mono text-xs text-faint"
            aria-live="polite"
          >
            {matches.length === 0
              ? `No albums match "${query.trim()}"`
              : `${matches.length === 1 ? "1 album" : `${matches.length} albums`}${
                  hidden > 0 ? ` · ${hidden} hidden by filters` : ""
                }`}
          </p>
          {matches.length > 0 && (
            <ul className="max-h-[min(360px,60vh)] overflow-y-auto">
              {matches.map((match) => (
                <li key={match.key} className="border-b last:border-b-0">
                  <button
                    type="button"
                    onClick={() => pick(match)}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-150 hover:bg-secondary",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span
                        className={cn(
                          "truncate text-sm",
                          match.visible
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {match.title}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {match.artist}
                        {match.year !== null && ` · ${match.year}`}
                      </span>
                      <span className="font-mono text-xs text-faint">
                        {match.contributors}{" "}
                        {match.contributors === 1
                          ? "contributor"
                          : "contributors"}{" "}
                        {match.summary}
                      </span>
                    </span>
                    {!match.visible && (
                      <span className="shrink-0 rounded border border-dashed px-1.5 py-0.5 font-mono text-xs text-faint">
                        Filtered out
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ChoiceDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Reset filters to show it?"
        description={
          confirming && (
            <>
              <span className="font-medium text-foreground">
                {confirming.title}
              </span>{" "}
              is hidden by your filters. Showing it resets them, Must include
              too, to just the{" "}
              {confirming.contributors === 1
                ? "person"
                : `${confirming.contributors} people`}{" "}
              on it and their roles.
            </>
          )
        }
      >
        <button
          type="button"
          onClick={() => setConfirming(null)}
          className={dialogButton.secondary}
        >
          Keep filters
        </button>
        <button
          type="button"
          onClick={showAnyway}
          className={dialogButton.primary}
        >
          Reset and show it
        </button>
      </ChoiceDialog>
    </div>
  );
};

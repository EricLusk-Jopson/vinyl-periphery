import React, { useId, useMemo, useState } from "react";
import { Plus, RotateCcw, Search, X } from "lucide-react";
import { SearchCache } from "@/contexts/cache/types";
import { ScoredRelease } from "@/lib/results";
import { searchResults } from "@/lib/resultSearch";
import { ShareEdits } from "@/lib/shareSelection";
import { cn } from "@/lib/utils";
import { AlbumCover } from "../search/AlbumCover";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

interface ShareAlbumsProps {
  search: SearchCache;
  /** The albums the image draws, in order. */
  shown: ScoredRelease[];
  /** Results the filters let through. */
  visibleKeys: ReadonlySet<string>;
  edits: ShareEdits;
  cover: (key: string) => string | null | undefined;
  onRemove: (key: string) => void;
  /** Adds an album; one the filters hide gets its people switched on. */
  onAdd: (key: string, filtered: boolean) => void;
  /** Puts the removed albums back. */
  onRestore: () => void;
  /**
   * Sees each query first; returning true takes it (the field clears).
   * For the "no boilerplate" switch.
   */
  onQuery?: (query: string) => boolean;
}

/**
 * The share image's albums: each can be taken out (the next in the list
 * takes its place), and any album in the results can be found and added,
 * filters or not. Adding one the filters hide switches its people and
 * their roles on, so it's linked like any other. For a stack, `search`
 * holds every result of its searches, all visible.
 */
export const ShareAlbums: React.FC<ShareAlbumsProps> = ({
  search,
  shown,
  visibleKeys,
  edits,
  cover,
  onRemove,
  onAdd,
  onRestore,
  onQuery,
}) => {
  const id = useId();
  const [query, setQuery] = useState("");
  const shownKeys = useMemo(() => new Set(shown.map((r) => r.key)), [shown]);
  const matches = useMemo(
    () =>
      searchResults(search, query, visibleKeys, 20)
        .filter((m) => !shownKeys.has(m.key))
        .slice(0, 6),
    [search, query, visibleKeys, shownKeys],
  );
  const searching = query.trim() !== "";

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="flex min-h-0 flex-col gap-2.5"
    >
      <div className="flex items-center gap-2">
        <h3
          id={`${id}-heading`}
          className="font-mono text-xs uppercase tracking-[1px] text-muted-foreground"
        >
          In the image
        </h3>
        <span className="font-mono text-xs text-faint">{shown.length}</span>
        {edits.removed.length > 0 && (
          <button
            type="button"
            onClick={onRestore}
            className={cn(
              "ml-auto inline-flex h-11 items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground lg:h-8",
              focusRing,
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Put back {edits.removed.length}
          </button>
        )}
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
          aria-hidden="true"
        />
        <label htmlFor={`${id}-input`} className="sr-only">
          Add an album from the results
        </label>
        <input
          id={`${id}-input`}
          type="search"
          value={query}
          onChange={(e) => {
            if (onQuery?.(e.target.value.trim())) setQuery("");
            else setQuery(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches.length > 0) {
              e.preventDefault();
              onAdd(matches[0].key, !matches[0].visible);
              setQuery("");
            }
          }}
          placeholder="Add an album"
          autoComplete="off"
          aria-describedby={searching ? `${id}-matches` : undefined}
          className={cn(
            "h-11 w-full rounded-lg border bg-surface pl-9 pr-3 text-[15px] text-foreground placeholder:text-faint md:text-sm",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
          )}
        />
      </div>

      {searching && (
        <div id={`${id}-matches`} aria-live="polite">
          {matches.length > 0 ? (
            <ul className="flex flex-col overflow-hidden rounded-lg border">
              {matches.map((match) => (
                <li key={match.key} className="border-b last:border-b-0">
                  <button
                    type="button"
                    onClick={() => {
                      onAdd(match.key, !match.visible);
                      setQuery("");
                    }}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-secondary",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm text-foreground">
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
                      {!match.visible && (
                        <span className="text-xs text-faint">
                          Filtered out: adding it switches its people on
                        </span>
                      )}
                    </span>
                    <Plus
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="sr-only">, add to the image</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-faint">
              No other albums match "{query.trim()}".
            </p>
          )}
        </div>
      )}

      <ol className="flex flex-col overflow-y-auto rounded-lg border lg:max-h-[420px]">
        {shown.map((release, i) => {
          const added = edits.added.includes(release.key);
          return (
            <li
              key={release.key}
              className="flex items-center gap-3 border-b py-1.5 pl-3 pr-1 last:border-b-0"
            >
              <span className="w-5 shrink-0 text-right font-mono text-xs text-faint">
                {i + 1}
              </span>
              <AlbumCover
                src={cover(release.key) || release.thumb}
                title={release.title}
                className="h-9 w-9 rounded-[3px] text-xs"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-foreground">
                  {release.title}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {release.artist}
                  {added && " · added"}
                </span>
              </span>
              <span className="shrink-0 font-mono text-xs text-faint">
                {new Set(release.activeContributors).size}
              </span>
              <button
                type="button"
                onClick={() => onRemove(release.key)}
                aria-label={`Remove ${release.title} from the image`}
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                  focusRing,
                )}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

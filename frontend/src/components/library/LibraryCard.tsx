import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Layers, Trash2 } from "lucide-react";
import { SearchCache } from "@/contexts/cache/types";
import { ResultFrom, resultPath } from "@/lib/routes";
import { searchStartedAt, timeAgo } from "@/lib/searches";
import { cn } from "@/lib/utils";
import { SearchCover } from "../search/SearchCover";
import { iconButton } from "../common/buttons";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

interface LibraryCardProps {
  search: SearchCache;
  /** Where its results page's back link returns to. */
  from: ResultFrom;
  /** A short line under the meta, e.g. the stack it belongs to. */
  note?: string;
  onDelete: () => Promise<void>;
  /**
   * Put this search into a stack, move it, or take it out. Given only when it's on its own and
   * fits somewhere.
   */
  onStack?: () => void;
}

/** One search: cover, album, artist, counts, with Stack and Delete. */
export const LibraryCard: React.FC<LibraryCardProps> = ({
  search,
  from,
  note,
  onDelete,
  onStack,
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
    <li className="flex min-w-0 items-center gap-1 rounded-[10px] border bg-surface pr-2 transition-colors hover:border-border-strong">
      <Link
        to={resultPath(search.searchParams, search.target)}
        state={from}
        data-library-open
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 rounded-[10px] p-2.5 lg:gap-4 lg:p-3.5",
          focusRing,
        )}
      >
        <SearchCover
          search={search}
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
          {note && (
            <span className="truncate font-mono text-xs text-muted-foreground">
              {note}
            </span>
          )}
        </span>
      </Link>
      {/* Always visible, not only on hover, so touch and keyboard users
          can reach them. */}
      {onStack && (
        <button
          type="button"
          onClick={onStack}
          disabled={busy}
          aria-label={`Add ${album} to a stack`}
          className={cn(
            iconButton,
            "text-muted-foreground hover:text-foreground",
          )}
        >
          <Layers className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      )}
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

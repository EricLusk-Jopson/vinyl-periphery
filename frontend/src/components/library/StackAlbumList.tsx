import React from "react";
import { StackAlbumChip } from "@/lib/stackFilters";
import { cn } from "@/lib/utils";
import { SearchCover } from "../search/SearchCover";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

/**
 * A stack's albums as switches, each with its cover and how many results
 * it links: in the stack's filter panel and the share sheet. Albums on
 * "must include" are locked on.
 */
export const StackAlbumList: React.FC<{
  albums: StackAlbumChip[];
  onToggle: (album: StackAlbumChip) => void;
}> = ({ albums, onToggle }) => (
  <ul className="flex flex-col gap-1.5">
    {albums.map((album) => (
      <li key={album.key} className="flex items-center gap-1">
        <button
          type="button"
          aria-pressed={album.included}
          aria-disabled={album.required || undefined}
          onClick={album.required ? undefined : () => onToggle(album)}
          className={cn(
            "flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-md border px-2 py-1.5 text-left transition-colors duration-150",
            focusRing,
            album.required
              ? "cursor-not-allowed border-primary bg-primary text-primary-foreground"
              : album.included
                ? "border-border-emphasis bg-secondary text-foreground hover:border-border-strong"
                : "bg-transparent text-faint hover:text-muted-foreground",
          )}
        >
          <SearchCover
            search={album.search}
            className={cn(
              "h-8 w-8 rounded-[3px] text-xs",
              !album.included && "opacity-50",
            )}
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span
              className={cn(
                "truncate text-sm",
                !album.included && "line-through",
              )}
            >
              {album.title}
            </span>
            <span
              className={cn(
                "truncate font-mono text-xs",
                album.required
                  ? "text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              {album.artist}
            </span>
          </span>
          <span
            className={cn(
              "shrink-0 font-mono text-xs",
              album.required ? "text-primary-foreground" : "text-faint",
            )}
          >
            {album.count}
          </span>
          <span className="sr-only">
            {` ${album.count === 1 ? "album" : "albums"}`}
            {album.required && ", required: change it in Must include"}
          </span>
        </button>
      </li>
    ))}
  </ul>
);

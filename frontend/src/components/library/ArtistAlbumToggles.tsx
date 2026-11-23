import React from "react";
import { ChevronDown } from "lucide-react";
import { SearchCache } from "@/contexts/cache/types";
import { albumKeyOf } from "@/lib/stackRecords";
import { albumsOnOf } from "@/lib/stacks";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Switch } from "../filters/Switch";
import { SearchCover } from "../search/SearchCover";

interface ArtistAlbumTogglesProps {
  artist: string;
  albums: SearchCache[];
  /** Album key -> on (only `false` turns one off), from the page's filters. */
  states: Record<string, boolean>;
  onToggle: (key: string, on: boolean) => void;
  className?: string;
}

/**
 * Which of an artist's albums count: a button saying how many are on,
 * opening a list of switches. It writes the page's own filter state (the
 * artist's, or the stack's), the same the filter panel's Albums group does.
 */
export const ArtistAlbumToggles: React.FC<ArtistAlbumTogglesProps> = ({
  artist,
  albums,
  states,
  onToggle,
  className,
}) => {
  const on = albumsOnOf(albums, states).length;
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-border-strong px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
          className,
        )}
      >
        <span className="font-mono text-xs">
          {on}/{albums.length}
        </span>
        Albums
        <span className="sr-only"> of {artist} switched on</span>
        <ChevronDown
          className="h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(320px,calc(100vw-32px))]">
        <p className="pb-1 text-[13px] text-muted-foreground">
          {artist}'s albums to count here. Off, an album's people and results
          leave this page.
        </p>
        <ul className="flex max-h-[60vh] flex-col overflow-y-auto">
          {albums.map((album) => {
            const key = albumKeyOf(album);
            const checked = states[key] !== false;
            return (
              <li key={key} className="flex items-center gap-2.5">
                <SearchCover
                  search={album}
                  className={cn(
                    "h-8 w-8 shrink-0 rounded-[3px] text-xs",
                    !checked && "opacity-50",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <Switch
                    label={album.searchParams.album}
                    checked={checked}
                    onChange={(next) => {
                      // Keep at least one on: none would leave nothing.
                      if (!next && on <= 1) return;
                      onToggle(key, next);
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
};

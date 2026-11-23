import React from "react";
import { Link } from "react-router-dom";
import { MicVocal } from "lucide-react";
import { SearchCache } from "@/contexts/cache/types";
import { ResultFrom } from "@/lib/routes";
import { timeAgo } from "@/lib/searches";
import { activeAlbumsText, albumsOnOf } from "@/lib/stacks";
import { cn } from "@/lib/utils";
import { SearchCover } from "../search/SearchCover";
import { AlbumCover } from "../search/AlbumCover";
import { ArtistAlbumToggles } from "./ArtistAlbumToggles";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

interface ArtistCardProps {
  name: string;
  /** Their albums in the library, oldest first. */
  albums: SearchCache[];
  /** Album key -> on, from the filters of the page it's counted on. */
  states: Record<string, boolean>;
  /** The artist's page. */
  to: string;
  /** Router state for that link: where its back link returns. */
  state?: ResultFrom;
  /** When the albums can be switched on and off from the card. */
  onToggle?: (key: string, on: boolean) => void;
  /** When an album of theirs was last searched. */
  updatedAt?: number;
}

/**
 * An artist as a card, like a stack's: the latest album's cover, the
 * artist's name, and how many of their albums are on. Opens the artist's
 * page; on a stack's page it also switches their albums on and off.
 */
export const ArtistCard: React.FC<ArtistCardProps> = ({
  name,
  albums,
  states,
  to,
  state,
  onToggle,
  updatedAt,
}) => {
  const latest = albums[albums.length - 1];
  const on = albumsOnOf(albums, states).length;
  const cover =
    "h-12 w-12 rounded-[3px] text-xs lg:h-16 lg:w-16 lg:rounded lg:text-sm";
  return (
    <li className="relative pb-2 pr-2">
      {/* The stacked edges: decorative. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 left-2 top-2 rounded-[10px] border bg-surface"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 bottom-1 left-1 right-1 top-1 rounded-[10px] border bg-surface"
      />
      <div className="relative flex min-w-0 items-center gap-1 rounded-[10px] border border-border-strong bg-surface pr-2 transition-colors hover:border-border-emphasis">
        <Link
          to={to}
          state={state}
          data-library-open
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 rounded-[10px] p-2.5 lg:gap-4 lg:p-3.5",
            focusRing,
          )}
        >
          {latest ? (
            <SearchCover search={latest} className={cover} />
          ) : (
            <AlbumCover src="" title={name} className={cover} />
          )}
          <span className="flex min-w-0 flex-col gap-0.5 md:gap-1">
            <span className="flex min-w-0 items-center gap-2">
              <MicVocal
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="truncate text-[15px] font-semibold md:text-base">
                {name}
              </span>
            </span>
            <span className="truncate text-[13px] text-muted-foreground md:text-sm">
              Artist
            </span>
            <span className="font-mono text-xs text-faint">
              {albums.length === 0
                ? "No albums in your library"
                : activeAlbumsText(on, albums.length)}
              {updatedAt ? ` · ${timeAgo(updatedAt)}` : ""}
            </span>
          </span>
        </Link>
        {onToggle && albums.length > 1 && (
          <ArtistAlbumToggles
            artist={name}
            albums={albums}
            states={states}
            onToggle={onToggle}
          />
        )}
      </div>
    </li>
  );
};

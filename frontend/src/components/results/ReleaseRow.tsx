import React, { useId } from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";
import {
  ScoredRelease,
  SharedPerson,
  discogsWebUrl,
  releaseYear,
} from "@/lib/results";
import { cn } from "@/lib/utils";
import { AlbumCover } from "../search/AlbumCover";

const MAX_DOTS = 4;

interface ReleaseRowProps {
  release: ScoredRelease;
  /** Shared contributors, with what they did on the searched album. */
  people: SharedPerson[];
  searchedAlbum: string;
  open: boolean;
  onToggle: () => void;
  onSearchFrom: () => void;
  /** A search is under way; true for this row if it started it. */
  searching: boolean;
  searchingFromHere: boolean;
}

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

/**
 * One result: cover, title, artist and year, who links it to the searched
 * album, and how many people it shares. Expands in place to show each shared
 * person's roles and links.
 */
export const ReleaseRow: React.FC<ReleaseRowProps> = ({
  release,
  people,
  searchedAlbum,
  open,
  onToggle,
  onSearchFrom,
  searching,
  searchingFromHere,
}) => {
  const panelId = useId();
  const shared = people.length;
  const year = releaseYear(release.year);
  const discogsUrl = discogsWebUrl(release.resource_url);
  const strong = shared > 1;

  return (
    <li className="border-b">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-surface md:gap-4 md:px-1 md:py-3.5",
          focusRing,
        )}
      >
        <AlbumCover
          src={release.thumb}
          title={release.title}
          className="h-12 w-12 rounded-[3px] text-xs md:h-14 md:w-14"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:gap-[3px]">
          <span className="truncate text-[15px] font-semibold leading-snug md:whitespace-normal md:text-base">
            {release.title}
          </span>
          <span className="truncate text-[13px] text-muted-foreground md:text-sm">
            {release.artist}
            {year && ` · ${year}`}
          </span>
          <span className="truncate font-mono text-xs text-faint md:whitespace-normal">
            via {people.map((p) => p.name).join(", ")}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className={cn(
              "font-mono text-[13px]",
              strong ? "text-primary-text" : "text-muted-foreground",
            )}
          >
            {shared}
            <span className="sr-only md:not-sr-only"> shared</span>
          </span>
          <span aria-hidden="true" className="hidden gap-[3px] md:flex">
            {Array.from({ length: MAX_DOTS }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-2 w-2 rounded-full",
                  i < shared ? "bg-primary" : "bg-border",
                )}
              />
            ))}
          </span>
        </span>
      </button>

      <div
        id={panelId}
        className={cn(
          "flex-col gap-3.5 pb-5 pl-[60px] pt-1 md:pl-[76px] md:pr-1",
          // A class, not the hidden attribute, which `flex` would override.
          open ? "flex" : "hidden",
        )}
      >
        <p className="text-[13px] text-faint">
          Roles shown are what each person did on {searchedAlbum}.
        </p>
        <ul className="grid gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
          {people.map((person) => (
            <li
              key={person.id}
              className="flex flex-col gap-0.5 rounded-lg border bg-surface px-3 py-2.5"
            >
              <span className="text-[15px] font-medium">{person.name}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {person.roles || "Credited"}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          {discogsUrl && (
            <a
              href={discogsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex min-h-11 items-center gap-1 rounded-sm text-primary-text transition-colors hover:text-foreground",
                focusRing,
              )}
            >
              View on Discogs
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
          <button
            type="button"
            onClick={onSearchFrom}
            disabled={searching}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-sm text-foreground transition-colors hover:text-primary-text disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-foreground",
              focusRing,
            )}
          >
            {searchingFromHere && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {searchingFromHere ? "Finding the album" : "Search from this album"}
          </button>
        </div>
      </div>
    </li>
  );
};

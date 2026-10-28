import React, { useId } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Heart,
  Loader2,
  RotateCw,
} from "lucide-react";
import { useReleaseCredits } from "@/api/useReleaseCredits";
import { contributionsOf } from "@/lib/releases";
import {
  ScoredRelease,
  SharedPerson,
  contributionsText,
  creditAcrossVersions,
  creditsErrorMessage,
  discogsWebUrl,
  releaseYear,
} from "@/lib/results";
import { cn } from "@/lib/utils";
import { AlbumCover } from "../search/AlbumCover";

const MAX_DOTS = 4;

interface ReleaseRowProps {
  release: ScoredRelease;
  /** Art from the Cover Art Archive, when found. */
  cover?: string | null;
  /** Shared contributors, with what they did on the searched album. */
  people: SharedPerson[];
  searchedAlbum: string;
  open: boolean;
  onToggle: () => void;
  onSearchFrom: () => void;
  /**
   * This album's results, when it's already been searched (this session or
   * saved): shown instead of "Search from this album".
   */
  existing?: { to: string; state: unknown; onOpen: () => void };
  /** Called when the Discogs link is followed. */
  onOpenDiscogs?: () => void;
  /** A search is under way; true for this row if it started it. */
  searching: boolean;
  searchingFromHere: boolean;
  /** Liked albums show in every search they turn up in. */
  liked: boolean;
  onToggleLike: () => void;
}

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

/**
 * One result: cover, title, artist and year, who links it to the searched
 * album, and how many people it shares. Expands in place to show what each
 * shared person did on the searched album and on this one, and links. This
 * album's credits are fetched the first time it's opened, then kept.
 */
export const ReleaseRow: React.FC<ReleaseRowProps> = ({
  release,
  cover,
  people,
  searchedAlbum,
  open,
  onToggle,
  onSearchFrom,
  existing,
  onOpenDiscogs,
  searching,
  searchingFromHere,
  liked,
  onToggleLike,
}) => {
  const panelId = useId();
  const shared = people.length;
  const year = releaseYear(release.year);
  const discogsUrl = discogsWebUrl(release.resource_url);
  const strong = shared > 1;
  const credits = useReleaseCredits(
    release,
    open,
    people.map((p) => p.id),
  );
  // No Discogs release to read (an unexpected resource URL).
  const noCredits = open && credits.targets.length === 0;
  const master = release.type === "master";
  const failed = credits.settled && credits.error !== null;

  /** What a person did on this album, or why it isn't known. */
  const onThisAlbum = (personId: number): React.ReactNode => {
    if (noCredits) return withContributions(personId, "Unavailable");
    const credit = creditAcrossVersions(
      credits.loaded,
      credits.settled,
      personId,
    );
    switch (credit.status) {
      case "found":
        return credit.roles;
      case "no-role":
        return withContributions(personId, "Credited, no role given");
      case "not-found":
        return withContributions(
          personId,
          master
            ? "Not in the credits checked"
            : "Not in this release's credits",
        );
      case "unavailable":
        return withContributions(personId, "Unavailable");
      default:
        return (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Checking
          </span>
        );
    }
  };

  /**
   * How the person's own discography lists this album, every role it
   * names ("Producer, Remix"); otherwise the fallback note.
   */
  const withContributions = (personId: number, note: string) =>
    contributionsText(contributionsOf(release, personId)) ?? note;

  return (
    <li className="border-b">
      <div className="flex items-center">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 rounded-lg py-3 pl-3 pr-1 text-left transition-colors hover:bg-surface md:gap-4 md:py-3.5 md:pl-4",
            focusRing,
          )}
        >
          <AlbumCover
            src={cover || release.thumb}
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
        <button
          type="button"
          onClick={onToggleLike}
          aria-pressed={liked}
          aria-label={`Like ${release.title}`}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-surface md:mr-1",
            focusRing,
          )}
        >
          <Heart
            className={cn(
              "h-5 w-5",
              liked ? "fill-primary text-primary" : "text-muted-foreground",
            )}
            aria-hidden="true"
          />
        </button>
      </div>

      <div
        id={panelId}
        className={cn(
          "flex-col gap-2.5 pb-4 pl-3 pr-3 pt-1 md:gap-3.5 md:pb-5 md:pl-[88px] md:pr-4",
          // A class, not the hidden attribute, which `flex` would override.
          open ? "flex" : "hidden",
        )}
      >
        <p className="text-[13px] text-faint">
          What each person did on {searchedAlbum} and on this album.
        </p>
        {/* Phones: one line per person. From md: a card each. */}
        <ul className="flex flex-col divide-y rounded-lg border bg-surface md:grid md:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] md:gap-2.5 md:divide-y-0 md:border-0 md:bg-transparent">
          {people.map((person) => (
            <li
              key={person.id}
              className="flex flex-col gap-1 px-3 py-2.5 md:rounded-lg md:border md:bg-surface"
            >
              <span className="text-sm font-medium md:text-[15px]">
                {person.name}
              </span>
              <dl className="grid grid-cols-[fit-content(45%)_1fr] gap-x-2 gap-y-2 text-xs md:flex md:flex-col md:gap-3">
                <div className="contents md:flex md:min-w-0 md:flex-col">
                  <dt className="min-w-0 truncate text-faint">
                    {searchedAlbum}
                  </dt>
                  <dd className="min-w-0 font-mono text-muted-foreground">
                    {person.roles || "Credited"}
                  </dd>
                </div>
                <div className="contents md:flex md:min-w-0 md:flex-col">
                  <dt className="min-w-0 truncate text-faint">
                    {release.title}
                  </dt>
                  <dd className="min-w-0 font-mono text-muted-foreground">
                    {onThisAlbum(person.id)}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
        <div aria-live="polite" className="contents">
          {failed && (
            <p className="flex flex-wrap items-center gap-x-3 text-[13px] text-muted-foreground">
              {credits.loaded.length > 0
                ? "Some versions' credits didn't load."
                : creditsErrorMessage(credits.error?.status)}
              <button
                type="button"
                onClick={credits.retry}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-sm font-medium text-foreground transition-colors hover:text-primary-text lg:min-h-8",
                  focusRing,
                )}
              >
                <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                Try again
              </button>
            </p>
          )}
          {noCredits && (
            <p className="text-[13px] text-faint">
              Discogs doesn't list credits for this album.
            </p>
          )}
          {master && credits.loaded.length > 0 && (
            <p className="text-[13px] text-faint">
              {credits.targets.length > 1
                ? "This album has several versions; credits come from the ones these people are listed on."
                : "This album has several versions; credits come from one of them."}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          {discogsUrl && (
            <a
              href={discogsUrl}
              onClick={onOpenDiscogs}
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
          {existing ? (
            <Link
              to={existing.to}
              state={existing.state}
              onClick={existing.onOpen}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-sm text-foreground transition-colors hover:text-primary-text",
                focusRing,
              )}
            >
              Open your search
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
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
              {searchingFromHere
                ? "Finding the album"
                : "Search from this album"}
            </button>
          )}
        </div>
      </div>
    </li>
  );
};

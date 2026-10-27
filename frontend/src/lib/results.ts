import { Credit, ReleaseCredits } from "@/api/releaseCredits";
import { Contributor, EnrichedRelease } from "@/api/types";
import { SearchCache } from "@/contexts/cache/types";
import { defaultContributorDisplayPipeline } from "./transformers/contributorProcessor";
import { defaultRolePipeline } from "./transformers/roleProcessor";

/** A release as useFilteredAndScoredReleases returns it. */
export type ScoredRelease = EnrichedRelease & {
  score: number;
  confidence: number;
  activeContributors: number[];
};

export type SortKey = "shared" | "newest" | "oldest" | "artist";

export const SORT_OPTIONS: { value: SortKey; label: string; short: string }[] =
  [
    {
      value: "shared",
      label: "Most shared contributors",
      short: "Most shared",
    },
    { value: "newest", label: "Year, newest first", short: "Newest" },
    { value: "oldest", label: "Year, oldest first", short: "Oldest" },
    { value: "artist", label: "Artist A to Z", short: "Artist A–Z" },
  ];

/** The release year as a number, or null when Discogs has none (0 or ""). */
export const releaseYear = (
  year: string | number | undefined,
): number | null => {
  const n = Number(year);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const byYear = (direction: 1 | -1) => (a: ScoredRelease, b: ScoredRelease) => {
  const ya = releaseYear(a.year);
  const yb = releaseYear(b.year);
  // Releases without a year go last either way.
  if (ya === null || yb === null)
    return ya === null ? (yb === null ? 0 : 1) : -1;
  return direction * (ya - yb);
};

/**
 * Releases in the chosen order. "shared" keeps the incoming order, which is
 * the existing ranking (shared contributors, weighted by confidence). Ties
 * keep their ranking order, since Array.prototype.sort is stable.
 */
export const sortReleases = (
  releases: ScoredRelease[],
  sort: SortKey,
): ScoredRelease[] => {
  switch (sort) {
    case "shared":
      return releases;
    case "newest":
      return [...releases].sort(byYear(-1));
    case "oldest":
      return [...releases].sort(byYear(1));
    case "artist":
      return [...releases].sort((a, b) =>
        (a.artist ?? "").localeCompare(b.artist ?? "", undefined, {
          sensitivity: "base",
        }),
      );
  }
};

/**
 * The Discogs page for a release or master, from its API `resource_url`
 * (https://api.discogs.com/masters/123 -> https://www.discogs.com/master/123).
 * Null for anything else, so no link is shown rather than a wrong one.
 */
export const discogsWebUrl = (
  resourceUrl: string | undefined,
): string | null => {
  const match = resourceUrl?.match(
    /^https:\/\/api\.discogs\.com\/(releases|masters)\/(\d+)\/?$/,
  );
  if (!match) return null;
  const kind = match[1] === "masters" ? "master" : "release";
  return `https://www.discogs.com/${kind}/${match[2]}`;
};

export interface SharedPerson {
  id: number;
  name: string;
  /** What they did on the searched album. */
  roles: string;
}

/** The searched album's contributors who also worked on a release. */
export const sharedPeople = (
  release: ScoredRelease,
  contributors: Record<number, Contributor>,
): SharedPerson[] => {
  const seen = new Set<string>();
  const people: SharedPerson[] = [];
  for (const id of release.activeContributors) {
    const contributor = contributors[id];
    if (!contributor) continue;
    const name = defaultContributorDisplayPipeline(contributor.name);
    if (seen.has(name)) continue;
    seen.add(name);
    people.push({
      id,
      name,
      roles: defaultRolePipeline(contributor.roles).join(", "),
    });
  }
  return people;
};

/**
 * Filter state for "Reset filters": every contributor and role back on,
 * nothing required, the 2+ and Various Artists filters off. Hiding the searched artist's own
 * releases stays on, since those are rarely what anyone is after.
 */
export const resetFilterState = (
  search: SearchCache,
): SearchCache["filterState"] => ({
  contributors: Object.fromEntries(
    Object.keys(search.contributors).map((id) => [Number(id), true]),
  ),
  roles: Object.fromEntries(Object.keys(search.roles).map((r) => [r, true])),
  excludeMainArtist: true,
  collaborationsOnly: false,
  excludeVarious: false,
  required: { contributors: [], roles: [] },
});

/** Track lists longer than this are cut short, with a count of the rest. */
const MAX_TRACKS_SHOWN = 4;

/** "Guitar", or "Guitar (A1, B2)" for a role on some tracks only. */
export const formatCredit = ({ role, tracks }: Credit): string => {
  if (!tracks?.length) return role;
  const shown = tracks.slice(0, MAX_TRACKS_SHOWN).join(", ");
  const more = tracks.length - MAX_TRACKS_SHOWN;
  return `${role} (${shown}${more > 0 ? ` +${more}` : ""})`;
};

/** What a person did on a result album, once its credits are loaded. */
export type CreditOnResult =
  | { status: "found"; roles: string }
  /** Credited, but with no role given. */
  | { status: "no-role" }
  /** Not in the credits Discogs has for this release. */
  | { status: "not-found" };

export const creditOnResult = (
  credits: ReleaseCredits,
  personId: number,
): CreditOnResult => {
  const found = credits.credits[personId];
  if (!found) return { status: "not-found" };
  if (found.length === 0) return { status: "no-role" };
  return { status: "found", roles: found.map(formatCredit).join(", ") };
};

/** Why a result's credits couldn't be loaded, from the HTTP status. */
export const creditsErrorMessage = (status: number | undefined): string => {
  if (status === 429) return "Discogs is busy. Try again in a minute.";
  if (status === 404) return "Discogs has no release to read credits from.";
  if (status === 0) return "Couldn't reach Discogs. Check your connection.";
  return "Couldn't load this album's credits.";
};

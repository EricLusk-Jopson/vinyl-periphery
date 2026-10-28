import { ReleaseCredits } from "@/api/releaseCredits";
import { Appearance, Contributor, EnrichedRelease } from "@/api/types";
import { SearchCache } from "@/contexts/cache/types";
import { defaultContributorDisplayPipeline } from "./transformers/contributorProcessor";
import { defaultRolePipeline } from "./transformers/roleProcessor";

/** A release as useFilteredAndScoredReleases returns it. */
export type ScoredRelease = EnrichedRelease & {
  score: number;
  confidence: number;
  activeContributors: number[];
};

export type SortKey = "shared" | "popular" | "newest" | "oldest" | "artist";

export const SORT_OPTIONS: { value: SortKey; label: string; short: string }[] =
  [
    {
      value: "shared",
      label: "Most shared contributors",
      short: "Most shared",
    },
    {
      value: "popular",
      label: "Most popular (Discogs want + have)",
      short: "Popular",
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
 * How popular a release is on Discogs: want + have, or null when the search
 * didn't keep the counts.
 */
export const popularity = (release: EnrichedRelease): number | null =>
  release.community ? release.community.want + release.community.have : null;

/** A count in a few characters: 950, 1.2k, 12k, 3.4M. */
export const compactCount = (n: number): string => {
  const round = (x: number, unit: string) =>
    `${x < 10 ? Math.floor(x * 10) / 10 : Math.floor(x)}${unit}`;
  if (n >= 1_000_000) return round(n / 1_000_000, "M");
  if (n >= 1_000) return round(n / 1_000, "k");
  return String(n);
};

/** Whether any result in a search has Discogs counts to sort by. */
export const hasPopularity = (releases: EnrichedRelease[]): boolean =>
  releases.some((r) => r.community !== undefined);

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
    case "popular":
      // Most wanted and owned first; releases without counts go last.
      return [...releases].sort((a, b) => {
        const pa = popularity(a);
        const pb = popularity(b);
        if (pa === null || pb === null)
          return pa === null ? (pb === null ? 0 : 1) : -1;
        return pb - pa;
      });
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

/**
 * What a person did on a result album, once its credits are loaded. Roles
 * only: which tracks they cover isn't shown.
 */
export type CreditOnResult =
  | { status: "found"; roles: string }
  /** Credited, but with no role given. */
  | { status: "no-role" }
  /** Not in the credits Discogs has for this release. */
  | { status: "not-found" };

/**
 * What a person did on a result album read from one or more of its versions
 * (`loaded`, the person's own versions first). Roles from every version
 * that names them, as they load; anything less waits for all of them
 * (`settled`).
 */
export type CreditAcrossVersions =
  | CreditOnResult
  /** Still loading, and nothing found yet. */
  | { status: "pending" }
  /** No version's credits could be loaded. */
  | { status: "unavailable" };

export const creditAcrossVersions = (
  loaded: ReleaseCredits[],
  settled: boolean,
  personId: number,
): CreditAcrossVersions => {
  const roles = Array.from(
    new Set(
      loaded.flatMap((c) => (c.credits[personId] ?? []).map((r) => r.role)),
    ),
  );
  if (roles.length > 0) return { status: "found", roles: roles.join(", ") };
  if (!settled) return { status: "pending" };
  if (loaded.some((c) => c.credits[personId])) return { status: "no-role" };
  return loaded.length > 0
    ? { status: "not-found" }
    : { status: "unavailable" };
};

/** Why a result's credits couldn't be loaded, from the HTTP status. */
export const creditsErrorMessage = (status: number | undefined): string => {
  if (status === 429) return "Discogs is busy. Try again in a minute.";
  if (status === 404) return "Discogs has no release to read credits from.";
  if (status === 0) return "Couldn't reach Discogs. Check your connection.";
  return "Couldn't load this album's credits.";
};

/** Discogs's coarse discography roles, in words. */
const APPEARANCE_ROLES: Record<string, string> = {
  Main: "Main artist",
  UnofficialRelease: "Main artist (unofficial release)",
  Appearance: "Appears on this album",
  TrackAppearance: "Appears on some tracks",
};

/**
 * How a contributor's discography lists a result, as a short line: "Appears
 * on some tracks". Track details (`trackinfo`) aren't shown. A credit role
 * ("Producer") goes through the same cleanup as other roles. Null when
 * there's nothing to say.
 */
export const appearanceText = (
  appearance: Appearance | undefined,
): string | null => {
  if (!appearance) return null;
  const role =
    APPEARANCE_ROLES[appearance.role] ??
    defaultRolePipeline([appearance.role]).join(", ");
  return role || null;
};

/**
 * Every way a contributor's discography lists a result, in one line:
 * "Producer, Remix". Null when there's nothing to say.
 */
export const contributionsText = (entries: Appearance[]): string | null => {
  const texts = Array.from(
    new Set(entries.map(appearanceText).filter((t): t is string => Boolean(t))),
  );
  return texts.length > 0 ? texts.join(", ") : null;
};

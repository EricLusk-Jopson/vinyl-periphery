import { ReleaseCredits } from "@/api/releaseCredits";
import { Appearance, Contributor, EnrichedRelease } from "@/api/types";
import { SearchCache } from "@/contexts/cache/types";
import { contributionsOf } from "./releases";
import { defaultContributorDisplayPipeline } from "./transformers/contributorProcessor";
import { defaultRolePipeline } from "./transformers/roleProcessor";
import { roleCategory, RoleCategory } from "./transformers/roleCategories";

/** A release as useFilteredAndScoredReleases returns it. */
export type ScoredRelease = EnrichedRelease & {
  score: number;
  confidence: number;
  activeContributors: number[];
};

export type SortKey =
  | "shared"
  | "popular"
  | "newest"
  | "oldest"
  | "artist"
  | "artistDesc";

/** `label` in the menu; `short` on the closed menus. */
export const SORT_OPTIONS: { value: SortKey; label: string; short: string }[] =
  [
    { value: "shared", label: "Most shared contributors", short: "Shared" },
    {
      value: "popular",
      label: "Most popular (Discogs want + have)",
      short: "Popular",
    },
    { value: "newest", label: "Year, newest first", short: "Newest" },
    { value: "oldest", label: "Year, oldest first", short: "Oldest" },
    { value: "artist", label: "Artist A to Z", short: "A–Z" },
    { value: "artistDesc", label: "Artist Z to A", short: "Z–A" },
  ];

/** The release year as a number, or null when Discogs has none (0 or ""). */
export const releaseYear = (
  year: string | number | undefined,
): number | null => {
  const n = Number(year);
  return Number.isFinite(n) && n > 0 ? n : null;
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

type Compare = (a: ScoredRelease, b: ScoredRelease) => number;

/** Releases without a value go last either way. */
const nullsLast =
  (value: (r: ScoredRelease) => number | null, direction: 1 | -1): Compare =>
  (a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null || vb === null)
      return va === null ? (vb === null ? 0 : 1) : -1;
    return direction * (va - vb);
  };

const byArtist: Compare = (a, b) =>
  (a.artist ?? "").localeCompare(b.artist ?? "", undefined, {
    sensitivity: "base",
  });

/** Each sort as a comparison; 0 is a tie. */
const COMPARE: Record<SortKey, Compare> = {
  // The shown count. (As the main sort, the ranking is used instead.)
  shared: (a, b) =>
    new Set(b.activeContributors).size - new Set(a.activeContributors).size,
  // Most wanted and owned first.
  popular: nullsLast(popularity, -1),
  newest: nullsLast((r) => releaseYear(r.year), -1),
  oldest: nullsLast((r) => releaseYear(r.year), 1),
  artist: (a, b) => byArtist(a, b),
  artistDesc: (a, b) => byArtist(b, a),
};

/** Two directions of the same thing can't break each other's ties. */
const PAIRS: SortKey[][] = [
  ["newest", "oldest"],
  ["artist", "artistDesc"],
];

/**
 * The sorts that can break ties in `sort`: the others, leaving out the
 * other direction of the same thing (year, artist).
 */
export const tiebreakOptions = (sort: SortKey) =>
  SORT_OPTIONS.filter(
    (o) =>
      o.value !== sort &&
      !PAIRS.some((pair) => pair.includes(sort) && pair.includes(o.value)),
  );

/**
 * Releases in the chosen order, ties broken by `then`. "shared" alone
 * keeps the incoming order, which is the existing ranking (shared
 * contributors, weighted by confidence); with a tiebreaker it sorts by the
 * shared count, so albums sharing as many people are ordered by `then`.
 * Remaining ties keep their ranking order, since Array.prototype.sort is
 * stable.
 */
export const sortReleases = (
  releases: ScoredRelease[],
  sort: SortKey,
  then: SortKey | null = null,
): ScoredRelease[] => {
  const tiebreak = then && then !== sort ? COMPARE[then] : null;
  if (sort === "shared" && !tiebreak) return releases;
  return [...releases].sort(
    (a, b) => COMPARE[sort](a, b) || (tiebreak ? tiebreak(a, b) : 0),
  );
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

/** Discogs's discography roles for an artist's own releases. */
const OWN_RELEASE_ROLES = new Set(["Main", "UnofficialRelease"]);

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Whether `name` appears in `text` as whole words. */
const containsName = (text: string, name: string) => {
  const escaped = fold(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    escaped !== "" &&
    new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u").test(
      fold(text),
    )
  );
};

/**
 * The searched album's own artists: the people credited as its main
 * artist (Discogs artist ids), read with its credits.
 */
export const mainArtistIds = (
  search: Pick<SearchCache, "contributors">,
): number[] =>
  Object.values(search.contributors)
    .filter((c) => c.sources.includes("artist"))
    .map((c) => c.id);

/**
 * Whether "Hide <artist> releases" hides a release: one of the searched
 * album's own artists (by Discogs id) has it as their own release, the way
 * their discography lists it (role Main). Only when the release keeps no
 * discography roles for them (searches from before those were stored, or
 * no main artist known) does it fall back to names: the release's artist
 * naming one of them, or the typed artist, in whole words.
 */
export const isMainArtistRelease = (
  search: Pick<SearchCache, "searchParams" | "contributors">,
  release: Pick<
    EnrichedRelease,
    "artist" | "contributorIds" | "contributions" | "appearances"
  >,
): boolean => {
  const artists = mainArtistIds(search);
  const on = artists.filter((id) => release.contributorIds.includes(id));
  const roles = on.map((id) => contributionsOf(release, id));
  if (roles.some((entries) => entries.length > 0)) {
    return roles.some((entries) =>
      entries.some((e) => OWN_RELEASE_ROLES.has(e.role)),
    );
  }
  const names = artists.length
    ? artists.map((id) =>
        defaultContributorDisplayPipeline(search.contributors[id].name),
      )
    : [search.searchParams.artist];
  return names.some((name) => containsName(release.artist, name));
};

/**
 * Role categories switched on in a new search, and by Reset: the
 * musicians (who sang, played, featured or conducted) and roles nothing
 * else matches.
 */
export const DEFAULT_ROLE_CATEGORIES: RoleCategory[] = [
  "vocals",
  "instruments",
  "featuring",
  "conducting",
  "other",
];

/**
 * The roles a search starts with: the musicians' (and roles no category
 * matches) on; writing, production, remix, DJ mix, technical, visual,
 * spoken and management roles off.
 */
export const defaultRoleStates = (roles: string[]): Record<string, boolean> =>
  Object.fromEntries(
    roles.map((role) => [
      role,
      DEFAULT_ROLE_CATEGORIES.includes(
        roleCategory(defaultRolePipeline([role])[0] ?? role),
      ),
    ]),
  );

/**
 * Filter state for "Reset filters": every contributor back on, the
 * default roles (`defaultRoleStates`), nothing required, the 2+ and
 * Various Artists filters off. Hiding the searched artist's own releases
 * stays on, since those are rarely what anyone is after.
 */
export const resetFilterState = (
  search: SearchCache,
): SearchCache["filterState"] => ({
  contributors: Object.fromEntries(
    Object.keys(search.contributors).map((id) => [Number(id), true]),
  ),
  roles: defaultRoleStates(Object.keys(search.roles)),
  excludeMainArtist: true,
  collaborationsOnly: false,
  excludeVarious: false,
  likedOnly: false,
  showHidden: false,
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

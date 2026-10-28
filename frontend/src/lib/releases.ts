import {
  creditsTarget,
  CreditsTarget,
  discographyAppearance,
} from "@/api/releaseCredits";
import { MAX_CREDIT_VERSIONS, MAX_DISCOGRAPHY_PAGES } from "@/api/limits";
import { Appearance, EnrichedRelease, ReleaseType } from "@/api/types";
import { SearchCache } from "@/contexts/cache/types";

/**
 * Turning discography items into results: one entry per Discogs master or
 * release, keyed so the two id spaces can't collide, with a release folded
 * into its master when the data says they're the same album.
 */

/** An item from `/artists/{id}/releases`, as much of it as is read. */
export interface DiscographyItem {
  id: number;
  type?: string;
  /**
   * Masters: a release of it where this person has this role. Varies by
   * person and role, so the same master can come with different ones.
   */
  main_release?: number;
  /** Releases: their master. Not sent by artist releases; read if present. */
  master_id?: number;
  title?: string;
  year?: string | number;
  artist?: string;
  thumb?: string;
  resource_url?: string;
  role?: string;
  trackinfo?: string;
  stats?: { community?: { in_wantlist?: number; in_collection?: number } };
}

export const releaseKey = (type: ReleaseType, id: number): string =>
  `${type}:${id}`;

/** "master" or "release", from `type` or, failing that, the resource URL. */
export const releaseType = (item: {
  type?: string;
  resource_url?: string;
}): ReleaseType => {
  if (item.type === "master" || item.type === "release") return item.type;
  return /\/masters\/\d+\/?$/.test(item.resource_url ?? "")
    ? "master"
    : "release";
};

const positive = (n: unknown): number | undefined =>
  Number.isInteger(Number(n)) && Number(n) > 0 ? Number(n) : undefined;

/** A result entry for one contributor's discography item. */
export const toEnrichedRelease = (
  item: DiscographyItem,
  contributorId: number,
): EnrichedRelease => {
  const type = releaseType(item);
  const appearance = discographyAppearance(item);
  const mainRelease =
    type === "master" ? positive(item.main_release) : undefined;
  const masterId = type === "release" ? positive(item.master_id) : undefined;
  const version = type === "release" ? item.id : mainRelease;
  const contribution =
    appearance && version ? { ...appearance, release: version } : appearance;
  return {
    id: item.id,
    type,
    key: releaseKey(type, item.id),
    ...(mainRelease ? { mainRelease } : {}),
    ...(masterId ? { masterId } : {}),
    title: item.title ?? "",
    year:
      item.year === undefined || item.year === null ? "" : String(item.year),
    artist: item.artist ?? "",
    thumb: item.thumb ?? "",
    resource_url: item.resource_url ?? "",
    contributorIds: [contributorId],
    ...communityOf(item),
    ...(contribution
      ? { contributions: { [contributorId]: [contribution] } }
      : {}),
  };
};

const count = (n: unknown): number | undefined =>
  Number.isFinite(Number(n)) && Number(n) >= 0 && n !== null && n !== ""
    ? Math.floor(Number(n))
    : undefined;

/** Want and have counts from an item's `stats.community`, when it has them. */
const communityOf = (
  item: Pick<DiscographyItem, "stats">,
): Pick<EnrichedRelease, "community"> => {
  const want = count(item.stats?.community?.in_wantlist);
  const have = count(item.stats?.community?.in_collection);
  return want === undefined && have === undefined
    ? {}
    : { community: { want: want ?? 0, have: have ?? 0 } };
};

const sameEntry = (a: Appearance, b: Appearance) =>
  a.role === b.role && a.trackinfo === b.trackinfo && a.release === b.release;

/** Each person's entries from both, without repeats. */
const mergedContributions = (
  into: Record<number, Appearance[]> = {},
  from: Record<number, Appearance[]> = {},
): Record<number, Appearance[]> => {
  const result = { ...into };
  for (const [id, entries] of Object.entries(from)) {
    const kept = result[Number(id)] ?? [];
    result[Number(id)] = [
      ...kept,
      ...entries.filter((e) => !kept.some((k) => sameEntry(k, e))),
    ];
  }
  return result;
};

/** `into` with `from`'s contributors and their entries added. */
const merged = (
  into: EnrichedRelease,
  from: EnrichedRelease,
): EnrichedRelease => ({
  ...into,
  contributorIds: Array.from(
    new Set([...into.contributorIds, ...from.contributorIds]),
  ),
  ...(into.appearances || from.appearances
    ? { appearances: { ...from.appearances, ...into.appearances } }
    : {}),
  // The same album from another person: the larger counts (they can
  // differ when Discogs reports a different version for each).
  ...(into.community || from.community
    ? {
        community: {
          want: Math.max(into.community?.want ?? 0, from.community?.want ?? 0),
          have: Math.max(into.community?.have ?? 0, from.community?.have ?? 0),
        },
      }
    : {}),
  ...(into.contributions || from.contributions
    ? {
        contributions: mergedContributions(
          into.contributions,
          from.contributions,
        ),
      }
    : {}),
});

/**
 * Every discography entry linking a person to a result, in the order they
 * were read. Searches stored before `contributions` have one at most.
 */
export const contributionsOf = (
  release: Pick<EnrichedRelease, "contributions" | "appearances">,
  personId: number,
): Appearance[] => {
  const entries = release.contributions?.[personId];
  if (entries) return entries;
  const appearance = release.appearances?.[personId];
  return appearance ? [appearance] : [];
};

/** Whether `release` is a version of `master`, as far as the data shows. */
const isVersionOf = (release: EnrichedRelease, master: EnrichedRelease) =>
  release.type === "release" &&
  master.type === "master" &&
  (release.masterId === master.id || master.mainRelease === release.id);

/**
 * Main release id -> master key, per results map, so a release finds its
 * master without scanning every entry.
 */
const mainReleaseIndexes = new WeakMap<
  Map<string, EnrichedRelease>,
  Map<number, string>
>();
const mainReleaseIndex = (map: Map<string, EnrichedRelease>) => {
  let index = mainReleaseIndexes.get(map);
  if (!index) {
    index = new Map();
    for (const r of map.values()) {
      if (r.type === "master" && r.mainRelease) index.set(r.mainRelease, r.key);
    }
    mainReleaseIndexes.set(map, index);
  }
  return index;
};

/**
 * Adds an entry to the results, in place. The same key merges contributors;
 * a release that is a version of a master in the map folds into the master,
 * whichever arrives first. Returns the key the entry ended up under.
 */
export const addRelease = (
  map: Map<string, EnrichedRelease>,
  entry: EnrichedRelease,
): string => {
  const same = map.get(entry.key);
  if (same) {
    map.set(entry.key, merged(same, entry));
    return entry.key;
  }
  const byMainRelease = mainReleaseIndex(map);
  if (entry.type === "release") {
    const masterKey = entry.masterId
      ? releaseKey("master", entry.masterId)
      : byMainRelease.get(entry.id);
    const master = masterKey ? map.get(masterKey) : undefined;
    if (master && isVersionOf(entry, master)) {
      map.set(master.key, merged(master, entry));
      return master.key;
    }
    map.set(entry.key, entry);
    return entry.key;
  }
  // A master: take in any of its versions that arrived first.
  if (entry.mainRelease) byMainRelease.set(entry.mainRelease, entry.key);
  let master = entry;
  for (const other of Array.from(map.values())) {
    if (isVersionOf(other, master)) {
      master = merged(master, other);
      map.delete(other.key);
    }
  }
  map.set(master.key, master);
  return master.key;
};

/**
 * The Discogs releases to read a result's credits from. A release is read
 * itself. A master is read from the versions its people are listed on
 * (each person's first, then their others), then the version its result
 * entry names, up to `max`; with none known, from the master's own main
 * release. Empty when the result has no Discogs object to read.
 */
export const versionTargets = (
  release: Parameters<typeof creditsTarget>[0] &
    Pick<EnrichedRelease, "contributions" | "appearances">,
  peopleIds: number[],
  max = MAX_CREDIT_VERSIONS,
): CreditsTarget[] => {
  const target = creditsTarget(release);
  if (!target || target.kind === "release") return target ? [target] : [];
  const versions = peopleIds.map((id) =>
    contributionsOf(release, id)
      .map((c) => c.release)
      .filter((v): v is number => Boolean(v)),
  );
  const ids = new Set<number>([
    ...versions.flatMap((v) => v.slice(0, 1)),
    ...(target.mainRelease ? [target.mainRelease] : []),
    ...versions.flatMap((v) => v.slice(1)),
  ]);
  const targets = Array.from(ids)
    .slice(0, max)
    .map((id): CreditsTarget => ({ kind: "release", id }));
  return targets.length > 0 ? targets : [target];
};

/**
 * Releases from a search saved before results had a type and key: keyed by
 * Discogs id, with the raw discography item spread in. The type comes from
 * the resource URL (masters/ or releases/), `main_release` becomes
 * `mainRelease`, and the same folding rules apply. Already-migrated releases
 * pass through unchanged.
 */
export const migrateReleases = (
  releases: Record<string, unknown>,
): Record<string, EnrichedRelease> => {
  const values = Object.values(releases) as Array<
    Partial<EnrichedRelease> & {
      main_release?: number;
      master_id?: number;
      stats?: DiscographyItem["stats"];
    }
  >;
  if (values.every((r) => r.key && r.type)) {
    return releases as Record<string, EnrichedRelease>;
  }
  const map = new Map<string, EnrichedRelease>();
  for (const raw of values) {
    if (!raw || typeof raw.id !== "number") continue;
    const type = raw.type ?? releaseType(raw);
    const mainRelease =
      raw.mainRelease ??
      (type === "master" ? positive(raw.main_release) : undefined);
    const masterId =
      raw.masterId ??
      (type === "release" ? positive(raw.master_id) : undefined);
    addRelease(map, {
      id: raw.id,
      type,
      key: releaseKey(type, raw.id),
      ...(mainRelease ? { mainRelease } : {}),
      ...(masterId ? { masterId } : {}),
      title: raw.title ?? "",
      year: raw.year === undefined ? "" : String(raw.year),
      artist: raw.artist ?? "",
      thumb: raw.thumb ?? "",
      resource_url: raw.resource_url ?? "",
      contributorIds: Array.from(new Set(raw.contributorIds ?? [])),
      ...(raw.appearances ? { appearances: raw.appearances } : {}),
      ...(raw.contributions ? { contributions: raw.contributions } : {}),
      ...(raw.community ? { community: raw.community } : communityOf(raw)),
    });
  }
  return Object.fromEntries(map);
};

/** A stored search with its releases migrated (see `migrateReleases`). */
export const migrateSearch = (search: SearchCache): SearchCache => {
  const releases = migrateReleases(search.releases ?? {});
  return releases === search.releases ? search : { ...search, releases };
};

/**
 * How many discography pages to read, from the first page's pagination:
 * all of them, up to `max`. At least one (the page already read).
 */
export const discographyPagesToRead = (
  pagination: { pages?: number } | undefined,
  max = MAX_DISCOGRAPHY_PAGES,
): number => {
  const pages = Math.floor(Number(pagination?.pages) || 1);
  return Math.max(1, Math.min(pages, max));
};

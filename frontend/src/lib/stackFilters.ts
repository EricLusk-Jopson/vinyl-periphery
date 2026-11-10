import { SearchCache } from "@/contexts/cache/types";
import { Likes } from "@/services/likes";
import { CreditFilters, isCreditOn } from "./credits";
import { matchesName, MustIncludeItem } from "./filters";
import { MetaAlbum, MetaLink, MetaResult, mergedRelease } from "./metaAlbum";
import {
  compareBy,
  isMainArtistRelease,
  popularity,
  ScoredRelease,
  SORT_OPTIONS,
  SortKey,
  sortReleases,
  tiebreakOptions,
} from "./results";
import { groupRoles, RoleCategory } from "./transformers/roleCategories";
import { defaultRolePipeline } from "./transformers/roleProcessor";

/**
 * A stack's Results tab: filters over its meta-album (see `metaAlbum`),
 * the results they leave, and how those are scored and sorted. Pure.
 *
 * The state holds explicit exclusions only (`false`), as for one search,
 * plus member albums, which can be switched off or made "must link".
 * A new stack starts with everything on.
 */

export interface StackFilterState {
  contributors: Record<number, boolean>;
  roles: Record<string, boolean>;
  /** Member albums, by album key. */
  albums: Record<string, boolean>;
  /** "Hide releases by stack artists": any member's own artists. */
  excludeMainArtist: boolean;
  /** Only results with 2+ people. */
  collaborationsOnly: boolean;
  excludeVarious: boolean;
  likedOnly: boolean;
  showHidden: boolean;
  /** "Only albums linking 2+ stack albums": linked from two member albums. */
  linksTwoPlus: boolean;
  required: { contributors: number[]; roles: string[]; albums: string[] };
}

export const defaultStackFilters = (): StackFilterState => ({
  contributors: {},
  roles: {},
  albums: {},
  excludeMainArtist: true,
  collaborationsOnly: false,
  excludeVarious: false,
  likedOnly: false,
  showHidden: false,
  linksTwoPlus: false,
  required: { contributors: [], roles: [], albums: [] },
});

/** Stored state over the defaults, so older or partial records still read. */
export const withStackDefaults = (
  stored: Partial<StackFilterState> | undefined,
): StackFilterState => {
  const base = defaultStackFilters();
  if (!stored) return base;
  return {
    ...base,
    ...stored,
    required: { ...base.required, ...(stored.required ?? {}) },
  };
};

const creditFilters = (f: StackFilterState): CreditFilters => ({
  contributors: f.contributors,
  roles: f.roles,
  albums: f.albums,
  required: f.required,
});

const off = (states: Record<string | number, boolean>, key: string | number) =>
  states[key] === false;

/**
 * Per member album, the people who count on it: someone with a credit on
 * it that's on, or someone required (and not switched off) credited there.
 * Albums switched off have nobody.
 */
export const countedByAlbum = (
  meta: MetaAlbum,
  filters: StackFilterState,
): Map<string, Set<number>> => {
  const cf = creditFilters(filters);
  const counted = new Map<string, Set<number>>(
    meta.members.map((m) => [m.key, new Set<number>()]),
  );
  for (const credit of meta.credits) {
    if (isCreditOn(credit, cf)) counted.get(credit.album)?.add(credit.person);
  }
  for (const m of meta.members) {
    if (off(filters.albums, m.key)) continue;
    for (const id of filters.required.contributors) {
      if (!off(filters.contributors, id) && m.search.contributors?.[id]) {
        counted.get(m.key)!.add(id);
      }
    }
  }
  return counted;
};

/** A stack result, scored. */
export interface StackResult extends ScoredRelease {
  /** Member albums linking it with someone who counts. */
  links: number;
  /** Those links and who makes them, most people first. */
  linkedAlbums: MetaLink[];
}

/** Member albums switched on: the "of M" in "links N of M". */
export const albumsOn = (meta: MetaAlbum, filters: StackFilterState): number =>
  meta.members.filter((m) => !off(filters.albums, m.key)).length;

/** A result's links with the people who count on each album. */
export const activeLinks = (
  result: MetaResult,
  counted: Map<string, Set<number>>,
): MetaLink[] =>
  result.links
    .map((link) => ({
      album: link.album,
      people: link.people.filter((id) => counted.get(link.album)?.has(id)),
    }))
    .filter((link) => link.people.length > 0)
    .sort((a, b) => b.people.length - a.people.length);

/** Most links, then most people, then most popular: the ranking. */
const byRanking = (a: StackResult, b: StackResult) =>
  b.links - a.links ||
  b.activeContributors.length - a.activeContributors.length ||
  (popularity(b) ?? -1) - (popularity(a) ?? -1) ||
  a.key.localeCompare(b.key);

/**
 * The results the filters leave, in ranking order. Each is scored by its
 * links (member albums linking it with someone who counts) and shared
 * (distinct people who count, across those links).
 */
export const filteredStackResults = (
  meta: MetaAlbum,
  filters: StackFilterState,
  likes: Likes = {},
  hidden: Record<string, unknown> = {},
): StackResult[] => {
  const counted = countedByAlbum(meta, filters);
  const members = new Map(meta.members.map((m) => [m.key, m.search]));
  const { required } = filters;
  const results: StackResult[] = [];
  for (const result of meta.results.values()) {
    const links = activeLinks(result, counted);
    if (links.length === 0) continue;
    const people = Array.from(new Set(links.flatMap((l) => l.people)));
    const release = mergedRelease(result);
    if (filters.collaborationsOnly && people.length < 2) continue;
    if (filters.linksTwoPlus && links.length < 2) continue;
    if (filters.excludeVarious && release.artist === "Various") continue;
    if (filters.likedOnly && !likes[release.key]) continue;
    if (!filters.showHidden && hidden[release.key]) continue;
    if (
      filters.excludeMainArtist &&
      result.links.some((l) => {
        const search = members.get(l.album);
        const own = search?.releases?.[result.release.key];
        return search && own && isMainArtistRelease(search, own);
      })
    ) {
      continue;
    }
    if (!required.contributors.every((id) => people.includes(id))) continue;
    if (!required.albums.every((key) => links.some((l) => l.album === key))) {
      continue;
    }
    if (
      !required.roles.every((role) =>
        links.some((l) =>
          l.people.some((id) =>
            members.get(l.album)?.contributors?.[id]?.roles.includes(role),
          ),
        ),
      )
    ) {
      continue;
    }
    results.push({
      ...release,
      score: people.length,
      confidence: 1,
      activeContributors: people,
      links: links.length,
      linkedAlbums: links,
    });
  }
  return results.sort(byRanking);
};

export type StackSortKey = SortKey | "links";

export const STACK_SORT_OPTIONS: {
  value: StackSortKey;
  label: string;
  short: string;
}[] = [
  { value: "links", label: "Most links to these albums", short: "Links" },
  ...SORT_OPTIONS,
];

/** The order a stack's results start in: most links, then most popular. */
export const DEFAULT_STACK_SORT: { sort: StackSortKey; then: SortKey } = {
  sort: "links",
  then: "popular",
};

/** Tiebreakers for a stack sort. Links already falls back to shared. */
export const stackTiebreakOptions = (sort: StackSortKey) =>
  tiebreakOptions(sort === "links" ? "shared" : sort);

/**
 * Results in the chosen order. Links: most links, then most shared, then
 * the tiebreaker (the ranking, without one). Other sorts work as for one
 * search, ties keeping the ranking.
 */
export const sortStackResults = (
  results: StackResult[],
  sort: StackSortKey,
  then: SortKey | null,
): StackResult[] => {
  if (sort !== "links") {
    return sortReleases(results, sort, then) as StackResult[];
  }
  if (!then) return results;
  const tiebreak = compareBy(then);
  return [...results].sort(
    (a, b) =>
      b.links - a.links ||
      b.activeContributors.length - a.activeContributors.length ||
      tiebreak(a, b),
  );
};

/** "via In Utero (2), Surfer Rosa (1)": the albums linking a result. */
export const linkedAlbumsText = (
  result: Pick<StackResult, "linkedAlbums">,
  meta: MetaAlbum,
): string => {
  const titles = new Map(meta.members.map((m) => [m.key, m.title]));
  return `via ${result.linkedAlbums
    .map((l) => `${titles.get(l.album) ?? l.album} (${l.people.length})`)
    .join(", ")}`;
};

/**
 * Where a search from a stack result hangs: the member sharing the most
 * people who count with it (ties: nearest the start), and those people.
 */
export const searchParentFor = (
  result: Pick<StackResult, "linkedAlbums">,
  meta: MetaAlbum,
  levels: Map<string, number>,
): { parent: SearchCache; via: number[] } | null => {
  const members = new Map(meta.members.map((m) => [m.key, m.search]));
  const level = (key: string) =>
    levels.get(members.get(key)?.searchId ?? "") ?? Infinity;
  const best = [...result.linkedAlbums].sort(
    (a, b) =>
      b.people.length - a.people.length || level(a.album) - level(b.album),
  )[0];
  const parent = best && members.get(best.album);
  return parent ? { parent, via: best.people } : null;
};

// Chips ----------------------------------------------------------------

export interface StackAlbumChip {
  key: string;
  title: string;
  artist: string;
  thumb: string;
  /** The search, for its cover. */
  search: SearchCache;
  included: boolean;
  required: boolean;
  /** Results it links, before filters. */
  count: number;
}

export const stackAlbumChips = (
  meta: MetaAlbum,
  filters: StackFilterState,
): StackAlbumChip[] => {
  const counts = new Map<string, number>();
  for (const result of meta.results.values()) {
    for (const link of result.links) {
      counts.set(link.album, (counts.get(link.album) ?? 0) + 1);
    }
  }
  return meta.members.map((m) => ({
    key: m.key,
    title: m.title,
    artist: m.artist,
    thumb: m.thumb,
    search: m.search,
    included: !off(filters.albums, m.key),
    required: filters.required.albums.includes(m.key),
    count: counts.get(m.key) ?? 0,
  }));
};

export interface StackPersonChip {
  id: number;
  name: string;
  roles: string[];
  /** Member albums they're credited on. */
  albums: string[];
  /** Results they link, before filters. */
  count: number;
  included: boolean;
  /** One of their credits would be on if they were. */
  available: boolean;
  required: boolean;
}

/** People, most results first, then most member albums, then by name. */
export const stackPeopleChips = (
  meta: MetaAlbum,
  filters: StackFilterState,
): StackPersonChip[] => {
  const counts = new Map<number, number>();
  for (const result of meta.results.values()) {
    for (const id of new Set(result.links.flatMap((l) => l.people))) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const cf = creditFilters(filters);
  const available = new Set(
    meta.credits
      .filter((c) => isCreditOn(c, cf, "person"))
      .map((c) => c.person),
  );
  filters.required.contributors.forEach((id) => available.add(id));
  return meta.people
    .map((p) => ({
      id: p.id,
      name: p.name,
      roles: defaultRolePipeline(p.roles),
      albums: p.albums,
      count: counts.get(p.id) ?? 0,
      included: !off(filters.contributors, p.id),
      available: available.has(p.id),
      required: filters.required.contributors.includes(p.id),
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.albums.length - a.albums.length ||
        a.name.localeCompare(b.name),
    );
};

export interface StackRoleChip {
  role: string;
  included: boolean;
  available: boolean;
  required: boolean;
  /** Who had it, on which albums, by name. */
  people: { id: number; name: string; included: boolean }[];
}

export interface StackRoleGroup {
  id: RoleCategory;
  label: string;
  roles: StackRoleChip[];
}

export const stackRoleGroups = (
  meta: MetaAlbum,
  filters: StackFilterState,
): StackRoleGroup[] => {
  const cf = creditFilters(filters);
  const available = new Set(
    meta.credits.filter((c) => isCreditOn(c, cf, "role")).map((c) => c.role),
  );
  const chips: StackRoleChip[] = meta.roles.map((role) => ({
    role,
    included: !off(filters.roles, role),
    available: available.has(role),
    required: filters.required.roles.includes(role),
    people: meta.people
      .filter((p) => p.roles.includes(role))
      .map((p) => ({
        id: p.id,
        name: p.name,
        included: !off(filters.contributors, p.id),
      })),
  }));
  return groupRoles(chips, (r) => r.role).map(({ items, ...group }) => ({
    ...group,
    roles: items,
  }));
};

/** How many filters differ from a new stack's, for the Filters button. */
export const stackFilterCount = (filters: StackFilterState): number => {
  const base = defaultStackFilters();
  const offCount = (states: Record<string | number, boolean>) =>
    Object.values(states).filter((on) => !on).length;
  const { required } = filters;
  return (
    offCount(filters.contributors) +
    offCount(filters.roles) +
    offCount(filters.albums) +
    required.contributors.length +
    required.roles.length +
    required.albums.length +
    (
      [
        "excludeMainArtist",
        "collaborationsOnly",
        "excludeVarious",
        "likedOnly",
        "showHidden",
        "linksTwoPlus",
      ] as const
    ).filter((k) => filters[k] !== base[k]).length
  );
};

/** `states` with each of `keys` switched; on is stored as no entry. */
export const setStates = <K extends string | number>(
  states: Record<K, boolean>,
  keys: K[],
  on: boolean,
): Record<K, boolean> => {
  const next = { ...states };
  for (const key of keys) {
    if (on) delete next[key];
    else next[key] = false;
  }
  return next;
};

/**
 * "Match each album's own filters": the stack's filters from its members'.
 * A person or role is off when every member that has them has them off;
 * "must include" is everything any member requires; a switch is on when
 * every member has it on. Albums all on.
 */
export const filtersFromMembers = (meta: MetaAlbum): StackFilterState => {
  const states = meta.members.map((m) => m.search.filterState);
  const people = new Map<number, boolean[]>();
  const roles = new Map<string, boolean[]>();
  for (const m of meta.members) {
    const fs = m.search.filterState;
    for (const c of Object.values(m.search.contributors ?? {})) {
      people.set(c.id, [
        ...(people.get(c.id) ?? []),
        fs.contributors[c.id] !== false,
      ]);
      for (const role of new Set(c.roles)) {
        roles.set(role, [...(roles.get(role) ?? []), fs.roles[role] !== false]);
      }
    }
  }
  const offWhereAllOff = <K extends string | number>(map: Map<K, boolean[]>) =>
    Object.fromEntries(
      Array.from(map)
        .filter(([, ons]) => ons.every((on) => !on))
        .map(([key]) => [key, false]),
    ) as Record<K, boolean>;
  const union = <T>(lists: T[][]) => Array.from(new Set(lists.flat()));
  const every = (
    pick: (fs: SearchCache["filterState"]) => boolean | undefined,
  ) => states.length > 0 && states.every((fs) => Boolean(pick(fs)));
  return {
    ...defaultStackFilters(),
    contributors: offWhereAllOff(people),
    roles: offWhereAllOff(roles),
    excludeMainArtist: every((fs) => fs.excludeMainArtist),
    collaborationsOnly: every((fs) => fs.collaborationsOnly),
    excludeVarious: every((fs) => fs.excludeVarious),
    likedOnly: every((fs) => fs.likedOnly),
    showHidden: every((fs) => fs.showHidden),
    required: {
      contributors: union(states.map((fs) => fs.required?.contributors ?? [])),
      roles: union(states.map((fs) => fs.required?.roles ?? [])),
      albums: [],
    },
  };
};

// "Must include" -------------------------------------------------------

const roleCategoryLabel = (role: string) =>
  groupRoles([role], (r) => r)[0]?.label ?? "";

const albumItem = (m: MetaAlbum["members"][number]): MustIncludeItem => ({
  kind: "album",
  key: m.key,
  label: m.title,
  detail: m.artist,
});

/** Required albums, people and roles, as the "must include" list shows them. */
export const stackRequiredChips = (
  meta: MetaAlbum,
  filters: StackFilterState,
): MustIncludeItem[] => {
  const people = new Map(meta.people.map((p) => [p.id, p]));
  return [
    ...meta.members
      .filter((m) => filters.required.albums.includes(m.key))
      .map(albumItem),
    ...filters.required.contributors.flatMap((id) => {
      const p = people.get(id);
      return p
        ? [
            {
              kind: "contributor" as const,
              id,
              label: p.name,
              detail: defaultRolePipeline(p.roles).join(", "),
            },
          ]
        : [];
    }),
    ...filters.required.roles.map((role) => ({
      kind: "role" as const,
      role,
      label: role,
      detail: roleCategoryLabel(role),
    })),
  ];
};

/**
 * The stack's albums (by title or artist), then people, then roles,
 * matching a query and not yet required.
 */
export const stackMustIncludeOptions = (
  meta: MetaAlbum,
  filters: StackFilterState,
  query: string,
  limit = 8,
): MustIncludeItem[] => {
  if (query.trim() === "") return [];
  const albums = meta.members
    .filter(
      (m) =>
        !filters.required.albums.includes(m.key) &&
        (matchesName(m.title, query) || matchesName(m.artist, query)),
    )
    .map(albumItem);
  const people: MustIncludeItem[] = stackPeopleChips(meta, filters)
    .filter(
      (p) =>
        !filters.required.contributors.includes(p.id) &&
        matchesName(p.name, query),
    )
    .map((p) => ({
      kind: "contributor",
      id: p.id,
      label: p.name,
      detail: p.roles.join(", "),
    }));
  const roles: MustIncludeItem[] = meta.roles
    .filter((r) => !filters.required.roles.includes(r) && matchesName(r, query))
    .map((role) => ({
      kind: "role",
      role,
      label: role,
      detail: roleCategoryLabel(role),
    }));
  return [...albums, ...people, ...roles].slice(0, limit);
};

/** Filter updates for adding or removing a "must include" entry. */
export const requireInStack = (
  filters: StackFilterState,
  item: MustIncludeItem,
  on: boolean,
): Partial<StackFilterState> => {
  if (item.kind === "album") return requireAlbum(filters, item.key, on);
  const { required } = filters;
  const toggle = <T>(list: T[], value: T) =>
    on
      ? list.includes(value)
        ? list
        : [...list, value]
      : list.filter((v) => v !== value);
  return item.kind === "contributor"
    ? {
        required: {
          ...required,
          contributors: toggle(required.contributors, item.id),
        },
        // Required people are switched on.
        contributors: on
          ? setStates(filters.contributors, [item.id], true)
          : filters.contributors,
      }
    : {
        required: { ...required, roles: toggle(required.roles, item.role) },
        roles: on ? setStates(filters.roles, [item.role], true) : filters.roles,
      };
};

/** Filter updates for requiring an album (every result links it) or not. */
export const requireAlbum = (
  filters: StackFilterState,
  key: string,
  on: boolean,
): Partial<StackFilterState> => ({
  required: {
    ...filters.required,
    albums: on
      ? Array.from(new Set([...filters.required.albums, key]))
      : filters.required.albums.filter((k) => k !== key),
  },
  // A required album is switched on.
  albums: on ? setStates(filters.albums, [key], true) : filters.albums,
});

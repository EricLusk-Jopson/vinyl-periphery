import { SearchCache } from "@/contexts/cache/types";

/**
 * Credits: the unit the filters work on. A credit is one person in one role
 * on one album. In a single search every credit is on the searched album;
 * across a stack the same person can have different roles on different
 * members, which is why the filters reason about credits rather than
 * people and roles on their own.
 *
 * The stored filter state holds explicit exclusions only (`false`);
 * anything missing is on, and everything else is derived from the credits.
 * Excluding an album never writes person or role exclusions.
 */

export interface Credit {
  person: number;
  role: string;
  /** A target key ("master:N"), or a search id for searches without one. */
  album: string;
}

/** Explicit exclusions and "must include", as the filter state holds them. */
export interface CreditFilters {
  contributors: Record<number, boolean>;
  roles: Record<string, boolean>;
  albums?: Record<string, boolean>;
  required?: { contributors: number[]; roles: string[]; albums?: string[] };
}

/** The album a search's credits are on. */
export const albumKeyOf = (
  search: Pick<SearchCache, "searchId" | "target">,
): string => search.target?.key ?? search.searchId;

/** One credit per (person, role) on the searched album. */
export const creditsOf = (
  search: Pick<SearchCache, "searchId" | "target" | "contributors">,
): Credit[] => {
  const album = albumKeyOf(search);
  return Object.values(search.contributors).flatMap((c) =>
    Array.from(new Set(c.roles)).map((role) => ({
      person: c.id,
      role,
      album,
    })),
  );
};

/** The filter state of a search, as credit filters. */
export const creditFiltersOf = (
  filterState: SearchCache["filterState"],
): CreditFilters => ({
  contributors: filterState.contributors,
  roles: filterState.roles,
  required: filterState.required,
});

const excluded = (
  states: Record<string | number, boolean> | undefined,
  key: string | number,
) => states?.[key] === false;

/** What a credit's own switches can be left out of, for availability. */
type Ignore = "person" | "role" | "album";

/**
 * Whether a credit is on: its person, its role and its album all not
 * excluded. A required person counts whatever their roles, since it's the
 * person that was asked for, so their credits ignore role exclusions.
 * `ignore` leaves one of the credit's own switches out.
 */
export const isCreditOn = (
  credit: Credit,
  filters: CreditFilters,
  ignore?: Ignore,
): boolean => {
  if (ignore !== "person" && excluded(filters.contributors, credit.person)) {
    return false;
  }
  if (ignore !== "album" && excluded(filters.albums, credit.album)) {
    return false;
  }
  if (ignore === "role" || !excluded(filters.roles, credit.role)) return true;
  return Boolean(filters.required?.contributors.includes(credit.person));
};

/** The credits that are on. */
export const activeCredits = (
  credits: Credit[],
  filters: CreditFilters,
): Credit[] => credits.filter((credit) => isCreditOn(credit, filters));

/**
 * The people who count towards results: those with a credit on, and those
 * required and not switched off (whatever their roles).
 */
export const countedPeople = (
  credits: Credit[],
  filters: CreditFilters,
): Set<number> => {
  const counted = new Set(activeCredits(credits, filters).map((c) => c.person));
  for (const id of filters.required?.contributors ?? []) {
    if (!excluded(filters.contributors, id)) counted.add(id);
  }
  return counted;
};

/**
 * Availability: a person, role or album is available when one of its
 * credits would be on if it were itself switched on, so a chip can show
 * whether switching it on would make any difference. Required people are
 * always available.
 */
export const availablePeople = (
  credits: Credit[],
  filters: CreditFilters,
): Set<number> => {
  const available = new Set(
    credits
      .filter((c) => isCreditOn(c, filters, "person"))
      .map((c) => c.person),
  );
  filters.required?.contributors.forEach((id) => available.add(id));
  return available;
};

export const availableRoles = (
  credits: Credit[],
  filters: CreditFilters,
): Set<string> =>
  new Set(
    credits.filter((c) => isCreditOn(c, filters, "role")).map((c) => c.role),
  );

export const availableAlbums = (
  credits: Credit[],
  filters: CreditFilters,
): Set<string> =>
  new Set(
    credits.filter((c) => isCreditOn(c, filters, "album")).map((c) => c.album),
  );

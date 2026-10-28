import { SearchCache } from "@/contexts/cache/types";
import { matchesName } from "./filters";
import { linkSummary } from "./linkSummary";
import { isMainArtistRelease, releaseYear } from "./results";
import { defaultRolePipeline } from "./transformers/roleProcessor";

type FilterState = SearchCache["filterState"];

/** A result matching the results search, whatever the filters. */
export interface ResultMatch {
  key: string;
  title: string;
  artist: string;
  year: number | null;
  /** The searched album's people on it. */
  contributors: number;
  /** By role category, like the Stack drawer: "via Musicians (2) · Audio (1)". */
  summary: string;
  /** Shown with the filters as they are. */
  visible: boolean;
}

/**
 * Every result whose title or artist contains `query`, filters or not:
 * titles that start with it first, then the rest, each by how many people
 * link them. `visibleKeys` are the results the filters let through.
 */
export const searchResults = (
  search: SearchCache,
  query: string,
  visibleKeys: ReadonlySet<string>,
  limit = 8,
): ResultMatch[] => {
  const q = query.trim();
  if (q === "") return [];
  const starts = (title: string) => matchesName(title.slice(0, q.length), q);
  return Object.values(search.releases)
    .filter((r) => matchesName(r.title, q) || matchesName(r.artist, q))
    .map((r) => {
      const ids = Array.from(new Set(r.contributorIds));
      return {
        key: r.key,
        title: r.title,
        artist: r.artist,
        year: releaseYear(r.year),
        contributors: ids.length,
        summary: linkSummary(
          ids.map((id) => ({
            id,
            roles: defaultRolePipeline(search.contributors[id]?.roles ?? []),
          })),
        ),
        visible: visibleKeys.has(r.key),
      };
    })
    .sort(
      (a, b) =>
        Number(starts(b.title)) - Number(starts(a.title)) ||
        b.contributors - a.contributors ||
        a.title.localeCompare(b.title),
    )
    .slice(0, limit);
};

/**
 * Filters that show exactly this result's people: them and the roles they
 * had switched on, everyone and everything else off, nothing required, and
 * the switches off unless they'd still let it through ("Hide <artist>
 * releases" stays on when it isn't the searched artist's).
 */
export const filtersToShow = (
  search: SearchCache,
  key: string,
): FilterState | null => {
  const release = search.releases[key];
  if (!release) return null;
  const people = new Set(
    release.contributorIds.filter((id) => search.contributors[id]),
  );
  if (people.size === 0) return null;
  const roles = new Set(
    Array.from(people).flatMap((id) => search.contributors[id].roles),
  );
  return {
    contributors: Object.fromEntries(
      Object.keys(search.contributors).map((id) => [
        Number(id),
        people.has(Number(id)),
      ]),
    ),
    roles: Object.fromEntries(
      Object.keys(search.roles).map((role) => [role, roles.has(role)]),
    ),
    excludeMainArtist: !isMainArtistRelease(search, release),
    collaborationsOnly: false,
    excludeVarious: false,
    required: { contributors: [], roles: [] },
  };
};

/** `releases` with the one keyed `pinned` moved to the top. */
export const pinToTop = <T extends { key: string }>(
  releases: T[],
  pinned: string | null,
): T[] => {
  const index = pinned ? releases.findIndex((r) => r.key === pinned) : -1;
  if (index <= 0) return releases;
  return [
    releases[index],
    ...releases.slice(0, index),
    ...releases.slice(index + 1),
  ];
};

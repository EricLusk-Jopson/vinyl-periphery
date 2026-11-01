import { EnrichedRelease } from "@/api/types";
import { SearchCache } from "@/contexts/cache/types";
import { albumKeyOf, Credit, creditsOf } from "./credits";
import { defaultContributorDisplayPipeline } from "./transformers/contributorProcessor";

/**
 * A meta-album: a set of searches read as one album. Its credits are every
 * member's credits (each on its own album), its people are everyone
 * credited on any member, and its results are every member's results
 * merged, less the members themselves. Takes a set of searches, not a
 * stack, so anything that groups searches can use it. Pure.
 */

export interface MetaMember {
  /** The album: its target key, or its search id. */
  key: string;
  search: SearchCache;
  title: string;
  artist: string;
  thumb: string;
}

export interface MetaPerson {
  id: number;
  /** Through the display pipeline. */
  name: string;
  /** Every role they had on any member, first seen first. */
  roles: string[];
  /** The member albums they're credited on, in member order. */
  albums: string[];
}

/** A member album whose results include a result, and who links them. */
export interface MetaLink {
  album: string;
  /** Credited on both. Raw: no filters. */
  people: number[];
}

export interface MetaResult {
  /** The first member's copy, with Discogs counts from any that kept them. */
  release: EnrichedRelease;
  /** One per member album that has it among its results, in member order. */
  links: MetaLink[];
}

export interface MetaAlbum {
  /** One per album, in the order given (a repeat run keeps the first). */
  members: MetaMember[];
  credits: Credit[];
  /** Most member albums first, then by name. */
  people: MetaPerson[];
  /** Every role on any member, alphabetical. */
  roles: string[];
  /** Keyed by result key; members aren't results. */
  results: Map<string, MetaResult>;
}

export const metaAlbum = (searches: SearchCache[]): MetaAlbum => {
  const members: MetaMember[] = [];
  const seen = new Set<string>();
  for (const search of searches) {
    const key = albumKeyOf(search);
    if (seen.has(key)) continue;
    seen.add(key);
    members.push({
      key,
      search,
      title: search.searchParams.album,
      artist: search.searchParams.artist,
      thumb: search.thumb,
    });
  }

  const credits = members.flatMap((m) => creditsOf(m.search));

  const people = new Map<number, MetaPerson>();
  for (const m of members) {
    for (const c of Object.values(m.search.contributors ?? {})) {
      const person = people.get(c.id) ?? {
        id: c.id,
        name: defaultContributorDisplayPipeline(c.name),
        roles: [],
        albums: [],
      };
      for (const role of c.roles) {
        if (!person.roles.includes(role)) person.roles.push(role);
      }
      if (!person.albums.includes(m.key)) person.albums.push(m.key);
      people.set(c.id, person);
    }
  }

  const results = new Map<string, MetaResult>();
  for (const m of members) {
    for (const release of Object.values(m.search.releases ?? {})) {
      if (seen.has(release.key)) continue;
      const entry = results.get(release.key) ?? { release, links: [] };
      if (!entry.release.community && release.community) {
        entry.release = { ...entry.release, community: release.community };
      }
      entry.links.push({
        album: m.key,
        people: Array.from(new Set(release.contributorIds)),
      });
      results.set(release.key, entry);
    }
  }

  return {
    members,
    credits,
    people: Array.from(people.values()).sort(
      (a, b) =>
        b.albums.length - a.albums.length || a.name.localeCompare(b.name),
    ),
    roles: Array.from(new Set(credits.map((c) => c.role))).sort((a, b) =>
      a.localeCompare(b),
    ),
    results,
  };
};

/** Everyone linking a result, from any member album. */
export const resultPeople = (result: MetaResult): number[] =>
  Array.from(new Set(result.links.flatMap((l) => l.people)));

/**
 * A result as one release: linked by everyone on any member who worked
 * on it.
 */
export const mergedRelease = (result: MetaResult): EnrichedRelease => ({
  ...result.release,
  contributorIds: resultPeople(result),
});

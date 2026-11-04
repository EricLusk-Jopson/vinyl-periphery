import { Contributor, EnrichedRelease } from "@/api/types";
import { SearchCache } from "@/contexts/cache/types";
import { MetaAlbum } from "./metaAlbum";
import { releaseYear, ScoredRelease } from "./results";
import { groupOrder, primaryGroup, RoleGroup } from "./roleGroups";
import { defaultContributorDisplayPipeline } from "./transformers/contributorProcessor";

/**
 * Swimlanes: the searched album's people across their careers. One lane
 * per person who counts under the filters, a tick per year they have
 * discography items, solid where the year has current results they link
 * and faint otherwise, and a line at the searched album's year (one per
 * stack album in a stack). Pure.
 */

/** Lanes shown before "Show all". */
export const LANES_SHOWN = 12;
/** Lanes in the share image. */
export const LANES_SHARED = 8;

export interface LaneTick {
  year: number;
  /** Current results (after filters) this person links, that year. */
  results: string[];
  /** Their other items that year. */
  others: number;
}

export interface Lane {
  id: number;
  name: string;
  group: RoleGroup;
  /** By year, oldest first. */
  ticks: LaneTick[];
  /** Current results they link, all years. */
  results: number;
  /** Their items with a year. */
  dated: number;
  /** Their items with no year: not drawn. */
  undated: number;
  first: number | null;
  /**
   * The search's page cap cut their oldest items: the lane starts later
   * than their career did.
   */
  partial: boolean;
}

export interface AlbumMark {
  key: string;
  title: string;
  year: number;
  /** The searched album, or a stack's start: drawn in the accent. */
  accent: boolean;
}

export interface Swimlanes {
  /** Sorted by primary group, then first year, then name. */
  lanes: Lane[];
  from: number;
  to: number;
  albums: AlbumMark[];
  /** Items with no year across the lanes, counted once per album. */
  undated: number;
}

export interface LanePerson {
  id: number;
  contributor: Contributor;
}

export interface SwimlaneInput {
  people: LanePerson[];
  /** Everyone's discography items, once per album. */
  releases: EnrichedRelease[];
  /** Current results, with who counts on each. */
  results: Pick<ScoredRelease, "key" | "activeContributors">[];
  albums: Array<{ key: string; title: string; year: number | null; accent: boolean }>;
}

/** Lanes from people, their items and the current results. */
export const buildSwimlanes = (input: SwimlaneInput): Swimlanes => {
  const active = new Map<string, Set<number>>(
    input.results.map((r) => [r.key, new Set(r.activeContributors)]),
  );
  const byPerson = new Map<number, EnrichedRelease[]>();
  for (const release of input.releases) {
    for (const id of new Set(release.contributorIds)) {
      byPerson.set(id, [...(byPerson.get(id) ?? []), release]);
    }
  }
  const undatedKeys = new Set<string>();
  const lanes: Lane[] = input.people.map(({ id, contributor }) => {
    const ticks = new Map<number, LaneTick>();
    let undated = 0;
    let results = 0;
    for (const release of byPerson.get(id) ?? []) {
      const year = releaseYear(release.year);
      if (year === null) {
        undated++;
        undatedKeys.add(release.key);
        continue;
      }
      const tick = ticks.get(year) ?? { year, results: [], others: 0 };
      if (active.get(release.key)?.has(id)) {
        tick.results.push(release.key);
        results++;
      } else {
        tick.others++;
      }
      ticks.set(year, tick);
    }
    const sorted = Array.from(ticks.values())
      .sort((a, b) => a.year - b.year)
      .map((t) => ({ ...t, results: [...t.results].sort() }));
    return {
      id,
      name: defaultContributorDisplayPipeline(contributor.name),
      group: primaryGroup(contributor),
      ticks: sorted,
      results,
      dated: sorted.reduce((n, t) => n + t.results.length + t.others, 0),
      undated,
      first: sorted[0]?.year ?? null,
      partial: Boolean(contributor.discography?.capped),
    };
  });
  lanes.sort(
    (a, b) =>
      groupOrder(a.group) - groupOrder(b.group) ||
      (a.first ?? Infinity) - (b.first ?? Infinity) ||
      a.name.localeCompare(b.name) ||
      a.id - b.id,
  );
  const albums = input.albums
    .filter((a): a is AlbumMark => a.year !== null)
    .sort((a, b) => a.year - b.year || Number(b.accent) - Number(a.accent));
  const years = [
    ...lanes.flatMap((l) => l.ticks.map((t) => t.year)),
    ...albums.map((a) => a.year),
  ];
  const from = years.length ? Math.min(...years) : 0;
  const to = years.length ? Math.max(...years) : 0;
  return {
    lanes,
    // At least a few years wide, so one year doesn't fill the lane.
    from: to - from < 4 ? from - 2 : from,
    to: to - from < 4 ? to + 2 : to,
    albums,
    undated: undatedKeys.size,
  };
};

/**
 * The lanes to draw: the `limit` with the most current results (then most
 * items, then name), kept in the lanes' order. With nothing in the range
 * left, the range narrows to them.
 */
export const topLanes = (lanes: Swimlanes, limit: number): Swimlanes => {
  if (lanes.lanes.length <= limit) return lanes;
  const keep = new Set(
    [...lanes.lanes]
      .sort(
        (a, b) =>
          b.results - a.results || b.dated - a.dated || a.name.localeCompare(b.name),
      )
      .slice(0, limit)
      .map((l) => l.id),
  );
  return { ...lanes, lanes: lanes.lanes.filter((l) => keep.has(l.id)) };
};

/** One search's lanes: its counted people and their items. */
export const searchSwimlanes = (
  search: SearchCache,
  counted: Set<number>,
  results: Pick<ScoredRelease, "key" | "activeContributors">[],
): Swimlanes => {
  const own = search.target ? search.releases[search.target.key] : undefined;
  return buildSwimlanes({
    people: Array.from(counted)
      .filter((id) => search.contributors[id])
      .map((id) => ({ id, contributor: search.contributors[id] })),
    releases: Object.values(search.releases),
    results,
    albums: [
      {
        key: search.target?.key ?? search.searchId,
        title: search.searchParams.album,
        year: releaseYear(own?.year),
        accent: true,
      },
    ],
  });
};

/**
 * A stack's lanes: everyone counted on any stack album, their items from
 * every member's results, and a line per stack album (the start's in the
 * accent).
 */
export const stackSwimlanes = (
  meta: MetaAlbum,
  counted: Map<string, Set<number>>,
  results: Pick<ScoredRelease, "key" | "activeContributors">[],
  startKey: string,
): Swimlanes => {
  const people = new Map<number, Contributor>();
  for (const member of meta.members) {
    for (const id of counted.get(member.key) ?? []) {
      const contributor = member.search.contributors?.[id];
      if (contributor && !people.has(id)) people.set(id, contributor);
    }
  }
  const releases = new Map<string, EnrichedRelease>();
  for (const member of meta.members) {
    for (const release of Object.values(member.search.releases ?? {})) {
      const known = releases.get(release.key);
      releases.set(
        release.key,
        known
          ? {
              ...known,
              contributorIds: Array.from(
                new Set([...known.contributorIds, ...release.contributorIds]),
              ),
            }
          : release,
      );
    }
  }
  // A stack album's year: as its own search lists it, else any member's.
  const yearOf = (member: MetaAlbum["members"][number]) =>
    releaseYear(member.search.releases?.[member.key]?.year) ??
    releaseYear(releases.get(member.key)?.year);
  return buildSwimlanes({
    people: Array.from(people, ([id, contributor]) => ({ id, contributor })),
    releases: Array.from(releases.values()),
    results,
    albums: meta.members.map((m) => ({
      key: m.key,
      title: m.title,
      year: yearOf(m),
      accent: m.key === startKey,
    })),
  });
};

/** "1998–2023", or one year. */
export const laneSpan = (lane: Lane): string => {
  if (lane.ticks.length === 0) return "";
  const last = lane.ticks[lane.ticks.length - 1].year;
  return lane.first === last ? String(last) : `${lane.first}–${last}`;
};

/**
 * The solid tick nearest a year on a lane, within `reach` years: what a
 * tap on the lane picks.
 */
export const nearestResultTick = (
  lane: Lane,
  year: number,
  reach: number,
): LaneTick | null => {
  let best: LaneTick | null = null;
  for (const tick of lane.ticks) {
    if (tick.results.length === 0) continue;
    const d = Math.abs(tick.year - year);
    if (d <= reach && (!best || d < Math.abs(best.year - year))) best = tick;
  }
  return best;
};

/** Decade marks for the axis: every 10 years, or 5 on a short range. */
export const axisYears = (from: number, to: number): number[] => {
  const step = to - from <= 20 ? 5 : 10;
  const marks: number[] = [];
  for (let y = Math.ceil(from / step) * step; y <= to; y += step) marks.push(y);
  return marks;
};

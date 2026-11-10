import { Contributor, EnrichedRelease } from "@/api/types";
import { SearchCache } from "@/contexts/cache/types";
import { albumKeyOf } from "./credits";
import { releaseYear, ScoredRelease } from "./results";
import { groupOrder, primaryGroup, RoleGroup } from "./roleGroups";
import { defaultContributorDisplayPipeline } from "./transformers/contributorProcessor";

/**
 * Swimlanes: people across their careers, for the share image. One lane
 * per person who counts under the filters and links one of the albums
 * chosen for the image; a tick per year they have discography items, tall
 * where the year has chosen albums they link and short otherwise; and a
 * line at the searched album's year (one per stack album in a stack, all
 * alike). Pure.
 */

/** Lanes in the share image. */
export const LANES_SHARED = 8;

export interface LaneTick {
  year: number;
  /** Albums chosen for the image this person links, that year. */
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

/** The searched album's year (or each stack album's), drawn as a line. */
export interface AlbumMark {
  key: string;
  title: string;
  year: number;
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
  /** The albums chosen for the image, with who counts on each. */
  results: Pick<ScoredRelease, "key" | "activeContributors">[];
  albums: Array<{ key: string; title: string; year: number | null }>;
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
    .sort((a, b) => a.year - b.year || a.key.localeCompare(b.key));
  const years = [
    ...lanes.flatMap((l) => l.ticks.map((t) => t.year)),
    ...albums.map((a) => a.year),
  ];
  const from = years.length ? Math.min(...years) : 0;
  const to = years.length ? Math.max(...years) : 0;
  return {
    // Only people linking a chosen album.
    lanes: lanes.filter((l) => l.results > 0),
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
          b.results - a.results ||
          b.dated - a.dated ||
          a.name.localeCompare(b.name),
      )
      .slice(0, limit)
      .map((l) => l.id),
  );
  return { ...lanes, lanes: lanes.lanes.filter((l) => keep.has(l.id)) };
};

/** People added to or taken out of the People image by hand. */
export interface LaneEdits {
  added: number[];
  removed: number[];
}

export const NO_LANE_EDITS: LaneEdits = { added: [], removed: [] };

/** The years the People image covers; null for the data's own end. */
export interface YearBounds {
  from: number | null;
  to: number | null;
}

export const ALL_YEARS: YearBounds = { from: null, to: null };

/** Lanes by how much they link: most results, then most items, then name. */
export const rankLanes = (lanes: Lane[]): Lane[] =>
  [...lanes].sort(
    (a, b) =>
      b.results - a.results ||
      b.dated - a.dated ||
      a.name.localeCompare(b.name),
  );

/**
 * The people to draw: everyone added by hand, then the most linked of the
 * rest, less those taken out, up to `count` in all (more when more were
 * added). Kept in the lanes' order.
 */
export const chooseLanes = (
  all: Swimlanes,
  count: number,
  edits: LaneEdits,
): Swimlanes => {
  const removed = new Set(edits.removed);
  const added = new Set(edits.added.filter((id) => !removed.has(id)));
  const present = new Set(all.lanes.map((l) => l.id));
  const keep = new Set([...added].filter((id) => present.has(id)));
  for (const lane of rankLanes(all.lanes)) {
    if (keep.size >= count) break;
    if (!removed.has(lane.id)) keep.add(lane.id);
  }
  return { ...all, lanes: all.lanes.filter((l) => keep.has(l.id)) };
};

/**
 * The lanes between two years: ticks and album lines outside them go, and
 * the axis runs from `from` to `to` (each the data's own end when unset).
 */
export const withinYears = (lanes: Swimlanes, years: YearBounds): Swimlanes => {
  const from = years.from ?? lanes.from;
  const to = Math.max(from, years.to ?? lanes.to);
  if (from === lanes.from && to === lanes.to) return lanes;
  const inside = (y: number) => y >= from && y <= to;
  return {
    ...lanes,
    from,
    to,
    albums: lanes.albums.filter((a) => inside(a.year)),
    lanes: lanes.lanes.map((lane) => {
      const ticks = lane.ticks.filter((t) => inside(t.year));
      return {
        ...lane,
        ticks,
        first: ticks[0]?.year ?? null,
        // A lane cut short by the page cap only shows so when its real
        // start falls inside the years drawn.
        partial: lane.partial && (lane.first ?? from) >= from,
      };
    }),
  };
};

/** One search's lanes: its counted people and their items. */
export const searchSwimlanes = (
  search: SearchCache,
  counted: Set<number>,
  /** The albums chosen for the image. */
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
      },
    ],
  });
};

/**
 * A stack's lanes: everyone counted on any stack album, their items from
 * every stack album's search, and a line per stack album.
 */
export const stackSwimlanes = (
  members: SearchCache[],
  /** Stack album key -> people who count there (the stack's filters). */
  counted: Map<string, Set<number>>,
  /** The albums chosen for the image. */
  results: Pick<ScoredRelease, "key" | "activeContributors">[],
): Swimlanes => {
  const people = new Map<number, Contributor>();
  for (const member of members) {
    for (const id of counted.get(albumKeyOf(member)) ?? []) {
      const contributor = member.contributors?.[id];
      if (contributor && !people.has(id)) people.set(id, contributor);
    }
  }
  const releases = new Map<string, EnrichedRelease>();
  for (const member of members) {
    for (const release of Object.values(member.releases ?? {})) {
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
  const yearOf = (member: SearchCache) => {
    const key = albumKeyOf(member);
    return (
      releaseYear(member.releases?.[key]?.year) ??
      releaseYear(releases.get(key)?.year)
    );
  };
  const seen = new Set<string>();
  return buildSwimlanes({
    people: Array.from(people, ([id, contributor]) => ({ id, contributor })),
    releases: Array.from(releases.values()),
    results,
    albums: members
      .filter((m) => !seen.has(albumKeyOf(m)) && seen.add(albumKeyOf(m)))
      .map((m) => ({
        key: albumKeyOf(m),
        title: m.searchParams.album,
        year: yearOf(m),
      })),
  });
};

/** "1998–2023", or one year. */
export const laneSpan = (lane: Lane): string => {
  if (lane.ticks.length === 0) return "";
  const last = lane.ticks[lane.ticks.length - 1].year;
  return lane.first === last ? String(last) : `${lane.first}–${last}`;
};

/** Decade marks for the axis: every 10 years, or 5 on a short range. */
export const axisYears = (from: number, to: number): number[] => {
  const step = to - from <= 20 ? 5 : 10;
  const marks: number[] = [];
  for (let y = Math.ceil(from / step) * step; y <= to; y += step) marks.push(y);
  return marks;
};

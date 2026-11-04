import { Contributor, EnrichedRelease } from "@/api/types";
import { SearchCache } from "@/contexts/cache/types";
import {
  shareScale,
  shareTransitMap,
  labelsCollide,
  layoutTransitMap,
  octilinear,
  offsetPath,
  TRANSIT_LINES,
  TransitOrientation,
  TransitStop,
  searchTransit,
  stackTransit,
} from "./transitMap";

/**
 * `n` stations, two to a column after the first, with long titles; person
 * p is on every station k where (k + p) % 3 !== 0, so many people share
 * many stations.
 */
const stack = (n: number, people = 9, columns = (k: number) => Math.ceil(k / 2)) => {
  const stops: TransitStop[] = Array.from({ length: n }, (_, k) => ({
    key: `master:${100 + k}`,
    title: `A Fairly Long Album Title ${k}`,
    detail: `The Long Artist Name ${k}`,
    column: 1990 + columns(k),
    marked: k === 0,
  }));
  const folks = Array.from({ length: people }, (_, p) => ({
    id: p + 1,
    name: `Person ${p + 1}`,
    stations: stops
      .filter((_, k) => (k + p + 1) % 3 !== 0)
      .map((s) => s.key),
  }));
  return { stops, people: folks };
};

const orientations: TransitOrientation[] = ["horizontal", "vertical"];

describe("layoutTransitMap", () => {
  it.each(
    [2, 4, 6, 8].flatMap((n) => orientations.map((o) => [n, o] as const)),
  )("lays out %i stations (%s) with no labels overlapping", (n, orientation) => {
    const map = layoutTransitMap({ ...stack(n), orientation });
    expect(map.stations).toHaveLength(n);
    expect(labelsCollide(map)).toBe(false);
    // Everything inside the map's box.
    for (const s of map.stations) {
      expect(s.label.x).toBeGreaterThanOrEqual(0);
      expect(s.label.y).toBeGreaterThanOrEqual(0);
      expect(s.label.x + s.label.w).toBeLessThanOrEqual(map.width);
      expect(s.label.y + s.label.h).toBeLessThanOrEqual(map.height);
    }
  });

  it("gives the same map for the same stack", () => {
    const input = { ...stack(6), orientation: "horizontal" as const };
    expect(layoutTransitMap(input)).toEqual(layoutTransitMap(input));
  });

  it("draws people on 2+ stations as lines, at most six, the rest listed", () => {
    const map = layoutTransitMap({ ...stack(6, 12), orientation: "horizontal" });
    expect(map.lines.length).toBe(TRANSIT_LINES);
    expect(map.lines.every((l) => l.stations.length >= 2)).toBe(true);
    // Most stations first.
    const counts = map.lines.map((l) => l.stations.length);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
    expect(map.others.length).toBeGreaterThan(0);
    expect(map.others.every((o) => o.stations >= 2)).toBe(true);
    // Interchanges are bigger.
    const big = map.stations.filter((s) => s.lines.length >= 2);
    const small = map.stations.filter((s) => s.lines.length < 2);
    for (const s of big) {
      for (const t of small) expect(s.radius).toBeGreaterThan(t.radius);
    }
  });

  it("never runs a line over a station it doesn't stop at", () => {
    // A chain, one album a step: lines skipping albums must bend round.
    const chain = (n: number) => stack(n, 9, (k) => k);
    for (const orientation of orientations) {
      for (const input of [chain(6), chain(8), stack(8)]) {
        const map = layoutTransitMap({ ...input, orientation });
        for (const line of map.lines) {
          map.stations.forEach((station, i) => {
            if (line.stations.includes(i)) return;
            for (const leg of line.legs) {
              leg.slice(1).forEach((q, k) => {
                const p = leg[k];
                for (let t = 0; t <= 1; t += 0.05) {
                  const d = Math.hypot(
                    p.x + (q.x - p.x) * t - station.x,
                    p.y + (q.y - p.y) * t - station.y,
                  );
                  expect(d).toBeGreaterThan(station.radius);
                }
              });
            }
          });
        }
      }
    }
  });

  it("runs lines in 0, 45 and 90 degree legs", () => {
    for (const orientation of orientations) {
      const map = layoutTransitMap({ ...stack(8), orientation });
      for (const leg of map.lines.flatMap((l) => l.legs)) {
        leg.slice(1).forEach((q, k) => {
          const p = leg[k];
          const angle =
            (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
          const off = Math.abs(((angle % 45) + 45) % 45);
          expect(Math.min(off, 45 - off)).toBeLessThan(1.5);
        });
      }
    }
  });

  it("puts steps along the map: left to right, or top to bottom", () => {
    const wide = layoutTransitMap({ ...stack(4), orientation: "horizontal" });
    const tall = layoutTransitMap({ ...stack(4), orientation: "vertical" });
    const [start, , , last] = wide.stations;
    expect(last.x).toBeGreaterThan(start.x);
    expect(tall.stations[3].y).toBeGreaterThan(tall.stations[0].y);
  });
});

describe("octilinear and offsetPath", () => {
  it("routes straight, then 45°, then straight", () => {
    expect(octilinear({ x: 0, y: 0 }, { x: 10, y: 0 }, "horizontal")).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    expect(octilinear({ x: 0, y: 0 }, { x: 10, y: 4 }, "horizontal")).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 7, y: 4 },
      { x: 10, y: 4 },
    ]);
    // More across than along: straight across first.
    expect(octilinear({ x: 0, y: 0 }, { x: 2, y: 6 }, "horizontal")).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 2 },
      { x: 2, y: 4 },
      { x: 2, y: 6 },
    ]);
  });

  it("offsets a path to its side, keeping its directions", () => {
    const moved = offsetPath(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      3,
    );
    expect(moved).toEqual([
      { x: 0, y: 3 },
      { x: 10, y: 3 },
    ]);
  });
});

describe("shareTransitMap", () => {
  it("fits the square better than the wide layout, labels apart", () => {
    // A chain of 8, one album a step: a long strip left to right.
    const input = stack(8, 9, (k) => k);
    const wide = layoutTransitMap({ ...input, orientation: "horizontal" });
    const shared = shareTransitMap(input);
    expect(labelsCollide(shared)).toBe(false);
    expect(shareScale(shared)).toBeGreaterThan(shareScale(wide));
    expect(shareTransitMap(input)).toEqual(shared);
  });
});

describe("searchTransit and stackTransit", () => {
  const person = (id: number, name: string): Contributor => ({
    id,
    name,
    roles: ["Drums"],
    sources: ["credits"],
    resourceUrl: "",
  });
  const release = (id: number, year: string): EnrichedRelease => ({
    id,
    type: "master",
    key: `master:${id}`,
    title: `Album ${id}`,
    artist: "Someone",
    year,
    thumb: "",
    resource_url: "",
    contributorIds: [],
  });
  const search = (id: number, people: Contributor[], releases: EnrichedRelease[]) =>
    ({
      searchId: `s-${id}`,
      searchParams: { artist: `Artist ${id}`, album: `Album ${id}` },
      target: { type: "master", id, key: `master:${id}` },
      contributors: Object.fromEntries(people.map((p) => [p.id, p])),
      releases: Object.fromEntries(releases.map((r) => [r.key, r])),
    }) as unknown as SearchCache;
  const shown = [
    { ...release(20, "2004"), activeContributors: [1, 2] },
    { ...release(21, "0"), activeContributors: [2] },
  ];

  it("draws one search's album and chosen results by year, its people as lines", () => {
    const s = search(10, [person(1, "Jim Keltner"), person(2, "Ry Cooder (2)")], [
      release(10, "1999"),
    ]);
    const input = searchTransit(s, shown, new Set([1, 2]));
    expect(input.stops).toEqual([
      { key: "master:10", title: "Album 10", detail: "Artist 10 · 1999", column: 1999, marked: true },
      { key: "master:20", title: "Album 20", detail: "Someone · 2004", column: 2004, marked: false },
      // Undated: after the rest.
      { key: "master:21", title: "Album 21", detail: "Someone", column: 9999, marked: false },
    ]);
    expect(input.people).toEqual([
      { id: 1, name: "Jim Keltner", stations: ["master:10", "master:20"] },
      { id: 2, name: "Ry Cooder", stations: ["master:10", "master:20", "master:21"] },
    ]);
    const map = layoutTransitMap({ ...input, orientation: "horizontal" });
    expect(map.lines.map((l) => l.name)).toEqual(["Ry Cooder", "Jim Keltner"]);
    // Time runs left to right; the searched album is marked.
    expect(map.stations[0].x).toBeLessThan(map.stations[1].x);
    expect(map.stations.map((s) => s.marked)).toEqual([true, false, false]);
  });

  it("draws a stack's albums and chosen results, people through both", () => {
    const a = search(10, [person(1, "Jim Keltner"), person(2, "Ry Cooder")], [release(10, "1999")]);
    const b = search(11, [person(2, "Ry Cooder")], [release(11, "2001"), release(10, "1998")]);
    const counted = new Map([
      ["master:10", new Set([1, 2])],
      ["master:11", new Set([2])],
    ]);
    const input = stackTransit([a, b], counted, shown);
    expect(input.stops.map((s) => [s.key, s.column, s.marked])).toEqual([
      // Each stack album's year as its own search lists it.
      ["master:10", 1999, true],
      ["master:11", 2001, true],
      ["master:20", 2004, false],
      ["master:21", 9999, false],
    ]);
    expect(input.people.find((p) => p.id === 2)?.stations).toEqual([
      "master:10",
      "master:11",
      "master:20",
      "master:21",
    ]);
  });

  it("draws nothing for nothing", () => {
    const map = layoutTransitMap({ stops: [], people: [], orientation: "vertical" });
    expect(map).toMatchObject({ stations: [], lines: [], width: 0, height: 0 });
  });
});

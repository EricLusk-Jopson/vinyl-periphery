import { Contributor } from "@/api/types";
import { SearchCache } from "@/contexts/cache/types";
import { metaAlbum } from "./metaAlbum";
import {
  shareScale,
  shareTransitMap,
  labelsCollide,
  layoutTransitMap,
  octilinear,
  offsetPath,
  TRANSIT_LINES,
  TransitOrientation,
} from "./transitMap";

const person = (id: number): Contributor => ({
  id,
  name: `Person ${id}`,
  roles: ["Drums"],
  sources: ["credits"],
  resourceUrl: "",
});

/**
 * `n` stack albums, two to a step after the start, with long titles;
 * person p is on every album k where (k + p) % 3 !== 0, so many people
 * share many stations.
 */
const stack = (n: number, people = 9) => {
  const searches = Array.from({ length: n }, (_, k) => {
    const on = Array.from({ length: people }, (_, p) => p + 1).filter(
      (p) => (k + p) % 3 !== 0,
    );
    return {
      searchId: `s-${k}`,
      searchParams: {
        artist: `The Long Artist Name ${k}`,
        album: `A Fairly Long Album Title ${k}`,
      },
      target: { type: "master", id: 100 + k, key: `master:${100 + k}` },
      contributors: Object.fromEntries(on.map((p) => [p, person(p)])),
      roles: {},
      releases: {},
      filterState: {},
      thumb: "",
      savedAt: k,
    } as unknown as SearchCache;
  });
  const levels = new Map(
    searches.map((s, k) => [s.searchId, Math.ceil(k / 2)]),
  );
  const meta = metaAlbum(searches);
  const counted = new Map(
    meta.members.map((m) => [
      m.key,
      new Set(Object.keys(m.search.contributors).map(Number)),
    ]),
  );
  return { meta, levels, counted };
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
    const chain = (n: number) => {
      const base = stack(n);
      const levels = new Map(
        base.meta.members.map((m, k) => [m.search.searchId, k]),
      );
      return { ...base, levels };
    };
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
    const base = stack(8);
    const levels = new Map(
      base.meta.members.map((m, k) => [m.search.searchId, k]),
    );
    const input = { ...base, levels };
    const wide = layoutTransitMap({ ...input, orientation: "horizontal" });
    const shared = shareTransitMap(input);
    expect(labelsCollide(shared)).toBe(false);
    expect(shareScale(shared)).toBeGreaterThan(shareScale(wide));
    expect(shareTransitMap(input)).toEqual(shared);
  });
});

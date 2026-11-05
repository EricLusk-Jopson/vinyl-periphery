import { Contributor, EnrichedRelease } from "@/api/types";
import { SearchCache } from "@/contexts/cache/types";
import {
  shareScale,
  shareTransitMap,
  labelsCollide,
  layoutTransitMap,
  bundleOrder,
  legRoute,
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

type P = { x: number; y: number };
const angle = (a: P, b: P) => Math.atan2(b.y - a.y, b.x - a.x);
const between = (a: number, b: number) => {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return (Math.min(d, 2 * Math.PI - d) * 180) / Math.PI;
};
/** A line's directions, leg by leg (legs meet under stations). */
const directions = (legs: P[][]) =>
  legs.flatMap((leg) =>
    leg
      .slice(1)
      .map((q, k) => [leg[k], q] as const)
      .filter(([p, q]) => Math.hypot(q.x - p.x, q.y - p.y) > 0.5)
      .map(([p, q]) => angle(p, q)),
  );

// Modelled on a real map (Big Thief, 2015 to 2026): 13 albums, six people.
const busy = () => {
  const years = [2015, 2016, 2017, 2018, 2018, 2020, 2020, 2021, 2022, 2024, 2024, 2026, 2026];
  const stops: TransitStop[] = years.map((y, k) => ({
    key: `k${k}`,
    title: `Album Title Number ${k}`,
    detail: `Artist ${k} · ${y}`,
    column: y,
    marked: k === 8,
  }));
  const on = (ks: number[]) => ks.map((k) => `k${k}`);
  return {
    stops,
    people: [
      { id: 1, name: "Adrianne", stations: on([1, 3, 4, 6, 8, 9, 10, 12]) },
      { id: 2, name: "Buck", stations: on([0, 1, 3, 4, 7, 8, 9, 11]) },
      { id: 3, name: "James", stations: on([1, 2, 3, 5, 6, 8, 9, 10, 12]) },
      { id: 4, name: "Mat", stations: on([2, 4, 5, 6, 8, 9, 10]) },
      { id: 5, name: "Max", stations: on([0, 8, 9, 10]) },
      { id: 6, name: "Noah", stations: on([8, 9, 10]) },
    ],
  };
};

const inputs = [
  ["2 stations", stack(2)],
  ["4 stations", stack(4)],
  ["6 stations", stack(6)],
  ["8 stations", stack(8)],
  ["an 8-album chain", stack(8, 9, (k) => k)],
  ["a busy map", busy()],
] as const;

describe("layoutTransitMap", () => {
  it.each(
    inputs.flatMap(([name, input]) =>
      orientations.map((o) => [name, o, input] as const),
    ),
  )("lays out %s (%s) with no labels overlapping", (_, orientation, input) => {
    const map = layoutTransitMap({ ...input, orientation });
    expect(map.stations).toHaveLength(input.stops.length);
    expect(labelsCollide(map)).toBe(false);
    for (const s of map.stations) {
      expect(s.label.x).toBeGreaterThanOrEqual(0);
      expect(s.label.y).toBeGreaterThanOrEqual(0);
      expect(s.label.x + s.label.w).toBeLessThanOrEqual(map.width);
      expect(s.label.y + s.label.h).toBeLessThanOrEqual(map.height);
    }
  });

  it.each(inputs)("never turns a line more than 90° (%s)", (_, input) => {
    for (const orientation of orientations) {
      const map = layoutTransitMap({ ...input, orientation });
      for (const line of map.lines) {
        const dirs = directions(line.legs);
        dirs.slice(1).forEach((d, k) => {
          expect(between(dirs[k], d)).toBeLessThanOrEqual(90.5);
        });
      }
    }
  });

  it("bends at 45°, keeping right angles for busy splits", () => {
    const count = (input: { stops: TransitStop[]; people: typeof busy extends () => infer R ? R extends { people: infer P } ? P : never : never }) => {
      const map = shareTransitMap(input);
      let t45 = 0;
      let t90 = 0;
      for (const line of map.lines) {
        const dirs = directions(line.legs);
        dirs.slice(1).forEach((d, k) => {
          const turn = between(dirs[k], d);
          if (turn > 60) t90++;
          else if (turn > 20) t45++;
        });
      }
      return { t45, t90 };
    };
    // A chain: no right angles at all.
    const chain = stack(8, 3, (k) => k);
    expect(count(chain).t90).toBe(0);
    // A busy map: mostly 45° bends.
    const { t45, t90 } = count(busy());
    expect(t90).toBeLessThanOrEqual(t45 / 4);
  });

  it.each(inputs)("runs every leg at 0, 45 or 90° (%s)", (_, input) => {
    const map = layoutTransitMap({ ...input, orientation: "vertical" });
    for (const d of map.lines.flatMap((l) => directions(l.legs))) {
      const deg = ((d * 180) / Math.PI + 360) % 45;
      expect(Math.min(deg, 45 - deg)).toBeLessThan(1.5);
    }
  });

  it.each(inputs)(
    "never runs a line over a station it doesn't stop at (%s)",
    (_, input) => {
      for (const orientation of orientations) {
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
    },
  );

  it.each(inputs)(
    "sends lines splitting at a station off different ways (%s)",
    (_, input) => {
      const map = layoutTransitMap({ ...input, orientation: "vertical" });
      map.stations.forEach((_, i) => {
        // Next station -> the direction lines leave for it.
        const outs = new Map<number, number>();
        for (const line of map.lines) {
          const k = line.stations.indexOf(i);
          if (k < 0 || k === line.stations.length - 1) continue;
          const leg = line.legs[k];
          outs.set(line.stations[k + 1], angle(leg[0], leg[1]));
        }
        const list = [...outs.values()];
        list.forEach((a, x) =>
          list.slice(x + 1).forEach((b) => {
            expect(between(a, b)).toBeGreaterThan(30);
          }),
        );
      });
    },
  );

  it("runs each line through its stations in its own time order", () => {
    const map = layoutTransitMap({ ...busy(), orientation: "vertical" });
    for (const line of map.lines) {
      const years = line.stations.map((i) => map.stations[i].step);
      expect([...years].sort((a, b) => a - b)).toEqual(years);
    }
  });

  it("gives the same map for the same input", () => {
    const input = { ...busy(), orientation: "horizontal" as const };
    expect(layoutTransitMap(input)).toEqual(layoutTransitMap(input));
  });

  it("draws people on 2+ stations as lines, at most six, the rest listed", () => {
    const map = layoutTransitMap({ ...stack(6, 12), orientation: "horizontal" });
    expect(map.lines.length).toBe(TRANSIT_LINES);
    expect(map.lines.every((l) => l.stations.length >= 2)).toBe(true);
    const counts = map.lines.map((l) => l.stations.length);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
    expect(map.others.length).toBeGreaterThan(0);
    // Interchanges are bigger.
    const big = map.stations.filter((s) => s.lines.length >= 2);
    const small = map.stations.filter((s) => s.lines.length < 2);
    for (const s of big) {
      for (const t of small) expect(s.radius).toBeGreaterThan(t.radius);
    }
  });
});

describe("bundleOrder", () => {
  /**
   * A trunk s0 -> s1 -> s2 -> s3 running right (y down, as drawn), and
   * lines joining it at s1 from above (s4) and from below (s5).
   */
  const network = (joiners: Array<{ id: number; from: number }>) => {
    const at = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 4, y: 0 },
      { x: 6, y: 0 },
      { x: 0, y: -2 },
      { x: 0, y: 2 },
    ];
    const lines = [
      { id: 5, name: "Trunk A", stations: [0, 1, 2, 3] },
      { id: 6, name: "Trunk B", stations: [0, 1, 2, 3] },
      ...joiners.map((j) => ({
        id: j.id,
        name: `Joins from ${j.from}`,
        stations: [j.from, 1, 2, 3],
      })),
    ];
    const legs: Array<{ a: number; b: number }> = [];
    const runs = lines.map((line) =>
      line.stations.slice(1).map((to, k) => {
        const from = line.stations[k];
        let leg = legs.findIndex(
          (g) => (g.a === from && g.b === to) || (g.a === to && g.b === from),
        );
        if (leg < 0) {
          leg = legs.length;
          legs.push({ a: from, b: to });
        }
        return { leg, forward: legs[leg].a === from };
      }),
    );
    const net = {
      stations: at.map((_, k) => ({ key: `s${k}`, title: "", artist: "", marked: false, rank: k })),
      lines,
      others: [],
      legs,
      runs,
    };
    const st = { at, late: legs.map(() => true) };
    const order = bundleOrder(net as never, st as never);
    const leg = (a: number, b: number) =>
      legs.findIndex((g) => g.a === a && g.b === b);
    return { order, leg, lines };
  };

  it("keeps a line joining from one side on that side, outside the bundle", () => {
    // Running right with y down, the positive offset side is down (+y).
    const { order, leg, lines } = network([
      { id: 1, from: 4 },
      { id: 9, from: 5 },
    ]);
    const ids = (k: number) => order[k].map((l) => lines[l].id);
    // From above: first (the negative side); from below: last. The trunk
    // keeps its order between them.
    expect(ids(leg(1, 2))).toEqual([1, 5, 6, 9]);
  });

  it("never reorders a bundle coming out of a station", () => {
    const { order, leg, lines } = network([
      { id: 1, from: 4 },
      { id: 9, from: 5 },
    ]);
    const ids = (k: number) => order[k].map((l) => lines[l].id);
    expect(ids(leg(2, 3))).toEqual(ids(leg(1, 2)));
    // The trunk pair's order on its first leg is the same as further on.
    expect(ids(leg(0, 1))).toEqual([5, 6]);
  });

  it("puts a joiner on the side it came from, whatever its id", () => {
    // The same, ids the other way round: the order follows the sides.
    const { order, leg, lines } = network([
      { id: 9, from: 4 },
      { id: 1, from: 5 },
    ]);
    expect(order[leg(1, 2)].map((l) => lines[l].id)).toEqual([9, 5, 6, 1]);
  });
});

describe("drawn bundles", () => {
  /** Which side of line A line B runs on, leg by leg, where they share one. */
  const sides = (map: ReturnType<typeof layoutTransitMap>) => {
    const out: Array<{ pair: string; k: number; side: number }> = [];
    map.lines.forEach((a, i) =>
      map.lines.forEach((b, j) => {
        if (j <= i) return;
        a.stations.slice(1).forEach((to, k) => {
          const from = a.stations[k];
          const kb = b.stations.findIndex(
            (s, n) =>
              n < b.stations.length - 1 &&
              ((s === from && b.stations[n + 1] === to) ||
                (s === to && b.stations[n + 1] === from)),
          );
          if (kb < 0) return;
          const la = a.legs[k];
          const lb = b.stations[kb] === from ? b.legs[kb] : [...b.legs[kb]].reverse();
          const d = { x: la[1].x - la[0].x, y: la[1].y - la[0].y };
          const m = { x: lb[0].x - la[0].x, y: lb[0].y - la[0].y };
          out.push({ pair: `${i}-${j}`, k, side: Math.sign(d.x * m.y - d.y * m.x) });
        });
      }),
    );
    return out;
  };

  it.each(inputs)("keeps each pair of lines on one side of each other along a shared stretch (%s)", (_, input) => {
    const map = layoutTransitMap({ ...input, orientation: "vertical" });
    const all = sides(map);
    for (const s of all) {
      // The next leg of the same pair, if they share it too.
      const next = all.find((t) => t.pair === s.pair && t.k === s.k + 1);
      if (next) expect(next.side).toBe(s.side);
    }
  });
});

describe("legRoute and offsetPath", () => {
  it("routes straight, or a straight run and one diagonal", () => {
    expect(legRoute({ x: 0, y: 0 }, { x: 4, y: 0 }, true)).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]);
    expect(legRoute({ x: 0, y: 0 }, { x: 3, y: 3 }, false)).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 3 },
    ]);
    // The diagonal last, or first.
    expect(legRoute({ x: 0, y: 0 }, { x: 4, y: 1 }, true)).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 1 },
    ]);
    expect(legRoute({ x: 0, y: 0 }, { x: 4, y: 1 }, false)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 4, y: 1 },
    ]);
  });

  it("offsets a path to its side, keeping its directions", () => {
    expect(
      offsetPath(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        3,
      ),
    ).toEqual([
      { x: 0, y: 3 },
      { x: 10, y: 3 },
    ]);
  });
});

describe("shareTransitMap", () => {
  it("labels a small map beside its stations, where that fits at full size", () => {
    const map = shareTransitMap(stack(4, 3));
    expect(map.legend).toBe(false);
    expect(labelsCollide(map)).toBe(false);
    expect(shareScale(map)).toBeGreaterThanOrEqual(1);
  });

  it("numbers a busy map's stations, their titles in a legend", () => {
    const map = shareTransitMap(busy());
    expect(map.legend).toBe(true);
    // Numbered in time order, 1 the earliest.
    const byNumber = [...map.stations].sort((a, b) => a.number - b.number);
    expect(byNumber.map((s) => s.number)).toEqual(
      map.stations.map((_, i) => i + 1),
    );
    expect(byNumber.map((s) => s.step)).toEqual(
      [...byNumber.map((s) => s.step)].sort((a, b) => a - b),
    );
    // Without labels in the way the map draws nearly full size, stations
    // big enough for their number and never touching.
    expect(shareScale(map)).toBeGreaterThanOrEqual(0.85);
    expect(map.stations.every((s) => s.radius >= 13)).toBe(true);
    expect(labelsCollide(map)).toBe(false);
    expect(shareTransitMap(busy())).toEqual(map);
  });

  it("puts titles in a legend or beside the stations when asked", () => {
    const listed = shareTransitMap(stack(4, 3), true);
    expect(listed.legend).toBe(true);
    expect(listed.stations.every((s) => s.number > 0)).toBe(true);
    const labelled = shareTransitMap(busy(), false);
    expect(labelled.legend).toBe(false);
    expect(labelsCollide(labelled)).toBe(false);
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
    // The searched album is marked.
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

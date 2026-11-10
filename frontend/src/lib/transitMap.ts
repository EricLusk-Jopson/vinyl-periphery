/**
 * A transit map of albums: they are stations, and the people credited on
 * two or more of them are lines. For one search, its album and the
 * albums chosen; for a stack, its albums and the albums chosen. The
 * searched or stacked albums are marked. Interchanges (stations on 2+
 * lines) are drawn larger.
 *
 * There's no time axis: the lines are time. Each line runs through its
 * stations in its own order (by year), and stations go wherever the
 * lines read best. The layout is a search over a grid (simulated
 * annealing, seeded, so the same input gives the same map) that scores:
 * - no line turning more than 90° (inertia), anywhere, stations too;
 * - lines liking to run straight, less so the longer they've run, and
 *   turning soonest after a bend costing most;
 * - lines that split at a station (going on to different stations)
 *   leaving it in clearly different directions, and lines arriving from
 *   different stations arriving from different directions;
 * - no line running over a station it doesn't stop at, no two stations
 *   close, few crossings, no two legs running along each other, legs not
 *   too long, and a gentle preference for one overall direction of flow.
 * Legs are 0/45/90°: straight, or one straight run and one diagonal.
 * Lines sharing a leg run side by side (see `bundleOrder`), and so do
 * legs that share a stretch of track (see `trackSlots`).
 * Each label takes the first spot around its station that overlaps no
 * other label or station (then the fewest lines); if any still overlaps,
 * the grid spreads out and tries again. Pure and deterministic.
 */

import { EnrichedRelease } from "@/api/types";
import { SearchCache } from "@/contexts/cache/types";
import { albumKeyOf } from "./credits";
import { releaseYear, ScoredRelease } from "./results";
import { defaultContributorDisplayPipeline } from "./transformers/contributorProcessor";

/** Lines drawn; the rest are listed under the map. */
export const TRANSIT_LINES = 6;
/** The most lines a map can draw (one colour each, `LINE_COLOURS`). */
export const MAX_LINES = 12;

/** Which way the map flows overall: down, or to the right. */
export type TransitOrientation = "horizontal" | "vertical";

/** Spacing in layout units (pixels at 1:1) and label type sizes. */
export const TRANSIT = {
  /** Pixels per grid step; stations are at least two steps apart. */
  cell: 62,
  /** Between parallel lines on a shared leg. */
  gap: 7,
  line: 5,
  station: 7,
  title: { size: 15, char: 8.2, line: 19 },
  artist: { size: 12, char: 7.3, line: 16 },
  /** Most characters on a label line before it's cut. */
  chars: 20,
  /** Room kept clear around labels. */
  pad: 4,
  /** A numbered station's radius, at the least (its number inside). */
  numbered: 13,
  /** Most characters on a legend line. */
  legendChars: 34,
};

export interface TransitStation {
  key: string;
  title: string;
  artist: string;
  /** Its place in time among the stations (by `TransitStop.column`). */
  step: number;
  /** The searched album, or one of the stack's. */
  marked: boolean;
  /** Its number in the legend: 1 for the earliest. */
  number: number;
  x: number;
  y: number;
  /** Lines through it. */
  lines: number[];
  radius: number;
  label: TransitLabel;
}

export interface TransitLabel {
  /** The label's box (top-left, size), in layout units. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** How its text lines sit in the box. */
  align: "start" | "middle" | "end";
  title: string;
  artist: string;
}

export interface TransitLine {
  /** The person's Discogs id. */
  id: number;
  name: string;
  /** Colour slot, 0 to MAX_LINES - 1. */
  colour: number;
  /** Station indices in the line's own order (by year). */
  stations: number[];
  /**
   * The drawn legs, station to station in the line's order, each offset
   * for the lines sharing it. Legs meet under the stations, which cover
   * the lines side by side.
   */
  legs: Array<Array<{ x: number; y: number }>>;
}

export interface TransitMap {
  orientation: TransitOrientation;
  stations: TransitStation[];
  lines: TransitLine[];
  /** People on 2+ stations not drawn as lines, most stations first. */
  others: Array<{ id: number; name: string; stations: number }>;
  /**
   * Stations are numbered (in time order) and their titles listed in a
   * legend beside the map, rather than labelled where they are.
   */
  legend: boolean;
  /** The map's box, labels included, in layout units. */
  width: number;
  height: number;
}

type Point = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };

const overlaps = (a: Box, b: Box, pad = 0) =>
  a.x < b.x + b.w + pad &&
  b.x < a.x + a.w + pad &&
  a.y < b.y + b.h + pad &&
  b.y < a.y + a.h + pad;

const cut = (text: string, chars = TRANSIT.chars) =>
  text.length <= chars ? text : `${text.slice(0, chars - 1).trimEnd()}…`;

/** A label's size: a title line and an artist line. */
export const labelSize = (title: string, artist: string) => ({
  w: Math.ceil(
    Math.max(
      cut(title).length * TRANSIT.title.char,
      cut(artist).length * TRANSIT.artist.char,
    ),
  ),
  h: TRANSIT.title.line + (artist ? TRANSIT.artist.line : 0),
});

/** A polyline moved `offset` to its left, corners mitred. */
export const offsetPath = (points: Point[], offset: number): Point[] => {
  if (offset === 0 || points.length < 2) return points;
  const normal = (a: Point, b: Point) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: -dy / l, y: dx / l };
  };
  return points.map((p, i) => {
    const before = i > 0 ? normal(points[i - 1], p) : null;
    const after = i < points.length - 1 ? normal(p, points[i + 1]) : null;
    const n1 = before ?? after!;
    const n2 = after ?? before!;
    const dot = n1.x * n2.x + n1.y * n2.y;
    const scale = offset / (1 + dot || 1);
    return { x: p.x + (n1.x + n2.x) * scale, y: p.y + (n1.y + n2.y) * scale };
  });
};

/** An album to draw as a station. */
export interface TransitStop {
  key: string;
  title: string;
  /** The label's second line: artist and year. */
  detail: string;
  /** When it's from (the year: see the builders); orders each line. */
  column: number;
  /** The searched album, or one of the stack's. */
  marked: boolean;
}

/** Someone credited on stations, by key. */
export interface TransitPerson {
  id: number;
  name: string;
  stations: string[];
}

export interface TransitInput {
  stops: TransitStop[];
  people: TransitPerson[];
  /** Most people drawn as lines (the rest are counted); TRANSIT_LINES unset. */
  lines?: number;
  /** Which way the map flows overall. */
  orientation: TransitOrientation;
}

/** Where label candidates sit around a station, in order of preference. */
const SPOTS: Array<{ dx: number; dy: number; align: TransitLabel["align"] }> = [
  { dx: 0, dy: 1, align: "middle" },
  { dx: 0, dy: -1, align: "middle" },
  { dx: 1, dy: 0, align: "start" },
  { dx: -1, dy: 0, align: "end" },
  { dx: 1, dy: 1, align: "start" },
  { dx: 1, dy: -1, align: "start" },
  { dx: -1, dy: 1, align: "end" },
  { dx: -1, dy: -1, align: "end" },
];

const segmentHitsBox = (a: Point, b: Point, box: Box) => {
  // Sampled: legs are short and boxes small, so a few points will do.
  for (let t = 0; t <= 1; t += 0.1) {
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
      return true;
    }
  }
  return false;
};


/** The eight directions, a step of 45° each, clockwise from the right. */
const DIRS: Point[] = [
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
];
const dirOf = (a: Point, b: Point): number => {
  const dx = Math.sign(b.x - a.x);
  const dy = Math.sign(b.y - a.y);
  return DIRS.findIndex((d) => d.x === dx && d.y === dy);
};
/** How far apart two directions are, in steps of 45° (0 to 4). */
const turnOf = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 8;
  return Math.min(d, 8 - d);
};
const cheb = (a: Point, b: Point) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/**
 * A leg from a to b on the grid: straight when they're in line (0/45/90°),
 * else a straight run and a diagonal, the diagonal last (`late`) or first.
 */
export const legRoute = (a: Point, b: Point, late: boolean): Point[] => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (dx === 0 || dy === 0 || ax === ay) return [a, b];
  const diag = Math.min(ax, ay);
  const run = { x: ax > ay ? Math.sign(dx) * (ax - diag) : 0, y: ay > ax ? Math.sign(dy) * (ay - diag) : 0 };
  const corner = late
    ? { x: a.x + run.x, y: a.y + run.y }
    : { x: b.x - run.x, y: b.y - run.y };
  return [a, corner, b];
};

/** A small seeded generator (mulberry32), for a repeatable search. */
const seeded = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};
const hash = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** What the grid search works on: stations, lines, and the legs between. */
interface Network {
  stations: Array<{ key: string; title: string; artist: string; marked: boolean; rank: number }>;
  lines: Array<{ id: number; name: string; stations: number[] }>;
  others: TransitMap["others"];
  /** Legs, one per pair of stations next to each other on any line. */
  legs: Array<{ a: number; b: number }>;
  /** Per line, its legs in order, and whether it runs each one a -> b. */
  runs: Array<Array<{ leg: number; forward: boolean }>>;
}

const networkOf = (input: Omit<TransitInput, "orientation">): Network => {
  const stations = input.stops.map((s, k) => ({
    key: s.key,
    title: s.title,
    artist: s.detail,
    marked: s.marked,
    column: s.column,
    k,
  }));
  // Time order: by year, then as given.
  const byTime = [...stations].sort((a, b) => a.column - b.column || a.k - b.k);
  const rank = new Map(byTime.map((s, r) => [s.k, r]));
  const index = new Map(stations.map((s, i) => [s.key, i]));
  const onStations = input.people
    .map((p) => ({
      id: p.id,
      name: p.name,
      stations: Array.from(
        new Set(
          p.stations
            .map((key) => index.get(key))
            .filter((i): i is number => i !== undefined),
        ),
      ).sort((a, b) => rank.get(a)! - rank.get(b)!),
    }))
    .filter((p) => p.stations.length >= 2)
    .sort(
      (a, b) =>
        b.stations.length - a.stations.length ||
        a.name.localeCompare(b.name) ||
        a.id - b.id,
    );
  const most = Math.max(1, Math.min(MAX_LINES, input.lines ?? TRANSIT_LINES));
  const lines = onStations.slice(0, most);
  const legs: Network["legs"] = [];
  const legAt = new Map<string, number>();
  const runs = lines.map((line) =>
    line.stations.slice(1).map((to, k) => {
      const from = line.stations[k];
      const id = from < to ? `${from}-${to}` : `${to}-${from}`;
      if (!legAt.has(id)) {
        legAt.set(id, legs.length);
        legs.push({ a: from, b: to });
      }
      const leg = legAt.get(id)!;
      return { leg, forward: legs[leg].a === from };
    }),
  );
  return {
    stations: stations.map((s) => ({
      key: s.key,
      title: s.title,
      artist: s.artist,
      marked: s.marked,
      rank: rank.get(s.k)!,
    })),
    lines,
    others: onStations.slice(most).map((p) => ({
      id: p.id,
      name: p.name,
      stations: p.stations.length,
    })),
    legs,
    runs,
  };
};

/** A grid layout: each station's place, and each leg's shape. */
interface GridState {
  at: Point[];
  late: boolean[];
}

/** Weights for the grid search's score (see the top of this file). */
const SCORE = {
  near: 1000,
  /** Stations only two steps apart: their labels are cramped. */
  snug: 22,
  through: 800,
  /** A line passing a step from a station it doesn't stop at. */
  brush: 30,
  uTurn: 600,
  sameWayOut: 200,
  closeWayOut: 40,
  /** Two different legs on one track: the lines would hide each other. */
  overlap: 70,
  crossing: 45,
  bend: 6,
  /** A 45° turn: the usual way to bend. */
  turn45: 2.5,
  /**
   * A 90° turn: avoided unless a station has many lines going different
   * ways (the split rule then outweighs it).
   */
  turn90: 30,
  longRun: 0.6,
  longLeg: 0.5,
  back: 9,
  sideways: 1.5,
  area: 0.12,
  /** The map's longest side: it should fold up, not run on. */
  span: 1.5,
};

/**
 * Whether two segments cross or touch (a bend of one on the other reads
 * as a junction with no station). Meeting at a station doesn't count:
 * legs meet there.
 */
const segmentsCross = (
  p: Point,
  q: Point,
  r: Point,
  s: Point,
  isStation: (a: Point) => boolean,
) => {
  const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
  for (const [a, b] of [
    [p, r],
    [p, s],
    [q, r],
    [q, s],
  ]) {
    if (same(a, b)) return !isStation(a);
  }
  const d = (a: Point, b: Point, c: Point) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(r, s, p);
  const d2 = d(r, s, q);
  const d3 = d(p, q, r);
  const d4 = d(p, q, s);
  if (d1 === 0 && d2 === 0) return false;
  return d1 * d2 <= 0 && d3 * d4 <= 0;
};

/** Whether two segments run along each other (in line, overlapping). */
const segmentsOverlap = (p: Point, q: Point, r: Point, s: Point) => {
  const cross = (a: Point, b: Point, c: Point) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (cross(p, q, r) !== 0 || cross(p, q, s) !== 0) return false;
  const along = Math.abs(q.x - p.x) >= Math.abs(q.y - p.y) ? "x" : "y";
  const [a1, a2] = [Math.min(p[along], q[along]), Math.max(p[along], q[along])];
  const [b1, b2] = [Math.min(r[along], s[along]), Math.max(r[along], s[along])];
  return Math.min(a2, b2) - Math.max(a1, b1) > 0;
};

/** Whether a point sits on a segment (the grid: exactly). */
const onSegment = (c: Point, p: Point, q: Point) => {
  const cross = (q.x - p.x) * (c.y - p.y) - (q.y - p.y) * (c.x - p.x);
  if (cross !== 0) return false;
  return (
    c.x >= Math.min(p.x, q.x) &&
    c.x <= Math.max(p.x, q.x) &&
    c.y >= Math.min(p.y, q.y) &&
    c.y <= Math.max(p.y, q.y)
  );
};

/** Whether a point is within a step of a segment (not on it). */
const nearSegment = (c: Point, p: Point, q: Point) => {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const length = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((c.x - p.x) * dx + (c.y - p.y) * dy) / length));
  return Math.hypot(p.x + t * dx - c.x, p.y + t * dy - c.y) < 1.01;
};

/** The score of a grid layout: lower is better. */
const score = (net: Network, st: GridState, flow: TransitOrientation): number => {
  let cost = 0;
  const n = st.at.length;
  // Stations two steps apart at least.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = cheb(st.at[i], st.at[j]);
      if (d < 2) cost += SCORE.near * (2 - d);
      else if (d === 2) cost += SCORE.snug;
    }
  }
  const routes = net.legs.map((leg, k) =>
    legRoute(st.at[leg.a], st.at[leg.b], st.late[k]),
  );
  const segments = routes.flatMap((route, leg) =>
    route.slice(1).map((q, k) => {
      const p = route[k];
      return {
        p,
        q,
        leg,
        x1: Math.min(p.x, q.x),
        x2: Math.max(p.x, q.x),
        y1: Math.min(p.y, q.y),
        y2: Math.max(p.y, q.y),
      };
    }),
  );
  routes.forEach((route, k) => {
    const { a, b } = net.legs[k];
    // A leg's own bend, and its length.
    if (route.length > 2) cost += SCORE.bend;
    const length = cheb(st.at[a], st.at[b]);
    if (length > 3) cost += SCORE.longLeg * (length - 3) ** 2;
    // Never over a station it doesn't stop at, and not close by.
    for (let i = 0; i < n; i++) {
      if (i === a || i === b) continue;
      for (let s = 1; s < route.length; s++) {
        const p = route[s - 1];
        const q = route[s];
        if (onSegment(st.at[i], p, q)) cost += SCORE.through;
        else if (nearSegment(st.at[i], p, q)) cost += SCORE.brush;
      }
    }
  });
  // Crossings, and legs running along other legs.
  const stationAt = new Set(st.at.map((p) => `${p.x},${p.y}`));
  const isStation = (p: Point) => stationAt.has(`${p.x},${p.y}`);
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const s1 = segments[i];
      const s2 = segments[j];
      if (s1.leg === s2.leg) continue;
      // Boxes apart: neither crossing nor overlapping.
      if (s1.x2 < s2.x1 || s2.x2 < s1.x1 || s1.y2 < s2.y1 || s2.y2 < s1.y1) {
        continue;
      }
      if (segmentsOverlap(s1.p, s1.q, s2.p, s2.q)) cost += SCORE.overlap;
      else if (segmentsCross(s1.p, s1.q, s2.p, s2.q, isStation)) {
        cost += SCORE.crossing;
      }
    }
  }
  // Each line: its turns, its straight runs, and its overall flow.
  const outs = new Map<number, Map<number, number>>();
  const ins = new Map<number, Map<number, number>>();
  net.runs.forEach((runs, l) => {
    const stations = net.lines[l].stations;
    const path: Point[] = [];
    runs.forEach(({ leg, forward }, k) => {
      const route = forward ? routes[leg] : [...routes[leg]].reverse();
      path.push(...(k === 0 ? route : route.slice(1)));
      const from = stations[k];
      const to = stations[k + 1];
      // Which way it leaves `from` for `to`, and arrives at `to`.
      const out = dirOf(route[0], route[1]);
      const inn = dirOf(route[route.length - 2], route[route.length - 1]);
      if (!outs.has(from)) outs.set(from, new Map());
      outs.get(from)!.set(to, out);
      if (!ins.has(to)) ins.set(to, new Map());
      ins.get(to)!.set(from, inn);
      // Flow: forward overall, a little sideways is fine.
      const d =
        flow === "vertical"
          ? st.at[to].y - st.at[from].y
          : st.at[to].x - st.at[from].x;
      if (d < 0) cost += SCORE.back * (1 - d);
      else if (d === 0) cost += SCORE.sideways;
    });
    // Runs of one direction, with their lengths.
    const dirs: Array<{ dir: number; length: number }> = [];
    for (let k = 1; k < path.length; k++) {
      const dir = dirOf(path[k - 1], path[k]);
      const length = cheb(path[k - 1], path[k]);
      if (length === 0) continue;
      const last = dirs[dirs.length - 1];
      if (last && last.dir === dir) last.length += length;
      else dirs.push({ dir, length });
    }
    dirs.forEach((run, k) => {
      if (run.length > 4) cost += SCORE.longRun * (run.length - 4);
      if (k === 0) return;
      const turn = turnOf(dirs[k - 1].dir, run.dir);
      // The longer it's run straight, the readier it is to turn.
      const ready = 1 / (1 + dirs[k - 1].length / 2);
      if (turn > 2) cost += SCORE.uTurn;
      // A right angle stays dear however long the line has run straight.
      else if (turn === 2) cost += SCORE.turn90 * Math.max(0.75, ready);
      else if (turn === 1) cost += SCORE.turn45 * ready;
    });
  });
  // Splits: different next stations, clearly different directions out;
  // different previous stations, clearly different directions in.
  for (const ways of [outs, ins]) {
    for (const dirs of ways.values()) {
      const list = Array.from(dirs.values());
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const t = turnOf(list[i], list[j]);
          if (t === 0) cost += SCORE.sameWayOut;
          else if (t === 1) cost += SCORE.closeWayOut;
        }
      }
    }
  }
  // Compact.
  const xs = st.at.map((p) => p.x);
  const ys = st.at.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs) + 2;
  const h = Math.max(...ys) - Math.min(...ys) + 2;
  cost += SCORE.area * w * h + SCORE.span * Math.max(w, h);
  return cost;
};

/** Grid layouts already searched, by their input. */
const searched = new Map<string, { state: GridState; cost: number }>();
const SEARCHED_KEPT = 24;

/** One annealing run from `start`: the best layout it found, and its score. */
const anneal = (
  net: Network,
  flow: TransitOrientation,
  start: GridState,
  steps: number,
  hot: number,
  random: () => number,
): { state: GridState; cost: number } => {
  const n = start.at.length;
  let state = start;
  let cost = score(net, state, flow);
  let best = { state, cost };
  const cold = 0.05;
  for (let k = 0; k < steps; k++) {
    const t = hot * (cold / hot) ** (k / steps);
    const next: GridState = { at: [...state.at], late: [...state.late] };
    const pick = random();
    if (pick < 0.12 && net.legs.length > 0) {
      const leg = Math.floor(random() * net.legs.length);
      next.late[leg] = !next.late[leg];
    } else if (pick < 0.24 && n > 1) {
      const i = Math.floor(random() * n);
      const j = Math.floor(random() * n);
      [next.at[i], next.at[j]] = [next.at[j], next.at[i]];
    } else {
      const i = Math.floor(random() * n);
      const step = () => Math.floor(random() * 5) - 2;
      next.at[i] = { x: next.at[i].x + step(), y: next.at[i].y + step() };
    }
    const nextCost = score(net, next, flow);
    if (nextCost <= cost || random() < Math.exp((cost - nextCost) / t)) {
      state = next;
      cost = nextCost;
      if (cost < best.cost) best = { state, cost };
    }
  }
  return best;
};

const signatureOf = (net: Network) =>
  JSON.stringify([
    net.stations.map((s) => [s.key, s.rank]),
    net.lines.map((l) => [l.id, l.stations]),
  ]);

/**
 * A first, rough search flowing one way (seeded simulated annealing from
 * a straight line in time order), remembered by its input.
 */
const roughGrid = (
  net: Network,
  flow: TransitOrientation,
): { state: GridState; cost: number } => {
  const signature = `rough:${flow}:${signatureOf(net)}`;
  const known = searched.get(signature);
  if (known) return known;
  const start: GridState = {
    at: net.stations.map((s) =>
      flow === "vertical" ? { x: 0, y: s.rank * 2 } : { x: s.rank * 2, y: 0 },
    ),
    late: net.legs.map(() => true),
  };
  const found =
    net.stations.length > 1 && net.legs.length > 0
      ? anneal(net, flow, start, Math.min(4000, 300 * net.stations.length), 40, seeded(hash(signature)))
      : { state: start, cost: 0 };
  remember(signature, found);
  return found;
};

/** The rough search refined, cooler, from where it ended. */
const searchGrid = (net: Network, flow: TransitOrientation): GridState => {
  const signature = `fine:${flow}:${signatureOf(net)}`;
  const known = searched.get(signature);
  if (known) return known.state;
  const rough = roughGrid(net, flow);
  const found =
    net.stations.length > 1 && net.legs.length > 0
      ? anneal(net, flow, rough.state, Math.min(5000, 400 * net.stations.length), 6, seeded(hash(signature)))
      : rough;
  remember(signature, found);
  return found.state;
};

const remember = (signature: string, found: { state: GridState; cost: number }) => {
  searched.set(signature, found);
  while (searched.size > SEARCHED_KEPT) searched.delete(searched.keys().next().value!);
};

/** Where `to` lies from `from`, as an angle from `along` (radians, -π..π),
 * positive on the side a positive offset goes (see `offsetPath`). */
const sideAngle = (along: Point, toward: Point) =>
  Math.atan2(
    along.x * toward.y - along.y * toward.x,
    along.x * toward.x + along.y * toward.y,
  );

const minus = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });

/**
 * The order of the lines on each leg, from the negative side to the
 * positive (the side a positive offset goes, in the leg's own a -> b
 * direction).
 *
 * Two lines sharing a stretch of legs keep one order along all of it, so
 * nothing reorders coming out of a station. Which side each takes is
 * decided where they joined: the one that came from further to one side
 * runs on that side (a line joining a bundle from the right stays on the
 * right, so new lines go on the outside). Lines that set off together are
 * ordered by where they part: the one turning further to one side runs on
 * that side. Lines alike at both ends keep their person id order.
 */
export const bundleOrder = (net: Network, st: GridState): number[][] => {
  // Each line's legs, by leg: where in the line, and which way it runs it.
  const at = net.runs.map((runs) => {
    const map = new Map<number, { index: number; forward: boolean }>();
    runs.forEach((r, index) => map.set(r.leg, { index, forward: r.forward }));
    return map;
  });
  /** The leg from station `from` to `to` (on line `l`), as a route. */
  const route = (from: number, to: number) => {
    const leg = net.legs.findIndex(
      (g) => (g.a === from && g.b === to) || (g.a === to && g.b === from),
    );
    const r = legRoute(st.at[net.legs[leg].a], st.at[net.legs[leg].b], st.late[leg]);
    return net.legs[leg].a === from ? r : [...r].reverse();
  };
  /** The first step of the route from `from` to `to`. */
  const first = (from: number, to: number) => {
    const r = route(from, to);
    return minus(r[1], r[0]);
  };
  /**
   * The side (+1 or -1, positive as for offsets, in the line's own
   * direction) a line starting at `leg` will leave the bundle by: where it
   * first parts from lines it runs with, the way it turns there against
   * theirs (a line that stops there goes the other way to them). +1 when
   * it never parts.
   */
  const starterSide = (l: number, leg: number): number => {
    const runs = net.runs[l];
    const stations = net.lines[l].stations;
    for (let k = at[l].get(leg)!.index; k < runs.length; k++) {
      const t = stations[k + 1];
      const next = stations[k + 2];
      const others = net.lines
        .map((_, o) => o)
        .filter((o) => o !== l && at[o].has(runs[k].leg));
      // Where the others go next from t (in the line's direction).
      const leaving = others
        .map((o) => {
          const here = at[o].get(runs[k].leg)!;
          const s = net.lines[o].stations;
          const same = here.forward === runs[k].forward;
          return same ? s[here.index + 2] : s[here.index - 1];
        })
        .filter((n) => n !== next);
      if (leaving.length === 0) continue;
      const leg = runs[k];
      const r = legRoute(
        st.at[net.legs[leg.leg].a],
        st.at[net.legs[leg.leg].b],
        st.late[leg.leg],
      );
      const route = leg.forward ? r : [...r].reverse();
      const arriving = minus(route[route.length - 1], route[route.length - 2]);
      const turn = (n: number | undefined) =>
        n === undefined ? 0 : sideAngle(arriving, first(t, n));
      const theirs =
        leaving.reduce((sum, n) => sum + turn(n), 0) / leaving.length;
      const mine = turn(next);
      if (Math.abs(mine - theirs) > 1e-6) return Math.sign(mine - theirs);
    }
    return 1;
  };

  /**
   * How far toward the positive side line `l2` lies from `l1` on `leg`,
   * in the leg's own direction: > 0 positive, < 0 negative.
   */
  const compare = (
    leg: number,
    l1: number,
    l2: number,
  ): { side: number; stretch: string } => {
    const p1 = at[l1].get(leg)!;
    const p2 = at[l2].get(leg)!;
    const s1 = net.lines[l1].stations;
    const s2 = net.lines[l2].stations;
    const same = p1.forward === p2.forward;
    // l2's station k steps along l1's direction from where they share.
    const l2Leg = (k: number) => (same ? p2.index + k : p2.index - k);
    let back = 0;
    while (
      p1.index - back - 1 >= 0 &&
      net.runs[l2][l2Leg(-back - 1)]?.leg === net.runs[l1][p1.index - back - 1].leg
    ) {
      back++;
    }
    let ahead = 0;
    while (
      p1.index + ahead + 1 < net.runs[l1].length &&
      net.runs[l2][l2Leg(ahead + 1)]?.leg === net.runs[l1][p1.index + ahead + 1].leg
    ) {
      ahead++;
    }
    const start = s1[p1.index - back];
    const end = s1[p1.index + ahead + 1];
    // Each line's station before the stretch and after it, in l1's
    // direction (or none, where it starts or ends there).
    const before1 = s1[p1.index - back - 1];
    const after1 = s1[p1.index + ahead + 2];
    const before2 = same ? s2[p2.index - back - 1] : s2[p2.index + back + 2];
    const after2 = same ? s2[p2.index + ahead + 2] : s2[p2.index - ahead - 1];
    // Where they joined: the side each came from, seen along the stretch.
    // From straight behind is 0; from further round to the positive side,
    // more (up to π); to the negative side, less.
    const along = first(start, s1[p1.index - back + 1]);
    const cameFrom = (before: number | undefined) => {
      if (before === undefined) return 0;
      const t = sideAngle(along, first(start, before));
      return t > 0 ? Math.PI - t : -Math.PI - t;
    };
    let side = cameFrom(before2) - cameFrom(before1);
    // One starts here, the other runs through from straight behind: the
    // new line goes outside, on the side it will leave the bundle by.
    if (Math.abs(side) < 1e-6 && (before1 === undefined) !== (before2 === undefined)) {
      const starter = before1 === undefined ? l1 : l2;
      // In l1's direction along the stretch.
      const s = starterSide(starter, leg) * (at[starter].get(leg)!.forward === p1.forward ? 1 : -1);
      side = starter === l2 ? 0.5 * s : -0.5 * s;
    }
    if (Math.abs(side) < 1e-6) {
      // Where they part: the side each turns to, seen along the stretch.
      const last = route(s1[p1.index + ahead], end);
      const arriving = minus(last[last.length - 1], last[last.length - 2]);
      const goesTo = (after: number | undefined) =>
        after === undefined ? 0 : sideAngle(arriving, first(end, after));
      side = goesTo(after2) - goesTo(after1);
    }
    // Alike at both ends: by person id, the weakest call of all.
    if (Math.abs(side) < 1e-6) {
      side = 1e-3 * Math.sign(net.lines[l2].id - net.lines[l1].id);
    }
    // The stretch, the same from either line and any leg of it.
    const legs = net.runs[l1]
      .slice(p1.index - back, p1.index + ahead + 1)
      .map((r) => r.leg);
    const stretch = `${Math.min(l1, l2)}:${Math.max(l1, l2)}:${Math.min(...legs)}`;
    // In the leg's own direction.
    return { side: p1.forward ? side : -side, stretch };
  };

  // Each pair's call on each leg, from the lower line to the higher.
  const onLeg = net.legs.map((_, leg) =>
    net.lines.map((_, l) => l).filter((l) => at[l].has(leg)),
  );
  const calls = onLeg.map((on, leg) => {
    const map = new Map<string, { side: number; stretch: string }>();
    on.forEach((a, i) =>
      on.slice(i + 1).forEach((b) => map.set(`${a}:${b}`, compare(leg, a, b))),
    );
    return map;
  });
  // Calls flipped to break cycles, by stretch: flipped for all its legs.
  const flipped = new Set<string>();
  /** Whether line `b` runs on the positive side of `a` on `leg`. */
  const positive = (leg: number, a: number, b: number) => {
    const call = calls[leg].get(a < b ? `${a}:${b}` : `${b}:${a}`)!;
    const side = flipped.has(call.stretch) ? -call.side : call.side;
    return a < b ? side > 0 : side < 0;
  };
  /** A cycle of three on a leg (any cycle holds one), or null. */
  const cycleOn = (leg: number): number[] | null => {
    const on = onLeg[leg];
    for (const a of on) {
      for (const b of on) {
        if (b === a || !positive(leg, a, b)) continue;
        for (const c of on) {
          if (c === a || c === b) continue;
          if (positive(leg, b, c) && positive(leg, c, a)) return [a, b, c];
        }
      }
    }
    return null;
  };
  // Break every cycle at its weakest call, for that call's whole stretch,
  // so the order stays the same along it. Bounded: each flip settles a
  // weaker call than it leaves.
  for (let pass = 0; pass < 4 * net.legs.length + 4; pass++) {
    let changed = false;
    for (let leg = 0; leg < net.legs.length; leg++) {
      const cycle = cycleOn(leg);
      if (!cycle) continue;
      const pairs = [
        [cycle[0], cycle[1]],
        [cycle[1], cycle[2]],
        [cycle[2], cycle[0]],
      ].map(([a, b]) => calls[leg].get(a < b ? `${a}:${b}` : `${b}:${a}`)!);
      const weakest = [...pairs].sort(
        (x, y) => Math.abs(x.side) - Math.abs(y.side) || x.stretch.localeCompare(y.stretch),
      )[0];
      if (flipped.has(weakest.stretch)) flipped.delete(weakest.stretch);
      else flipped.add(weakest.stretch);
      changed = true;
    }
    if (!changed) break;
  }
  // No cycles: each leg's lines by how many they run positive of.
  return onLeg.map((on, leg) =>
    [...on].sort((a, b) => {
      const wins = (x: number) => on.filter((y) => y !== x && positive(leg, y, x)).length;
      return wins(a) - wins(b) || a - b;
    }),
  );
};

/**
 * Each line's place across its leg, in gaps from the middle (positive: to
 * the leg's left as it runs a -> b, the way `offsetPath` moves), for each
 * leg's lines in `bundles` order.
 *
 * Lines on one leg sit side by side. So do legs that share a stretch of
 * track (two legs leaving a station the same way, say, which the score
 * makes rare but the grid can't always avoid): they're drawn as one
 * bundle there, so neither hides the other. Each leg takes the side it
 * turns off to, so they part without crossing.
 */
const trackSlots = (net: Network, st: GridState, bundles: number[][]): number[][] => {
  const routes = net.legs.map((leg, k) => legRoute(st.at[leg.a], st.at[leg.b], st.late[k]));
  const centred = (n: number) => Array.from({ length: n }, (_, i) => i - (n - 1) / 2);
  const slots = bundles.map((b) => centred(b.length));
  // Legs sharing track, grouped, each with the stretch first found.
  const group = net.legs.map((_, k) => k);
  const root = (k: number): number => (group[k] === k ? k : (group[k] = root(group[k])));
  const shared = new Map<number, { p: Point; q: Point }>();
  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      for (let a = 1; a < routes[i].length; a++) {
        for (let b = 1; b < routes[j].length; b++) {
          const [p, q] = [routes[i][a - 1], routes[i][a]];
          if (!segmentsOverlap(p, q, routes[j][b - 1], routes[j][b])) continue;
          const [ri, rj] = [root(i), root(j)];
          if (ri !== rj) {
            group[rj] = ri;
            if (!shared.has(ri)) shared.set(ri, shared.get(rj) ?? { p, q });
          }
        }
      }
    }
  }
  const members = new Map<number, number[]>();
  net.legs.forEach((_, k) => {
    const r = root(k);
    members.set(r, [...(members.get(r) ?? []), k]);
  });
  for (const [r, legs] of members) {
    if (legs.length < 2) continue;
    const { p, q } = shared.get(r)!;
    const along = minus(q, p);
    const cross = (v: Point) => along.x * v.y - along.y * v.x;
    const placed = legs.map((k) => {
      const route = routes[k];
      // Which way the leg runs the shared line (its part on that line, or
      // else the whole leg), and where it lies off it.
      const onLine = route.findIndex(
        (pt, i) => i > 0 && cross(minus(pt, p)) === 0 && cross(minus(route[i - 1], p)) === 0,
      );
      const step =
        onLine > 0
          ? minus(route[onLine], route[onLine - 1])
          : minus(route[route.length - 1], route[0]);
      const same = along.x * step.x + along.y * step.y >= 0;
      const off = route
        .map((pt) => cross(minus(pt, p)))
        .reduce((x, y) => (Math.abs(y) > Math.abs(x) ? y : x), 0);
      return { k, same, side: Math.sign(off) };
    });
    placed.sort((a, b) => a.side - b.side || a.k - b.k);
    const total = placed.reduce((n, { k }) => n + bundles[k].length, 0);
    let next = 0;
    for (const { k, same } of placed) {
      const n = bundles[k].length;
      // Slots across the whole bundle, in the shared line's direction.
      const across = centred(n).map((c) => next + (n - 1) / 2 + c - (total - 1) / 2);
      // A leg running the other way sees left and right swapped.
      slots[k] = bundles[k].map((_, i) => (same ? across[i] : -across[n - 1 - i]));
      next += n;
    }
  }
  return slots;
};

/**
 * The grid layout drawn at `cell` pixels a step, with its labels: beside
 * the stations, or (`legend`) as numbers in them, the titles in a legend.
 */
const drawAt = (
  net: Network,
  st: GridState,
  flow: TransitOrientation,
  cell: number,
  legend = false,
): TransitMap => {
  const px = (p: Point): Point => ({ x: p.x * cell, y: p.y * cell });
  const points = st.at.map(px);
  // Lines sharing a leg, side by side in the order that keeps each one
  // on the side it joined from (see `bundleOrder`).
  const orders = bundleOrder(net, st);
  const slots = trackSlots(net, st, orders);
  const bundles = orders.map((o) => o.map((l) => net.lines[l].id));
  const spreadAt = new Map<number, number>();
  const lines: TransitLine[] = net.lines.map((line, colour) => ({
    id: line.id,
    name: line.name,
    colour,
    stations: line.stations,
    legs: net.runs[colour].map(({ leg, forward }) => {
      const slot = slots[leg][bundles[leg].indexOf(line.id)];
      const { a, b } = net.legs[leg];
      for (const end of [a, b]) {
        spreadAt.set(end, Math.max(spreadAt.get(end) ?? 0, Math.abs(slot) * TRANSIT.gap));
      }
      // Offset along the leg's own direction, so every line on it agrees.
      const route = offsetPath(legRoute(st.at[a], st.at[b], st.late[leg]).map(px), slot * TRANSIT.gap);
      const oriented = forward ? route : [...route].reverse();
      return oriented.map((p) => ({
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
      }));
    }),
  }));
  const through = net.stations.map((_, i) =>
    lines.filter((l) => l.stations.includes(i)).map((l) => l.colour),
  );
  // Interchanges grow to cover the lines side by side through them.
  const radius = through.map((on, i) =>
    Math.max(
      on.length >= 2
        ? Math.max(TRANSIT.station + 3, (spreadAt.get(i) ?? 0) + 7)
        : TRANSIT.station,
      // Room for its number, in a legend map.
      legend ? TRANSIT.numbered : 0,
    ),
  );
  const dots: Box[] = points.map((p, i) => ({
    x: p.x - radius[i],
    y: p.y - radius[i],
    w: radius[i] * 2,
    h: radius[i] * 2,
  }));
  // Labels, in time order.
  const order = net.stations
    .map((_, i) => i)
    .sort((a, b) => net.stations[a].rank - net.stations[b].rank);
  const placed: Array<TransitLabel | undefined> = [];
  for (const i of order) {
    if (legend) {
      // The number sits in the station; the title goes in the legend.
      placed[i] = {
        ...dots[i],
        align: "middle",
        title: cut(net.stations[i].title, TRANSIT.legendChars),
        artist: cut(net.stations[i].artist, TRANSIT.legendChars),
      };
      continue;
    }
    const { w, h } = labelSize(net.stations[i].title, net.stations[i].artist);
    const p = points[i];
    const r = radius[i] + 6;
    let best: { label: TransitLabel; cost: number } | null = null;
    for (const spot of SPOTS) {
      const cx = p.x + spot.dx * (r + (spot.dx === 0 ? 0 : w / 2));
      const cy = p.y + spot.dy * (r + (spot.dy === 0 ? 0 : h / 2));
      const box = { x: cx - w / 2, y: cy - h / 2, w, h };
      const label: TransitLabel = {
        ...box,
        align: spot.align,
        title: cut(net.stations[i].title),
        artist: cut(net.stations[i].artist),
      };
      const hitsLabel = placed.some((l) => l && overlaps(l, box, TRANSIT.pad));
      const hitsStation = dots.some((d) => overlaps(d, box, TRANSIT.pad));
      const crossings = lines.reduce(
        (sum, l) =>
          sum +
          l.legs.reduce(
            (m, leg) =>
              m + leg.slice(1).filter((q, k) => segmentHitsBox(leg[k], q, box)).length,
            0,
          ),
        0,
      );
      const cost = (hitsLabel ? 1000 : 0) + (hitsStation ? 1000 : 0) + crossings;
      if (!best || cost < best.cost) best = { label, cost };
      if (cost === 0) break;
    }
    placed[i] = best!.label;
  }
  const labels = placed as TransitLabel[];

  // Everything from 0,0: stations, lines and labels.
  const boxes = [
    ...dots,
    ...labels,
    ...lines.flatMap((l) => l.legs.flat().map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 }))),
  ];
  const minX = Math.min(...boxes.map((b) => b.x)) - TRANSIT.pad;
  const minY = Math.min(...boxes.map((b) => b.y)) - TRANSIT.pad;
  const maxX = Math.max(...boxes.map((b) => b.x + b.w)) + TRANSIT.pad;
  const maxY = Math.max(...boxes.map((b) => b.y + b.h)) + TRANSIT.pad;
  const shift = (p: Point) => ({
    x: Math.round((p.x - minX) * 10) / 10,
    y: Math.round((p.y - minY) * 10) / 10,
  });
  return {
    orientation: flow,
    stations: net.stations.map((s, i) => ({
      key: s.key,
      title: s.title,
      artist: s.artist,
      step: s.rank,
      number: s.rank + 1,
      marked: s.marked,
      ...shift(points[i]),
      lines: through[i],
      radius: radius[i],
      label: { ...labels[i], ...shift(labels[i]) },
    })),
    lines: lines.map((l) => ({ ...l, legs: l.legs.map((leg) => leg.map(shift)) })),
    others: net.others,
    legend,
    width: Math.ceil(maxX - minX),
    height: Math.ceil(maxY - minY),
  };
};

/**
 * Whether any two labels overlap, a label covers a station, or two
 * stations touch.
 */
export const labelsCollide = (map: TransitMap): boolean =>
  map.legend
    ? // Labels are in the legend: only stations can meet.
      map.stations.some((s, i) =>
        map.stations.some(
          (t, j) =>
            j > i && Math.hypot(s.x - t.x, s.y - t.y) < s.radius + t.radius + 6,
        ),
      )
    : map.stations.some((s, i) =>
    map.stations.some(
      (t, j) =>
        (j > i && overlaps(s.label, t.label)) ||
        (j > i &&
          Math.hypot(s.x - t.x, s.y - t.y) < s.radius + t.radius + 6) ||
        overlaps(s.label, {
          x: t.x - t.radius,
          y: t.y - t.radius,
          w: t.radius * 2,
          h: t.radius * 2,
        }),
    ),
  );

/** How many line segments run through labels. */
export const labelLineHits = (map: TransitMap): number =>
  map.legend
    ? 0
    : map.stations.reduce(
    (n, s) =>
      n +
      map.lines.reduce(
        (m, line) =>
          m +
          line.legs.reduce(
            (o, leg) =>
              o + leg.slice(1).filter((q, k) => segmentHitsBox(leg[k], q, s.label)).length,
            0,
          ),
        0,
      ),
    0,
  );

/**
 * The transit map: the grid search, then drawn, spread out (up to a few
 * times) until no label overlaps another or a station, and a little
 * more where that takes lines off labels.
 */
export const layoutTransitMap = (input: TransitInput): TransitMap => {
  const { orientation } = input;
  if (input.stops.length === 0) {
    return {
      orientation,
      stations: [],
      lines: [],
      others: [],
      legend: false,
      width: 0,
      height: 0,
    };
  }
  const net = networkOf(input);
  const st = searchGrid(net, orientation);
  const at = (k: number) =>
    drawAt(net, st, orientation, TRANSIT.cell * (1 + 0.2 * k));
  let k = 0;
  let map = at(0);
  for (k = 1; k <= 10 && labelsCollide(map); k++) map = at(k);
  // A little more room where that takes lines off labels.
  let best = { map, hits: labelLineHits(map) };
  for (let more = k; more < k + 3 && best.hits > 0; more++) {
    const wider = at(more);
    const hits = labelLineHits(wider);
    if (!labelsCollide(wider) && hits < best.hits * 0.6) best = { map: wider, hits };
  }
  return best.map;
};

/**
 * The share image's box for a transit map, over its legend (see
 * transitGeometry in backend/og/render.js; keep in step).
 */
export const TRANSIT_SHARE_BOX = {
  width: 984,
  height: 788,
  legendRow: 34,
  /** A legend map's column of station titles, and the gap before it. */
  stationList: 340,
};

/** How big a map draws in the share box: its scale, at most 1.6. */
/** Line legend columns under the map: three past six lines (render.js too). */
export const legendColumns = (lines: number): number => (lines > 6 ? 3 : 2);

export const shareScale = (map: TransitMap): number => {
  const rows =
    Math.ceil(map.lines.length / legendColumns(map.lines.length));
  const height = TRANSIT_SHARE_BOX.height - rows * TRANSIT_SHARE_BOX.legendRow - 12;
  // A legend map shares the width with its column of station titles.
  const width = map.legend
    ? TRANSIT_SHARE_BOX.width - TRANSIT_SHARE_BOX.stationList
    : TRANSIT_SHARE_BOX.width;
  return Math.min(width / map.width, height / map.height, 1.6);
};

/**
 * The transit map for the square share image: flowing down or flowing
 * right, whichever reads better, drawn at the grid size that fits the
 * square best (text never shrinks below its sizes, so 1:1 is the aim).
 * Labels go beside the stations only where they fit at full size with no
 * line through them; otherwise the stations are numbered and their
 * titles listed in a legend.
 */
export const shareTransitMap = (
  input: Omit<TransitInput, "orientation">,
  /**
   * Titles in a legend (true) or beside the stations (false); unset,
   * whichever fits.
   */
  legend?: boolean,
): TransitMap => {
  if (input.stops.length === 0) {
    return layoutTransitMap({ ...input, orientation: "vertical" });
  }
  // The way that reads better (the lower score) after a rough search;
  // only that one is refined.
  const net = networkOf(input);
  const orientation: TransitOrientation =
    roughGrid(net, "horizontal").cost < roughGrid(net, "vertical").cost
      ? "horizontal"
      : "vertical";
  // The grid size that draws biggest in the square with no labels
  // colliding, fewer labels on lines breaking near-ties.
  const fit = (
    legend: boolean,
    flow: TransitOrientation = orientation,
  ): TransitMap | null => {
    const st = searchGrid(net, flow);
    let best: { map: TransitMap; value: number } | null = null;
    for (let cell = 36; cell <= 150; cell += 6) {
      const map = drawAt(net, st, flow, cell, legend);
      if (labelsCollide(map)) continue;
      const value = Math.min(1, shareScale(map)) - 0.015 * labelLineHits(map);
      if (!best || value > best.value + 1e-6) best = { map, value };
    }
    return best?.map ?? null;
  };
  // Labels beside the stations when they fit at full size; otherwise
  // numbered stations and their titles in a legend, so the labels never
  // crowd the map or shrink it.
  const labelled = legend === true ? null : fit(false);
  if (
    labelled &&
    (legend === false ||
      (shareScale(labelled) >= 1 && labelLineHits(labelled) === 0))
  ) {
    return labelled;
  }
  // A legend takes a column of the width: whichever flow draws bigger
  // in what's left.
  const numbered = [fit(true), fit(true, orientation === "vertical" ? "horizontal" : "vertical")]
    .filter((m): m is TransitMap => m !== null)
    .sort((a, b) => shareScale(b) - shareScale(a))[0];
  return numbered ?? labelled ?? layoutTransitMap({ ...input, orientation });
};

/** Undated albums go after the rest. */
const UNDATED = 9999;

const stopFor = (
  key: string,
  title: string,
  artist: string,
  year: number | null,
  marked: boolean,
): TransitStop => ({
  key,
  title,
  // The year always shows: the artist is cut first.
  detail: year ? `${cut(artist, TRANSIT.chars - 7)} · ${year}` : artist,
  column: year ?? UNDATED,
  marked,
});

/**
 * One search's transit map: its album and the results chosen, by year;
 * its people who count under the filters as lines, through the album and
 * every chosen result they link.
 */
export const searchTransit = (
  search: SearchCache,
  shown: Pick<ScoredRelease, "key" | "title" | "artist" | "year" | "activeContributors">[],
  counted: Set<number>,
): Omit<TransitInput, "orientation"> => {
  const albumKey = albumKeyOf(search);
  const own = search.target ? search.releases[search.target.key] : undefined;
  const results = shown.filter((r) => r.key !== albumKey);
  const stops = [
    stopFor(
      albumKey,
      search.searchParams.album,
      search.searchParams.artist,
      releaseYear(own?.year),
      true,
    ),
    ...results.map((r) =>
      stopFor(r.key, r.title, r.artist, releaseYear(r.year), false),
    ),
  ];
  const people = Array.from(counted)
    .filter((id) => search.contributors[id])
    .map((id) => ({
      id,
      name: defaultContributorDisplayPipeline(search.contributors[id].name),
      stations: [
        albumKey,
        ...results
          .filter((r) => r.activeContributors.includes(id))
          .map((r) => r.key),
      ],
    }));
  return { stops, people };
};

/**
 * A stack's transit map: its albums (switched on) and the results chosen,
 * by year; people as lines through the stack albums they count on and the
 * chosen results they link.
 */
export const stackTransit = (
  members: SearchCache[],
  /** Stack album key -> people who count there (the stack's filters). */
  counted: Map<string, Set<number>>,
  shown: Pick<ScoredRelease, "key" | "title" | "artist" | "year" | "activeContributors">[],
): Omit<TransitInput, "orientation"> => {
  const keys = members.map(albumKeyOf);
  const known = new Map<string, EnrichedRelease>();
  for (const m of members) {
    for (const r of Object.values(m.releases ?? {})) {
      if (!known.has(r.key)) known.set(r.key, r);
    }
  }
  // A stack album's year: as its own search lists it, else any member's.
  const yearOf = (m: SearchCache, key: string) =>
    releaseYear(m.releases?.[key]?.year) ?? releaseYear(known.get(key)?.year);
  const seen = new Set<string>();
  const stops: TransitStop[] = [];
  members.forEach((m, i) => {
    if (seen.has(keys[i])) return;
    seen.add(keys[i]);
    stops.push(
      stopFor(
        keys[i],
        m.searchParams.album,
        m.searchParams.artist,
        yearOf(m, keys[i]),
        true,
      ),
    );
  });
  const results = shown.filter((r) => !seen.has(r.key));
  stops.push(
    ...results.map((r) =>
      stopFor(r.key, r.title, r.artist, releaseYear(r.year), false),
    ),
  );
  const names = new Map<number, string>();
  members.forEach((m, i) => {
    for (const id of counted.get(keys[i]) ?? []) {
      const c = m.contributors?.[id];
      if (c && !names.has(id)) {
        names.set(id, defaultContributorDisplayPipeline(c.name));
      }
    }
  });
  const people = Array.from(names, ([id, name]) => ({
    id,
    name,
    stations: [
      ...keys.filter((key) => counted.get(key)?.has(id)),
      ...results
        .filter((r) => r.activeContributors.includes(id))
        .map((r) => r.key),
    ],
  }));
  return { stops, people };
};

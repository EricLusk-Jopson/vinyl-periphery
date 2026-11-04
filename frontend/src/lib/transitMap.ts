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
 * Lines sharing a leg run side by side, in a fixed order by person id.
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
};

export interface TransitStation {
  key: string;
  title: string;
  artist: string;
  /** Its place in time among the stations (by `TransitStop.column`). */
  step: number;
  /** The searched album, or one of the stack's. */
  marked: boolean;
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
  /** Colour slot, 0 to TRANSIT_LINES - 1. */
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
  const lines = onStations.slice(0, TRANSIT_LINES);
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
    others: onStations.slice(TRANSIT_LINES).map((p) => ({
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
  cost +=
    SCORE.area *
    (Math.max(...xs) - Math.min(...xs) + 2) *
    (Math.max(...ys) - Math.min(...ys) + 2);
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

/** The grid layout drawn at `cell` pixels a step, with its labels. */
const drawAt = (
  net: Network,
  st: GridState,
  flow: TransitOrientation,
  cell: number,
  /** Label boxes this much larger (text drawn bigger than the map scale). */
  grow: number,
): TransitMap => {
  const px = (p: Point): Point => ({ x: p.x * cell, y: p.y * cell });
  const points = st.at.map(px);
  // Lines sharing a leg, by person id: their slot side by side.
  const bundles = net.legs.map((_, leg) =>
    net.runs
      .map((runs, l) => (runs.some((r) => r.leg === leg) ? net.lines[l].id : -1))
      .filter((id) => id >= 0)
      .sort((a, b) => a - b),
  );
  const spreadAt = new Map<number, number>();
  const lines: TransitLine[] = net.lines.map((line, colour) => ({
    id: line.id,
    name: line.name,
    colour,
    stations: line.stations,
    legs: net.runs[colour].map(({ leg, forward }) => {
      const bundle = bundles[leg];
      const slot = bundle.indexOf(line.id) - (bundle.length - 1) / 2;
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
    on.length >= 2
      ? Math.max(TRANSIT.station + 3, (spreadAt.get(i) ?? 0) + 7)
      : TRANSIT.station,
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
    const size = labelSize(net.stations[i].title, net.stations[i].artist);
    const w = size.w * grow;
    const h = size.h * grow;
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
      marked: s.marked,
      ...shift(points[i]),
      lines: through[i],
      radius: radius[i],
      label: { ...labels[i], ...shift(labels[i]) },
    })),
    lines: lines.map((l) => ({ ...l, legs: l.legs.map((leg) => leg.map(shift)) })),
    others: net.others,
    width: Math.ceil(maxX - minX),
    height: Math.ceil(maxY - minY),
  };
};

/**
 * Whether any two labels overlap, a label covers a station, or two
 * stations touch.
 */
export const labelsCollide = (map: TransitMap): boolean =>
  map.stations.some((s, i) =>
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
  map.stations.reduce(
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
    return { orientation, stations: [], lines: [], others: [], width: 0, height: 0 };
  }
  const net = networkOf(input);
  const st = searchGrid(net, orientation);
  const at = (k: number) =>
    drawAt(net, st, orientation, TRANSIT.cell * (1 + 0.2 * k), 1);
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
export const TRANSIT_SHARE_BOX = { width: 984, height: 788, legendRow: 34 };

/** How big a map draws in the share box: its scale, at most 1.6. */
export const shareScale = (map: TransitMap): number => {
  const rows =
    Math.ceil(map.lines.length / 2) + (map.others.length > 0 ? 1 : 0);
  const height = TRANSIT_SHARE_BOX.height - rows * TRANSIT_SHARE_BOX.legendRow - 12;
  return Math.min(
    TRANSIT_SHARE_BOX.width / map.width,
    height / map.height,
    1.6,
  );
};

/**
 * The transit map for the square share image: flowing down or flowing
 * right, whichever reads better, drawn at the grid size that fits the
 * square best (text never shrinks below its sizes, so 1:1 is the aim).
 */
export const shareTransitMap = (
  input: Omit<TransitInput, "orientation">,
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
  const st = searchGrid(net, orientation);
  const fit = (grow: number): TransitMap | null => {
    let best: { map: TransitMap; value: number } | null = null;
    for (let cell = 36; cell <= 150; cell += 6) {
      const map = drawAt(net, st, orientation, cell, grow);
      if (labelsCollide(map)) continue;
      const value = Math.min(1, shareScale(map)) - 0.015 * labelLineHits(map);
      if (!best || value > best.value + 1e-6) best = { map, value };
    }
    return best?.map ?? null;
  };
  // (Sizing label boxes for text drawn below 1:1 spreads the map, which
  // shrinks it further: the fit alone, with a little room in the boxes'
  // padding, does better.)
  return fit(1) ?? layoutTransitMap({ ...input, orientation });
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

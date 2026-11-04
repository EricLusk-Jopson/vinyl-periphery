import { MetaAlbum } from "./metaAlbum";

/**
 * A stack as a transit map: its albums are stations, and the people
 * credited on two or more of them are lines running through them in step
 * order. Interchanges (stations on 2+ lines) are drawn larger.
 *
 * An MVP layout, not a general octilinear solver:
 * - a station's place along the map is its step from the start
 *   (`stackLayout`), and across, its order within the step (each step
 *   ordered by where the stations it shares lines with sit in the step
 *   before, to cut crossings);
 * - each line runs station to station in step order with 0/45/90° legs;
 *   a leg that would run over another station (a line skipping an album)
 *   bends around it instead, each line at its own distance and side, so
 *   it never seems to stop where it doesn't;
 * - lines sharing a leg run side by side, in a fixed order by person id;
 * - each label takes the first spot around its station that overlaps no
 *   other label or station (then the fewest lines). If any label still
 *   overlaps, the map spreads out and tries again.
 *
 * Horizontal (steps left to right) for wide screens and the share image,
 * vertical (steps top to bottom) for phones. Pure and deterministic.
 */

/** Lines drawn; the rest are listed under the map. */
export const TRANSIT_LINES = 6;

export type TransitOrientation = "horizontal" | "vertical";

/** Spacing in layout units (pixels at 1:1) and label type sizes. */
export const TRANSIT = {
  horizontal: { step: 230, across: 120 },
  vertical: { step: 150, across: 140 },
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
  searchId: string;
  step: number;
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
  /** Station indices in step order. */
  stations: number[];
  /**
   * The drawn legs, station to station, each offset for the lines sharing
   * it. Legs meet under the stations, which cover the lines side by side.
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

/**
 * An octilinear route from a to b: straight, or a straight run, one 45°
 * leg and another straight run, along the main direction (`along`).
 */
export const octilinear = (
  a: Point,
  b: Point,
  orientation: TransitOrientation,
): Point[] => {
  const main = orientation === "horizontal" ? "x" : "y";
  const side = main === "x" ? "y" : "x";
  const d = b[main] - a[main];
  const s = b[side] - a[side];
  const at = (m: number, n: number): Point =>
    main === "x" ? { x: m, y: n } : { x: n, y: m };
  if (d === 0 || s === 0) return [a, b];
  const along = Math.abs(d);
  const across = Math.abs(s);
  const dm = Math.sign(d);
  const ds = Math.sign(s);
  const points =
    across <= along
      ? [
          a,
          at(a[main] + (dm * (along - across)) / 2, a[side]),
          at(b[main] - (dm * (along - across)) / 2, b[side]),
          b,
        ]
      : [
          a,
          at(a[main], a[side] + (ds * (across - along)) / 2),
          at(b[main], b[side] - (ds * (across - along)) / 2),
          b,
        ];
  return points.filter(
    (p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y,
  );
};

/**
 * A route from a to b that leaves a at 45° for a rail `far` to one side
 * (`side`: -1 or 1) of them both, runs along it, and comes back at 45°:
 * how a line passes stations it doesn't stop at. Null when a and b are
 * too close along for that.
 */
export const bypass = (
  a: Point,
  b: Point,
  side: number,
  far: number,
  orientation: TransitOrientation,
): Point[] | null => {
  const main = orientation === "horizontal" ? "x" : "y";
  const cross = main === "x" ? "y" : "x";
  const at = (m: number, n: number): Point =>
    main === "x" ? { x: m, y: n } : { x: n, y: m };
  const rail =
    side < 0
      ? Math.min(a[cross], b[cross]) - far
      : Math.max(a[cross], b[cross]) + far;
  const up = Math.abs(rail - a[cross]);
  const down = Math.abs(rail - b[cross]);
  const along = b[main] - a[main];
  const dir = Math.sign(along) || 1;
  if (up + down > Math.abs(along)) return null;
  return [
    a,
    at(a[main] + dir * up, rail),
    at(b[main] - dir * down, rail),
    b,
  ].filter(
    (p, i, all) => i === 0 || p.x !== all[i - 1].x || p.y !== all[i - 1].y,
  );
};

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

export interface TransitInput {
  /** Spacing other than the orientation's usual (`TRANSIT`). */
  space?: { step: number; across: number };
  meta: MetaAlbum;
  /** Member search id -> step (`stackLayout`). */
  levels: Map<string, number>;
  /** Album key -> people who count there (the stack's filters). */
  counted: Map<string, Set<number>>;
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

const layoutAt = (input: TransitInput, spread: number): TransitMap => {
  const { meta, levels, counted, orientation } = input;
  const space = input.space ?? TRANSIT[orientation];
  // Stations: the stack's albums, by step.
  const stations = meta.members.map((m) => ({
    key: m.key,
    title: m.title,
    artist: m.artist,
    searchId: m.search.searchId,
    step: levels.get(m.search.searchId) ?? 0,
    savedAt: m.search.savedAt ?? 0,
  }));
  // Lines: people counted on 2+ stations.
  const onStations = meta.people
    .map((p) => ({
      id: p.id,
      name: p.name,
      stations: stations
        .map((s, i) => (counted.get(s.key)?.has(p.id) ? i : -1))
        .filter((i) => i >= 0),
    }))
    .filter((p) => p.stations.length >= 2)
    .sort(
      (a, b) =>
        b.stations.length - a.stations.length ||
        a.name.localeCompare(b.name) ||
        a.id - b.id,
    );
  const drawn = onStations.slice(0, TRANSIT_LINES);

  // Order within each step: the first by when it was searched; later ones
  // by the mean place of the stations they share lines with a step back.
  const steps = Array.from(new Set(stations.map((s) => s.step))).sort(
    (a, b) => a - b,
  );
  const row = new Map<number, number>();
  for (const step of steps) {
    const here = stations
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.step === step);
    const before = (i: number) => {
      const near = drawn
        .filter((l) => l.stations.includes(i))
        .flatMap((l) => l.stations)
        .filter((j) => stations[j].step < step && row.has(j))
        .map((j) => row.get(j)!);
      return near.length ? near.reduce((a, b) => a + b, 0) / near.length : null;
    };
    here
      .map(({ s, i }) => ({ s, i, mean: before(i) }))
      .sort(
        (a, b) =>
          (a.mean ?? Infinity) - (b.mean ?? Infinity) ||
          a.s.savedAt - b.s.savedAt ||
          a.s.key.localeCompare(b.s.key),
      )
      .forEach(({ i }, k, all) => row.set(i, k - (all.length - 1) / 2));
  }
  const place = (i: number): Point => {
    const m = stations[i].step * space.step * spread;
    const n = row.get(i)! * space.across * spread;
    return orientation === "horizontal" ? { x: m, y: n } : { x: n, y: m };
  };
  const points = stations.map((_, i) => place(i));

  // Legs: consecutive stations on each line, in step order then across.
  const legs = drawn.map((line) => {
    const order = [...line.stations].sort(
      (a, b) =>
        stations[a].step - stations[b].step || row.get(a)! - row.get(b)!,
    );
    return { line, order };
  });
  // Whether a route runs over a station other than its ends.
  const clear = TRANSIT.station + TRANSIT.gap + 6;
  const hitsStation = (route: Point[], ends: number[]) =>
    points.some(
      (c, i) =>
        !ends.includes(i) &&
        route.slice(1).some((q, k) => {
          const p = route[k];
          for (let t = 0; t <= 1; t += 0.05) {
            const x = p.x + (q.x - p.x) * t;
            const y = p.y + (q.y - p.y) * t;
            if (Math.hypot(x - c.x, y - c.y) < clear) return true;
          }
          return false;
        }),
    );
  // Each leg's route: straight (octilinear), or bent around a station in
  // the way: through a point beside the middle of the leg, the line's own
  // distance and side, further out until it's clear.
  const routeOf = (from: number, to: number, nth: number) => {
    const direct = octilinear(points[from], points[to], orientation);
    if (!hitsStation(direct, [from, to])) return { route: direct, bent: false };
    const a = points[from];
    const b = points[to];
    const side = nth % 2 === 0 ? -1 : 1;
    for (let tries = 0; tries < 8; tries++) {
      const far = space.across * spread * (0.32 + 0.14 * (Math.floor(nth / 2) + tries));
      for (const s of [side, -side]) {
        const route = bypass(a, b, s, far, orientation);
        if (route && !hitsStation(route, [from, to])) {
          return { route, bent: true };
        }
      }
    }
    return { route: direct, bent: false };
  };
  const routed = legs.map(({ line, order }, nth) => ({
    line,
    order,
    legs: order.slice(1).map((to, k) => ({
      id: `${order[k]}-${to}`,
      ...routeOf(order[k], to, nth),
    })),
  }));
  // Lines sharing a straight leg, by person id: their slot side by side.
  const bundles = new Map<string, number[]>();
  for (const { line, legs: ls } of routed) {
    for (const leg of ls) {
      if (leg.bent) continue;
      bundles.set(
        leg.id,
        [...(bundles.get(leg.id) ?? []), line.id].sort((a, b) => a - b),
      );
    }
  }
  // How far each station's lines spread either side of it.
  const spreadAt = new Map<number, number>();
  const lines: TransitLine[] = routed.map(({ line, order, legs: ls }, colour) => {
    const routes: Point[][] = ls.map((leg) => {
      const bundle = leg.bent ? [line.id] : bundles.get(leg.id)!;
      const slot = bundle.indexOf(line.id) - (bundle.length - 1) / 2;
      for (const end of leg.id.split("-").map(Number)) {
        spreadAt.set(
          end,
          Math.max(spreadAt.get(end) ?? 0, Math.abs(slot) * TRANSIT.gap),
        );
      }
      return offsetPath(leg.route, slot * TRANSIT.gap);
    });
    return {
      id: line.id,
      name: line.name,
      colour,
      stations: order,
      legs: routes.map((leg) =>
        leg.map((p) => ({
          x: Math.round(p.x * 10) / 10,
          y: Math.round(p.y * 10) / 10,
        })),
      ),
    };
  });

  const through = stations.map((_, i) =>
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

  // Labels, the start first, then in step order.
  const order = stations
    .map((_, i) => i)
    .sort(
      (a, b) =>
        stations[a].step - stations[b].step || row.get(a)! - row.get(b)!,
    );
  const placed: Array<TransitLabel | undefined> = [];
  for (const i of order) {
    const { w, h } = labelSize(stations[i].title, stations[i].artist);
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
        title: cut(stations[i].title),
        artist: cut(stations[i].artist),
      };
      const hitsLabel = placed.some((l) => l && overlaps(l, box, TRANSIT.pad));
      const hitsStation = dots.some((d) => overlaps(d, box, TRANSIT.pad));
      const crossings = lines.reduce(
        (n, l) =>
          n +
          l.legs.reduce(
            (m, leg) =>
              m +
              leg.slice(1).filter((q, k) => segmentHitsBox(leg[k], q, box))
                .length,
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
    ...lines.flatMap((l) =>
      l.legs.flat().map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 })),
    ),
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
    orientation,
    stations: stations.map((s, i) => ({
      key: s.key,
      title: s.title,
      artist: s.artist,
      searchId: s.searchId,
      step: s.step,
      ...shift(points[i]),
      lines: through[i],
      radius: radius[i],
      label: { ...labels[i], ...shift(labels[i]) },
    })),
    lines: lines.map((l) => ({
      ...l,
      legs: l.legs.map((leg) => leg.map(shift)),
    })),
    others: onStations.slice(TRANSIT_LINES).map((p) => ({
      id: p.id,
      name: p.name,
      stations: p.stations.length,
    })),
    width: Math.ceil(maxX - minX),
    height: Math.ceil(maxY - minY),
  };
};

/** Whether any two labels overlap, or a label covers a station. */
export const labelsCollide = (map: TransitMap): boolean =>
  map.stations.some((s, i) =>
    map.stations.some(
      (t, j) =>
        (j > i && overlaps(s.label, t.label)) ||
        overlaps(s.label, {
          x: t.x - t.radius,
          y: t.y - t.radius,
          w: t.radius * 2,
          h: t.radius * 2,
        }),
    ),
  );

/**
 * The transit map for a stack: laid out, and spread out (up to a few
 * times) until no label overlaps another or a station.
 */
export const layoutTransitMap = (input: TransitInput): TransitMap => {
  let map = layoutAt(input, 1);
  for (let k = 1; k <= 6 && labelsCollide(map); k++) {
    map = layoutAt(input, 1 + 0.25 * k);
  }
  return map;
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
 * The transit map for the square share image: both orientations at a few
 * spacings, keeping the one that draws biggest with no labels overlapping
 * (so its 12px text, at that scale, stays inside its boxes).
 */
export const shareTransitMap = (
  input: Omit<TransitInput, "orientation" | "space">,
): TransitMap => {
  let best: { map: TransitMap; scale: number } | null = null;
  for (const orientation of ["horizontal", "vertical"] as const) {
    for (const tight of [1, 0.8, 0.65, 0.5]) {
      const base = TRANSIT[orientation];
      const map = layoutTransitMap({
        ...input,
        orientation,
        space: { step: base.step * tight, across: base.across },
      });
      if (labelsCollide(map)) continue;
      const scale = shareScale(map);
      if (!best || scale > best.scale + 0.01) best = { map, scale };
    }
  }
  return best?.map ?? layoutTransitMap({ ...input, orientation: "horizontal" });
};

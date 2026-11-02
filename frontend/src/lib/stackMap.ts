import { EnrichedRelease } from "@/api/types";
import { SearchCache } from "@/contexts/cache/types";
import { Likes } from "@/services/likes";
import { mergedRelease, metaAlbum } from "./metaAlbum";
import { popularity, ScoredRelease, SortKey, sortReleases } from "./results";

/**
 * The share map for a stack: a graph of album overlap, not of people.
 *
 * - The stack's albums form a ring: the corners of a regular polygon
 *   with sides one step long (two albums make a line, three a triangle,
 *   four a square...). The start is at the top; the rest follow
 *   clockwise in the order the stack was walked, so each album sits
 *   beside the one it came from where it can.
 * - Results go around them by what they link (polar placement). A
 *   result's angle is the weighted mean of its stack albums' angles
 *   (weights: people shared); its distance from the middle says how many
 *   it links. One: outside the ring, beyond that album, in its wedge.
 *   Several: inside, nearer the middle the more it links; all of them
 *   (or an even balance), the middle itself. So a result's place says
 *   what it links, and its lines stay short.
 * - Covers grow with popularity and a like; the stack's own albums are
 *   bigger. Overlapping covers are pushed apart, and kept far enough from
 *   the albums they link that every line shows; the stack's albums stay
 *   put. Pure, so it can be tested and sent to the renderer as positions.
 */

/** Cover sides, in step lengths. */
export const STACK_SIZES = {
  centre: 0.5,
  member: 0.4,
  smallest: 0.2,
  popular: 0.1,
  liked: 0.06,
};
/** Room between covers, in step lengths. */
const GAP = 0.06;
/** How far beyond the ring results linked to one stack album sit. */
export const OUT = 0.62;
/** Room between rows of those results, when one row doesn't hold them. */
const ROW = 0.34;
/**
 * The shortest visible line between a result and an album it links (cover
 * edge to cover edge), in step lengths.
 */
export const MIN_LINK = 0.1;
/**
 * The smallest result cover a share image may draw, in pixels at 1080. The
 * sheet offers no more results than fit above it (`stackMapCapacity`).
 */
export const COVER_FLOOR = 64;
/**
 * The renderer's box for a stack map (backend/og/render.js: mapBox with a
 * one-line caption, STACK_FIT), in pixels. Keep in step with it.
 */
export const STACK_CANVAS = {
  width: 1080,
  height: 788,
  edge: 32,
  maxStep: 420,
};

export interface StackNode {
  key: string;
  title: string;
  artist: string;
  x: number;
  y: number;
  side: number;
  /** One of the stack's own albums (the centre is index 0). */
  member: boolean;
  /**
   * Nodes it's drawn linked to: a member's linked stack albums placed
   * before it; a result's stack albums.
   */
  links: number[];
  /** A result's people shared with each of `links`, in the same order. */
  weights?: number[];
}

export interface StackCentre {
  key: string;
  title: string;
  artist: string;
}

/** Albums linked when one has the other among its results. */
const linked = (
  a: SearchCache | undefined,
  aKey: string,
  b: SearchCache | undefined,
  bKey: string,
) => Boolean(a?.releases?.[bKey] || b?.releases?.[aKey]);

/** Each member's place: steps out from the middle, branches in wedges. */
const placeMembers = (
  centre: StackCentre,
  members: SearchCache[],
  levels: Map<string, number>,
) => {
  const centreSearch = members.find((m) => m.target?.key === centre.key);
  const others = members
    .filter((m) => m.target?.key && m.target.key !== centre.key)
    .map((m) => ({
      search: m,
      key: m.target!.key,
      level: Math.max(1, levels.get(m.searchId) ?? 1),
    }))
    // Shallow first, then oldest, so parents are placed before children.
    .sort(
      (a, b) =>
        a.level - b.level ||
        (a.search.savedAt ?? 0) - (b.search.savedAt ?? 0) ||
        a.key.localeCompare(b.key),
    );
  // Dedupe repeat runs of the same album.
  const seen = new Set([centre.key]);
  const nodes = others.filter((n) => !seen.has(n.key) && seen.add(n.key));

  type TreeNode = {
    key: string;
    search?: SearchCache;
    level: number;
    children: TreeNode[];
    parent?: TreeNode;
  };
  const root: TreeNode = {
    key: centre.key,
    search: centreSearch,
    level: 0,
    children: [],
  };
  const all: TreeNode[] = [root];
  for (const n of nodes) {
    const above = all.filter((t) => t.level === n.level - 1);
    const parent =
      above.find((t) => linked(t.search, t.key, n.search, n.key)) ??
      above[0] ??
      root;
    const node: TreeNode = {
      key: n.key,
      search: n.search,
      level: parent.level + 1,
      children: [],
      parent,
    };
    parent.children.push(node);
    all.push(node);
  }

  // A ring: the stack's albums at the corners of a regular polygon with
  // sides one step long (two make a line, three a triangle...), the start
  // at the top and the rest clockwise in the order the stack was walked,
  // so an album sits beside the one it came from where it can.
  const ring: TreeNode[] = [];
  const walk = (t: TreeNode) => {
    ring.push(t);
    t.children.forEach(walk);
  };
  walk(root);
  const n = ring.length;
  const radius = n > 1 ? 1 / (2 * Math.sin(Math.PI / n)) : 0;
  const at = new Map<TreeNode, { x: number; y: number }>(
    ring.map((t, k) => {
      const a = Math.PI / 2 - (2 * Math.PI * k) / n;
      return [t, { x: radius * Math.cos(a), y: radius * Math.sin(a) }];
    }),
  );
  return {
    radius,
    nodes: all.map((t, i) => ({
      key: t.key,
      search: t.search,
      ...at.get(t)!,
      parent: t.parent ? all.indexOf(t.parent) : -1,
      // Every stack album placed before it that it's linked to.
      linked: all
        .slice(0, i)
        .map((u, j) => (linked(u.search, u.key, t.search, t.key) ? j : -1))
        .filter((j) => j >= 0),
    })),
  };
};

type Box = {
  x: number;
  y: number;
  side: number;
  fixed: boolean;
  /** Boxes it's drawn linked to: kept at least MIN_LINK of line apart. */
  links?: number[];
};

/**
 * How much of the line between two covers' middles shows outside both
 * (square covers, the line clipped at each edge).
 */
export const visibleLink = (
  a: { x: number; y: number; side: number },
  b: { x: number; y: number; side: number },
): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d === 0) return -(a.side + b.side) / 2;
  const across = Math.max(Math.abs(dx), Math.abs(dy)) / d;
  return d - (a.side / 2 + b.side / 2) / across;
};

/**
 * Pushes overlapping covers apart, pulling the free ones back toward
 * their places; fixed ones (the stack's albums) never move. Linked covers
 * are kept at least MIN_LINK of line apart. Ends with steps that only
 * push, along the line between covers, until nothing overlaps.
 */
export const relaxGraph = (
  ideal: Box[],
  iterations = 160,
  settle = 160,
  { gap = GAP, minLink = MIN_LINK } = {},
): Array<{ x: number; y: number }> => {
  const points = ideal.map((p) => ({ ...p }));
  const move = (p: Box, dx: number, dy: number) => {
    if (p.fixed) return;
    p.x += dx;
    p.y += dy;
  };
  const separate = (settling: boolean) => {
    let moved = false;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i];
        const b = points[j];
        if (a.fixed && b.fixed) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const reach = (a.side + b.side) / 2 + gap;
        const overlapX = reach - Math.abs(dx);
        const overlapY = reach - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        moved = true;
        if (dx === 0 && dy === 0) {
          dx = Math.cos(j * 2.399963);
          dy = Math.sin(j * 2.399963);
        }
        const shareA = a.fixed ? 0 : b.fixed ? 2 : 1;
        const shareB = b.fixed ? 0 : a.fixed ? 2 : 1;
        const push = Math.min(overlapX, overlapY) / 2;
        if (settling) {
          const length = Math.hypot(dx, dy);
          const step = push + 0.002;
          move(
            a,
            (-dx / length) * step * shareA,
            (-dy / length) * step * shareA,
          );
          move(b, (dx / length) * step * shareB, (dy / length) * step * shareB);
        } else if (overlapX < overlapY) {
          const sign = Math.sign(dx) || 1;
          move(a, -sign * push * shareA, 0);
          move(b, sign * push * shareB, 0);
        } else {
          const sign = Math.sign(dy) || 1;
          move(a, 0, -sign * push * shareA);
          move(b, 0, sign * push * shareB);
        }
      }
    }
    // Every line long enough to see: a free cover moves away from the
    // fixed one it links (or both move, when neither is fixed).
    points.forEach((p, i) => {
      for (const k of p.links ?? []) {
        const q = points[k];
        if (!q || (p.fixed && q.fixed)) continue;
        const short = minLink - visibleLink(p, q);
        if (short <= 0) continue;
        moved = true;
        let dx = p.x - q.x;
        let dy = p.y - q.y;
        if (dx === 0 && dy === 0) {
          dx = Math.cos(i * 2.399963);
          dy = Math.sin(i * 2.399963);
        }
        const length = Math.hypot(dx, dy);
        const step = short + 0.002;
        const shareP = p.fixed ? 0 : q.fixed ? 1 : 0.5;
        const shareQ = q.fixed ? 0 : p.fixed ? 1 : 0.5;
        move(p, (dx / length) * step * shareP, (dy / length) * step * shareP);
        move(q, (-dx / length) * step * shareQ, (-dy / length) * step * shareQ);
      }
    });
    return moved;
  };
  for (let step = 0; step < iterations + settle; step++) {
    const settling = step >= iterations;
    const moved = separate(settling);
    if (!settling) {
      points.forEach((p, i) => {
        if (p.fixed) return;
        p.x += (ideal[i].x - p.x) * 0.02;
        p.y += (ideal[i].y - p.y) * 0.02;
      });
    } else if (!moved) {
      break;
    }
  }
  // Anything still crowded (wedged between covers it can't push past)
  // moves to the nearest free spot, in order, against those already done.
  const ok = (i: number) => {
    const p = points[i];
    return points.every((q, j) => {
      if (j === i || (j > i && !q.fixed)) return true;
      const reach = (p.side + q.side) / 2 + gap * 0.5;
      const clear =
        Math.abs(p.x - q.x) >= reach || Math.abs(p.y - q.y) >= reach;
      const linkedTo = p.links?.includes(j) || q.links?.includes(i);
      return clear && (!linkedTo || visibleLink(p, q) >= minLink);
    });
  };
  points.forEach((p, i) => {
    if (p.fixed || ok(i)) return;
    const { x, y } = p;
    const ring = Math.max(p.side / 4, 0.02);
    for (let k = 1; k < 4000; k++) {
      // A spiral out from where it is.
      const d = ring * Math.sqrt(k);
      const a = k * 2.399963;
      p.x = x + d * Math.cos(a);
      p.y = y + d * Math.sin(a);
      if (ok(i)) return;
    }
    p.x = x;
    p.y = y;
  });
  return points.map(({ x, y }) => ({ x, y }));
};

/**
 * A stack map fitted to the share image: pixels a step (as the renderer
 * scales it, up to `maxStep`), and the smallest result cover in pixels.
 */
export const fitToCanvas = (
  nodes: Array<{ x: number; y: number; side: number; member?: boolean }>,
  canvas = STACK_CANVAS,
): { step: number; smallest: number } => {
  if (nodes.length === 0) return { step: canvas.maxStep, smallest: Infinity };
  const minX = Math.min(...nodes.map((n) => n.x - n.side / 2));
  const maxX = Math.max(...nodes.map((n) => n.x + n.side / 2));
  const minY = Math.min(...nodes.map((n) => n.y - n.side / 2));
  const maxY = Math.max(...nodes.map((n) => n.y + n.side / 2));
  const step = Math.min(
    canvas.maxStep,
    (canvas.width - 2 * canvas.edge) / Math.max(maxX - minX, 0.01),
    (canvas.height - 2 * canvas.edge) / Math.max(maxY - minY, 0.01),
  );
  const results = nodes.filter((n) => !n.member);
  const smallest = results.length
    ? Math.min(...results.map((n) => n.side)) * step
    : Infinity;
  return { step, smallest };
};

/**
 * Every result of the stack's searches, the stack's own albums aside, once
 * each: linked by everyone in the stack who worked on it, scored by how
 * many people it shares with each stack album added up. Most connected
 * first (then linked to the most stack albums, then most popular). No
 * filters: the Results tab's are `filteredStackResults`.
 */
export const stackResults = (
  centre: StackCentre,
  members: SearchCache[],
): ScoredRelease[] => {
  const meta = metaAlbum(members);
  return Array.from(meta.results.values())
    .filter((r) => r.release.key !== centre.key)
    .map((r) => ({
      result: r,
      total: r.links.reduce((sum, l) => sum + l.people.length, 0),
    }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.result.links.length - a.result.links.length ||
        (popularity(b.result.release) ?? -1) -
          (popularity(a.result.release) ?? -1) ||
        a.result.release.key.localeCompare(b.result.release.key),
    )
    .map(({ result, total }) => {
      const release = mergedRelease(result);
      return {
        ...release,
        activeContributors: release.contributorIds,
        score: total,
        confidence: 1,
      };
    });
};

/**
 * The stack's results in the chosen order; with `likesFirst`, liked
 * albums come before the rest (each part keeping that order).
 */
export const orderStackResults = (
  results: ScoredRelease[],
  sort: SortKey,
  then: SortKey | null,
  likes: Likes,
  likesFirst: boolean,
): ScoredRelease[] => {
  const sorted = sortReleases(results, sort, then);
  if (!likesFirst) return sorted;
  return [
    ...sorted.filter((r) => likes[r.key]),
    ...sorted.filter((r) => !likes[r.key]),
  ];
};

/**
 * The stack's results as one search, for finding albums to add: every
 * result, and everyone credited on any stack album.
 */
export const stackAsSearch = (
  base: SearchCache,
  members: SearchCache[],
  results: ScoredRelease[],
): SearchCache => ({
  ...base,
  contributors: Object.assign({}, ...members.map((m) => m.contributors ?? {})),
  releases: Object.fromEntries(results.map((r) => [r.key, r])),
});

const sharedCount = (release: EnrichedRelease | undefined) =>
  release ? new Set(release.contributorIds).size : 0;

/** A result to place: its cover side and its weight toward each album. */
interface ToPlace {
  side: number;
  /** Stack album index -> people shared. */
  weights: Map<number, number>;
}

/**
 * Where each result starts, before relaxing (polar placement around the
 * ring's middle, which is the origin; see the top of this file).
 */
export const placeResults = (
  members: Array<{ x: number; y: number }>,
  radius: number,
  results: ToPlace[],
  /** Covers' size against the ring: sides and the room around them. */
  scale = 1,
): Array<{ x: number; y: number }> => {
  const n = members.length;
  const angleOf = (m: { x: number; y: number }) =>
    Math.hypot(m.x, m.y) < 1e-9 ? -Math.PI / 2 : Math.atan2(m.y, m.x);
  const angles = members.map(angleOf);
  // Half the room each album has around the ring for its own results.
  const wedge =
    n >= 3 ? (Math.PI / n) * 0.9 : n === 2 ? Math.PI * 0.45 : Math.PI;
  const largest = Math.max(0, ...results.map((r) => r.side));
  const spacing = largest + GAP * scale;
  // Beyond the ring: clear of the album's cover, with a line showing.
  const out = Math.max(
    OUT,
    (STACK_SIZES.centre * scale) / 2 + largest / 2 + 2 * MIN_LINK * scale,
  );
  const rowGap = Math.max(ROW, spacing);

  // Results linked to one album: rows outside the ring beyond it, filling
  // from straight out, then either side, then the next row out.
  const filled = new Map<number, number>();
  const outside = (index: number) => {
    let k = filled.get(index) ?? 0;
    filled.set(index, k + 1);
    for (let row = 0; ; row++) {
      const r = radius + out + row * rowGap;
      const each = Math.max(1, Math.floor((2 * wedge * r) / spacing) + 1);
      const slots =
        n === 1 ? Math.max(1, Math.floor((2 * Math.PI * r) / spacing)) : each;
      if (k >= slots) {
        k -= slots;
        continue;
      }
      // 0, +1, -1, +2, -2... slots from straight out.
      const offset = (k % 2 === 0 ? -1 : 1) * Math.ceil(k / 2);
      const turn = n === 1 ? (2 * Math.PI * k) / slots : (offset * spacing) / r;
      const a = angles[index] + turn;
      return { x: r * Math.cos(a), y: r * Math.sin(a) };
    }
  };

  // Results linking several: inside, by the weighted mean direction of
  // their albums, nearer the middle the more albums they link. Ones
  // linking the same albums spread side by side.
  const groups = new Map<string, number>();
  return results.map((result, i) => {
    const linked = Array.from(result.weights.keys());
    if (linked.length === 1) return outside(linked[0]);
    if (linked.length === 0) return { x: 0, y: 0 };
    let vx = 0;
    let vy = 0;
    let total = 0;
    result.weights.forEach((w, index) => {
      const weight = Math.max(w, 1);
      vx += Math.cos(angles[index]) * weight;
      vy += Math.sin(angles[index]) * weight;
      total += weight;
    });
    const pull = Math.hypot(vx, vy) / total;
    const share = n > 2 ? (n - linked.length) / (n - 2) : 0;
    const r = radius * 0.72 * share;
    const group = linked.sort((a, b) => a - b).join(",");
    const k = groups.get(group) ?? 0;
    groups.set(group, k + 1);
    // Balanced across them all: the middle, spread on a spiral.
    if (r < 1e-9 || pull < 0.15) {
      const spot = groups.size * 7 + k;
      const d = spacing * 0.6 * Math.sqrt(spot % 40);
      const a = spot * 2.399963 + i * 0.001;
      return { x: d * Math.cos(a), y: d * Math.sin(a) };
    }
    const a = Math.atan2(vy, vx);
    // Side by side along the arc: 0, +1, -1...
    const offset = (k % 2 === 0 ? -1 : 1) * Math.ceil(k / 2);
    const along = (offset * spacing) / Math.max(r, spacing);
    return { x: r * Math.cos(a + along), y: r * Math.sin(a + along) };
  });
};

/** Recent layouts by their inputs: the share sheet asks again often. */
const layouts = new Map<string, StackNode[]>();
const LAYOUTS_KEPT = 16;

/**
 * The stack's albums, and the results in `shown` around them. The same
 * input always gives the same layout (and repeats come from a cache).
 */
export const layoutStackMap = (
  centre: StackCentre,
  members: SearchCache[],
  levels: Map<string, number>,
  likes: Likes,
  /** The results to draw, by key (see `stackResults`). */
  shown: string[],
): StackNode[] => {
  const signature = JSON.stringify([
    centre,
    members.map((m) => [
      m.searchId,
      m.target?.key,
      m.savedAt,
      m.searchParams,
      Object.keys(m.releases ?? {}).length,
    ]),
    Array.from(levels),
    shown.map((key) => (likes[key] ? `${key}*` : key)),
  ]);
  const known = layouts.get(signature);
  if (known) return known;
  const nodes = computeStackMap(centre, members, levels, likes, shown);
  layouts.set(signature, nodes);
  while (layouts.size > LAYOUTS_KEPT)
    layouts.delete(layouts.keys().next().value!);
  return nodes;
};

const computeStackMap = (
  centre: StackCentre,
  members: SearchCache[],
  levels: Map<string, number>,
  likes: Likes,
  shown: string[],
): StackNode[] => {
  const { radius, nodes: placed } = placeMembers(centre, members, levels);
  const stackKeys = new Set(placed.map((p) => p.key));

  // Every result of every member, with its weight toward each stack album.
  const results = new Map<
    string,
    { release: EnrichedRelease; weights: Map<number, number> }
  >();
  placed.forEach((node, index) => {
    for (const release of Object.values(node.search?.releases ?? {})) {
      if (stackKeys.has(release.key)) continue;
      const entry = results.get(release.key) ?? {
        release,
        weights: new Map<number, number>(),
      };
      entry.weights.set(index, sharedCount(release));
      results.set(release.key, entry);
    }
  });
  const chosen = shown
    .map((key) => results.get(key))
    .filter((c): c is NonNullable<typeof c> => c !== undefined);

  // Popularity on a log scale across the results shown.
  const logs = chosen.map((c) => {
    const p = popularity(c.release);
    return p === null ? null : Math.log10(1 + p);
  });
  const known = logs.filter((l): l is number => l !== null);
  const low = Math.min(...known);
  const high = Math.max(...known);
  const scale_ = (i: number) => {
    const l = logs[i];
    if (l === null) return 0;
    return high > low ? (l - low) / (high - low) : 1;
  };

  // Covers grow with the ring where the image needs them bigger: each
  // scale is laid out in turn, smallest first (see below).
  const attempt = (scale: number): StackNode[] => {
    const memberNodes: StackNode[] = placed.map((p, i) => {
      const search = p.search;
      return {
        key: p.key,
        title: i === 0 ? centre.title : (search?.searchParams.album ?? ""),
        artist: i === 0 ? centre.artist : (search?.searchParams.artist ?? ""),
        x: p.x,
        y: p.y,
        side: (i === 0 ? STACK_SIZES.centre : STACK_SIZES.member) * scale,
        member: true,
        // Its parent, and any other stack album before it that it links.
        links: Array.from(
          new Set([...(p.parent >= 0 ? [p.parent] : []), ...p.linked]),
        ).sort((a, b) => a - b),
      };
    });
    const sides = chosen.map(
      (c, i) =>
        (STACK_SIZES.smallest +
          STACK_SIZES.popular * scale_(i) +
          (likes[c.release.key] ? STACK_SIZES.liked : 0)) *
        scale,
    );
    const starts = placeResults(
      placed,
      radius,
      chosen.map((c, i) => ({ side: sides[i], weights: c.weights })),
      scale,
    );
    const resultNodes: StackNode[] = chosen.map((c, i) => {
      const links = Array.from(c.weights.keys()).sort((a, b) => a - b);
      return {
        key: c.release.key,
        title: c.release.title,
        artist: c.release.artist,
        ...starts[i],
        side: sides[i],
        member: false,
        links,
        weights: links.map((k) => c.weights.get(k) ?? 0),
      };
    });
    const nodes = [...memberNodes, ...resultNodes];
    const relaxed = relaxGraph(
      nodes.map((n) => ({
        x: n.x,
        y: n.y,
        side: n.side,
        fixed: n.member,
        links: n.member ? [] : n.links,
      })),
      undefined,
      undefined,
      { gap: GAP * scale, minLink: MIN_LINK * scale },
    );
    return nodes.map((n, i) => ({ ...n, ...relaxed[i] }));
  };
  // The stack's own covers mustn't meet: that bounds the scale.
  let most = Infinity;
  placed.forEach((a, i) =>
    placed.slice(i + 1).forEach((b) => {
      const sides =
        ((i === 0 ? STACK_SIZES.centre : STACK_SIZES.member) +
          STACK_SIZES.member) /
          2 +
        GAP;
      const apart = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
      most = Math.min(most, apart / sides);
    }),
  );
  const scales =
    chosen.length > 0 ? SCALES.filter((s) => s === 1 || s <= most) : [1];
  // The smallest scale that clears the floor (with a margin) leaves the
  // most room between covers; failing that, the biggest covers there are.
  let best: StackNode[] = [];
  let bestSize = -1;
  for (const scale of scales) {
    const nodes = attempt(scale);
    const { smallest } = fitToCanvas(nodes);
    if (smallest >= COVER_FLOOR * 1.15) return nodes;
    if (smallest > bestSize + 0.5) {
      best = nodes;
      bestSize = smallest;
    }
  }
  return best;
};

/** Cover scales a stack map tries (see `layoutStackMap`). */
const SCALES = [1, 1.25, 1.5, 1.75];

/**
 * The most results a stack map can draw with every result cover at least
 * COVER_FLOOR pixels in the share image. `pick(count)` gives the results
 * a count would draw. At least `least` (or `most`, when that's fewer):
 * a stack too big for the floor still draws a few.
 */
export const stackMapCapacity = (
  centre: StackCentre,
  members: SearchCache[],
  levels: Map<string, number>,
  likes: Likes,
  pick: (count: number) => string[],
  most: number,
  least = 6,
): number => {
  const fits = (count: number) =>
    fitToCanvas(layoutStackMap(centre, members, levels, likes, pick(count)))
      .smallest >= COVER_FLOOR;
  if (most <= least || fits(most)) return most;
  // The largest count that fits, by halving (more results only crowd it).
  let low = least;
  let high = most;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (fits(mid)) low = mid;
    else high = mid;
  }
  return low;
};

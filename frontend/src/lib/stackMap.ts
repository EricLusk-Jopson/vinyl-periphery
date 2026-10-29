import { EnrichedRelease } from "@/api/types";
import { SearchCache } from "@/contexts/cache/types";
import { Likes } from "@/services/likes";
import { popularity, ScoredRelease, SortKey, sortReleases } from "./results";

/**
 * The share map for a stack: a graph of album overlap, not of people.
 *
 * - The stack's start is in the middle. Each step out is one unit: a
 *   member sits one unit from the album it came from, members of the same
 *   parent fanning out from it (each branch gets a wedge of the circle as
 *   wide as its number of leaves, and points into its wedge).
 * - Then results from the members' searches fill in. A result sits at the
 *   average of the stack albums' places, each weighted by how many people
 *   the result shares with that album, so it lands nearest the albums it
 *   has most in common with.
 * - Covers grow with popularity and a like; the stack's own albums are
 *   bigger. Overlapping covers are pushed apart; the stack's albums stay
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
const GAP = 0.04;

export interface StackNode {
  key: string;
  title: string;
  artist: string;
  x: number;
  y: number;
  side: number;
  /** One of the stack's own albums (the centre is index 0). */
  member: boolean;
  /** Nodes it's drawn linked to: a member's parent; a result's albums. */
  links: number[];
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

  // Wedges as wide as each branch's leaves; the start's begins at the top.
  const leaves = (t: TreeNode): number =>
    t.children.length === 0 ? 1 : t.children.reduce((s, c) => s + leaves(c), 0);
  const angle = new Map<TreeNode, number>();
  const spread = (t: TreeNode, from: number, to: number) => {
    let at = from;
    const total = leaves(t);
    for (const child of t.children) {
      const width = ((to - from) * leaves(child)) / total;
      angle.set(child, at + width / 2);
      spread(child, at, at + width);
      at += width;
    }
  };
  spread(root, Math.PI / 2, Math.PI / 2 + 2 * Math.PI);

  // One unit from the album it came from, in its wedge's direction
  // (parents come first in `all`, so they're placed before children).
  const at = new Map<TreeNode, { x: number; y: number }>([
    [root, { x: 0, y: 0 }],
  ]);
  for (const t of all.slice(1)) {
    const from = at.get(t.parent!)!;
    const a = angle.get(t) ?? 0;
    at.set(t, { x: from.x + Math.cos(a), y: from.y + Math.sin(a) });
  }
  return all.map((t) => ({
    key: t.key,
    search: t.search,
    ...at.get(t)!,
    parent: t.parent ? all.indexOf(t.parent) : -1,
  }));
};

type Box = { x: number; y: number; side: number; fixed: boolean };

/**
 * Pushes overlapping covers apart, pulling the free ones back toward
 * their places; fixed ones (the stack's albums) never move. Ends with
 * steps that only push, along the line between covers.
 */
export const relaxGraph = (
  ideal: Box[],
  iterations = 300,
  settle = 120,
): Array<{ x: number; y: number }> => {
  const points = ideal.map((p) => ({ ...p }));
  for (let step = 0; step < iterations; step++) {
    const settling = step >= iterations - settle;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i];
        const b = points[j];
        if (a.fixed && b.fixed) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const reach = (a.side + b.side) / 2 + GAP;
        const overlapX = reach - Math.abs(dx);
        const overlapY = reach - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        if (dx === 0 && dy === 0) {
          dx = Math.cos(j * 2.399963);
          dy = Math.sin(j * 2.399963);
        }
        const shareA = a.fixed ? 0 : b.fixed ? 2 : 1;
        const shareB = b.fixed ? 0 : a.fixed ? 2 : 1;
        const move = Math.min(overlapX, overlapY) / 2;
        if (settling) {
          const length = Math.hypot(dx, dy);
          const push = move + 0.002;
          a.x -= (dx / length) * push * shareA;
          a.y -= (dy / length) * push * shareA;
          b.x += (dx / length) * push * shareB;
          b.y += (dy / length) * push * shareB;
        } else if (overlapX < overlapY) {
          const sign = Math.sign(dx) || 1;
          a.x -= sign * move * shareA;
          b.x += sign * move * shareB;
        } else {
          const sign = Math.sign(dy) || 1;
          a.y -= sign * move * shareA;
          b.y += sign * move * shareB;
        }
      }
    }
    if (!settling) {
      points.forEach((p, i) => {
        if (p.fixed) return;
        p.x += (ideal[i].x - p.x) * 0.02;
        p.y += (ideal[i].y - p.y) * 0.02;
      });
    }
  }
  return points.map(({ x, y }) => ({ x, y }));
};

/**
 * Every result of the stack's searches, the stack's own albums aside, once
 * each: linked by everyone in the stack who worked on it, scored by how
 * many people it shares with each stack album added up. Most connected
 * first (then linked to the most stack albums, then most popular).
 */
export const stackResults = (
  centre: StackCentre,
  members: SearchCache[],
): ScoredRelease[] => {
  const stack = new Set([
    centre.key,
    ...members.map((m) => m.target?.key ?? ""),
  ]);
  const byKey = new Map<
    string,
    {
      release: EnrichedRelease;
      people: Set<number>;
      total: number;
      linked: number;
    }
  >();
  for (const m of members) {
    for (const release of Object.values(m.releases ?? {})) {
      if (stack.has(release.key)) continue;
      const entry = byKey.get(release.key) ?? {
        release,
        people: new Set<number>(),
        total: 0,
        linked: 0,
      };
      const people = new Set(release.contributorIds);
      people.forEach((id) => entry.people.add(id));
      entry.total += people.size;
      entry.linked += 1;
      // The best counts any search kept.
      if (!entry.release.community && release.community) {
        entry.release = { ...entry.release, community: release.community };
      }
      byKey.set(release.key, entry);
    }
  }
  return Array.from(byKey.values())
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.linked - a.linked ||
        (popularity(b.release) ?? -1) - (popularity(a.release) ?? -1) ||
        a.release.key.localeCompare(b.release.key),
    )
    .map((e) => ({
      ...e.release,
      contributorIds: Array.from(e.people),
      activeContributors: Array.from(e.people),
      score: e.total,
      confidence: 1,
    }));
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

/**
 * The stack's albums, and the results in `shown` around them.
 */
export const layoutStackMap = (
  centre: StackCentre,
  members: SearchCache[],
  levels: Map<string, number>,
  likes: Likes,
  /** The results to draw, by key (see `stackResults`). */
  shown: string[],
): StackNode[] => {
  const placed = placeMembers(centre, members, levels);
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
  const scale = (i: number) => {
    const l = logs[i];
    if (l === null) return 0;
    return high > low ? (l - low) / (high - low) : 1;
  };

  const memberNodes: StackNode[] = placed.map((p, i) => {
    const search = p.search;
    return {
      key: p.key,
      title: i === 0 ? centre.title : (search?.searchParams.album ?? ""),
      artist: i === 0 ? centre.artist : (search?.searchParams.artist ?? ""),
      x: p.x,
      y: p.y,
      side: i === 0 ? STACK_SIZES.centre : STACK_SIZES.member,
      member: true,
      links: p.parent >= 0 ? [p.parent] : [],
    };
  });
  // Results only one stack album links would all land on it: they fan
  // out around it instead, pointing away from the middle first, then
  // alternating either side.
  const fanned = new Map<number, number>();
  const resultNodes: StackNode[] = chosen.map((c, i) => {
    const side =
      STACK_SIZES.smallest +
      STACK_SIZES.popular * scale(i) +
      (likes[c.release.key] ? STACK_SIZES.liked : 0);
    let x = 0;
    let y = 0;
    let sum = 0;
    c.weights.forEach((w, index) => {
      x += placed[index].x * w;
      y += placed[index].y * w;
      sum += w;
    });
    if (sum > 0) {
      x /= sum;
      y /= sum;
    }
    if (c.weights.size === 1) {
      const [index] = Array.from(c.weights.keys());
      const k = fanned.get(index) ?? 0;
      fanned.set(index, k + 1);
      const node = placed[index];
      const outward = index === 0 ? -Math.PI / 2 : Math.atan2(node.y, node.x);
      // 0, +1, -1, +2, -2... steps of 50° around the outward direction.
      const turn = (k % 2 === 0 ? -1 : 1) * Math.ceil(k / 2) * (Math.PI / 3.6);
      const reach =
        (index === 0 ? STACK_SIZES.centre : STACK_SIZES.member) / 2 +
        GAP +
        side / 2;
      x = node.x + reach * Math.cos(outward + turn);
      y = node.y + reach * Math.sin(outward + turn);
    }
    return {
      key: c.release.key,
      title: c.release.title,
      artist: c.release.artist,
      x,
      y,
      side,
      member: false,
      links: Array.from(c.weights.keys()).sort((a, b) => a - b),
    };
  });

  const nodes = [...memberNodes, ...resultNodes];
  const relaxed = relaxGraph(
    nodes.map((n) => ({ x: n.x, y: n.y, side: n.side, fixed: n.member })),
  );
  return nodes.map((n, i) => ({ ...n, ...relaxed[i] }));
};

import {
  LineageStep,
  SearchCache,
  SearchLineage,
} from "@/contexts/cache/types";
import { childLineage, lineageOf } from "./lineage";
import { matchesName } from "./filters";
import { linkSummary } from "./linkSummary";
import { searchStartedAt } from "./searches";

/**
 * Saved searches grouped by lineage. There is no stack entity: a stack is
 * the saved searches sharing a `stackId`, shown together when there are two
 * or more. Pure, so grouping can be tested on its own.
 */

export interface LibraryStack {
  kind: "stack";
  stackId: string;
  members: SearchCache[];
}

export interface LibrarySingle {
  kind: "single";
  search: SearchCache;
}

export type LibraryEntry = LibraryStack | LibrarySingle;

/** The stack a search belongs to. */
export const stackIdOf = (search: SearchCache): string =>
  lineageOf(search).stackId;

/**
 * Saved searches as stacks (two or more sharing a stack id) and singles.
 * Keeps the input order (most recent first); a stack sits where its most
 * recent member would.
 */
export const groupStacks = (saved: SearchCache[]): LibraryEntry[] => {
  const byStack = new Map<string, SearchCache[]>();
  for (const search of saved) {
    const id = stackIdOf(search);
    byStack.set(id, [...(byStack.get(id) ?? []), search]);
  }
  const entries: LibraryEntry[] = [];
  const placed = new Set<string>();
  for (const search of saved) {
    const id = stackIdOf(search);
    if (placed.has(id)) continue;
    placed.add(id);
    const members = byStack.get(id)!;
    entries.push(
      members.length > 1
        ? { kind: "stack", stackId: id, members }
        : { kind: "single", search },
    );
  }
  return entries;
};

export interface StackRoot {
  searchId: string;
  title: string;
  artist: string;
  thumb: string;
  targetKey: string;
  /** The root search itself, while it's still saved. */
  search?: SearchCache;
}

/**
 * Where a stack started: the root search if it's still saved, otherwise the
 * snapshot every member keeps of it. Its name and art outlive the root.
 */
export const stackRoot = (stack: LibraryStack): StackRoot => {
  // Depth 0, not id: a repeat run of the root keeps its lineage (and so
  // the stack id) under a new search id.
  const root = stack.members.find((m) => lineageOf(m).depth === 0);
  if (root) {
    return {
      searchId: root.searchId,
      title: root.searchParams.album,
      artist: root.searchParams.artist,
      thumb: root.thumb,
      targetKey: root.target?.key ?? "",
      search: root,
    };
  }
  const step = stack.members
    .map((m) => lineageOf(m).path[0])
    .find((s): s is LineageStep => Boolean(s));
  const first = stack.members[0];
  return step
    ? {
        searchId: step.searchId,
        title: step.title,
        artist: step.artist,
        thumb: step.thumb,
        targetKey: step.targetKey,
      }
    : {
        searchId: first.searchId,
        title: first.searchParams.album,
        artist: first.searchParams.artist,
        thumb: first.thumb,
        targetKey: first.target?.key ?? "",
      };
};

/** "{Root title} + {n}": n counts the members other than the root. */
export const stackLabel = (stack: LibraryStack): string => {
  const root = stackRoot(stack);
  const others = stack.members.filter((m) => m.searchId !== root.searchId);
  return `${root.title} + ${others.length}`;
};

export interface GhostStep {
  step: LineageStep;
  depth: number;
  /** The lineage the step had, so searching it again rejoins the stack. */
  lineage: SearchLineage;
}

export interface StackLayout {
  /** Member search id -> its step: the fewest links from the start. */
  levels: Map<string, number>;
  /**
   * Albums that aren't saved but are needed to show the stack: its start,
   * when that isn't saved, and steps a member was reached through when no
   * saved album links it to the rest.
   */
  ghosts: GhostStep[];
}

/**
 * A stack as a graph. Albums are linked when one has the other among its
 * results (someone credited on one worked on the other). Each member's
 * step is its shortest distance from the start, however it was reached:
 * two albums in the start's results are both step 1.
 *
 * The trail each search was reached by (its lineage) only decides which
 * stack it's in, and, for members no saved album links to the rest,
 * supplies the unsaved steps between (shown ghosted).
 */
export const stackLayout = (stack: LibraryStack): StackLayout => {
  const root = stackRoot(stack);
  // One node per album where the album is known, so a repeat run and the
  // snapshot of the original are the same node.
  const node = (searchId: string, targetKey?: string) => targetKey || searchId;
  const memberNode = (m: SearchCache) => node(m.searchId, m.target?.key);
  const rootNode = node(root.searchId, root.targetKey);
  const memberNodes = new Set(stack.members.map(memberNode));

  const adjacent = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (a === b) return;
    if (!adjacent.has(a)) adjacent.set(a, new Set());
    if (!adjacent.has(b)) adjacent.set(b, new Set());
    adjacent.get(a)!.add(b);
    adjacent.get(b)!.add(a);
  };
  const distances = () => {
    const found = new Map<string, number>([[rootNode, 0]]);
    const queue = [rootNode];
    while (queue.length) {
      const at = queue.shift()!;
      for (const next of adjacent.get(at) ?? []) {
        if (found.has(next)) continue;
        found.set(next, found.get(at)! + 1);
        queue.push(next);
      }
    }
    return found;
  };

  // Credit links: a member's results include another album in the stack.
  const nodes = [rootNode, ...memberNodes];
  for (const member of stack.members) {
    for (const other of nodes) {
      if (member.releases?.[other]) link(memberNode(member), other);
    }
  }
  let found = distances();

  // Members nothing links to: join them by the trail they were reached by.
  const ghostSteps = new Map<
    string,
    { step: LineageStep; member: SearchCache; index: number }
  >();
  for (const member of stack.members) {
    if (found.has(memberNode(member))) continue;
    const { path } = lineageOf(member);
    const chain = [
      ...path.map((step) => node(step.searchId, step.targetKey)),
      memberNode(member),
    ];
    chain.slice(1).forEach((n, i) => link(chain[i], n));
    path.forEach((step, index) => {
      const n = node(step.searchId, step.targetKey);
      if (!memberNodes.has(n) && n !== rootNode && !ghostSteps.has(n)) {
        ghostSteps.set(n, { step, member, index });
      }
    });
  }
  if (ghostSteps.size > 0) found = distances();

  const levels = new Map(
    stack.members.map((m) => [
      m.searchId,
      found.get(memberNode(m)) ?? lineageOf(m).depth,
    ]),
  );

  const ghostOf = (
    step: LineageStep,
    member: SearchCache,
    index: number,
  ): GhostStep => {
    const { path, stackId } = lineageOf(member);
    return {
      step,
      depth: found.get(node(step.searchId, step.targetKey)) ?? index,
      lineage: {
        stackId,
        depth: index,
        path: path.slice(0, index),
        via: step.via,
      },
    };
  };
  const ghosts: GhostStep[] = [];
  // The start, when it isn't saved: from the first member's trail.
  if (!root.search && !memberNodes.has(rootNode)) {
    const member = stack.members.find(
      (m) => lineageOf(m).path[0]?.searchId === root.searchId,
    );
    if (member) ghosts.push(ghostOf(lineageOf(member).path[0], member, 0));
  }
  for (const { step, member, index } of ghostSteps.values()) {
    ghosts.push(ghostOf(step, member, index));
  }
  ghosts.sort((a, b) => a.depth - b.depth);
  return { levels, ghosts };
};

export type StackOrder = "depth" | "time";

/** Members by step (then time), or newest first. */
export const stackMembersByDepth = (
  stack: LibraryStack,
  order: StackOrder = "depth",
  levels: Map<string, number> = stackLayout(stack).levels,
): SearchCache[] =>
  [...stack.members].sort((a, b) =>
    order === "depth"
      ? (levels.get(a.searchId) ?? 0) - (levels.get(b.searchId) ?? 0) ||
        searchStartedAt(a.searchId) - searchStartedAt(b.searchId)
      : searchStartedAt(b.searchId) - searchStartedAt(a.searchId),
  );

/** Unsaved albums shown ghosted on a stack's page (see `stackLayout`). */
export const stackGhosts = (stack: LibraryStack): GhostStep[] =>
  stackLayout(stack).ghosts;

/** The deepest step in a stack. */
export const stackDepth = (stack: LibraryStack): number =>
  Math.max(0, ...stackLayout(stack).levels.values());

export interface StackFit {
  /** "stack": joins an existing stack. "single": starts one with a saved search. */
  kind: "stack" | "single";
  stack: LibraryStack;
  /** The saved search whose results include this album. */
  parent: SearchCache;
  /** Who links them: that result's contributors. */
  via: number[];
  /** The lineage this search takes on joining, as if searched from there. */
  lineage: SearchLineage;
}

/** `search` is on `other`'s trail, so `other` can't come before it. */
const isAncestorOf = (search: SearchCache, other: SearchCache) =>
  lineageOf(other).path.some(
    (step) =>
      step.searchId === search.searchId ||
      (Boolean(step.targetKey) && step.targetKey === search.target?.key),
  );

/**
 * Where this album fits among saved searches: one of them has it among its
 * results, so it could have been searched from there.
 *
 * Existing stacks (two or more saved searches) always count; with
 * `singles`, so do saved searches on their own, which would start a stack.
 * Per stack, the member nearest the start (then sharing the most people)
 * is the parent. Leaves out the search's own stack, stacks that already hold this
 * album, and searches on its own trail below it. Stacks first, then best
 * fit first.
 */
export const stacksThisFits = (
  search: SearchCache,
  searches: Record<string, SearchCache>,
  savedIds: Set<string>,
  { singles = false }: { singles?: boolean } = {},
): StackFit[] => {
  const key = search.target?.key;
  if (!key) return [];
  const own = stackIdOf(search);
  const saved = Object.values(searches).filter(
    (s) => savedIds.has(s.searchId) && s.searchId !== search.searchId,
  );
  const fits: StackFit[] = [];
  for (const entry of groupStacks(saved)) {
    const stack: LibraryStack =
      entry.kind === "stack"
        ? entry
        : {
            kind: "stack",
            stackId: stackIdOf(entry.search),
            members: [entry.search],
          };
    if (entry.kind === "single" && !singles) continue;
    if (stack.stackId === own) continue;
    if (stack.members.some((m) => m.target?.key === key)) continue;
    // The parent is the member nearest the start (then sharing the most
    // people): its step plus one is where this album sits.
    const { levels } = stackLayout(stack);
    const level = (m: SearchCache) => levels.get(m.searchId) ?? 0;
    let best: { parent: SearchCache; via: number[] } | null = null;
    for (const member of stack.members) {
      const via = member.releases?.[key]?.contributorIds ?? [];
      if (via.length === 0 || isAncestorOf(search, member)) continue;
      if (
        !best ||
        level(member) < level(best.parent) ||
        (level(member) === level(best.parent) && via.length > best.via.length)
      ) {
        best = { parent: member, via };
      }
    }
    if (best) {
      fits.push({
        kind: entry.kind,
        stack,
        ...best,
        lineage: childLineage(best.parent, best.via, best.parent.thumb),
      });
    }
  }
  return fits.sort(
    (a, b) =>
      Number(a.kind === "single") - Number(b.kind === "single") ||
      b.via.length - a.via.length,
  );
};

/**
 * What links a fit to its parent, by role: their roles on the parent album,
 * as `linkSummary` puts them ("via Musicians (2) · Audio (1)", "via Lacquer
 * Cut By").
 */
export const fitLinkText = (fit: Pick<StackFit, "parent" | "via">): string =>
  linkSummary(
    fit.via.map((id) => fit.parent.contributors?.[id] ?? { id, roles: [] }),
  );

/** Whether a saved search is grouped with others (a stack of two or more). */
export const isInStack = (
  search: SearchCache,
  searches: Record<string, SearchCache>,
  savedIds: Set<string>,
): boolean => savedInStack(searches, savedIds, stackIdOf(search)).length > 1;

/** Saved searches whose album or artist matches, across stacks and singles. */
export const searchLibrary = (
  saved: SearchCache[],
  query: string,
): SearchCache[] =>
  query.trim() === ""
    ? saved
    : saved.filter(
        (s) =>
          matchesName(s.searchParams.album, query) ||
          matchesName(s.searchParams.artist, query),
      );

/** The saved searches in one stack, most recent first. */
export const savedInStack = (
  searches: Record<string, SearchCache>,
  savedIds: Set<string>,
  stackId: string,
): SearchCache[] =>
  Object.values(searches)
    .filter((s) => savedIds.has(s.searchId) && stackIdOf(s) === stackId)
    .sort((a, b) => searchStartedAt(b.searchId) - searchStartedAt(a.searchId));

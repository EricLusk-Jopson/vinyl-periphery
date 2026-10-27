import {
  LineageStep,
  SearchCache,
  SearchLineage,
} from "@/contexts/cache/types";
import { lineageOf } from "./lineage";
import { matchesName } from "./filters";
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

export type StackOrder = "depth" | "time";

/** Members by depth (then time), or newest first. */
export const stackMembersByDepth = (
  stack: LibraryStack,
  order: StackOrder = "depth",
): SearchCache[] =>
  [...stack.members].sort((a, b) =>
    order === "depth"
      ? lineageOf(a).depth - lineageOf(b).depth ||
        searchStartedAt(a.searchId) - searchStartedAt(b.searchId)
      : searchStartedAt(b.searchId) - searchStartedAt(a.searchId),
  );

export interface GhostStep {
  step: LineageStep;
  depth: number;
  /** The lineage the step had, so searching it again rejoins the stack. */
  lineage: SearchLineage;
}

/**
 * Ancestors on members' trails that aren't saved: shown ghosted on the
 * stack page, with a way to search them again. A step whose album is a
 * saved member (a repeat run changes the id) isn't a ghost.
 */
export const stackGhosts = (stack: LibraryStack): GhostStep[] => {
  const memberIds = new Set(stack.members.map((m) => m.searchId));
  const memberTargets = new Set(
    stack.members.map((m) => m.target?.key).filter(Boolean),
  );
  const ghosts = new Map<string, GhostStep>();
  for (const member of stack.members) {
    const { path, stackId } = lineageOf(member);
    path.forEach((step, depth) => {
      if (memberIds.has(step.searchId) || ghosts.has(step.searchId)) return;
      if (step.targetKey && memberTargets.has(step.targetKey)) return;
      ghosts.set(step.searchId, {
        step,
        depth,
        lineage: {
          stackId,
          depth,
          path: path.slice(0, depth),
          via: step.via,
        },
      });
    });
  }
  return [...ghosts.values()].sort((a, b) => a.depth - b.depth);
};

export interface AncestorToSave {
  step: LineageStep;
  /** The search in this session or library for that step. */
  search: SearchCache;
  saved: boolean;
}

/**
 * A search's ancestors that still exist here, root first, for the save
 * drawer. Found by id, or by album for ancestors re-run since (a repeat run
 * gets a new id). Saved ones are listed too, as already saved.
 */
export const ancestorsAvailableToSave = (
  search: SearchCache,
  searches: Record<string, SearchCache>,
  savedIds: Set<string>,
): AncestorToSave[] => {
  const all = Object.values(searches);
  return lineageOf(search).path.flatMap((step) => {
    const found =
      searches[step.searchId] ??
      (step.targetKey
        ? all.find((s) => s.target?.key === step.targetKey)
        : undefined);
    if (!found || found.searchId === search.searchId) return [];
    return [{ step, search: found, saved: savedIds.has(found.searchId) }];
  });
};

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

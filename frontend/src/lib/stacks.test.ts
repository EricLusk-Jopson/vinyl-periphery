import { SearchCache } from "@/contexts/cache/types";
import { childLineage, rootLineage } from "./lineage";
import {
  ancestorsAvailableToSave,
  groupStacks,
  searchLibrary,
  stackGhosts,
  stackLabel,
  stackMembersByDepth,
  stackRoot,
  stacksThisFits,
  isInStack,
  savingNeedsChoice,
  LibraryStack,
} from "./stacks";

// Ids end in a timestamp, as real ones do.
const make = (id: number, album: string, parent?: SearchCache, via = [1]) => {
  const search = {
    searchId: `A-${album}-${id}`,
    searchParams: { artist: `${album} Artist`, album },
    target: { type: "master", id, key: `master:${id}` },
    thumb: `https://art/${id}`,
  } as SearchCache;
  search.lineage = parent
    ? childLineage(parent, via, parent.thumb)
    : rootLineage(search.searchId);
  return search;
};

const root = make(1, "Unmap");
const child = make(2, "Bon Iver", root);
const grandchild = make(3, "Hideaway", child, [2]);
const single = make(4, "Loner");

describe("groupStacks", () => {
  it("groups two or more saved searches sharing a stack id", () => {
    const entries = groupStacks([grandchild, single, root, child]);
    expect(entries).toEqual([
      {
        kind: "stack",
        stackId: root.searchId,
        members: [grandchild, root, child],
      },
      { kind: "single", search: single },
    ]);
  });

  it("shows a stack down to one member as a plain card, regrouping later", () => {
    expect(groupStacks([grandchild, single])).toEqual([
      { kind: "single", search: grandchild },
      { kind: "single", search: single },
    ]);
    // Saving another member of the same trail regroups it.
    expect(groupStacks([grandchild, child])[0].kind).toBe("stack");
  });

  it("treats searches without lineage, or saved on their own, as singles", () => {
    const loose = { ...child, lineage: undefined };
    expect(groupStacks([loose, root]).map((e) => e.kind)).toEqual([
      "single",
      "single",
    ]);
  });
});

describe("stackRoot and stackLabel", () => {
  const stack: LibraryStack = {
    kind: "stack",
    stackId: root.searchId,
    members: [root, child, grandchild],
  };

  it("uses the root search while it's saved", () => {
    expect(stackRoot(stack)).toMatchObject({
      title: "Unmap",
      thumb: "https://art/1",
      search: root,
    });
    expect(stackLabel(stack)).toBe("Unmap + 2");
  });

  it("keeps the root's name and art after the root is deleted", () => {
    const withoutRoot = { ...stack, members: [child, grandchild] };
    expect(stackRoot(withoutRoot)).toMatchObject({
      searchId: root.searchId,
      title: "Unmap",
      thumb: "https://art/1",
    });
    expect(stackRoot(withoutRoot).search).toBeUndefined();
    expect(stackLabel(withoutRoot)).toBe("Unmap + 2");
  });
});

describe("stackMembersByDepth", () => {
  const stack: LibraryStack = {
    kind: "stack",
    stackId: root.searchId,
    members: [grandchild, root, child],
  };

  it("orders by depth, or newest first", () => {
    expect(stackMembersByDepth(stack).map((s) => s.searchId)).toEqual([
      root.searchId,
      child.searchId,
      grandchild.searchId,
    ]);
    expect(stackMembersByDepth(stack, "time").map((s) => s.searchId)).toEqual([
      grandchild.searchId,
      child.searchId,
      root.searchId,
    ]);
  });
});

describe("stackGhosts", () => {
  it("lists unsaved ancestors with the lineage to rejoin the stack", () => {
    const stack: LibraryStack = {
      kind: "stack",
      stackId: root.searchId,
      members: [root, grandchild],
    };
    const ghosts = stackGhosts(stack);
    expect(ghosts.map((g) => [g.step.title, g.depth])).toEqual([
      ["Bon Iver", 1],
    ]);
    expect(ghosts[0].lineage).toEqual({
      stackId: root.searchId,
      depth: 1,
      path: [grandchild.lineage!.path[0]],
      via: [1],
    });
  });

  it("doesn't ghost a step whose album is a saved member under a new id", () => {
    const rerun = { ...child, searchId: "A-Bon Iver-99" };
    const stack: LibraryStack = {
      kind: "stack",
      stackId: root.searchId,
      members: [root, rerun, grandchild],
    };
    expect(stackGhosts(stack)).toEqual([]);
  });
});

describe("ancestorsAvailableToSave", () => {
  it("lists ancestors still here, root first, marking saved ones", () => {
    const searches = {
      [root.searchId]: root,
      [child.searchId]: child,
      [grandchild.searchId]: grandchild,
    };
    expect(
      ancestorsAvailableToSave(
        grandchild,
        searches,
        new Set([root.searchId]),
      ).map((a) => [a.search.searchId, a.saved]),
    ).toEqual([
      [root.searchId, true],
      [child.searchId, false],
    ]);
  });

  it("finds a re-run ancestor by album, and skips deleted ones", () => {
    const rerun = { ...child, searchId: "A-Bon Iver-99" };
    expect(
      ancestorsAvailableToSave(
        grandchild,
        { [rerun.searchId]: rerun, [grandchild.searchId]: grandchild },
        new Set(),
      ).map((a) => a.search.searchId),
    ).toEqual(["A-Bon Iver-99"]);
  });

  it("is empty for a root", () => {
    expect(
      ancestorsAvailableToSave(root, { [root.searchId]: root }, new Set()),
    ).toEqual([]);
  });
});

describe("searchLibrary", () => {
  it("matches album or artist, ignoring case and accents", () => {
    const saved = [root, child, single];
    expect(
      searchLibrary(saved, "bon").map((s) => s.searchParams.album),
    ).toEqual(["Bon Iver"]);
    expect(searchLibrary(saved, "LONER artist")).toEqual([single]);
    expect(searchLibrary(saved, " ")).toEqual(saved);
  });
});

describe("stacksThisFits", () => {
  // `make` ids: album N is master:N. A member "finds" an album when its
  // results hold that key.
  const withResults = (
    search: SearchCache,
    results: Record<number, number[]>,
  ): SearchCache => ({
    ...search,
    contributors: {
      1: { id: 1, name: "Jim Keltner" },
      2: { id: 2, name: "Steve Albini" },
      3: { id: 3, name: "Phil Ek" },
    } as unknown as SearchCache["contributors"],
    releases: Object.fromEntries(
      Object.entries(results).map(([id, contributorIds]) => [
        `master:${id}`,
        { key: `master:${id}`, contributorIds },
      ]),
    ) as unknown as SearchCache["releases"],
  });
  const stackRootSearch = withResults(root, { 9: [1] });
  const stackChild = withResults(child, { 9: [1, 2] });
  const otherRoot = withResults(make(5, "Other"), { 9: [3] });
  const otherChild = make(6, "Other Child", otherRoot);
  const manual = make(9, "Manual");
  const all = (...list: SearchCache[]) =>
    Object.fromEntries(list.map((s) => [s.searchId, s]));

  it("offers each saved stack whose members found this album, best first", () => {
    const searches = all(
      stackRootSearch,
      stackChild,
      otherRoot,
      otherChild,
      manual,
    );
    const saved = new Set([
      stackRootSearch.searchId,
      stackChild.searchId,
      otherRoot.searchId,
      otherChild.searchId,
    ]);
    const fits = stacksThisFits(manual, searches, saved);
    expect(fits.map((f) => f.stack.stackId)).toEqual([
      root.searchId,
      otherRoot.searchId,
    ]);
    // The member sharing the most people is the parent.
    expect(fits[0].parent.searchId).toBe(child.searchId);
    expect(fits[0].via).toEqual([1, 2]);
    expect(fits[0].lineage).toMatchObject({
      stackId: root.searchId,
      depth: 2,
      via: [1, 2],
    });
    expect(fits[0].lineage.path.map((p) => p.searchId)).toEqual([
      root.searchId,
      child.searchId,
    ]);
  });

  it("needs two saved members, and skips the search's own stack", () => {
    const searches = all(stackRootSearch, stackChild, manual);
    expect(
      stacksThisFits(manual, searches, new Set([stackRootSearch.searchId])),
    ).toEqual([]);
    const ownChild = { ...manual, lineage: childLineage(root, [1], "") };
    expect(
      stacksThisFits(
        ownChild,
        all(stackRootSearch, stackChild, ownChild),
        new Set([stackRootSearch.searchId, stackChild.searchId]),
      ),
    ).toEqual([]);
  });

  it("skips stacks already holding this album, and albums with no target", () => {
    const repeat = {
      ...make(9, "Manual again"),
      lineage: childLineage(child, [1], ""),
    };
    const searches = all(stackRootSearch, stackChild, repeat, manual);
    const saved = new Set([
      stackRootSearch.searchId,
      stackChild.searchId,
      repeat.searchId,
    ]);
    expect(stacksThisFits(manual, searches, saved)).toEqual([]);
    expect(
      stacksThisFits(
        { ...manual, target: undefined },
        all(stackRootSearch, stackChild),
        new Set([stackRootSearch.searchId, stackChild.searchId]),
      ),
    ).toEqual([]);
  });

  it("offers saved searches on their own only when asked, after stacks", () => {
    const lone = withResults(make(7, "Lone"), { 9: [1, 2, 3] });
    const searches = all(stackRootSearch, stackChild, lone, manual);
    const saved = new Set([
      stackRootSearch.searchId,
      stackChild.searchId,
      lone.searchId,
    ]);
    expect(stacksThisFits(manual, searches, saved).map((f) => f.kind)).toEqual([
      "stack",
    ]);
    const fits = stacksThisFits(manual, searches, saved, { singles: true });
    // Stacks first, even though the lone search shares more people.
    expect(fits.map((f) => [f.kind, f.parent.searchId])).toEqual([
      ["stack", child.searchId],
      ["single", lone.searchId],
    ]);
    expect(fits[1].lineage).toMatchObject({
      stackId: lone.searchId,
      depth: 1,
      via: [1, 2, 3],
    });
  });

  it("never puts a search after one on its own trail below it", () => {
    // Saved on its own, but reached from `manual`: it can't come first.
    const below = withResults(
      { ...make(8, "Below"), lineage: childLineage(manual, [1], "") },
      { 9: [1] },
    );
    expect(
      stacksThisFits(manual, all(below, manual), new Set([below.searchId]), {
        singles: true,
      }),
    ).toEqual([]);
  });
});

describe("savingNeedsChoice and isInStack", () => {
  it("asks how to save with a trail here or a stack it fits", () => {
    const lone = make(4, "Lone");
    const bare = { ...lone, releases: {} } as SearchCache;
    expect(savingNeedsChoice(bare, all2(bare), new Set())).toBe(false);
    // A child with its parent in the session has a trail to save.
    expect(savingNeedsChoice(child, all2(root, child), new Set())).toBe(true);
  });

  it("knows whether a saved search is grouped with others", () => {
    const searches = all2(root, child, single);
    const saved = new Set([root.searchId, child.searchId, single.searchId]);
    expect(isInStack(child, searches, saved)).toBe(true);
    expect(isInStack(single, searches, saved)).toBe(false);
  });
});

function all2(...list: SearchCache[]) {
  return Object.fromEntries(list.map((s) => [s.searchId, s]));
}

import { SearchCache } from "@/contexts/cache/types";
import { childLineage, rootLineage } from "./lineage";
import {
  groupStacks,
  searchLibrary,
  stackGhosts,
  stackLabel,
  stackMembersByDepth,
  stackRoot,
  stacksThisFits,
  fitLinkText,
  stackDepth,
  stackLayout,
  isInStack,
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
    // The member nearest the start is the parent, even though the child
    // shares more people: the album sits at step 1, beside the child.
    expect(fits[0].parent.searchId).toBe(root.searchId);
    expect(fits[0].via).toEqual([1]);
    expect(fits[0].lineage).toMatchObject({
      stackId: root.searchId,
      depth: 1,
      via: [1],
    });
    expect(fits[0].lineage.path.map((p) => p.searchId)).toEqual([
      root.searchId,
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
      ["stack", root.searchId],
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

describe("isInStack", () => {
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

describe("stackLayout", () => {
  // Shaped like the New Sound stack: the start's results include albums
  // that were reached through other steps.
  const withKeys = (search: SearchCache, keys: number[]): SearchCache => ({
    ...search,
    releases: Object.fromEntries(
      keys.map((id) => [
        `master:${id}`,
        { key: `master:${id}`, contributorIds: [1] },
      ]),
    ) as unknown as SearchCache["releases"],
  });
  const newSound = withKeys(make(10, "The New Sound"), [11, 12, 14]);
  const believe = withKeys(make(11, "My New Band Believe", newSound), [13]);
  const hellfire = make(12, "Hellfire", newSound);
  const giantPalm = make(13, "Giant Palm", believe);
  // Reached from Giant Palm, but in The New Sound's results too.
  const schlagenheim = make(14, "Schlagenheim", giantPalm);
  const stack = (...members: SearchCache[]): LibraryStack => ({
    kind: "stack",
    stackId: newSound.searchId,
    members,
  });

  it("puts each member at its fewest links from the start", () => {
    const { levels, ghosts } = stackLayout(
      stack(newSound, believe, hellfire, giantPalm, schlagenheim),
    );
    expect(Object.fromEntries(levels)).toEqual({
      [newSound.searchId]: 0,
      [believe.searchId]: 1,
      [hellfire.searchId]: 1,
      [giantPalm.searchId]: 2,
      [schlagenheim.searchId]: 1,
    });
    expect(ghosts).toEqual([]);
  });

  it("falls back to the trail, ghosting unsaved steps, when nothing links", () => {
    // Giant Palm is only linked through Believe, which isn't saved.
    const { levels, ghosts } = stackLayout(stack(newSound, giantPalm));
    expect(levels.get(giantPalm.searchId)).toBe(2);
    expect(ghosts.map((g) => [g.step.title, g.depth])).toEqual([
      ["My New Band Believe", 1],
    ]);
  });

  it("ghosts the start when it isn't saved, and links to it by album", () => {
    const { levels, ghosts } = stackLayout(stack(hellfire, schlagenheim));
    // Nothing saved links Schlagenheim (only the unsaved start had it in
    // its results), so its trail's unsaved steps show.
    expect(ghosts.map((g) => [g.step.title, g.depth])).toEqual([
      ["The New Sound", 0],
      ["My New Band Believe", 1],
      ["Giant Palm", 2],
    ]);
    expect(levels.get(hellfire.searchId)).toBe(1);
    expect(levels.get(schlagenheim.searchId)).toBe(3);
  });

  it("reports the deepest step", () => {
    expect(stackDepth(stack(newSound, believe, giantPalm, schlagenheim))).toBe(
      2,
    );
  });
});

describe("fitLinkText", () => {
  const parent = {
    contributors: {
      1: { id: 1, name: "Paul Jones (13)", roles: ["Lacquer Cut By"] },
      2: { id: 2, name: "Morgan Simpson", roles: ["Drums"] },
      3: { id: 3, name: "Seth Evans", roles: ["Keyboards", "Producer"] },
    },
  } as unknown as SearchCache;

  it("says what links them by role, not by name", () => {
    expect(fitLinkText({ parent, via: [1] })).toBe("via Lacquer Cut By");
    expect(fitLinkText({ parent, via: [2, 3] })).toBe(
      "via Musicians (2) · Audio (1)",
    );
    expect(fitLinkText({ parent, via: [9] })).toBe("via 1 contributor");
  });
});

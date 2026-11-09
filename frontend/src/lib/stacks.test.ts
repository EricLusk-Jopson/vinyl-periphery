import { SearchCache } from "@/contexts/cache/types";
import { rootLineage } from "./lineage";
import { memberFor, StackRecord } from "./stackRecords";
import {
  fitLinkText,
  libraryStack,
  libraryStacks,
  linkLineLabel,
  linkLineText,
  searchLibrary,
  searchStacks,
  StackParent,
  stackLabel,
  stackLayout,
  stackMembersByDepth,
  stackOptionsFor,
  stackRoot,
  stacksWith,
  UNLINKED,
} from "./stacks";

/** An album whose results are these album ids, linked by person 1. */
const album = (id: number, title: string, results: number[] = []) =>
  ({
    searchId: `${title}-${1000 + id}`,
    searchParams: { artist: `${title} Artist`, album: title },
    target: { type: "master", id, key: `master:${id}` },
    thumb: "",
    lineage: rootLineage(`${title}-${1000 + id}`),
    contributors: { 1: { id: 1, name: "Steve Albini", roles: ["Engineer"] } },
    releases: Object.fromEntries(
      results.map((r) => [
        `master:${r}`,
        { key: `master:${r}`, contributorIds: [1] },
      ]),
    ),
  }) as unknown as SearchCache;

// Seed links B; B links C; D links nothing; E is deleted from the library.
const seed = album(1, "Seed", [2]);
const b = album(2, "B", [3]);
const c = album(3, "C");
const d = album(4, "D");
const e = album(5, "E");

const all = [seed, b, c, d];
const searches = Object.fromEntries(all.map((s) => [s.searchId, s]));
const saved = new Set(all.map((s) => s.searchId));

const record = (
  id: string,
  members: SearchCache[],
  name = "Mine",
): StackRecord => ({
  id,
  name,
  members: members.map((m) => memberFor(m, 1)),
  createdAt: 1,
  updatedAt: 1,
});

const resolve = (r: StackRecord) => libraryStacks([r], searches, saved)[0];

describe("libraryStack", () => {
  it("finds its albums in the library and lists the deleted ones", () => {
    const stack = resolve(record("s", [seed, b, e]));
    expect(stack.members).toEqual([seed, b]);
    expect(stack.missing.map((m) => m.title)).toEqual(["E"]);
    expect(stackLabel(stack)).toBe("Mine");
  });

  it("starts at its first album, or that album as last known", () => {
    expect(stackRoot(resolve(record("s", [seed, b]))).search).toBe(seed);
    const gone = stackRoot(resolve(record("s", [e, seed])));
    expect(gone).toMatchObject({ title: "E", targetKey: "master:5" });
    expect(gone.search).toBeUndefined();
    expect(libraryStack(record("s", []), new Map()).members).toEqual([]);
  });
});

describe("stackLayout", () => {
  it("steps albums from the start by their links, unlinked ones apart", () => {
    // B was taken out of Seed, B, C: C has nothing linking it back.
    const stack = resolve(record("s", [seed, c, d]));
    const { levels, ghosts } = stackLayout(stack);
    expect(Object.fromEntries(levels)).toEqual({
      [seed.searchId]: 0,
      [c.searchId]: UNLINKED,
      [d.searchId]: UNLINKED,
    });
    expect(ghosts).toEqual([]);
  });

  it("gives each album the albums one step closer that link it", () => {
    const stack = resolve(record("s", [seed, b, c, e]));
    const { levels, parents, ghosts } = stackLayout(stack);
    expect(levels.get(c.searchId)).toBe(2);
    expect(parents.get(c.searchId)).toEqual([
      expect.objectContaining({
        title: "B",
        people: [1],
        names: ["Steve Albini"],
      }),
    ]);
    expect(parents.get(seed.searchId)).toEqual([]);
    expect(ghosts.map((g) => g.member.title)).toEqual(["E"]);
    expect(stackMembersByDepth(stack).map((m) => m.searchParams.album)).toEqual(
      ["Seed", "B", "C"],
    );
  });
});

describe("stackOptionsFor and stacksWith", () => {
  const holding = resolve(record("a", [seed, b], "Holds B"));
  const open = resolve(record("b", [b], "Takes C"));
  const closed = resolve(record("c", [d], "No link"));

  it("lists the stacks holding it, then those it links to, then the rest", () => {
    const options = stackOptionsFor(c, [closed, open, holding]);
    expect(options.map((o) => [o.stack.record.name, o.join.ok])).toEqual([
      ["Takes C", true],
      ["Holds B", true],
      ["No link", false],
    ]);
    const forB = stackOptionsFor(b, [closed, open, holding]);
    expect(
      forB.filter((o) => o.join.member).map((o) => o.stack.record.name),
    ).toEqual(["Takes C", "Holds B"]);
  });

  it("finds the stacks an album is in, by album", () => {
    expect(
      stacksWith(b, [holding, open, closed]).map((s) => s.stackId),
    ).toEqual(["a", "b"]);
    const rerun = { ...b, searchId: "B-9999" } as SearchCache;
    expect(stacksWith(rerun, [holding]).length).toBe(1);
  });
});

describe("searchLibrary and searchStacks", () => {
  it("matches albums by title or artist, and stacks by name or album", () => {
    expect(searchLibrary(all, "seed")).toEqual([seed]);
    expect(searchLibrary(all, "")).toEqual(all);
    const stacks = [resolve(record("s", [seed, b], "Trail"))];
    expect(searchStacks(stacks, "trail")).toHaveLength(1);
    expect(searchStacks(stacks, "B Artist")).toHaveLength(1);
    expect(searchStacks(stacks, "nothing")).toHaveLength(0);
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
      "via Instruments (2) · Production (1)",
    );
    expect(fitLinkText({ parent, via: [9] })).toBe("via 1 contributor");
  });
});

describe("linkLineText", () => {
  const parent = (over: Partial<StackParent>): StackParent => ({
    key: "master:1",
    title: "In Utero",
    artist: "Nirvana",
    people: [1, 2, 3],
    names: ["Steve Albini", "Krist Novoselic", "Dave Grohl"],
    ghost: false,
    byTrail: false,
    ...over,
  });

  it("names up to two people, then counts the rest", () => {
    expect(linkLineText([parent({})])).toBe(
      "From In Utero · Steve Albini, Krist Novoselic +1",
    );
    expect(
      linkLineText([parent({ people: [1], names: ["Steve Albini"] })]),
    ).toBe("From In Utero · Steve Albini");
    expect(linkLineText([parent({ names: [] })])).toBe(
      "From In Utero · 3 people",
    );
    expect(linkLineText([parent({ people: [], names: [] })])).toBe(
      "From In Utero",
    );
  });

  it("counts the other parents and the distinct people", () => {
    expect(
      linkLineText([
        parent({}),
        parent({ title: "Surfer Rosa", people: [1, 4], names: [] }),
      ]),
    ).toBe("From In Utero and 1 more · 4 people");
  });

  it("marks a deleted parent, and is empty for the start", () => {
    expect(linkLineText([parent({ ghost: true, people: [] })])).toBe(
      "From In Utero (deleted)",
    );
    expect(linkLineText([])).toBe("");
  });

  it("gives every name in the accessible label", () => {
    expect(linkLineLabel([parent({})])).toBe(
      "Linked from In Utero by Steve Albini, Krist Novoselic and Dave Grohl",
    );
    expect(
      linkLineLabel([
        parent({ people: [1], names: ["Steve Albini"] }),
        parent({ title: "Surfer Rosa", ghost: true, people: [5], names: [] }),
      ]),
    ).toBe(
      "Linked from In Utero by Steve Albini; and from Surfer Rosa (deleted) by 1 person",
    );
    expect(linkLineLabel([])).toBe("");
  });
});

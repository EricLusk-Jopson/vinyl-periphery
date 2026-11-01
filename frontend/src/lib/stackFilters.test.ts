import { SearchCache } from "@/contexts/cache/types";
import { metaAlbum, resultPeople } from "./metaAlbum";
import {
  albumsOn,
  defaultStackFilters,
  filteredStackResults,
  filtersFromMembers,
  linkedAlbumsText,
  requireInStack,
  stackMustIncludeOptions,
  stackRequiredChips,
  searchParentFor,
  sortStackResults,
  stackAlbumChips,
  stackFilterCount,
  stackPeopleChips,
  stackRoleGroups,
  StackFilterState,
  withStackDefaults,
} from "./stackFilters";

type Person = [number, string, string[], string[]?];

const release = (
  id: number,
  title: string,
  people: number[],
  extra: Record<string, unknown> = {},
) => ({
  id,
  type: "master",
  key: `master:${id}`,
  title,
  artist: `${title} Artist`,
  year: "1990",
  thumb: "",
  resource_url: "",
  contributorIds: people,
  ...extra,
});

const member = (
  id: number,
  album: string,
  people: Person[],
  releases: ReturnType<typeof release>[],
): SearchCache =>
  ({
    searchId: `${album}-${id}`,
    searchParams: { artist: `${album} Artist`, album },
    target: { type: "master", id, key: `master:${id}` },
    thumb: "",
    contributors: Object.fromEntries(
      people.map(([pid, name, roles, sources]) => [
        pid,
        { id: pid, name, roles, sources: sources ?? ["credits"] },
      ]),
    ),
    roles: Object.fromEntries(
      people.flatMap(([, , r]) => r.map((x) => [x, true])),
    ),
    releases: Object.fromEntries(releases.map((r) => [r.key, r])),
    filterState: {
      contributors: Object.fromEntries(people.map(([pid]) => [pid, true])),
      roles: Object.fromEntries(
        people.flatMap(([, , r]) => r.map((x) => [x, true])),
      ),
      excludeMainArtist: false,
      collaborationsOnly: false,
      excludeVarious: false,
    },
  }) as unknown as SearchCache;

// In Utero (Albini engineer, Novoselic bass, Grohl drums) and Surfer Rosa
// (Albini engineer, Francis vocals). Albini is on both.
const inUtero = member(
  1,
  "In Utero",
  [
    [10, "Steve Albini", ["Engineer"]],
    [11, "Krist Novoselic", ["Bass"]],
    [12, "Dave Grohl", ["Drums"]],
  ],
  [
    release(100, "Rid of Me", [10]),
    release(101, "Sweet 75", [11]),
    release(102, "Foo Fighters", [12, 10]),
    release(2, "Surfer Rosa", [10]),
  ],
);
const surferRosa = member(
  2,
  "Surfer Rosa",
  [
    [10, "Steve Albini", ["Engineer", "Mixed By"]],
    [13, "Black Francis", ["Vocals"]],
  ],
  [
    release(100, "Rid of Me", [10], { community: { want: 5, have: 10 } }),
    release(103, "Frank Black", [13]),
    release(104, "Pod", [10, 13], { artist: "Various" }),
  ],
);
const meta = metaAlbum([inUtero, surferRosa]);
const filters = (over: Partial<StackFilterState> = {}): StackFilterState => ({
  ...defaultStackFilters(),
  excludeMainArtist: false,
  ...over,
});
const keys = (results: { key: string }[]) => results.map((r) => r.key);

describe("metaAlbum", () => {
  it("merges results, less the members, keeping who links each", () => {
    expect(meta.members.map((m) => m.key)).toEqual(["master:1", "master:2"]);
    expect(Array.from(meta.results.keys()).sort()).toEqual([
      "master:100",
      "master:101",
      "master:102",
      "master:103",
      "master:104",
    ]);
    const ridOfMe = meta.results.get("master:100")!;
    expect(ridOfMe.links).toEqual([
      { album: "master:1", people: [10] },
      { album: "master:2", people: [10] },
    ]);
    // Counts from whichever member kept them.
    expect(ridOfMe.release.community).toEqual({ want: 5, have: 10 });
    expect(resultPeople(ridOfMe)).toEqual([10]);
  });

  it("dedupes people, with every role and member album", () => {
    const albini = meta.people.find((p) => p.id === 10)!;
    expect(albini.roles).toEqual(["Engineer", "Mixed By"]);
    expect(albini.albums).toEqual(["master:1", "master:2"]);
    expect(meta.people[0].id).toBe(10);
    expect(meta.credits).toContainEqual({
      person: 10,
      role: "Mixed By",
      album: "master:2",
    });
  });

  it("keeps one member per album", () => {
    expect(
      metaAlbum([inUtero, { ...inUtero, searchId: "again" }]).members,
    ).toHaveLength(1);
  });
});

describe("filteredStackResults", () => {
  it("scores links and shared, ranking most links first", () => {
    const results = filteredStackResults(meta, filters());
    expect(results[0]).toMatchObject({
      key: "master:100",
      links: 2,
      activeContributors: [10],
    });
    const pod = results.find((r) => r.key === "master:104")!;
    expect(pod.links).toBe(1);
    expect(pod.activeContributors).toEqual([10, 13]);
    expect(albumsOn(meta, filters())).toBe(2);
  });

  it("drops an album's links when it's switched off", () => {
    const f = filters({ albums: { "master:2": false } });
    const results = filteredStackResults(meta, f);
    expect(keys(results)).not.toContain("master:103");
    expect(results.find((r) => r.key === "master:100")?.links).toBe(1);
    expect(albumsOn(meta, f)).toBe(1);
  });

  it("works on credits: a role off on one album leaves the other", () => {
    // Albini's Mixed By credit on Surfer Rosa keeps him there.
    const results = filteredStackResults(
      meta,
      filters({ roles: { Engineer: false } }),
    );
    const ridOfMe = results.find((r) => r.key === "master:100")!;
    expect(ridOfMe.linkedAlbums).toEqual([{ album: "master:2", people: [10] }]);
  });

  it("applies the switches", () => {
    expect(
      keys(filteredStackResults(meta, filters({ linksTwoPlus: true }))),
    ).toEqual(["master:100"]);
    expect(
      keys(
        filteredStackResults(meta, filters({ collaborationsOnly: true })),
      ).sort(),
    ).toEqual(["master:102", "master:104"]);
    expect(
      keys(filteredStackResults(meta, filters({ excludeVarious: true }))),
    ).not.toContain("master:104");
    expect(
      keys(
        filteredStackResults(meta, filters({ likedOnly: true }), {
          "master:101": { title: "", artist: "", at: 0 },
        } as never),
      ),
    ).toEqual(["master:101"]);
    expect(
      keys(filteredStackResults(meta, filters(), {}, { "master:101": true })),
    ).not.toContain("master:101");
  });

  it("requires people, roles and albums", () => {
    const req = (r: Partial<StackFilterState["required"]>) =>
      filters({ required: { contributors: [], roles: [], albums: [], ...r } });
    expect(
      keys(filteredStackResults(meta, req({ contributors: [13] }))).sort(),
    ).toEqual(["master:103", "master:104"]);
    expect(keys(filteredStackResults(meta, req({ roles: ["Drums"] })))).toEqual(
      ["master:102"],
    );
    expect(
      keys(filteredStackResults(meta, req({ albums: ["master:1"] }))).sort(),
    ).toEqual(["master:100", "master:101", "master:102"]);
  });

  it("keeps a required person whose roles are off", () => {
    const results = filteredStackResults(
      meta,
      filters({
        roles: { Vocals: false },
        required: { contributors: [13], roles: [], albums: [] },
      }),
    );
    expect(keys(results)).toContain("master:103");
  });

  it("hides any member artist's own releases", () => {
    const own = member(
      3,
      "Nevermind",
      [[11, "Krist Novoselic", ["Bass"], ["artist", "credits"]]],
      [
        release(101, "Sweet 75", [11], {
          contributions: { 11: [{ role: "Main" }] },
        }),
      ],
    );
    const withOwn = metaAlbum([inUtero, own]);
    expect(
      keys(filteredStackResults(withOwn, filters({ excludeMainArtist: true }))),
    ).not.toContain("master:101");
  });
});

describe("sortStackResults", () => {
  const results = filteredStackResults(meta, filters());

  it("sorts by links, then shared, then the tiebreaker", () => {
    const sorted = sortStackResults(results, "links", "artist");
    expect(keys(sorted)).toEqual([
      "master:100",
      "master:102",
      "master:104",
      "master:103",
      "master:101",
    ]);
    // Without a tiebreaker, the ranking.
    expect(sortStackResults(results, "links", null)).toBe(results);
  });

  it("sorts the usual ways too", () => {
    expect(keys(sortStackResults(results, "popular", null))[0]).toBe(
      "master:100",
    );
  });
});

describe("linkedAlbumsText and searchParentFor", () => {
  const results = filteredStackResults(meta, filters());
  const pod = results.find((r) => r.key === "master:104")!;
  const ridOfMe = results.find((r) => r.key === "master:100")!;

  it("names the albums linking a result", () => {
    expect(linkedAlbumsText(ridOfMe, meta)).toBe(
      "via In Utero (1), Surfer Rosa (1)",
    );
  });

  it("hangs a search on the member sharing most, then nearest the start", () => {
    const levels = new Map([
      [inUtero.searchId, 0],
      [surferRosa.searchId, 1],
    ]);
    expect(searchParentFor(pod, meta, levels)).toEqual({
      parent: surferRosa,
      via: [10, 13],
    });
    expect(searchParentFor(ridOfMe, meta, levels)?.parent).toBe(inUtero);
  });
});

describe("stack chips", () => {
  it("lists albums with their result counts and states", () => {
    const chips = stackAlbumChips(
      meta,
      filters({
        albums: { "master:2": false },
        required: { contributors: [], roles: [], albums: ["master:1"] },
      }),
    );
    expect(
      chips.map((c) => [c.title, c.count, c.included, c.required]),
    ).toEqual([
      ["In Utero", 3, true, true],
      ["Surfer Rosa", 3, false, false],
    ]);
  });

  it("lists people by results, with their albums and availability", () => {
    const chips = stackPeopleChips(meta, filters({ roles: { Vocals: false } }));
    expect(chips[0]).toMatchObject({
      name: "Steve Albini",
      count: 3,
      albums: ["master:1", "master:2"],
    });
    expect(chips.find((c) => c.id === 13)?.available).toBe(false);
  });

  it("groups roles by category", () => {
    const groups = stackRoleGroups(
      meta,
      filters({ contributors: { 12: false } }),
    );
    const drums = groups
      .flatMap((g) => g.roles)
      .find((r) => r.role === "Drums")!;
    expect(drums.available).toBe(false);
    expect(drums.people).toEqual([
      { id: 12, name: "Dave Grohl", included: false },
    ]);
  });
});

describe("stored state and member filters", () => {
  it("counts what differs from a new stack", () => {
    expect(stackFilterCount(defaultStackFilters())).toBe(0);
    expect(
      stackFilterCount({
        ...defaultStackFilters(),
        albums: { a: false },
        linksTwoPlus: true,
      }),
    ).toBe(2);
  });

  it("reads partial records over the defaults", () => {
    expect(withStackDefaults({ linksTwoPlus: true }).required.albums).toEqual(
      [],
    );
    expect(withStackDefaults(undefined)).toEqual(defaultStackFilters());
  });

  it("takes people and roles off only where every member has them off", () => {
    const a = {
      ...inUtero,
      filterState: {
        ...inUtero.filterState,
        contributors: { 10: false, 11: false, 12: true },
        roles: { Engineer: false, Bass: true, Drums: true },
        excludeMainArtist: true,
        required: { contributors: [12], roles: [] },
      },
    };
    const b = {
      ...surferRosa,
      filterState: {
        ...surferRosa.filterState,
        contributors: { 10: true, 13: true },
        roles: { Engineer: false, "Mixed By": true, Vocals: true },
        excludeMainArtist: true,
      },
    };
    const applied = filtersFromMembers(metaAlbum([a, b]));
    expect(applied.contributors).toEqual({ 11: false });
    expect(applied.roles).toEqual({ Engineer: false });
    expect(applied.excludeMainArtist).toBe(true);
    expect(applied.collaborationsOnly).toBe(false);
    expect(applied.required).toEqual({
      contributors: [12],
      roles: [],
      albums: [],
    });
  });
});

describe("must include", () => {
  it("finds the stack's albums by title or artist, before people", () => {
    expect(
      stackMustIncludeOptions(meta, filters(), "surfer").map((o) => o.kind),
    ).toEqual(["album"]);
    expect(
      stackMustIncludeOptions(meta, filters(), "In Utero Artist")[0],
    ).toEqual({
      kind: "album",
      key: "master:1",
      label: "In Utero",
      detail: "In Utero Artist",
    });
  });

  it("requires an album, switching it on, and lists it first", () => {
    const album = stackMustIncludeOptions(meta, filters(), "surfer")[0];
    const f = filters({ albums: { "master:2": false } });
    const required = { ...f, ...requireInStack(f, album, true) };
    expect(required.required.albums).toEqual(["master:2"]);
    expect(required.albums).toEqual({});
    expect(stackRequiredChips(meta, required)[0]).toEqual(album);
    // No longer offered once required.
    expect(stackMustIncludeOptions(meta, required, "surfer")).toEqual([]);
    const removed = { ...required, ...requireInStack(required, album, false) };
    expect(removed.required.albums).toEqual([]);
  });
});

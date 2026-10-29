import { SearchCache } from "@/contexts/cache/types";
import { ScoredRelease } from "./results";
import {
  editsCaption,
  filtersToInclude,
  NO_EDITS,
  scoredFor,
  shareSelection,
} from "./shareSelection";

const release = (id: number, people: number[]) => ({
  id,
  type: "master" as const,
  key: `master:${id}`,
  title: `Album ${id}`,
  artist: "Someone",
  year: "2000",
  thumb: "",
  resource_url: "",
  contributorIds: people,
});

const person = (id: number, roles: string[]) => ({
  id,
  name: `Person ${id}`,
  roles,
  sources: ["credits" as const],
  resourceUrl: "",
});

const makeSearch = (): SearchCache => ({
  searchId: "s",
  searchParams: { artist: "A", album: "B" },
  contributors: {
    1: person(1, ["Drums"]),
    2: person(2, ["Producer"]),
    3: person(3, ["Design", "Photography"]),
  },
  roles: { Drums: true, Producer: true, Design: true, Photography: true },
  releases: Object.fromEntries(
    [
      release(10, [1, 2]),
      release(11, [1]),
      release(12, [2]),
      release(13, [1, 2]),
      release(14, [3]),
    ].map((r) => [r.key, r]),
  ),
  filterState: {
    contributors: { 1: true, 2: true, 3: false },
    roles: { Drums: true, Producer: true, Design: false, Photography: true },
    excludeMainArtist: true,
    collaborationsOnly: false,
    excludeVarious: false,
  },
  thumb: "",
});

// The list as the page shows it: 3 is off, so album 14 is hidden.
const ranked = (search: SearchCache): ScoredRelease[] =>
  ["master:10", "master:13", "master:11", "master:12"].map(
    (key) => scoredFor(search, key)!,
  );
const keys = (r: ScoredRelease[]) => r.map((x) => x.key);

describe("shareSelection", () => {
  it("is the top of the list without edits", () => {
    const search = makeSearch();
    expect(keys(shareSelection(search, ranked(search), 3, NO_EDITS))).toEqual([
      "master:10",
      "master:13",
      "master:11",
    ]);
  });

  it("fills a removed album's place from further down", () => {
    const search = makeSearch();
    const edits = { removed: ["master:13"], added: [] };
    expect(keys(shareSelection(search, ranked(search), 3, edits))).toEqual([
      "master:10",
      "master:11",
      "master:12",
    ]);
  });

  it("keeps added albums within the count, in list order", () => {
    const search = makeSearch();
    const edits = { removed: [], added: ["master:12"] };
    expect(keys(shareSelection(search, ranked(search), 2, edits))).toEqual([
      "master:10",
      "master:12",
    ]);
  });

  it("places an added album the list hides by its shared count", () => {
    const search = makeSearch();
    search.filterState.contributors[3] = true;
    search.filterState.roles.Design = true;
    // 14 has one person: after the two-person albums.
    const edits = { removed: [], added: ["master:14"] };
    expect(keys(shareSelection(search, ranked(search), 3, edits))).toEqual([
      "master:10",
      "master:13",
      "master:14",
    ]);
  });
});

describe("filtersToInclude", () => {
  it("switches on the album's people and all their roles, nothing off", () => {
    const update = filtersToInclude(makeSearch(), "master:14");
    expect(update).toEqual({
      contributors: { 1: true, 2: true, 3: true },
      roles: { Drums: true, Producer: true, Design: true, Photography: true },
    });
  });

  it("is null for an unknown album", () => {
    expect(filtersToInclude(makeSearch(), "master:99")).toBeNull();
  });
});

describe("scoredFor", () => {
  it("links an album by the people the filters count", () => {
    const search = makeSearch();
    expect(scoredFor(search, "master:14")?.activeContributors).toEqual([]);
    search.filterState.contributors[3] = true;
    expect(scoredFor(search, "master:14")?.activeContributors).toEqual([3]);
  });
});

describe("editsCaption", () => {
  it("says what was changed, if anything", () => {
    expect(editsCaption(NO_EDITS)).toBe("");
    expect(editsCaption({ removed: ["a", "b"], added: ["c"] })).toBe(
      "2 removed · 1 added",
    );
  });
});

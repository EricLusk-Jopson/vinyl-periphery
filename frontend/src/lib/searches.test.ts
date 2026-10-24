import { recentSearches, searchStartedAt, titleInitials } from "./searches";
import { SearchCache } from "@/contexts/cache/types";

const search = (searchId: string): SearchCache => ({
  searchId,
  searchParams: { artist: "a", album: "b" },
  contributors: {},
  roles: {},
  releases: {},
  filterState: {
    contributors: {},
    roles: {},
    excludeMainArtist: false,
    collaborationsOnly: false,
    excludeVarious: false,
  },
  thumb: "",
});

describe("searchStartedAt", () => {
  it("reads the timestamp at the end of the id", () => {
    expect(searchStartedAt("Talk Talk-Spirit of Eden-1700000000000")).toBe(
      1700000000000
    );
  });

  it("copes with hyphens in the artist or album", () => {
    expect(searchStartedAt("Jay-Z-The Blueprint-1700000000001")).toBe(
      1700000000001
    );
  });

  it("returns 0 when there is no timestamp", () => {
    expect(searchStartedAt("no-timestamp-here")).toBe(0);
  });
});

describe("recentSearches", () => {
  it("sorts newest first by time, not by id", () => {
    const searches = {
      a: search("Aja-Steely Dan-300"),
      b: search("Zebra-Beach House-100"),
      c: search("Moon-Pink Floyd-200"),
    };
    expect(recentSearches(searches, 3).map((s) => s.searchId)).toEqual([
      "Aja-Steely Dan-300",
      "Moon-Pink Floyd-200",
      "Zebra-Beach House-100",
    ]);
  });

  it("limits the count", () => {
    const searches = {
      a: search("a-a-1"),
      b: search("b-b-2"),
      c: search("c-c-3"),
    };
    expect(recentSearches(searches, 2)).toHaveLength(2);
  });
});

describe("titleInitials", () => {
  it("skips small words", () => {
    expect(titleInitials("The Dark Side of the Moon")).toBe("DS");
    expect(titleInitials("Spirit of Eden")).toBe("SE");
  });

  it("handles single words and punctuation", () => {
    expect(titleInitials("Aja")).toBe("A");
    expect(titleInitials("(What's the Story) Morning Glory?")).toBe("WS");
  });

  it("falls back to small words when there is nothing else", () => {
    expect(titleInitials("The The")).toBe("TT");
  });

  it("returns an empty string for an empty title", () => {
    expect(titleInitials("  ")).toBe("");
  });
});

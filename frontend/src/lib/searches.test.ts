import {
  coverUrl,
  recentSearches,
  searchStartedAt,
  timeAgo,
  titleInitials,
  usableImageUrl,
} from "./searches";
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
      1700000000000,
    );
  });

  it("copes with hyphens in the artist or album", () => {
    expect(searchStartedAt("Jay-Z-The Blueprint-1700000000001")).toBe(
      1700000000001,
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

const SPACER = "https://st.discogs.com/abc123/images/spacer.gif";
const THUMB = "https://i.discogs.com/abc/rs:fit/w:150/R-1.jpeg";
const COVER = "https://i.discogs.com/abc/rs:fit/w:600/R-1.jpeg";

describe("usableImageUrl", () => {
  it("keeps a real image URL", () => {
    expect(usableImageUrl(THUMB)).toBe(THUMB);
  });

  it("drops empty values and the Discogs spacer", () => {
    expect(usableImageUrl("")).toBe("");
    expect(usableImageUrl("   ")).toBe("");
    expect(usableImageUrl(undefined)).toBe("");
    expect(usableImageUrl(null)).toBe("");
    expect(usableImageUrl(SPACER)).toBe("");
    expect(usableImageUrl(`${SPACER}?v=2`)).toBe("");
  });

  it("drops anything that is not an http(s) URL", () => {
    expect(usableImageUrl("javascript:alert(1)")).toBe("");
    expect(usableImageUrl("/images/cover.jpg")).toBe("");
  });
});

describe("coverUrl", () => {
  it("prefers the thumbnail", () => {
    expect(coverUrl({ thumb: THUMB, cover_image: COVER })).toBe(THUMB);
  });

  it("falls back to the cover when the thumbnail is empty or a spacer", () => {
    expect(coverUrl({ thumb: "", cover_image: COVER })).toBe(COVER);
    expect(coverUrl({ thumb: SPACER, cover_image: COVER })).toBe(COVER);
  });

  it("returns an empty string when neither is usable", () => {
    expect(coverUrl({ thumb: SPACER, cover_image: SPACER })).toBe("");
    expect(coverUrl(undefined)).toBe("");
  });
});

describe("timeAgo", () => {
  const now = new Date(2026, 9, 24, 12, 0).getTime();
  const ago = (ms: number) => timeAgo(now - ms, now);
  const MIN = 60000;

  it("gives minutes and hours for today", () => {
    expect(ago(20 * 1000)).toBe("just now");
    expect(ago(5 * MIN)).toBe("5 min ago");
    expect(ago(3 * 60 * MIN)).toBe("3 h ago");
  });

  it("gives days for the last week", () => {
    expect(ago(25 * 60 * MIN)).toBe("yesterday");
    expect(ago(4 * 24 * 60 * MIN)).toBe("4 days ago");
  });

  it("gives a date after that, with the year when it differs", () => {
    expect(timeAgo(new Date(2026, 2, 12).getTime(), now)).toBe("12 Mar");
    expect(timeAgo(new Date(2025, 11, 30).getTime(), now)).toBe("30 Dec 2025");
  });
});

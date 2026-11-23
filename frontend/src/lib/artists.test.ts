import { SearchCache } from "@/contexts/cache/types";
import { rootLineage } from "./lineage";
import {
  artistIdOf,
  artistKeyOf,
  artistMemberFor,
  holds,
  holdsByArtist,
  memberFor,
  StackRecord,
  stepsFromStart,
  strandedBy,
} from "./stackRecords";
import {
  activeAlbumsText,
  albumsOnOf,
  artistStack,
  libraryArtists,
  libraryStacks,
  searchArtists,
  stackBadge,
  stackLayout,
  stackRoot,
} from "./stacks";
import {
  artistIdFromRoute,
  artistPath,
  backLink,
  fromLocation,
  pageBackKind,
} from "./routes";

/** An album by `artist` whose results are these album ids, via person 1. */
const album = (
  id: number,
  title: string,
  artist: string,
  results: number[] = [],
  at = 1000 + id,
) =>
  ({
    searchId: `${title}-${at}`,
    searchParams: { artist, album: title },
    target: { type: "master", id, key: `master:${id}` },
    thumb: "",
    lineage: rootLineage(`${title}-${at}`),
    contributors: { 1: { id: 1, name: "Steve Albini", roles: ["Engineer"] } },
    releases: Object.fromEntries(
      results.map((r) => [
        `master:${r}`,
        { key: `master:${r}`, contributorIds: [1] },
      ]),
    ),
  }) as unknown as SearchCache;

// Squid's two albums don't link each other; Yard links to Squid's second.
const bright = album(1, "Bright Green Field", "Squid (29)", [], 1001);
const oglt = album(2, "O Monolith", "Squid", [3], 1005);
const yard = album(3, "Yard", "Other", [9], 1003);
const loner = album(4, "Loner", "Someone", [], 1002);

const all = [bright, oglt, yard, loner];
const searches = Object.fromEntries(all.map((s) => [s.searchId, s]));
const saved = new Set(all.map((s) => s.searchId));

const artistRecord = (extra: SearchCache[] = []): StackRecord => ({
  id: "s1",
  name: "Squid + 1",
  members: [
    artistMemberFor("Squid", "", 1),
    ...extra.map((m) => memberFor(m, 1)),
  ],
  createdAt: 1,
  updatedAt: 1,
});

describe("artist ids", () => {
  it("ignores Discogs's numbers, case and spacing", () => {
    expect(artistKeyOf("Squid (29)")).toBe("artist:squid");
    expect(artistKeyOf("  The  Band ")).toBe("artist:the band");
    expect(artistIdOf(bright)).toBe(artistIdOf(oglt));
  });

  it("round-trips through the route", () => {
    expect(artistPath("artist:the band")).toBe("/library/artist/the%20band");
    expect(artistPath("artist:squid", "results")).toBe(
      "/library/artist/squid?view=results",
    );
    expect(artistIdFromRoute("the band")).toBe("artist:the band");
    expect(pageBackKind("/library/artist/squid")).toBe("artist");
    expect(fromLocation("/library/artist/the%20band")).toEqual({
      from: "artist",
      artistId: "artist:the band",
    });
    expect(backLink({ from: "artist", artistId: "artist:squid" })).toEqual({
      to: "/library/artist/squid",
      label: "Back to artist",
    });
  });
});

describe("libraryArtists", () => {
  it("groups every album by main artist, latest searched first", () => {
    const artists = libraryArtists(searches, saved);
    expect(artists.map((a) => a.name)).toEqual(["Squid", "Other", "Someone"]);
    expect(artists[0].albums).toEqual([bright, oglt]);
    expect(searchArtists(artists, "monolith").map((a) => a.name)).toEqual([
      "Squid",
    ]);
  });

  it("reads an artist as a stack with every album at step 0", () => {
    const squid = libraryArtists(searches, saved)[0];
    const stack = artistStack(squid);
    expect(stack.members).toEqual([bright, oglt]);
    const { levels } = stackLayout(stack);
    expect(levels.get(bright.searchId)).toBe(0);
    expect(levels.get(oglt.searchId)).toBe(0);
    expect(stackRoot(stack)).toMatchObject({ title: "Squid", search: oglt });
  });

  it("counts the albums switched on", () => {
    const on = albumsOnOf([bright, oglt], { "master:1": false });
    expect(on).toEqual([oglt]);
    expect(activeAlbumsText(1, 2)).toBe("1 of 2 albums on");
    expect(activeAlbumsText(2, 2)).toBe("2 albums");
  });
});

describe("a stack starting from an artist", () => {
  const stack = libraryStacks([artistRecord([yard])], searches, saved)[0];

  it("brings all the artist's albums in at step 0", () => {
    expect(stack.artist?.albums).toEqual([bright, oglt]);
    expect(stack.members).toEqual([bright, oglt, yard]);
    const { levels, ghosts } = stackLayout(stack);
    expect(levels.get(bright.searchId)).toBe(0);
    expect(levels.get(oglt.searchId)).toBe(0);
    expect(levels.get(yard.searchId)).toBe(1);
    expect(ghosts).toEqual([]);
  });

  it("holds the artist's albums, searched before or after", () => {
    const later = album(7, "Later", "SQUID", [], 2000);
    expect(holds(stack.record, later)).toBe(true);
    expect(holdsByArtist(stack.record, later)).toBe(true);
    expect(holdsByArtist(stack.record, yard)).toBe(false);
    expect(holds(stack.record, loner)).toBe(false);
  });

  it("strands what only linked through a removed start album", () => {
    expect(stepsFromStart([bright, oglt, yard], 2).get("master:3")).toBe(1);
    expect(strandedBy([bright, oglt, yard], new Set(["master:2"]), 2)).toEqual([
      yard,
    ]);
    expect(strandedBy([bright, oglt, yard], new Set(["master:1"]), 2)).toEqual(
      [],
    );
  });
});

describe("stackBadge", () => {
  const plain: StackRecord = {
    id: "s2",
    name: "Yard",
    members: [memberFor(yard, 1)],
    createdAt: 1,
    updatedAt: 1,
  };
  const stacks = libraryStacks([plain], searches, saved);

  it("marks an album in no stack that could join one", () => {
    // O Monolith links Yard.
    expect(stackBadge(oglt, stacks)).toBe("add");
    expect(stackBadge(loner, stacks)).toBeNull();
    expect(stackBadge(yard, stacks)).toBeNull();
  });
});

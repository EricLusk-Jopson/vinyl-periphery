import { SearchCache } from "@/contexts/cache/types";
import { ScoredRelease } from "./results";
import {
  artIdFromCoverUrl,
  cardPayload,
  contributorNames,
  encodeSharePayload,
  mapHasAlbums,
  mapPayload,
  shareImagePath,
  shareLink,
} from "./share";

const MBID = "1b022e01-4da6-387b-8658-8678046e4cef";
const cover = (kind: string) =>
  `https://coverartarchive.org/${kind}/${MBID}/front-250`;

const search = (id: number, album: string, people: [number, string][] = []) => {
  const s = {
    searchId: `A-${album}-${id}`,
    searchParams: { artist: `${album} Artist`, album },
    target: { type: "master", id, key: `master:${id}` },
    contributors: Object.fromEntries(
      people.map(([pid, name]) => [
        pid,
        { id: pid, name, roles: [], sources: [], resourceUrl: "" },
      ]),
    ),
    thumb: "",
  } as unknown as SearchCache;
  return s;
};

describe("artIdFromCoverUrl", () => {
  it("reads release-group and release art", () => {
    expect(artIdFromCoverUrl(cover("release-group"))).toBe(`g:${MBID}`);
    expect(artIdFromCoverUrl(cover("release"))).toBe(`r:${MBID}`);
    expect(artIdFromCoverUrl("https://i.discogs.com/x.jpg")).toBe("");
    expect(artIdFromCoverUrl(null)).toBe("");
  });
});

describe("cardPayload", () => {
  it("takes the searched album and the top results with shared counts", () => {
    const ranked = Array.from({ length: 8 }, (_, i) => ({
      key: `master:${i}`,
      title: `Album ${i}`,
      artist: "Someone",
      activeContributors: [1, 2].slice(0, (i % 2) + 1),
    })) as unknown as ScoredRelease[];
    const payload = cardPayload(search(9, "Unmap"), ranked, (key) =>
      key === "master:9" || key === "master:0" ? cover("release-group") : null,
    );
    expect(payload).toMatchObject({
      v: 1,
      l: "card",
      a: { t: "Unmap", r: "Unmap Artist", i: `g:${MBID}` },
    });
    if (payload.l !== "card") throw new Error();
    expect(payload.x).toHaveLength(6);
    expect(payload.x[0]).toEqual({
      t: "Album 0",
      r: "Someone",
      i: `g:${MBID}`,
      n: 1,
    });
    expect(payload.x[1].i).toBe("");
    expect(payload.x[1].n).toBe(2);
  });
});

describe("mapPayload", () => {
  const withResults = (
    s: SearchCache,
    results: Record<number, number[]>,
  ): SearchCache => ({
    ...s,
    releases: Object.fromEntries(
      Object.entries(results).map(([id, contributorIds]) => [
        `master:${id}`,
        {
          key: `master:${id}`,
          title: `Album ${id}`,
          artist: "Someone",
          contributorIds,
        },
      ]),
    ) as unknown as SearchCache["releases"],
  });
  const root = withResults(
    search(1, "Unmap", [
      [1, "Justin Vernon"],
      [2, "Brian Joseph (2)"],
    ]),
    { 2: [1, 2], 5: [1], 6: [2] },
  );
  const child = withResults(search(2, "Bon Iver", [[3, "Sean Carey"]]), {
    7: [3],
  });
  const searches = { [root.searchId]: root, [child.searchId]: child };
  const centre = { key: "master:1", title: "Unmap", artist: "Volcano Choir" };
  const likes = {
    "master:5": { title: "Album 5", artist: "Someone", likedAt: 1 },
    "master:2": { title: "Bon Iver", artist: "Bon Iver", likedAt: 2 },
    "master:99": { title: "Elsewhere", artist: "Nobody", likedAt: 3 },
  };

  it("puts the stack's albums and the liked ones in their results around the centre", () => {
    const payload = mapPayload(centre, [root, child], searches, likes, (key) =>
      key === "master:1" ? cover("release-group") : null,
    );
    if (payload.l !== "map") throw new Error();
    expect(payload.c).toEqual({
      t: "Unmap",
      r: "Volcano Choir",
      i: `g:${MBID}`,
    });
    // Bon Iver (a liked stack album, so bigger), then the liked Album 5;
    // Album 99 isn't in any result, and Album 6 isn't liked.
    expect(payload.n.map((n) => [n.t, n.z])).toEqual([
      ["Bon Iver", 2],
      ["Album 5", 1],
    ]);
    for (const n of payload.n) {
      expect(Math.hypot(n.x, n.y)).toBeLessThanOrEqual(1000);
    }
    // People around the rim, by name, disambiguation dropped.
    expect(payload.p.map((p) => p.n).sort()).toEqual([
      "Brian Joseph",
      "Justin Vernon",
    ]);
    for (const p of payload.p) {
      expect(p.a).toBeGreaterThanOrEqual(0);
      expect(p.a).toBeLessThan(360);
    }
  });

  it("names people from any search here", () => {
    const names = contributorNames(searches);
    expect(names.get(2)).toBe("Brian Joseph");
    expect(names.get(3)).toBe("Sean Carey");
  });

  it("knows when there's nothing around the centre", () => {
    const payload = mapPayload(centre, [root], searches, {}, () => null);
    expect(mapHasAlbums(payload)).toBe(false);
  });
});

describe("URLs", () => {
  const payload = {
    v: 1 as const,
    l: "card" as const,
    a: { t: "Ünmap ✓", r: "A", i: "" },
    x: [],
  };

  it("encodes UTF-8 as base64url", () => {
    const encoded = encodeSharePayload(payload);
    expect(encoded).not.toMatch(/[+/=]/);
    const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const json = decodeURIComponent(
      Array.from(
        binary,
        (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`,
      ).join(""),
    );
    expect(JSON.parse(json)).toEqual(payload);
  });

  it("builds the image and link URLs", () => {
    expect(shareImagePath(payload, "square")).toMatch(
      /^\/api\/og\?p=[\w-]+&size=square$/,
    );
    expect(
      shareLink(
        "https://vinylperiphery.com",
        payload,
        "/results?artist=a&album=b",
      ),
    ).toMatch(
      /^https:\/\/vinylperiphery\.com\/s\?p=[\w-]+&to=%2Fresults%3Fartist%3Da%26album%3Db$/,
    );
  });
});

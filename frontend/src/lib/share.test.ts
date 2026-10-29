import { SearchCache } from "@/contexts/cache/types";
import { ScoredRelease } from "./results";
import {
  artIdFromCoverUrl,
  cardPayload,
  encodeSharePayload,
  mapHasAlbums,
  stackMapPayload,
  stackCaption,
  shareImagePath,
  albumMapPayload,
  countOptions,
  canDrawLines,
  withView,
  selectionCaption,
  shareLink,
} from "./share";
import { layoutStackMap, stackResults } from "./stackMap";

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
    expect(payload.x).toHaveLength(5);
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

describe("stackMapPayload", () => {
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
      [2, "Brian Joseph"],
    ]),
    { 2: [1, 2], 5: [1], 6: [2] },
  );
  const child = withResults(search(2, "Bon Iver", [[3, "Sean Carey"]]), {
    7: [3],
    5: [3],
  });
  const centre = { key: "master:1", title: "Unmap", artist: "Volcano Choir" };
  const levels = new Map([
    [root.searchId, 0],
    [child.searchId, 1],
  ]);

  it("sends the stack a step apart and the results around it", () => {
    const keys = stackResults(centre, [root, child]).map((r) => r.key);
    const nodes = layoutStackMap(centre, [root, child], levels, {}, keys);
    const payload = stackMapPayload(
      centre,
      nodes,
      (key) => (key === "master:1" ? cover("release-group") : null),
      stackCaption(nodes),
    );
    if (payload.l !== "stack") throw new Error();
    expect(payload.c).toMatchObject({ t: "Unmap", i: `g:${MBID}` });
    const [step, ...results] = payload.n;
    // Bon Iver: a stack album, one step (1000) out, linked to the centre.
    expect(step).toMatchObject({ t: "Bon Iver", m: 1, e: [0] });
    expect(Math.hypot(step.x, step.y)).toBeCloseTo(1000, -1);
    // Album 5 shares people with both stack albums: linked to both.
    expect(results.find((r) => r.t === "Album 5")?.e).toEqual([0, 1]);
    expect(results.map((r) => r.t).sort()).toEqual([
      "Album 5",
      "Album 6",
      "Album 7",
    ]);
    expect(payload.d).toBe("2 albums stacked · 3 around them");
    expect(
      stackCaption(
        nodes,
        { sort: "popular", then: "newest", likesFirst: true },
        "1 removed",
      ),
    ).toBe(
      "2 albums stacked · 3 around them, by Popular, then Newest · Likes first · 1 removed",
    );
    expect(mapHasAlbums(payload)).toBe(true);
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
    expect(shareImagePath(payload)).toMatch(/^\/api\/og\?p=[\w-]+$/);
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

describe("selectionCaption", () => {
  const filtered = () => {
    const s = search(1, "Unmap", [
      [1, "Justin Vernon"],
      [2, "Brian Joseph (2)"],
      [3, "Chris Rosenau"],
    ]);
    s.roles = { Vocals: true, Engineer: true };
    s.filterState = {
      contributors: { 1: true, 2: true, 3: true },
      roles: { Vocals: true, Engineer: true },
      excludeMainArtist: true,
      collaborationsOnly: false,
      excludeVarious: false,
    };
    return s;
  };

  it("names the sorts, and nothing else at the reset state", () => {
    expect(selectionCaption(filtered(), 12, "shared", null)).toBe(
      "Top 12 by Shared",
    );
    expect(selectionCaption(filtered(), 5, "shared", "newest")).toBe(
      "Top 5 by Shared, then Newest",
    );
  });

  it("names each filter that differs from Reset", () => {
    const s = filtered();
    s.filterState.likedOnly = true;
    s.filterState.collaborationsOnly = true;
    s.filterState.contributors[3] = false;
    s.filterState.roles.Engineer = false;
    s.filterState.required = { contributors: [2], roles: ["Vocals"] };
    expect(selectionCaption(s, 12, "popular", null)).toBe(
      "Top 12 by Popular · Liked only · 2+ shared · Must include Brian Joseph, Vocals · 1 person off · 1 role off",
    );
  });
});

describe("albumMapPayload", () => {
  it("places the top results and labels the people, with the caption", () => {
    const s = search(1, "Unmap", [
      [1, "Justin Vernon"],
      [2, "Brian Joseph"],
    ]);
    const shown = [
      {
        key: "master:5",
        title: "Bon Iver",
        artist: "Bon Iver",
        activeContributors: [1, 2],
      },
      {
        key: "master:6",
        title: "Hideaway",
        artist: "S. Carey",
        activeContributors: [1],
      },
    ] as unknown as ScoredRelease[];
    const payload = albumMapPayload(
      s,
      shown,
      {},
      () => null,
      "Top 2 by Shared",
    );
    if (payload.l !== "map") throw new Error();
    expect(payload.c.t).toBe("Unmap");
    expect(payload.n.map((n) => n.t)).toEqual(["Bon Iver", "Hideaway"]);
    expect(payload.n.every((n) => typeof n.s === "number")).toBe(true);
    // One person: just outside the circle.
    expect(Math.hypot(payload.n[1].x, payload.n[1].y)).toBeGreaterThan(1000);
    expect(payload.p.map((p) => p.n).sort()).toEqual([
      "Brian Joseph",
      "Justin Vernon",
    ]);
    expect(payload.d).toBe("Top 2 by Shared");
  });
});

describe("countOptions", () => {
  const labels = (o: { label: string }[]) => o.map((c) => c.label);

  it("offers every count when there are plenty of albums", () => {
    expect(labels(countOptions("map", 40))).toEqual(["6", "12", "18", "24"]);
    expect(labels(countOptions("card", 30))).toEqual(["3", "5", "8", "10"]);
  });

  it("ends with All when fewer albums match than the largest count", () => {
    expect(countOptions("map", 15)).toEqual([
      { count: 6, label: "6" },
      { count: 12, label: "12" },
      { count: 15, label: "All 15" },
    ]);
    expect(labels(countOptions("map", 24))).toEqual([
      "6",
      "12",
      "18",
      "All 24",
    ]);
    expect(labels(countOptions("card", 4))).toEqual(["3", "All 4"]);
  });

  it("offers nothing when there's nothing to choose", () => {
    expect(countOptions("card", 3)).toEqual([]);
    expect(countOptions("map", 1)).toEqual([]);
    expect(countOptions("map", 0)).toEqual([]);
  });
});

describe("withView", () => {
  const map = {
    v: 1 as const,
    l: "map" as const,
    c: { t: "C", r: "", i: "" },
    n: [{ t: "A", r: "", i: "", x: 0, y: 0, z: 1 as const, l: [0] }],
    p: [{ n: "P", a: 0 }],
  };

  it("keeps links only when lines are on", () => {
    expect(canDrawLines(map)).toBe(true);
    const plain = withView(map, {
      covers: true,
      lines: false,
      boilerplate: true,
    });
    expect(plain).not.toHaveProperty("ln");
    if (plain.l !== "map") throw new Error();
    expect(plain.n[0]).not.toHaveProperty("l");
    const lined = withView(map, {
      covers: true,
      lines: true,
      boilerplate: true,
    });
    if (lined.l !== "map") throw new Error();
    expect(lined.ln).toBe(1);
    expect(lined.n[0].l).toEqual([0]);
  });

  it("marks no covers on either layout", () => {
    expect(
      withView(map, { covers: false, lines: false, boilerplate: true }),
    ).toMatchObject({
      nc: 1,
    });
    const card = { v: 1 as const, l: "card" as const, a: map.c, x: [] };
    expect(
      withView(card, { covers: false, lines: true, boilerplate: true }),
    ).toEqual({
      ...card,
      nc: 1,
    });
  });

  it("drops the boilerplate from maps only", () => {
    const bare = { covers: true, lines: false, boilerplate: false };
    expect(withView(map, bare)).toMatchObject({ nb: 1 });
    const card = { v: 1 as const, l: "card" as const, a: map.c, x: [] };
    expect(withView(card, bare)).not.toHaveProperty("nb");
  });

  it("draws no lines without people to run from", () => {
    const noLinks = { ...map, n: [{ ...map.n[0], l: [] }] };
    expect(canDrawLines(noLinks)).toBe(false);
    expect(
      withView(noLinks, { covers: true, lines: true, boilerplate: true }),
    ).not.toHaveProperty("ln");
  });
});

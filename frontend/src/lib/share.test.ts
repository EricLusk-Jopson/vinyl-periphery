import { SearchCache } from "@/contexts/cache/types";
import { ScoredRelease } from "./results";
import {
  artIdFromCoverUrl,
  cardPayload,
  mapHasAlbums,
  stackMapPayload,
  stackCaption,
  albumMapPayload,
  countOptions,
  canDrawLines,
  withView,
  selectionCaption,
  buildPayload,
  defaultDraft,
  draftChange,
  planShare,
  serialisePayload,
  ShareData,
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
    expect(artIdFromCoverUrl("https://i.discogs.com/x.jpg")).toBe("d:x.jpg");
    expect(
      artIdFromCoverUrl(
        "https://i.discogs.com/AbC/rs:fit/g:sm/q:90/h:600/w:600/czM6Ly9.jpeg",
      ),
    ).toBe("d:AbC/rs:fit/g:sm/q:90/h:600/w:600/czM6Ly9.jpeg");
    expect(artIdFromCoverUrl("https://i.discogs.com/a/../b.jpg")).toBe("");
    expect(artIdFromCoverUrl("https://i.discogs.com/x.jpg?y=1")).toBe("");
    expect(artIdFromCoverUrl("https://img.discogs.com/x.jpg")).toBe("");
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

describe("buildPayload and the draft", () => {
  const releases = Array.from({ length: 8 }, (_, i) => ({
    key: `master:${10 + i}`,
    title: `Album ${10 + i}`,
    artist: "Someone",
    year: String(2000 + i),
    contributorIds: [1, 2].slice(0, (i % 2) + 1),
    activeContributors: [1, 2].slice(0, (i % 2) + 1),
    score: (i % 2) + 1,
    confidence: 1,
  })) as unknown as ScoredRelease[];
  const base = () => {
    const s = search(9, "Unmap", [
      [1, "Justin Vernon"],
      [2, "Brian Joseph"],
    ]);
    s.releases = Object.fromEntries(releases.map((r) => [r.key, r]));
    s.roles = {};
    s.filterState = {
      contributors: { 1: true, 2: true },
      roles: {},
      excludeMainArtist: true,
      collaborationsOnly: false,
      excludeVarious: false,
    };
    return s;
  };
  let art: Record<string, string> = {};
  const data = (hidden: Record<string, unknown> = {}): ShareData => ({
    kind: "search",
    search: base(),
    releases,
    selection: { sort: "shared", then: null },
    likes: {},
    hidden,
    coverFor: (key) => art[key] ?? null,
  });
  beforeEach(() => {
    art = {};
  });

  it("draws the chosen layout and count, captioned, as the view says", () => {
    const draft = { ...defaultDraft(), chosen: "card" as const };
    draft.counts = { ...draft.counts, card: 3 };
    const payload = buildPayload(draft, data());
    if (payload.l !== "card") throw new Error();
    expect(payload.x).toHaveLength(3);
    // "Shared" alone keeps the page's ranking.
    expect(payload.x.map((x) => x.t)).toEqual([
      "Album 10",
      "Album 11",
      "Album 12",
    ]);
    expect(payload.d).toBe("Top 3 by Shared");
    const bare = buildPayload(
      { ...draft, view: { ...draft.view, covers: false } },
      data(),
    );
    expect(bare).toMatchObject({ l: "card", nc: 1 });
  });

  it("plans what the controls need: shown, available, covers to find", () => {
    const draft = defaultDraft();
    draft.counts = { ...draft.counts, map: 6 };
    const plan = planShare(draft, data({ "master:11": { at: 0 } }));
    expect(plan.layout).toBe("map");
    expect(plan.shown).toHaveLength(6);
    expect(plan.shown.map((r) => r.key)).not.toContain("master:11");
    expect(plan.available).toBe(7);
    expect(plan.wanted[0]).toBe("master:9");
    expect(plan.wanted).toHaveLength(7);
    const noCovers = planShare(
      { ...draft, view: { ...draft.view, covers: false } },
      data(),
    );
    expect(noCovers.wanted).toEqual([]);
  });

  it("is the same payload for the same draft and data", () => {
    const draft = defaultDraft();
    expect(serialisePayload(buildPayload(draft, data()))).toBe(
      serialisePayload(buildPayload(draft, data())),
    );
  });

  it("tells unchanged, cover-only and other changes apart", () => {
    const draft = defaultDraft();
    const committed = serialisePayload(buildPayload(draft, data()));
    expect(draftChange(buildPayload(draft, data()), committed)).toBe("same");
    // A cover found since: only art differs.
    art = { "master:11": cover("release-group") };
    expect(draftChange(buildPayload(draft, data()), committed)).toBe("covers");
    // A control changed.
    const fewer = { ...draft, counts: { ...draft.counts, map: 6 } };
    expect(draftChange(buildPayload(fewer, data()), committed)).toBe(
      "changed",
    );
    const lines = { ...draft, view: { ...draft.view, lines: true } };
    expect(draftChange(buildPayload(lines, data()), committed)).toBe(
      "changed",
    );
    // Nothing made yet, or nothing to compare: nothing to apply.
    expect(draftChange(buildPayload(draft, data()), null)).toBe("same");
    expect(draftChange(null, committed)).toBe("same");
  });

  it("ignores a change that doesn't alter the image", () => {
    const draft = defaultDraft();
    const committed = serialisePayload(buildPayload(draft, data()));
    // The card's count changes nothing while the map is shown.
    const card = { ...draft, counts: { ...draft.counts, card: 3 } };
    expect(draftChange(buildPayload(card, data()), committed)).toBe("same");
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

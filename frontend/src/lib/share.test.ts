import { SearchCache } from "@/contexts/cache/types";
import { childLineage, rootLineage } from "./lineage";
import { ScoredRelease } from "./results";
import {
  artIdFromCoverUrl,
  cardPayload,
  contributorNames,
  encodeSharePayload,
  hasTrail,
  shareImagePath,
  shareLink,
  trailPayload,
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

describe("trailPayload", () => {
  const root = search(1, "Unmap", [
    [1, "Justin Vernon"],
    [2, "Brian Joseph (2)"],
  ]);
  root.lineage = rootLineage(root.searchId);
  const child = search(2, "Bon Iver", [[3, "Sean Carey"]]);
  child.lineage = childLineage(root, [1, 2], cover("release"));
  const grand = search(3, "Hideaway");
  grand.lineage = childLineage(child, [3, 99], "");

  it("draws root to current, naming who linked each step", () => {
    const payload = trailPayload(
      grand,
      {
        [root.searchId]: root,
        [child.searchId]: child,
        [grand.searchId]: grand,
      },
      () => null,
    );
    if (payload.l !== "trail") throw new Error();
    expect(payload.s.map((s) => [s.t, s.v])).toEqual([
      ["Unmap", []],
      ["Bon Iver", ["Justin Vernon", "Brian Joseph"]],
      // 99 has no known name, so it's left out.
      ["Hideaway", ["Sean Carey"]],
    ]);
    // The root's art came from its snapshot.
    expect(payload.s[0].i).toBe(`r:${MBID}`);
  });

  it("names people from any search, even once a step is deleted", () => {
    const names = contributorNames({ [child.searchId]: child });
    expect(names.get(3)).toBe("Sean Carey");
    const payload = trailPayload(
      grand,
      { [child.searchId]: child },
      () => null,
    );
    if (payload.l !== "trail") throw new Error();
    expect(payload.s[1].v).toEqual([]);
    expect(payload.s[2].v).toEqual(["Sean Carey"]);
  });

  it("knows which searches have a trail", () => {
    expect(hasTrail(root)).toBe(false);
    expect(hasTrail(grand)).toBe(true);
  });
});

describe("URLs", () => {
  const payload = {
    v: 1 as const,
    l: "trail" as const,
    s: [{ t: "Ünmap ✓", r: "A", i: "", v: [] }],
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

// The share image's input: a compact JSON payload, base64url-encoded in the
// URL (?p=). It carries everything the image shows (titles, artists, art
// ids, counts, names), so rendering never calls Discogs or MusicBrainz; the
// only fetches are Cover Art Archive images.
//
// Version 1:
//   { v: 1, l: "card", a: Album, x: Result[], d? }             periphery card
//   { v: 1, l: "map",  c: Album, n: Placed[], p: Person[], d? } map
//   { v: 1, l: "stack", c: Album & { s }, n: Node[], d? }       stack map
//   Node   = Album & { x, y, s: place and cover side in thousandths of
//            a step, y up; m?: 1 for the stack's own albums;
//            e?: linked nodes, 0 the centre and k for n[k - 1] }
//   Album  = { t: title, r: artist, i: art }
//   Result = Album & { n: shared count }
//   Placed = Album & { x, y: thousandths of the radius from the centre,
//            y up, past 1000 for albums just outside the circle;
//            z: size tier, 1 or 2;
//            s?: cover side in thousandths of the radius, over z }
//   Person = { n: name, a: angle in degrees, counter-clockwise from the right }
//   art    = "g:<release-group mbid>" | "r:<release mbid>" | ""
//   d      = how the albums were chosen ("Top 12 by Shared · Liked only")
//   nc: 1  = no covers: every album drawn as its title and artist
//   nb: 1  = (maps) no boilerplate: no header, caption or site; the graph
//            fills the image
//   ln: 1  = (map) lines from each person to their albums, listed per
//            album as `l`: indices into p
//
// The map's positions are worked out by the client (shareMap.ts); the
// renderer only draws them.
//
// Keep in step with frontend/src/lib/share.ts, which builds it.

export const MAX_PAYLOAD_CHARS = 6000;
/** Rows on the results card: up to five full size, then smaller. */
export const MAX_RESULTS = 10;
export const MAX_MAP_ALBUMS = 24;
export const MAX_MAP_PEOPLE = 16;
const MAX_TITLE = 80;
const MAX_ARTIST = 60;
const MAX_NAME = 40;
const MAX_CAPTION = 160;
// Cover sides, as fractions of the radius; same as the client's MAP_SIZES
// (shareMap.ts). `s` overrides the tier, within these bounds.
export const MAP_SIZES = { centre: 0.46, 1: 0.28, 2: 0.36 };
const MIN_SIDE = 0.12;
const MAX_SIDE = 0.5;

const MBID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (value, max) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** "g:<mbid>" / "r:<mbid>", or "" for anything else. */
const art = (value) => {
  const match = /^([gr]):(.+)$/.exec(typeof value === "string" ? value : "");
  return match && MBID.test(match[2]) ? `${match[1]}:${match[2].toLowerCase()}` : "";
};

const album = (raw) => ({
  t: text(raw?.t, MAX_TITLE),
  r: text(raw?.r, MAX_ARTIST),
  i: art(raw?.i),
});

const list = (value, max) => (Array.isArray(value) ? value.slice(0, max) : []);

/**
 * The payload from its URL form, cleaned and clipped, or null when it's
 * missing, too long, malformed, or has nothing to draw.
 */
export function decodePayload(encoded) {
  if (typeof encoded !== "string" || encoded.length === 0) return null;
  if (encoded.length > MAX_PAYLOAD_CHARS) return null;
  let raw;
  try {
    raw = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!raw || raw.v !== 1) return null;

  if (raw.l === "card") {
    const searched = album(raw.a);
    if (!searched.t) return null;
    const results = list(raw.x, MAX_RESULTS)
      .map((r) => ({
        ...album(r),
        n: Math.max(0, Math.min(999, Math.floor(Number(r?.n) || 0))),
      }))
      .filter((r) => r.t);
    const caption = text(raw.d, MAX_CAPTION);
    return { layout: "card", album: searched, results, caption, covers: raw.nc !== 1 };
  }

  if (raw.l === "map") {
    const centre = album(raw.c);
    if (!centre.t) return null;
    const coordinate = (value) =>
      Math.max(-1500, Math.min(1500, Math.round(Number(value) || 0))) / 1000;
    const albums = list(raw.n, MAX_MAP_ALBUMS)
      .map((n) => ({
        ...album(n),
        x: coordinate(n?.x),
        y: coordinate(n?.y),
        z: n?.z === 2 ? 2 : 1,
        side: Number.isFinite(Number(n?.s)) && n?.s !== null && n?.s !== ""
          ? Math.max(MIN_SIDE, Math.min(MAX_SIDE, Number(n.s) / 1000))
          : MAP_SIZES[n?.z === 2 ? 2 : 1],
        links: list(n?.l, MAX_MAP_PEOPLE),
      }))
      .filter((n) => n.t);
    const named = list(raw.p, MAX_MAP_PEOPLE).map((p) => ({
      name: text(p?.n, MAX_NAME),
      angle: ((Math.round(Number(p?.a) || 0) % 360) + 360) % 360,
    }));
    const people = named.filter((p) => p.name);
    // Links point into `p` as sent; nameless people are dropped, so remap.
    const index = new Map(named.map((p, i) => [i, people.indexOf(p)]));
    const lines = raw.ln === 1;
    for (const album of albums) {
      album.links = lines
        ? [...new Set(album.links.map((i) => index.get(Number(i)) ?? -1))].filter((i) => i >= 0)
        : [];
    }
    const caption = text(raw.d, MAX_CAPTION);
    return albums.length > 0
      ? {
          layout: "map",
          centre,
          albums,
          people,
          caption,
          covers: raw.nc !== 1,
          lines,
          bare: raw.nb === 1,
        }
      : null;
  }

  if (raw.l === "stack") {
    const centre = album(raw.c);
    if (!centre.t) return null;
    // Steps from the centre: a long stack can reach a few steps out.
    const place = (value) =>
      Math.max(-12000, Math.min(12000, Math.round(Number(value) || 0))) / 1000;
    const side = (value, fallback) => {
      const n = Number(value);
      return Number.isFinite(n) && value !== null && value !== ""
        ? Math.max(0.1, Math.min(0.8, n / 1000))
        : fallback;
    };
    const lines = raw.ln === 1;
    const raws = list(raw.n, MAX_MAP_ALBUMS);
    const nodes = raws
      .map((n, k) => ({
        ...album(n),
        x: place(n?.x),
        y: place(n?.y),
        side: side(n?.s, 0.25),
        member: n?.m === 1,
        index: k + 1,
        links: lines ? list(n?.e, MAX_MAP_ALBUMS + 1).map(Number) : [],
      }))
      .filter((n) => n.t);
    // Links point at nodes as sent; untitled ones are dropped, so remap.
    const at = new Map([[0, 0], ...nodes.map((n, i) => [n.index, i + 1])]);
    for (const node of nodes) {
      node.links = [...new Set(node.links.map((k) => at.get(k) ?? -1))].filter((k) => k >= 0);
      delete node.index;
    }
    const caption = text(raw.d, MAX_CAPTION);
    return nodes.length > 0
      ? {
          layout: "stack",
          centre: { ...centre, side: side(raw.c?.s, 0.5) },
          albums: nodes,
          caption,
          covers: raw.nc !== 1,
          lines,
          bare: raw.nb === 1,
        }
      : null;
  }

  return null;
}

/** The URL form of a payload (for tests; the frontend has its own). */
export const encodePayload = (payload) =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

/** Share images are square, 1080x1080 (feeds, posts and stories alike). */
export const IMAGE_SIZE = { width: 1080, height: 1080, name: "square" };

/** The Cover Art Archive URL for an art id. */
export const coverArtUrl = (artId, px = 500) => {
  const [kind, mbid] = artId.split(":");
  if (!mbid) return "";
  return `https://coverartarchive.org/${kind === "g" ? "release-group" : "release"}/${mbid}/front-${px}`;
};

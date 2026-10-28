// The share image's input: a compact JSON payload, base64url-encoded in the
// URL (?p=). It carries everything the image shows (titles, artists, art
// ids, counts, names), so rendering never calls Discogs or MusicBrainz; the
// only fetches are Cover Art Archive images.
//
// Version 1:
//   { v: 1, l: "card", a: Album, x: Result[] }             periphery card
//   { v: 1, l: "map",  c: Album, n: Placed[], p: Person[] } map
//   Album  = { t: title, r: artist, i: art }
//   Result = Album & { n: shared count }
//   Placed = Album & { x, y: thousandths of the radius from the centre,
//            y up, past 1000 for albums just outside the circle;
//            z: size tier, 1 or 2 }
//   Person = { n: name, a: angle in degrees, counter-clockwise from the right }
//   art    = "g:<release-group mbid>" | "r:<release mbid>" | ""
//
// The map's positions are worked out by the client (shareMap.ts); the
// renderer only draws them.
//
// Keep in step with frontend/src/lib/share.ts, which builds it.

export const MAX_PAYLOAD_CHARS = 6000;
export const MAX_RESULTS = 6;
export const MAX_MAP_ALBUMS = 24;
export const MAX_MAP_PEOPLE = 8;
const MAX_TITLE = 80;
const MAX_ARTIST = 60;
const MAX_NAME = 40;

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
    return { layout: "card", album: searched, results };
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
      }))
      .filter((n) => n.t);
    const people = list(raw.p, MAX_MAP_PEOPLE)
      .map((p) => ({
        name: text(p?.n, MAX_NAME),
        angle: ((Math.round(Number(p?.a) || 0) % 360) + 360) % 360,
      }))
      .filter((p) => p.name);
    return albums.length > 0 ? { layout: "map", centre, albums, people } : null;
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

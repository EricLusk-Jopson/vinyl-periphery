// The share image's input: a compact JSON payload, base64url-encoded in the
// URL (?p=). It carries everything the image shows (titles, artists, art
// ids, counts, names), so rendering never calls Discogs or MusicBrainz; the
// only fetches are Cover Art Archive images.
//
// Version 1:
//   { v: 1, l: "card",  a: Album, x: Result[] }   periphery card
//   { v: 1, l: "trail", s: Step[] }               trail, root first
//   Album  = { t: title, r: artist, i: art }
//   Result = Album & { n: shared count }
//   Step   = Album & { v: via names (the link from the previous step) }
//   art    = "g:<release-group mbid>" | "r:<release mbid>" | ""
//
// Keep in step with frontend/src/lib/share.ts, which builds it.

export const MAX_PAYLOAD_CHARS = 4000;
export const MAX_RESULTS = 6;
export const MAX_STEPS = 6;
export const MAX_VIA = 4;
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

  if (raw.l === "trail") {
    const steps = list(raw.s, MAX_STEPS)
      .map((s) => ({
        ...album(s),
        via: list(s?.v, MAX_VIA)
          .map((name) => text(name, MAX_NAME))
          .filter(Boolean),
      }))
      .filter((s) => s.t);
    return steps.length > 0 ? { layout: "trail", steps } : null;
  }

  return null;
}

/** The URL form of a payload (for tests; the frontend has its own). */
export const encodePayload = (payload) =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

/** "1080x1920" (stories) or "1080x1080" (feed), from ?size=story|square. */
export const imageSize = (value) =>
  value === "square"
    ? { width: 1080, height: 1080, name: "square" }
    : { width: 1080, height: 1920, name: "story" };

/** The Cover Art Archive URL for an art id. */
export const coverArtUrl = (artId, px = 500) => {
  const [kind, mbid] = artId.split(":");
  if (!mbid) return "";
  return `https://coverartarchive.org/${kind === "g" ? "release-group" : "release"}/${mbid}/front-${px}`;
};

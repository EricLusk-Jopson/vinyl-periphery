// The share image's input: a compact JSON payload, sent as the body of
// POST /api/og. It carries everything the image shows (titles, artists, art
// ids, counts, names), so rendering never calls the Discogs API or
// MusicBrainz; the only fetches are cover images (Cover Art Archive, and
// i.discogs.com for covers found on Discogs).
//
// Version 1:
//   { v: 1, l: "card", a: Album, x: Result[], d? }             periphery card
//   { v: 1, l: "map",  c: Album, n: Placed[], p: Person[], d? } map
//   { v: 1, l: "stack", c: Album & { s }, n: Node[], d? }       stack map
//   { v: 1, l: "lanes", c: Album, y: [from, to], k: Mark[],     swimlanes
//     n: Lane[], u?, d? }
//   Mark   = { t: album title, y: year, m?: 1 for the searched album }
//   Lane   = { n: name, c: results, s: [year, count][] (results),
//            f: [year, count][] (their other items), p?: 1 when the page
//            cap cut their oldest items }
//   u      = undated items, not drawn
//   { v: 1, l: "transit", c: Album, w, h, s: Station[], n: Line[],  transit map
//     o?, d? }
//   Station = { t, r, x, y: its place, q: radius, k: colours of its lines,
//            b: [x, y, w, h] its label's box, a: "start" | "middle" | "end" }
//   Line   = { n: name, c: colour 0-5, g: legs, each [x, y][] }
//   o      = people on 2+ albums not drawn as lines
//   Places in layout units (w x h); the renderer scales them to fit.
//   Node   = Album & { x, y, s: place and cover side in thousandths of
//            a step, y up; m?: 1 for the stack's own albums;
//            e?: linked nodes, 0 the centre and k for n[k - 1];
//            w?: a result's line weight per link, 1 to 3 }
//   Album  = { t: title, r: artist, i: art }
//   Result = Album & { n: shared count }
//   Placed = Album & { x, y: thousandths of the radius from the centre,
//            y up, past 1000 for albums just outside the circle;
//            z: size tier, 1 or 2;
//            s?: cover side in thousandths of the radius, over z }
//   Person = { n: name, a: angle in degrees, counter-clockwise from the right }
//   art    = "g:<release-group mbid>" | "r:<release mbid>"
//            | "d:<path of an i.discogs.com image>" | ""
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

/** Largest body /api/og takes, as JSON text. */
export const MAX_PAYLOAD_BYTES = 32 * 1024;
/** Rows on the results card: up to five full size, then smaller. */
export const MAX_RESULTS = 10;
export const MAX_MAP_ALBUMS = 24;
export const MAX_MAP_PEOPLE = 16;
export const MAX_LANES = 8;
export const MAX_TRANSIT_STATIONS = 12;
export const MAX_TRANSIT_LINES = 6;
const MAX_LANE_YEARS = 150;
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

/**
 * The path of an i.discogs.com image URL: signed path segments only, no
 * host, query or way out of the path. The renderer puts the host back.
 */
const DISCOGS_PATH = /^(?!.*\.\.)(?!\/)[A-Za-z0-9._~:=+,%/-]{1,512}$/;

/** "g:<mbid>" / "r:<mbid>" / "d:<i.discogs.com path>", or "" for anything else. */
const art = (value) => {
  const match = /^([grd]):(.+)$/.exec(typeof value === "string" ? value : "");
  if (!match) return "";
  if (match[1] === "d") return DISCOGS_PATH.test(match[2]) ? `d:${match[2]}` : "";
  return MBID.test(match[2]) ? `${match[1]}:${match[2].toLowerCase()}` : "";
};

const album = (raw) => ({
  t: text(raw?.t, MAX_TITLE),
  r: text(raw?.r, MAX_ARTIST),
  i: art(raw?.i),
});

const list = (value, max) => (Array.isArray(value) ? value.slice(0, max) : []);

/**
 * A request body as a raw payload: already parsed (Express and Vercel parse
 * JSON bodies), or JSON text or bytes. Null when it isn't JSON or is over
 * MAX_PAYLOAD_BYTES.
 */
export function readBody(body) {
  let raw = body;
  if (Buffer.isBuffer(raw)) raw = raw.toString("utf8");
  if (typeof raw === "string") {
    if (Buffer.byteLength(raw, "utf8") > MAX_PAYLOAD_BYTES) return null;
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  } else if (raw && typeof raw === "object") {
    if (Buffer.byteLength(JSON.stringify(raw), "utf8") > MAX_PAYLOAD_BYTES) return null;
  }
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
}

/**
 * The payload, cleaned and clipped, or null when it's missing, malformed,
 * or has nothing to draw.
 */
export function parsePayload(raw) {
  if (!raw || typeof raw !== "object" || raw.v !== 1) return null;

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

  if (raw.l === "lanes") {
    const centre = album(raw.c);
    if (!centre.t) return null;
    const year = (value) => {
      const n = Math.round(Number(value));
      return Number.isFinite(n) && n >= 1800 && n <= 2100 ? n : null;
    };
    const ticks = (value) =>
      list(value, MAX_LANE_YEARS)
        .map((t) => [year(Array.isArray(t) ? t[0] : null), Math.max(1, Math.min(99, Math.round(Number(Array.isArray(t) ? t[1] : 1) || 1)))])
        .filter(([y]) => y !== null);
    const lanes = list(raw.n, MAX_LANES)
      .map((n) => ({
        name: text(n?.n, MAX_NAME),
        results: Math.max(0, Math.min(99999, Math.floor(Number(n?.c) || 0))),
        solid: ticks(n?.s),
        faint: ticks(n?.f),
        partial: n?.p === 1,
      }))
      .filter((n) => n.name && n.solid.length + n.faint.length > 0);
    const albums = list(raw.k, 8)
      .map((k) => ({ t: text(k?.t, MAX_TITLE), year: year(k?.y), accent: k?.m === 1 }))
      .filter((k) => k.year !== null);
    const years = [...lanes.flatMap((l) => [...l.solid, ...l.faint].map(([y]) => y)), ...albums.map((a) => a.year)];
    const range = Array.isArray(raw.y) ? raw.y.map(year) : [];
    const from = range[0] ?? Math.min(...years);
    const to = range[1] ?? Math.max(...years);
    if (lanes.length === 0 || !(from < to)) return null;
    return {
      layout: "lanes",
      centre,
      from,
      to,
      albums,
      lanes,
      undated: Math.max(0, Math.min(99999, Math.floor(Number(raw.u) || 0))),
      caption: text(raw.d, MAX_CAPTION),
      covers: false,
      bare: false,
    };
  }

  if (raw.l === "transit") {
    const centre = album(raw.c);
    if (!centre.t) return null;
    const unit = (value) => Math.max(0, Math.min(5000, Math.round(Number(value) * 10) / 10 || 0));
    const width = unit(raw.w);
    const height = unit(raw.h);
    if (!(width > 0 && height > 0)) return null;
    const colour = (value) => Math.max(0, Math.min(MAX_TRANSIT_LINES - 1, Math.floor(Number(value) || 0)));
    const stations = list(raw.s, MAX_TRANSIT_STATIONS)
      .map((s) => {
        const box = Array.isArray(s?.b) ? s.b.slice(0, 4).map(unit) : [0, 0, 0, 0];
        return {
          t: text(s?.t, MAX_TITLE),
          r: text(s?.r, MAX_ARTIST),
          x: unit(s?.x),
          y: unit(s?.y),
          radius: Math.max(3, Math.min(40, unit(s?.q) || 7)),
          lines: list(s?.k, MAX_TRANSIT_LINES).map(colour),
          label: { x: box[0], y: box[1], w: box[2], h: box[3] },
          align: ["start", "middle", "end"].includes(s?.a) ? s.a : "middle",
        };
      })
      .filter((s) => s.t);
    const lines = list(raw.n, MAX_TRANSIT_LINES)
      .map((n) => ({
        name: text(n?.n, MAX_NAME),
        colour: colour(n?.c),
        legs: list(n?.g, 16)
          .map((leg) => list(leg, 12).filter(Array.isArray).map(([x, y]) => [unit(x), unit(y)]))
          .filter((leg) => leg.length >= 2),
      }))
      .filter((n) => n.name && n.legs.length > 0);
    if (stations.length === 0) return null;
    return {
      layout: "transit",
      centre,
      width,
      height,
      stations,
      lines,
      others: Math.max(0, Math.min(999, Math.floor(Number(raw.o) || 0))),
      caption: text(raw.d, MAX_CAPTION),
      covers: false,
      bare: false,
    };
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
        ? Math.max(0.1, Math.min(1, n / 1000))
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
        // Line weights, one per link: 1 to 3 (a stack album's own links: 0).
        weights: lines ? list(n?.w, MAX_MAP_ALBUMS + 1).map((w) => Math.max(1, Math.min(3, Math.round(Number(w) || 1)))) : [],
      }))
      .filter((n) => n.t);
    // Links point at nodes as sent; untitled ones are dropped, so remap.
    const at = new Map([[0, 0], ...nodes.map((n, i) => [n.index, i + 1])]);
    for (const node of nodes) {
      const seen = new Set();
      const kept = node.links
        .map((k, i) => ({ k: at.get(k) ?? -1, w: node.member ? 0 : (node.weights[i] ?? 1) }))
        .filter(({ k }) => k >= 0 && !seen.has(k) && seen.add(k));
      node.links = kept.map(({ k }) => k);
      node.weights = kept.map(({ w }) => w);
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

/** Share images are square, 1080x1080 (feeds, posts and stories alike). */
export const IMAGE_SIZE = { width: 1080, height: 1080, name: "square" };

/**
 * The image URL for an art id: the Cover Art Archive for "g:" and "r:",
 * i.discogs.com (and only there) for "d:".
 */
export const coverArtUrl = (artId, px = 500) => {
  if (artId.startsWith("d:")) {
    const path = artId.slice(2);
    return DISCOGS_PATH.test(path) ? `https://i.discogs.com/${path}` : "";
  }
  const [kind, mbid] = artId.split(":");
  if (!mbid) return "";
  return `https://coverartarchive.org/${kind === "g" ? "release-group" : "release"}/${mbid}/front-${px}`;
};

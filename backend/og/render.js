// Share image layouts for @vercel/og (Satori), built as plain element
// objects so the backend needs no JSX build. Two layouts, two sizes:
//   card: the searched album, then its top results with "N shared"
//   map:  one album in the middle of a circle, the albums around it where
//         the client placed them, and the people they share around the rim
// Every element with several children sets display: flex (Satori needs it).

import { readFile } from "node:fs/promises";
import { ImageResponse } from "@vercel/og";
import { MAP_SIZES, MAX_RESULTS } from "./payload.js";

// Mirrors docs/redesign/tokens.md. Satori has no CSS variables, so the
// renderer spells the values out here, once.
const C = {
  background: "#0C0C0D",
  surface: "#141416",
  raised: "#1C1C1F",
  border: "#2A2A2E",
  foreground: "#EDEDEF",
  muted: "#A3A3A8",
  faint: "#8A8A90",
  primary: "#E0312A",
  primaryText: "#FF6257",
};

const fontFile = (name) => readFile(new URL(`./fonts/${name}`, import.meta.url));

let fontsPromise = null;
const loadFonts = () => {
  fontsPromise ??= Promise.all([
    fontFile("bebas-neue-latin-400-normal.woff"),
    fontFile("ibm-plex-sans-latin-400-normal.woff"),
    fontFile("ibm-plex-sans-latin-600-normal.woff"),
    fontFile("ibm-plex-mono-latin-400-normal.woff"),
  ]).then(([bebas, sans, sansBold, mono]) => [
    { name: "Bebas Neue", data: bebas, weight: 400, style: "normal" },
    { name: "IBM Plex Sans", data: sans, weight: 400, style: "normal" },
    { name: "IBM Plex Sans", data: sansBold, weight: 600, style: "normal" },
    { name: "IBM Plex Mono", data: mono, weight: 400, style: "normal" },
  ]);
  return fontsPromise;
};

/** An element. Children may be strings, elements, or falsy (dropped). */
const h = (type, style, ...children) => {
  const kids = children.flat().filter((c) => c !== null && c !== undefined && c !== false);
  return {
    type,
    props: {
      style: { display: "flex", ...style },
      children: kids.length === 1 ? kids[0] : kids,
    },
  };
};

const img = (src, style) => ({ type: "img", props: { src, style } });

/** Up to two initials: "Spirit of Eden" -> "SE" (as the app's placeholder). */
export const initials = (title) => {
  const stop = new Set(["a", "an", "and", "of", "the"]);
  const words = title
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  const significant = words.filter((w) => !stop.has(w.toLowerCase()));
  return (significant.length ? significant : words)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
};

/** Cover art, or the initials placeholder when there's none. */
const cover = (title, dataUrl, size, radius = 6) =>
  dataUrl
    ? img(dataUrl, {
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: radius,
        objectFit: "cover",
      })
    : h(
        "div",
        {
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: radius,
          background: C.raised,
          border: `2px solid ${C.border}`,
          alignItems: "center",
          justifyContent: "center",
          color: C.muted,
          fontFamily: "IBM Plex Mono",
          fontSize: Math.round(size * 0.28),
        },
        initials(title) || "?",
      );

const line = (text, style) =>
  h(
    "div",
    {
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      ...style,
    },
    text,
  );

/** How the albums were chosen: one quiet mono line. */
const caption = (text, fontSize) =>
  text
    ? line(text, { fontFamily: "IBM Plex Mono", fontSize, color: C.faint })
    : null;

const eyebrow = (text, scale) =>
  line(text, {
    fontFamily: "IBM Plex Mono",
    fontSize: 26 * scale,
    letterSpacing: 4 * scale,
    color: C.primaryText,
    textTransform: "uppercase",
  });

const frame = (size, ...children) =>
  h(
    "div",
    {
      width: size.width,
      height: size.height,
      flexDirection: "column",
      justifyContent: "space-between",
      background: C.background,
      color: C.foreground,
      fontFamily: "IBM Plex Sans",
      padding: 52,
    },
    ...children,
  );

/**
 * Sizes for a card with `count` rows: up to five at full size; more get a
 * smaller header and rows that shrink to fit (ten at most).
 */
export const cardSizes = (count) => {
  const compact = count > 5;
  const header = compact ? 180 : 250;
  const gap = compact ? 10 : 16;
  // Height left for rows: the frame less its padding, header, caption,
  // footer and the gaps between them.
  const room = 1080 - 2 * 52 - header - 28 - 26 - 28 - 32 - 24;
  const row = Math.min(92, Math.floor((room - (count - 1) * gap) / Math.max(1, count)));
  return { header, gap, row, scale: row / 92, titleSize: compact ? 64 : 84 };
};

/** Periphery card: the searched album, then its top results. */
export function cardElement(payload, size, art) {
  const rows = payload.results.slice(0, MAX_RESULTS);
  const { album } = payload;
  const fit = cardSizes(rows.length);
  // No covers: titles and artists only.
  const showCovers = payload.covers !== false;
  // Text shrinks with the rows, never below 12px.
  const px = (n) => Math.max(12, Math.round(n * Math.max(fit.scale, 0.55)));

  return frame(
    size,
    h(
      "div",
      { flexDirection: "column", gap: 28 },
      h(
        "div",
        { alignItems: "center", gap: 36 },
        showCovers && cover(album.t, art.get(album.i), fit.header, 8),
        h(
          "div",
          { flexDirection: "column", gap: 10, maxWidth: 600 },
          eyebrow("Connections from", 0.8),
          line(album.t, {
            fontFamily: "Bebas Neue",
            fontSize: fit.titleSize,
            lineHeight: 1,
            color: C.foreground,
          }),
          line(album.r, { fontSize: 32, color: C.muted }),
        ),
      ),
      caption(payload.caption, 20),
      rows.length > 0 &&
        h(
          "div",
          { flexDirection: "column", gap: fit.gap },
          ...rows.map((r) =>
            h(
              "div",
              { alignItems: "center", gap: 22 },
              showCovers && cover(r.t, art.get(r.i), fit.row),
              h(
                "div",
                // Only the titles give way to a long name; covers and counts keep their size.
                {
                  flexDirection: "column",
                  flexGrow: 1,
                  flexShrink: 1,
                  minWidth: 0,
                  gap: fit.row < 70 ? 2 : 6,
                },
                line(r.t, { fontSize: px(30), fontWeight: 600 }),
                line(r.r, { fontSize: px(24), color: C.muted }),
              ),
              line(`${r.n} shared`, {
                flexShrink: 0,
                fontFamily: "IBM Plex Mono",
                fontSize: px(24),
                color: r.n > 1 ? C.primaryText : C.muted,
              }),
            ),
          ),
        ),
    ),
    footer(),
  );
}

/**
 * Text cut to about `chars` characters at a word where it can, with an
 * ellipsis, so it fits a box without being clipped mid-letter.
 */
export const shorten = (text, chars) => {
  if (text.length <= chars) return text;
  const cut = text.slice(0, Math.max(1, chars - 1));
  const space = cut.lastIndexOf(" ");
  return `${(space >= chars / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
};

// Sans text in tiles: semibold letters run about 0.56 of the size wide.
const TILE_CHAR = 0.56;
const TILE_LINE = 1.15;

/** Words in lines of at most `chars` characters; null if a word won't fit. */
const wrapWords = (text, chars) => {
  const lines = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (word.length > chars) return null;
    const last = lines[lines.length - 1];
    if (last !== undefined && `${last} ${word}`.length <= chars) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else lines.push(word);
  }
  return lines;
};

/**
 * The text of a coverless tile, fitted to its side. The title takes the
 * largest size (down to 12px) at which every word fits a line and the
 * lines fit the tile; the artist goes under it, smaller, only if there's
 * room for it at 12px or more, and is dropped otherwise. A title that
 * won't fit even at 12px is cut short with an ellipsis.
 */
export const fitTileText = (title, artist, side) => {
  const pad = Math.max(4, Math.round(side * 0.08));
  const inner = side - 2 * pad;
  const chars = (size) => Math.max(1, Math.floor(inner / (size * TILE_CHAR)));
  const rows = (size) => Math.max(1, Math.floor(inner / (size * TILE_LINE)));
  const largest = Math.max(12, Math.round(side * 0.14));
  for (let size = largest; size >= 12; size--) {
    const lines = wrapWords(title, chars(size));
    if (!lines || lines.length > rows(size)) continue;
    // The artist under it, a step smaller, one line, if there's room.
    const artistSize = Math.max(12, Math.round(size * 0.75));
    const left = inner - lines.length * size * TILE_LINE - 4;
    // Whole, or cut short if most of it still shows; never a stub.
    const room = chars(artistSize);
    const readable = artist && (artist.length <= room || room >= 9);
    const artistFits = readable && left >= artistSize * TILE_LINE;
    return {
      pad,
      titleSize: size,
      titleLines: lines,
      artistSize,
      artist: artistFits ? shorten(artist, room) : null,
    };
  }
  // Too long even at 12px: long words broken with a hyphen, as many lines
  // as fit, the last cut short.
  const width = chars(12);
  const words = title.split(/\s+/).flatMap((w) => {
    if (w.length <= width) return [w];
    // Even pieces, so the break isn't one or two letters from the end.
    const count = Math.ceil(w.length / Math.max(1, width - 1));
    const piece = Math.ceil(w.length / count);
    const parts = w.match(new RegExp(`.{1,${piece}}`, "g")) ?? [];
    return parts.map((p, i) => (i < parts.length - 1 ? `${p}-` : p));
  });
  const lines = wrapWords(words.join(" "), width) ?? [title.slice(0, width)];
  const kept = lines.slice(0, rows(12));
  if (lines.length > kept.length) {
    kept[kept.length - 1] = shorten(`${kept[kept.length - 1]} ${lines[kept.length]}`, width);
  }
  return { pad, titleSize: 12, titleLines: kept, artistSize: 12, artist: null };
};

/**
 * A cover, or a box with its title and artist when there's no art (or
 * covers are off), the text fitted to the box. The centre album gets no
 * accent: being in the middle, and biggest, says it.
 */
const tile = (album, dataUrl, side) => {
  if (dataUrl) {
    return img(dataUrl, { width: side, height: side, borderRadius: 4, objectFit: "cover" });
  }
  const fit = fitTileText(album.t, album.r, side);
  return h(
    "div",
    {
      width: side,
      height: side,
      borderRadius: 4,
      background: C.raised,
      border: `2px solid ${C.border}`,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: fit.pad,
      overflow: "hidden",
      textAlign: "center",
    },
    h(
      "div",
      {
        flexDirection: "column",
        alignItems: "center",
        fontSize: fit.titleSize,
        fontWeight: 600,
        lineHeight: TILE_LINE,
        color: C.foreground,
      },
      ...fit.titleLines.map((text) => h("div", { whiteSpace: "nowrap" }, text)),
    ),
    fit.artist &&
      h(
        "div",
        {
          marginTop: 4,
          fontSize: fit.artistSize,
          lineHeight: TILE_LINE,
          color: C.muted,
          whiteSpace: "nowrap",
        },
        fit.artist,
      ),
  );
};



// Names on the rim: mono 15px, about 9px a character, 18px a line.
const NAME = { size: 15, char: 9.1, line: 18, chars: 15, lines: 3 };

/**
 * A name in lines of at most `chars` characters, broken at spaces (or
 * hyphens) where it can, at most `lines` of them, the last ending in "…"
 * when it doesn't all fit.
 */
export const nameLines = (name, chars = NAME.chars, lines = NAME.lines) => {
  const words = name.split(/\s+/).flatMap((w) => {
    // Long words break after hyphens, then anywhere.
    const parts = w.split(/(?<=-)/);
    return parts.flatMap((p) =>
      p.length <= chars ? [p] : p.match(new RegExp(`.{1,${chars}}`, "g")),
    );
  });
  const out = [];
  for (const word of words) {
    const last = out[out.length - 1];
    const joined = last === undefined ? word : last.endsWith("-") ? last + word : `${last} ${word}`;
    if (last !== undefined && joined.length <= chars) out[out.length - 1] = joined;
    else out.push(word);
  }
  if (out.length <= lines) return out;
  const kept = out.slice(0, lines);
  kept[lines - 1] = shorten(`${kept[lines - 1]} ${out[lines]}`, chars);
  return kept;
};

/** A name's box: as wide as its longest line, as tall as its lines. */
const nameBox = (name) => {
  const lines = nameLines(name);
  return {
    lines,
    w: Math.ceil(Math.max(...lines.map((l) => l.length)) * NAME.char) + 8,
    h: lines.length * NAME.line + 4,
  };
};

/** Two boxes ({ x, y, w, h }, top-left) overlap, with `margin` to spare. */
const overlaps = (a, b, margin = 0) =>
  a.x < b.x + b.w + margin &&
  b.x < a.x + a.w + margin &&
  a.y < b.y + b.h + margin &&
  b.y < a.y + a.h + margin;

/**
 * The map laid out with a circle of `radius`, in a box `width` x `height`
 * (origin at its top-left): every cover's box, and each name's box.
 *
 * Names come first: each sits just past its dot, and names that would
 * overlap each other are moved apart around the circle (their dots stay
 * where the person is). Then any cover on a name moves off it: toward
 * the middle if it's inside the circle, outward if it's past it.
 */
export function mapLayout(payload, radius, { width, height, gap }) {
  const middle = { x: width / 2, y: height / 2 };
  // An album's side as the client sized it (older links: by tier).
  const coverBox = (x, y, side) => {
    side *= radius;
    return {
      x: middle.x + x * radius - side / 2,
      y: middle.y - y * radius - side / 2,
      w: side,
      h: side,
    };
  };
  const covers = [
    coverBox(0, 0, MAP_SIZES.centre),
    ...payload.albums.map((album) => coverBox(album.x, album.y, album.side ?? MAP_SIZES[album.z])),
  ];

  const sizes = payload.people.map((p) => nameBox(p.name));
  const labelAt = (angle, i) => {
    const { w, h } = sizes[i];
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    // Just past the dot, nearest edge toward it.
    const out = radius + gap + (Math.abs(c) * w) / 2 + (Math.abs(s) * h) / 2;
    return { x: middle.x + c * out - w / 2, y: middle.y - s * out - h / 2, w, h };
  };

  const angles = payload.people.map((p) => (p.angle * Math.PI) / 180);
  const labelAngles = [...angles];
  let labels = labelAngles.map((a, i) => labelAt(a, i));
  for (let step = 0; step < 80; step++) {
    let moved = false;
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        if (!overlaps(labels[i], labels[j], 4)) continue;
        // Apart around the circle, each away from the other.
        const apart = Math.sin(labelAngles[j] - labelAngles[i]) >= 0 ? 1 : -1;
        labelAngles[i] -= apart * 0.03;
        labelAngles[j] += apart * 0.03;
        moved = true;
      }
    }
    if (!moved) break;
    labels = labelAngles.map((a, i) => labelAt(a, i));
  }

  // Covers off the names, the centre one aside.
  for (const cover of covers.slice(1)) {
    const cx = cover.x + cover.w / 2 - middle.x;
    const cy = cover.y + cover.h / 2 - middle.y;
    const length = Math.hypot(cx, cy) || 1;
    const sign = length < radius ? -1 : 1;
    for (let step = 0; step < 120 && labels.some((label) => overlaps(label, cover, 6)); step++) {
      cover.x += (sign * 6 * cx) / length;
      cover.y += (sign * 6 * cy) / length;
    }
  }

  return {
    middle,
    covers,
    labels: payload.people.map((p, i) => ({
      name: p.name,
      lines: sizes[i].lines,
      dot: {
        x: middle.x + Math.cos(angles[i]) * radius,
        y: middle.y - Math.sin(angles[i]) * radius,
      },
      ...labels[i],
    })),
  };
}

/**
 * The largest circle whose covers and names all fit in the box, `edge`
 * clear of its sides, and the layout at that size.
 */
export function mapGeometry(payload, options) {
  const { width, height, edge } = options;
  const inside = (b) =>
    b.x >= edge && b.y >= edge && b.x + b.w <= width - edge && b.y + b.h <= height - edge;
  const fits = (layout) =>
    layout.covers.every(inside) &&
    layout.labels.every(inside) &&
    layout.labels.every((a, i) => layout.labels.every((b, j) => j <= i || !overlaps(a, b)));
  let low = 40;
  let high = Math.min(width, height) / 2;
  for (let step = 0; step < 16; step++) {
    const mid = (low + high) / 2;
    if (fits(mapLayout(payload, mid, options))) low = mid;
    else high = mid;
  }
  return { radius: low, ...mapLayout(payload, low, options) };
}

/** The footer: the site, on the right. */
function footer() {
  return h(
    "div",
    { justifyContent: "flex-end", width: "100%" },
    line("vinylperiphery.com", {
      fontFamily: "IBM Plex Mono",
      fontSize: 19,
      color: C.muted,
    }),
  );
}

// The maps' frame: header at the top left, the site at the bottom right,
// and the graph between, kept clear of both and of the sides.
const MAP_FRAME = { pad: 48, below: 28, footer: 26, gap: 28 };
// Mono 18px: about 11px a character across the header's 984px.
const CAPTION_CHARS = 86;

/** How many lines a map's caption takes: one or two. */
const captionLines = (text) => (!text ? 0 : text.length > CAPTION_CHARS ? 2 : 1);

/** The box the graph is drawn in, under a map's header (or all of it). */
const mapBox = (payload, size) => {
  // No boilerplate: the graph has the whole image (its edge still applies).
  if (payload.bare) return { top: 8, width: size.width, height: size.height - 16 };
  const header = 118 + (captionLines(payload.caption) ? 6 + 24 * captionLines(payload.caption) : 0);
  const top = MAP_FRAME.pad + header + MAP_FRAME.gap;
  return {
    top,
    width: size.width,
    height: size.height - top - MAP_FRAME.below - MAP_FRAME.footer - MAP_FRAME.gap / 2,
  };
};

/** A map's header: eyebrow, the centre album, and the caption (two lines at most). */
const mapHeader = (label, payload, size) =>
  h(
    "div",
    {
      position: "absolute",
      left: MAP_FRAME.pad,
      top: MAP_FRAME.pad,
      width: size.width - 2 * MAP_FRAME.pad,
      flexDirection: "column",
      gap: 4,
    },
    eyebrow(label, 0.7),
    line(payload.centre.t, {
      fontFamily: "Bebas Neue",
      fontSize: 56,
      lineHeight: 1,
      color: C.foreground,
    }),
    line(payload.centre.r, { fontSize: 22, color: C.muted }),
    payload.caption &&
      h(
        "div",
        {
          marginTop: 6,
          fontFamily: "IBM Plex Mono",
          fontSize: 18,
          lineHeight: 1.33,
          color: C.faint,
        },
        shorten(payload.caption, CAPTION_CHARS * 2),
      ),
  );

/** The site, bottom right of a map. */
const mapFooter = (size) =>
  h(
    "div",
    {
      position: "absolute",
      left: MAP_FRAME.pad,
      bottom: MAP_FRAME.below,
      width: size.width - 2 * MAP_FRAME.pad,
    },
    footer(),
  );

// Names sit `gap` past their dot; the graph keeps `edge` from the sides.
const MAP_LABEL = { gap: 10, edge: 32 };

/** Map: the centre album, the albums around it, the people on the rim. */
export function mapElement(payload, size, art) {
  // The map runs between the header and the footer.
  const { top, ...box } = mapBox(payload, size);
  const { radius, middle, covers, labels } = mapGeometry(payload, { ...box, ...MAP_LABEL });
  const { centre } = payload;
  // No covers: every album as its title and artist.
  const artOf = (item) => (payload.covers === false ? null : art.get(item.i));
  const links = payload.lines
    ? payload.albums.flatMap((album, i) =>
        album.links.map((p) => ({ from: labels[p]?.dot, to: covers[i + 1] })),
      ).filter((l) => l.from)
    : [];
  const dot = 9;
  const placed = (b, child) =>
    h(
      "div",
      { position: "absolute", left: Math.round(b.x), top: Math.round(b.y) },
      child,
    );

  return h(
    "div",
    {
      position: "relative",
      width: size.width,
      height: size.height,
      background: C.background,
      color: C.foreground,
      fontFamily: "IBM Plex Sans",
    },
    h(
      "div",
      { position: "absolute", left: 0, top, width: box.width, height: box.height },
      // The circle the people sit on.
      h("div", {
        position: "absolute",
        left: Math.round(middle.x - radius),
        top: Math.round(middle.y - radius),
        width: Math.round(radius * 2),
        height: Math.round(radius * 2),
        borderRadius: 999,
        border: `2px solid ${C.border}`,
      }),
      // Lines from each person to their albums, under everything else.
      links.length > 0 && {
        type: "svg",
        props: {
          width: box.width,
          height: box.height,
          viewBox: `0 0 ${box.width} ${box.height}`,
          style: { position: "absolute", left: 0, top: 0 },
          children: links.map((l) => ({
            type: "line",
            props: {
              x1: Math.round(l.from.x),
              y1: Math.round(l.from.y),
              x2: Math.round(l.to.x + l.to.w / 2),
              y2: Math.round(l.to.y + l.to.h / 2),
              stroke: C.faint,
              strokeOpacity: 0.45,
              strokeWidth: 1.5,
            },
          })),
        },
      },
      ...labels.flatMap((label) => [
        h("div", {
          position: "absolute",
          left: Math.round(label.dot.x - dot / 2),
          top: Math.round(label.dot.y - dot / 2),
          width: dot,
          height: dot,
          borderRadius: 999,
          background: C.primaryText,
        }),
        h(
          "div",
          {
            position: "absolute",
            left: Math.round(label.x),
            top: Math.round(label.y),
            width: Math.round(label.w),
            height: Math.round(label.h),
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "IBM Plex Mono",
            fontSize: NAME.size,
            lineHeight: `${NAME.line}px`,
            color: C.muted,
          },
          ...label.lines.map((text) => h("div", { whiteSpace: "nowrap" }, text)),
        ),
      ]),
      ...payload.albums.map((album, i) =>
        placed(covers[i + 1], tile(album, artOf(album), Math.round(covers[i + 1].w))),
      ),
      placed(covers[0], tile(centre, artOf(centre), Math.round(covers[0].w))),
    ),
    !payload.bare && mapHeader("Connections around", payload, size),
    !payload.bare && mapFooter(size),
  );
}

/**
 * The stack map fitted to a box: every album's box in pixels. Places come
 * in step lengths (y up) and are scaled, up to `maxStep` pixels a step,
 * so the whole graph fits `edge` clear of the box's sides.
 */
export function stackGeometry(payload, { width, height, edge, maxStep }) {
  const all = [{ x: 0, y: 0, side: payload.centre.side }, ...payload.albums];
  const minX = Math.min(...all.map((n) => n.x - n.side / 2));
  const maxX = Math.max(...all.map((n) => n.x + n.side / 2));
  const minY = Math.min(...all.map((n) => n.y - n.side / 2));
  const maxY = Math.max(...all.map((n) => n.y + n.side / 2));
  const step = Math.min(
    maxStep,
    (width - 2 * edge) / Math.max(maxX - minX, 0.01),
    (height - 2 * edge) / Math.max(maxY - minY, 0.01),
  );
  // Centred in the box.
  const left = (width - (maxX - minX) * step) / 2;
  const top = (height - (maxY - minY) * step) / 2;
  const boxes = all.map((n) => ({
    x: left + (n.x - n.side / 2 - minX) * step,
    y: top + (maxY - (n.y + n.side / 2)) * step,
    w: n.side * step,
    h: n.side * step,
  }));
  return { step, boxes };
}

const STACK_FIT = { edge: 32, maxStep: 420 };

/** Stack map: its albums a step apart, results where they overlap most. */
export function stackElement(payload, size, art) {
  const { top, ...box } = mapBox(payload, size);
  const { boxes } = stackGeometry(payload, { ...box, ...STACK_FIT });
  const { centre } = payload;
  const artOf = (item) => (payload.covers === false ? null : art.get(item.i));
  const middleOf = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  // Lines: stack albums to the album they came from, a little stronger;
  // results to the albums they share people with.
  const links = payload.lines
    ? payload.albums.flatMap((node, i) =>
        node.links
          .filter((k) => boxes[k])
          .map((k) => ({
            from: middleOf(boxes[i + 1]),
            to: middleOf(boxes[k]),
            strong: node.member,
          })),
      )
    : [];
  const placed = (b, child) =>
    h("div", { position: "absolute", left: Math.round(b.x), top: Math.round(b.y) }, child);

  return h(
    "div",
    {
      position: "relative",
      width: size.width,
      height: size.height,
      background: C.background,
      color: C.foreground,
      fontFamily: "IBM Plex Sans",
    },
    h(
      "div",
      { position: "absolute", left: 0, top, width: box.width, height: box.height },
      links.length > 0 && {
        type: "svg",
        props: {
          width: box.width,
          height: box.height,
          viewBox: `0 0 ${box.width} ${box.height}`,
          style: { position: "absolute", left: 0, top: 0 },
          children: links.map((l) => ({
            type: "line",
            props: {
              x1: Math.round(l.from.x),
              y1: Math.round(l.from.y),
              x2: Math.round(l.to.x),
              y2: Math.round(l.to.y),
              stroke: l.strong ? C.muted : C.faint,
              strokeOpacity: l.strong ? 0.7 : 0.4,
              strokeWidth: l.strong ? 2.5 : 1.5,
            },
          })),
        },
      },
      // Results first, so the stack's albums sit on top.
      ...payload.albums
        .map((node, i) => ({ node, b: boxes[i + 1] }))
        .sort((a, b) => Number(a.node.member) - Number(b.node.member))
        .map(({ node, b }) => placed(b, tile(node, artOf(node), Math.round(b.w)))),
      placed(boxes[0], tile(centre, artOf(centre), Math.round(boxes[0].w))),
    ),
    !payload.bare && mapHeader("Stacked from", payload, size),
    !payload.bare && mapFooter(size),
  );
}

/** The art ids a payload shows. */
export const artIds = (payload) =>
  payload.covers === false
    ? []
    : (payload.layout === "card"
    ? [payload.album, ...payload.results]
    : [payload.centre, ...payload.albums]
  )
    .map((item) => item.i)
    .filter(Boolean);

/** Renders a decoded payload to PNG bytes. `art` maps art id -> data URL. */
export async function renderPng(payload, size, art) {
  const element =
    payload.layout === "card"
      ? cardElement(payload, size, art)
      : payload.layout === "stack"
        ? stackElement(payload, size, art)
        : mapElement(payload, size, art);
  const response = new ImageResponse(element, {
    width: size.width,
    height: size.height,
    fonts: await loadFonts(),
  });
  return Buffer.from(await response.arrayBuffer());
}

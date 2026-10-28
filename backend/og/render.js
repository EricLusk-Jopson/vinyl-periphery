// Share image layouts for @vercel/og (Satori), built as plain element
// objects so the backend needs no JSX build. Two layouts, two sizes:
//   card: the searched album, then its top results with "N shared"
//   map:  one album in the middle of a circle, the albums around it where
//         the client placed them, and the people they share around the rim
// Every element with several children sets display: flex (Satori needs it).

import { readFile } from "node:fs/promises";
import { ImageResponse } from "@vercel/og";

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

/** Periphery card: the searched album, then its top results. */
export function cardElement(payload, size, art) {
  const rows = payload.results.slice(0, 5);
  const { album } = payload;

  return frame(
    size,
    h(
      "div",
      { flexDirection: "column", gap: 28 },
      h(
        "div",
        { alignItems: "center", gap: 36 },
        cover(album.t, art.get(album.i), 250, 8),
        h(
          "div",
          { flexDirection: "column", gap: 10, maxWidth: 600 },
          eyebrow("Connections from", 0.8),
          line(album.t, {
            fontFamily: "Bebas Neue",
            fontSize: 84,
            lineHeight: 1,
            color: C.foreground,
          }),
          line(album.r, { fontSize: 32, color: C.muted }),
        ),
      ),
      rows.length > 0 &&
        h(
          "div",
          { flexDirection: "column", gap: 16 },
          ...rows.map((r) =>
            h(
              "div",
              { alignItems: "center", gap: 22 },
              cover(r.t, art.get(r.i), 92),
              h(
                "div",
                // Only the titles give way to a long name; covers and counts keep their size.
                { flexDirection: "column", flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 6 },
                line(r.t, { fontSize: 30, fontWeight: 600 }),
                line(r.r, { fontSize: 24, color: C.muted }),
              ),
              line(`${r.n} shared`, {
                flexShrink: 0,
                fontFamily: "IBM Plex Mono",
                fontSize: 24,
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

/** A cover, or a box with its title and artist when there's no art. */
const tile = (album, dataUrl, side, accent) => {
  const pad = Math.round(side * 0.08);
  const titleSize = Math.max(12, Math.round(side * 0.13));
  const artistSize = Math.max(12, Math.round(side * 0.09));
  // Roughly how many characters fit: a sans letter is about half its size.
  const perLine = (size) => Math.floor((side - 2 * pad) / (size * 0.55));
  const titleLines = Math.max(1, Math.floor((side * 0.6) / (titleSize * 1.15)));
  return (
    dataUrl
      ? img(dataUrl, {
          width: side,
          height: side,
          borderRadius: 4,
          objectFit: "cover",
          border: accent ? `4px solid ${C.primary}` : "none",
        })
      : h(
          "div",
          {
            width: side,
            height: side,
            borderRadius: 4,
            background: C.raised,
            border: `2px solid ${accent ? C.primary : C.border}`,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: pad,
            overflow: "hidden",
            textAlign: "center",
          },
          h(
            "div",
            {
              fontSize: titleSize,
              fontWeight: 600,
              lineHeight: 1.15,
              color: C.foreground,
              justifyContent: "center",
            },
            shorten(album.t, perLine(titleSize) * titleLines),
          ),
          h(
            "div",
            {
              marginTop: 4,
              fontSize: artistSize,
              color: C.muted,
              justifyContent: "center",
            },
            shorten(album.r, perLine(artistSize)),
          ),
        )
  );
};

// Cover sides as fractions of the circle's radius; same as the client's
// MAP_SIZES (shareMap.ts), which placed them.
const MAP_SIZES = { centre: 0.46, 1: 0.28, 2: 0.36 };


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
 * A name starts just past its dot and moves outward only while it would
 * sit on a cover. Names that would overlap each other are moved apart
 * around the circle; their dots stay where the person is.
 */
export function mapLayout(payload, radius, { width, height, labelWidth, labelHeight, gap }) {
  const middle = { x: width / 2, y: height / 2 };
  const coverBox = (x, y, z) => {
    const side = MAP_SIZES[z] * radius;
    return {
      x: middle.x + x * radius - side / 2,
      y: middle.y - y * radius - side / 2,
      w: side,
      h: side,
    };
  };
  const covers = [
    coverBox(0, 0, "centre"),
    ...payload.albums.map((album) => coverBox(album.x, album.y, album.z)),
  ];

  const labelAt = (angle) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    // Just past the dot, nearest edge toward it.
    let out = radius + gap + (Math.abs(c) * labelWidth) / 2 + (Math.abs(s) * labelHeight) / 2;
    const box = () => ({
      x: middle.x + c * out - labelWidth / 2,
      y: middle.y - s * out - labelHeight / 2,
      w: labelWidth,
      h: labelHeight,
    });
    let spot = box();
    for (let step = 0; step < 120 && covers.some((cover) => overlaps(spot, cover, 6)); step++) {
      out += 6;
      spot = box();
    }
    return spot;
  };

  const angles = payload.people.map((p) => (p.angle * Math.PI) / 180);
  const labelAngles = [...angles];
  let labels = labelAngles.map(labelAt);
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
    labels = labelAngles.map(labelAt);
  }

  return {
    middle,
    covers,
    labels: payload.people.map((p, i) => ({
      name: p.name,
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

/** The footer: mark and wordmark, and the site. */
function footer() {
  return h(
    "div",
    { alignItems: "center", justifyContent: "space-between", width: "100%" },
    h(
      "div",
      { alignItems: "center", gap: 10 },
      h(
        "div",
        {
          width: 28,
          height: 28,
          borderRadius: 999,
          border: `3px solid ${C.foreground}`,
          alignItems: "center",
          justifyContent: "center",
        },
        h("div", { width: 10, height: 10, borderRadius: 999, background: C.primary }),
      ),
      line("VINYL PERIPHERY", {
        fontFamily: "Bebas Neue",
        fontSize: 32,
        letterSpacing: 1.5,
        color: C.foreground,
      }),
    ),
    line("vinylperiphery.com", {
      fontFamily: "IBM Plex Mono",
      fontSize: 19,
      color: C.muted,
    }),
  );
}

const MAP_LABEL = { labelWidth: 112, labelHeight: 36, gap: 10, edge: 10 };

/** Map: the centre album, the albums around it, the people on the rim. */
export function mapElement(payload, size, art) {
  const pad = 48;
  const headerHeight = 118;
  const footerHeight = 32;
  // The map runs edge to edge, between the header and the footer.
  const top = pad + headerHeight;
  const box = {
    width: size.width,
    height: size.height - top - footerHeight - 28 - 8,
  };
  const { radius, middle, covers, labels } = mapGeometry(payload, { ...box, ...MAP_LABEL });
  const { centre } = payload;
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
            width: MAP_LABEL.labelWidth,
            height: MAP_LABEL.labelHeight,
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontFamily: "IBM Plex Mono",
            fontSize: 15,
            lineHeight: 1.2,
            color: C.muted,
            overflow: "hidden",
          },
          label.name,
        ),
      ]),
      ...payload.albums.map((album, i) =>
        placed(covers[i + 1], tile(album, art.get(album.i), Math.round(covers[i + 1].w), false)),
      ),
      placed(covers[0], tile(centre, art.get(centre.i), Math.round(covers[0].w), true)),
    ),
    // Header, top left.
    h(
      "div",
      {
        position: "absolute",
        left: pad,
        top: pad,
        width: size.width - 2 * pad,
        flexDirection: "column",
        gap: 4,
      },
      eyebrow("Connections around", 0.7),
      line(centre.t, {
        fontFamily: "Bebas Neue",
        fontSize: 56,
        lineHeight: 1,
        color: C.foreground,
      }),
      line(centre.r, { fontSize: 22, color: C.muted }),
    ),
    // Footer, along the bottom.
    h(
      "div",
      { position: "absolute", left: pad, bottom: 28, width: size.width - 2 * pad },
      footer(),
    ),
  );
}

/** The art ids a payload shows. */
export const artIds = (payload) =>
  (payload.layout === "card"
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
      : mapElement(payload, size, art);
  const response = new ImageResponse(element, {
    width: size.width,
    height: size.height,
    fonts: await loadFonts(),
  });
  return Buffer.from(await response.arrayBuffer());
}

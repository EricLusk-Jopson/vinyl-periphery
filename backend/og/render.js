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

/** The watermark: wordmark, site and tagline. */
const watermark = (scale) =>
  h(
    "div",
    {
      alignItems: "center",
      justifyContent: "space-between",
      borderTop: `2px solid ${C.border}`,
      paddingTop: 36 * scale,
    },
    h(
      "div",
      { alignItems: "center", gap: 18 * scale },
      // The disc mark: a ring with a red centre.
      h(
        "div",
        {
          width: 52 * scale,
          height: 52 * scale,
          borderRadius: 999,
          border: `${5 * scale}px solid ${C.foreground}`,
          alignItems: "center",
          justifyContent: "center",
        },
        h("div", {
          width: 16 * scale,
          height: 16 * scale,
          borderRadius: 999,
          background: C.primary,
        }),
      ),
      line("VINYL PERIPHERY", {
        fontFamily: "Bebas Neue",
        fontSize: 60 * scale,
        letterSpacing: 2 * scale,
        color: C.foreground,
      }),
    ),
    h(
      "div",
      { flexDirection: "column", alignItems: "flex-end", gap: 6 * scale },
      line("vinylperiphery.com", {
        fontFamily: "IBM Plex Mono",
        fontSize: 28 * scale,
        color: C.foreground,
      }),
      line("Follow the credit-brick road", {
        fontFamily: "IBM Plex Mono",
        fontSize: 24 * scale,
        color: C.faint,
      }),
    ),
  );

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
      padding: size.name === "story" ? 88 : 64,
    },
    ...children,
  );

/** Periphery card: the searched album, then its top results. */
export function cardElement(payload, size, art) {
  const story = size.name === "story";
  const scale = story ? 1 : 0.8;
  const heroSize = story ? 420 : 250;
  const rowSize = story ? 136 : 92;
  const rows = payload.results.slice(0, story ? 6 : 4);
  const { album } = payload;

  return frame(
    size,
    h(
      "div",
      { flexDirection: "column", gap: (story ? 48 : 28) },
      h(
        "div",
        {
          flexDirection: story ? "column" : "row",
          alignItems: story ? "flex-start" : "center",
          gap: story ? 40 : 36,
        },
        cover(album.t, art.get(album.i), heroSize, 8),
        h(
          "div",
          { flexDirection: "column", gap: 10, maxWidth: story ? 904 : 600 },
          eyebrow("Connections from", scale),
          line(album.t, {
            fontFamily: "Bebas Neue",
            fontSize: story ? 120 : 84,
            lineHeight: 1,
            color: C.foreground,
          }),
          line(album.r, { fontSize: 40 * scale, color: C.muted }),
        ),
      ),
      rows.length > 0 &&
        h(
          "div",
          { flexDirection: "column", gap: story ? 26 : 16 },
          ...rows.map((r) =>
            h(
              "div",
              { alignItems: "center", gap: 28 * scale },
              cover(r.t, art.get(r.i), rowSize),
              h(
                "div",
                // Only the titles give way to a long name; covers and counts keep their size.
                { flexDirection: "column", flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 6 },
                line(r.t, { fontSize: 38 * scale, fontWeight: 600 }),
                line(r.r, { fontSize: 30 * scale, color: C.muted }),
              ),
              line(`${r.n} shared`, {
                flexShrink: 0,
                fontFamily: "IBM Plex Mono",
                fontSize: 30 * scale,
                color: r.n > 1 ? C.primaryText : C.muted,
              }),
            ),
          ),
        ),
    ),
    watermark(scale),
  );
}

/** A cover, or a box with its title and artist when there's no art. */
const tile = (album, dataUrl, side, accent) =>
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
          padding: Math.round(side * 0.08),
          overflow: "hidden",
          textAlign: "center",
        },
        h(
          "div",
          {
            fontSize: Math.max(12, Math.round(side * 0.13)),
            fontWeight: 600,
            lineHeight: 1.15,
            color: C.foreground,
            maxHeight: Math.round(side * 0.62),
            overflow: "hidden",
            justifyContent: "center",
          },
          album.t,
        ),
        h(
          "div",
          {
            marginTop: 4,
            fontSize: Math.max(12, Math.round(side * 0.09)),
            color: C.muted,
            maxHeight: Math.round(side * 0.24),
            overflow: "hidden",
            justifyContent: "center",
          },
          album.r,
        ),
      );

// Cover sides as fractions of the circle's radius; same as the client's
// MAP_SIZES (shareMap.ts), which placed them.
const MAP_SIZES = { centre: 0.46, 1: 0.28, 2: 0.36 };

/**
 * How far out the covers reach (in radii, at least the circle itself):
 * overall, or near one angle. Albums only one person links sit just past
 * the circle, so names have to clear them.
 */
export const mapReach = (albums, angle) => {
  let reach = 1;
  for (const album of albums) {
    const distance = Math.hypot(album.x, album.y);
    if (angle !== undefined) {
      const away = Math.abs(
        Math.atan2(
          Math.sin(Math.atan2(album.y, album.x) - angle),
          Math.cos(Math.atan2(album.y, album.x) - angle),
        ),
      );
      if (away > 0.6) continue;
    }
    // Half the diagonal: a square's farthest corner.
    reach = Math.max(reach, distance + MAP_SIZES[album.z] * 0.71);
  }
  return reach;
};

/** Map: the centre album, the albums around it, the people on the rim. */
export function mapElement(payload, size, art) {
  const story = size.name === "story";
  const scale = story ? 1 : 0.8;
  const labelWidth = story ? 150 : 130;
  const labelHeight = story ? 56 : 46;
  const labelGap = story ? 20 : 16;
  // Stories are narrow: the map takes the full width, and names at the
  // sides fit beside the circle. Squares are short: the names above and
  // below fit, and those at the sides spill into the frame's padding.
  const box = story ? size.width : 650;
  // Room for any covers past the circle, then the names.
  const radius =
    (story
      ? box / 2 - labelGap - labelWidth - 8
      : box / 2 - labelGap - labelHeight) / mapReach(payload.albums);
  const middle = box / 2;
  const { centre } = payload;

  const at = (x, y, side) => ({
    position: "absolute",
    left: Math.round(middle + x * radius - side / 2),
    top: Math.round(middle - y * radius - side / 2),
  });

  const person = (p) => {
    const radians = (p.angle * Math.PI) / 180;
    const dot = story ? 12 : 10;
    // Just outside the dot, whichever side of the circle it's on.
    // Past the circle, or past any covers just outside it there.
    const out =
      radius * mapReach(payload.albums, radians) +
      labelGap +
      (Math.abs(Math.cos(radians)) * labelWidth) / 2 +
      (Math.abs(Math.sin(radians)) * labelHeight) / 2;
    return [
      h("div", {
        position: "absolute",
        left: Math.round(middle + Math.cos(radians) * radius - dot / 2),
        top: Math.round(middle - Math.sin(radians) * radius - dot / 2),
        width: dot,
        height: dot,
        borderRadius: 999,
        background: C.primaryText,
      }),
      h(
        "div",
        {
          position: "absolute",
          left: Math.round(middle + Math.cos(radians) * out - labelWidth / 2),
          top: Math.round(middle - Math.sin(radians) * out - labelHeight / 2),
          width: labelWidth,
          height: labelHeight,
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          fontFamily: "IBM Plex Mono",
          fontSize: story ? 22 : 19,
          lineHeight: 1.2,
          color: C.muted,
          overflow: "hidden",
        },
        p.name,
      ),
    ];
  };

  return frame(
    size,
    h(
      "div",
      { flexDirection: "column", gap: 10 },
      eyebrow("Connections around", scale),
      line(centre.t, {
        fontFamily: "Bebas Neue",
        fontSize: story ? 104 : 72,
        lineHeight: 1,
        color: C.foreground,
      }),
      line(centre.r, { fontSize: 36 * scale, color: C.muted }),
    ),
    h(
      "div",
      {
        justifyContent: "center",
        flexGrow: 1,
        alignItems: "center",
        // Stories: edge to edge, past the frame's padding.
        marginLeft: story ? -88 : 0,
        marginRight: story ? -88 : 0,
      },
      h(
        "div",
        { position: "relative", width: box, height: box },
        // The circle the people sit on.
        h("div", {
          position: "absolute",
          left: middle - radius,
          top: middle - radius,
          width: radius * 2,
          height: radius * 2,
          borderRadius: 999,
          border: `2px solid ${C.border}`,
        }),
        ...payload.people.flatMap(person),
        ...payload.albums.map((album) => {
          const side = Math.round(MAP_SIZES[album.z] * radius);
          return h(
            "div",
            at(album.x, album.y, side),
            tile(album, art.get(album.i), side, false),
          );
        }),
        h(
          "div",
          at(0, 0, Math.round(MAP_SIZES.centre * radius)),
          tile(centre, art.get(centre.i), Math.round(MAP_SIZES.centre * radius), true),
        ),
      ),
    ),
    watermark(scale),
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

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
      paddingTop: 24 * scale,
    },
    h(
      "div",
      { alignItems: "center", gap: 14 * scale },
      // The disc mark: a ring with a red centre.
      h(
        "div",
        {
          width: 40 * scale,
          height: 40 * scale,
          borderRadius: 999,
          border: `${4 * scale}px solid ${C.foreground}`,
          alignItems: "center",
          justifyContent: "center",
        },
        h("div", {
          width: 12 * scale,
          height: 12 * scale,
          borderRadius: 999,
          background: C.primary,
        }),
      ),
      line("VINYL PERIPHERY", {
        fontFamily: "Bebas Neue",
        fontSize: 44 * scale,
        letterSpacing: 2 * scale,
        color: C.foreground,
      }),
    ),
    h(
      "div",
      { flexDirection: "column", alignItems: "flex-end", gap: 2 * scale },
      line("vinylperiphery.com", {
        fontFamily: "IBM Plex Mono",
        fontSize: 24 * scale,
        color: C.foreground,
      }),
      line("Follow the credit-brick road", {
        fontFamily: "IBM Plex Mono",
        fontSize: 20 * scale,
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
      padding: size.name === "story" ? 88 : 52,
    },
    ...children,
  );

/** Periphery card: the searched album, then its top results. */
export function cardElement(payload, size, art) {
  const story = size.name === "story";
  const scale = story ? 1 : 0.8;
  const heroSize = story ? 420 : 250;
  const rowSize = story ? 136 : 92;
  const rows = payload.results.slice(0, story ? 6 : 5);
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

/**
 * Where everything on a map goes, in a box `width` x `height` (origin at
 * its top-left): the circle's radius, as large as fits with every cover
 * and name inside the box, and each name's place.
 *
 * Names sit just past their dot, or past any covers just outside the
 * circle near it. Names that would overlap are moved apart around the
 * circle (their dots stay put).
 */
export function mapGeometry(payload, { width, height, labelWidth, labelHeight, gap, edge }) {
  const halfW = width / 2 - edge;
  const halfH = height / 2 - edge;
  const { albums } = payload;
  const peopleAngles = payload.people.map((p) => (p.angle * Math.PI) / 180);
  const along = (angle) => {
    const c = Math.abs(Math.cos(angle));
    const s = Math.abs(Math.sin(angle));
    return { c, s, push: gap + (c * labelWidth) / 2 + (s * labelHeight) / 2 };
  };

  // The largest radius at which, in every direction, the covers and the
  // names stay in the box.
  let radius = Math.min(halfW, halfH) / (MAP_SIZES.centre * 0.71);
  for (let i = 0; i < 72; i++) {
    const angle = (i / 72) * 2 * Math.PI;
    const reach = mapReach(albums, angle);
    const { c, s } = along(angle);
    if (c > 1e-6) radius = Math.min(radius, halfW / (c * reach));
    if (s > 1e-6) radius = Math.min(radius, halfH / (s * reach));
  }
  for (const angle of peopleAngles) {
    const reach = mapReach(albums, angle);
    const { c, s, push } = along(angle);
    if (c > 1e-6) radius = Math.min(radius, (halfW - labelWidth / 2 - c * push) / (c * reach));
    if (s > 1e-6) radius = Math.min(radius, (halfH - labelHeight / 2 - s * push) / (s * reach));
  }

  const middle = { x: width / 2, y: height / 2 };
  const place = (angle) => {
    const out = radius * mapReach(albums, angle) + along(angle).push;
    const x = middle.x + Math.cos(angle) * out - labelWidth / 2;
    const y = middle.y - Math.sin(angle) * out - labelHeight / 2;
    // Kept inside the box.
    return {
      x: Math.max(edge, Math.min(width - edge - labelWidth, x)),
      y: Math.max(edge, Math.min(height - edge - labelHeight, y)),
    };
  };

  const labelAngles = [...peopleAngles];
  const overlap = (a, b) =>
    Math.abs(a.x - b.x) < labelWidth + 4 && Math.abs(a.y - b.y) < labelHeight + 2;
  for (let step = 0; step < 200; step++) {
    const spots = labelAngles.map(place);
    let moved = false;
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        if (!overlap(spots[i], spots[j])) continue;
        // Apart around the circle, each away from the other.
        const apart = Math.sin(labelAngles[j] - labelAngles[i]) >= 0 ? 1 : -1;
        labelAngles[i] -= apart * 0.02;
        labelAngles[j] += apart * 0.02;
        moved = true;
      }
    }
    if (!moved) break;
  }

  return {
    radius,
    middle,
    labels: payload.people.map((p, i) => ({
      name: p.name,
      dot: {
        x: middle.x + Math.cos(peopleAngles[i]) * radius,
        y: middle.y - Math.sin(peopleAngles[i]) * radius,
      },
      ...place(labelAngles[i]),
    })),
  };
}

/** The footer, compact: for the map, where the picture needs the room. */
const smallWatermark = (story) =>
  h(
    "div",
    { alignItems: "center", justifyContent: "space-between", width: "100%" },
    h(
      "div",
      { alignItems: "center", gap: 10 },
      h(
        "div",
        {
          width: story ? 34 : 28,
          height: story ? 34 : 28,
          borderRadius: 999,
          border: `${story ? 4 : 3}px solid ${C.foreground}`,
          alignItems: "center",
          justifyContent: "center",
        },
        h("div", { width: 10, height: 10, borderRadius: 999, background: C.primary }),
      ),
      line("VINYL PERIPHERY", {
        fontFamily: "Bebas Neue",
        fontSize: story ? 40 : 32,
        letterSpacing: 1.5,
        color: C.foreground,
      }),
    ),
    line("vinylperiphery.com", {
      fontFamily: "IBM Plex Mono",
      fontSize: story ? 24 : 19,
      color: C.muted,
    }),
  );

/** Map: the centre album, the albums around it, the people on the rim. */
export function mapElement(payload, size, art) {
  const story = size.name === "story";
  const pad = story ? 88 : 48;
  const headerHeight = story ? 190 : 118;
  const footerHeight = story ? 40 : 32;
  // The map runs edge to edge, between the header and the footer.
  const box = {
    width: size.width,
    height: size.height - 2 * pad - headerHeight - footerHeight + (story ? 0 : 24),
  };
  const top = pad + headerHeight;
  const { radius, middle, labels } = mapGeometry(payload, {
    ...box,
    labelWidth: story ? 140 : 112,
    labelHeight: story ? 48 : 36,
    gap: story ? 14 : 10,
    edge: story ? 16 : 10,
  });
  const { centre } = payload;

  const at = (x, y, side) => ({
    position: "absolute",
    left: Math.round(middle.x + x * radius - side / 2),
    top: Math.round(middle.y - y * radius - side / 2),
  });
  const dot = story ? 12 : 9;
  const centreSide = Math.round(MAP_SIZES.centre * radius);

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
            width: story ? 140 : 112,
            height: story ? 48 : 36,
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontFamily: "IBM Plex Mono",
            fontSize: story ? 19 : 15,
            lineHeight: 1.2,
            color: C.muted,
            overflow: "hidden",
          },
          label.name,
        ),
      ]),
      ...payload.albums.map((album) => {
        const side = Math.round(MAP_SIZES[album.z] * radius);
        return h("div", at(album.x, album.y, side), tile(album, art.get(album.i), side, false));
      }),
      h("div", at(0, 0, centreSide), tile(centre, art.get(centre.i), centreSide, true)),
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
        gap: story ? 10 : 4,
      },
      eyebrow("Connections around", story ? 1 : 0.7),
      line(centre.t, {
        fontFamily: "Bebas Neue",
        fontSize: story ? 96 : 56,
        lineHeight: 1,
        color: C.foreground,
      }),
      line(centre.r, { fontSize: story ? 34 : 22, color: C.muted }),
    ),
    // Footer, along the bottom.
    h(
      "div",
      { position: "absolute", left: pad, bottom: story ? pad : 28, width: size.width - 2 * pad },
      smallWatermark(story),
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

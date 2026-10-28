// Share image layouts for @vercel/og (Satori), built as plain element
// objects so the backend needs no JSX build. Two layouts, two sizes:
//   card:  the searched album, then its top results with "N shared"
//   trail: root to current, with the people linking each step
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

/**
 * Steps to draw: all of them when they fit, otherwise the root, a gap
 * marker, and the most recent steps.
 */
export const fitSteps = (steps, max) =>
  steps.length <= max
    ? steps.map((s) => ({ ...s, gapBefore: false }))
    : [
        { ...steps[0], gapBefore: false },
        ...steps
          .slice(steps.length - (max - 1))
          .map((s, i) => ({ ...s, gapBefore: i === 0 })),
      ];

/** Trail: root to current, with who linked each step to the last. */
export function trailElement(payload, size, art) {
  const story = size.name === "story";
  const scale = story ? 1 : 0.8;
  const steps = fitSteps(payload.steps, story ? 5 : 3);
  const coverSize = story ? (steps.length > 4 ? 150 : 190) : 130;

  const link = (step) =>
    h(
      "div",
      {
        alignItems: "center",
        gap: 24 * scale,
        paddingLeft: coverSize / 2 - 2,
        minHeight: story ? 70 : 54,
      },
      h("div", { width: 4, height: story ? 70 : 54, background: C.primary }),
      line(
        step.gapBefore
          ? "…"
          : step.via.length
            ? `via ${step.via.join(", ")}`
            : "",
        {
          fontFamily: "IBM Plex Mono",
          fontSize: 26 * scale,
          color: C.primaryText,
          maxWidth: 760,
        },
      ),
    );

  return frame(
    size,
    h(
      "div",
      // Centred in the space above the watermark.
      { flexDirection: "column", gap: story ? 36 : 22, flexGrow: 1, justifyContent: "center", paddingBottom: story ? 48 : 32 },
      eyebrow("Follow the trail", scale),
      h(
        "div",
        { flexDirection: "column" },
        ...steps.map((step, i) =>
          h(
            "div",
            { flexDirection: "column" },
            i > 0 && link(step),
            h(
              "div",
              { alignItems: "center", gap: 32 * scale },
              cover(step.t, art.get(step.i), coverSize, 8),
              h(
                "div",
                { flexDirection: "column", gap: 6, maxWidth: story ? 680 : 760 },
                line(step.t, {
                  fontFamily: "Bebas Neue",
                  fontSize: (story ? 72 : 60),
                  lineHeight: 1,
                }),
                line(step.r, { fontSize: 32 * scale, color: C.muted }),
              ),
            ),
          ),
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
    : payload.steps
  )
    .map((item) => item.i)
    .filter(Boolean);

/** Renders a decoded payload to PNG bytes. `art` maps art id -> data URL. */
export async function renderPng(payload, size, art) {
  const element =
    payload.layout === "card"
      ? cardElement(payload, size, art)
      : trailElement(payload, size, art);
  const response = new ImageResponse(element, {
    width: size.width,
    height: size.height,
    fonts: await loadFonts(),
  });
  return Buffer.from(await response.arrayBuffer());
}

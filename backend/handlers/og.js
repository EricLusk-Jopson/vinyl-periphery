import { allowMethods, queryString } from "./http.js";
import { decodePayload, imageSize } from "../og/payload.js";
import { artIds, renderPng } from "../og/render.js";
import { loadArt } from "../og/art.js";

/**
 * GET /api/og?p=<payload>&size=story|square
 *
 * Renders a share image (PNG) from the payload in the URL: a periphery card
 * or a trail, 1080x1920 or 1080x1080. Never calls Discogs; the only fetches
 * are Cover Art Archive images. The URL fully describes the image, so it
 * caches for good. Also the og:image for shared links (see share.js).
 */
export const createOgHandler =
  ({ load = loadArt, render = renderPng } = {}) =>
  async (req, res) => {
    if (!allowMethods(req, res, ["GET", "HEAD"])) return;
    const payload = decodePayload(queryString(req.query?.p));
    if (!payload) {
      res.status(400).json({ error: "Invalid share payload" });
      return;
    }
    const size = imageSize(queryString(req.query?.size));
    try {
      const art = await load(artIds(payload));
      const png = await render(payload, size, art);
      res.setHeader("Content-Type", "image/png");
      res.setHeader(
        "Cache-Control",
        "public, max-age=86400, s-maxage=31536000, immutable",
      );
      res.status(200);
      res.end(req.method === "HEAD" ? undefined : png);
    } catch (error) {
      console.error("Share image failed:", error.message);
      res.status(500).json({ error: "Could not render the image" });
    }
  };

export default createOgHandler();

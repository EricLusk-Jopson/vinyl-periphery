import { allowMethods, queryString } from "./http.js";
import { decodePayload, imageSize } from "../og/payload.js";
import { artIds, renderPng } from "../og/render.js";
import { artSettled, loadArt } from "../og/art.js";

/**
 * GET /api/og?p=<payload>&size=story|square
 *
 * Renders a share image (PNG) from the payload in the URL: a periphery card
 * or a trail, 1080x1920 or 1080x1080. Never calls Discogs; the only fetches
 * are Cover Art Archive images. The URL fully describes the image, so it
 * caches for good, once every cover has loaded or is known to be missing;
 * if one timed out, only briefly, so the next request tries again. Also the
 * og:image for shared links (see share.js).
 */
export const createOgHandler =
  ({ load = loadArt, render = renderPng, settled = artSettled } = {}) =>
  async (req, res) => {
    if (!allowMethods(req, res, ["GET", "HEAD"])) return;
    const payload = decodePayload(queryString(req.query?.p));
    if (!payload) {
      res.status(400).json({ error: "Invalid share payload" });
      return;
    }
    const size = imageSize(queryString(req.query?.size));
    try {
      const ids = artIds(payload);
      const art = await load(ids);
      const png = await render(payload, size, art);
      const complete = ids.every((id) => art.has(id) || settled(id));
      res.setHeader("Content-Type", "image/png");
      res.setHeader(
        "Cache-Control",
        complete
          ? "public, max-age=86400, s-maxage=31536000, immutable"
          : "public, max-age=60, s-maxage=60",
      );
      res.status(200);
      res.end(req.method === "HEAD" ? undefined : png);
    } catch (error) {
      console.error("Share image failed:", error.message);
      res.status(500).json({ error: "Could not render the image" });
    }
  };

export default createOgHandler();

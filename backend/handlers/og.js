import { allowMethods } from "./http.js";
import { IMAGE_SIZE, MAX_PAYLOAD_BYTES, parsePayload, readBody } from "../og/payload.js";
import { artIds, renderPng } from "../og/render.js";
import { loadArt } from "../og/art.js";

/**
 * POST /api/og, with the payload as a JSON body
 *
 * Renders a square share image (PNG, 1080x1080): a map of a stack or a
 * search, or a periphery card. Never calls Discogs; the only fetches are
 * cover images. The app shows the returned image as its preview and shares
 * that same file, so there's nothing for a CDN to cache: each Regenerate in
 * the share sheet is one request.
 */
export const createOgHandler =
  ({ load = loadArt, render = renderPng } = {}) =>
  async (req, res) => {
    if (!allowMethods(req, res, ["POST"])) return;
    const length = Number(req.headers?.["content-length"]);
    if (Number.isFinite(length) && length > MAX_PAYLOAD_BYTES) {
      res.status(413).json({ error: "Share payload too large" });
      return;
    }
    // readBody also refuses bodies over the limit that came without a length.
    const payload = parsePayload(readBody(req.body));
    if (!payload) {
      res.status(400).json({ error: "Invalid share payload" });
      return;
    }
    try {
      const art = await load(artIds(payload));
      const png = await render(payload, IMAGE_SIZE, art);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-store");
      res.status(200);
      res.end(png);
    } catch (error) {
      console.error("Share image failed:", error.message);
      res.status(500).json({ error: "Could not render the image" });
    }
  };

export default createOgHandler();

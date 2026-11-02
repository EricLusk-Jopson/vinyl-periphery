import { getDiscogs, rateLimitRemaining } from "../services/discogs.service.js";
import { allowMethods, queryString } from "./http.js";

/**
 * GET /api/art?key=master:123 (or release:456)
 *
 * A cover from Discogs for an album MusicBrainz and the Cover Art Archive
 * don't have, read from its master or release with the app's key. Only
 * ever asked for by a user ("Find missing covers"), one album a request.
 *
 * The app's 60 requests a minute are shared by every user and by search,
 * so art keeps out of the way: below ART_RESERVE remaining (as last seen
 * by this instance) it answers 429 without calling Discogs, and passes
 * Discogs's own 429 on. Answers are deterministic per key, so the CDN
 * keeps them (30 days for a cover, a day for none) and repeat requests
 * from anyone never reach Discogs.
 */

export const ART_KEY = /^(master|release):(\d{1,10})$/;
/** Remaining requests left for search: art stops below this. */
export const ART_RESERVE = 20;
export const HIT_CACHE = "public, s-maxage=2592000, stale-while-revalidate=86400";
export const MISS_CACHE = "public, s-maxage=86400";

/** The primary image, or else the first; null when there are none. */
export const pickImage = (images) => {
  if (!Array.isArray(images) || images.length === 0) return null;
  const image = images.find((i) => i?.type === "primary") ?? images[0];
  const uri = typeof image?.uri === "string" && image.uri ? image.uri : null;
  const thumb = typeof image?.uri150 === "string" && image.uri150 ? image.uri150 : uri;
  return uri ? { image: uri, thumb } : null;
};

const busy = (res, retryAfter) => {
  res.setHeader("Retry-After", String(retryAfter || 60));
  res.setHeader("Cache-Control", "no-store");
  res.status(429).json({ error: "Discogs is busy" });
};

export const createArtHandler =
  ({ getClient = getDiscogs, remaining = rateLimitRemaining, reserve = ART_RESERVE } = {}) =>
  async (req, res) => {
    if (!allowMethods(req, res, ["GET", "HEAD"])) return;
    const key = queryString(req.query?.key);
    const match = ART_KEY.exec(key);
    if (!match) {
      res.status(400).json({ error: "key must be master:<id> or release:<id>" });
      return;
    }
    const left = remaining();
    if (left !== null && left < reserve) {
      console.log("Art: holding back for search", { key, rateLimitRemaining: left });
      busy(res, 60);
      return;
    }
    let client;
    try {
      client = getClient();
    } catch (error) {
      console.error("Discogs client unavailable:", error.message);
      res.status(500).json({ error: "Art is not configured" });
      return;
    }
    try {
      const { images, rateLimitRemaining } = await client.getImages(match[1], Number(match[2]));
      console.log("Art:", { key, rateLimitRemaining });
      const picked = pickImage(images);
      res.setHeader("Cache-Control", picked ? HIT_CACHE : MISS_CACHE);
      res.status(200).json({ key, thumb: picked?.thumb ?? null, image: picked?.image ?? null });
    } catch (error) {
      console.log("Art error:", { key, status: error.status, rateLimitRemaining: error.rateLimitRemaining });
      if (error.status === 429) {
        busy(res, Number(error.retryAfter) || 60);
        return;
      }
      if (error.status === 404) {
        // No such master or release: no art, for a day.
        res.setHeader("Cache-Control", MISS_CACHE);
        res.status(200).json({ key, thumb: null, image: null });
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      res.status(502).json({ error: "Discogs didn't answer" });
    }
  };

export default createArtHandler();

import { getDiscogs } from "../services/discogs.service.js";
import { allowMethods, queryString } from "./http.js";

/**
 * GET /api/search?band=<artist>&album=<album>
 *
 * Searches Discogs releases with the app's key and secret and returns the
 * Discogs response as is.
 */
export const createSearchHandler = (getClient) => async (req, res) => {
  if (!allowMethods(req, res, ["GET", "HEAD"])) return;

  const album = queryString(req.query?.album);
  const band = queryString(req.query?.band);
  if (!album || !band) {
    res.status(400).json({ error: "Please provide both band name and album name" });
    return;
  }

  let client;
  try {
    client = getClient();
  } catch (error) {
    console.error("Discogs client unavailable:", error.message);
    res.status(500).json({ error: "Search is not configured" });
    return;
  }

  try {
    const { data, rateLimitRemaining } = await client.searchRelease(album, band);
    if (rateLimitRemaining) {
      res.setHeader("X-Ratelimit-Remaining", rateLimitRemaining);
    }
    res.status(200).json(data);
  } catch (error) {
    console.error("Search error:", error.message);
    res
      .status(error.status || 500)
      .json({ error: error.message || "Internal server error" });
  }
};

export default createSearchHandler(getDiscogs);

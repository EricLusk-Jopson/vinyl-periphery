import expressAsyncHandler from "express-async-handler";
import DiscogsService from "../services/discogs.service.js";

const discogsService = new DiscogsService({
  consumerKey: process.env.CONSUMER_KEY,
  consumerSecret: process.env.CONSUMER_SECRET,
  userAgent: "VinylPeriphery/1.0.0",
});

// Log initial configuration
console.log("Discogs service initialized:", {
  hasConsumerKey: !!process.env.CONSUMER_KEY,
  hasConsumerSecret: !!process.env.CONSUMER_SECRET,
  baseURL: discogsService.baseURL,
});

/**
 * Search for a record in Discogs database
 * @desc    Get search results from a band and album string
 * @route   GET /api/search
 * @access  Public
 */
const searchForRecord = expressAsyncHandler(async (req, res) => {
  console.log("Received search request:", {
    album: req.query.album,
    band: req.query.band,
    headers: req.headers,
  });

  const { album, band } = req.query;

  if (!album || !band) {
    res.status(400).json({
      error: "Please provide both band name and album name",
    });
    return;
  }

  try {
    const { data, rateLimitRemaining } = await discogsService.searchRelease(
      album,
      band
    );

    if (rateLimitRemaining) {
      res.set("X-Ratelimit-Remaining", rateLimitRemaining);
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Search error:", error);

    res.status(error.status || 500).json({
      error: error.message || "Internal server error",
    });
  }
});

export default searchForRecord;

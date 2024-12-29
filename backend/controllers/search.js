// controllers/search.js
import expressAsyncHandler from "express-async-handler";

/**
 * Search for a record in Discogs database
 * @desc    Get search results from a band and album string
 * @route   GET /api/search
 * @access  Public
 */
const searchForRecord = expressAsyncHandler(async (req, res) => {
  const { album, band } = req.query;

  // Validate required fields
  if (!album || !band) {
    res.status(400);
    throw new Error("Please provide both band name and album name");
  }

  try {
    const url = new URL("https://api.discogs.com/database/search");

    // Add search parameters
    const params = {
      release_title: album,
      artist: band,
      type: "release",
      credit: "",
      sort: "have",
      sort_order: "desc",
      key: process.env.CONSUMER_KEY,
      secret: process.env.CONSUMER_SECRET,
    };

    url.search = new URLSearchParams(params).toString();
    console.log(url.search);

    const response = await fetch(url);
    console.log(response);

    // Check if the response was ok
    if (!response.ok) {
      throw new Error(`Discogs API error: ${response.statusText}`);
    }

    const results = await response.json();

    // Check if we got rate limited
    if (response.headers.get("X-Discogs-Ratelimit-Remaining")) {
      res.set(
        "X-Ratelimit-Remaining",
        response.headers.get("X-Discogs-Ratelimit-Remaining")
      );
    }

    res.status(200).json(results);
  } catch (error) {
    console.error("Search error:", error);
    res.status(error.status || 500);
    throw new Error(error.message || "Error fetching from Discogs API");
  }
});

export default searchForRecord;

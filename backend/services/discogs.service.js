// services/discogs.service.js

class DiscogsAPIError extends Error {
  constructor(message, status, rateLimitRemaining) {
    super(message);
    this.name = "DiscogsAPIError";
    this.status = status;
    this.rateLimitRemaining = rateLimitRemaining;
  }
}

class DiscogsService {
  constructor(config) {
    this.baseURL = "https://api.discogs.com";
    this.consumerKey = config.consumerKey;
    this.consumerSecret = config.consumerSecret;
    this.userAgent = config.userAgent || "VinylPeriphery/1.0.0";
  }

  async searchRelease(album, band) {
    const url = new URL(`${this.baseURL}/database/search`);
    const params = {
      release_title: album,
      artist: band,
      type: "release",
      credit: "",
      sort: "have",
      sort_order: "desc",
      key: this.consumerKey,
      secret: this.consumerSecret,
    };

    url.search = new URLSearchParams(params).toString();

    try {
      const response = await fetch(url, {
        timeout: 8000,
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/json",
        },
      });

      const rateLimitRemaining = response.headers.get(
        "X-Discogs-Ratelimit-Remaining"
      );

      if (!response.ok) {
        throw new DiscogsAPIError(
          `Discogs API error: ${response.statusText}`,
          response.status,
          rateLimitRemaining
        );
      }

      const data = await response.json();
      return {
        data,
        rateLimitRemaining,
      };
    } catch (error) {
      if (error instanceof DiscogsAPIError) {
        throw error;
      }

      // Handle network errors
      if (error.name === "AbortError") {
        throw new DiscogsAPIError("Request timeout", 504);
      }

      throw new DiscogsAPIError(
        error.message || "Failed to fetch from Discogs API",
        500
      );
    }
  }
}

export default DiscogsService;

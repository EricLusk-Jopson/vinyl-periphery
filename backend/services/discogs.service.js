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

    if (!this.consumerKey || !this.consumerSecret) {
      throw new Error("Consumer key and secret are required");
    }
  }

  async fetchWithRetry(url, options, retries = 3, baseDelay = 1000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
        console.log(
          `Request timed out after ${options.timeout}ms on attempt ${attempt}`
        );
      }, options.timeout);

      try {
        console.log(`Attempt ${attempt} of ${retries}`);
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        return response;
      } catch (error) {
        clearTimeout(timeout);

        if (attempt === retries) {
          throw error;
        }

        const delay =
          baseDelay * Math.pow(2, attempt - 1) * (0.5 + Math.random());
        console.log(
          `Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
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

    console.log("Attempting Discogs API request:", {
      url: url
        .toString()
        .replace(/key=.*?&/, "key=REDACTED&")
        .replace(/secret=.*$/, "secret=REDACTED"),
      hasConsumerKey: !!this.consumerKey,
      hasConsumerSecret: !!this.consumerSecret,
      userAgent: this.userAgent,
    });

    try {
      const response = await this.fetchWithRetry(url, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/json",
        },
        timeout: 15000,
      });

      const rateLimitRemaining = response.headers.get(
        "X-Discogs-Ratelimit-Remaining"
      );

      console.log("Discogs API Response:", {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        rateLimitRemaining,
      });

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
      console.error("Detailed error information:", {
        name: error.name,
        message: error.message,
        cause: error.cause,
        stack: error.stack,
        isDiscogsAPIError: error instanceof DiscogsAPIError,
        isAbortError: error.name === "AbortError",
      });

      if (error instanceof DiscogsAPIError) {
        throw error;
      }

      if (error.name === "AbortError") {
        throw new DiscogsAPIError("Request timeout", 504);
      }

      throw new DiscogsAPIError(
        `Failed to fetch from Discogs API: ${error.message}`,
        500
      );
    }
  }
}

export default DiscogsService;

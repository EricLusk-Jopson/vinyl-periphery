class DiscogsAPIError extends Error {
  constructor(message, status, rateLimitRemaining) {
    super(message);
    this.name = "DiscogsAPIError";
    this.status = status;
    this.rateLimitRemaining = rateLimitRemaining;
  }
}

/**
 * The app key's last known X-Discogs-Ratelimit-Remaining, from any Discogs
 * response this instance has seen. Per function instance, so best effort;
 * Discogs's own 429 is the real limit. Discogs counts over a moving
 * minute, so a reading older than that says nothing.
 */
const RATE_WINDOW_MS = 60 * 1000;
const rate = { remaining: null, seenAt: 0 };

export function recordRateLimit(value, now = Date.now()) {
  const n = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(n)) return;
  rate.remaining = n;
  rate.seenAt = now;
}

/** The last remaining count seen in the past minute, or null. */
export function rateLimitRemaining(now = Date.now()) {
  return rate.remaining !== null && now - rate.seenAt < RATE_WINDOW_MS ? rate.remaining : null;
}

/** For tests. */
export function resetRateLimit() {
  rate.remaining = null;
  rate.seenAt = 0;
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
      recordRateLimit(rateLimitRemaining);

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

DiscogsService.prototype.getImages = async function getImages(type, id) {
  // One try, no retries: a retry spends the shared budget again.
  const url = new URL(`${this.baseURL}/${type}s/${id}`);
  url.search = new URLSearchParams({ key: this.consumerKey, secret: this.consumerSecret }).toString();
  let response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": this.userAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    throw new DiscogsAPIError(
      error.name === "TimeoutError" || error.name === "AbortError" ? "Request timeout" : `Failed to fetch from Discogs API: ${error.message}`,
      504,
    );
  }
  const rateLimitRemaining = response.headers.get("X-Discogs-Ratelimit-Remaining");
  recordRateLimit(rateLimitRemaining);
  const retryAfter = response.headers.get("Retry-After");
  if (!response.ok) {
    const error = new DiscogsAPIError(`Discogs API error: ${response.status}`, response.status, rateLimitRemaining);
    error.retryAfter = retryAfter;
    throw error;
  }
  const data = await response.json();
  return { images: Array.isArray(data?.images) ? data.images : [], rateLimitRemaining };
};

export { DiscogsAPIError };

let client = null;

/**
 * The shared Discogs client, created on first use so a missing key fails the
 * request that needs it instead of the whole server or function at import.
 */
export function getDiscogs() {
  if (!client) {
    client = new DiscogsService({
      consumerKey: process.env.CONSUMER_KEY,
      consumerSecret: process.env.CONSUMER_SECRET,
      userAgent: "VinylPeriphery/1.0.0",
    });
  }
  return client;
}

export default DiscogsService;

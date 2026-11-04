import { test } from "node:test";
import assert from "node:assert/strict";
import { ART_KEY, ART_RESERVE, createArtHandler, HIT_CACHE, MISS_CACHE, pickImage } from "./art.js";
import { mockRequest, mockResponse } from "./testing.js";
import { DiscogsAPIError, rateLimitRemaining, recordRateLimit, resetRateLimit } from "../services/discogs.service.js";

const quiet = async (fn) => {
  const log = console.log;
  const error = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.log = log;
    console.error = error;
  }
};

const fakeClient = (answer) => {
  const calls = [];
  return {
    calls,
    getClient: () => ({
      getImages: async (type, id) => {
        calls.push([type, id]);
        return answer(type, id);
      },
    }),
  };
};

const ask = async (handler, query, method = "GET") => {
  const res = mockResponse();
  await quiet(() => handler(mockRequest({ method, query }), res));
  return res;
};

test("validates the key strictly", async () => {
  for (const key of ["master:1", "release:1234567890"]) assert.match(key, ART_KEY);
  const { calls, getClient } = fakeClient(() => ({ images: [] }));
  const handler = createArtHandler({ getClient, remaining: () => null });
  for (const key of ["", "master:", "master:12345678901", "label:1", "master:1x", " release:2;", "master:-1"]) {
    const res = await ask(handler, { key });
    assert.equal(res.statusCode, 400, key);
  }
  assert.equal(calls.length, 0);
  const post = await ask(handler, { key: "master:1" }, "POST");
  assert.equal(post.statusCode, 405);
});

test("reads the primary image, else the first, else none", () => {
  const images = [
    { type: "secondary", uri: "https://i.discogs.com/a/s.jpeg", uri150: "https://i.discogs.com/a/s150.jpeg" },
    { type: "primary", uri: "https://i.discogs.com/a/p.jpeg", uri150: "https://i.discogs.com/a/p150.jpeg" },
  ];
  assert.deepEqual(pickImage(images), {
    image: "https://i.discogs.com/a/p.jpeg",
    thumb: "https://i.discogs.com/a/p150.jpeg",
  });
  assert.deepEqual(pickImage([images[0]]), {
    image: "https://i.discogs.com/a/s.jpeg",
    thumb: "https://i.discogs.com/a/s150.jpeg",
  });
  assert.deepEqual(pickImage([{ type: "primary", uri: "https://i.discogs.com/x.jpeg" }]), {
    image: "https://i.discogs.com/x.jpeg",
    thumb: "https://i.discogs.com/x.jpeg",
  });
  assert.equal(pickImage([]), null);
  assert.equal(pickImage(undefined), null);
  assert.equal(pickImage([{ type: "primary", uri: "" }]), null);
});

test("answers a cover, cached for 30 days at the CDN", async () => {
  const { calls, getClient } = fakeClient(() => ({
    images: [{ type: "primary", uri: "https://i.discogs.com/p.jpeg", uri150: "https://i.discogs.com/t.jpeg" }],
    rateLimitRemaining: "55",
  }));
  const res = await ask(createArtHandler({ getClient, remaining: () => 55 }), { key: "master:123" });
  assert.deepEqual(calls, [["master", 123]]);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["cache-control"], HIT_CACHE);
  assert.deepEqual(res.body, { key: "master:123", thumb: "https://i.discogs.com/t.jpeg", image: "https://i.discogs.com/p.jpeg" });
});

test("answers none, cached for a day, with no images or no such album", async () => {
  const empty = fakeClient(() => ({ images: [] }));
  const res = await ask(createArtHandler({ getClient: empty.getClient, remaining: () => null }), { key: "release:9" });
  assert.equal(res.headers["cache-control"], MISS_CACHE);
  assert.deepEqual(res.body, { key: "release:9", thumb: null, image: null });
  const missing = fakeClient(() => {
    throw new DiscogsAPIError("Not found", 404, "50");
  });
  const gone = await ask(createArtHandler({ getClient: missing.getClient, remaining: () => null }), { key: "release:9" });
  assert.equal(gone.statusCode, 200);
  assert.equal(gone.headers["cache-control"], MISS_CACHE);
  assert.equal(gone.body.image, null);
});

test("holds back below the reserve without calling Discogs", async () => {
  const { calls, getClient } = fakeClient(() => assert.fail("should not call Discogs"));
  const res = await ask(createArtHandler({ getClient, remaining: () => ART_RESERVE - 1 }), { key: "master:1" });
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers["retry-after"], "60");
  assert.equal(res.headers["cache-control"], "no-store");
  assert.equal(calls.length, 0);
  // At the reserve it goes ahead.
  const ok = fakeClient(() => ({ images: [] }));
  const at = await ask(createArtHandler({ getClient: ok.getClient, remaining: () => ART_RESERVE }), { key: "master:1" });
  assert.equal(at.statusCode, 200);
});

test("passes Discogs's 429 on, and fails other errors uncached", async () => {
  const limited = fakeClient(() => {
    const error = new DiscogsAPIError("Too many", 429, "0");
    error.retryAfter = "30";
    throw error;
  });
  const res = await ask(createArtHandler({ getClient: limited.getClient, remaining: () => null }), { key: "master:1" });
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers["retry-after"], "30");
  const broken = fakeClient(() => {
    throw new DiscogsAPIError("Boom", 500);
  });
  const failed = await ask(createArtHandler({ getClient: broken.getClient, remaining: () => null }), { key: "master:1" });
  assert.equal(failed.statusCode, 502);
  assert.equal(failed.headers["cache-control"], "no-store");
});

test("keeps the last remaining count for a minute", () => {
  resetRateLimit();
  assert.equal(rateLimitRemaining(), null);
  recordRateLimit("42", 1000);
  assert.equal(rateLimitRemaining(1000 + 59_000), 42);
  assert.equal(rateLimitRemaining(1000 + 61_000), null);
  recordRateLimit(null, 5000);
  assert.equal(rateLimitRemaining(5000), 42);
  resetRateLimit();
});

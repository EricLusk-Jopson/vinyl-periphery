import { test } from "node:test";
import assert from "node:assert/strict";
import { createSearchHandler } from "./search.js";
import { mockRequest, mockResponse } from "./testing.js";

test("rejects other methods with 405", async () => {
  const handler = createSearchHandler(() => assert.fail("should not search"));
  const res = mockResponse();
  await handler(mockRequest({ method: "POST" }), res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.allow, "GET, HEAD");
});

test("requires both band and album", async () => {
  const handler = createSearchHandler(() => assert.fail("should not search"));
  const res = mockResponse();
  await handler(mockRequest({ query: { band: "Pink Floyd", album: "  " } }), res);
  assert.equal(res.statusCode, 400);
});

test("returns Discogs data and passes the rate limit header on", async () => {
  const calls = [];
  const handler = createSearchHandler(() => ({
    searchRelease: async (album, band) => {
      calls.push([album, band]);
      return { data: { results: [{ id: 1 }] }, rateLimitRemaining: "59" };
    },
  }));
  const res = mockResponse();
  await handler(
    mockRequest({ query: { band: ["Talk Talk", "x"], album: " Spirit of Eden " } }),
    res,
  );
  assert.deepEqual(calls, [["Spirit of Eden", "Talk Talk"]]);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { results: [{ id: 1 }] });
  assert.equal(res.headers["x-ratelimit-remaining"], "59");
});

test("uses the Discogs error status", async () => {
  const handler = createSearchHandler(() => ({
    searchRelease: async () => {
      const error = new Error("Discogs API error: Too Many Requests");
      error.status = 429;
      throw error;
    },
  }));
  const res = mockResponse();
  await handler(mockRequest({ query: { band: "a", album: "b" } }), res);
  assert.equal(res.statusCode, 429);
});

test("reports a missing key as not configured", async () => {
  const handler = createSearchHandler(() => {
    throw new Error("Consumer key and secret are required");
  });
  const res = mockResponse();
  await handler(mockRequest({ query: { band: "a", album: "b" } }), res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, "Search is not configured");
});

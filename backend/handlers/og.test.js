import { test } from "node:test";
import assert from "node:assert/strict";
import { createOgHandler } from "./og.js";
import { mockRequest, mockResponse } from "./testing.js";
import { encodePayload } from "../og/payload.js";

const MBID = "1b022e01-4da6-387b-8658-8678046e4cef";
const card = encodePayload({
  v: 1,
  l: "card",
  a: { t: "Unmap", r: "Volcano Choir", i: `g:${MBID}` },
  x: [{ t: "Bon Iver", r: "Bon Iver", i: "", n: 2 }],
});

test("renders a PNG for a valid payload, caching it for good", async () => {
  const calls = [];
  const handler = createOgHandler({
    settled: () => true,
    load: async (ids) => {
      calls.push(ids);
      return new Map();
    },
    render: async (payload, size) => {
      calls.push([payload.layout, size.name]);
      return Buffer.from("png");
    },
  });
  const res = mockResponse();
  await handler(mockRequest({ query: { p: card, size: "square" } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["content-type"], "image/png");
  assert.match(res.headers["cache-control"], /immutable/);
  assert.deepEqual(calls, [[`g:${MBID}`], ["card", "square"]]);
  assert.equal(String(res.body), "png");
});

test("caches briefly when a cover didn't load in time", async () => {
  const handler = createOgHandler({
    load: async () => new Map(),
    render: async () => Buffer.from("png"),
    settled: () => false,
  });
  const res = mockResponse();
  await handler(mockRequest({ query: { p: card } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["cache-control"], "public, max-age=60, s-maxage=60");
});

test("rejects a bad payload with 400 and other methods with 405", async () => {
  const handler = createOgHandler({
    load: async () => new Map(),
    render: async () => Buffer.from(""),
  });
  const bad = mockResponse();
  await handler(mockRequest({ query: { p: "nope" } }), bad);
  assert.equal(bad.statusCode, 400);
  const post = mockResponse();
  await handler(mockRequest({ method: "POST", query: { p: card } }), post);
  assert.equal(post.statusCode, 405);
});

test("answers 500 when rendering fails", async () => {
  const handler = createOgHandler({
    load: async () => new Map(),
    render: async () => {
      throw new Error("boom");
    },
  });
  const res = mockResponse();
  const original = console.error;
  console.error = () => {};
  await handler(mockRequest({ query: { p: card } }), res);
  console.error = original;
  assert.equal(res.statusCode, 500);
});

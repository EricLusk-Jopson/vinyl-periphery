import { test } from "node:test";
import assert from "node:assert/strict";
import { createOgHandler } from "./og.js";
import { mockRequest, mockResponse } from "./testing.js";
import { MAX_PAYLOAD_BYTES } from "../og/payload.js";

const MBID = "1b022e01-4da6-387b-8658-8678046e4cef";
const card = {
  v: 1,
  l: "card",
  a: { t: "Unmap", r: "Volcano Choir", i: `g:${MBID}` },
  x: [{ t: "Bon Iver", r: "Bon Iver", i: "", n: 2 }],
};
const post = (body, headers = {}) => mockRequest({ method: "POST", body, headers });

test("renders a PNG from a JSON body, uncached", async () => {
  const calls = [];
  const handler = createOgHandler({
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
  await handler(post(card), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["content-type"], "image/png");
  assert.equal(res.headers["cache-control"], "no-store");
  assert.deepEqual(calls, [[`g:${MBID}`], ["card", "square"]]);
  assert.equal(String(res.body), "png");
});

test("takes the body as JSON text too", async () => {
  const handler = createOgHandler({
    load: async () => new Map(),
    render: async () => Buffer.from("png"),
  });
  const res = mockResponse();
  await handler(post(JSON.stringify(card)), res);
  assert.equal(res.statusCode, 200);
});

test("rejects a bad payload with 400, GET with 405", async () => {
  const handler = createOgHandler({
    load: async () => new Map(),
    render: async () => Buffer.from(""),
  });
  const bad = mockResponse();
  await handler(post({ v: 1, l: "poster" }), bad);
  assert.equal(bad.statusCode, 400);
  const empty = mockResponse();
  await handler(post(undefined), empty);
  assert.equal(empty.statusCode, 400);
  const get = mockResponse();
  await handler(mockRequest({ query: { p: "x" } }), get);
  assert.equal(get.statusCode, 405);
  assert.equal(get.headers.allow, "POST");
});

test("refuses bodies over the limit", async () => {
  let rendered = false;
  const handler = createOgHandler({
    load: async () => new Map(),
    render: async () => {
      rendered = true;
      return Buffer.from("");
    },
  });
  const declared = mockResponse();
  await handler(post(card, { "content-length": String(MAX_PAYLOAD_BYTES + 1) }), declared);
  assert.equal(declared.statusCode, 413);
  const undeclared = mockResponse();
  await handler(post({ ...card, d: "a".repeat(MAX_PAYLOAD_BYTES) }), undeclared);
  assert.equal(undeclared.statusCode, 400);
  assert.equal(rendered, false);
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
  await handler(post(card), res);
  console.error = original;
  assert.equal(res.statusCode, 500);
});

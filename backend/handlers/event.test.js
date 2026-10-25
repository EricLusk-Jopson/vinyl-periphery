import { test } from "node:test";
import assert from "node:assert/strict";
import { createEventHandler, sameSite, sanitizeEvent } from "./event.js";
import { mockRequest, mockResponse } from "./testing.js";

const valid = {
  event: "search_started",
  properties: { artist: "Talk Talk", album: "Spirit of Eden", source: "form" },
  path: "/",
  referrer: "https://www.google.com/search?q=secret#frag",
  screenWidth: 390,
  sessionId: "abc123def456",
};

test("sanitizeEvent keeps allowed fields and cleans the referrer", () => {
  assert.deepEqual(sanitizeEvent(valid), {
    event: "search_started",
    properties: { artist: "Talk Talk", album: "Spirit of Eden", source: "form" },
    url: "/",
    referrer: "https://www.google.com/search",
    screenWidth: 390,
    sessionId: "abc123def456",
  });
});

test("sanitizeEvent rejects unknown events and junk", () => {
  assert.equal(sanitizeEvent({ ...valid, event: "drop_table" }), null);
  assert.equal(sanitizeEvent("not json"), null);
  assert.equal(sanitizeEvent(null), null);
  assert.equal(sanitizeEvent([]), null);
});

test("sanitizeEvent accepts a JSON string body", () => {
  assert.equal(sanitizeEvent(JSON.stringify(valid)).event, "search_started");
});

test("sanitizeEvent drops bad properties and clips long values", () => {
  const { properties, url, screenWidth, sessionId } = sanitizeEvent({
    ...valid,
    path: "https://evil.example/",
    screenWidth: "wide",
    sessionId: "<script>",
    properties: {
      ok: "x".repeat(500),
      n: 3,
      flag: false,
      nested: { a: 1 },
      list: [1],
      "Bad-Key": "x",
      inf: Infinity,
    },
  });
  assert.deepEqual(Object.keys(properties), ["ok", "n", "flag"]);
  assert.equal(properties.ok.length, 200);
  assert.equal(url, "");
  assert.equal(screenWidth, "");
  assert.equal(sessionId, "");
});

test("sameSite allows same host and missing Origin, rejects others", () => {
  assert.equal(sameSite({ host: "vinylperiphery.com" }), true);
  assert.equal(
    sameSite({ host: "vinylperiphery.com", origin: "https://vinylperiphery.com" }),
    true,
  );
  // Vite's dev proxy rewrites the port but not the hostname.
  assert.equal(sameSite({ host: "localhost:5000", origin: "http://localhost:5173" }), true);
  assert.equal(sameSite({ host: "vinylperiphery.com", origin: "https://evil.example" }), false);
});

test("handler forwards a valid event with server fields and answers 204", async () => {
  const sent = [];
  const handler = createEventHandler({
    forward: async (url, payload) => sent.push([url, payload]),
    config: () => ({ ANALYTICS_URL: "https://script.example/exec", ANALYTICS_TOKEN: "t0k" }),
    now: () => new Date("2026-10-25T12:00:00Z"),
  });
  const res = mockResponse();
  await handler(
    mockRequest({ method: "POST", body: valid, headers: { "user-agent": "UA/1.0" } }),
    res,
  );
  assert.equal(res.statusCode, 204);
  assert.equal(sent.length, 1);
  const [url, payload] = sent[0];
  assert.equal(url, "https://script.example/exec");
  assert.equal(payload.app, "vinyl-periphery");
  assert.equal(payload.token, "t0k");
  assert.equal(payload.timestamp, "2026-10-25T12:00:00.000Z");
  assert.equal(payload.userAgent, "UA/1.0");
  assert.equal(payload.event, "search_started");
  assert.equal(payload.url, "/");
});

test("handler drops events quietly without ANALYTICS_URL", async () => {
  const handler = createEventHandler({
    forward: async () => assert.fail("should not forward"),
    config: () => ({}),
  });
  const res = mockResponse();
  await handler(mockRequest({ method: "POST", body: valid }), res);
  assert.equal(res.statusCode, 204);
});

test("handler still answers 204 when the sheet fails", async () => {
  const handler = createEventHandler({
    forward: async () => {
      throw new Error("timeout");
    },
    config: () => ({ ANALYTICS_URL: "https://script.example/exec" }),
  });
  const res = mockResponse();
  const original = console.error;
  console.error = () => {};
  try {
    await handler(mockRequest({ method: "POST", body: valid }), res);
  } finally {
    console.error = original;
  }
  assert.equal(res.statusCode, 204);
});

test("handler rejects bad input, other methods and other sites", async () => {
  const handler = createEventHandler({ config: () => ({}) });

  let res = mockResponse();
  await handler(mockRequest({ method: "POST", body: { event: "nope" } }), res);
  assert.equal(res.statusCode, 400);

  res = mockResponse();
  await handler(mockRequest({ method: "GET" }), res);
  assert.equal(res.statusCode, 405);

  res = mockResponse();
  await handler(
    mockRequest({
      method: "POST",
      body: valid,
      headers: { host: "vinylperiphery.com", origin: "https://evil.example" },
    }),
    res,
  );
  assert.equal(res.statusCode, 403);

  // A body getter that throws, as Vercel's does on malformed JSON.
  res = mockResponse();
  const req = mockRequest({ method: "POST" });
  Object.defineProperty(req, "body", {
    get() {
      throw new SyntaxError("Unexpected token");
    },
  });
  await handler(req, res);
  assert.equal(res.statusCode, 400);
});

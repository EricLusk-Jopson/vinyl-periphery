import { test } from "node:test";
import assert from "node:assert/strict";
import {
  coverArtUrl,
  decodePayload,
  encodePayload,
  imageSize,
  MAX_PAYLOAD_CHARS,
  MAX_RESULTS,
} from "./payload.js";

const MBID = "1b022e01-4da6-387b-8658-8678046e4cef";

test("decodes a periphery card, cleaning and clipping", () => {
  const payload = decodePayload(
    encodePayload({
      v: 1,
      l: "card",
      a: { t: "  Unmap ", r: "Volcano Choir", i: `g:${MBID.toUpperCase()}` },
      x: [
        { t: "Bon Iver", r: "Bon Iver", i: "r:not-an-mbid", n: 3.7 },
        { t: "", r: "dropped: no title", n: 1 },
        ...Array(10).fill({ t: "More", r: "A", n: 2 }),
      ],
    }),
  );
  assert.equal(payload.layout, "card");
  assert.deepEqual(payload.album, { t: "Unmap", r: "Volcano Choir", i: `g:${MBID}` });
  assert.deepEqual(payload.results[0], { t: "Bon Iver", r: "Bon Iver", i: "", n: 3 });
  assert.ok(payload.results.length <= MAX_RESULTS);
  assert.ok(payload.results.every((r) => r.t));
});

test("decodes a trail with via names", () => {
  const payload = decodePayload(
    encodePayload({
      v: 1,
      l: "trail",
      s: [
        { t: "Unmap", r: "Volcano Choir", i: "", v: [] },
        { t: "Bon Iver", r: "Bon Iver", i: `r:${MBID}`, v: ["Justin Vernon", 7, "x".repeat(99)] },
      ],
    }),
  );
  assert.equal(payload.layout, "trail");
  assert.equal(payload.steps[1].via[0], "Justin Vernon");
  assert.equal(payload.steps[1].via.length, 2);
  assert.equal(payload.steps[1].via[1].length, 40);
});

test("rejects missing, oversized, malformed and empty payloads", () => {
  assert.equal(decodePayload(""), null);
  assert.equal(decodePayload(undefined), null);
  assert.equal(decodePayload("a".repeat(MAX_PAYLOAD_CHARS + 1)), null);
  assert.equal(decodePayload("not base64 json"), null);
  assert.equal(decodePayload(encodePayload({ v: 2, l: "card", a: { t: "x" } })), null);
  assert.equal(decodePayload(encodePayload({ v: 1, l: "card", a: { t: "" } })), null);
  assert.equal(decodePayload(encodePayload({ v: 1, l: "trail", s: [] })), null);
  assert.equal(decodePayload(encodePayload({ v: 1, l: "poster" })), null);
});

test("sizes and art URLs", () => {
  assert.deepEqual(imageSize("square"), { width: 1080, height: 1080, name: "square" });
  assert.deepEqual(imageSize("anything"), { width: 1080, height: 1920, name: "story" });
  assert.equal(
    coverArtUrl(`g:${MBID}`),
    `https://coverartarchive.org/release-group/${MBID}/front-500`,
  );
  assert.equal(coverArtUrl(`r:${MBID}`, 250), `https://coverartarchive.org/release/${MBID}/front-250`);
  assert.equal(coverArtUrl(""), "");
});

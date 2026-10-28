import { test } from "node:test";
import assert from "node:assert/strict";
import {
  coverArtUrl,
  decodePayload,
  encodePayload,
  IMAGE_SIZE,
  MAX_PAYLOAD_CHARS,
  MAX_MAP_ALBUMS,
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

test("decodes a map, clamping places and clipping names", () => {
  const payload = decodePayload(
    encodePayload({
      v: 1,
      l: "map",
      c: { t: "The New Sound", r: "Geordie Greep", i: `g:${MBID}` },
      n: [
        { t: "Schlagenheim", r: "Black Midi", i: "", x: 512.4, y: -2000, z: 2 },
        { t: "Endlessness", r: "Nala Sinephro", x: "nope", y: 10, z: 7 },
        { t: "", x: 0, y: 0 },
        ...Array(30).fill({ t: "More", r: "A", x: 1, y: 1, z: 1 }),
      ],
      p: [
        { n: "Morgan Simpson", a: 370 },
        { n: "x".repeat(99), a: -90 },
        { n: "", a: 0 },
      ],
    }),
  );
  assert.equal(payload.layout, "map");
  assert.deepEqual(payload.centre, { t: "The New Sound", r: "Geordie Greep", i: `g:${MBID}` });
  assert.deepEqual(payload.albums[0], { t: "Schlagenheim", r: "Black Midi", i: "", x: 0.512, y: -1.5, z: 2, side: 0.36 });
  assert.deepEqual(payload.albums[1], { t: "Endlessness", r: "Nala Sinephro", i: "", x: 0, y: 0.01, z: 1, side: 0.28 });
  assert.ok(payload.albums.length <= MAX_MAP_ALBUMS);
  assert.deepEqual(payload.people[0], { name: "Morgan Simpson", angle: 10 });
  assert.equal(payload.people[1].name.length, 40);
  assert.equal(payload.people[1].angle, 270);
  assert.equal(payload.people.length, 2);
  assert.equal(payload.caption, "");
});

test("decodes sizes and the caption, within bounds", () => {
  const payload = decodePayload(
    encodePayload({
      v: 1,
      l: "map",
      c: { t: "Unmap", r: "Volcano Choir", i: "" },
      n: [
        { t: "A", r: "", x: 0, y: 0, z: 1, s: 240 },
        { t: "B", r: "", x: 0, y: 0, z: 1, s: 9000 },
        { t: "C", r: "", x: 0, y: 0, z: 2, s: "big" },
      ],
      p: [],
      d: `Top 12 by Shared · Liked only${" ".repeat(10)}${"x".repeat(300)}`,
    }),
  );
  assert.deepEqual(
    payload.albums.map((a) => a.side),
    [0.24, 0.5, 0.36],
  );
  assert.ok(payload.caption.startsWith("Top 12 by Shared · Liked only x"));
  assert.equal(payload.caption.length, 160);
});

test("rejects missing, oversized, malformed and empty payloads", () => {
  assert.equal(decodePayload(""), null);
  assert.equal(decodePayload(undefined), null);
  assert.equal(decodePayload("a".repeat(MAX_PAYLOAD_CHARS + 1)), null);
  assert.equal(decodePayload("not base64 json"), null);
  assert.equal(decodePayload(encodePayload({ v: 2, l: "card", a: { t: "x" } })), null);
  assert.equal(decodePayload(encodePayload({ v: 1, l: "card", a: { t: "" } })), null);
  assert.equal(decodePayload(encodePayload({ v: 1, l: "map", c: { t: "x" }, n: [] })), null);
  assert.equal(decodePayload(encodePayload({ v: 1, l: "map", c: { t: "" }, n: [{ t: "y" }] })), null);
  assert.equal(decodePayload(encodePayload({ v: 1, l: "poster" })), null);
});

test("sizes and art URLs", () => {
  assert.deepEqual(IMAGE_SIZE, { width: 1080, height: 1080, name: "square" });
  assert.equal(
    coverArtUrl(`g:${MBID}`),
    `https://coverartarchive.org/release-group/${MBID}/front-500`,
  );
  assert.equal(coverArtUrl(`r:${MBID}`, 250), `https://coverartarchive.org/release/${MBID}/front-250`);
  assert.equal(coverArtUrl(""), "");
});

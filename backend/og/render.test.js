import { test } from "node:test";
import assert from "node:assert/strict";
import { artIds, initials, mapGeometry, mapReach, renderPng, shorten } from "./render.js";

const MAP_SIZES_FOR_TEST = { 1: 0.28, 2: 0.36 };
import { artSettled, fetchArt, loadArt } from "./art.js";
import { imageSize } from "./payload.js";

const MBID = "1b022e01-4da6-387b-8658-8678046e4cef";
// A 1x1 PNG.
const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const card = {
  layout: "card",
  album: { t: "Unmap", r: "Volcano Choir", i: `g:${MBID}` },
  results: [
    { t: "Bon Iver, Bon Iver", r: "Bon Iver", i: "", n: 3 },
    { t: "A very long album title that will certainly need to be cut short", r: "Someone", i: "", n: 1 },
  ],
};
const map = {
  layout: "map",
  centre: { t: "The New Sound", r: "Geordie Greep", i: `g:${MBID}` },
  albums: [
    { t: "Schlagenheim", r: "Black Midi", i: "", x: 0.6, y: 0.3, z: 2 },
    { t: "Endlessness", r: "Nala Sinephro", i: `g:${MBID}`, x: -0.5, y: -0.4, z: 1 },
    { t: "A very long album title that will certainly need to be cut short", r: "Someone", i: "", x: 0.1, y: 0.7, z: 1 },
  ],
  people: [
    { name: "Morgan Simpson", angle: 30 },
    { name: "Seth Evans", angle: 200 },
  ],
};

const isPng = (buffer) => buffer.subarray(1, 4).toString() === "PNG";
const pngSize = (buffer) => [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];

test("renders both layouts at both sizes", async () => {
  const art = new Map([[`g:${MBID}`, PIXEL]]);
  for (const payload of [card, map]) {
    for (const name of ["story", "square"]) {
      const size = imageSize(name);
      const png = await renderPng(payload, size, art);
      assert.ok(isPng(png), `${payload.layout} ${name} is a PNG`);
      assert.deepEqual(pngSize(png), [size.width, size.height]);
    }
  }
});

test("helpers", () => {
  assert.deepEqual(artIds(card), [`g:${MBID}`]);
  assert.deepEqual(artIds(map), [`g:${MBID}`, `g:${MBID}`]);
  assert.equal(initials("The Lonesome Crowded West"), "LC");
  assert.equal(initials("!!!"), "");
});

test("art: data URLs for images, null for anything else, cached", async () => {
  let calls = 0;
  const respond = (type, ok = true) => async () => {
    calls++;
    return {
      ok,
      headers: { get: () => type },
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    };
  };
  const id = `r:${MBID}`;
  assert.equal(await fetchArt(id, respond("image/jpeg")), "data:image/jpeg;base64,AQID");
  assert.equal(await fetchArt(id, respond("image/jpeg")), "data:image/jpeg;base64,AQID");
  assert.equal(calls, 1);
  const other = `g:${MBID.replace("1b", "2b")}`;
  assert.equal(await fetchArt(other, respond("text/html")), null);
  const failing = `g:${MBID.replace("1b", "3b")}`;
  let tries = 0;
  assert.equal(
    await fetchArt(failing, async () => {
      tries++;
      throw new Error("offline");
    }),
    null,
  );
  // Retried once, and not remembered: the next render tries again.
  assert.equal(tries, 2);
  assert.equal(artSettled(failing), false);
  assert.equal(await fetchArt(failing, respond("image/png")), "data:image/png;base64,AQID");
  assert.equal(artSettled(failing), true);
  // No retry once the time is up.
  const late = `g:${MBID.replace("1b", "4b")}`;
  tries = 0;
  await fetchArt(late, async () => {
    tries++;
    throw new Error("offline");
  }, Date.now());
  assert.equal(tries, 0);
  const loaded = await loadArt([id, id, other], fetchArt);
  assert.deepEqual([...loaded.keys()], [id]);
});

test("map reach: past the circle only where covers sit outside it", () => {
  const albums = [
    { x: 0.3, y: 0, z: 1 },
    // Just outside, to the left.
    { x: -1.17, y: 0, z: 1 },
  ];
  assert.equal(mapReach([albums[0]]), 1);
  assert.ok(mapReach(albums) > 1.3);
  assert.ok(mapReach(albums, Math.PI) > 1.3);
  assert.equal(mapReach(albums, 0), 1);
});

test("shorten: whole words where it can, with an ellipsis", () => {
  assert.equal(shorten("Hellfire", 20), "Hellfire");
  assert.equal(shorten("Bright Green Field", 12), "Bright…");
  assert.equal(shorten("Supercalifragilistic", 8), "Superca…");
});

test("map geometry: covers and names inside the box, names apart", () => {
  const payload = {
    albums: [
      { x: 0.5, y: 0.2, z: 2 },
      { x: -1.17, y: 0, z: 1 },
      { x: 0, y: -0.7, z: 1 },
    ],
    // Two people at nearly the same spot.
    people: [
      { name: "Andrew Cheetham", angle: 100 },
      { name: "Freddy Wordsworth", angle: 104 },
      { name: "Morgan Simpson", angle: 180 },
      { name: "Seth Evans", angle: 290 },
    ],
  };
  const box = { width: 1080, height: 800, labelWidth: 112, labelHeight: 36, gap: 10, edge: 10 };
  const { radius, middle, labels } = mapGeometry(payload, box);
  assert.ok(radius > 200);
  for (const album of payload.albums) {
    const half = (MAP_SIZES_FOR_TEST[album.z] * radius) / 2;
    const x = middle.x + album.x * radius;
    const y = middle.y - album.y * radius;
    assert.ok(x - half >= 0 && x + half <= box.width, "cover inside, across");
    assert.ok(y - half >= 0 && y + half <= box.height, "cover inside, down");
  }
  for (const [i, a] of labels.entries()) {
    assert.ok(a.x >= box.edge && a.x + box.labelWidth <= box.width - box.edge + 1e-6);
    assert.ok(a.y >= box.edge && a.y + box.labelHeight <= box.height - box.edge + 1e-6);
    for (const b of labels.slice(i + 1)) {
      const apart =
        Math.abs(a.x - b.x) >= box.labelWidth || Math.abs(a.y - b.y) >= box.labelHeight;
      assert.ok(apart, `${a.name} and ${b.name} apart`);
    }
  }
});

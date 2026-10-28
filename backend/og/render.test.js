import { test } from "node:test";
import assert from "node:assert/strict";
import { artIds, cardSizes, initials, mapGeometry, mapLayout, renderPng, shorten, stackGeometry } from "./render.js";

import { artSettled, fetchArt, loadArt } from "./art.js";
import { IMAGE_SIZE } from "./payload.js";

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

test("renders both layouts, square", async () => {
  const art = new Map([[`g:${MBID}`, PIXEL]]);
  for (const payload of [card, map]) {
    const png = await renderPng(payload, IMAGE_SIZE, art);
    assert.ok(isPng(png), `${payload.layout} is a PNG`);
    assert.deepEqual(pngSize(png), [1080, 1080]);
  }
});

test("cards fit up to ten rows, shrinking past five", async () => {
  assert.deepEqual(
    [3, 5].map((n) => cardSizes(n).row),
    [92, 92],
  );
  for (const n of [6, 8, 10]) {
    const { header, row, gap } = cardSizes(n);
    assert.ok(row >= 48 && row <= 92, `${n} rows: ${row}px`);
    // Header, caption, rows and footer inside the frame's 976px.
    assert.ok(header + 28 + 26 + 28 + n * row + (n - 1) * gap + 32 <= 976);
  }
  const ten = {
    ...card,
    caption: "Top 10 by Shared",
    results: Array.from({ length: 10 }, (_, i) => ({ t: `Album ${i}`, r: "Someone", i: "", n: 10 - i })),
  };
  const png = await renderPng(ten, IMAGE_SIZE, new Map());
  assert.ok(isPng(png));
});

test("names come first: covers move off them", () => {
  // A cover just outside the circle, right where the name at 0° sits.
  const payload = {
    ...map,
    albums: [{ t: "Outer", r: "", i: "", x: 1.15, y: 0, z: 1, side: 0.28, links: [] }],
    people: [{ name: "Right Side", angle: 0 }],
  };
  const options = { width: 900, height: 700, labelWidth: 112, labelHeight: 36, gap: 10 };
  const { labels, covers } = mapLayout(payload, 250, options);
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  // The name stays by its dot; the cover moved out past it.
  assert.ok(Math.abs(labels[0].x - (450 + 250 + 10)) < 1);
  assert.ok(!overlap(labels[0], covers[1]));
  assert.ok(covers[1].x > labels[0].x);
});

test("renders lines and the no-cover view", async () => {
  const art = new Map([[`g:${MBID}`, PIXEL]]);
  const linked = {
    ...map,
    lines: true,
    covers: false,
    albums: map.albums.map((a, i) => ({ ...a, links: [i % 2] })),
  };
  assert.deepEqual(artIds(linked), []);
  assert.ok(isPng(await renderPng(linked, IMAGE_SIZE, art)));
  assert.ok(isPng(await renderPng({ ...card, covers: false }, IMAGE_SIZE, art)));
});

test("stack maps fit their box and render", async () => {
  const stack = {
    layout: "stack",
    centre: { t: "Unmap", r: "Volcano Choir", i: `g:${MBID}`, side: 0.5 },
    albums: [
      { t: "Bon Iver", r: "Bon Iver", i: "", x: 0, y: 1, side: 0.4, member: true, links: [0] },
      { t: "Hideaway", r: "S. Carey", i: "", x: 1.8, y: 1.6, side: 0.4, member: true, links: [1] },
      { t: "Blood Bank", r: "Bon Iver", i: "", x: -0.6, y: 0.4, side: 0.25, member: false, links: [0, 1] },
    ],
    caption: "3 albums stacked · 1 around them",
    covers: true,
    lines: true,
  };
  const box = { width: 1080, height: 800, edge: 24, maxStep: 420 };
  const { boxes, step } = stackGeometry(stack, box);
  assert.ok(step <= 420);
  for (const b of boxes) {
    assert.ok(b.x >= 23 && b.y >= 23, JSON.stringify(b));
    assert.ok(b.x + b.w <= 1080 - 23 && b.y + b.h <= 800 - 23, JSON.stringify(b));
  }
  // y up: the step-1 album is above the centre.
  assert.ok(boxes[1].y < boxes[0].y);
  assert.ok(isPng(await renderPng(stack, IMAGE_SIZE, new Map())));
  // One album alone doesn't blow up to fill the box.
  const lone = { ...stack, albums: stack.albums.slice(0, 1) };
  assert.equal(stackGeometry(lone, box).step, 420);
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


test("shorten: whole words where it can, with an ellipsis", () => {
  assert.equal(shorten("Hellfire", 20), "Hellfire");
  assert.equal(shorten("Bright Green Field", 12), "Bright…");
  assert.equal(shorten("Supercalifragilistic", 8), "Superca…");
});

test("map geometry: the largest circle with covers and names inside, names apart", () => {
  const payload = {
    albums: [
      { x: 0.5, y: 0.2, z: 2 },
      { x: -1.17, y: 0, z: 1 },
      { x: 0, y: -0.7, z: 1 },
      // On the rim right by a person's dot.
      { x: 0.95, y: 0.05, z: 1 },
    ],
    people: [
      // Two people at nearly the same spot.
      { name: "Andrew Cheetham", angle: 100 },
      { name: "Freddy Wordsworth", angle: 104 },
      { name: "Morgan Simpson", angle: 180 },
      { name: "Geordie Greep", angle: 357 },
      { name: "Seth Evans", angle: 290 },
    ],
  };
  const box = { width: 1080, height: 860, labelWidth: 112, labelHeight: 36, gap: 10, edge: 10 };
  const { radius, covers, labels } = mapGeometry(payload, box);
  const inside = (b) =>
    b.x >= box.edge - 1e-6 &&
    b.y >= box.edge - 1e-6 &&
    b.x + b.w <= box.width - box.edge + 1e-6 &&
    b.y + b.h <= box.height - box.edge + 1e-6;
  const clear = (a, b) =>
    a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
  // Nearly as large as the box allows: something is near an edge.
  assert.ok(radius > 280, `radius ${radius}`);
  assert.ok(covers.every(inside));
  for (const [i, label] of labels.entries()) {
    assert.ok(inside(label), `${label.name} inside`);
    assert.ok(covers.every((c) => clear(label, c)), `${label.name} clear of covers`);
    for (const other of labels.slice(i + 1)) {
      assert.ok(clear(label, other), `${label.name} and ${other.name} apart`);
    }
  }
  // A name moves out only as far as the covers make it: Greep's is next to
  // its dot, just past the cover there.
  const greep = labels.find((l) => l.name === "Geordie Greep");
  assert.ok(greep.x - greep.dot.x < 0.35 * radius, `Greep ${greep.x - greep.dot.x}px out`);
});

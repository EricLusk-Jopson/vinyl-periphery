import { test } from "node:test";
import assert from "node:assert/strict";
import { artIds, cardSizes, edgeToEdge, transitGeometry, laneAxis, lanesGeometry, stackElement, fitTileText, initials, mapElement, mapGeometry, mapLayout, MAP_DOT, MAP_DOT_CLEAR, nameLines, renderPng, shorten, stackGeometry } from "./render.js";

import { artSettled, fetchArt, loadArt } from "./art.js";
import { IMAGE_SIZE, parsePayload } from "./payload.js";

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

test("covers never sit on a person's dot", () => {
  // Covers straddling the circle right on the dots at 90° and 200°, one
  // a little inside and one a little outside.
  const payload = {
    ...map,
    albums: [
      { t: "Top", r: "", i: "", x: 0, y: 0.97, z: 1, side: 0.28, links: [] },
      { t: "Left", r: "", i: "", x: Math.cos((200 * Math.PI) / 180) * 1.03, y: Math.sin((200 * Math.PI) / 180) * 1.03, z: 1, side: 0.28, links: [] },
    ],
    people: [
      { name: "Ben Frost", angle: 90 },
      { name: "Tim Hecker", angle: 200 },
    ],
  };
  const options = { width: 900, height: 700, gap: 10 };
  const { labels, covers } = mapLayout(payload, 250, options);
  const clear = (dot, cover) =>
    dot.x + MAP_DOT / 2 + MAP_DOT_CLEAR <= cover.x ||
    cover.x + cover.w <= dot.x - MAP_DOT / 2 - MAP_DOT_CLEAR ||
    dot.y + MAP_DOT / 2 + MAP_DOT_CLEAR <= cover.y ||
    cover.y + cover.h <= dot.y - MAP_DOT / 2 - MAP_DOT_CLEAR;
  for (const label of labels) {
    for (const cover of covers.slice(1)) assert.ok(clear(label.dot, cover), label.name);
  }
});

test("draws the dots over everything else", () => {
  const payload = {
    ...map,
    people: [
      { name: "Ben Frost", angle: 90 },
      { name: "Tim Hecker", angle: 200 },
    ],
  };
  const graph = mapElement(payload, IMAGE_SIZE, new Map()).props.children[0];
  const kids = graph.props.children;
  const isDot = (k) => k?.props?.style?.borderRadius === 999 && k.props.style.width === MAP_DOT;
  // The last children are the two dots, after every cover.
  assert.ok(kids.slice(-2).every(isDot));
  assert.equal(kids.filter(isDot).length, 2);
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

test("names wrap to fit, three lines at most", () => {
  assert.deepEqual(nameLines("Giles Kwakeulati King-Ashong"), ["Giles", "Kwakeulati", "King-Ashong"]);
  assert.deepEqual(nameLines("Morgan Simpson"), ["Morgan Simpson"]);
  assert.deepEqual(nameLines("Deji Ijishakin"), ["Deji Ijishakin"]);
  // A hyphenated name breaks after the hyphen when it must.
  assert.deepEqual(nameLines("Jean-Baptiste-Alexandre"), ["Jean-Baptiste-", "Alexandre"]);
  // Too long for three lines: the last one ends in an ellipsis.
  const long = nameLines("Ana Maria Rosa Teresa Isabel de la Cruz Fernandez");
  assert.equal(long.length, 3);
  assert.ok(long[2].endsWith("…"));
  assert.ok(long.every((l) => l.length <= 15));
});

test("long names keep the whole label inside the image", () => {
  const payload = {
    ...map,
    people: [
      { name: "Giles Kwakeulati King-Ashong", angle: 340 },
      { name: "Morgan Simpson", angle: 90 },
      { name: "Deschanel Gordon", angle: 0 },
    ],
  };
  const box = { width: 1080, height: 760, gap: 10, edge: 32 };
  const { labels } = mapGeometry(payload, box);
  for (const label of labels) {
    assert.ok(label.x >= 32 && label.x + label.w <= 1080 - 32, label.name);
    assert.ok(label.y >= 32 && label.y + label.h <= 760 - 32, label.name);
    assert.ok(label.h >= label.lines.length * 18);
  }
  assert.equal(labels[0].lines.length, 3);
});

test("coverless tiles fit their text: smaller, then without the artist", () => {
  // Fits every line within the tile, at 12px or more.
  for (const [title, artist, side] of [
    ["Schlagenheim", "Black Midi", 70],
    ["Black Country, New Road", "For The First Time", 90],
    ["The 5000 Spirits or the Layers of the Onion", "The Incredible String Band", 80],
    ["Ants From Up There", "BCNR", 150],
  ]) {
    const fit = fitTileText(title, artist, side);
    const inner = side - 2 * fit.pad;
    assert.ok(fit.titleSize >= 12 && fit.artistSize >= 12);
    for (const l of fit.titleLines) assert.ok(l.length * fit.titleSize * 0.56 <= inner, `${l} in ${side}`);
    const height = fit.titleLines.length * fit.titleSize * 1.15 + (fit.artist ? 4 + fit.artistSize * 1.15 : 0);
    assert.ok(height <= inner + 0.5, `${title} in ${side}: ${height} > ${inner}`);
  }
  // Big tiles keep the artist; small ones drop it rather than show a stub.
  assert.equal(fitTileText("Ants From Up There", "BCNR", 150).artist, "BCNR");
  assert.equal(fitTileText("Rabbit Hole", "R. Dawson", 56).artist, null);
  // A word too long for the tile breaks with a hyphen, in even halves.
  assert.deepEqual(fitTileText("Jockstrap", "", 60).titleLines, ["Jocks-", "trap"]);
  assert.deepEqual(fitTileText("Schlagenheim", "Black Midi", 70).titleLines, ["Schlag-", "enheim"]);
});

test("no boilerplate: the graph takes the whole image", async () => {
  const art = new Map();
  assert.ok(isPng(await renderPng({ ...map, bare: true }, IMAGE_SIZE, art)));
  const stack = {
    layout: "stack",
    centre: { t: "Unmap", r: "Volcano Choir", i: "", side: 0.5 },
    albums: [{ t: "Bon Iver", r: "Bon Iver", i: "", x: 0, y: 1, side: 0.4, member: true, links: [0] }],
    caption: "",
    covers: false,
    lines: false,
    bare: true,
  };
  assert.ok(isPng(await renderPng(stack, IMAGE_SIZE, art)));
  // Bigger than with a header: the fit has more room.
  const box = { edge: 32, maxStep: 2000 };
  const full = stackGeometry(stack, { ...box, width: 1080, height: 1064 });
  const framed = stackGeometry(stack, { ...box, width: 1080, height: 760 });
  assert.ok(full.step > framed.step);
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

test("stack lines run edge to edge", () => {
  // Two 100px boxes, 300px apart side by side: the line is the 200px gap.
  const a = { x: 0, y: 0, w: 100, h: 100 };
  const b = { x: 300, y: 0, w: 100, h: 100 };
  assert.deepEqual(edgeToEdge(a, b), { from: { x: 100, y: 50 }, to: { x: 300, y: 50 } });
  // Diagonal: leaves each box at its corner.
  const c = { x: 300, y: 300, w: 100, h: 100 };
  const diagonal = edgeToEdge(a, c);
  assert.ok(Math.abs(diagonal.from.x - 100) < 1e-9 && Math.abs(diagonal.from.y - 100) < 1e-9);
  assert.ok(Math.abs(diagonal.to.x - 300) < 1e-9 && Math.abs(diagonal.to.y - 300) < 1e-9);
  // Touching or overlapping: nothing to draw.
  assert.equal(edgeToEdge(a, { x: 90, y: 0, w: 100, h: 100 }).from, null);
  assert.equal(edgeToEdge(a, a).from, null);
});

test("stack maps render lines by weight", async () => {
  const stack = parsePayload({
    v: 1,
    l: "stack",
    c: { t: "Start", s: 500 },
    n: [
      { t: "Next", x: 0, y: -1000, s: 400, m: 1, e: [0] },
      { t: "Result", x: 900, y: -500, s: 260, e: [0, 1], w: [3, 1] },
    ],
    ln: 1,
  });
  assert.deepEqual(stack.albums[0].weights, [0]);
  assert.deepEqual(stack.albums[1].weights, [3, 1]);
  assert.ok(isPng(await renderPng(stack, IMAGE_SIZE, new Map())));
});

test("fetches Discogs art from i.discogs.com only, without redirects", async () => {
  const seen = [];
  const fake = async (url, options) => {
    seen.push([url, options.redirect]);
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } });
  };
  const url = await fetchArt("d:abc/def.jpeg", fake);
  assert.match(url, /^data:image\/jpeg;base64,/);
  assert.deepEqual(seen, [["https://i.discogs.com/abc/def.jpeg", "error"]]);
});

test("stack maps draw no lines between the stack's own albums", () => {
  const stack = parsePayload({
    v: 1,
    l: "stack",
    c: { t: "Start", s: 500 },
    n: [
      // An older payload: a stack album with a link of its own.
      { t: "Next", x: 0, y: -1000, s: 400, m: 1, e: [0] },
      { t: "Result", x: 900, y: -500, s: 260, e: [0, 1], w: [3, 1] },
    ],
    ln: 1,
  });
  const lines = [];
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "line") lines.push(node.props);
    const kids = node.props?.children;
    (Array.isArray(kids) ? kids : [kids]).forEach(walk);
  };
  walk(stackElement(stack, IMAGE_SIZE, new Map()));
  // The result's two lines only, muted, by weight.
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map((l) => l.strokeWidth).sort(), [1.5, 3.5]);
  assert.ok(lines.every((l) => l.stroke !== "#E0312A"));
});

test("swimlanes parse, fit their box and render", async () => {
  const lanes = parsePayload({
    v: 1,
    l: "lanes",
    c: { t: "Virgins", r: "Tim Hecker" },
    y: [1995, 2020],
    k: [{ t: "Virgins", y: 2013, m: 1 }, { t: "bad", y: 0 }],
    n: [
      { n: "Ben Frost", c: 12, s: [[2009, 2], [2013, 1]], f: [[2001, 3], [0, 1]], p: 1 },
      { n: "Valgeir Sigurðsson", c: 3, s: [[2010, 1]], f: [] },
      { n: "Nobody", c: 0, s: [], f: [] },
    ],
    u: 4,
    d: "Top 2 of 9 people by results",
  });
  assert.equal(lanes.layout, "lanes");
  assert.deepEqual([lanes.from, lanes.to], [1995, 2020]);
  // Empty lanes and undated years dropped; the bad album mark too.
  assert.equal(lanes.lanes.length, 2);
  assert.deepEqual(lanes.lanes[0].faint, [[2001, 3]]);
  assert.equal(lanes.lanes[0].partial, true);
  assert.deepEqual(lanes.albums, [{ t: "Virgins", year: 2013 }]);
  assert.deepEqual(artIds(lanes), []);
  const { top, ...box } = { top: 224, width: 1080, height: 788 };
  const g = lanesGeometry(lanes, box);
  assert.equal(g.x(1995), g.left);
  assert.equal(g.x(2020), g.right);
  assert.ok(g.axisTop + 80 <= box.height);
  assert.deepEqual(laneAxis(1995, 2020), [2000, 2010, 2020]);
  assert.ok(isPng(await renderPng(lanes, IMAGE_SIZE, new Map())));
  assert.equal(top, 224);
});

test("swimlanes label every album line alike, a row down when they'd touch", () => {
  const stack = parsePayload({
    v: 1,
    l: "lanes",
    c: { t: "Virgins", r: "Tim Hecker" },
    y: [1990, 2020],
    k: [{ t: "Virgins", y: 2013 }, { t: "Love Streams", y: 2016 }, { t: "Harmony in Ultraviolet", y: 1995 }],
    n: [{ n: "Ben Frost", c: 2, s: [[2013, 1]], f: [] }],
  });
  const g = lanesGeometry(stack, { width: 1080, height: 788 });
  assert.equal(g.labels.length, 3);
  // Right of each line; 2016's would run off the edge, so it's left of
  // its line, where it meets 2013's: a row down.
  assert.deepEqual(g.labels.map((l) => l.row), [0, 1, 0]);
  assert.ok(g.labels[0].x > g.x(2013));
  assert.ok(g.labels[1].x + g.labels[1].w < g.x(2016));
  assert.equal(g.top, 2 * 22 + 12);
  // No two labels in a row overlap.
  for (const a of g.labels) {
    for (const b of g.labels) {
      if (a === b || a.row !== b.row) continue;
      assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x);
    }
  }
});

test("transit maps parse, fit and render", async () => {
  const transit = parsePayload({
    v: 1,
    l: "transit",
    c: { t: "Virgins", r: "Tim Hecker" },
    w: 700,
    h: 200,
    s: [
      { t: "Virgins", r: "Tim Hecker", x: 20, y: 100, q: 12, k: [0, 1], b: [0, 118, 120, 35], a: "start", m: 1 },
      { t: "Aurora", r: "Ben Frost", x: 680, y: 100, q: 12, k: [0, 1], b: [580, 118, 120, 35], a: "end" },
      { t: "", x: 0, y: 0 },
    ],
    n: [
      { n: "Ben Frost", c: 0, g: [[[20, 96], [680, 96]]] },
      { n: "Valgeir Sigurðsson", c: 9, g: [[[20, 104], [100, 160], [600, 160], [680, 104]], [[1, 2]]] },
    ],
    o: 3,
  });
  assert.equal(transit.layout, "transit");
  assert.equal(transit.stations.length, 2);
  assert.deepEqual(transit.stations.map((s) => s.marked), [true, false]);
  // Colour clamped to the six there are; one-point legs dropped.
  assert.equal(transit.lines[1].colour, 5);
  assert.equal(transit.lines[1].legs.length, 1);
  assert.deepEqual(artIds(transit), []);
  const g = transitGeometry(transit, { width: 1080, height: 788 });
  assert.ok(g.scale > 1 && g.scale <= 1.6);
  assert.ok(g.top + transit.height * g.scale <= g.legendTop);
  assert.ok(isPng(await renderPng(transit, IMAGE_SIZE, new Map())));
  assert.equal(parsePayload({ v: 1, l: "transit", c: { t: "x" }, w: 0, h: 10, s: [{ t: "a" }] }), null);
});

test("numbered transit maps list their stations beside the map", async () => {
  const station = (t, n, x, extra = {}) => ({ t, r: `Artist · ${2000 + n}`, x, y: 100, q: 13, k: [0], b: [x - 13, 87, 26, 26], a: "middle", n, ...extra });
  const raw = {
    v: 1,
    l: "transit",
    c: { t: "Virgins", r: "Tim Hecker" },
    w: 400,
    h: 200,
    s: [station("Virgins", 2, 300, { m: 1 }), station("Aurora", 1, 20)],
    n: [{ n: "Ben Frost", c: 0, g: [[[20, 100], [300, 100]]] }],
    sl: 1,
  };
  const map = parsePayload(raw);
  assert.equal(map.legend, true);
  assert.deepEqual(map.stations.map((s) => s.number), [2, 1]);
  const g = transitGeometry(map, { width: 1080, height: 788 });
  // The map keeps clear of the list's column.
  assert.ok(g.left + map.width * g.scale <= g.list.left);
  assert.equal(g.list.twoLine, true);
  assert.ok(isPng(await renderPng(map, IMAGE_SIZE, new Map())));
  // A station without a number: labels, not a legend.
  const unnumbered = parsePayload({ ...raw, s: [station("Virgins", 0, 300), station("Aurora", 1, 20)] });
  assert.equal(unnumbered.legend, false);
});

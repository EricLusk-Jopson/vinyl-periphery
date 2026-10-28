import { test } from "node:test";
import assert from "node:assert/strict";
import { artIds, fitSteps, initials, renderPng } from "./render.js";
import { fetchArt, loadArt } from "./art.js";
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
const trail = {
  layout: "trail",
  steps: [
    { t: "Unmap", r: "Volcano Choir", i: `g:${MBID}`, via: [] },
    { t: "Bon Iver", r: "Bon Iver", i: "", via: ["Justin Vernon", "Brian Joseph"] },
    { t: "Hideaway", r: "S. Carey", i: "", via: ["Sean Carey"] },
  ],
};

const isPng = (buffer) => buffer.subarray(1, 4).toString() === "PNG";
const pngSize = (buffer) => [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];

test("renders both layouts at both sizes", async () => {
  const art = new Map([[`g:${MBID}`, PIXEL]]);
  for (const payload of [card, trail]) {
    for (const name of ["story", "square"]) {
      const size = imageSize(name);
      const png = await renderPng(payload, size, art);
      assert.ok(isPng(png), `${payload.layout} ${name} is a PNG`);
      assert.deepEqual(pngSize(png), [size.width, size.height]);
    }
  }
});

test("fits long trails: root, a gap, the latest steps", () => {
  const steps = ["A", "B", "C", "D", "E", "F"].map((t) => ({ t, via: [] }));
  assert.deepEqual(
    fitSteps(steps, 3).map((s) => [s.t, s.gapBefore]),
    [["A", false], ["E", true], ["F", false]],
  );
  assert.equal(fitSteps(steps.slice(0, 3), 3).length, 3);
});

test("helpers", () => {
  assert.deepEqual(artIds(card), [`g:${MBID}`]);
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
  assert.equal(
    await fetchArt(failing, async () => {
      throw new Error("offline");
    }),
    null,
  );
  const loaded = await loadArt([id, id, other], fetchArt);
  assert.deepEqual([...loaded.keys()], [id]);
});

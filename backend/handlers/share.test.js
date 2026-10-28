import { test } from "node:test";
import assert from "node:assert/strict";
import share, { safeTarget, shareTitle } from "./share.js";
import { mockRequest, mockResponse } from "./testing.js";
import { encodePayload } from "../og/payload.js";

const trail = encodePayload({
  v: 1,
  l: "trail",
  s: [
    { t: "Unmap", r: "Volcano Choir", i: "", v: [] },
    { t: 'Bon "Iver" <b>', r: "Bon Iver", i: "", v: ["Justin Vernon"] },
  ],
});

test("only redirects to the app's own results and stacks", () => {
  assert.equal(safeTarget("/results?artist=a&album=b&master=1"), "/results?artist=a&album=b&master=1");
  assert.equal(safeTarget("/library/stack/A-B-1"), "/library/stack/A-B-1");
  assert.equal(safeTarget("https://evil.example"), "/");
  assert.equal(safeTarget("//evil.example/results?x"), "/");
  assert.equal(safeTarget("/results?x y"), "/");
  assert.equal(safeTarget(undefined), "/");
});

test("serves Open Graph tags and sends people on", () => {
  const res = mockResponse();
  share(
    mockRequest({
      query: { p: trail, to: "/results?artist=Bon+Iver&album=Bon+Iver&master=100" },
      headers: { host: "vinylperiphery.com", "x-forwarded-proto": "https" },
    }),
    res,
  );
  const html = String(res.body);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-type"], /text\/html/);
  assert.match(html, /<meta property="og:image" content="https:\/\/vinylperiphery\.com\/api\/og\?p=/);
  assert.match(html, /size=square/);
  assert.match(html, /url=\/results\?artist=Bon\+Iver&amp;album=Bon\+Iver&amp;master=100/);
  // Titles are escaped.
  assert.match(html, /Bon &quot;Iver&quot; &lt;b&gt;/);
  assert.doesNotMatch(html, /<b>/);
});

test("still redirects home without a usable payload", () => {
  const res = mockResponse();
  share(mockRequest({ query: { p: "bad", to: "https://evil.example" } }), res);
  const html = String(res.body);
  assert.match(html, /url=\//);
  assert.doesNotMatch(html, /og:image/);
});

test("titles", () => {
  assert.equal(
    shareTitle({ layout: "card", album: { t: "Unmap", r: "Volcano Choir" } }),
    "Albums connected to Unmap by Volcano Choir",
  );
  assert.equal(
    shareTitle({ layout: "trail", steps: [{ t: "A" }, { t: "B" }, { t: "C" }] }),
    "From A to C",
  );
});

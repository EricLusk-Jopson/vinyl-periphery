// Runs apps-script.js against stand-ins for the Apps Script services.
// Runs with the backend tests (npm test at the repo root).
import { readFileSync } from "node:fs";
import vm from "node:vm";
import strict from "node:assert/strict";
// Values from the vm context have other prototypes, so compare as plain JSON.
const assert = { equal: strict.equal, deepEqual: (a, b) => strict.deepEqual(JSON.parse(JSON.stringify(a)), b) };

const source = readFileSync(new URL("./apps-script.js", import.meta.url), "utf8");

function makeContext(props, existingSheets) {
  const sheets = new Map(existingSheets.map((n) => [n, { name: n, rows: [], frozen: 0 }]));
  const ctx = {
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (n) => (sheets.has(n) ? api(sheets.get(n)) : null),
        insertSheet: (n) => { const s = { name: n, rows: [], frozen: 0 }; sheets.set(n, s); return api(s); },
      }),
    },
    ContentService: {
      MimeType: { TEXT: "text" },
      createTextOutput: (t) => ({ text: t, setMimeType() { return this; } }),
    },
  };
  const api = (s) => ({ appendRow: (r) => s.rows.push(r), setFrozenRows: (n) => (s.frozen = n) });
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  const post = (body) => ctx.doPost({ postData: { contents: JSON.stringify(body) } }).text;
  return { post, sheets };
}

const props = { EVC_TOKEN: "evc-secret", VP_TOKEN: "vp-secret" };
const { post, sheets } = makeContext(props, ["Events"]);

// EVC token goes to Events, with the session id it already sends.
assert.equal(post({ token: "evc-secret", event: "trip_added", properties: { n: 1 }, url: "/app", sessionId: "s1" }), "OK");
assert.deepEqual(sheets.get("Events").rows.at(-1).slice(1), ["trip_added", '{"n":1}', "/app", "", "", "", "s1"]);

// VP token goes to VP Events, created with headers on first use.
assert.equal(post({ token: "vp-secret", event: "page_view", properties: { page: "home" }, url: "/", screenWidth: 390, sessionId: "abc" }), "OK");
const vp = sheets.get("VP Events");
assert.equal(vp.rows[0][0], "timestamp");
assert.equal(vp.rows[0].length, 8);
assert.equal(vp.frozen, 1);
assert.deepEqual(vp.rows[1].slice(1), ["page_view", '{"page":"home"}', "/", "", "", 390, "abc"]);

// Tokens can't cross over, and missing or wrong tokens are rejected.
assert.equal(post({ event: "trip_added" }), "Error: unauthorized");
assert.equal(post({ token: "nope", event: "x" }), "Error: unauthorized");
assert.equal(post({ token: "", event: "x" }), "Error: unauthorized");
assert.equal(sheets.get("Events").rows.length, 1);
assert.equal(vp.rows.length, 2);

// An unset property never matches an empty or missing token.
const empty = makeContext({}, ["Events"]);
assert.equal(empty.post({ token: "", event: "x" }), "Error: unauthorized");
assert.equal(empty.post({ event: "x" }), "Error: unauthorized");


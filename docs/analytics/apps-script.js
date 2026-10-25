/**
 * Event log for EuroVisaCalculator and Vinyl Periphery (Google Apps Script,
 * bound to the analytics spreadsheet).
 *
 * Each app sends its own token, and the token decides the sheet:
 *
 *   EVC_TOKEN -> "Events"     EuroVisaCalculator, from the browser
 *   VP_TOKEN  -> "VP Events"  Vinyl Periphery, from its /api/event function
 *
 * Requests with a missing or unknown token are rejected.
 *
 * Setup: Project Settings > Script Properties > add EVC_TOKEN and VP_TOKEN,
 * each a different long random value. Then deploy a NEW VERSION of the
 * existing web app deployment so the /exec URL stays the same. Deploy this
 * only after EuroVisaCalculator is sending its token, or its events are
 * rejected in the meantime.
 */

const COLUMNS = [
  "timestamp",
  "event",
  "properties",
  "url",
  "referrer",
  "userAgent",
  "screenWidth",
  "sessionId",
];

const APPS = [
  { tokenProperty: "EVC_TOKEN", sheet: "Events" },
  { tokenProperty: "VP_TOKEN", sheet: "VP Events" },
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const data = JSON.parse(e.postData.contents);

    const app = appForToken(data.token);
    if (!app) return text("Error: unauthorized");

    const row = [
      data.timestamp || new Date().toISOString(),
      data.event || "",
      JSON.stringify(data.properties || {}),
      data.url || "",
      data.referrer || "",
      data.userAgent || "",
      data.screenWidth || "",
      data.sessionId || "",
    ];

    // Concurrent appendRow calls can land on the same row without a lock.
    lock.waitLock(10000);
    sheetFor(app).appendRow(row);

    return text("OK");
  } catch (err) {
    return text("Error: " + err.message);
  } finally {
    lock.releaseLock();
  }
}

/** The app whose token matches, or null. */
function appForToken(token) {
  if (typeof token !== "string" || token === "") return null;
  const properties = PropertiesService.getScriptProperties();
  return (
    APPS.find((app) => {
      const expected = properties.getProperty(app.tokenProperty);
      return expected && token === expected;
    }) || null
  );
}

/** The app's sheet, created with a header row if it doesn't exist yet. */
function sheetFor(app) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(app.sheet);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(app.sheet);
    sheet.appendRow(COLUMNS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function text(message) {
  return ContentService.createTextOutput(message).setMimeType(
    ContentService.MimeType.TEXT,
  );
}

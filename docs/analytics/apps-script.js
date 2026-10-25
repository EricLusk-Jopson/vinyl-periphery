/**
 * Event log for EuroVisaCalculator and Vinyl Periphery (Google Apps Script,
 * bound to the analytics spreadsheet).
 *
 * EuroVisaCalculator posts without an "app" field and keeps writing to the
 * "Events" sheet exactly as before.
 *
 * Vinyl Periphery posts from its server (/api/event) with
 * app: "vinyl-periphery" and a shared token, and writes to "VP Events",
 * which is created with a header row the first time.
 *
 * Setup: Project Settings > Script Properties > add VP_TOKEN with the same
 * value as ANALYTICS_TOKEN in Vercel. After saving, deploy a NEW VERSION of
 * the existing web app deployment so the /exec URL stays the same.
 */

const APPS = {
  "vinyl-periphery": {
    sheet: "VP Events",
    tokenProperty: "VP_TOKEN",
    headers: [
      "timestamp",
      "event",
      "properties",
      "url",
      "referrer",
      "userAgent",
      "screenWidth",
      "sessionId",
    ],
  },
};

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const data = JSON.parse(e.postData.contents);

    const app = data.app ? APPS[data.app] : null;
    if (data.app && !app) return text("Error: unknown app");
    if (app) {
      const expected = PropertiesService.getScriptProperties().getProperty(
        app.tokenProperty,
      );
      if (!expected || data.token !== expected) return text("Error: unauthorized");
    }

    const row = [
      data.timestamp || new Date().toISOString(),
      data.event || "",
      JSON.stringify(data.properties || {}),
      data.url || "",
      data.referrer || "",
      data.userAgent || "",
      data.screenWidth || "",
    ];
    if (app) row.push(data.sessionId || "");

    // Concurrent appendRow calls can land on the same row without a lock.
    lock.waitLock(10000);
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = app
      ? sheetFor(spreadsheet, app)
      : spreadsheet.getSheetByName("Events");
    sheet.appendRow(row);

    return text("OK");
  } catch (err) {
    return text("Error: " + err.message);
  } finally {
    lock.releaseLock();
  }
}

function sheetFor(spreadsheet, app) {
  let sheet = spreadsheet.getSheetByName(app.sheet);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(app.sheet);
    sheet.appendRow(app.headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function text(message) {
  return ContentService.createTextOutput(message).setMimeType(
    ContentService.MimeType.TEXT,
  );
}

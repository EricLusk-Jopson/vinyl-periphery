# Analytics

Anonymous usage events go to a tab in the same Google Sheet that
EuroVisaCalculator uses.

```
browser  track()  ──sendBeacon──▶  /api/event  ──POST + token──▶  Apps Script  ──▶  "VP Events" sheet
```

- The browser sends events to our own `/api/event`, so ad blockers that block
  analytics hosts don't drop them, and the Apps Script URL and token stay on
  the server.
- `/api/event` checks the event against an allowlist, cleans the fields, adds
  the timestamp and user agent, and forwards it. It answers 204 even if the
  sheet is down. Analytics never affects the app.
- No cookies or storage. The session id is random, kept in memory, and
  changes on every page load. No IP addresses are stored. Nothing is sent if
  the browser signals Global Privacy Control or Do Not Track.

## Setup

1. **Update the Apps Script.** Open the spreadsheet, then **Extensions → Apps
   Script**, and replace `doPost` with
   [`analytics/apps-script.js`](analytics/apps-script.js). Requests without an
   `app` field (EuroVisaCalculator) behave exactly as before.
2. **Add the token.** In the script editor, **Project Settings → Script
   Properties → Add script property**: `VP_TOKEN` with a long random value
   (for example from `openssl rand -hex 24`).
3. **Deploy a new version, same URL.** **Deploy → Manage deployments**, edit
   the existing web app deployment, set **Version** to **New version**, and
   deploy. Creating a *new deployment* instead would change the URL and break
   EuroVisaCalculator.
4. **Set the env vars in Vercel**, for **Production only** so previews and
   local dev stay out of the sheet:

   | Name | Value |
   |---|---|
   | `ANALYTICS_URL` | The web app's `/exec` URL (the one EuroVisaCalculator uses) |
   | `ANALYTICS_TOKEN` | The same value as `VP_TOKEN` |

   Redeploy production after adding them. While the site is still on Heroku,
   set the same two config vars there to start collecting now.

The "VP Events" tab is created with a header row on the first event.

To test locally, put both variables in `.env` and run `npm run server`. Every
action in the app then appends a row.

## Columns

| Column | Content |
|---|---|
| timestamp | Server time, ISO 8601 UTC |
| event | One of the events below |
| properties | JSON object with the event's details |
| url | Path the event happened on, e.g. `/library` |
| referrer | Where the visitor came from, origin and path only |
| userAgent | Browser user agent |
| screenWidth | Window width in CSS pixels |
| sessionId | Random per page load; groups one visit's events |

## Events

| Event | When | Properties |
|---|---|---|
| `page_view` | Every route change, including the first load | `page`: home, library, results |
| `search_started` | A search begins | `artist`, `album`, `source`: form or result |
| `search_completed` | Results are stored | `artist`, `album`, `seconds`, `releases_read`, `contributors`, `albums` |
| `search_not_found` | Discogs has no match | `artist`, `album`, `seconds` |
| `search_failed` | An error stops the search | `artist`, `album`, `phase`, `seconds`, `error` |
| `search_cancelled` | The user cancels, or leaves mid-search | `artist`, `album`, `phase`, `seconds` |
| `example_filled` | An example search fills the form | `artist`, `album` |
| `result_opened` | A result row is expanded | `rank`, `shared`, `sort` |
| `discogs_opened` | "View on Discogs" is followed | `rank`, `shared`, `sort` |
| `filter_changed` | Any filter, switch, select-all or reset | `filter`, `on` |
| `search_saved` | A search is saved or unsaved | `saved`, `from`: results or library |

## Adding an event

Add the name to `AnalyticsEvent` in `frontend/src/lib/analytics.ts` **and**
`EVENTS` in `backend/handlers/event.js` (the server drops names it doesn't
know), call `track()` where it happens, and add a row to the table above.
Property values must be strings, numbers or booleans; keys are lowercase
snake_case.

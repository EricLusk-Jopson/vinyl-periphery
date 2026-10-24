/**
 * Audits the home page's example searches (src/lib/topAlbums.ts) against
 * Discogs, and reports the albums whose search fails.
 *
 * To run:
 *   1. Start the backend (`npm run server` from the repo root, with
 *      CONSUMER_KEY and CONSUMER_SECRET in .env) and the frontend
 *      (`npm run dev` in frontend/).
 *   2. Open http://localhost:5173, then DevTools > Console.
 *   3. Paste this whole file and press Enter.
 *
 * A search fails the same way the app's first step does: /api/search
 * returns an error, or Discogs returns no results. It makes one request per
 * album, about a second apart (the backend's key allows 60 a minute), so the
 * full list takes around 12 minutes. Progress is logged every 25 albums.
 *
 * At the end the report is logged, copied to the clipboard and downloaded as
 * example-audit.json. If it stops part way (say the backend went down),
 * paste it again in the same tab, without reloading, to carry on. Run
 * `delete window.__exampleAudit` first to start over.
 */
(async () => {
  const DELAY_MS = 1100;
  const RATE_LIMIT_PAUSE_MS = 60_000;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Vite serves the source modules in development.
  const { TOP_ALBUMS } = await import("/src/lib/topAlbums.ts");
  const state = (window.__exampleAudit ??= { next: 0, failures: [] });
  if (state.next > 0) {
    console.log(`Resuming at ${state.next + 1} of ${TOP_ALBUMS.length}.`);
  }

  const search = ({ artist, album }) =>
    fetch(
      `/api/search?band=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}`,
    );

  for (let i = state.next; i < TOP_ALBUMS.length; i++) {
    const { artist, album } = TOP_ALBUMS[i];
    let response;
    try {
      response = await search(TOP_ALBUMS[i]);
      for (let retry = 0; response.status === 429 && retry < 3; retry++) {
        console.log("Rate limited; waiting a minute.");
        await sleep(RATE_LIMIT_PAUSE_MS);
        response = await search(TOP_ALBUMS[i]);
      }
    } catch (error) {
      console.error(
        `Stopped at ${i + 1} (${artist} - ${album}): couldn't reach /api/search. Is the backend running? Paste the script again to resume.`,
        error,
      );
      return;
    }

    let reason = null;
    if (!response.ok) {
      reason = `HTTP ${response.status}`;
    } else {
      const data = await response.json();
      if (!data.results || data.results.length === 0) reason = "No results";
    }
    if (reason) state.failures.push({ index: i, artist, album, reason });
    state.next = i + 1;

    if (state.next % 25 === 0) {
      console.log(
        `${state.next} of ${TOP_ALBUMS.length} checked, ${state.failures.length} failed.`,
      );
    }

    const remaining = Number(response.headers.get("X-Ratelimit-Remaining"));
    await sleep(
      response.headers.has("X-Ratelimit-Remaining") && remaining <= 2
        ? RATE_LIMIT_PAUSE_MS
        : DELAY_MS,
    );
  }

  const report = {
    checkedAt: new Date().toISOString(),
    total: TOP_ALBUMS.length,
    failed: state.failures.length,
    failures: state.failures,
  };
  const json = JSON.stringify(report, null, 2);
  delete window.__exampleAudit;

  console.log(json);
  try {
    // DevTools' console helper.
    copy(json);
    console.log("Copied to the clipboard.");
  } catch {
    // Not run from the console.
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  link.download = "example-audit.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
})();

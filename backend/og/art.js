// Cover Art Archive images for the share renderer, as data URLs. Cover art
// is the only thing rendering fetches; anything slow or missing falls back
// to a placeholder rather than failing the image.

import { coverArtUrl } from "./payload.js";

/** One try. The archive redirects to archive.org, which is often slow. */
export const ART_TIMEOUT_MS = 4500;
/** All covers for one image, tries and retries, within this. */
export const ART_BUDGET_MS = 8000;
const CACHE_LIMIT = 300;
const cache = new Map();

const remember = (artId, value) => {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(artId, value);
};

/**
 * One cover as a data URL, or null. Definite answers (an image, or no
 * image) are cached per function instance; timeouts and errors aren't, so
 * the next render tries again. One retry while `deadline` allows.
 */
export async function fetchArt(artId, fetchImpl = fetch, deadline = Date.now() + ART_BUDGET_MS) {
  if (cache.has(artId)) return cache.get(artId);
  for (let attempt = 0; attempt < 2; attempt++) {
    const left = deadline - Date.now();
    if (left < 500) break;
    try {
      const response = await fetchImpl(coverArtUrl(artId, 500), {
        redirect: "follow",
        signal: AbortSignal.timeout(Math.min(ART_TIMEOUT_MS, left)),
      });
      const type = response.headers.get("content-type") ?? "";
      if (response.ok && /^image\/(jpeg|png)/.test(type)) {
        const bytes = Buffer.from(await response.arrayBuffer());
        const url = `data:${type.split(";")[0]};base64,${bytes.toString("base64")}`;
        remember(artId, url);
        return url;
      }
      // The archive has no such image: a definite no.
      if (response.status === 404 || (response.ok && !/^image\//.test(type))) {
        remember(artId, null);
        return null;
      }
    } catch {
      // Timed out or failed: try again if there's time, don't remember it.
    }
  }
  return null;
}

/** Whether this instance has a definite answer for an art id. */
export const artSettled = (artId) => cache.has(artId);

/** Art id -> data URL for every id that loaded, fetched in parallel. */
export async function loadArt(ids, fetchOne = fetchArt) {
  const unique = [...new Set(ids)];
  const deadline = Date.now() + ART_BUDGET_MS;
  const loaded = await Promise.all(unique.map((id) => fetchOne(id, fetch, deadline)));
  return new Map(unique.map((id, i) => [id, loaded[i]]).filter(([, url]) => url));
}

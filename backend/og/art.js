// Cover Art Archive images for the share renderer, as data URLs. Cover art
// is the only thing rendering fetches; anything slow or missing falls back
// to the initials placeholder rather than failing the image.

import { coverArtUrl } from "./payload.js";

export const ART_TIMEOUT_MS = 3000;
const CACHE_LIMIT = 200;
const cache = new Map();

/** One cover as a data URL, or null. Cached per function instance. */
export async function fetchArt(artId, fetchImpl = fetch) {
  if (cache.has(artId)) return cache.get(artId);
  let result = null;
  try {
    const response = await fetchImpl(coverArtUrl(artId, 500), {
      redirect: "follow",
      signal: AbortSignal.timeout(ART_TIMEOUT_MS),
    });
    const type = response.headers.get("content-type") ?? "";
    if (response.ok && /^image\/(jpeg|png)/.test(type)) {
      const bytes = Buffer.from(await response.arrayBuffer());
      result = `data:${type.split(";")[0]};base64,${bytes.toString("base64")}`;
    }
  } catch {
    result = null;
  }
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(artId, result);
  return result;
}

/** Art id -> data URL for every id that loaded, fetched in parallel. */
export async function loadArt(ids, fetchOne = fetchArt) {
  const unique = [...new Set(ids)];
  const loaded = await Promise.all(unique.map((id) => fetchOne(id)));
  return new Map(unique.map((id, i) => [id, loaded[i]]).filter(([, url]) => url));
}

import { sleep, throwIfAborted } from "./abort";
import { MAX_RELEASES, REQUEST_DELAY_MS } from "./limits";
import { MutationCallbacks, ReleaseToRead, SearchTarget } from "./types";

/**
 * Turning a known album (a result row's master or release) into the
 * releases whose credits a search reads, without the text search. Calls go
 * from the browser, unauthenticated, REQUEST_DELAY_MS apart.
 */

interface MasterResponse {
  main_release?: number;
}

interface VersionsResponse {
  versions?: Array<{ id?: number }>;
}

const getJson = async <T>(path: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(`https://api.discogs.com${path}`, { signal });
  if (!response.ok) {
    throw new Error(`Discogs ${path} failed: ${response.status}`);
  }
  return (await response.json()) as T;
};

/**
 * The releases to read for a master: its main release first, then other
 * versions up to `limit`, oldest first. Pure, for tests.
 */
export const masterReleases = (
  mainRelease: number | undefined,
  versions: Array<{ id?: number }>,
  limit = MAX_RELEASES,
): ReleaseToRead[] => {
  const ids = [
    ...(mainRelease ? [mainRelease] : []),
    ...versions.map((v) => Number(v.id)).filter((id) => id > 0),
  ];
  return Array.from(new Set(ids))
    .slice(0, limit)
    .map((id) => ({ id }));
};

/**
 * The releases to read for a target. A release is read as is, with no extra
 * call. A master costs two calls: the master (for its main release) and its
 * versions list; if the versions call fails, the main release alone is read.
 */
export async function targetReleases(
  target: SearchTarget,
  callbacks?: MutationCallbacks,
  signal?: AbortSignal,
): Promise<ReleaseToRead[]> {
  if (target.type === "release") return [{ id: target.id }];

  const progress = (current: number) =>
    callbacks?.onProgress?.({
      id: "initial",
      label: "Finding the album",
      current,
      total: 2,
    });
  progress(0);
  const master = await getJson<MasterResponse>(`/masters/${target.id}`, signal);
  progress(1);
  await sleep(REQUEST_DELAY_MS, signal);

  let versions: VersionsResponse["versions"] = [];
  try {
    const data = await getJson<VersionsResponse>(
      `/masters/${target.id}/versions?per_page=${MAX_RELEASES}&sort=released&sort_order=asc`,
      signal,
    );
    versions = data.versions ?? [];
    await sleep(REQUEST_DELAY_MS, signal);
  } catch (error) {
    throwIfAborted(signal);
    console.error(`Versions of master ${target.id} unavailable:`, error);
  }
  progress(2);

  const releases = masterReleases(master.main_release, versions);
  if (releases.length === 0) {
    throw new Error(`Master ${target.id} has no releases`);
  }
  return releases;
}

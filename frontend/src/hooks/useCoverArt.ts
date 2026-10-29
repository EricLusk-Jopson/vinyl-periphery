import { useEffect, useState } from "react";
import { coverResolver, CoverState } from "@/api/coverArt";
import { track } from "@/lib/analytics";

/** Searches whose cover coverage has been reported this page load. */
const reported = new Set<string>();

/**
 * Cover art for result keys, as it resolves. Pass the keys most wanted
 * first (rows on screen, then the rest); later calls jump the queue. Never
 * blocks rendering: unknown keys read as undefined until they arrive.
 *
 * With `reportAs` (a search id), reports `cover_lookup` once all the keys
 * are settled, so coverage can be measured per search.
 */
export function useCoverArt(
  keys: string[],
  reportAs?: string,
): (key: string) => CoverState {
  const [, setVersion] = useState(0);
  const wanted = keys.join("|");

  useEffect(() => coverResolver.subscribe(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    if (wanted) coverResolver.request(wanted.split("|"));
  }, [wanted]);

  const settled =
    wanted !== "" &&
    coverResolver.idle() &&
    keys.every((key) => coverResolver.get(key) !== undefined);

  useEffect(() => {
    if (!settled || !reportAs || reported.has(reportAs)) return;
    reported.add(reportAs);
    const hits = keys.filter((key) => coverResolver.get(key)).length;
    track("cover_lookup", {
      albums: keys.length,
      hits,
      misses: keys.length - hits,
    });
    // keys is described by `wanted`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, reportAs, wanted]);

  return (key) => coverResolver.get(key);
}

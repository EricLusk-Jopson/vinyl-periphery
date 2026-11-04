import { useEffect, useRef, useState } from "react";
import { coverResolver } from "@/api/coverArt";
import { runArtQueue } from "@/api/discogsArt";
import { track } from "@/lib/analytics";
import { useCoverArt } from "./useCoverArt";

export type FindCoversWhere = "sheet" | "results" | "stack";

export interface FindCovers {
  /** Keys among those given with no cover, Discogs not asked yet. */
  missing: string[];
  /** While asking: how many are done, of how many. */
  progress: { done: number; total: number } | null;
  /** The last run stopped on a 429. */
  busy: boolean;
  /** The last run's covers found, once it's over. */
  found: number | null;
  find: () => void;
  cancel: () => void;
}

/**
 * "Find missing covers": asks Discogs (through /api/art, paced) for the
 * covers of these keys that MusicBrainz and the Cover Art Archive don't
 * have. Only when `find` is called. Covers show in rows (and mark a share
 * draft changed) as they arrive. Leaving the page cancels it.
 */
export const useFindCovers = (
  keys: string[],
  where: FindCoversWhere,
): FindCovers => {
  // Subscribes to the resolver, so `missing` follows lookups and reports.
  useCoverArt(keys);
  const missing = keys.filter((key) => coverResolver.missing(key));
  const [progress, setProgress] = useState<FindCovers["progress"]>(null);
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const find = () => {
    if (controller.current || missing.length === 0) return;
    const list = [...missing];
    const run = new AbortController();
    controller.current = run;
    setBusy(false);
    setFound(null);
    setProgress({ done: 0, total: list.length });
    track("covers_requested", { missing: list.length, where });
    void runArtQueue(list, {
      signal: run.signal,
      onResult: (art) => coverResolver.setDiscogs(art.key, art.image, art.thumb),
      onProgress: (done) => setProgress({ done, total: list.length }),
    }).then((result) => {
      if (controller.current === run) controller.current = null;
      track("covers_found", {
        found: result.found,
        none: result.none,
        busy: result.busy,
      });
      setProgress(null);
      setBusy(result.busy);
      // Cancelled before anything turned up: nothing to say.
      setFound(result.cancelled && result.found === 0 ? null : result.found);
    });
  };

  const cancel = () => {
    controller.current?.abort();
    controller.current = null;
    setProgress(null);
  };

  return { missing, progress, busy, found, find, cancel };
};

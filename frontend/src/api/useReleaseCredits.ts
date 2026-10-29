import { useEffect, useRef } from "react";
import { useQueries } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import { contributionsOf, versionTargets } from "@/lib/releases";
import { readCredits, writeCredits } from "@/services/creditsCache";
import { EnrichedRelease } from "./types";
import {
  CreditsTarget,
  DiscogsError,
  fetchReleaseCredits,
  ReleaseCredits,
  targetKey,
} from "./releaseCredits";

/**
 * Stored credits for a target. A master can use its main release's, stored
 * when that release was opened as a result of its own.
 */
const storedCredits = (target: CreditsTarget): ReleaseCredits | undefined => {
  const stored = readCredits(targetKey(target));
  if (stored || target.kind !== "master" || !target.mainRelease) return stored;
  const main = readCredits(
    targetKey({ kind: "release", id: target.mainRelease }),
  );
  return main && { ...main, fromMainRelease: true };
};

export interface ResultCredits {
  /** The versions to read (see `versionTargets`); empty: none to read. */
  targets: CreditsTarget[];
  /** Credits read so far, in the order of `targets`. */
  loaded: ReleaseCredits[];
  /** Every version has loaded or failed. */
  settled: boolean;
  /** The first failure, when any version failed. */
  error: DiscogsError | null;
  /** Reads the failed versions again. */
  retry: () => void;
}

/**
 * A result's credits, fetched the first time its row is opened (`enabled`)
 * and kept in localStorage after that, one entry per version. Failures
 * aren't stored, so Retry (or reopening after a reload) asks Discogs again.
 * `peopleIds` are the shared contributors: their versions are the ones read,
 * and they're counted in the `result_credits` event.
 */
export function useReleaseCredits(
  release: EnrichedRelease,
  enabled: boolean,
  peopleIds: number[],
): ResultCredits {
  const targets = versionTargets(release, peopleIds);
  // Set when a version is fetched (not read from storage), so the event is
  // sent once per round of fetches.
  const fetched = useRef(false);

  const queries = useQueries({
    queries: targets.map((target) => ({
      queryKey: ["release-credits", targetKey(target)],
      enabled,
      initialData: () => storedCredits(target),
      queryFn: async () => {
        // Stored since this row mounted, e.g. the version opened elsewhere.
        const stored = storedCredits(target);
        if (stored) return stored;
        fetched.current = true;
        const credits = await fetchReleaseCredits(target);
        writeCredits(targetKey(target), credits);
        return credits;
      },
    })),
  });

  const loaded = queries.flatMap((q) => (q.data ? [q.data] : []));
  const failed = queries.filter((q) => q.isError);
  const settled = queries.every(
    (q) => !q.isFetching && (q.data !== undefined || q.isError),
  );
  const error = (failed[0]?.error as DiscogsError | undefined) ?? null;

  useEffect(() => {
    if (!settled || !fetched.current) return;
    fetched.current = false;
    const named = (id: number) => loaded.some((c) => c.credits[id]);
    track("result_credits", {
      outcome: loaded.length > 0 ? "loaded" : "failed",
      shared: peopleIds.length,
      versions: targets.length,
      ...(loaded.length > 0
        ? {
            found: peopleIds.filter(named).length,
            // Not in the credits, but their discography says how they appear.
            hinted: peopleIds.filter(
              (id) => !named(id) && contributionsOf(release, id).length > 0,
            ).length,
          }
        : {}),
      ...(failed.length > 0
        ? {
            failed: failed.length,
            status: error instanceof DiscogsError ? error.status : -1,
          }
        : {}),
    });
    // Runs when the round settles; the rest is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  return {
    targets,
    loaded,
    settled,
    error,
    retry: () => failed.forEach((q) => void q.refetch()),
  };
}

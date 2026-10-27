import { useQuery } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import { readCredits, writeCredits } from "@/services/creditsCache";
import { EnrichedRelease } from "./types";
import {
  creditsTarget,
  CreditsTarget,
  DiscogsError,
  fetchReleaseCredits,
  ReleaseCredits,
  targetKey,
} from "./releaseCredits";

/**
 * Stored credits for a result. A master can use its main release's, stored
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

/**
 * A result's credits, fetched the first time its row is opened (`enabled`)
 * and kept in localStorage after that. Failures aren't stored, so Retry (or
 * reopening after a reload) asks Discogs again. `peopleIds` are the shared
 * contributors, counted in the `result_credits` event.
 */
export function useReleaseCredits(
  release: EnrichedRelease,
  enabled: boolean,
  peopleIds: number[],
) {
  const target = creditsTarget(release);
  const key = target ? targetKey(target) : null;
  return useQuery<ReleaseCredits, DiscogsError>({
    queryKey: ["release-credits", key],
    enabled: enabled && key !== null,
    initialData: () => (target ? storedCredits(target) : undefined),
    queryFn: async () => {
      // Stored since this row mounted, e.g. its main release opened first.
      const stored = storedCredits(target!);
      if (stored) return stored;
      try {
        const credits = await fetchReleaseCredits(target!);
        writeCredits(key!, credits);
        track("result_credits", {
          outcome: "loaded",
          shared: peopleIds.length,
          found: peopleIds.filter((id) => credits.credits[id]).length,
          from_main_release: credits.fromMainRelease,
        });
        return credits;
      } catch (error) {
        track("result_credits", {
          outcome: "failed",
          shared: peopleIds.length,
          status: error instanceof DiscogsError ? error.status : -1,
        });
        throw error;
      }
    },
  });
}

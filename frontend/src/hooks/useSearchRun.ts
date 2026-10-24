import { useCallback, useEffect, useRef, useState } from "react";
import {
  useDiscogsSearch,
  useListContributorReleases,
  useListReleaseContributors,
} from "@/api/mutations";
import { EnrichedRelease, SearchParams, SearchStage } from "@/api/types";
import { isAbortError } from "@/api/abort";
import { MAX_RELEASES } from "@/api/limits";
import { useCache } from "@/contexts/cache/CacheContext";
import { coverUrl } from "@/lib/searches";

const CHECKED_SHOWN = 4;

export interface CheckedContributor {
  name: string;
  releases: number;
}

/** What SearchProgress shows about the search under way. */
export interface SearchRun {
  params: SearchParams;
  stage: SearchStage | null;
  /** From the first search result, once the album is found. */
  thumb: string;
  year: string;
  /** Releases whose credits are read, once the album is found. */
  matches: number | null;
  /** Contributors found, once the credits are read. */
  contributors: number | null;
  /** Most recent first. */
  checked: CheckedContributor[];
}

interface SearchRunOptions {
  onComplete: (searchId: string, params: SearchParams) => void;
  onError: (error: unknown) => void;
}

/**
 * Runs the three-step search pipeline, tracks its progress and lets it be
 * cancelled. Cancelling aborts in-flight Discogs requests and the pauses
 * between them, and stores nothing.
 */
export const useSearchRun = ({ onComplete, onError }: SearchRunOptions) => {
  const { addSearch } = useCache();
  const searchMutation = useDiscogsSearch();
  const contributorsMutation = useListReleaseContributors();
  const releasesMutation = useListContributorReleases();

  const [run, setRun] = useState<SearchRun | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // Keep the latest callbacks without restarting anything.
  const callbacksRef = useRef({ onComplete, onError });
  callbacksRef.current = { onComplete, onError };

  useEffect(() => () => controllerRef.current?.abort(), []);

  const start = useCallback(
    async (params: SearchParams) => {
      if (controllerRef.current) return;
      const controller = new AbortController();
      const { signal } = controller;
      controllerRef.current = controller;

      const update = (changes: Partial<SearchRun>) =>
        setRun((prev) => (prev ? { ...prev, ...changes } : prev));
      const onProgress = (stage: SearchStage) => update({ stage });
      const onContributorChecked = (name: string, releases: number) =>
        setRun((prev) =>
          prev
            ? {
                ...prev,
                checked: [{ name, releases }, ...prev.checked].slice(
                  0,
                  CHECKED_SHOWN,
                ),
              }
            : prev,
        );

      setRun({
        params,
        stage: null,
        thumb: "",
        year: "",
        matches: null,
        contributors: null,
        checked: [],
      });

      try {
        const searchResults = await searchMutation.mutateAsync({
          params,
          callbacks: { onProgress },
          signal,
        });
        if (!searchResults) return;

        const thumb = coverUrl(searchResults[0]);
        update({
          thumb,
          year: searchResults[0]?.year ?? "",
          matches: Math.min(MAX_RELEASES, searchResults.length),
        });

        const contributorSet = await contributorsMutation.mutateAsync({
          releases: searchResults,
          maxReleases: MAX_RELEASES,
          callbacks: { onProgress },
          signal,
        });
        update({
          contributors: Object.keys(contributorSet.contributors).length,
        });

        const releasesMap = await releasesMutation.mutateAsync({
          contributorSet,
          callbacks: { onProgress, onContributorChecked },
          signal,
        });

        // Convert Map to Record before adding to cache
        const releasesRecord = Object.fromEntries(
          Array.from(releasesMap.entries()).map(([id, release]) => [
            id,
            {
              ...release,
              contributorIds: Array.from(release.contributorIds),
            },
          ]),
        ) as Record<number, EnrichedRelease>;

        const searchId = addSearch(
          params,
          contributorSet,
          releasesRecord,
          thumb,
        );
        callbacksRef.current.onComplete(searchId, params);
      } catch (error) {
        if (!isAbortError(error)) {
          console.error("Search chain error:", error);
          callbacksRef.current.onError(error);
        }
      } finally {
        controllerRef.current = null;
        setRun(null);
      }
    },
    [addSearch, searchMutation, contributorsMutation, releasesMutation],
  );

  const cancel = useCallback(() => controllerRef.current?.abort(), []);

  return { run, isSearching: run !== null, start, cancel };
};

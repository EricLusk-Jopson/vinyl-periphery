import { useCallback, useEffect, useRef, useState } from "react";
import {
  useDiscogsSearch,
  useListContributorReleases,
  useListReleaseContributors,
} from "@/api/mutations";
import { EnrichedRelease, SearchParams, SearchStage } from "@/api/types";
import { isAbortError, throwIfAborted } from "@/api/abort";
import { MAX_RELEASES } from "@/api/limits";
import { useCache } from "@/contexts/cache/CacheContext";
import { albumDiscogsUrl, coverUrl } from "@/lib/searches";
import { preloadImage } from "@/lib/preloadImage";
import { secondsSince, track } from "@/lib/analytics";

const CHECKED_SHOWN = 4;
/** Longest we wait for the cover before showing progress without it. */
const COVER_WAIT_MS = 1500;

export interface CheckedContributor {
  name: string;
  releases: number;
}

/** What SearchProgress shows about the search under way. */
export interface SearchRun {
  /** Distinguishes one search from the next. */
  id: number;
  /**
   * "finding" while the album search runs (the form stays on screen),
   * "running" once it is found and progress can show with its cover.
   */
  phase: "finding" | "running";
  params: SearchParams;
  stage: SearchStage | null;
  /** From the first search result, once the album is found. */
  thumb: string;
  /** Releases whose credits are read, once the album is found. */
  matches: number | null;
  /** Contributors found, once the credits are read. */
  contributors: number | null;
  /** Most recent first. */
  checked: CheckedContributor[];
}

/** Where a search was started from, for analytics. */
/** Where a search was started: the form, a result row, or a results link. */
export type SearchSource = "form" | "result" | "link";

interface SearchRunOptions {
  onComplete: (searchId: string, params: SearchParams) => void;
  /** The album search found nothing. */
  onNotFound: (params: SearchParams) => void;
  /** `phase` says whether it failed before or after the album was found. */
  onError: (error: unknown, phase: SearchRun["phase"]) => void;
}

/**
 * Runs the three-step search pipeline, tracks its progress and lets it be
 * cancelled. Cancelling aborts in-flight Discogs requests and the pauses
 * between them, and stores nothing.
 */
export const useSearchRun = ({
  onComplete,
  onNotFound,
  onError,
}: SearchRunOptions) => {
  const { addSearch } = useCache();
  const searchMutation = useDiscogsSearch();
  const contributorsMutation = useListReleaseContributors();
  const releasesMutation = useListContributorReleases();

  const [run, setRun] = useState<SearchRun | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // Keep the latest callbacks without restarting anything.
  const callbacksRef = useRef({ onComplete, onNotFound, onError });
  callbacksRef.current = { onComplete, onNotFound, onError };

  useEffect(() => () => controllerRef.current?.abort(), []);

  const start = useCallback(
    async (params: SearchParams, source: SearchSource = "form") => {
      if (controllerRef.current) return;
      const controller = new AbortController();
      const { signal } = controller;
      controllerRef.current = controller;

      const startedAt = Date.now();
      const searched = { artist: params.artist, album: params.album };
      track("search_started", { ...searched, source });

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

      let phase: SearchRun["phase"] = "finding";
      setRun({
        id: Date.now(),
        phase,
        params,
        stage: null,
        thumb: "",
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
        if (!searchResults || searchResults.length === 0) {
          track("search_not_found", {
            ...searched,
            seconds: secondsSince(startedAt),
          });
          callbacksRef.current.onNotFound(params);
          return;
        }

        // Load the cover before progress appears, so it doesn't pop in.
        const thumb = coverUrl(searchResults[0]);
        await preloadImage(thumb, COVER_WAIT_MS, signal);
        throwIfAborted(signal);

        const matches = Math.min(MAX_RELEASES, searchResults.length);
        phase = "running";
        update({
          phase,
          thumb,
          matches,
          // Progress opens on the credits step, which starts right away.
          stage: {
            id: "contributors",
            label: "Contributors",
            current: 1,
            total: matches,
          },
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
          albumDiscogsUrl(searchResults[0]),
        );
        track("search_completed", {
          ...searched,
          seconds: secondsSince(startedAt),
          releases_read: matches,
          contributors: Object.keys(contributorSet.contributors).length,
          albums: releasesMap.size,
        });
        callbacksRef.current.onComplete(searchId, params);
      } catch (error) {
        const timing = { ...searched, phase, seconds: secondsSince(startedAt) };
        if (isAbortError(error)) {
          track("search_cancelled", timing);
        } else {
          console.error("Search chain error:", error);
          track("search_failed", {
            ...timing,
            error: error instanceof Error ? error.message.slice(0, 120) : "unknown",
          });
          callbacksRef.current.onError(error, phase);
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

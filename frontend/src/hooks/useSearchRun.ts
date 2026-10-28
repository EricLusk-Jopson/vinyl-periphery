import { useCallback, useEffect, useRef, useState } from "react";
import {
  useDiscogsSearch,
  useListContributorReleases,
  useListReleaseContributors,
} from "@/api/mutations";
import {
  EnrichedRelease,
  ReleaseToRead,
  SearchParams,
  SearchStage,
  SearchTarget,
} from "@/api/types";
import { targetReleases } from "@/api/searchTarget";
import { isAbortError, throwIfAborted } from "@/api/abort";
import { MAX_RELEASES } from "@/api/limits";
import { useCache } from "@/contexts/cache/CacheContext";
import { coverUrl, usableImageUrl } from "@/lib/searches";
import { targetFromSearchResult } from "@/lib/searchTarget";
import { SearchOrigin } from "@/lib/lineage";
import { SearchLineage } from "@/contexts/cache/types";
import { preloadImage } from "@/lib/preloadImage";
import { joinWithin, secondsSince, track } from "@/lib/analytics";
import { uncategorizedRoles } from "@/lib/transformers/roleCategories";

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

/**
 * A search for a known album, started from a result row: skips the text
 * search and reads that album's own releases.
 */
export interface KnownAlbum {
  target: SearchTarget;
  /** The row's cover, if it had one. */
  thumb?: string;
  /** The search and row it was started from, for lineage. */
  from?: SearchOrigin;
  /** A known place in a trail, e.g. a ghosted stack step searched again. */
  lineage?: SearchLineage;
}

interface SearchRunOptions {
  onComplete: (
    searchId: string,
    params: SearchParams,
    target: SearchTarget | null,
  ) => void;
  /** The album search found nothing. */
  onNotFound: (params: SearchParams) => void;
  /** Not started: the session has no room for another search. */
  onSessionFull: () => void;
  /**
   * A typed search found an album already searched (in this session or
   * saved). Stopped before reading credits, so the user can open it or
   * search again.
   */
  onAlreadySearched: (
    searchId: string,
    params: SearchParams,
    target: SearchTarget,
  ) => void;
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
  onSessionFull,
  onAlreadySearched,
  onError,
}: SearchRunOptions) => {
  const { addSearch, hasRoomForAnotherSearch, searches } = useCache();
  const searchesRef = useRef(searches);
  searchesRef.current = searches;
  const searchMutation = useDiscogsSearch();
  const contributorsMutation = useListReleaseContributors();
  const releasesMutation = useListContributorReleases();

  const [run, setRun] = useState<SearchRun | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // Keep the latest callbacks without restarting anything.
  const callbacksRef = useRef({
    onComplete,
    onNotFound,
    onSessionFull,
    onAlreadySearched,
    onError,
  });
  callbacksRef.current = {
    onComplete,
    onNotFound,
    onSessionFull,
    onAlreadySearched,
    onError,
  };

  useEffect(() => () => controllerRef.current?.abort(), []);

  const start = useCallback(
    async (
      params: SearchParams,
      source: SearchSource = "form",
      known?: KnownAlbum,
    ) => {
      if (controllerRef.current) return;
      if (!hasRoomForAnotherSearch()) {
        track("search_blocked", { reason: "session_full", source });
        callbacksRef.current.onSessionFull();
        return;
      }
      const controller = new AbortController();
      const { signal } = controller;
      controllerRef.current = controller;

      const startedAt = Date.now();
      const searched = { artist: params.artist, album: params.album };
      track("search_started", {
        ...searched,
        source,
        by_id: Boolean(known),
      });

      const update = (changes: Partial<SearchRun>) =>
        setRun((prev) => (prev ? { ...prev, ...changes } : prev));
      const onProgress = (stage: SearchStage) => update({ stage });
      // Discography calls made, and people the page cap stopped short.
      let discographyCalls = 0;
      let cappedContributors = 0;
      const onContributorChecked = (
        name: string,
        releases: number,
        read?: { pages: number; capped: boolean },
      ) => {
        discographyCalls += read?.pages ?? 1;
        if (read?.capped) cappedContributors++;
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
      };

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
        let releasesToRead: ReleaseToRead[];
        let thumb: string;
        let target: SearchTarget | null;
        if (known) {
          // The album is known: read its own releases, no text search.
          target = known.target;
          releasesToRead = await targetReleases(
            known.target,
            { onProgress },
            signal,
          );
          thumb = usableImageUrl(known.thumb);
        } else {
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
          target = targetFromSearchResult(searchResults[0]);
          // Already searched this album: offer it instead of a new root.
          const existing =
            target &&
            Object.values(searchesRef.current).find(
              (s) => s.target?.key === target!.key,
            );
          if (existing && target) {
            callbacksRef.current.onAlreadySearched(
              existing.searchId,
              params,
              target,
            );
            return;
          }
          releasesToRead = searchResults;
          thumb = coverUrl(searchResults[0]);
        }

        // Load the cover before progress appears, so it doesn't pop in.
        await preloadImage(thumb, COVER_WAIT_MS, signal);
        throwIfAborted(signal);

        const matches = Math.min(MAX_RELEASES, releasesToRead.length);
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
          releases: releasesToRead,
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
          Array.from(releasesMap.entries()).map(([key, release]) => [
            key,
            {
              ...release,
              contributorIds: Array.from(release.contributorIds),
            },
          ]),
        ) as Record<string, EnrichedRelease>;

        const searchId = addSearch(
          params,
          contributorSet,
          releasesRecord,
          thumb,
          target,
          known?.from,
          known?.lineage,
        );
        // Roles the category table doesn't know yet, so it can grow.
        const allRoles = Object.values(contributorSet.contributors).flatMap(
          (c) => c.roles,
        );
        const unknownRoles = uncategorizedRoles(allRoles);
        track("search_completed", {
          ...searched,
          seconds: secondsSince(startedAt),
          releases_read: matches,
          contributors: Object.keys(contributorSet.contributors).length,
          discography_calls: discographyCalls,
          discographies_capped: cappedContributors,
          albums: releasesMap.size,
          roles: new Set(allRoles).size,
          roles_uncategorized_count: unknownRoles.length,
          roles_uncategorized: joinWithin(unknownRoles),
        });
        callbacksRef.current.onComplete(searchId, params, target);
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
    [
      addSearch,
      hasRoomForAnotherSearch,
      searchMutation,
      contributorsMutation,
      releasesMutation,
    ],
  );

  const cancel = useCallback(() => controllerRef.current?.abort(), []);

  return { run, isSearching: run !== null, start, cancel };
};

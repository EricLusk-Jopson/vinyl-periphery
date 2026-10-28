import { useMutation } from "@tanstack/react-query";
import {
  ContributorSet,
  DiscogsSearchResponse,
  RawArtist,
  Track,
  EnrichedRelease,
  SearchParams,
  ReleasesParams,
  ContributorSetInternal,
  MutationCallbacks,
  ContributorMutationParams,
  ReleaseMutationParams,
  SearchMutationParams,
} from "./types";
import { addContributorToSet } from "./contributorSet";
import {
  addRelease,
  DiscographyItem,
  discographyPagesToRead,
  toEnrichedRelease,
} from "../lib/releases";
import { sleep, throwIfAborted } from "./abort";
import { DISCOGRAPHY_PAGE_SIZE, REQUEST_DELAY_MS } from "./limits";

async function discogsSearch(
  { artist, album }: SearchParams,
  callbacks?: MutationCallbacks,
  signal?: AbortSignal
) {
  callbacks?.onProgress?.({
    id: "initial",
    label: "Searching",
    current: 0,
    total: 1,
  });

  const response = await fetch(
    `/api/search?band=${encodeURIComponent(artist)}&album=${encodeURIComponent(
      album
    )}`,
    { signal }
  );

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }

  callbacks?.onProgress?.({
    id: "initial",
    label: "Searching",
    current: 1,
    total: 1,
  });

  const data: DiscogsSearchResponse = await response.json();
  return data.results || null;
}

async function listReleaseContributors(
  { releases, maxReleases = 5 }: ReleasesParams,
  callbacks?: MutationCallbacks,
  signal?: AbortSignal
): Promise<ContributorSet> {
  maxReleases = Math.min(maxReleases, releases.length);
  const selectedReleases = releases.slice(0, maxReleases);

  // Use Map and Sets during collection phase
  const internalSet: ContributorSetInternal = {
    contributors: new Map(),
  };

  // Track processed artist IDs to avoid duplicate fetches
  const processedArtistIds = new Set<number>();

  let currentRelease = 0;
  for (const release of selectedReleases) {
    throwIfAborted(signal);
    callbacks?.onProgress?.({
      id: "contributors",
      label: "Contributors",
      current: currentRelease + 1,
      total: maxReleases,
    });

    try {
      console.log(`Fetching details for release: ${release.id}`);
      const response = await fetch(
        `https://api.discogs.com/releases/${release.id}`,
        { signal }
      );
      const releaseData = await response.json();

      // Process main artists
      if (releaseData.artists) {
        releaseData.artists.forEach((artist: RawArtist) => {
          addContributorToSet(internalSet, artist, "artist", "Main Artist");
        });
      }

      // Process credits and extraartists
      if (releaseData.extraartists) {
        releaseData.extraartists.forEach((artist: RawArtist) => {
          addContributorToSet(internalSet, artist, "credits");
        });
      }

      if (releaseData.credits) {
        releaseData.credits.forEach((artist: RawArtist) => {
          addContributorToSet(internalSet, artist, "credits");
        });
      }

      // Process tracklist's extraartists
      if (releaseData.tracklist) {
        releaseData.tracklist.forEach((track: Track) => {
          if (track.extraartists) {
            track.extraartists.forEach((artist: RawArtist) => {
              addContributorToSet(internalSet, artist, "credits");
            });
          }
        });
      }

      // Fetch and process band members only for new artists
      if (releaseData.artists) {
        for (const artist of releaseData.artists) {
          if (!processedArtistIds.has(artist.id)) {
            processedArtistIds.add(artist.id);

            const memberResponse = await fetch(
              `https://api.discogs.com/artists/${artist.id}`,
              { signal }
            );
            const memberData = await memberResponse.json();

            if (memberData.members) {
              memberData.members.forEach((member: RawArtist) => {
                addContributorToSet(
                  internalSet,
                  member,
                  "member",
                  "Band Member"
                );
              });
            }
            await sleep(REQUEST_DELAY_MS, signal);
          }
        }
      }

      await sleep(REQUEST_DELAY_MS, signal);
    } catch (error) {
      // Cancelling stops the search; other failures skip this release.
      throwIfAborted(signal);
      console.error(`Error fetching release ${release.id}:`, error);
    }
    currentRelease++;
  }

  // Convert internal Map/Set structure to expected Record format
  return {
    contributors: Object.fromEntries(
      Array.from(internalSet.contributors.entries()).map(
        ([id, contributor]) => [
          id,
          {
            ...contributor,
            roles: Array.from(contributor.roles),
            sources: Array.from(contributor.sources),
          },
        ]
      )
    ),
  };
}

export async function listContributorReleases(
  {
    contributorSet,
  }: {
    contributorSet: ContributorSet;
  },
  callbacks?: MutationCallbacks,
  signal?: AbortSignal
): Promise<Map<string, EnrichedRelease>> {
  const releaseMap = new Map<string, EnrichedRelease>();

  const contributors = Object.values(contributorSet.contributors);
  let currentContributor = 0;
  for (const contributor of contributors) {
    throwIfAborted(signal);
    const progress = (extraCalls: number) =>
      callbacks?.onProgress?.({
        id: "releases",
        label: "Discographies",
        current: currentContributor + 1,
        total: contributors.length,
        extraCalls,
      });
    progress(0);

    // Every page, DISCOGRAPHY_PAGE_SIZE at a time, up to the cap. Nearly
    // everyone fits in the first page; the first page says how many more.
    let pagesToRead = 1;
    let pagesRead = 0;
    let totalItems = 0;
    try {
      for (let page = 1; page <= pagesToRead; page++) {
        throwIfAborted(signal);
        console.log(
          `Fetching releases for contributor: ${contributor.name} (${contributor.id}), page ${page}`
        );
        const response = await fetch(
          `https://api.discogs.com/artists/${contributor.id}/releases?per_page=${DISCOGRAPHY_PAGE_SIZE}&page=${page}`,
          { signal }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to fetch releases for artist ${contributor.id}, page ${page}`
          );
        }

        const data: {
          releases: DiscographyItem[];
          pagination: { pages: number; items: number };
        } = await response.json();

        // Keyed by "master:N" / "release:N"; the same album from several
        // contributors becomes one entry.
        for (const item of data.releases ?? []) {
          addRelease(releaseMap, toEnrichedRelease(item, contributor.id));
        }
        pagesRead = page;

        if (page === 1) {
          pagesToRead = discographyPagesToRead(data.pagination);
          totalItems = data.pagination?.items ?? data.releases?.length ?? 0;
        }
        progress(pagesToRead - page);
        await sleep(REQUEST_DELAY_MS, signal);
      }
    } catch (error) {
      // Cancelling stops the search; other failures keep the pages read.
      throwIfAborted(signal);
      console.error(
        `Error processing releases for ${contributor.name}:`,
        error
      );
    }

    if (pagesRead > 0) {
      callbacks?.onContributorChecked?.(contributor.name, totalItems, {
        pages: pagesRead,
        capped: pagesToRead < Math.ceil(totalItems / DISCOGRAPHY_PAGE_SIZE),
      });
    }
    currentContributor++;
  }

  return releaseMap;
}

export function useDiscogsSearch() {
  return useMutation({
    mutationFn: async ({ params, callbacks, signal }: SearchMutationParams) => {
      return discogsSearch(params, callbacks, signal);
    },
  });
}

export function useListReleaseContributors() {
  return useMutation({
    mutationFn: async ({
      releases,
      maxReleases,
      callbacks,
      signal,
    }: ContributorMutationParams) => {
      return listReleaseContributors(
        { releases, maxReleases },
        callbacks,
        signal
      );
    },
  });
}

export function useListContributorReleases() {
  return useMutation({
    mutationFn: async ({
      contributorSet,
      callbacks,
      signal,
    }: ReleaseMutationParams) => {
      return listContributorReleases({ contributorSet }, callbacks, signal);
    },
  });
}

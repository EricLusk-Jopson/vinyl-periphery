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
import {
  addBandMembers,
  addContributorToSet,
  releaseHasCredits,
} from "./contributorSet";
import {
  addRelease,
  DiscographyItem,
  discographyPagesToRead,
  discographyUrl,
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
  // Bands' members (every member they've had), applied once all releases
  // are read: only as a fallback when none of them lists any credits.
  const members: RawArtist[] = [];
  let credited = false;

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

      if (releaseHasCredits(releaseData)) credited = true;

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

            if (Array.isArray(memberData.members)) {
              members.push(...memberData.members);
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

  addBandMembers(internalSet, members, credited);

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

  // Two passes: every contributor's first page, then everyone's further
  // pages. The first pages say how many more there are, so the count of
  // calls (and the time left) is known early instead of growing late.
  // Pages come newest first, DISCOGRAPHY_PAGE_SIZE at a time, up to the
  // cap (so the oldest credits are the ones a cap drops).
  const reads = contributors.map((contributor) => ({
    contributor,
    pagesToRead: 1,
    pagesRead: 0,
    totalItems: 0,
    failed: false,
  }));
  // Calls known so far: one first page each, plus the further pages the
  // first pages have announced.
  let callsKnown = contributors.length;
  let callsMade = 0;
  const progress = () =>
    callbacks?.onProgress?.({
      id: "releases",
      label: "Discographies",
      current: callsMade + 1,
      total: callsKnown,
    });

  const readPage = async (read: (typeof reads)[number], page: number) => {
    const { contributor } = read;
    throwIfAborted(signal);
    progress();
    try {
      console.log(
        `Fetching releases for contributor: ${contributor.name} (${contributor.id}), page ${page}`
      );
      const response = await fetch(discographyUrl(contributor.id, page), {
        signal,
      });
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
      read.pagesRead = page;
      if (page === 1) {
        read.pagesToRead = discographyPagesToRead(data.pagination);
        read.totalItems = data.pagination?.items ?? data.releases?.length ?? 0;
        callsKnown += read.pagesToRead - 1;
      }
    } catch (error) {
      // Cancelling stops the search; other failures keep the pages read
      // and skip the person's remaining pages.
      throwIfAborted(signal);
      console.error(`Error processing releases for ${contributor.name}:`, error);
      read.failed = true;
      // The pages after this one won't be read.
      if (page > 1) callsKnown -= read.pagesToRead - page;
    }
    callsMade++;
    await sleep(REQUEST_DELAY_MS, signal);
  };

  const finish = (read: (typeof reads)[number]) => {
    const { contributor, pagesRead, pagesToRead, totalItems } = read;
    if (pagesRead === 0) return;
    const coverage = {
      pages: pagesRead,
      capped: pagesToRead < Math.ceil(totalItems / DISCOGRAPHY_PAGE_SIZE),
    };
    // Kept on the contributor, so the swimlanes can mark a lane that lost
    // its oldest items.
    contributorSet.contributors[contributor.id] = {
      ...contributor,
      discography: { items: totalItems, ...coverage },
    };
    callbacks?.onContributorChecked?.(contributor.name, totalItems, coverage);
  };

  // Pass one: first pages. Someone with no more to read is done.
  for (const read of reads) {
    await readPage(read, 1);
    if (read.failed || read.pagesToRead <= 1) finish(read);
  }
  // Pass two: the further pages, person by person.
  for (const read of reads) {
    if (read.failed || read.pagesToRead <= 1) continue;
    for (let page = 2; page <= read.pagesToRead && !read.failed; page++) {
      await readPage(read, page);
    }
    finish(read);
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

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
} from "./types";
import { addContributorToSet } from "./contributorSet";

async function discogsSearch({ artist, album }: SearchParams) {
  const response = await fetch(
    `/api/search?band=${encodeURIComponent(artist)}&album=${encodeURIComponent(
      album
    )}`
  );

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }

  const data: DiscogsSearchResponse = await response.json();
  return data.results || null;
}

async function listReleaseContributors({
  releases,
  maxReleases = 5,
}: ReleasesParams): Promise<ContributorSet> {
  maxReleases = Math.min(maxReleases, releases.length);
  const selectedReleases = releases.slice(0, maxReleases);

  // Use Map and Sets during collection phase
  const internalSet: ContributorSetInternal = {
    contributors: new Map(),
  };

  // Track processed artist IDs to avoid duplicate fetches
  const processedArtistIds = new Set<number>();

  for (const release of selectedReleases) {
    try {
      console.log(`Fetching details for release: ${release.id}`);
      const response = await fetch(
        `https://api.discogs.com/releases/${release.id}`
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
              `https://api.discogs.com/artists/${artist.id}`
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
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`Error fetching release ${release.id}:`, error);
    }
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

async function listContributorReleases({
  contributorSet,
}: {
  contributorSet: ContributorSet;
}): Promise<Map<number, EnrichedRelease>> {
  const releaseMap = new Map<number, EnrichedRelease>();

  for (const contributor of Object.values(contributorSet.contributors)) {
    try {
      console.log(
        `Fetching releases for contributor: ${contributor.name} (${contributor.id})`
      );
      const response = await fetch(
        `https://api.discogs.com/artists/${contributor.id}/releases`
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch releases for artist ${contributor.id}`
        );
      }

      const data: {
        releases: Array<Omit<EnrichedRelease, "contributorIds">>;
        pagination: { pages: number; items: number };
      } = await response.json();

      for (const release of data.releases) {
        const existingRelease = releaseMap.get(release.id);
        if (existingRelease) {
          // Use a Set to ensure unique contributor IDs
          const contributorIds = new Set(existingRelease.contributorIds);
          contributorIds.add(contributor.id);
          existingRelease.contributorIds = Array.from(contributorIds);
        } else {
          const newRelease: EnrichedRelease = {
            ...release,
            contributorIds: [contributor.id],
          };
          releaseMap.set(release.id, newRelease);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(
        `Error processing releases for ${contributor.name}:`,
        error
      );
    }
  }

  return releaseMap;
}

export function useDiscogsSearch() {
  return useMutation({
    mutationFn: discogsSearch,
  });
}

export function useListReleaseContributors() {
  return useMutation({
    mutationFn: listReleaseContributors,
  });
}

export function useListContributorReleases() {
  return useMutation({
    mutationFn: listContributorReleases,
  });
}

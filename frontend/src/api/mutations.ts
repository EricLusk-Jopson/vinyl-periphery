// mutations.ts
import { useMutation } from "@tanstack/react-query";
import {
  ContributorSet,
  DiscogsSearchResponse,
  RawArtist,
  Track,
  EnrichedRelease,
  SearchParams,
  ReleasesParams,
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

  const contributorSet: ContributorSet = {
    contributors: new Map(),
  };

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
          addContributorToSet(contributorSet, artist, "artist", "Main Artist");
        });
      }

      // Process extraartists
      if (releaseData.extraartists) {
        releaseData.extraartists.forEach((artist: RawArtist) => {
          addContributorToSet(contributorSet, artist, "credits");
        });
      }

      // Process credits
      if (releaseData.credits) {
        releaseData.credits.forEach((artist: RawArtist) => {
          addContributorToSet(contributorSet, artist, "credits");
        });
      }

      // Process tracklist's extraartists
      if (releaseData.tracklist) {
        releaseData.tracklist.forEach((track: Track) => {
          if (track.extraartists) {
            track.extraartists.forEach((artist: RawArtist) => {
              addContributorToSet(contributorSet, artist, "credits");
            });
          }
        });
      }

      // Fetch and process band members
      if (releaseData.artists) {
        for (const artist of releaseData.artists) {
          const memberResponse = await fetch(
            `https://api.discogs.com/artists/${artist.id}`
          );
          const memberData = await memberResponse.json();

          if (memberData.members) {
            memberData.members.forEach((member: RawArtist) => {
              addContributorToSet(
                contributorSet,
                member,
                "member",
                "Band Member"
              );
            });
          }
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`Error fetching release ${release.id}:`, error);
    }
  }

  console.log(contributorSet);
  return contributorSet;
}

async function listContributorReleases({
  contributorSet,
}: {
  contributorSet: ContributorSet;
}): Promise<Map<number, EnrichedRelease>> {
  const releaseMap = new Map<number, EnrichedRelease>();

  for (const contributor of contributorSet.contributors.values()) {
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
        releases: Array<Omit<EnrichedRelease, "contributors">>;
        pagination: { pages: number; items: number };
      } = await response.json();

      for (const release of data.releases) {
        const existingRelease = releaseMap.get(release.id);
        if (existingRelease) {
          contributor.sources.forEach((source) => {
            switch (source) {
              case "credits":
                existingRelease.contributors.fromCredits.add(contributor.id);
                break;
              case "artist":
                existingRelease.contributors.fromArtists.add(contributor.id);
                break;
              case "member":
                existingRelease.contributors.fromMembers.add(contributor.id);
                break;
            }
          });
        } else {
          const newRelease: EnrichedRelease = {
            ...release,
            contributors: {
              fromCredits: new Set(
                contributor.sources.has("credits") ? [contributor.id] : []
              ),
              fromArtists: new Set(
                contributor.sources.has("artist") ? [contributor.id] : []
              ),
              fromMembers: new Set(
                contributor.sources.has("member") ? [contributor.id] : []
              ),
            },
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
  console.log(releaseMap);
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

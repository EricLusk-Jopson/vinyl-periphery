import { useMutation } from "@tanstack/react-query";
import {
  ContributorSet,
  DiscogsSearchResponse,
  RawArtist,
  SearchResult,
  Track,
} from "./types";
import { addArtistToSet } from "./contributorSet";

interface SearchParams {
  artist: string;
  album: string;
}

interface ReleasesParams {
  releases: SearchResult[];
  maxReleases: number;
}

interface ArtistWithRoles {
  id: number;
  name: string;
  roles: string[];
}

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
}: ReleasesParams): Promise<ArtistWithRoles[]> {
  maxReleases = Math.min(maxReleases, releases.length);
  const selectedReleases = releases.slice(0, maxReleases);

  const contributorSet: ContributorSet = {
    artists: new Map(),
    roleMapping: new Map(),
  };

  // Process one at a time to respect rate limits
  for (const release of selectedReleases) {
    try {
      console.log(`Fetching details for release: ${release.id}`);
      const response = await fetch(
        `https://api.discogs.com/releases/${release.id}`
      );
      const releaseData = await response.json();

      // Process extraartists
      if (releaseData.extraartists) {
        releaseData.extraartists.forEach((artist: RawArtist) => {
          addArtistToSet(contributorSet, artist);
        });
      }

      // Process credits
      if (releaseData.credits) {
        releaseData.credits.forEach((artist: RawArtist) => {
          addArtistToSet(contributorSet, artist);
        });
      }

      // Process tracklist's extraartists
      if (releaseData.tracklist) {
        releaseData.tracklist.forEach((track: Track) => {
          if (track.extraartists) {
            track.extraartists.forEach((artist: RawArtist) => {
              addArtistToSet(contributorSet, artist);
            });
          }
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 2500));
    } catch (error) {
      console.error(`Error fetching release ${release.id}:`, error);
    }
  }

  // For debugging, log the final set
  console.log("Contributor Set:", {
    artistCount: contributorSet.artists.size,
    artists: Array.from(contributorSet.artists.values()),
    roles: Array.from(contributorSet.roleMapping.entries()).map(
      ([id, roles]) => ({
        artistId: id,
        artistName: contributorSet.artists.get(id)?.name,
        roles: Array.from(roles),
      })
    ),
  });

  return Array.from(contributorSet.artists.entries()).map(([id, artist]) => ({
    id: artist.id,
    name: artist.name,
    roles: Array.from(contributorSet.roleMapping.get(id) || []),
  }));
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

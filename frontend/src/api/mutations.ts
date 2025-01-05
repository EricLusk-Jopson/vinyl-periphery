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

interface DiscographyParams {
  contributors: ArtistWithRoles[];
}

interface DiscogsRelease {
  id: number;
  title: string;
  year: string;
  artist: string;
  role: string;
  thumb: string;
  resource_url: string;
}

interface DiscogsArtistReleases {
  releases: DiscogsRelease[];
  pagination: {
    pages: number;
    items: number;
  };
}

interface EnrichedRelease extends DiscogsRelease {
  contributorIds: Set<number>;
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

      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`Error fetching release ${release.id}:`, error);
    }
  }

  return Array.from(contributorSet.artists.entries()).map(([id, artist]) => ({
    id: artist.id,
    name: artist.name,
    roles: Array.from(contributorSet.roleMapping.get(id) || []),
  }));
}

async function listContributorReleases({
  contributors,
}: DiscographyParams): Promise<Map<number, EnrichedRelease>> {
  const releaseMap = new Map<number, EnrichedRelease>();

  for (const contributor of contributors) {
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

      const data: DiscogsArtistReleases = await response.json();

      // Process each release from this contributor
      for (const release of data.releases) {
        const existingRelease = releaseMap.get(release.id);
        if (existingRelease) {
          existingRelease.contributorIds.add(contributor.id);
        } else {
          // New release, create entry with initial contributor
          releaseMap.set(release.id, {
            ...release,
            contributorIds: new Set([contributor.id]),
          });
        }
      }

      // Respect rate limits
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

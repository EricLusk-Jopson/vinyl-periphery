import { ContributorSet, RawArtist } from "./types";

export function addArtistToSet(set: ContributorSet, artist: RawArtist) {
  // Only store id and name in the artists map
  if (!set.artists.has(artist.id)) {
    set.artists.set(artist.id, {
      id: artist.id,
      name: artist.name,
    });
  }

  // Handle roles separately
  if (!set.roleMapping.has(artist.id)) {
    set.roleMapping.set(artist.id, new Set());
  }

  const roles = Array.isArray(artist.role) ? artist.role : [artist.role];
  roles.forEach((role) => {
    if (role) {
      set.roleMapping.get(artist.id)?.add(role);
    }
  });
}

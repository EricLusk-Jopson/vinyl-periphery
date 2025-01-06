import {
  ContributorSet,
  RawArtist,
  ContributorSource,
  Contributor,
  EnrichedRelease,
} from "./types";

export function addContributorToSet(
  set: ContributorSet,
  artist: RawArtist,
  source: ContributorSource,
  role?: string
): void {
  const existing = set.contributors.get(artist.id);

  if (existing) {
    existing.sources.add(source);
    if (role) {
      existing.roles.add(role);
    }
    if (Array.isArray(artist.role)) {
      artist.role.forEach((r) => r && existing.roles.add(r));
    } else if (artist.role) {
      existing.roles.add(artist.role);
    }
  } else {
    const roles = new Set<string>();
    if (role) {
      roles.add(role);
    }
    if (Array.isArray(artist.role)) {
      artist.role.forEach((r) => r && roles.add(r));
    } else if (artist.role) {
      roles.add(artist.role);
    }

    set.contributors.set(artist.id, {
      id: artist.id,
      name: artist.name,
      roles,
      sources: new Set([source]),
      resourceUrl: artist.resource_url,
    });
  }
}

export function getContributorConfidence(contributor: Contributor): number {
  let confidence = 0;

  if (contributor.sources.has("credits"))
    confidence = Math.max(confidence, 1.0);
  if (contributor.sources.has("artist")) confidence = Math.max(confidence, 0.7);
  if (contributor.sources.has("member")) confidence = Math.max(confidence, 0.4);

  if (contributor.sources.size > 1) {
    confidence = Math.min(
      1.0,
      confidence + 0.1 * (contributor.sources.size - 1)
    );
  }

  return confidence;
}

export function calculateReleaseScore(
  release: EnrichedRelease,
  originalContributors: ContributorSet
): { score: number; confidence: number } {
  const size = release.contributorIds.size;
  const totalSize = originalContributors.contributors.size;
  let totalConfidence = 0;

  console.log(release, originalContributors);

  release.contributorIds.forEach((id) => {
    const contributor = originalContributors.contributors.get(id);
    if (contributor) {
      const confidence = getContributorConfidence(contributor);
      totalConfidence += confidence;
    }
  });

  return {
    score: size > 0 ? size / totalSize : 0,
    confidence: size > 0 ? totalConfidence / size : 0,
  };
}

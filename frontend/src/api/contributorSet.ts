import { defaultRolePipeline } from "../lib/transformers/roleProcessor";
import {
  RawArtist,
  ContributorSource,
  Contributor,
  EnrichedRelease,
  ContributorSetInternal,
} from "./types";

// Helper to process all roles through pipeline and convert to Set
const processRolesToSet = (roles: (string | undefined)[]): Set<string> => {
  const filteredRoles = roles.filter((r): r is string => !!r);
  return new Set(defaultRolePipeline(filteredRoles));
};

export function addContributorToSet(
  set: ContributorSetInternal,
  artist: RawArtist,
  source: ContributorSource,
  defaultRole?: string
): void {
  // Guard against invalid artist IDs
  if (!artist.id || artist.id === 0) {
    return;
  }

  // Collect all roles into a single array for processing
  const rolesToProcess: (string | undefined)[] = [
    defaultRole,
    ...(Array.isArray(artist.role) ? artist.role : [artist.role]),
  ];

  const existing = set.contributors.get(artist.id);
  const processedRoles = processRolesToSet(rolesToProcess);

  if (existing) {
    existing.sources.add(source);
    // Add all processed roles to existing Set
    processedRoles.forEach((role) => existing.roles.add(role));
  } else {
    set.contributors.set(artist.id, {
      id: artist.id,
      name: artist.name,
      roles: processedRoles,
      sources: new Set([source]),
      resourceUrl: artist.resource_url,
    });
  }
}

export function getContributorConfidence(contributor: Contributor): number {
  let confidence = 0;

  if (contributor.sources.includes("credits"))
    confidence = Math.max(confidence, 1.0);
  if (contributor.sources.includes("artist"))
    confidence = Math.max(confidence, 0.7);
  if (contributor.sources.includes("member"))
    confidence = Math.max(confidence, 0.4);

  if (contributor.sources.length > 1) {
    confidence = Math.min(
      1.0,
      confidence + 0.1 * (contributor.sources.length - 1)
    );
  }

  return confidence;
}

export function calculateReleaseScore(
  release: EnrichedRelease,
  context: {
    contributors: Record<number, Contributor>;
    isContributorActive: (id: number) => boolean;
  }
): { score: number; confidence: number } {
  // Filter to only active contributors
  const activeContributors = release.contributorIds.filter((id) =>
    context.isContributorActive(id)
  );

  const totalActiveContributors = Object.keys(context.contributors).filter(
    (id) => context.isContributorActive(Number(id))
  ).length;
  let totalConfidence = 0;

  activeContributors.forEach((id) => {
    const contributor = context.contributors[id];
    if (contributor) {
      const confidence = getContributorConfidence(contributor);
      totalConfidence += confidence;
    }
  });

  // If there are no active contributors, score should be 0
  if (activeContributors.length === 0) {
    return { score: 0, confidence: 0 };
  }

  if (release.title === "Imaginal Disk") {
    console.log(
      context.contributors,
      activeContributors,
      totalActiveContributors
    );
  }
  return {
    // Score is based on how many active contributors this release shares
    score: activeContributors.length / totalActiveContributors,
    // Confidence is the average confidence of active contributors
    confidence: totalConfidence / activeContributors.length,
  };
}

import { useMemo } from "react";
import { calculateReleaseScore } from "../../api/contributorSet";
import { useCache, useSearchFilters } from "../../contexts/cache/CacheContext";
import {
  Section,
  SectionTitle,
  Grid,
  ContributorList,
  ReleaseCard,
  ReleaseInfo,
  ReleaseTitle,
} from "./styles";

export const ReleaseList: React.FC<{ searchId: string }> = ({ searchId }) => {
  const { searches } = useCache();
  const { isContributorActive } = useSearchFilters(searchId);
  const search = searches[searchId];

  const filteredReleases = useMemo(() => {
    if (!search) return [];

    return Object.values(search.releases)
      .filter((release) => {
        // Deduplicate contributorIds first
        const uniqueContributorIds = Array.from(
          new Set(release.contributorIds)
        );
        return uniqueContributorIds.some((id) => isContributorActive(id));
      })
      .map((release) => {
        // Ensure we're working with unique contributor IDs
        const uniqueContributorIds = Array.from(
          new Set(release.contributorIds)
        );

        const { score, confidence } = calculateReleaseScore(
          { ...release, contributorIds: uniqueContributorIds },
          {
            contributors: search.contributors,
            isContributorActive,
          }
        );

        return {
          ...release,
          score,
          confidence,
          // Store unique active contributors
          activeContributors: Array.from(
            new Set(
              uniqueContributorIds.filter((id) => isContributorActive(id))
            )
          ),
        };
      })
      .sort((a, b) => b.score * b.confidence - a.score * a.confidence);
  }, [search, isContributorActive]);

  if (!search) return null;

  return (
    <Section>
      <SectionTitle>Filtered Releases ({filteredReleases.length})</SectionTitle>
      <Grid>
        {filteredReleases.map((release) => (
          <ReleaseCard key={release.id}>
            <ReleaseTitle>{release.title}</ReleaseTitle>

            <ReleaseInfo>
              {release.artist} • {release.year}
            </ReleaseInfo>

            <ReleaseInfo>
              Match Score: {(release.score * 100).toFixed(1)}% • Confidence:{" "}
              {(release.confidence * 100).toFixed(1)}%
            </ReleaseInfo>

            <ContributorList>
              Active Contributors:{" "}
              {/* Ensure we only show each contributor once */}
              {Array.from(
                new Set(
                  release.activeContributors
                    .filter((id) => id in search.contributors)
                    .map((id) => search.contributors[id].name)
                )
              ).join(", ")}
            </ContributorList>
          </ReleaseCard>
        ))}
      </Grid>
    </Section>
  );
};

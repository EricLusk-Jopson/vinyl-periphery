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
      .filter((release) =>
        Object.keys(release.contributorIds).some((id) =>
          isContributorActive(Number(id))
        )
      )
      .map((release) => {
        const { score, confidence } = calculateReleaseScore(release, {
          contributors: search.contributors,
        });
        return {
          ...release,
          score,
          confidence,
          activeContributors: Object.keys(release.contributorIds)
            .map(Number)
            .filter((id) => isContributorActive(id)),
        };
      })
      .sort((a, b) => b.score * b.confidence - a.score * a.confidence);
  }, [search, isContributorActive]);

  if (!search) return null;

  return (
    <Section>
      <SectionTitle>Filtered Releases</SectionTitle>
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
              {release.activeContributors
                .filter((id: number): id is number => id in search.contributors)
                .map((id: number) => search.contributors[id].name)
                .join(", ")}
            </ContributorList>
          </ReleaseCard>
        ))}
      </Grid>
    </Section>
  );
};

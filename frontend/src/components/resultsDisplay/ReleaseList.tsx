import {
  useCache,
  useFilteredAndScoredReleases,
} from "@/contexts/cache/CacheContext";
import { defaultContributorDisplayPipeline } from "@/lib/transformers/contributorProcessor";
import {
  ContributorList,
  ReleaseCard,
  ReleaseInfo,
  ReleaseTitle,
  Section,
  SectionTitle,
  Stack,
} from "./styles";

export const ReleaseList: React.FC<{ searchId: string }> = ({ searchId }) => {
  const { searches } = useCache();
  const { releases, count } = useFilteredAndScoredReleases(searchId);
  const search = searches[searchId];

  if (!search) return null;

  return (
    <Section>
      <SectionTitle>Filtered Releases ({count})</SectionTitle>
      <Stack>
        {releases.map((release) => (
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
              {Array.from(
                new Set(
                  release.activeContributors
                    .filter((id) => id in search.contributors)
                    .map((id) =>
                      defaultContributorDisplayPipeline(
                        search.contributors[id].name
                      )
                    )
                )
              ).join(", ")}
            </ContributorList>
          </ReleaseCard>
        ))}
      </Stack>
    </Section>
  );
};

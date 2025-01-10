import { useCache, useSearchFilters } from "../../contexts/cache/CacheContext";
import { defaultContributorDisplayPipeline } from "../../lib/transformers/contributorProcessor";
import { Section, SectionTitle, Grid, FilterToggle } from "./styles";

export const ContributorList: React.FC<{ searchId: string }> = ({
  searchId,
}) => {
  const { searches } = useCache();
  const { toggleContributor, isContributorActive, isContributorDisabled } =
    useSearchFilters(searchId);
  const search = searches[searchId];

  if (!search) return null;

  return (
    <Section>
      <SectionTitle>Contributors</SectionTitle>
      <Grid>
        {Object.entries(search.contributors).map(([idStr, contributor]) => {
          const id = Number(idStr);
          return (
            <FilterToggle
              key={id}
              onClick={() => toggleContributor(id)}
              $isActive={isContributorActive(id)}
              disabled={isContributorDisabled(id)}
            >
              {defaultContributorDisplayPipeline(contributor.name)}
            </FilterToggle>
          );
        })}
      </Grid>
    </Section>
  );
};

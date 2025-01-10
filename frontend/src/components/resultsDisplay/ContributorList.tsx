import { useCache, useSearchFilters } from "../../contexts/cache/CacheContext";
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
              {contributor.name}
              {/* <span style={{ fontSize: "0.8em", marginLeft: "8px" }}>
                ({contributor.roles.join(", ")})
              </span> */}
            </FilterToggle>
          );
        })}
      </Grid>
    </Section>
  );
};

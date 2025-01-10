import { useCache, useSearchFilters } from "../../contexts/cache/CacheContext";
import { defaultContributorDisplayPipeline } from "../../lib/transformers/contributorProcessor";
import { Tooltip } from "../common/Tooltip";
import { TooltipTitle, TooltipList } from "../common/Tooltip/styles";
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
          const name = defaultContributorDisplayPipeline(contributor.name);
          const tooltipContent = (
            <>
              <TooltipTitle>{name}</TooltipTitle>
              <TooltipList>
                {contributor.roles.sort().map((role) => (
                  <div key={role}>{role}</div>
                ))}
              </TooltipList>
            </>
          );

          return (
            <Tooltip
              key={id}
              content={tooltipContent}
              position="top"
              maxWidth="400px" // Increased to accommodate longer names
            >
              <FilterToggle
                onClick={() => toggleContributor(id)}
                $isActive={isContributorActive(id)}
                disabled={isContributorDisabled(id)}
              >
                {name}
              </FilterToggle>
            </Tooltip>
          );
        })}
      </Grid>
    </Section>
  );
};

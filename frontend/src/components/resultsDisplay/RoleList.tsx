import { useCache, useSearchFilters } from "../../contexts/cache/CacheContext";
import { defaultContributorDisplayPipeline } from "../../lib/transformers/contributorProcessor";
import { Tooltip } from "../common/Tooltip";
import { TooltipTitle, TooltipList } from "../common/Tooltip/styles";
import { Section, SectionTitle, Grid, FilterToggle } from "./styles";

export const RoleList: React.FC<{ searchId: string }> = ({ searchId }) => {
  const { searches } = useCache();
  const { toggleRole, isRoleActive, isRoleDisabled } =
    useSearchFilters(searchId);
  const search = searches[searchId];

  if (!search) return null;

  return (
    <Section>
      <SectionTitle>Roles</SectionTitle>
      <Grid>
        {Object.keys(search.roles).map((role) => {
          const tooltipContent = (
            <>
              <TooltipTitle>Contributors with role "{role}":</TooltipTitle>
              <TooltipList>
                {Object.values(search.contributors)
                  .filter((c) => c.roles.includes(role))
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((c) => (
                    <div key={c.name}>
                      {defaultContributorDisplayPipeline(c.name)}
                    </div>
                  ))}
              </TooltipList>
            </>
          );

          return (
            <Tooltip
              key={role}
              content={tooltipContent}
              position="top"
              maxWidth="500px"
              maxHeight="400px"
            >
              <FilterToggle
                key={role}
                onClick={() => toggleRole(role)}
                $isActive={isRoleActive(role)}
                disabled={isRoleDisabled(role)}
              >
                {role}
              </FilterToggle>
            </Tooltip>
          );
        })}
      </Grid>
    </Section>
  );
};

import { useCache, useSearchFilters } from "../../contexts/cache/CacheContext";
import { Section, SectionTitle, Grid, FilterToggle } from "./styles";

export const RoleList: React.FC<{ searchId: string }> = ({ searchId }) => {
  const { searches } = useCache();
  const { toggleRole, isRoleActive } = useSearchFilters(searchId);
  const search = searches[searchId];

  if (!search) return null;

  return (
    <Section>
      <SectionTitle>Roles</SectionTitle>
      <Grid>
        {Object.keys(search.roles).map((role) => (
          <FilterToggle
            key={role}
            onClick={() => toggleRole(role)}
            $isActive={isRoleActive(role)}
            disabled={!search.filterState.roles[role]}
          >
            {role}
          </FilterToggle>
        ))}
      </Grid>
    </Section>
  );
};

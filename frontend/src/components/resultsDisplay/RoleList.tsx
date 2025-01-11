// In RoleList.tsx
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Section, SectionTitle, Grid, FilterToggle } from "./styles";
import { useCache, useSearchFilters } from "@/contexts/cache/CacheContext";
import { defaultContributorDisplayPipeline } from "@/lib/transformers/contributorProcessor";

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
        <TooltipProvider>
          {Object.keys(search.roles).map((role) => {
            return (
              <Tooltip key={role} delayDuration={800}>
                <TooltipTrigger asChild>
                  <FilterToggle
                    onClick={() => toggleRole(role)}
                    $isActive={isRoleActive(role)}
                    disabled={isRoleDisabled(role)}
                  >
                    {role}
                  </FilterToggle>
                </TooltipTrigger>
                <TooltipContent className="max-w-[500px] max-h-[400px] overflow-y-auto">
                  <div className="flex flex-col gap-1">
                    {Object.values(search.contributors)
                      .filter((c) => c.roles.includes(role))
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((c) => (
                        <div key={c.name}>
                          {defaultContributorDisplayPipeline(c.name)}
                        </div>
                      ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </Grid>
    </Section>
  );
};

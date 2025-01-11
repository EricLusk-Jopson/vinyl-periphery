// In ContributorList.tsx
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Section, SectionTitle, Grid, FilterToggle } from "./styles";
import { useCache, useSearchFilters } from "@/contexts/cache/CacheContext";
import { defaultContributorDisplayPipeline } from "@/lib/transformers/contributorProcessor";

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
        <TooltipProvider>
          {Object.entries(search.contributors).map(([idStr, contributor]) => {
            const id = Number(idStr);
            const name = defaultContributorDisplayPipeline(contributor.name);

            return (
              <Tooltip key={id} delayDuration={500}>
                <TooltipTrigger asChild>
                  <FilterToggle
                    onClick={() => toggleContributor(id)}
                    $isActive={isContributorActive(id)}
                    disabled={isContributorDisabled(id)}
                  >
                    {name}
                  </FilterToggle>
                </TooltipTrigger>
                <TooltipContent className="max-w-[400px]">
                  <div className="flex flex-col gap-1">
                    {contributor.roles.sort().map((role) => (
                      <div key={role}>{role}</div>
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

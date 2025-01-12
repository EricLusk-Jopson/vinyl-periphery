import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCache, useSearchFilters } from "@/contexts/cache/CacheContext";
import { defaultContributorDisplayPipeline } from "@/lib/transformers/contributorProcessor";
import { FilterButton } from "../common/FilterButton";

export const ContributorList: React.FC<{ searchId: string }> = ({
  searchId,
}) => {
  const { searches } = useCache();
  const { toggleContributor, isContributorActive, isContributorDisabled } =
    useSearchFilters(searchId);
  const search = searches[searchId];

  if (!search) return null;

  return (
    <section className="w-full overflow-x-hidden bg-bg-secondary p-lg">
      <h2 className="font-primary text-lg tracking-normal text-text-primary mb-md">
        Contributors
      </h2>
      <div className="flex flex-wrap gap-md w-full">
        <TooltipProvider>
          {Object.entries(search.contributors).map(([idStr, contributor]) => {
            const id = Number(idStr);
            const name = defaultContributorDisplayPipeline(contributor.name);

            return (
              <Tooltip key={id} delayDuration={500}>
                <TooltipTrigger asChild>
                  <FilterButton
                    onClick={() => toggleContributor(id)}
                    isActive={isContributorActive(id)}
                    disabled={isContributorDisabled(id)}
                  >
                    {name}
                  </FilterButton>
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
      </div>
    </section>
  );
};

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCache, useSearchFilters } from "@/contexts/cache/CacheContext";
import { defaultContributorDisplayPipeline } from "@/lib/transformers/contributorProcessor";
import { FilterButton } from "../common/FilterButton";

export const RoleList: React.FC<{ searchId: string }> = ({ searchId }) => {
  const { searches } = useCache();
  const { toggleRole, isRoleActive, isRoleDisabled } =
    useSearchFilters(searchId);
  const search = searches[searchId];

  if (!search) return null;

  return (
    <section className="w-full overflow-x-hidden bg-bg-secondary p-[20px]">
      <h2 className="font-primary text-[1.5rem] tracking-[3px] text-text-primary mb-[15px]">
        Roles
      </h2>
      <div className="flex flex-wrap gap-[15px] w-full">
        <TooltipProvider>
          {Object.keys(search.roles).map((role) => (
            <Tooltip key={role} delayDuration={800}>
              <TooltipTrigger asChild>
                <FilterButton
                  onClick={() => toggleRole(role)}
                  isActive={isRoleActive(role)}
                  disabled={isRoleDisabled(role)}
                >
                  {role}
                </FilterButton>
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
          ))}
        </TooltipProvider>
      </div>
    </section>
  );
};

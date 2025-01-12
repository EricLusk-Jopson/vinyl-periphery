import { Button } from "@/components/ui/button";
import { useSearchFilters } from "@/contexts/cache/CacheContext";
import { cn } from "@/lib/utils";

export const FilterActions: React.FC<{ searchId: string }> = ({ searchId }) => {
  const {
    resetAllFilters,
    excludeAllRoles,
    excludeAllContributors,
    areAllRolesInactive,
    areAllContributorsInactive,
    toggleExcludeMainArtist,
    toggleCollaborationsOnly,
    filterState,
  } = useSearchFilters(searchId);

  return (
    <section className="flex flex-col gap-sm w-full bg-bg-secondary p-lg">
      <div className="flex flex-row gap-sm w-full flex-wrap">
        <Button variant="outline" onClick={resetAllFilters} className="w-fit">
          Reset All Filters
        </Button>
        <Button
          variant="outline"
          onClick={excludeAllRoles}
          disabled={areAllContributorsInactive()}
          className="w-fit"
        >
          Exclude All Roles
        </Button>
        <Button
          variant="outline"
          onClick={excludeAllContributors}
          disabled={areAllRolesInactive()}
          className="w-fit"
        >
          Exclude All Contributors
        </Button>
      </div>
      <div className="flex flex-row gap-sm w-full flex-wrap mt-sm">
        <Button
          variant="outline"
          onClick={toggleExcludeMainArtist}
          className={cn(
            "w-fit",
            filterState?.excludeMainArtist &&
              "bg-primary-main text-white hover:bg-primary-main/90"
          )}
        >
          Exclude Main Artist
        </Button>
        <Button
          variant="outline"
          onClick={toggleCollaborationsOnly}
          className={cn(
            "w-fit",
            filterState?.collaborationsOnly &&
              "bg-primary-main text-white hover:bg-primary-main/90"
          )}
        >
          Collaborations Only
        </Button>
      </div>
    </section>
  );
};

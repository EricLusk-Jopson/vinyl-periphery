import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useCache,
  useFilteredAndScoredReleases,
} from "@/contexts/cache/CacheContext";
import { defaultContributorDisplayPipeline } from "@/lib/transformers/contributorProcessor";

export const ReleaseList: React.FC<{ searchId: string }> = ({ searchId }) => {
  const { searches } = useCache();
  const { releases, count } = useFilteredAndScoredReleases(searchId);
  const search = searches[searchId];

  if (!search) return null;

  return (
    <section className="w-full bg-bg-primary bg-opacity-40 p-4 sm:p-lg">
      <span className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-0 mt-4 mb-6">
        <h2 className="font-primary text-base sm:text-lg tracking-normal text-text-primary w-9/12">
          <span className="line-clamp-1">{search.searchParams.album}</span>
        </h2>
        <h2 className="font-primary text-base sm:text-lg tracking-normal text-text-primary whitespace-nowrap">
          {count} Filtered Releases
        </h2>
      </span>
      <div className="flex flex-col p-2 sm:p-md gap-5">
        {releases.map((release) => (
          <Card
            key={release.id}
            className="w-full sm:max-w-[90%] lg:max-w-[80%] mx-auto border-primary-main bg-bg-primary"
          >
            <CardHeader className="pb-0">
              <CardTitle className="font-primary text-sm sm:text-md tracking-normal text-text-primary mb-sm">
                <div className="flex flex-col sm:flex-row justify-between gap-1 sm:gap-4">
                  <div>
                    <div className="truncate text-wrap">{release.title}</div>
                    <div className="truncate">{release.artist}</div>
                  </div>

                  <span className="whitespace-nowrap hidden md:inline">
                    Match Score:{" "}
                    {(100 * release.score * release.confidence).toFixed(0)}%
                  </span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-text-secondary font-secondary text-xs sm:text-sm mt-2">
                <span className="font-medium">Active Contributors: </span>
                <span className="line-clamp-2">
                  {Array.from(
                    new Set(
                      release.activeContributors
                        .filter((id) => id in search.contributors)
                        .map((id) =>
                          defaultContributorDisplayPipeline(
                            search.contributors[id].name
                          )
                        )
                    )
                  ).join(", ")}
                </span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

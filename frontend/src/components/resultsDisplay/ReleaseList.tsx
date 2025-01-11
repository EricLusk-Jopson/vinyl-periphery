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
    <section className="w-full bg-bg-secondary p-lg">
      <h2 className="font-primary text-lg tracking-normal text-text-primary mb-md">
        Filtered Releases ({count})
      </h2>
      <div className="flex flex-col p-md gap-md">
        {releases.map((release) => (
          <Card
            key={release.id}
            className="max-w-[80%] w-[1000px] mx-auto border-primary-main bg-bg-primary"
          >
            <CardHeader className="pb-0">
              <CardTitle className="font-primary text-md tracking-normal text-text-primary mb-sm flex justify-between">
                <span>
                  {release.artist} - {release.title}{" "}
                </span>
                <span>
                  {(release.score * 100).toFixed(0)} /
                  {(release.confidence * 100).toFixed(0)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-sm">
              <p className="text-text-secondary font-secondary text-sm mt-md">
                Active Contributors:{" "}
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
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

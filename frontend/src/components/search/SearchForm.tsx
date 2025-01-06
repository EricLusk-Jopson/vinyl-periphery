import React, { useState, useMemo } from "react";
import {
  SearchFormContainer,
  Form,
  InputGroup,
  Label,
  Input,
  SubmitButton,
  ResultItem,
  ResultMeta,
  ResultTitle,
  ResultsList,
} from "./styles";
import {
  useDiscogsSearch,
  useListReleaseContributors,
  useListContributorReleases,
} from "../../api/mutations";
import { SearchResults } from "./SearchResults";
import { ContributorSet, EnrichedRelease } from "../../api/types";
import {
  calculateReleaseScore,
  getContributorConfidence,
} from "../../api/contributorSet";

type SortField = "contributors" | "year" | "title";
type SortOrder = "asc" | "desc";

interface SortConfig {
  field: SortField;
  order: SortOrder;
}

export const SearchForm: React.FC = () => {
  const [formData, setFormData] = useState({
    artist: "",
    album: "",
  });

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: "contributors",
    order: "desc",
  });

  const [filterYear, setFilterYear] = useState<string>("");
  const [contributorSet, setContributorSet] = useState<ContributorSet | null>(
    null
  );

  const {
    mutateAsync: mutateDiscogsSearch,
    data: searchResults,
    ...discogsSearch
  } = useDiscogsSearch();

  const { mutateAsync: mutateListReleases, isPending: isLoadingContributors } =
    useListReleaseContributors();

  const {
    mutateAsync: mutateListContributorReleases,
    data: contributorReleases,
    isPending: isLoadingReleases,
  } = useListContributorReleases();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const results = await mutateDiscogsSearch({
        artist: formData.artist,
        album: formData.album,
      });

      if (results) {
        const contributors = await mutateListReleases({
          releases: results,
          maxReleases: 5,
        });

        setContributorSet(contributors);

        if (contributors) {
          await mutateListContributorReleases({
            contributorSet: contributors,
          });
        }
      }
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  const handleSortChange = (field: SortField) => {
    setSortConfig((prev) => ({
      field,
      order: prev.field === field && prev.order === "desc" ? "asc" : "desc",
    }));
  };

  console.log(contributorReleases);

  const sortedReleases = useMemo(() => {
    if (!contributorReleases || !contributorSet) return [];

    const releasesArray = Array.from(contributorReleases.entries()).map(
      ([, release]) => {
        const { score, confidence } = calculateReleaseScore(
          release,
          contributorSet
        );
        return {
          ...release,
          score,
          confidence,
          totalContributors: release.contributorIds.size,
        };
      }
    );

    const filteredReleases = filterYear
      ? releasesArray.filter((release) => release.year === filterYear)
      : releasesArray;

    return filteredReleases.sort((a, b) => {
      const sortMultiplier = sortConfig.order === "desc" ? -1 : 1;

      switch (sortConfig.field) {
        case "contributors": {
          // Sort by weighted score (number of contributors * confidence)
          const aValue = a.totalContributors * a.score;
          const bValue = b.totalContributors * b.score;
          return sortMultiplier * (aValue - bValue);
        }
        case "year":
          return sortMultiplier * (parseInt(a.year) - parseInt(b.year));
        case "title":
          return sortMultiplier * a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
  }, [contributorReleases, sortConfig, filterYear, contributorSet]);

  const uniqueYears = useMemo(() => {
    if (!contributorReleases) return new Set<string>();
    return new Set(
      Array.from(contributorReleases.values()).map((release) => release.year)
    );
  }, [contributorReleases]);

  const renderContributorInfo = (release: EnrichedRelease) => {
    if (!contributorSet) return null;

    if (release.contributorIds.size === 0) return null;

    return (
      <div className="mt-2">
        <span className="font-bold">Contributors:</span>{" "}
        {Array.from(release.contributorIds)
          .map((id) => {
            const contributor = contributorSet.contributors.get(id);
            if (!contributor) return null;
            return contributor.name;
          })
          .filter(Boolean)
          .join(", ")}
      </div>
    );
  };

  console.log(sortedReleases);

  const renderContributorReleases = () => {
    // if (!contributorReleases || !contributorSet) return null;

    return (
      <div>
        <ResultTitle as="h2">Shared Albums</ResultTitle>

        <div className="flex gap-4 mb-4">
          <button
            onClick={() => handleSortChange("contributors")}
            type="button"
            className={`px-3 py-1 rounded ${
              sortConfig.field === "contributors"
                ? "bg-blue-500 text-white"
                : "bg-gray-200"
            }`}
          >
            Sort by Contributors{" "}
            {sortConfig.field === "contributors" &&
              (sortConfig.order === "desc" ? "↓" : "↑")}
          </button>
          <button
            onClick={() => handleSortChange("year")}
            type="button"
            className={`px-3 py-1 rounded ${
              sortConfig.field === "year"
                ? "bg-blue-500 text-white"
                : "bg-gray-200"
            }`}
          >
            Sort by Year{" "}
            {sortConfig.field === "year" &&
              (sortConfig.order === "desc" ? "↓" : "↑")}
          </button>
          <button
            onClick={() => handleSortChange("title")}
            type="button"
            className={`px-3 py-1 rounded ${
              sortConfig.field === "title"
                ? "bg-blue-500 text-white"
                : "bg-gray-200"
            }`}
          >
            Sort by Title{" "}
            {sortConfig.field === "title" &&
              (sortConfig.order === "desc" ? "↓" : "↑")}
          </button>

          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="px-3 py-1 rounded border"
          >
            <option value="">All Years</option>
            {Array.from(uniqueYears)
              .sort()
              .map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
          </select>
        </div>

        <ResultsList>
          {sortedReleases.map((release) => (
            <ResultItem key={release.id}>
              <ResultTitle>{release.title}</ResultTitle>
              <ResultMeta>
                Artist: {release.artist} • Year: {release.year}
              </ResultMeta>
              <ResultMeta>
                Similarity Score: {(release.score * 100).toFixed(1)}%
              </ResultMeta>
              <ResultMeta>
                Confidence Score: {(release.confidence * 100).toFixed(1)}%
              </ResultMeta>
              {renderContributorInfo(release)}
            </ResultItem>
          ))}
        </ResultsList>
      </div>
    );
  };

  return (
    <SearchFormContainer>
      <Form onSubmit={handleSubmit}>
        <InputGroup>
          <Label htmlFor="artist">Artist</Label>
          <Input
            id="artist"
            name="artist"
            value={formData.artist}
            onChange={handleChange}
            placeholder="Enter artist name"
            required
            autoComplete="off"
          />
        </InputGroup>

        <InputGroup>
          <Label htmlFor="album">Album</Label>
          <Input
            id="album"
            name="album"
            value={formData.album}
            onChange={handleChange}
            placeholder="Enter album name"
            required
            autoComplete="off"
          />
        </InputGroup>

        <SubmitButton
          type="submit"
          disabled={
            discogsSearch.isPending ||
            isLoadingContributors ||
            isLoadingReleases
          }
        >
          {discogsSearch.isPending || isLoadingContributors || isLoadingReleases
            ? "Searching..."
            : "Search"}
        </SubmitButton>

        {renderContributorReleases()}

        {contributorSet && (
          <ResultsList>
            <ResultTitle as="h2">Found Contributors</ResultTitle>
            {Array.from(contributorSet.contributors.values()).map(
              (contributor) => (
                <ResultItem key={contributor.id}>
                  <ResultTitle>{contributor.name}</ResultTitle>
                  {/* <ResultMeta>
                    Roles: {Array.from(contributor.roles).join(", ")}
                  </ResultMeta> */}
                  <ResultMeta>
                    Source: {Array.from(contributor.sources).join(", ")}
                  </ResultMeta>
                  <ResultMeta>
                    Confidence:{" "}
                    {(getContributorConfidence(contributor) * 100).toFixed(1)}%
                  </ResultMeta>
                </ResultItem>
              )
            )}
          </ResultsList>
        )}

        <SearchResults results={searchResults} />
      </Form>
    </SearchFormContainer>
  );
};

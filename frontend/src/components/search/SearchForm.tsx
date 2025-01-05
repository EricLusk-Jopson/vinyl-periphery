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

  const {
    mutateAsync: mutateDiscogsSearch,
    data: searchResults,
    ...discogsSearch
  } = useDiscogsSearch();

  const { mutateAsync: mutateListReleases, data: releaseContributors } =
    useListReleaseContributors();

  const {
    mutateAsync: mutateListContributorReleases,
    data: contributorReleases,
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

        if (contributors) {
          await mutateListContributorReleases({
            contributors,
          });
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleSortChange = (field: SortField) => {
    setSortConfig((prev) => ({
      field,
      order: prev.field === field && prev.order === "desc" ? "asc" : "desc",
    }));
  };

  const sortedReleases = useMemo(() => {
    if (!contributorReleases) return [];

    const releasesArray = Array.from(contributorReleases.entries()).map(
      ([id, release]) => ({
        ...release,
        contributorCount: release.contributorIds.size,
      })
    );

    const filteredReleases = filterYear
      ? releasesArray.filter((release) => release.year === filterYear)
      : releasesArray;

    return filteredReleases.sort((a, b) => {
      const sortMultiplier = sortConfig.order === "desc" ? -1 : 1;

      switch (sortConfig.field) {
        case "contributors":
          return sortMultiplier * (a.contributorCount - b.contributorCount);
        case "year":
          return sortMultiplier * (parseInt(a.year) - parseInt(b.year));
        case "title":
          return sortMultiplier * a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
  }, [contributorReleases, sortConfig, filterYear]);

  const uniqueYears = useMemo(() => {
    if (!contributorReleases) return new Set<string>();
    return new Set(
      Array.from(contributorReleases.values()).map((release) => release.year)
    );
  }, [contributorReleases]);

  const renderContributorReleases = () => {
    // if (!sortedReleases.length) return null;

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
                Shared Contributors ({release.contributorIds.size}):{" "}
                {Array.from(release.contributorIds)
                  .map(
                    (id) => releaseContributors?.find((c) => c.id === id)?.name
                  )
                  .filter(Boolean)
                  .join(", ")}
              </ResultMeta>
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

        <SubmitButton type="submit" disabled={discogsSearch.isPending}>
          {discogsSearch.isPending ? "Searching..." : "Search"}
        </SubmitButton>

        {renderContributorReleases()}

        <ResultsList>
          {releaseContributors?.map((contributor) => (
            <ResultItem key={contributor.id}>
              <ResultTitle>{contributor.name}</ResultTitle>
              <ResultMeta>{contributor.roles.join(", ")}</ResultMeta>
            </ResultItem>
          ))}
        </ResultsList>

        <SearchResults results={searchResults} />
      </Form>
    </SearchFormContainer>
  );
};

import React, { useState } from "react";
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
} from "../../api/mutations";
import { SearchResults } from "./SearchResults";

export const SearchForm: React.FC = () => {
  const [formData, setFormData] = useState({
    artist: "",
    album: "",
  });

  const {
    mutateAsync: mutateDiscogsSearch,
    data: searchResults,
    ...discogsSearch
  } = useDiscogsSearch();

  const { mutateAsync: mutateListReleases, data: releaseContributors } =
    useListReleaseContributors();

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
        await mutateListReleases({
          releases: results,
          maxReleases: 5,
        });
      }
      // TODO: Need Better Error Handling
    } catch (error) {
      console.log(error);
      // Handle error appropriately
    }
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
        {/* 
        {discogsSearch.isError && (
          <ErrorMessage>
            {formError instanceof Error
              ? formError.message
              : "An error occurred"}
          </ErrorMessage>
        )} */}
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

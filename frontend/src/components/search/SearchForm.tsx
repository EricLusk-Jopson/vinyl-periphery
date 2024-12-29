import React, { useState } from "react";
import {
  SearchFormContainer,
  Form,
  InputGroup,
  Label,
  Input,
  SubmitButton,
  ErrorMessage,
} from "./styles";
import { useReleaseSearch } from "../../api/mutations";
import { SearchResults } from "./SearchResults";

export const SearchForm: React.FC = () => {
  const [formData, setFormData] = useState({
    artist: "",
    album: "",
  });

  const {
    mutate,
    data: searchResults,
    isPending,
    isError,
    error,
  } = useReleaseSearch();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    mutate({ artist: formData.artist, album: formData.album });
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

        <SubmitButton type="submit" disabled={isPending}>
          {isPending ? "Searching..." : "Search"}
        </SubmitButton>

        {isError && (
          <ErrorMessage>
            {error instanceof Error ? error.message : "An error occurred"}
          </ErrorMessage>
        )}

        <SearchResults results={searchResults} />
      </Form>
    </SearchFormContainer>
  );
};

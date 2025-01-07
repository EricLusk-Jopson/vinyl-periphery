import React, { useState } from "react";
import { SearchParams } from "../../api/types";
import {
  Form,
  Input,
  InputGroup,
  Label,
  SearchingIndicator,
  SubmitButton,
} from "./styles";
import { SearchFormProps } from "./types";

export const SearchForm: React.FC<SearchFormProps> = ({
  onSearch,
  isSearching,
}) => {
  const [formData, setFormData] = useState<SearchParams>({
    artist: "",
    album: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.artist.trim() || !formData.album.trim()) return;

    try {
      await onSearch(formData);
    } catch (error) {
      // Error handling is done at the App level
      console.error("Search error:", error);
    }
  };

  return (
    <Form onSubmit={handleSubmit} aria-busy={isSearching}>
      <InputGroup>
        <Label htmlFor="artist">Artist</Label>
        <Input
          id="artist"
          name="artist"
          value={formData.artist}
          onChange={handleChange}
          placeholder="Enter artist name"
          disabled={isSearching}
          required
          autoComplete="off"
          aria-label="Artist name"
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
          disabled={isSearching}
          required
          autoComplete="off"
          aria-label="Album name"
        />
      </InputGroup>

      <SubmitButton
        type="submit"
        disabled={isSearching}
        $isSearching={isSearching}
        aria-label={isSearching ? "Searching..." : "Search"}
      >
        {isSearching ? "Searching..." : "Search"}
      </SubmitButton>

      {isSearching && (
        <SearchingIndicator>
          Searching through album credits... This may take a moment.
        </SearchingIndicator>
      )}
    </Form>
  );
};

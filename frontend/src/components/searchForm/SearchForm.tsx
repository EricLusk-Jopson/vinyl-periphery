import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchParams, SearchStage } from "../../api/types";
import { SearchFormProps } from "./types";
import { cn } from "@/lib/utils";
import ProgressButton from "../common/ProgressButton";

export const SearchForm: React.FC<SearchFormProps> = ({
  onSearch,
  isSearching,
}) => {
  const [formData, setFormData] = useState<SearchParams>({
    artist: "",
    album: "",
  });
  const [currentStage, setCurrentStage] = useState<SearchStage | null>(null);

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
      await onSearch(formData, setCurrentStage);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setCurrentStage(null);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={isSearching}
      className="grid gap-md max-w-[600px] mx-auto my-2xl p-lg bg-bg-secondary"
    >
      <div className="grid gap-sm">
        <Label
          htmlFor="artist"
          className="text-text-primary text-sm font-secondary tracking-normal"
        >
          Artist
        </Label>
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
          className={cn(
            "bg-bg-primary text-text-primary text-md font-secondary w-full",
            "border-primary-main focus:border-primary-dark",
            "placeholder:text-text-secondary"
          )}
        />
      </div>

      <div className="grid gap-sm">
        <Label
          htmlFor="album"
          className="text-text-primary text-sm font-secondary tracking-normal"
        >
          Album
        </Label>
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
          className={cn(
            "bg-bg-primary text-text-primary text-md font-secondary w-full",
            "border-primary-main focus:border-primary-dark",
            "placeholder:text-text-secondary"
          )}
        />
      </div>

      <ProgressButton
        stage={currentStage}
        isSearching={isSearching}
        disabled={!formData.artist.trim() || !formData.album.trim()}
      />
    </form>
  );
};

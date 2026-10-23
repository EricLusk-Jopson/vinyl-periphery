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
      setFormData({ artist: "", album: "" });
    }
  };

  // Common input classes for consistency
  const inputClasses = cn(
    "bg-bg-primary text-text-primary text-[1.2rem] font-secondary w-full",
    "border-primary-main focus:border-primary-main ",
    "placeholder:text-text-secondary"
  );

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={isSearching}
      className="grid gap-[50px] w-full max-w-[800px] mx-auto p-[20px] bg-bg-primary bg-opacity-60 overflow-hidden"
    >
      <div className="grid gap-[15px] w-full">
        <Label
          htmlFor="artist"
          className="text-text-primary text-[1.5rem] font-secondary tracking-[3px]"
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
          className={inputClasses}
        />
      </div>

      <div className="grid gap-[15px] w-full">
        <Label
          htmlFor="album"
          className="text-text-primary text-[1.5rem] font-secondary tracking-[3px]"
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
          className={inputClasses}
        />
      </div>

      <div className="w-full">
        <ProgressButton
          stage={currentStage}
          isSearching={isSearching}
          disabled={!formData.artist.trim() || !formData.album.trim()}
          className="w-full "
        />
      </div>
    </form>
  );
};

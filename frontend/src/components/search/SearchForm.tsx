import React, { useId, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { SearchParams, SearchStage } from "@/api/types";
import { cn } from "@/lib/utils";

export interface SearchFormProps {
  variant: "hero" | "compact";
  values: SearchParams;
  onValuesChange: (values: SearchParams) => void;
  onSearch: (
    params: SearchParams,
    onProgress?: (stage: SearchStage) => void
  ) => Promise<void>;
  isSearching: boolean;
  autoFocus?: boolean;
}

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

const inputBase = cn(
  "w-full rounded-lg border border-border-strong text-base text-foreground placeholder:text-faint",
  "transition-colors disabled:cursor-not-allowed disabled:opacity-60",
  focusRing
);

const submitBase = cn(
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground",
  "transition-colors hover:bg-primary-dark active:bg-primary-dark",
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-primary",
  focusRing
);

const stageText = (stage: SearchStage | null) => {
  if (!stage) return "Searching";
  if (stage.total === 0) return stage.label;
  return `${stage.label} (${Math.round((100 * stage.current) / stage.total)}%)`;
};

/**
 * Artist and album search. `hero` is the large form on the home page, with
 * labels above the inputs and the search hint. `compact` sits in the header
 * once results are showing: two inputs and an icon button.
 */
export const SearchForm = React.forwardRef<HTMLFormElement, SearchFormProps>(
  (
    { variant, values, onValuesChange, onSearch, isSearching, autoFocus },
    ref
  ) => {
    const id = useId();
    const artistId = `${id}-artist`;
    const albumId = `${id}-album`;
    const hintId = `${id}-hint`;
    const [stage, setStage] = useState<SearchStage | null>(null);

    const canSubmit =
      values.artist.trim() !== "" && values.album.trim() !== "";

    // Empty fields are caught by the browser's `required` check, which says
    // what is missing, so the button stays enabled until a search starts.

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      onValuesChange({ ...values, [name]: value });
    };

    // The inputs keep their values afterwards, so a failed search can be
    // retried and the compact form shows what was searched.
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit || isSearching) return;

      try {
        await onSearch(
          { artist: values.artist.trim(), album: values.album.trim() },
          setStage
        );
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setStage(null);
      }
    };

    if (variant === "compact") {
      return (
        <form
          ref={ref}
          role="search"
          aria-label="New search"
          aria-busy={isSearching}
          onSubmit={handleSubmit}
          className="flex items-center gap-2"
        >
          <label htmlFor={artistId} className="sr-only">
            Artist
          </label>
          <input
            id={artistId}
            name="artist"
            value={values.artist}
            onChange={handleChange}
            placeholder="Artist"
            autoComplete="off"
            required
            disabled={isSearching}
            className={cn(inputBase, "h-11 w-48 bg-surface px-3 text-[15px]")}
          />
          <label htmlFor={albumId} className="sr-only">
            Album
          </label>
          <input
            id={albumId}
            name="album"
            value={values.album}
            onChange={handleChange}
            placeholder="Album"
            autoComplete="off"
            required
            disabled={isSearching}
            className={cn(inputBase, "h-11 w-56 bg-surface px-3 text-[15px]")}
          />
          <button
            type="submit"
            disabled={isSearching}
            aria-label={isSearching ? "Searching" : "Find connections"}
            className={cn(submitBase, "h-11 w-11 shrink-0")}
          >
            {isSearching ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </form>
      );
    }

    return (
      <form
        ref={ref}
        aria-label="Find connections"
        aria-busy={isSearching}
        onSubmit={handleSubmit}
        className={cn(
          "flex flex-col gap-3.5",
          "md:flex-row md:flex-wrap md:items-end md:gap-4 md:rounded-xl md:border md:bg-surface md:p-5"
        )}
      >
        <div className="flex flex-col gap-1.5 md:flex-[1_1_260px] md:gap-2">
          <label
            htmlFor={artistId}
            className="text-[13px] font-medium text-muted-foreground"
          >
            Artist
          </label>
          <input
            id={artistId}
            name="artist"
            value={values.artist}
            onChange={handleChange}
            placeholder="e.g. Pink Floyd"
            autoComplete="off"
            autoFocus={autoFocus}
            required
            disabled={isSearching}
            aria-describedby={hintId}
            className={cn(inputBase, "h-12 bg-surface px-3.5 md:bg-background")}
          />
        </div>
        <div className="flex flex-col gap-1.5 md:flex-[1_1_260px] md:gap-2">
          <label
            htmlFor={albumId}
            className="text-[13px] font-medium text-muted-foreground"
          >
            Album
          </label>
          <input
            id={albumId}
            name="album"
            value={values.album}
            onChange={handleChange}
            placeholder="e.g. The Dark Side of the Moon"
            autoComplete="off"
            required
            disabled={isSearching}
            aria-describedby={hintId}
            className={cn(inputBase, "h-12 bg-surface px-3.5 md:bg-background")}
          />
        </div>
        <button
          type="submit"
          disabled={isSearching}
          className={cn(
            submitBase,
            "h-[52px] px-5 text-base md:h-12 md:flex-[1_1_160px] lg:max-w-[260px]"
          )}
        >
          {isSearching ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
          ) : (
            <Search className="h-[18px] w-[18px]" aria-hidden="true" />
          )}
          <span className="truncate">
            {isSearching ? stageText(stage) : "Find connections"}
          </span>
        </button>
        <p
          id={hintId}
          className="font-mono text-xs leading-normal text-faint md:basis-full"
        >
          A full search takes 1 to 3 minutes. Discogs limits how quickly we can
          read its data.
        </p>
        <p className="sr-only" role="status" aria-live="polite">
          {isSearching ? stageText(stage) : ""}
        </p>
      </form>
    );
  }
);
SearchForm.displayName = "SearchForm";

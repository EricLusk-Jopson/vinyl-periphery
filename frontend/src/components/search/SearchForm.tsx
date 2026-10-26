import React, { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { SearchParams } from "@/api/types";
import { cn } from "@/lib/utils";

export interface SearchFormProps {
  variant: "hero" | "compact";
  values: SearchParams;
  onValuesChange: (values: SearchParams) => void;
  /** Starts a search. Progress is shown by SearchProgress, not the form. */
  onSearch: (params: SearchParams) => void;
  isSearching: boolean;
  autoFocus?: boolean;
  /**
   * Goes up each time a search fails before the album is found. The button
   * jiggles and takes focus back (it was disabled while searching).
   */
  failedAttempt?: number;
  /** The hero button's text while a search runs. */
  busyLabel?: string;
}

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

const inputBase = cn(
  "w-full rounded-lg border border-border-strong text-base text-foreground placeholder:text-faint",
  "transition-colors disabled:cursor-not-allowed disabled:opacity-60",
  focusRing,
);

const submitBase = cn(
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground",
  "transition-colors hover:bg-primary-dark active:bg-primary-dark",
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-primary",
  focusRing,
);

/**
 * Artist and album search. `hero` is the large form on the home page, with
 * labels above the inputs and the search hint. `compact` sits in the header
 * once results are showing: two inputs and an icon button.
 */
export const SearchForm = React.forwardRef<HTMLFormElement, SearchFormProps>(
  (
    {
      variant,
      values,
      onValuesChange,
      onSearch,
      isSearching,
      autoFocus,
      failedAttempt = 0,
      busyLabel = "Finding the album",
    },
    ref,
  ) => {
    const id = useId();
    const artistId = `${id}-artist`;
    const albumId = `${id}-album`;
    const hintId = `${id}-hint`;
    const submitRef = useRef<HTMLButtonElement>(null);
    const [shaking, setShaking] = useState(false);

    useEffect(() => {
      if (failedAttempt === 0) return;
      setShaking(true);
      submitRef.current?.focus();
    }, [failedAttempt]);
    const shakeProps = {
      ref: submitRef,
      onAnimationEnd: () => setShaking(false),
    };

    const canSubmit = values.artist.trim() !== "" && values.album.trim() !== "";

    // Empty fields are caught by the browser's `required` check, which says
    // what is missing, so the button stays enabled until a search starts.

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      onValuesChange({ ...values, [name]: value });
    };

    // The inputs keep their values afterwards, so a failed search can be
    // retried and the compact form shows what was searched.
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit || isSearching) return;
      onSearch({ artist: values.artist.trim(), album: values.album.trim() });
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
            className={cn(
              inputBase,
              "h-11 w-36 bg-surface px-3 text-[15px] lg:w-48",
            )}
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
            className={cn(
              inputBase,
              "h-11 w-44 bg-surface px-3 text-[15px] lg:w-56",
            )}
          />
          <button
            type="submit"
            disabled={isSearching}
            aria-label={isSearching ? "Searching" : "Find connections"}
            className={cn(
              submitBase,
              "h-11 w-11 shrink-0",
              shaking && "animate-shake",
            )}
            {...shakeProps}
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
          "flex flex-col gap-3",
          "md:flex-row md:flex-wrap md:items-end md:gap-4 md:rounded-xl md:border md:bg-surface md:p-5",
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
            "h-12 px-5 text-base md:flex-[1_1_160px] lg:max-w-[260px]",
            shaking && "animate-shake",
          )}
          {...shakeProps}
        >
          {isSearching ? (
            <Loader2
              className="h-[18px] w-[18px] animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Search className="h-[18px] w-[18px]" aria-hidden="true" />
          )}
          <span className="truncate">
            {isSearching ? busyLabel : "Find connections"}
          </span>
        </button>
        <p
          id={hintId}
          className="hidden font-mono text-xs leading-normal text-faint md:block md:basis-full"
        >
          {/* Off on phones to keep the form compact. Still read out via
              aria-describedby, which works on hidden elements. */}
          A full search takes 1 to 3 minutes. Discogs limits how quickly we can
          read its data.
        </p>
      </form>
    );
  },
);
SearchForm.displayName = "SearchForm";

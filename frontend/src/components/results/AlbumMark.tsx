import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Heart,
  HeartOff,
  Layers,
  Loader2,
  MoreHorizontal,
  Search,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

const itemClass = cn(
  "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60",
  focusRing,
);

interface AlbumMarkProps {
  title: string;
  liked: boolean;
  /** Hidden wins: a hidden album isn't liked. */
  hidden: boolean;
  onLike: (liked: boolean) => void;
  onHide: (hidden: boolean) => void;
  /** Searches from this album (joins this page's stack). */
  onSearchFrom: () => void;
  /** A search is under way: no other can start. */
  searching: boolean;
  /** This row started the search under way. */
  searchingFromHere: boolean;
  /**
   * This album's own search, when it's already been run: the menu opens
   * it instead, and offers Stack it when it's outside this stack.
   */
  existing?: {
    to: string;
    state: unknown;
    onOpen: () => void;
    onStack?: () => void;
  };
}

type Mark = "none" | "liked" | "hidden";

/**
 * One quiet slot at the end of a result row. It shows the album's mark
 * ("⋯" for none, a filled heart when liked, a crossed-out eye when
 * hidden) and always opens the row's menu: Search from this album (or
 * Open your search, and Stack it), then Like or Unlike, Hide or Show
 * again. The icons cross-fade in place, so the row never shifts.
 */
export const AlbumMark: React.FC<AlbumMarkProps> = ({
  title,
  liked,
  hidden,
  onLike,
  onHide,
  onSearchFrom,
  searching,
  searchingFromHere,
  existing,
}) => {
  const mark: Mark = hidden ? "hidden" : liked ? "liked" : "none";
  const [menuOpen, setMenuOpen] = useState(false);

  const label =
    mark === "liked"
      ? `${title}: liked. More`
      : mark === "hidden"
        ? `${title}: hidden. More`
        : `More for ${title}`;

  const icon = (shown: Mark, child: React.ReactNode) => (
    <span
      aria-hidden="true"
      className={cn(
        "absolute inset-0 flex items-center justify-center transition-opacity duration-200",
        mark === shown ? "opacity-100" : "opacity-0",
      )}
    >
      {child}
    </span>
  );

  const choose = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  return (
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className={cn(
            // No fill of its own: hover and press change the icon only.
            "group/mark relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg md:mr-1",
            focusRing,
          )}
        >
          <span className="relative h-5 w-5 transition-transform duration-150 group-active/mark:scale-90">
            {icon(
              "none",
              <MoreHorizontal className="h-5 w-5 text-faint transition-colors group-hover/mark:text-foreground" />,
            )}
            {icon(
              "liked",
              <Heart className="h-5 w-5 fill-primary text-primary" />,
            )}
            {icon("hidden", <EyeOff className="h-5 w-5 text-foreground" />)}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1">
        <div role="menu" aria-label={title} className="flex flex-col">
          {existing ? (
            <>
              <Link
                to={existing.to}
                state={existing.state}
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  existing.onOpen();
                }}
                className={itemClass}
              >
                <ArrowRight
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Open your search
              </Link>
              {existing.onStack && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => choose(existing.onStack!)}
                  className={itemClass}
                >
                  <Layers
                    className="h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Stack it…
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              role="menuitem"
              disabled={searching}
              onClick={() => choose(onSearchFrom)}
              className={itemClass}
            >
              {searchingFromHere ? (
                <Loader2
                  className="h-4 w-4 animate-spin text-muted-foreground"
                  aria-hidden="true"
                />
              ) : (
                <Search
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              {searchingFromHere
                ? "Finding the album"
                : "Search from this album"}
            </button>
          )}
          <div className="my-1 border-t" role="separator" />
          {mark !== "hidden" && (
            <button
              type="button"
              role="menuitem"
              onClick={() => choose(() => onLike(!liked))}
              className={itemClass}
            >
              {liked ? (
                <HeartOff
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
              ) : (
                <Heart
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              {liked ? "Unlike" : "Like"}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(() => onHide(!hidden))}
            className={itemClass}
          >
            {hidden ? (
              <Eye
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
            ) : (
              <EyeOff
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
            )}
            {hidden ? "Show again" : "Hide"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

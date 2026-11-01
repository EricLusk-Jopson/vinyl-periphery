import React, { useState } from "react";
import { EyeOff, Heart, MoreHorizontal } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

interface AlbumMarkProps {
  title: string;
  liked: boolean;
  /** Hidden wins: a hidden album isn't liked. */
  hidden: boolean;
  onLike: (liked: boolean) => void;
  onHide: (hidden: boolean) => void;
}

type Mark = "none" | "liked" | "hidden";

/**
 * One quiet slot at the end of a result row, instead of a heart and an eye
 * side by side. Unmarked, it's "⋯", opening Like and Hide. Liked, it's a
 * filled heart; hidden, a crossed-out eye; tapping either takes the mark
 * off. The icons cross-fade in place, so the row never shifts.
 */
export const AlbumMark: React.FC<AlbumMarkProps> = ({
  title,
  liked,
  hidden,
  onLike,
  onHide,
}) => {
  const mark: Mark = hidden ? "hidden" : liked ? "liked" : "none";
  const [menuOpen, setMenuOpen] = useState(false);

  const label =
    mark === "liked"
      ? `Unlike ${title}`
      : mark === "hidden"
        ? `Show ${title} again`
        : `Like or hide ${title}`;

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
    <Popover
      // Only the "⋯" opens the menu; a heart or an eye is a toggle.
      open={menuOpen && mark === "none"}
      onOpenChange={(next) => setMenuOpen(next && mark === "none")}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          onClick={() => {
            if (mark === "liked") onLike(false);
            if (mark === "hidden") onHide(false);
          }}
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
      <PopoverContent align="end" className="w-44 p-1">
        <div role="menu" aria-label={`${title}`} className="flex flex-col">
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(() => onLike(true))}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm text-foreground transition-colors hover:bg-secondary",
              focusRing,
            )}
          >
            <Heart
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            Like
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(() => onHide(true))}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm text-foreground transition-colors hover:bg-secondary",
              focusRing,
            )}
          >
            <EyeOff
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            Hide
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

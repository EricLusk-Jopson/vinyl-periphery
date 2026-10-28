import React, { useState } from "react";
import { titleInitials, usableImageUrl } from "@/lib/searches";
import { cn } from "@/lib/utils";

interface AlbumCoverProps {
  /** Image URL as stored on the search; may be empty or stale. */
  src: string;
  /** Album title, used for the initials placeholder. */
  title: string;
  /** Size and radius, e.g. "h-12 w-12 rounded-[3px]". */
  className?: string;
}

/**
 * Album art with an initials placeholder when there is no usable image or it
 * fails to load (saved searches keep their URL indefinitely). The placeholder
 * is a normal state, not an error: many albums have no art anywhere. Art that
 * arrives later (cover lookups) fades in over it. Decorative: the title is
 * always shown next to it.
 */
export const AlbumCover: React.FC<AlbumCoverProps> = ({
  src,
  title,
  className,
}) => {
  // Keyed to the URL, so a new src after a failed one gets its own try.
  const [failedUrl, setFailedUrl] = useState("");
  const [loadedUrl, setLoadedUrl] = useState("");
  const candidate = usableImageUrl(src);
  const url = candidate === failedUrl ? "" : candidate;
  const box = cn(
    "flex shrink-0 items-center justify-center overflow-hidden bg-secondary",
    className
  );

  if (url) {
    return (
      <span className={cn(box, "relative")}>
        {loadedUrl !== url && (
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center font-mono text-muted-foreground"
          >
            {titleInitials(title)}
          </span>
        )}
        <img
          src={url}
          alt=""
          loading="lazy"
          onLoad={() => setLoadedUrl(url)}
          onError={() => setFailedUrl(url)}
          className={cn(
            "relative h-full w-full object-cover transition-opacity duration-200",
            loadedUrl === url ? "opacity-100" : "opacity-0",
          )}
        />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={cn(box, "font-mono text-muted-foreground")}>
      {titleInitials(title)}
    </span>
  );
};

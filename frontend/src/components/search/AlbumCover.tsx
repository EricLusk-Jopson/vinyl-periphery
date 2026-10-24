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
 * fails to load (saved searches keep their URL indefinitely). Decorative: the
 * title is always shown next to it.
 */
export const AlbumCover: React.FC<AlbumCoverProps> = ({
  src,
  title,
  className,
}) => {
  const [failed, setFailed] = useState(false);
  const url = failed ? "" : usableImageUrl(src);
  const box = cn(
    "flex shrink-0 items-center justify-center overflow-hidden bg-secondary",
    className
  );

  if (url) {
    return (
      <span className={box}>
        <img
          src={url}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
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

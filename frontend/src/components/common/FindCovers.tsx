import React from "react";
import { ImageDown, Loader2 } from "lucide-react";
import { FindCoversWhere, useFindCovers } from "@/hooks/useFindCovers";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/**
 * "Find N missing covers": covers MusicBrainz doesn't have, from Discogs,
 * for `keys` (the rows on screen, or the albums a share image draws).
 * Shows progress with Cancel while it runs; nothing when no cover is
 * missing.
 */
export const FindCovers: React.FC<{
  keys: string[];
  where: FindCoversWhere;
  className?: string;
}> = ({ keys, where, className }) => {
  const { missing, progress, busy, found, find, cancel } = useFindCovers(
    keys,
    where,
  );
  if (!progress && missing.length === 0 && !busy && !found) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {progress ? (
        <>
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Finding covers · {progress.done} of {progress.total}
          </span>
          <button
            type="button"
            onClick={cancel}
            className={cn(
              "min-h-11 rounded-md px-1 font-medium text-foreground underline underline-offset-2 hover:text-muted-foreground",
              focusRing,
            )}
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          {busy && <span>Discogs is busy. Try again in a minute.</span>}
          {!busy && found !== null && (
            <span>
              {found > 0
                ? `Found ${plural(found, "cover", "covers")} on Discogs`
                : "No covers found on Discogs"}
            </span>
          )}
          {missing.length > 0 && (
            <button
              type="button"
              onClick={find}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-md px-1 font-medium text-foreground underline underline-offset-2 hover:text-muted-foreground",
                focusRing,
              )}
            >
              <ImageDown className="h-4 w-4" aria-hidden="true" />
              Find {plural(missing.length, "missing cover", "missing covers")}
            </button>
          )}
        </>
      )}
    </div>
  );
};

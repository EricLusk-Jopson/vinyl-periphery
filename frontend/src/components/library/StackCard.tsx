import React from "react";
import { Link } from "react-router-dom";
import { Layers } from "lucide-react";
import { LayersOff } from "../common/icons";
import { useCoverArt } from "@/hooks/useCoverArt";
import { stackPath } from "@/lib/routes";
import { searchStartedAt, timeAgo, usableImageUrl } from "@/lib/searches";
import {
  LibraryStack,
  StackRoot,
  stackDepth,
  stackLabel,
  stackRoot,
} from "@/lib/stacks";
import { cn } from "@/lib/utils";
import { AlbumCover } from "../search/AlbumCover";
import { SearchCover } from "../search/SearchCover";
import { iconButton } from "../common/buttons";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

/**
 * A stack's root cover: the root search's own while it's there, otherwise
 * the art its snapshot kept, or the Cover Art Archive art for its album.
 */
export const StackRootCover: React.FC<{
  root: StackRoot;
  className?: string;
}> = ({ root, className }) => {
  const own = usableImageUrl(root.thumb);
  const key = !root.search && !own ? root.targetKey : "";
  const cover = useCoverArt(key ? [key] : []);
  if (root.search)
    return <SearchCover search={root.search} className={className} />;
  return (
    <AlbumCover
      src={own || (key && cover(key)) || ""}
      title={root.title}
      className={className}
    />
  );
};

interface StackCardProps {
  stack: LibraryStack;
  onDisband: () => void;
}

/**
 * The searches in one stack, as one card: the root's cover and name,
 * "+ n" for the rest. Offset edges behind it mark it as a stack. Opens the
 * stack's page; Destack keeps its searches, each on its own.
 */
export const StackCard: React.FC<StackCardProps> = ({
  stack,
  onDisband,
}) => {
  const root = stackRoot(stack);
  const deepest = stackDepth(stack);
  const latest = Math.max(
    ...stack.members.map((m) => searchStartedAt(m.searchId)),
  );
  const count = stack.members.length;

  return (
    <li className="relative pb-2 pr-2">
      {/* The stacked edges: decorative. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 left-2 top-2 rounded-[10px] border bg-surface"
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 bottom-1 left-1 right-1 top-1 rounded-[10px] border bg-surface"
      />
      <div className="relative flex min-w-0 items-center gap-1 rounded-[10px] border border-border-strong bg-surface pr-2 transition-colors hover:border-border-emphasis">
        <Link
          to={stackPath(stack.stackId)}
          data-library-open
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 rounded-[10px] p-2.5 lg:gap-4 lg:p-3.5",
            focusRing,
          )}
        >
          <StackRootCover
            root={root}
            className="h-12 w-12 rounded-[3px] text-xs lg:h-16 lg:w-16 lg:rounded lg:text-sm"
          />
          <span className="flex min-w-0 flex-col gap-0.5 md:gap-1">
            <span className="flex min-w-0 items-center gap-2">
              <Layers
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="truncate text-[15px] font-semibold md:text-base">
                {stackLabel(stack)}
              </span>
            </span>
            <span className="truncate text-[13px] text-muted-foreground md:text-sm">
              {root.artist}
            </span>
            <span className="font-mono text-xs text-faint">
              {count} searches · {deepest} {deepest === 1 ? "step" : "steps"}{" "}
              deep · {timeAgo(latest)}
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={onDisband}
          aria-label={`Destack the ${root.title} stack`}
          className={cn(
            iconButton,
            "text-muted-foreground hover:text-foreground",
          )}
        >
          <LayersOff className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
};

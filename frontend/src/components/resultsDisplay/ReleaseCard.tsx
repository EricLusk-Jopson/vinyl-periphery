import React, { useEffect, useRef, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { defaultContributorDisplayPipeline } from "@/lib/transformers/contributorProcessor";
import { AlbumCover } from "../search/AlbumCover";
import { cn } from "@/lib/utils";

interface ReleaseCardProps {
  /** Position in the ranked list, from 1. */
  rank: number;
  release: {
    score: number;
    confidence: number;
    activeContributors: number[];
    id: number;
    title: string;
    year: string;
    artist: string;
    thumb: string;
    resource_url: string;
    contributorIds: number[];
  };
  search: {
    searchParams: {
      album: string;
    };
    contributors: Record<
      string,
      {
        name: string;
        roles: string[];
      }
    >;
  };
}

/** At most two roles, so one busy contributor cannot take over the line. */
const shortRoles = (roles: string[]) => roles.slice(0, 2).join(", ");

/**
 * One connected album. The credits line, like a sleeve's track list, says
 * who it shares with the searched album and what they did on that album.
 */
export const ReleaseCard: React.FC<ReleaseCardProps> = ({
  rank,
  release,
  search,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [discogsUrl, setDiscogsUrl] = useState<string | null>(null);
  const hasRequestedRef = useRef(false);

  // Fetch the Discogs page URL the first time the row is opened.
  useEffect(() => {
    const fetchReleaseDetails = async () => {
      if (isOpen && !discogsUrl && !hasRequestedRef.current) {
        hasRequestedRef.current = true;
        try {
          const response = await fetch(release.resource_url);
          const data = await response.json();
          if (data && data.uri) setDiscogsUrl(data.uri);
        } catch (error) {
          console.error("Error fetching release details:", error);
        }
      }
    };
    fetchReleaseDetails();
  }, [isOpen, discogsUrl, release.resource_url]);

  const people = Array.from(new Set(release.activeContributors))
    .filter((id) => id in search.contributors)
    .map((id) => ({
      id,
      name: defaultContributorDisplayPipeline(search.contributors[id].name),
      roles: shortRoles(search.contributors[id].roles),
    }));
  const shared = people.length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} asChild>
      <li className="border-t">
        <CollapsibleTrigger
          className={cn(
            "flex w-full items-start gap-3 py-4 text-left transition-colors hover:bg-secondary/40 md:gap-4",
            "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          )}
        >
          <span
            aria-hidden="true"
            className="hidden w-7 shrink-0 pt-1 font-mono text-[13px] text-dim sm:block"
          >
            {String(rank).padStart(2, "0")}
          </span>
          <AlbumCover
            src={release.thumb}
            title={release.title}
            className="h-12 w-12 text-xs md:h-14 md:w-14"
          />
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="flex flex-col text-[15px] font-semibold leading-snug md:text-[17px]">
              <span className="text-foreground">{release.title}</span>
              <span className="text-muted-foreground">
                {release.artist}
                {release.year ? `, ${release.year}` : ""}
              </span>
            </span>
            <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
              {people.map((p) => (
                <span key={p.id}>
                  <span className="mr-1.5 font-mono text-xs font-normal uppercase tracking-[0.5px] text-muted-foreground">
                    {p.roles}
                  </span>
                  {p.name}
                </span>
              ))}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end">
            <span
              className={cn(
                "type-title type-score !leading-none",
                shared > 1 ? "text-primary" : "text-foreground"
              )}
            >
              {shared}
            </span>
            <span className="font-mono text-xs text-muted-foreground">shared</span>
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-wrap items-center gap-x-6 gap-y-2 pb-4 text-sm sm:pl-11 md:pl-[4.5rem]">
          {discogsUrl ? (
            <a
              href={discogsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              View on Discogs
            </a>
          ) : (
            <span className="text-muted-foreground">Finding the Discogs page…</span>
          )}
          <span className="text-muted-foreground">
            Roles are from {search.searchParams.album}.
          </span>
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
};

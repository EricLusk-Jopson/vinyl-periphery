import React, { useState, useRef, useEffect } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { defaultContributorDisplayPipeline } from "@/lib/transformers/contributorProcessor";
import { spacedDefaultRolePipeline } from "@/lib/transformers/roleProcessor";

interface ReleaseCardProps {
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

export const ReleaseCard: React.FC<ReleaseCardProps> = ({
  release,
  search,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [discogsUrl, setDiscogsUrl] = useState<string | null>(null);
  const hasRequestedRef = useRef(false);

  // Fetch release details when the card is first opened
  useEffect(() => {
    const fetchReleaseDetails = async () => {
      if (isOpen && !discogsUrl && !hasRequestedRef.current) {
        hasRequestedRef.current = true;

        try {
          const response = await fetch(release.resource_url);
          const data = await response.json();

          if (data && data.uri) {
            setDiscogsUrl(data.uri);
          }
        } catch (error) {
          console.error("Error fetching release details:", error);
        }
      }
    };

    fetchReleaseDetails();
  }, [isOpen, release.resource_url]);

  const handleToggle = (open: boolean) => {
    setIsOpen(open);
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={handleToggle}
      className="w-full border-primary-main bg-bg-primary p-2 group"
    >
      <CollapsibleTrigger
        className="flex w-full p-0 font-primary text-sm sm:text-lg tracking-normal text-text-primary group-data-[state=closed]:text-text-primary
        group-data-[state=open]:text-primary-main
        sm:hover:!text-primary-dark focus:outline-primary-main
        transition-colors duration-200 ease-in-out"
      >
        <div className="flex flex-row justify-between items-center text-left w-full">
          <div className="flex flex-row gap-2 flex-wrap">
            <div className="text-wrap">{release.artist}:</div>
            <div className="text-wrap">{release.title}</div>
          </div>

          <div className="text-right whitespace-nowrap hidden md:inline">
            {(100 * release.score).toFixed(0)}%
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2 items-start">
        <div>
          <p className="text-xs text-text-disabled">
            Roles displayed are for contributor's participation on{" "}
            <i>{search.searchParams.album} </i>
          </p>
        </div>
        <ul className="font-secondary text-ms text-text-secondary sm:text-sm mt-2">
          {Array.from(
            new Set(
              release.activeContributors
                .filter((id) => id in search.contributors)
                .map(
                  (id) =>
                    `${defaultContributorDisplayPipeline(
                      search.contributors[id].name
                    )} (${spacedDefaultRolePipeline(
                      search.contributors[id].roles
                    )})`
                )
            )
          ).map((txt, index) => (
            <li key={index}>{txt}</li>
          ))}
        </ul>
        {release.thumb && (
          <img
            src={release.thumb}
            alt={`${release.artist} - ${release.title}`}
          />
        )}
        {discogsUrl && (
          <a
            href={discogsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-text-disabled hover:text-primary-light"
          >
            Visit on Discogs
          </a>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

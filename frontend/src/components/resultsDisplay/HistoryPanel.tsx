import React from "react";
import { Star, ChevronDown } from "lucide-react";
import { useCache } from "@/contexts/cache/CacheContext";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface HistoryItemProps {
  searchId: string;
  artist: string;
  album: string;
  onSelect: () => void;
  isActive: boolean;
}

const HistoryItem: React.FC<HistoryItemProps> = ({
  artist,
  album,
  onSelect,
  isActive,
}) => {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex items-center justify-between p-md hover:bg-bg-secondary cursor-pointer rounded-md",
        isActive && "bg-bg-secondary"
      )}
    >
      <div className="flex flex-col">
        <span className="text-text-primary font-medium">{artist}</span>
        <span className="text-text-secondary text-sm">{album}</span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          // TODO: Implement save functionality
        }}
        className="p-2 hover:text-primary-main"
      >
        <Star
          size={16}
          className={cn("transition-colors", isActive && "text-primary-main")}
        />
      </button>
    </div>
  );
};

const HistoryPanel: React.FC = () => {
  const { searches, setActiveSearch, activeSearchId } = useCache();
  const [savedOpen, setSavedOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(true);

  const searchHistory = React.useMemo(
    () =>
      Object.entries(searches)
        .map(([id, search]) => ({
          id,
          artist: search.searchParams.artist,
          album: search.searchParams.album,
          timestamp: parseInt(id.split("-").pop() || "0", 10),
        }))
        .sort((a, b) => b.timestamp - a.timestamp),
    [searches]
  );

  return (
    <div className="flex flex-col gap-lg">
      <Collapsible open={savedOpen} onOpenChange={setSavedOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-md text-left">
          <span className="font-medium">Saved Searches</span>
          <div className="flex items-center gap-2">
            <span className="text-text-secondary">0</span>
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform duration-200",
                savedOpen && "transform rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          <div className="py-sm px-md text-text-secondary">
            No saved searches yet
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-md text-left">
          <span className="font-medium">Session History</span>
          <div className="flex items-center gap-2">
            <span className="text-text-secondary">{searchHistory.length}</span>
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform duration-200",
                historyOpen && "transform rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          <div className="flex flex-col gap-sm">
            {searchHistory.length === 0 ? (
              <div className="py-sm px-md text-text-secondary">
                No search history yet
              </div>
            ) : (
              searchHistory.map(({ id, artist, album }) => (
                <HistoryItem
                  key={id}
                  searchId={id}
                  artist={artist}
                  album={album}
                  onSelect={() => setActiveSearch(id)}
                  isActive={id === activeSearchId}
                />
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default HistoryPanel;

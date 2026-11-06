import React from "react";
import { Route } from "lucide-react";

/**
 * One line above a results list on how stacks grow: the route button on
 * any row searches from that album, and the search joins the stack.
 */
export const SearchFromHint: React.FC<{ note: string }> = ({ note }) => (
  <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
    <Route className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
    <span>
      <span className="font-medium text-foreground">Follow the credits:</span>{" "}
      the route button on any album {note.replace(/^Searches/, "searches")}
    </span>
  </p>
);

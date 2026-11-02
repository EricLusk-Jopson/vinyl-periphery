import { useEffect, useRef } from "react";
import { onFilterRequest, takeFilterRequest } from "@/lib/filterRequest";

/**
 * Opens this page's filters when the share sheet's "More filters" asks:
 * `open` (the frame) below lg; at lg, where the filters are a sidebar, it
 * scrolls the sidebar into view and focuses it.
 */
export const useFilterRequest = (open: () => void): void => {
  const latest = useRef(open);
  latest.current = open;
  useEffect(() => {
    const handle = () => {
      if (!takeFilterRequest()) return;
      const sidebar = document.querySelector<HTMLElement>(
        'aside[aria-label="Filters"]',
      );
      if (sidebar && sidebar.offsetParent !== null) {
        sidebar.scrollIntoView({ behavior: "smooth", block: "start" });
        sidebar.querySelector<HTMLElement>("button, input")?.focus({
          preventScroll: true,
        });
        return;
      }
      latest.current();
    };
    // A request made before this mounted (e.g. on another tab).
    handle();
    return onFilterRequest(handle);
  }, []);
};

import { useLocation } from "react-router-dom";
import { libraryPath, pageBackKind } from "@/lib/routes";
import { useResultsBack } from "./useResultsBack";

/**
 * The back link for the page on screen, or null at the top level (home,
 * library). Every page below it has one: in the header on phones, above
 * the page's title from md (`PageBack`).
 */
export const usePageBack = (): { to: string; label: string } | null => {
  const { pathname } = useLocation();
  const results = useResultsBack();
  const kind = pageBackKind(pathname);
  if (kind === "results") return results;
  if (kind === "stack") return { to: libraryPath(), label: "Back to library" };
  return null;
};

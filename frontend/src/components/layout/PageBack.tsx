import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { usePageBack } from "@/hooks/usePageBack";
import { cn } from "@/lib/utils";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * The page's back link above its title, from md. On phones the same link
 * is the header's chevron (`Header`), so every page below the top level
 * has it in one place per width.
 */
export const PageBack: React.FC = () => {
  const back = usePageBack();
  if (!back) return null;
  return (
    <div className="mx-auto hidden max-w-[1280px] px-2 pt-2 md:block md:px-4">
      <Link
        to={back.to}
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
          focusRing,
        )}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {back.label}
      </Link>
    </div>
  );
};

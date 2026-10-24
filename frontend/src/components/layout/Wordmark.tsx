import { cn } from "@/lib/utils";

interface WordmarkProps {
  className?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  /**
   * From which width the name shows beside the disc. Below it the name is
   * read out but not shown, to save room in the header.
   */
  nameFrom?: "md" | "lg";
}

/** Disc mark and name. Links home. */
export const Wordmark: React.FC<WordmarkProps> = ({
  className,
  onClick,
  nameFrom = "md",
}) => (
  <a
    href="/"
    onClick={onClick}
    className={cn(
      "flex min-h-11 min-w-11 items-center justify-center gap-2.5 rounded-sm text-foreground no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
      className,
    )}
  >
    <svg
      viewBox="0 0 26 26"
      aria-hidden="true"
      className="h-[26px] w-[26px] shrink-0"
    >
      <circle
        cx="13"
        cy="13"
        r="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle
        cx="13"
        cy="13"
        r="7"
        fill="none"
        className="stroke-border-strong"
        strokeWidth="1"
      />
      <circle cx="13" cy="13" r="3.5" className="fill-primary" />
    </svg>
    <span
      className={cn(
        "font-display text-[26px] leading-none tracking-[1.5px]",
        nameFrom === "md" ? "sr-only md:not-sr-only" : "sr-only lg:not-sr-only",
      )}
    >
      Vinyl Periphery
    </span>
  </a>
);

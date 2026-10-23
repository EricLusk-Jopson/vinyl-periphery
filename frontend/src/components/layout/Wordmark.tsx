import { cn } from "@/lib/utils";

interface WordmarkProps {
  className?: string;
}

/** Disc mark and name. Links home. */
export const Wordmark: React.FC<WordmarkProps> = ({ className }) => (
  <a
    href="/"
    className={cn(
      "flex items-center gap-2.5 rounded-sm text-foreground no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
      className
    )}
  >
    <svg
      viewBox="0 0 26 26"
      aria-hidden="true"
      className="h-[22px] w-[22px] shrink-0 md:h-[26px] md:w-[26px]"
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
    <span className="font-display text-[22px] leading-none tracking-[1.2px] md:text-[26px] md:tracking-[1.5px]">
      Vinyl Periphery
    </span>
  </a>
);

import { cn } from "@/lib/utils";

interface WordmarkProps {
  className?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}

/** Disc mark and name. Links home. */
export const Wordmark: React.FC<WordmarkProps> = ({ className, onClick }) => (
  <a
    href="/"
    onClick={onClick}
    className={cn(
      "flex items-center gap-2.5 rounded-sm text-foreground no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
      className
    )}
  >
    <span className="type-title type-wordmark !leading-none">
      Vinyl Periphery
    </span>
    <svg
      viewBox="0 0 26 26"
      aria-hidden="true"
      className="h-4 w-4 shrink-0 md:h-[18px] md:w-[18px]"
    >
      <circle cx="13" cy="13" r="12" className="fill-primary-deep" />
      <circle cx="13" cy="13" r="4.5" className="fill-primary" />
    </svg>
  </a>
);

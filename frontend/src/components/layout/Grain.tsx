import { useId } from "react";
import { cn } from "@/lib/utils";

interface GrainProps {
  className?: string;
}

/**
 * Static film-grain texture, the quiet successor to the animated TV static.
 * Place it inside a `relative` container; it fills the container and sits
 * behind the content. Purely decorative.
 */
export const Grain: React.FC<GrainProps> = ({ className }) => {
  const filterId = `grain-${useId().replace(/:/g, "")}`;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]",
        className
      )}
    >
      <filter id={filterId}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.85"
          numOctaves={2}
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${filterId})`} />
    </svg>
  );
};

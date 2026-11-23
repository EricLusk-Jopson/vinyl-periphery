import React from "react";

/**
 * The working state inside a busy button: a band of light sweeping across
 * it and a bar running along its bottom edge. Decorative (the button says
 * what it's doing in words, with `aria-busy`); the button needs `relative
 * overflow-hidden`. Reduced motion stills it (globals.css).
 */
export const ButtonBusy: React.FC<{ busy: boolean }> = ({ busy }) =>
  busy ? (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
    >
      <span className="absolute inset-y-0 left-0 w-1/3 animate-button-sweep bg-gradient-to-r from-transparent via-primary-foreground/25 to-transparent" />
      <span className="absolute inset-x-0 bottom-0 h-[3px] bg-primary-foreground/15">
        <span className="block h-full w-full origin-left animate-button-progress rounded-full bg-primary-foreground/70" />
      </span>
    </span>
  ) : null;

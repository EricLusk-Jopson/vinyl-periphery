import React from "react";
import { Grain } from "./Grain";

interface PageHeroProps {
  /** The album's cover (or the stack's root cover). */
  cover: React.ReactNode;
  /** The red line above the title: "Connections from", "Stack". */
  eyebrow: string;
  title: string;
  meta: React.ReactNode;
  /** The page's actions, as `pageAction` buttons. */
  actions: React.ReactNode;
}

/**
 * The top of a results or stack page: cover, eyebrow, title and meta, and
 * the page's actions. Phones put the actions in a row under the title;
 * from md they sit beside it.
 */
export const PageHero: React.FC<PageHeroProps> = ({
  cover,
  eyebrow,
  title,
  meta,
  actions,
}) => (
  <section className="relative overflow-hidden border-b">
    <Grain className="opacity-10" />
    <div className="relative mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 px-4 py-4 md:gap-5 md:px-6 md:py-6 lg:gap-6 lg:py-9">
      {cover}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 md:flex-[1_1_360px] md:gap-1.5">
        <p className="font-mono text-xs uppercase tracking-[2px] text-primary-text md:text-[13px]">
          {eyebrow}
        </p>
        <h1 className="line-clamp-2 break-words font-display text-[28px] font-normal leading-none tracking-[0.3px] md:line-clamp-none md:text-[40px] md:tracking-[0.5px] lg:text-[56px]">
          {title}
        </h1>
        <p className="text-[13px] text-muted-foreground md:text-base">{meta}</p>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:shrink-0">
        {actions}
      </div>
    </div>
  </section>
);

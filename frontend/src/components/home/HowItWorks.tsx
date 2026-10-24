import React from "react";

const STEPS = [
  {
    title: "Select an album",
    body: "You choose an album and we'll find the matching release on Discogs. Sometimes Discogs data is incomplete, so we go through the top results to find or create the best match.",
  },
  {
    title: "Relax while we search",
    body: "We find every contributor listed on the album, from band members and session players to engineers and producers, then we trace their discographies. This can take a few minutes, so go grab a coffee.",
  },
  {
    title: "Explore a web of music",
    body: "We return the credited contributors' discographies, ranked by overlap with your search. The more credits they share, the higher they rank. You can explore now music beyond marketing and algorithms.",
  },
];

export const HowItWorks: React.FC = () => (
  <section
    id="how"
    aria-labelledby="how-heading"
    className="mx-auto w-full max-w-[1200px] scroll-mt-4 px-4 pb-10 pt-8 md:px-6 md:pb-24 md:pt-14"
  >
    <h2
      id="how-heading"
      tabIndex={-1}
      className="mb-3 font-display focus:outline-none text-2xl font-normal tracking-[0.5px] md:mb-7 md:text-[34px]"
    >
      How it works
    </h2>
    <ol className="grid border-t md:grid-cols-3">
      {STEPS.map((step, i) => (
        <li
          key={step.title}
          className="flex flex-col gap-1.5 pt-4 md:gap-2.5 md:pr-7 md:pt-7"
        >
          <span
            className="font-mono text-[13px] text-primary-text"
            aria-hidden="true"
          >
            {String(i + 1).padStart(2, "0")}
          </span>
          <h3 className="text-base font-semibold md:text-lg">{step.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground md:text-[15px]">
            {step.body}
          </p>
        </li>
      ))}
    </ol>
  </section>
);

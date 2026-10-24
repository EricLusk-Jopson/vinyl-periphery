import React from "react";

const STEPS = [
  {
    title: "Search an album",
    body: "Give us the artist and album. We find the matching release on Discogs.",
  },
  {
    title: "We read the credits",
    body: "Every musician, producer, engineer and designer listed on the album, plus the band members.",
  },
  {
    title: "Follow the people",
    body: "We go through each contributor’s discography and rank albums by how many of them worked on it.",
  },
];

export const HowItWorks: React.FC = () => (
  <section
    id="how"
    aria-labelledby="how-heading"
    className="mx-auto w-full max-w-[1200px] scroll-mt-4 px-4 pb-16 pt-10 md:px-6 md:pb-24 md:pt-14"
  >
    <h2
      id="how-heading"
      className="mb-5 font-display text-2xl font-normal tracking-[0.5px] md:mb-7 md:text-[34px]"
    >
      How it works
    </h2>
    <ol className="grid border-t md:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
      {STEPS.map((step, i) => (
        <li key={step.title} className="flex flex-col gap-2.5 pt-6 md:pr-7 md:pt-7">
          <span className="font-mono text-[13px] text-primary-text" aria-hidden="true">
            {String(i + 1).padStart(2, "0")}
          </span>
          <h3 className="text-lg font-semibold">{step.title}</h3>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {step.body}
          </p>
        </li>
      ))}
    </ol>
  </section>
);

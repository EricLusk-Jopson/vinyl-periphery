import React, { useRef, useState } from "react";
import { SearchParams } from "@/api/types";
import { pickRandom } from "@/lib/random";
import { TOP_ALBUMS } from "@/lib/topAlbums";
import { Grain } from "../layout/Grain";
import { SearchForm, SearchFormProps } from "../search/SearchForm";

const EXAMPLE_COUNT = 3;

type HeroProps = Omit<SearchFormProps, "variant">;

const Intro: React.FC = () => (
  <>
    <p className="font-mono text-xs uppercase tracking-[2px] text-primary-text md:text-[13px]">
      Follow the credit-brick road
    </p>
    <h1 className="max-w-[860px] font-display text-[52px] font-normal leading-[0.95] tracking-[0.3px] md:text-8xl md:leading-[0.92] md:tracking-[0.5px]">
      Find the albums hiding in your liner notes
    </h1>
    <p className="max-w-[620px] text-base leading-normal text-muted-foreground md:text-[19px] md:leading-[1.55]">
      Search for an album. We trace everyone credited on it
      <span className="hidden md:inline">
        , from session players to engineers and producers,
      </span>{" "}
      and show you where else they collaborated.
    </p>
  </>
);

/**
 * Home hero: eyebrow, headline, explainer, the search form and example
 * searches. On mobile the grain band holds only the text and the form sits
 * below it; from `md` the grain spans the whole hero.
 */
export const Hero: React.FC<HeroProps> = (formProps) => {
  const formRef = useRef<HTMLFormElement>(null);
  // A fresh three each time the home page appears.
  const [examples] = useState(() => pickRandom(TOP_ALBUMS, EXAMPLE_COUNT));
  const { onValuesChange, isSearching } = formProps;

  // Fill the form rather than search straight away: a search takes minutes
  // and spends Discogs requests, so the user confirms with the button.
  const tryExample = (example: SearchParams) => {
    onValuesChange(example);
    formRef.current
      ?.querySelector<HTMLButtonElement>('button[type="submit"]')
      ?.focus();
  };

  return (
    <section className="relative overflow-hidden md:border-b">
      <Grain className="hidden opacity-[0.14] md:block" />
      <div className="relative mx-auto max-w-[1200px] md:flex md:flex-col md:gap-7 md:px-6 md:pb-24 md:pt-16">
        <div className="relative flex flex-col gap-3.5 overflow-hidden border-b px-4 pb-6 pt-8 md:contents md:border-0 md:p-0">
          <Grain className="opacity-[0.14] md:hidden" />
          <div className="relative flex flex-col gap-3.5 md:contents">
            <Intro />
          </div>
        </div>

        <div className="px-4 py-5 md:mt-3 md:max-w-[920px] md:p-0">
          <SearchForm ref={formRef} variant="hero" {...formProps} />
        </div>

        <div className="hidden flex-wrap items-center gap-2.5 md:flex">
          <span className="text-sm text-faint">Try</span>
          {examples.map((example) => (
            <button
              key={`${example.artist}-${example.album}`}
              type="button"
              disabled={isSearching}
              onClick={() => tryExample(example)}
              aria-label={`Fill in ${example.artist}, ${example.album}`}
              className="h-9 max-w-full truncate rounded-full border px-3.5 text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              {example.artist} · {example.album}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

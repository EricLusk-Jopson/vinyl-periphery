import React, { useRef, useState } from "react";
import { SearchParams } from "@/api/types";
import { track } from "@/lib/analytics";
import { exampleLabel, pickMobileExamples } from "@/lib/examples";
import { pickRandom } from "@/lib/random";
import { EXAMPLE_ALBUMS } from "@/lib/topAlbums";
import { cn } from "@/lib/utils";
import { Grain } from "../layout/Grain";
import { SearchForm, SearchFormProps } from "../search/SearchForm";

const EXAMPLE_COUNT = 3;

/**
 * The phone example buttons' layout, from the screen: the row is the
 * viewport less the hero's 16px gutters, and the text is `text-sm` (0.875rem)
 * so it follows the browser's text size.
 */
const mobileChipLayout = () => {
  const root = document.documentElement;
  const rem = parseFloat(getComputedStyle(root).fontSize) || 16;
  return {
    rowWidth: root.clientWidth - 32,
    fontSize: 0.875 * rem,
    chipInset: 30, // px-3.5 each side plus a 1px border
    gap: 8, // gap-2
  };
};

interface ExampleButtonProps {
  example: SearchParams;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}

const ExampleButton: React.FC<ExampleButtonProps> = ({
  example,
  disabled,
  onClick,
  className,
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    aria-label={`Fill in ${example.artist}, ${example.album}`}
    className={cn(
      "max-w-full truncate rounded-full border px-3.5 text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60",
      className,
    )}
  >
    {exampleLabel(example)}
  </button>
);

type HeroProps = Omit<SearchFormProps, "variant">;

const Intro: React.FC = () => (
  <>
    <p className="font-mono text-xs uppercase tracking-[2px] text-primary-text md:text-[13px]">
      Follow the credit-brick road
    </p>
    <h1 className="max-w-[860px] font-display text-[40px] font-normal leading-[0.95] tracking-[0.3px] md:text-[72px] md:leading-[0.92] lg:text-8xl md:tracking-[0.5px]">
      Find the albums hiding in your liner notes
    </h1>
    {/* Cut on phones so the search form fits on the first screen. */}
    <p className="hidden max-w-[620px] text-muted-foreground md:block md:text-[19px] md:leading-[1.55]">
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
  const [examples] = useState(() => pickRandom(EXAMPLE_ALBUMS, EXAMPLE_COUNT));
  // On phones: two short albums side by side, chosen to fit this screen.
  // Truncation catches any misestimate.
  const [mobileExamples] = useState(() =>
    pickMobileExamples(EXAMPLE_ALBUMS, mobileChipLayout()),
  );
  const { onValuesChange, isSearching } = formProps;

  // Fill the form rather than search straight away: a search takes minutes
  // and spends Discogs requests, so the user confirms with the button.
  const tryExample = (example: SearchParams) => {
    track("example_filled", { artist: example.artist, album: example.album });
    onValuesChange(example);
    formRef.current
      ?.querySelector<HTMLButtonElement>('button[type="submit"]')
      ?.focus();
  };

  return (
    <section className="relative overflow-hidden md:border-b">
      <Grain className="hidden opacity-[0.14] md:block" />
      <div className="relative mx-auto max-w-[1200px] md:flex md:flex-col md:gap-6 md:px-6 md:pb-16 md:pt-12 lg:gap-7 lg:pb-24 lg:pt-16">
        <div className="relative flex flex-col gap-2.5 overflow-hidden border-b px-4 pb-5 pt-6 md:contents md:border-0 md:p-0">
          <Grain className="opacity-[0.14] md:hidden" />
          <div className="relative flex flex-col gap-2.5 md:contents">
            <Intro />
          </div>
        </div>

        <div className="px-4 pb-5 pt-7 md:mt-3 md:max-w-[920px] md:p-0">
          <SearchForm ref={formRef} variant="hero" {...formProps} />
        </div>

        {mobileExamples.length > 0 && (
          <div className="flex flex-col gap-2 px-4 pb-8 md:hidden">
            <span className="text-sm text-faint">Try</span>
            <div className="grid grid-cols-2 gap-2">
              {mobileExamples.map((example) => (
                <ExampleButton
                  key={exampleLabel(example)}
                  example={example}
                  disabled={isSearching}
                  onClick={() => tryExample(example)}
                  className="h-11"
                />
              ))}
            </div>
          </div>
        )}

        <div className="hidden flex-wrap items-center gap-2.5 md:flex">
          <span className="text-sm text-faint">Try</span>
          {examples.map((example) => (
            <ExampleButton
              key={exampleLabel(example)}
              example={example}
              disabled={isSearching}
              onClick={() => tryExample(example)}
              className="h-9"
            />
          ))}
        </div>
      </div>
    </section>
  );
};

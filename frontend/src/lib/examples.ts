import { SearchParams } from "@/api/types";
import { pickRandom } from "./random";

/** An example's button text. */
export const exampleLabel = ({ artist, album }: SearchParams): string =>
  `${artist} · ${album}`;

/**
 * Character width to budget for, as a share of the font size. Plex Sans
 * averages about 0.43em on these names; 0.58 also covers names in capitals
 * ("MF DOOM · Mm..Food"). Checked against every example album's rendered
 * width at 320 to 430px: none overflow.
 */
const CHAR_WIDTH_EM = 0.58;

const WIDE_CHAR =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303f\uff01-\uff60]/u;

/**
 * A label's length in characters, counting Chinese, Japanese and Korean
 * characters (about twice as wide as Latin ones) as two.
 */
export const displayLength = (text: string): number =>
  [...text].reduce((n, char) => n + (WIDE_CHAR.test(char) ? 2 : 1), 0);

export interface ChipLayout {
  /** Width of the row the buttons sit in, in px. */
  rowWidth: number;
  /** The buttons' font size, in px. */
  fontSize: number;
  /** Horizontal padding plus border of one button, in px. */
  chipInset: number;
  /** Space between the two buttons of a pair, in px. */
  gap: number;
}

/** How many characters fit on a button `width` px wide. */
export const charsThatFit = (
  width: number,
  { fontSize, chipInset }: ChipLayout,
): number =>
  Math.max(0, Math.floor((width - chipInset) / (fontSize * CHAR_WIDTH_EM)));

export interface MobileExamples {
  /** A long example that takes a row to itself. */
  wide: SearchParams | null;
  /** Up to two short examples that sit side by side. */
  pair: SearchParams[];
}

/**
 * Examples for a phone: one long album on its own row, then two short ones
 * side by side. The wide one is too long for half a row but fits a whole
 * one; each of the pair fits half a row. Narrow screens with no short
 * enough albums get fewer.
 */
export const pickMobileExamples = (
  albums: readonly SearchParams[],
  layout: ChipLayout,
  random: () => number = Math.random,
): MobileExamples => {
  const full = charsThatFit(layout.rowWidth, layout);
  const half = charsThatFit((layout.rowWidth - layout.gap) / 2, layout);
  const length = (album: SearchParams) => displayLength(exampleLabel(album));

  const [wide = null] = pickRandom(
    albums.filter((a) => length(a) > half && length(a) <= full),
    1,
    random,
  );
  const pair = pickRandom(
    albums.filter((a) => length(a) <= half),
    2,
    random,
  );
  return { wide, pair };
};

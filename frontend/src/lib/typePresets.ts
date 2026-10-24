// Type combinations for the Bright Lights demo. Each choice maps to a data
// attribute on <html>; globals.css turns those into CSS variables.

export type TitleFont = "bebas" | "helvetica" | "condensed" | "plex" | "monda";
export type BodyFont = "monda" | "plex" | "helvetica";
export type FlourishFont = "mono" | "monda" | "same";

export interface TypeSettings {
  title: TitleFont;
  body: BodyFont;
  flourish: FlourishFont;
  grain: boolean;
  redRules: boolean;
}

export interface TypePreset extends TypeSettings {
  id: string;
  name: string;
  description: string;
}

export const TITLE_FONTS: Record<TitleFont, string> = {
  bebas: "Bebas Neue",
  helvetica: "Helvetica bold",
  condensed: "Plex Sans Condensed",
  plex: "Plex Sans bold",
  monda: "Monda bold",
};

export const BODY_FONTS: Record<BodyFont, string> = {
  monda: "Monda",
  plex: "Plex Sans",
  helvetica: "Helvetica",
};

export const FLOURISH_FONTS: Record<FlourishFont, string> = {
  mono: "Plex Mono",
  monda: "Monda",
  same: "Same as body",
};

export const PRESETS: TypePreset[] = [
  {
    id: "industrial",
    name: "Industrial",
    description: "Bebas, Monda, Plex Mono, grain and red rules",
    title: "bebas",
    body: "monda",
    flourish: "mono",
    grain: true,
    redRules: true,
  },
  {
    id: "pure",
    name: "Bright Lights pure",
    description: "Helvetica everywhere",
    title: "helvetica",
    body: "helvetica",
    flourish: "same",
    grain: false,
    redRules: false,
  },
  {
    id: "helvetica-plex",
    name: "Helvetica and Plex",
    description: "Helvetica titles, Plex Sans body, Plex Mono flourishes",
    title: "helvetica",
    body: "plex",
    flourish: "mono",
    grain: false,
    redRules: false,
  },
  {
    id: "all-plex",
    name: "All Plex",
    description: "Free to embed. Plex bold, Plex Sans, Plex Mono",
    title: "plex",
    body: "plex",
    flourish: "mono",
    grain: false,
    redRules: false,
  },
  {
    id: "condensed",
    name: "Condensed Plex",
    description: "Plex Sans Condensed titles, Plex Sans, Plex Mono",
    title: "condensed",
    body: "plex",
    flourish: "mono",
    grain: false,
    redRules: false,
  },
  {
    id: "poster",
    name: "Poster",
    description: "Bebas titles, Plex Sans, Plex Mono",
    title: "bebas",
    body: "plex",
    flourish: "mono",
    grain: true,
    redRules: false,
  },
  {
    id: "original",
    name: "Original",
    description: "Bebas titles, Monda body and flourishes",
    title: "bebas",
    body: "monda",
    flourish: "monda",
    grain: true,
    redRules: false,
  },
];

export const DEFAULT_SETTINGS: TypeSettings = PRESETS[0];

export const matchPreset = (s: TypeSettings): TypePreset | undefined =>
  PRESETS.find(
    (p) =>
      p.title === s.title &&
      p.body === s.body &&
      p.flourish === s.flourish &&
      p.grain === s.grain &&
      p.redRules === s.redRules
  );

const isKey = <T extends string>(map: Record<T, string>, v: unknown): v is T =>
  typeof v === "string" && v in map;

/** Reads saved settings, ignoring anything malformed. */
export const parseSettings = (raw: unknown): TypeSettings | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    !isKey(TITLE_FONTS, r.title) ||
    !isKey(BODY_FONTS, r.body) ||
    !isKey(FLOURISH_FONTS, r.flourish)
  ) {
    return null;
  }
  return {
    title: r.title,
    body: r.body,
    flourish: r.flourish,
    grain: r.grain === true,
    redRules: r.redRules === true,
  };
};

/** Applies settings as data attributes on the given element. */
export const applySettings = (el: HTMLElement, s: TypeSettings) => {
  el.dataset.title = s.title;
  el.dataset.body = s.body;
  el.dataset.flourish = s.flourish;
  el.dataset.grain = s.grain ? "on" : "off";
  el.dataset.rules = s.redRules ? "red" : "grey";
};

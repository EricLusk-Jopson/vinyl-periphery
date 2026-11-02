import { SearchCache } from "@/contexts/cache/types";
import { Likes } from "@/services/likes";
import { ALBUM_MAP_PEOPLE, layoutAlbumMap } from "./albumMap";
import { requiredFilters } from "./filters";
import {
  resetFilterState,
  ScoredRelease,
  SORT_OPTIONS,
  SortKey,
  sortReleases,
} from "./results";
import {
  editsCaption,
  editsWithoutHidden,
  NO_EDITS,
  ShareEdits,
  shareSelection,
  withoutHidden,
} from "./shareSelection";
import {
  layoutStackMap,
  orderStackResults,
  stackAsSearch,
  StackNode,
  stackResults,
} from "./stackMap";
import { defaultContributorDisplayPipeline } from "./transformers/contributorProcessor";

/**
 * Share images: the payload the renderer (POST /api/og) draws from, built
 * from data already in the app. Everything the image shows travels in the
 * body, so rendering never calls Discogs. Format: backend/og/payload.js.
 */

export type ShareLayout = "map" | "card";

/** A stack album or result on the stack map, as sent. */
export interface ShareStackNode {
  t: string;
  r: string;
  i: string;
  /** Place and cover side, in thousandths of a step; y up. */
  x: number;
  y: number;
  s: number;
  /** One of the stack's own albums. */
  m?: 1;
  /** Nodes it's linked to (0 is the centre, k is n[k - 1]), for lines. */
  e?: number[];
}

/** Art id: "g:<release-group mbid>", "r:<release mbid>", or "". */
type ArtId = string;

interface ShareAlbum {
  t: string;
  r: string;
  i: ArtId;
}

export type SharePayload =
  | {
      v: 1;
      l: "card";
      a: ShareAlbum;
      x: Array<ShareAlbum & { n: number }>;
      /** How the albums were chosen (sort and filters), when it says. */
      d?: string;
      /** No covers: every album as its title and artist. */
      nc?: 1;
    }
  | {
      v: 1;
      l: "map";
      c: ShareAlbum;
      /**
       * x, y: thousandths of the radius, y up; z: size tier; s: cover side
       * in thousandths of the radius, which wins over z when present.
       */
      n: Array<
        ShareAlbum & {
          x: number;
          y: number;
          z: 1 | 2;
          s?: number;
          /** The people (indices into p) linking it, for lines. */
          l?: number[];
        }
      >;
      /** People around the rim: name, and angle in degrees. */
      p: Array<{ n: string; a: number }>;
      d?: string;
      nc?: 1;
      /** No boilerplate: no header, caption or site; a bigger graph. */
      nb?: 1;
      /** Lines from each person to their albums (`l`). */
      ln?: 1;
    }
  | {
      v: 1;
      l: "stack";
      /** The stack's start, in the middle. */
      c: ShareAlbum & { s: number };
      /** The other stack albums, then the results around them. */
      n: ShareStackNode[];
      d?: string;
      nc?: 1;
      nb?: 1;
      /** Lines between linked albums (`e`). */
      ln?: 1;
    };

/** Rows on the results card by default (it takes up to ten). */
export const SHARE_RESULTS = 5;

/** How many albums each layout can show, and how many it starts with. */
export const SHARE_COUNTS: Record<
  ShareLayout,
  { options: number[]; start: number }
> = {
  map: { options: [6, 12, 18, 24], start: 12 },
  card: { options: [3, 5, 8, 10], start: 5 },
};

/**
 * The counts to offer when `available` albums match: those below it, then
 * "All" when it's under the largest. Nothing to choose with one album or
 * none.
 */
export const countOptions = (
  layout: ShareLayout,
  available: number,
): Array<{ count: number; label: string }> => {
  const { options } = SHARE_COUNTS[layout];
  const max = options[options.length - 1];
  const below = options.filter((n) => n < available && n < max);
  const all =
    available <= max ? [{ count: available, label: `All ${available}` }] : [];
  const choices = [
    ...below.map((n) => ({ count: n, label: String(n) })),
    ...(available > max ? [{ count: max, label: String(max) }] : all),
  ];
  return choices.length > 1 ? choices : [];
};

/** The art id in a Cover Art Archive URL, or "". */
export const artIdFromCoverUrl = (url: string | null | undefined): ArtId => {
  const match =
    /^https:\/\/coverartarchive\.org\/(release-group|release)\/([0-9a-f-]{36})\//i.exec(
      url ?? "",
    );
  if (!match) return "";
  return `${match[1] === "release-group" ? "g" : "r"}:${match[2].toLowerCase()}`;
};

/** Looks up a cover URL for a result key (the app's cover resolver). */
export type CoverFor = (key: string) => string | null | undefined;

const artFor = (key: string | undefined, coverFor: CoverFor): ArtId =>
  key ? artIdFromCoverUrl(coverFor(key)) : "";

/** Periphery card: the searched album and its top results. */
export const cardPayload = (
  search: SearchCache,
  ranked: ScoredRelease[],
  coverFor: CoverFor,
  caption?: string,
  count = SHARE_RESULTS,
): SharePayload => ({
  v: 1,
  l: "card",
  a: {
    t: search.searchParams.album,
    r: search.searchParams.artist,
    i: artFor(search.target?.key, coverFor),
  },
  x: ranked.slice(0, count).map((release) => ({
    t: release.title,
    r: release.artist,
    i: artFor(release.key, coverFor),
    n: release.activeContributors.length,
  })),
  ...(caption ? { d: caption } : {}),
});

const sortName = (key: SortKey) =>
  SORT_OPTIONS.find((o) => o.value === key)?.short ?? key;

/**
 * How a share's albums were chosen, in a line for the image: "Top 12 by
 * Shared, then Newest · Liked only · 2 people off". Only filters that differ
 * from Reset are named.
 */
export const selectionCaption = (
  search: SearchCache,
  count: number,
  sort: SortKey,
  then: SortKey | null,
): string => {
  const { filterState } = search;
  const base = resetFilterState(search);
  const parts = [
    `Top ${count} by ${sortName(sort)}${then ? `, then ${sortName(then)}` : ""}`,
  ];
  if (filterState.likedOnly) parts.push("Liked only");
  if (filterState.collaborationsOnly) parts.push("2+ shared");
  if (filterState.excludeVarious) parts.push("No Various Artists");
  if (filterState.excludeMainArtist !== base.excludeMainArtist) {
    parts.push(`With ${search.searchParams.artist}'s own`);
  }
  const required = requiredFilters(filterState);
  const names = [
    ...required.contributors.map((id) =>
      defaultContributorDisplayPipeline(search.contributors[id]?.name ?? ""),
    ),
    ...required.roles,
  ].filter(Boolean);
  if (names.length > 0) {
    parts.push(
      `Must include ${names.slice(0, 2).join(", ")}${
        names.length > 2 ? ` +${names.length - 2}` : ""
      }`,
    );
  }
  const off = (states: Record<string | number, boolean>) =>
    Object.values(states).filter((on) => !on).length;
  const peopleOff = off(filterState.contributors);
  const rolesOff = off(filterState.roles);
  if (peopleOff > 0) {
    parts.push(`${peopleOff} ${peopleOff === 1 ? "person" : "people"} off`);
  }
  if (rolesOff > 0) {
    parts.push(`${rolesOff} ${rolesOff === 1 ? "role" : "roles"} off`);
  }
  return parts.join(" · ");
};

/**
 * Share map for one search: its album in the middle and `shown` (its top
 * results, as filtered and sorted) around it. See `albumMap.ts`.
 */
export const albumMapPayload = (
  search: SearchCache,
  shown: ScoredRelease[],
  likes: Likes,
  coverFor: CoverFor,
  caption?: string,
): SharePayload => {
  const { albums, people } = layoutAlbumMap(shown, search.contributors, likes);
  const names = (id: number) =>
    defaultContributorDisplayPipeline(search.contributors[id]?.name ?? "");
  // Names for the people linking the most albums; the rest still placed
  // the albums, but aren't drawn.
  const labelled = new Set(
    [...people]
      .sort((a, b) => b.albums - a.albums || a.id - b.id)
      .slice(0, ALBUM_MAP_PEOPLE)
      .map((p) => p.id),
  );
  const rim = people.filter((p) => labelled.has(p.id) && names(p.id));
  const rimIndex = new Map(rim.map((p, i) => [p.id, i]));
  return {
    v: 1,
    l: "map",
    c: {
      t: search.searchParams.album,
      r: search.searchParams.artist,
      i: artFor(search.target?.key, coverFor),
    },
    n: albums.map((album) => ({
      t: album.title,
      r: album.artist,
      i: artFor(album.key, coverFor),
      x: Math.round(album.x * 1000),
      y: Math.round(album.y * 1000),
      z: album.liked ? 2 : 1,
      s: Math.round(album.side * 1000),
      // Named people only: the lines run from their dots.
      l: album.people
        .map((id) => rimIndex.get(id))
        .filter((i): i is number => i !== undefined),
    })),
    p: rim.map((p) => ({
      n: names(p.id),
      a: (Math.round((p.angle * 180) / Math.PI) + 360) % 360,
    })),
    ...(caption ? { d: caption } : {}),
  };
};

/** How an image is drawn, chosen in the share sheet. */
export interface ShareView {
  /** Cover art, or titles and artists only. */
  covers: boolean;
  /** Lines from each person to their albums (maps that have them). */
  lines: boolean;
  /**
   * The header, caption and site on the maps; off, the graph fills the
   * image. Offered once unlocked (see `NO_BOILERPLATE`).
   */
  boilerplate: boolean;
}

export const DEFAULT_VIEW: ShareView = {
  covers: true,
  lines: false,
  boilerplate: true,
};

/** Typed into the share sheet's album search, it unlocks `boilerplate`. */
export const NO_BOILERPLATE = "no boilerplate";

/** Whether a payload has anything to draw lines from. */
export const canDrawLines = (payload: SharePayload): boolean =>
  payload.l === "map"
    ? payload.n.some((n) => (n.l?.length ?? 0) > 0)
    : payload.l === "stack" && payload.n.some((n) => (n.e?.length ?? 0) > 0);

/** The payload as `view` draws it: flags set, links kept only for lines. */
export const withView = (
  payload: SharePayload,
  view: ShareView,
): SharePayload => {
  const covers = view.covers ? {} : { nc: 1 as const };
  if (payload.l === "card") return { ...payload, ...covers };
  const lines = view.lines && canDrawLines(payload);
  const bare = view.boilerplate ? {} : { nb: 1 as const };
  if (payload.l === "stack") {
    return {
      ...payload,
      ...covers,
      ...bare,
      ...(lines ? { ln: 1 as const } : {}),
      n: payload.n.map(({ e, ...node }) =>
        lines && e ? { ...node, e } : node,
      ),
    };
  }
  return {
    ...payload,
    ...covers,
    ...bare,
    ...(lines ? { ln: 1 as const } : {}),
    n: payload.n.map(({ l, ...album }) =>
      lines && l ? { ...album, l } : album,
    ),
  };
};

/** The album at the middle of a map. */
export interface MapCentre {
  key: string;
  title: string;
  artist: string;
  /** Art known for it already (e.g. a lineage snapshot's cover URL). */
  thumb?: string;
}

/**
 * Share map for a stack: its albums a step apart from its start, and
 * results around them where they overlap most. See `stackMap.ts`.
 */
export const stackMapPayload = (
  centre: MapCentre,
  /** From `layoutStackMap`: the centre first. */
  nodes: StackNode[],
  coverFor: CoverFor,
  caption?: string,
): SharePayload => {
  const [middle, ...rest] = nodes;
  const thousandths = (n: number) => Math.round(n * 1000);
  return {
    v: 1,
    l: "stack",
    c: {
      t: centre.title,
      r: centre.artist,
      i: artFor(centre.key, coverFor) || artIdFromCoverUrl(centre.thumb),
      s: thousandths(middle.side),
    },
    n: rest.map((node) => ({
      t: node.title,
      r: node.artist,
      i: artFor(node.key, coverFor),
      x: thousandths(node.x - middle.x),
      y: thousandths(node.y - middle.y),
      s: thousandths(node.side),
      ...(node.member ? { m: 1 as const } : {}),
      e: node.links,
    })),
    ...(caption ? { d: caption } : {}),
  };
};

/** What a stack map shows, in a line: "4 albums stacked · 12 around them". */
export const stackCaption = (
  nodes: StackNode[],
  order?: { sort: SortKey; then: SortKey | null; likesFirst: boolean },
  edits?: string,
): string => {
  const stacked = nodes.filter((n) => n.member).length;
  const around = nodes.length - stacked;
  const by =
    order && around > 0
      ? `, by ${sortName(order.sort)}${order.then ? `, then ${sortName(order.then)}` : ""}`
      : "";
  return [
    `${stacked} ${stacked === 1 ? "album" : "albums"} stacked`,
    around > 0 ? `${around} around them${by}` : "",
    order?.likesFirst && around > 0 ? "Likes first" : "",
    edits ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
};

/** Whether a map would have anything around its centre. */
export const mapHasAlbums = (payload: SharePayload): boolean =>
  (payload.l === "map" || payload.l === "stack") && payload.n.length > 0;

/** A payload as text: two payloads draw the same image when these match. */
export const serialisePayload = (payload: SharePayload): string =>
  JSON.stringify(payload);

/** The payload with every art id blanked, to tell cover-only changes apart. */
const withoutArt = (payload: SharePayload): SharePayload => {
  const blank = <T extends { i: string }>(a: T): T => ({ ...a, i: "" });
  if (payload.l === "card") {
    return { ...payload, a: blank(payload.a), x: payload.x.map(blank) };
  }
  if (payload.l === "map") {
    return { ...payload, c: blank(payload.c), n: payload.n.map(blank) };
  }
  return { ...payload, c: blank(payload.c), n: payload.n.map(blank) };
};

/**
 * How the share sheet's draft differs from the image last made: "same",
 * "covers" (only art found since), or "changed".
 */
export const draftChange = (
  draft: SharePayload | null,
  committed: string | null,
): "same" | "covers" | "changed" => {
  if (!draft || committed === null) return "same";
  const text = serialisePayload(draft);
  if (text === committed) return "same";
  try {
    const before = JSON.parse(committed) as SharePayload;
    return serialisePayload(withoutArt(draft)) ===
      serialisePayload(withoutArt(before))
      ? "covers"
      : "changed";
  } catch {
    return "changed";
  }
};

/** The order of a stack's results in its share map. */
export interface StackOrder {
  sort: SortKey;
  then: SortKey | null;
  likesFirst: boolean;
}

/**
 * Everything the share sheet's controls set. The image is made from it
 * only when the user presses Regenerate (and once when the sheet opens).
 */
export interface ShareDraft {
  /** The layout picked (one search only; a stack is always a map). */
  chosen: ShareLayout;
  /** How many albums each layout draws. */
  counts: Record<ShareLayout, number>;
  /** Albums taken out of the image or added to it. */
  edits: ShareEdits;
  view: ShareView;
  /** A stack's results: their order, and whether liked ones come first. */
  stackOrder: StackOrder;
}

export const defaultDraft = (): ShareDraft => ({
  chosen: "map",
  counts: { map: SHARE_COUNTS.map.start, card: SHARE_COUNTS.card.start },
  edits: NO_EDITS,
  view: DEFAULT_VIEW,
  stackOrder: { sort: "shared", then: null, likesFirst: true },
});

/** What a share draws from: the page's data, not the sheet's choices. */
export type ShareData = {
  likes: Likes;
  /** Hidden albums: never drawn, whatever the page shows. */
  hidden: Record<string, unknown>;
  /** The app's cover lookup, read when the payload is built. */
  coverFor: CoverFor;
} & (
  | {
      kind: "search";
      search: SearchCache;
      /** The results as the page filters them. */
      releases: ScoredRelease[];
      /** The page's order. */
      selection: { sort: SortKey; then: SortKey | null };
    }
  | {
      kind: "stack";
      /** The stack's root search, for names and contributors. */
      search: SearchCache;
      centre: MapCentre;
      members: SearchCache[];
      levels: Map<string, number>;
      /** The results as the Results tab filters them, or every result. */
      results?: ScoredRelease[];
    }
);

/** What a draft would draw, before covers: for the sheet's controls. */
export interface SharePlan {
  layout: ShareLayout;
  /** The edits, less hidden albums. */
  edits: ShareEdits;
  /** The albums this layout draws around its centre, or lists. */
  shown: ScoredRelease[];
  /** The map has something around its centre. */
  mapReady: boolean;
  /** Albums there are to draw: the list less removed ones, plus added. */
  available: number;
  /** The search the album picker reads (a stack's as one search). */
  pickerSearch: SearchCache;
  /** Keys the picker counts as in the results. */
  visibleKeys: Set<string>;
  /** The stack map's nodes (the centre first); empty for one search. */
  stackNodes: StackNode[];
  /** Albums to find covers for: everything the image may draw. */
  wanted: string[];
  /** The caption the image will carry. */
  caption?: string;
}

/** What a draft draws from `data`. Pure. */
export const planShare = (draft: ShareDraft, data: ShareData): SharePlan => {
  const edits = editsWithoutHidden(draft.edits, data.hidden);
  if (data.kind === "search") {
    const { search, selection } = data;
    const ranked = withoutHidden(
      sortReleases(data.releases, selection.sort, selection.then),
      data.hidden,
    );
    const mapShown = shareSelection(search, ranked, draft.counts.map, edits);
    const cardShown = shareSelection(search, ranked, draft.counts.card, edits);
    const mapReady = mapShown.length > 0;
    const layout: ShareLayout = mapReady ? draft.chosen : "card";
    const shown = layout === "map" ? mapShown : cardShown;
    const caption = [
      selectionCaption(search, shown.length, selection.sort, selection.then),
      editsCaption(edits),
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      layout,
      edits,
      shown,
      mapReady,
      available: available(ranked, edits),
      pickerSearch: search,
      visibleKeys: new Set(ranked.map((r) => r.key)),
      stackNodes: [],
      wanted: draft.view.covers
        ? [search.target?.key ?? "", ...shown.map((r) => r.key)].filter(Boolean)
        : [],
      caption,
    };
  }
  const list = withoutHidden(
    data.results ?? stackResults(data.centre, data.members),
    data.hidden,
  );
  const { stackOrder } = draft;
  const ordered = orderStackResults(
    list,
    stackOrder.sort,
    stackOrder.then,
    data.likes,
    stackOrder.likesFirst,
  );
  const pickerSearch = stackAsSearch(data.search, data.members, list);
  const shown = shareSelection(pickerSearch, ordered, draft.counts.map, edits);
  const stackNodes = layoutStackMap(
    data.centre,
    data.members,
    data.levels,
    data.likes,
    shown.map((r) => r.key),
  );
  return {
    layout: "map",
    edits,
    shown,
    mapReady: stackNodes.length > 1,
    available: available(list, edits),
    pickerSearch,
    visibleKeys: new Set(list.map((r) => r.key)),
    stackNodes,
    wanted: draft.view.covers
      ? [data.centre.key, ...stackNodes.slice(1).map((n) => n.key)]
      : [],
    caption: stackCaption(stackNodes, stackOrder, editsCaption(edits)),
  };
};

const available = (pool: ScoredRelease[], edits: ShareEdits) =>
  new Set([
    ...pool.map((r) => r.key).filter((k) => !edits.removed.includes(k)),
    ...edits.added,
  ]).size;

/**
 * The image a draft makes: its payload, with covers as `data.coverFor`
 * knows them now. Pure apart from that lookup.
 */
export const buildPayload = (
  draft: ShareDraft,
  data: ShareData,
  plan: SharePlan = planShare(draft, data),
): SharePayload => {
  const { coverFor } = data;
  const drawn =
    data.kind === "stack"
      ? stackMapPayload(data.centre, plan.stackNodes, coverFor, plan.caption)
      : plan.layout === "map"
        ? albumMapPayload(
            data.search,
            plan.shown,
            data.likes,
            coverFor,
            plan.caption,
          )
        : cardPayload(
            data.search,
            plan.shown,
            coverFor,
            plan.caption,
            plan.shown.length,
          );
  return withView(drawn, draft.view);
};

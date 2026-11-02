import { defaultDraft, ShareDraft, ShareLayout } from "./share";

/**
 * The share sheet's state per search or stack, in memory while the page
 * is open: closing and reopening the sheet (or leaving the page and coming
 * back) keeps the draft and the image last made. A reload starts afresh.
 */

/** An image the share sheet made, and what it was made from. */
export interface CommittedShare {
  /** The payload it was made from (`serialisePayload`). */
  encoded: string;
  blob: Blob;
  layout: ShareLayout;
  /** For share_created: what it draws. */
  albums: number;
  removed: number;
  added: number;
  bare: boolean;
}

const kept = new Map<
  string,
  { draft: ShareDraft; committed: CommittedShare | null }
>();

/** Most recent shares kept; older ones (and their images) are let go. */
const LIMIT = 20;

export const shareDraft = (key: string): ShareDraft =>
  kept.get(key)?.draft ?? defaultDraft();

export const committedShare = (key: string): CommittedShare | null =>
  kept.get(key)?.committed ?? null;

export const keepShare = (
  key: string,
  draft: ShareDraft,
  committed: CommittedShare | null,
): void => {
  kept.delete(key);
  kept.set(key, { draft, committed });
  while (kept.size > LIMIT) kept.delete(kept.keys().next().value!);
};

/** For tests. */
export const clearShares = (): void => kept.clear();

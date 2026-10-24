/**
 * Resolves once `src` has loaded or failed, after `timeoutMs`, or when
 * `signal` aborts, whichever comes first. Never rejects: a missing image just
 * means the cover shows its placeholder.
 */
export const preloadImage = (
  src: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<void> =>
  new Promise((resolve) => {
    if (!src || signal?.aborted) {
      resolve();
      return;
    }
    const img = new Image();
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      img.onload = img.onerror = null;
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    signal?.addEventListener("abort", done, { once: true });
    img.onload = img.onerror = done;
    img.src = src;
  });

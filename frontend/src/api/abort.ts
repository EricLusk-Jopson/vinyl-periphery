/** Helpers for cancelling the search pipeline with an AbortSignal. */

export const abortError = () =>
  new DOMException("Search cancelled", "AbortError");

export const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

export const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw abortError();
};

/** Waits `ms`, rejecting with an AbortError as soon as `signal` aborts. */
export const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });

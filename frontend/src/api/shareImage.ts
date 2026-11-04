import type { SharePayload } from "@/lib/share";

/**
 * The share image for a payload, rendered by POST /api/og. The same blob
 * is the sheet's preview and the file that's shared or downloaded, so each
 * Regenerate is one request.
 */
export const renderShareImage = async (
  payload: SharePayload,
  signal?: AbortSignal,
): Promise<Blob> => {
  const response = await fetch("/api/og", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok) throw new Error(`Image failed: ${response.status}`);
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error(`Image failed: ${blob.type || "no type"}`);
  }
  return blob;
};

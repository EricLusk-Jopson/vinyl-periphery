import { allowMethods, queryString } from "./http.js";
import { decodePayload } from "../og/payload.js";

/**
 * GET /s?p=<payload>&to=<path> (rewritten to /api/share)
 *
 * The link a share carries. Crawlers read its Open Graph tags (the share
 * image as og:image); people are sent on to the results or stack it came
 * from. Results URLs are static app routes, so they can't carry per-album
 * tags themselves.
 */

/** Same-site app paths only, so this can't redirect anywhere else. */
export const safeTarget = (to) =>
  typeof to === "string" &&
  /^\/(results\?|library\/stack\/)[^\s]*$/.test(to) &&
  !to.startsWith("//")
    ? to
    : "/";

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** The site's origin from the request (Vercel and Express both forward these). */
const originOf = (headers = {}) => {
  const host = String(headers["x-forwarded-host"] || headers.host || "vinylperiphery.com").split(",")[0].trim();
  // Behind Vercel or Heroku the proxy says; locally there's no proxy.
  const fallback = /^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https";
  const proto = String(headers["x-forwarded-proto"] || fallback).split(",")[0].trim();
  return `${proto === "http" ? "http" : "https"}://${host}`;
};

export const shareTitle = (payload) =>
  payload.layout === "card"
    ? `Albums connected to ${payload.album.t} by ${payload.album.r}`
    : `${payload.centre.t} by ${payload.centre.r}, and the albums around it`;

export default function share(req, res) {
  if (!allowMethods(req, res, ["GET", "HEAD"])) return;
  const encoded = queryString(req.query?.p);
  const payload = decodePayload(encoded);
  const to = safeTarget(queryString(req.query?.to));
  const origin = originOf(req.headers);
  const title = payload ? shareTitle(payload) : "Vinyl Periphery";
  const image = payload
    ? `${origin}/api/og?${new URLSearchParams({ p: encoded })}`
    : "";
  const target = `${origin}${to}`;

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:site_name" content="Vinyl Periphery">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="Follow the credit-brick road.">
<meta property="og:type" content="website">
<meta property="og:url" content="${escapeHtml(target)}">
${image ? `<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:width" content="1080">
<meta property="og:image:height" content="1080">
<meta name="twitter:card" content="summary_large_image">` : ""}
<meta http-equiv="refresh" content="0; url=${escapeHtml(to)}">
</head><body>
<p><a href="${escapeHtml(to)}">Open in Vinyl Periphery</a></p>
</body></html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=86400");
  res.status(200);
  res.end(req.method === "HEAD" ? undefined : html);
}

// Small helpers shared by the request handlers.
//
// Handlers use only what both Express and Vercel's Node.js functions provide:
// req.method, req.query, req.body, req.headers, res.status(), res.json(),
// res.setHeader() and res.end(). That keeps one implementation for the
// Express server (Heroku and local dev) and the /api functions (Vercel).

/** Rejects other methods with 405 and an Allow header. */
export function allowMethods(req, res, methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader("Allow", methods.join(", "));
  res.status(405).json({ error: "Method not allowed" });
  return false;
}

/** A query value as a single trimmed string (repeated params take the first). */
export function queryString(value) {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first.trim() : "";
}

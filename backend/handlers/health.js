/** GET /api/health: a cheap check that the API is up. */
export default function health(req, res) {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment:
      process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
  });
}

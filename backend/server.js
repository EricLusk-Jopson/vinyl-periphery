// Express server for local development, and for Heroku until the move to
// Vercel is complete. On Vercel the same handlers run as functions in /api.
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import searchHandler from "./handlers/search.js";
import healthHandler from "./handlers/health.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "../frontend/dist");

const port = process.env.PORT || 5000;
const app = express();

app.use(express.json({ limit: "16kb" }));

/** Runs a shared handler, passing async errors to the error middleware. */
const route = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res)).catch(next);

app.all(["/health", "/api/health"], route(healthHandler));
app.all("/api/search", route(searchHandler));

// Anything else under /api is a JSON 404, not the app's HTML.
app.all("/api/*", (req, res) => res.status(404).json({ error: "Not found" }));

if (process.env.NODE_ENV === "production") {
  // Built frontend, with index.html for client-side routes (/library,
  // /results/...). On Vercel, vercel.json does the same.
  app.use(express.static(distDir));
  app.get("*", (req, res) => res.sendFile(path.join(distDir, "index.html")));
} else {
  app.get("/", (req, res) =>
    res.send("API server running. Open the Vite dev server for the app."),
  );
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong",
    detail: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

app.listen(port, () => console.log(`Server started on port ${port}`));

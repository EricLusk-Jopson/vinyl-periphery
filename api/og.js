// Vercel Function for /api/og. The logic lives in backend/handlers so the
// Express server (local dev, Heroku until cutover) runs the same code.
import handler from "../backend/handlers/og.js";

export default handler;

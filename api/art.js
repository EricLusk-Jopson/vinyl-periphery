// Vercel Function for /api/art. The logic lives in backend/handlers so the
// Express server (local dev, Heroku until cutover) runs the same code.
import handler from "../backend/handlers/art.js";

export default handler;

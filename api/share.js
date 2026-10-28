// Vercel Function for /api/share. The logic lives in backend/handlers so the
// Express server (local dev, Heroku until cutover) runs the same code.
import handler from "../backend/handlers/share.js";

export default handler;

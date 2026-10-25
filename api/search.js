// Vercel Function for GET /api/search. The logic lives in backend/handlers so
// the Express server (local dev, Heroku until cutover) runs the same code.
import handler from "../backend/handlers/search.js";

export default handler;

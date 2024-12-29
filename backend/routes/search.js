import express from "express";
import searchHandler from "../controllers/search.js";

const router = express.Router();
router.get("/", searchHandler);

export default router;

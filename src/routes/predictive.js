import { Router } from "express";
import { runPrediction } from "../controllers/predictiveController.js";

const router = Router();

router.post("/analyze", runPrediction);

export default router;

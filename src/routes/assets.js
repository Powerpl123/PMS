import { Router } from "express";
import { assetController } from "../controllers/index.js";

const router = Router();

router.get("/", assetController.list);
router.get("/:id", assetController.getById);
router.post("/", assetController.create);
router.put("/:id", assetController.update);
router.delete("/:id", assetController.remove);

export default router;

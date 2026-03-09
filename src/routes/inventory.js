import { Router } from "express";
import { inventoryController } from "../controllers/index.js";

const router = Router();

router.get("/", inventoryController.list);
router.get("/:id", inventoryController.getById);
router.post("/", inventoryController.create);
router.put("/:id", inventoryController.update);
router.delete("/:id", inventoryController.remove);

export default router;

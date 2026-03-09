import { Router } from "express";
import { workOrderController } from "../controllers/index.js";

const router = Router();

router.get("/", workOrderController.list);
router.get("/:id", workOrderController.getById);
router.post("/", workOrderController.create);
router.put("/:id", workOrderController.update);
router.delete("/:id", workOrderController.remove);

export default router;

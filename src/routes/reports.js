import { Router } from "express";
import { maintenanceReportController } from "../controllers/index.js";

const router = Router();

router.get("/", maintenanceReportController.list);
router.get("/:id", maintenanceReportController.getById);
router.post("/", maintenanceReportController.create);
router.put("/:id", maintenanceReportController.update);
router.delete("/:id", maintenanceReportController.remove);

export default router;

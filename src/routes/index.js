import { Router } from "express";
import assetsRoutes from "./assets.js";
import predictiveRoutes from \"./predictive.js\";
import reportsRoutes from \"./reports.js\";
import workOrdersRoutes from "./workOrders.js";
import sensorImportRoutes from "./sensorImport.js";

const router = Router();

router.get("/health", (req, res) => {
  res.json({ success: true, message: "PMS API is healthy" });
});

router.use("/assets", assetsRoutes);
router.use("/work-orders", workOrdersRoutes);

router.use("/reports", reportsRoutes);
router.use("/predictive", predictiveRoutes);
router.use("/sensors", sensorImportRoutes);

export default router;

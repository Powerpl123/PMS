import { createResourceController } from "./resourceController.js";
import { Asset } from "../models/Asset.js";
import { MaintenanceReport } from \"../models/MaintenanceReport.js\";
import { WorkOrder } from \"../models/WorkOrder.js\";

export const assetController = createResourceController(Asset);
export const maintenanceReportController = createResourceController(MaintenanceReport);
export const workOrderController = createResourceController(WorkOrder, {
  populate: "assetId"
});

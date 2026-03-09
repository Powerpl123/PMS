import { createResourceController } from "./resourceController.js";
import { Asset } from "../models/Asset.js";
import { InventoryItem } from "../models/InventoryItem.js";
import { MaintenanceReport } from "../models/MaintenanceReport.js";
import { Vendor } from "../models/Vendor.js";
import { WorkOrder } from "../models/WorkOrder.js";

export const assetController = createResourceController(Asset);
export const inventoryController = createResourceController(InventoryItem, {
  populate: "preferredVendorId"
});
export const vendorController = createResourceController(Vendor);
export const maintenanceReportController = createResourceController(MaintenanceReport);
export const workOrderController = createResourceController(WorkOrder, {
  populate: "assetId partsUsed.itemId"
});

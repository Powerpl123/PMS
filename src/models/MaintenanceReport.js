import mongoose from "mongoose";

const maintenanceReportSchema = new mongoose.Schema(
  {
    reportDate: { type: Date, required: true, default: Date.now },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    totalWorkOrders: { type: Number, min: 0, default: 0 },
    completedWorkOrders: { type: Number, min: 0, default: 0 },
    totalLaborHours: { type: Number, min: 0, default: 0 },
    downtimeHours: { type: Number, min: 0, default: 0 },
    totalMaintenanceCost: { type: Number, min: 0, default: 0 },
    complianceNotes: { type: String, trim: true },
    generatedBy: { type: String, trim: true }
  },
  { timestamps: true }
);

export const MaintenanceReport = mongoose.model("MaintenanceReport", maintenanceReportSchema);

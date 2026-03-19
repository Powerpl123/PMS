import mongoose from "mongoose";

const workOrderSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: "Asset", required: true },
    assignedTo: { type: String, trim: true },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium"
    },
    status: {
      type: String,
      enum: ["open", "in-progress", "completed", "cancelled"],
      default: "open"
    },
    dueDate: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    laborHours: { type: Number, min: 0, default: 0 },
    estimatedCost: { type: Number, min: 0, default: 0 },
    actualCost: { type: Number, min: 0, default: 0 },
    attachments: [{ type: String, trim: true }]
  },
  { timestamps: true }
);

workOrderSchema.index({ title: "text", description: "text", assignedTo: "text" });

export const WorkOrder = mongoose.model("WorkOrder", workOrderSchema);

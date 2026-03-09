import mongoose from "mongoose";

const inventoryItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true },
    unitCost: { type: Number, min: 0, default: 0 },
    quantityInStock: { type: Number, min: 0, default: 0 },
    reorderPoint: { type: Number, min: 0, default: 0 },
    preferredVendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
    location: { type: String, trim: true },
    unit: { type: String, trim: true, default: "pcs" }
  },
  { timestamps: true }
);

inventoryItemSchema.virtual("needsReorder").get(function needsReorder() {
  return this.quantityInStock <= this.reorderPoint;
});

inventoryItemSchema.set("toJSON", { virtuals: true });
inventoryItemSchema.set("toObject", { virtuals: true });

export const InventoryItem = mongoose.model("InventoryItem", inventoryItemSchema);

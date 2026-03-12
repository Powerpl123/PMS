import mongoose from "mongoose";

const assetSchema = new mongoose.Schema(
  {
    kksCode: { type: String, trim: true, unique: true, sparse: true },
    name: { type: String, required: true, trim: true },
    serialNumber: { type: String, trim: true, unique: true, sparse: true },
    category: { type: String, trim: true },
    location: { type: String, required: true, trim: true },
    assetType: { type: String, enum: ['PRODUCTION', 'TOOL'], trim: true },
    modelType: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "maintenance", "retired", "inactive"],
      default: "active"
    },
    purchaseDate: { type: Date },
    installDate: { type: Date },
    usefulLifeYears: { type: Number, min: 0 },
    purchaseCost: { type: Number, min: 0, default: 0 },
    currentValue: { type: Number, min: 0, default: 0 },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

assetSchema.index({ name: "text", category: "text", location: "text" });

export const Asset = mongoose.model("Asset", assetSchema);

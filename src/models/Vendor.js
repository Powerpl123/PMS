import mongoose from "mongoose";

const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    contactName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    serviceAgreements: [{ type: String, trim: true }],
    performanceNotes: { type: String, trim: true }
  },
  { timestamps: true }
);

vendorSchema.index({ name: "text", contactName: "text", email: "text" });

export const Vendor = mongoose.model("Vendor", vendorSchema);

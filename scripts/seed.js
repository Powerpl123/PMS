import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pms';

const AssetSchema = new mongoose.Schema({
  name: String, serialNumber: String, category: String, location: String,
  status: { type: String, enum: ['active','maintenance','retired','inactive'], default: 'active' },
  purchaseCost: Number, currentValue: Number, usefulLifeYears: Number, notes: String,
}, { timestamps: true });

const WorkOrderSchema = new mongoose.Schema({
  title: String, description: String, assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset' },
  assignedTo: String, priority: { type: String, enum: ['low','medium','high','critical'], default: 'medium' },
  status: { type: String, enum: ['open','in-progress','completed','cancelled'], default: 'open' },
  dueDate: Date, laborHours: Number, estimatedCost: Number,
}, { timestamps: true });

const InventorySchema = new mongoose.Schema({
  name: String, sku: { type: String, unique: true }, description: String,
  unitCost: Number, quantityInStock: Number, reorderPoint: Number,
  location: String, unit: { type: String, default: 'pcs' },
}, { timestamps: true });

const VendorSchema = new mongoose.Schema({
  name: String, contactName: String, email: String, phone: String,
  address: String, rating: Number, performanceNotes: String,
}, { timestamps: true });

const ReportSchema = new mongoose.Schema({
  periodStart: Date, periodEnd: Date, totalWorkOrders: Number, completedWorkOrders: Number,
  totalLaborHours: Number, downtimeHours: Number, totalMaintenanceCost: Number,
  complianceNotes: String, generatedBy: String,
}, { timestamps: true });

const Asset = mongoose.model('Asset', AssetSchema);
const WorkOrder = mongoose.model('WorkOrder', WorkOrderSchema);
const Inventory = mongoose.model('InventoryItem', InventorySchema);
const Vendor = mongoose.model('Vendor', VendorSchema);
const Report = mongoose.model('MaintenanceReport', ReportSchema);

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  // Clear existing data
  await Promise.all([Asset.deleteMany(), WorkOrder.deleteMany(), Inventory.deleteMany(), Vendor.deleteMany(), Report.deleteMany()]);
  console.log('Cleared existing data');

  // ──── Assets ────
  const assets = await Asset.insertMany([
    { name: 'Steam Turbine Unit 1', serialNumber: 'ST-001-2018', category: 'Turbine', location: 'Unit 1 – Turbine Hall', status: 'active', purchaseCost: 4500000, usefulLifeYears: 30, notes: '660 MW supercritical steam turbine' },
    { name: 'Steam Turbine Unit 2', serialNumber: 'ST-002-2019', category: 'Turbine', location: 'Unit 2 – Turbine Hall', status: 'active', purchaseCost: 4700000, usefulLifeYears: 30, notes: '660 MW supercritical steam turbine' },
    { name: 'Main Generator Unit 1', serialNumber: 'GEN-001-2018', category: 'Generator', location: 'Unit 1 – Turbine Hall', status: 'active', purchaseCost: 3200000, usefulLifeYears: 35, notes: 'Hydrogen-cooled synchronous generator, 750 MVA' },
    { name: 'Main Generator Unit 2', serialNumber: 'GEN-002-2019', category: 'Generator', location: 'Unit 2 – Turbine Hall', status: 'maintenance', purchaseCost: 3400000, usefulLifeYears: 35, notes: 'Hydrogen-cooled synchronous generator, 750 MVA' },
    { name: 'Boiler Drum A', serialNumber: 'BLR-A-2017', category: 'Boiler', location: 'Unit 1 – Boiler Room', status: 'active', purchaseCost: 2800000, usefulLifeYears: 25, notes: 'Supercritical once-through boiler, 2400 t/h steam capacity' },
    { name: 'Boiler Drum B', serialNumber: 'BLR-B-2017', category: 'Boiler', location: 'Unit 2 – Boiler Room', status: 'active', purchaseCost: 2800000, usefulLifeYears: 25, notes: 'Supercritical once-through boiler, 2400 t/h steam capacity' },
    { name: 'Main Step-up Transformer T1', serialNumber: 'TRM-001-2018', category: 'Transformer', location: 'Switchyard', status: 'active', purchaseCost: 1500000, usefulLifeYears: 40, notes: '400 kV, 800 MVA oil-immersed transformer' },
    { name: 'Cooling Tower CT-1', serialNumber: 'CT-001-2018', category: 'Cooling System', location: 'Cooling Tower', status: 'active', purchaseCost: 900000, usefulLifeYears: 20, notes: 'Natural draft hyperbolic cooling tower, 165m height' },
    { name: 'Boiler Feed Pump BFP-1A', serialNumber: 'BFP-1A-2018', category: 'Pump', location: 'Unit 1 – Boiler Room', status: 'active', purchaseCost: 450000, usefulLifeYears: 15, notes: 'Turbine-driven boiler feedwater pump, 1000 m³/h' },
    { name: 'Primary Air Compressor PAC-1', serialNumber: 'PAC-001-2018', category: 'Compressor', location: 'Unit 1 – Boiler Room', status: 'active', purchaseCost: 280000, usefulLifeYears: 18, notes: 'Centrifugal compressor for primary air supply' },
    { name: 'Main Condenser MC-1', serialNumber: 'HE-MC-001', category: 'Heat Exchanger', location: 'Unit 1 – Turbine Hall', status: 'active', purchaseCost: 850000, usefulLifeYears: 25, notes: 'Surface condenser, 50000 m² heat transfer area' },
    { name: 'Emergency Stop Valve ESV-1', serialNumber: 'VLV-ESV-001', category: 'Valve', location: 'Unit 1 – Turbine Hall', status: 'active', purchaseCost: 120000, usefulLifeYears: 20, notes: 'Main steam emergency stop valve, rated at 600°C / 250 bar' },
    { name: 'MCC Panel Unit 1', serialNumber: 'EP-MCC-001', category: 'Electrical Panel', location: 'Control Room', status: 'active', purchaseCost: 75000, usefulLifeYears: 30, notes: 'Motor control center for Unit 1 auxiliaries' },
    { name: 'DCS System', serialNumber: 'DCS-001-2018', category: 'Control System', location: 'Control Room', status: 'active', purchaseCost: 2200000, usefulLifeYears: 15, notes: 'ABB Symphony Plus distributed control system' },
    { name: 'Coal Crusher CC-1', serialNumber: 'CC-001-2017', category: 'Other', location: 'Coal Handling', status: 'active', purchaseCost: 340000, usefulLifeYears: 12, notes: 'Ring granulator type coal crusher, 1200 TPH capacity' },
  ]);
  console.log(`Inserted ${assets.length} assets`);

  // ──── Work Orders ────
  const workOrders = await WorkOrder.insertMany([
    { title: 'Annual Turbine Inspection – Unit 1', description: 'Comprehensive inspection of steam turbine blades, bearings, and seals. Check for erosion and vibration anomalies.', assetId: assets[0]._id, assignedTo: 'Ali Hassan', priority: 'high', status: 'open', dueDate: new Date('2025-02-15'), laborHours: 120, estimatedCost: 85000 },
    { title: 'Generator Rotor Rewinding – Unit 2', description: 'Complete rotor rewinding due to insulation degradation detected during routine testing.', assetId: assets[3]._id, assignedTo: 'Ahmed Khan', priority: 'critical', status: 'in-progress', dueDate: new Date('2025-01-30'), laborHours: 200, estimatedCost: 210000 },
    { title: 'Boiler Tube Leak Repair', description: 'Repair identified tube leak in economizer section. Replace 4 tubes and perform hydrostatic test.', assetId: assets[4]._id, assignedTo: 'Bilal Siddiqui', priority: 'high', status: 'in-progress', dueDate: new Date('2025-01-18'), laborHours: 48, estimatedCost: 32000 },
    { title: 'Transformer Oil Analysis & Filtration', description: 'Routine dissolved gas analysis and oil filtration for main step-up transformer T1.', assetId: assets[6]._id, assignedTo: 'Faisal Mahmood', priority: 'medium', status: 'open', dueDate: new Date('2025-02-01'), laborHours: 16, estimatedCost: 12000 },
    { title: 'Cooling Tower Fill Replacement', description: 'Replace deteriorated PVC fill packs in cooling tower CT-1 sectors 3 and 4.', assetId: assets[7]._id, assignedTo: 'Qaiser Ali', priority: 'medium', status: 'open', dueDate: new Date('2025-03-10'), laborHours: 72, estimatedCost: 45000 },
    { title: 'BFP Mechanical Seal Replacement', description: 'Replace worn mechanical seals on boiler feed pump 1A. Vibration readings exceeding acceptable thresholds.', assetId: assets[8]._id, assignedTo: 'Ali Hassan', priority: 'high', status: 'open', dueDate: new Date('2025-01-22'), laborHours: 24, estimatedCost: 18000 },
    { title: 'DCS Firmware Upgrade', description: 'Upgrade ABB Symphony Plus DCS firmware to latest version. Backup all configurations before upgrade.', assetId: assets[13]._id, assignedTo: 'Usman Raza', priority: 'medium', status: 'open', dueDate: new Date('2025-02-20'), laborHours: 40, estimatedCost: 95000 },
    { title: 'Coal Crusher Hammer Replacement', description: 'Replace worn hammer heads on ring granulator crusher CC-1. Inspect cage bars and liners.', assetId: assets[14]._id, assignedTo: 'Bilal Siddiqui', priority: 'low', status: 'completed', dueDate: new Date('2025-01-05'), laborHours: 32, estimatedCost: 15000 },
  ]);
  console.log(`Inserted ${workOrders.length} work orders`);

  // ──── Spare Parts / Inventory ────
  const inventory = await Inventory.insertMany([
    { name: 'Turbine Blade Set (LP Stage)', sku: 'TB-LP-660', description: 'Low-pressure stage blade set for 660MW steam turbine', unitCost: 85000, quantityInStock: 2, reorderPoint: 1, location: 'Warehouse A – Bay 3', unit: 'sets' },
    { name: 'Generator Carbon Brushes', sku: 'GCB-750MVA', description: 'Electrographite carbon brushes for 750MVA generator', unitCost: 450, quantityInStock: 120, reorderPoint: 40, location: 'Warehouse A – Shelf 12', unit: 'pcs' },
    { name: 'Boiler Tube SA-213 T22', sku: 'BT-T22-50', description: 'Alloy steel superheater tube, 50mm OD x 6mm wall', unitCost: 380, quantityInStock: 85, reorderPoint: 30, location: 'Pipe Yard – Rack 5', unit: 'meters' },
    { name: 'Transformer Oil (IEC 60296)', sku: 'TO-60296-200L', description: 'Inhibited mineral insulating oil, 200L drum', unitCost: 1200, quantityInStock: 8, reorderPoint: 4, location: 'Oil Store', unit: 'drums' },
    { name: 'BFP Mechanical Seal Kit', sku: 'MS-BFP-1000', description: 'Complete mechanical seal assembly for boiler feed pump', unitCost: 12000, quantityInStock: 3, reorderPoint: 2, location: 'Warehouse B – Bay 1', unit: 'kits' },
    { name: 'Cooling Tower PVC Fill Pack', sku: 'CT-PVC-1200', description: 'Cross-flow PVC fill media, 1200mm module', unitCost: 850, quantityInStock: 45, reorderPoint: 20, location: 'Yard Storage', unit: 'modules' },
    { name: 'Coal Crusher Hammer Head', sku: 'CC-HH-RG12', description: 'Manganese steel hammer head for ring granulator', unitCost: 2800, quantityInStock: 15, reorderPoint: 10, location: 'Warehouse B – Bay 4', unit: 'pcs' },
    { name: 'DCS I/O Module (AI16)', sku: 'DCS-AI16-SP', description: 'ABB Symphony Plus analog input module, 16-channel', unitCost: 4500, quantityInStock: 6, reorderPoint: 3, location: 'Control Room Store', unit: 'pcs' },
    { name: 'High-Pressure Safety Valve Spring', sku: 'SV-HP-250', description: 'Safety valve spring for 250 bar rated valves', unitCost: 3200, quantityInStock: 4, reorderPoint: 2, location: 'Warehouse A – Bay 7', unit: 'pcs' },
    { name: 'Bearing Assembly (Turbine Journal)', sku: 'BA-TJ-660', description: 'Journal bearing for 660MW turbine, babbitt-lined', unitCost: 45000, quantityInStock: 1, reorderPoint: 1, location: 'Warehouse A – Bay 1', unit: 'pcs' },
  ]);
  console.log(`Inserted ${inventory.length} spare parts`);

  // ──── Vendors / Suppliers ────
  const vendors = await Vendor.insertMany([
    { name: 'Siemens Energy Pakistan', contactName: 'Farhan Aziz', email: 'farhan.aziz@siemens-energy.pk', phone: '+92-51-2871234', address: 'Islamabad, Pakistan', rating: 4.8, performanceNotes: 'Primary turbine and generator OEM. Excellent response for critical spares.' },
    { name: 'ABB Power Systems', contactName: 'Sarah Williams', email: 's.williams@abb.com', phone: '+41-58-585-0000', address: 'Zurich, Switzerland', rating: 4.5, performanceNotes: 'DCS supplier. Good technical support, long lead times for specialized modules.' },
    { name: 'Pak Boiler Industries', contactName: 'Irfan Malik', email: 'irfan@pakboiler.com.pk', phone: '+92-42-3587654', address: 'Lahore, Pakistan', rating: 4.0, performanceNotes: 'Local boiler tube supplier. Competitive pricing, acceptable quality.' },
    { name: 'National Transformers Ltd', contactName: 'Kashif Raza', email: 'kashif@ntl.com.pk', phone: '+92-42-3541111', address: 'Lahore, Pakistan', rating: 4.2, performanceNotes: 'Transformer oil and accessories. Reliable delivery schedule.' },
    { name: 'FlowServe Pumps', contactName: 'David Chen', email: 'd.chen@flowserve.com', phone: '+1-972-443-6500', address: 'Dallas, Texas, USA', rating: 4.6, performanceNotes: 'OEM for boiler feed pumps. Premium quality seals and spare parts.' },
    { name: 'CoolTech Engineering', contactName: 'Naveed Ahmed', email: 'naveed@cooltech.pk', phone: '+92-51-4431000', address: 'Rawalpindi, Pakistan', rating: 3.8, performanceNotes: 'Cooling tower maintenance and fill media. Good local support.' },
  ]);
  console.log(`Inserted ${vendors.length} suppliers`);

  // ──── Reports ────
  const reports = await Report.insertMany([
    { periodStart: new Date('2024-10-01'), periodEnd: new Date('2024-10-31'), totalWorkOrders: 28, completedWorkOrders: 24, totalLaborHours: 640, downtimeHours: 12, totalMaintenanceCost: 185000, generatedBy: 'Plant Manager', complianceNotes: 'All safety inspections passed. Minor boiler tube thinning reported in Unit 2.' },
    { periodStart: new Date('2024-11-01'), periodEnd: new Date('2024-11-30'), totalWorkOrders: 34, completedWorkOrders: 30, totalLaborHours: 780, downtimeHours: 24, totalMaintenanceCost: 320000, generatedBy: 'Plant Manager', complianceNotes: 'Generator Unit 2 taken offline for planned rotor inspection. Cooling tower chemical treatment adjusted.' },
    { periodStart: new Date('2024-12-01'), periodEnd: new Date('2024-12-31'), totalWorkOrders: 22, completedWorkOrders: 19, totalLaborHours: 520, downtimeHours: 8, totalMaintenanceCost: 142000, generatedBy: 'Plant Manager', complianceNotes: 'Year-end compliance audit completed. All environmental parameters within limits.' },
  ]);
  console.log(`Inserted ${reports.length} reports`);

  console.log('\n✅ Power plant seed data loaded successfully!');
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });

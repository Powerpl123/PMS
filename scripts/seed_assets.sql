-- ============================================================
-- Power Plant Assets — Comprehensive Seed Data
-- Run this in the Supabase SQL Editor to populate assets
-- ============================================================

-- Clear existing assets (optional — remove this line to keep existing)
-- DELETE FROM assets;

INSERT INTO assets (name, serial_number, category, location, status, purchase_cost, useful_life_years, notes) VALUES

-- ═══════════════════════════════════════════
-- TURBINES
-- ═══════════════════════════════════════════
('Steam Turbine Unit 1 – HP Section',        'ST-HP-001',   'Turbine',        'Unit 1 – Turbine Hall', 'active',    4500000, 30, 'High-pressure section, 660 MW supercritical steam turbine'),
('Steam Turbine Unit 1 – IP Section',        'ST-IP-001',   'Turbine',        'Unit 1 – Turbine Hall', 'active',    3800000, 30, 'Intermediate-pressure section'),
('Steam Turbine Unit 1 – LP Section A',      'ST-LPA-001',  'Turbine',        'Unit 1 – Turbine Hall', 'active',    3200000, 30, 'Low-pressure section A, double-flow'),
('Steam Turbine Unit 1 – LP Section B',      'ST-LPB-001',  'Turbine',        'Unit 1 – Turbine Hall', 'active',    3200000, 30, 'Low-pressure section B, double-flow'),
('Steam Turbine Unit 2 – HP Section',        'ST-HP-002',   'Turbine',        'Unit 2 – Turbine Hall', 'active',    4700000, 30, 'High-pressure section, 660 MW supercritical steam turbine'),
('Steam Turbine Unit 2 – IP Section',        'ST-IP-002',   'Turbine',        'Unit 2 – Turbine Hall', 'active',    3900000, 30, 'Intermediate-pressure section'),
('Steam Turbine Unit 2 – LP Section A',      'ST-LPA-002',  'Turbine',        'Unit 2 – Turbine Hall', 'active',    3200000, 30, 'Low-pressure section A, double-flow'),
('Steam Turbine Unit 2 – LP Section B',      'ST-LPB-002',  'Turbine',        'Unit 2 – Turbine Hall', 'active',    3200000, 30, 'Low-pressure section B, double-flow'),

-- ═══════════════════════════════════════════
-- GENERATORS
-- ═══════════════════════════════════════════
('Main Generator Unit 1',                    'GEN-001',     'Generator',      'Unit 1 – Turbine Hall', 'active',    3200000, 35, 'Hydrogen-cooled synchronous generator, 750 MVA'),
('Main Generator Unit 2',                    'GEN-002',     'Generator',      'Unit 2 – Turbine Hall', 'active',    3400000, 35, 'Hydrogen-cooled synchronous generator, 750 MVA'),
('Exciter Unit 1',                           'EXC-001',     'Generator',      'Unit 1 – Turbine Hall', 'active',     250000, 25, 'Brushless excitation system for Generator 1'),
('Exciter Unit 2',                           'EXC-002',     'Generator',      'Unit 2 – Turbine Hall', 'active',     250000, 25, 'Brushless excitation system for Generator 2'),
('Emergency Diesel Generator EDG-1',         'EDG-001',     'Generator',      'Control Room',          'active',     600000, 20, '2 MW diesel generator for emergency backup power'),
('Emergency Diesel Generator EDG-2',         'EDG-002',     'Generator',      'Control Room',          'active',     600000, 20, '2 MW diesel generator for emergency backup power'),

-- ═══════════════════════════════════════════
-- BOILERS
-- ═══════════════════════════════════════════
('Boiler Drum Unit 1',                       'BLR-DR-001',  'Boiler',         'Unit 1 – Boiler Room',  'active',    2800000, 25, 'Supercritical once-through boiler, 2400 t/h steam capacity'),
('Boiler Drum Unit 2',                       'BLR-DR-002',  'Boiler',         'Unit 2 – Boiler Room',  'active',    2800000, 25, 'Supercritical once-through boiler, 2400 t/h steam capacity'),
('Superheater Unit 1',                       'BLR-SH-001',  'Boiler',         'Unit 1 – Boiler Room',  'active',    1200000, 20, 'Primary and secondary superheater sections'),
('Superheater Unit 2',                       'BLR-SH-002',  'Boiler',         'Unit 2 – Boiler Room',  'active',    1200000, 20, 'Primary and secondary superheater sections'),
('Reheater Unit 1',                          'BLR-RH-001',  'Boiler',         'Unit 1 – Boiler Room',  'active',     950000, 20, 'Reheat section for intermediate-pressure steam'),
('Reheater Unit 2',                          'BLR-RH-002',  'Boiler',         'Unit 2 – Boiler Room',  'active',     950000, 20, 'Reheat section for intermediate-pressure steam'),
('Economizer Unit 1',                        'BLR-EC-001',  'Boiler',         'Unit 1 – Boiler Room',  'active',     650000, 20, 'Feedwater pre-heater using flue gas heat'),
('Economizer Unit 2',                        'BLR-EC-002',  'Boiler',         'Unit 2 – Boiler Room',  'active',     650000, 20, 'Feedwater pre-heater using flue gas heat'),
('Air Pre-Heater Unit 1',                    'BLR-APH-001', 'Boiler',         'Unit 1 – Boiler Room',  'active',     480000, 18, 'Ljungström rotary air pre-heater'),
('Air Pre-Heater Unit 2',                    'BLR-APH-002', 'Boiler',         'Unit 2 – Boiler Room',  'active',     480000, 18, 'Ljungström rotary air pre-heater'),
('Burner Assembly Unit 1',                   'BLR-BN-001',  'Boiler',         'Unit 1 – Boiler Room',  'active',     380000, 15, 'Low-NOx burner system, 24 burners in tangential arrangement'),
('Burner Assembly Unit 2',                   'BLR-BN-002',  'Boiler',         'Unit 2 – Boiler Room',  'active',     380000, 15, 'Low-NOx burner system, 24 burners in tangential arrangement'),

-- ═══════════════════════════════════════════
-- TRANSFORMERS
-- ═══════════════════════════════════════════
('Main Step-Up Transformer T1',              'TRF-MSU-001', 'Transformer',    'Switchyard',            'active',    1500000, 40, '400 kV, 800 MVA oil-immersed transformer'),
('Main Step-Up Transformer T2',              'TRF-MSU-002', 'Transformer',    'Switchyard',            'active',    1500000, 40, '400 kV, 800 MVA oil-immersed transformer'),
('Unit Auxiliary Transformer UAT-1',         'TRF-UAT-001', 'Transformer',    'Switchyard',            'active',     450000, 35, '6.6 kV auxiliary power transformer, 40 MVA'),
('Unit Auxiliary Transformer UAT-2',         'TRF-UAT-002', 'Transformer',    'Switchyard',            'active',     450000, 35, '6.6 kV auxiliary power transformer, 40 MVA'),
('Station Service Transformer SST-1',       'TRF-SST-001', 'Transformer',    'Switchyard',            'active',     320000, 35, '415V station service transformer, 5 MVA'),
('Station Service Transformer SST-2',       'TRF-SST-002', 'Transformer',    'Switchyard',            'active',     320000, 35, '415V station service transformer, 5 MVA'),

-- ═══════════════════════════════════════════
-- COOLING SYSTEMS
-- ═══════════════════════════════════════════
('Cooling Tower CT-1',                       'CT-001',      'Cooling System', 'Cooling Tower',         'active',     900000, 20, 'Natural draft hyperbolic cooling tower, 165m height'),
('Cooling Tower CT-2',                       'CT-002',      'Cooling System', 'Cooling Tower',         'active',     900000, 20, 'Natural draft hyperbolic cooling tower, 165m height'),
('Circulating Water Pump CWP-1A',           'CWP-1A',      'Cooling System', 'Cooling Tower',         'active',     350000, 20, 'Vertical mixed-flow pump, 36000 m³/h'),
('Circulating Water Pump CWP-1B',           'CWP-1B',      'Cooling System', 'Cooling Tower',         'active',     350000, 20, 'Vertical mixed-flow pump, 36000 m³/h (standby)'),
('Circulating Water Pump CWP-2A',           'CWP-2A',      'Cooling System', 'Cooling Tower',         'active',     350000, 20, 'Vertical mixed-flow pump, 36000 m³/h'),
('Circulating Water Pump CWP-2B',           'CWP-2B',      'Cooling System', 'Cooling Tower',         'active',     350000, 20, 'Vertical mixed-flow pump, 36000 m³/h (standby)'),
('Cooling Water Chemical Dosing System',     'CT-CDS-001',  'Cooling System', 'Water Treatment',       'active',      85000, 15, 'Chlorination and anti-scaling dosing system'),

-- ═══════════════════════════════════════════
-- PUMPS
-- ═══════════════════════════════════════════
('Boiler Feed Pump BFP-1A',                 'BFP-1A',      'Pump',           'Unit 1 – Boiler Room',  'active',     450000, 15, 'Turbine-driven boiler feedwater pump, 1000 m³/h'),
('Boiler Feed Pump BFP-1B',                 'BFP-1B',      'Pump',           'Unit 1 – Boiler Room',  'active',     450000, 15, 'Motor-driven boiler feedwater pump, 1000 m³/h (standby)'),
('Boiler Feed Pump BFP-2A',                 'BFP-2A',      'Pump',           'Unit 2 – Boiler Room',  'active',     450000, 15, 'Turbine-driven boiler feedwater pump, 1000 m³/h'),
('Boiler Feed Pump BFP-2B',                 'BFP-2B',      'Pump',           'Unit 2 – Boiler Room',  'active',     450000, 15, 'Motor-driven boiler feedwater pump, 1000 m³/h (standby)'),
('Condensate Extraction Pump CEP-1A',       'CEP-1A',      'Pump',           'Unit 1 – Turbine Hall', 'active',     180000, 15, 'Vertical can-type pump, 800 m³/h'),
('Condensate Extraction Pump CEP-1B',       'CEP-1B',      'Pump',           'Unit 1 – Turbine Hall', 'active',     180000, 15, 'Vertical can-type pump, 800 m³/h (standby)'),
('Condensate Extraction Pump CEP-2A',       'CEP-2A',      'Pump',           'Unit 2 – Turbine Hall', 'active',     180000, 15, 'Vertical can-type pump, 800 m³/h'),
('Condensate Extraction Pump CEP-2B',       'CEP-2B',      'Pump',           'Unit 2 – Turbine Hall', 'active',     180000, 15, 'Vertical can-type pump, 800 m³/h (standby)'),
('Lube Oil Pump LOP-1',                     'LOP-001',     'Pump',           'Unit 1 – Turbine Hall', 'active',      65000, 12, 'AC motor-driven lube oil pump for turbine bearings'),
('Lube Oil Pump LOP-2',                     'LOP-002',     'Pump',           'Unit 2 – Turbine Hall', 'active',      65000, 12, 'AC motor-driven lube oil pump for turbine bearings'),
('Emergency Lube Oil Pump (DC)',             'ELOP-001',    'Pump',           'Unit 1 – Turbine Hall', 'active',      42000, 12, 'DC-driven emergency lube oil pump'),
('Jacking Oil Pump JOP-1',                  'JOP-001',     'Pump',           'Unit 1 – Turbine Hall', 'active',      38000, 12, 'High-pressure jacking oil pump for turbine turning gear'),
('Fire Water Pump FWP-1',                   'FWP-001',     'Pump',           'Fuel Storage',          'active',     120000, 20, 'Diesel-driven fire water pump, 500 m³/h'),
('Fire Water Pump FWP-2 (Jockey)',          'FWP-002',     'Pump',           'Fuel Storage',          'active',      45000, 20, 'Electric jockey pump for fire water system'),
('Ash Slurry Pump ASP-1',                   'ASP-001',     'Pump',           'Ash Handling',          'active',      95000, 10, 'Heavy-duty slurry pump for bottom ash disposal'),
('Ash Slurry Pump ASP-2',                   'ASP-002',     'Pump',           'Ash Handling',          'active',      95000, 10, 'Heavy-duty slurry pump for fly ash disposal'),

-- ═══════════════════════════════════════════
-- COMPRESSORS
-- ═══════════════════════════════════════════
('Primary Air Fan PAF-1A',                  'PAF-1A',      'Compressor',     'Unit 1 – Boiler Room',  'active',     280000, 18, 'Centrifugal fan for primary air supply to coal mills'),
('Primary Air Fan PAF-1B',                  'PAF-1B',      'Compressor',     'Unit 1 – Boiler Room',  'active',     280000, 18, 'Centrifugal fan for primary air supply (standby)'),
('Primary Air Fan PAF-2A',                  'PAF-2A',      'Compressor',     'Unit 2 – Boiler Room',  'active',     280000, 18, 'Centrifugal fan for primary air supply to coal mills'),
('Forced Draft Fan FDF-1A',                 'FDF-1A',      'Compressor',     'Unit 1 – Boiler Room',  'active',     320000, 18, 'Axial-flow forced draft fan, 600 m³/s'),
('Forced Draft Fan FDF-1B',                 'FDF-1B',      'Compressor',     'Unit 1 – Boiler Room',  'active',     320000, 18, 'Axial-flow forced draft fan (standby)'),
('Forced Draft Fan FDF-2A',                 'FDF-2A',      'Compressor',     'Unit 2 – Boiler Room',  'active',     320000, 18, 'Axial-flow forced draft fan, 600 m³/s'),
('Induced Draft Fan IDF-1A',                'IDF-1A',      'Compressor',     'Unit 1 – Boiler Room',  'active',     380000, 18, 'Centrifugal induced draft fan, 800 m³/s'),
('Induced Draft Fan IDF-1B',                'IDF-1B',      'Compressor',     'Unit 1 – Boiler Room',  'active',     380000, 18, 'Centrifugal induced draft fan (standby)'),
('Induced Draft Fan IDF-2A',                'IDF-2A',      'Compressor',     'Unit 2 – Boiler Room',  'active',     380000, 18, 'Centrifugal induced draft fan, 800 m³/s'),
('Instrument Air Compressor IAC-1',         'IAC-001',     'Compressor',     'Control Room',          'active',     120000, 15, 'Oil-free screw compressor, 10 bar, 50 m³/min'),
('Instrument Air Compressor IAC-2',         'IAC-002',     'Compressor',     'Control Room',          'active',     120000, 15, 'Oil-free screw compressor (standby)'),
('Service Air Compressor SAC-1',            'SAC-001',     'Compressor',     'Control Room',          'active',      85000, 15, 'Screw compressor for service air, 7 bar'),

-- ═══════════════════════════════════════════
-- HEAT EXCHANGERS
-- ═══════════════════════════════════════════
('Main Condenser Unit 1',                   'MC-001',      'Heat Exchanger', 'Unit 1 – Turbine Hall', 'active',     850000, 25, 'Surface condenser, 50000 m² heat transfer area'),
('Main Condenser Unit 2',                   'MC-002',      'Heat Exchanger', 'Unit 2 – Turbine Hall', 'active',     850000, 25, 'Surface condenser, 50000 m² heat transfer area'),
('LP Feedwater Heater FWH-1',              'FWH-LP-001',  'Heat Exchanger', 'Unit 1 – Turbine Hall', 'active',     220000, 20, 'Low-pressure feedwater heater #1'),
('LP Feedwater Heater FWH-2',              'FWH-LP-002',  'Heat Exchanger', 'Unit 1 – Turbine Hall', 'active',     220000, 20, 'Low-pressure feedwater heater #2'),
('LP Feedwater Heater FWH-3',              'FWH-LP-003',  'Heat Exchanger', 'Unit 1 – Turbine Hall', 'active',     220000, 20, 'Low-pressure feedwater heater #3'),
('HP Feedwater Heater FWH-6',              'FWH-HP-006',  'Heat Exchanger', 'Unit 1 – Boiler Room',  'active',     350000, 20, 'High-pressure feedwater heater #6'),
('HP Feedwater Heater FWH-7',              'FWH-HP-007',  'Heat Exchanger', 'Unit 1 – Boiler Room',  'active',     350000, 20, 'High-pressure feedwater heater #7'),
('Deaerator Unit 1',                        'DEA-001',     'Heat Exchanger', 'Unit 1 – Boiler Room',  'active',     280000, 25, 'Direct-contact deaerator with storage tank, 1200 m³/h'),
('Deaerator Unit 2',                        'DEA-002',     'Heat Exchanger', 'Unit 2 – Boiler Room',  'active',     280000, 25, 'Direct-contact deaerator with storage tank, 1200 m³/h'),
('Gland Steam Condenser GSC-1',            'GSC-001',     'Heat Exchanger', 'Unit 1 – Turbine Hall', 'active',      95000, 20, 'Turbine gland steam condenser'),
('Lube Oil Cooler LOC-1',                   'LOC-001',     'Heat Exchanger', 'Unit 1 – Turbine Hall', 'active',      55000, 15, 'Shell and tube lube oil cooler'),
('Hydrogen Cooler (Generator) HC-1',        'HC-001',      'Heat Exchanger', 'Unit 1 – Turbine Hall', 'active',     120000, 20, 'Generator hydrogen gas cooler'),

-- ═══════════════════════════════════════════
-- VALVES
-- ═══════════════════════════════════════════
('Main Steam Stop Valve MSSV-1',            'VLV-MSSV-001','Valve',          'Unit 1 – Turbine Hall', 'active',     120000, 20, 'Main steam emergency stop valve, 600°C / 250 bar'),
('Main Steam Stop Valve MSSV-2',            'VLV-MSSV-002','Valve',          'Unit 2 – Turbine Hall', 'active',     120000, 20, 'Main steam emergency stop valve, 600°C / 250 bar'),
('Control Valve CV-1 (HP Turbine)',         'VLV-CV-001',  'Valve',          'Unit 1 – Turbine Hall', 'active',      95000, 15, 'HP turbine steam control valve'),
('Control Valve CV-2 (HP Turbine)',         'VLV-CV-002',  'Valve',          'Unit 2 – Turbine Hall', 'active',      95000, 15, 'HP turbine steam control valve'),
('Reheat Stop Valve RSV-1',                'VLV-RSV-001', 'Valve',          'Unit 1 – Turbine Hall', 'active',      85000, 20, 'Reheat steam stop valve'),
('Reheat Intercept Valve RIV-1',            'VLV-RIV-001', 'Valve',          'Unit 1 – Turbine Hall', 'active',      78000, 20, 'Reheat intercept valve for overspeed protection'),
('Boiler Safety Valve SV-1A',              'VLV-SV-1A',   'Valve',          'Unit 1 – Boiler Room',  'active',      65000, 15, 'Spring-loaded safety valve, 270 bar set pressure'),
('Boiler Safety Valve SV-1B',              'VLV-SV-1B',   'Valve',          'Unit 1 – Boiler Room',  'active',      65000, 15, 'Spring-loaded safety valve, 270 bar set pressure'),
('Boiler Safety Valve SV-2A',              'VLV-SV-2A',   'Valve',          'Unit 2 – Boiler Room',  'active',      65000, 15, 'Spring-loaded safety valve, 270 bar set pressure'),
('Feedwater Regulating Valve FRV-1',        'VLV-FRV-001', 'Valve',          'Unit 1 – Boiler Room',  'active',      72000, 15, 'Boiler feedwater regulation valve, pneumatic actuated'),
('Attemperator Spray Valve ATV-1',          'VLV-ATV-001', 'Valve',          'Unit 1 – Boiler Room',  'active',      48000, 15, 'Superheater attemperator spray valve'),

-- ═══════════════════════════════════════════
-- ELECTRICAL PANELS
-- ═══════════════════════════════════════════
('MCC Panel Unit 1',                        'EP-MCC-001',  'Electrical Panel','Control Room',          'active',      75000, 30, 'Motor control center for Unit 1 auxiliaries'),
('MCC Panel Unit 2',                        'EP-MCC-002',  'Electrical Panel','Control Room',          'active',      75000, 30, 'Motor control center for Unit 2 auxiliaries'),
('6.6 kV Switchgear SWG-1',                'EP-SWG-001',  'Electrical Panel','Switchyard',            'active',     280000, 30, '6.6 kV vacuum circuit breaker switchgear, Unit 1'),
('6.6 kV Switchgear SWG-2',                'EP-SWG-002',  'Electrical Panel','Switchyard',            'active',     280000, 30, '6.6 kV vacuum circuit breaker switchgear, Unit 2'),
('415V Distribution Board DB-1',            'EP-DB-001',   'Electrical Panel','Control Room',          'active',      35000, 25, '415V main distribution board'),
('DC Distribution Panel 220V',              'EP-DC-001',   'Electrical Panel','Control Room',          'active',      55000, 25, '220V DC distribution panel with battery charger'),
('Battery Bank 220V DC',                    'EP-BAT-001',  'Electrical Panel','Control Room',          'active',      90000, 10, '220V DC battery bank, 1000 Ah lead-acid'),
('UPS System 120 kVA',                      'EP-UPS-001',  'Electrical Panel','Control Room',          'active',      65000, 10, 'Uninterruptible power supply for critical controls'),
('Generator Protection Relay Panel',        'EP-GPR-001',  'Electrical Panel','Control Room',          'active',     120000, 20, 'Numerical generator protection relay panel'),
('Bus Coupler Panel',                       'EP-BCP-001',  'Electrical Panel','Switchyard',            'active',     180000, 30, '400 kV bus coupler with SF6 circuit breaker'),

-- ═══════════════════════════════════════════
-- CONTROL SYSTEMS
-- ═══════════════════════════════════════════
('DCS System – Main Controller',            'DCS-MC-001',  'Control System', 'Control Room',          'active',    2200000, 15, 'ABB Symphony Plus distributed control system'),
('DCS Operator Workstation OWS-1',          'DCS-OWS-001', 'Control System', 'Control Room',          'active',      45000, 8,  'Operator workstation with dual monitors'),
('DCS Operator Workstation OWS-2',          'DCS-OWS-002', 'Control System', 'Control Room',          'active',      45000, 8,  'Operator workstation with dual monitors'),
('DCS Engineering Workstation EWS',         'DCS-EWS-001', 'Control System', 'Control Room',          'active',      55000, 8,  'Engineering workstation for configuration'),
('DCS Historian Server',                    'DCS-HIS-001', 'Control System', 'Control Room',          'active',      85000, 8,  'Process data historian, 1-year rolling storage'),
('Turbine Control System (EHC)',            'TCS-EHC-001', 'Control System', 'Unit 1 – Turbine Hall', 'active',     650000, 15, 'Electro-hydraulic turbine governor and protection'),
('Turbine Control System (EHC) U2',         'TCS-EHC-002', 'Control System', 'Unit 2 – Turbine Hall', 'active',     650000, 15, 'Electro-hydraulic turbine governor and protection'),
('Burner Management System BMS-1',          'BMS-001',     'Control System', 'Unit 1 – Boiler Room',  'active',     380000, 15, 'SIL-2 rated burner management system'),
('Burner Management System BMS-2',          'BMS-002',     'Control System', 'Unit 2 – Boiler Room',  'active',     380000, 15, 'SIL-2 rated burner management system'),
('CEMS – Emissions Monitoring',             'CEMS-001',    'Control System', 'Unit 1 – Boiler Room',  'active',     320000, 12, 'Continuous emissions monitoring system (SO2, NOx, PM)'),
('CEMS – Emissions Monitoring U2',          'CEMS-002',    'Control System', 'Unit 2 – Boiler Room',  'active',     320000, 12, 'Continuous emissions monitoring system (SO2, NOx, PM)'),
('Fire Alarm & Detection System',           'FADS-001',    'Control System', 'Control Room',          'active',     180000, 15, 'Addressable fire alarm panel with smoke/heat detectors'),
('CCTV Surveillance System',                'CCTV-001',    'Control System', 'Control Room',          'active',      95000, 10, '64-channel NVR with IP cameras, plant-wide coverage'),

-- ═══════════════════════════════════════════
-- COAL HANDLING
-- ═══════════════════════════════════════════
('Coal Crusher CC-1',                       'CC-001',      'Other',          'Coal Handling',         'active',     340000, 12, 'Ring granulator type coal crusher, 1200 TPH'),
('Coal Crusher CC-2',                       'CC-002',      'Other',          'Coal Handling',         'active',     340000, 12, 'Ring granulator type coal crusher, 1200 TPH'),
('Stacker Reclaimer SR-1',                  'SR-001',      'Other',          'Coal Handling',         'active',    1200000, 20, 'Boom-type stacker reclaimer, 2500 TPH stacking capacity'),
('Coal Conveyor Belt CB-1',                 'CB-001',      'Other',          'Coal Handling',         'active',     180000, 15, 'Main belt conveyor, 1800mm width, 2000 TPH'),
('Coal Conveyor Belt CB-2',                 'CB-002',      'Other',          'Coal Handling',         'active',     180000, 15, 'Transfer conveyor to bunker, 1400mm width'),
('Coal Mill / Pulverizer CM-1A',            'CM-1A',       'Other',          'Unit 1 – Boiler Room',  'active',     420000, 15, 'Bowl mill pulverizer, 80 TPH capacity'),
('Coal Mill / Pulverizer CM-1B',            'CM-1B',       'Other',          'Unit 1 – Boiler Room',  'active',     420000, 15, 'Bowl mill pulverizer, 80 TPH capacity'),
('Coal Mill / Pulverizer CM-1C',            'CM-1C',       'Other',          'Unit 1 – Boiler Room',  'active',     420000, 15, 'Bowl mill pulverizer (standby)'),
('Coal Mill / Pulverizer CM-2A',            'CM-2A',       'Other',          'Unit 2 – Boiler Room',  'active',     420000, 15, 'Bowl mill pulverizer, 80 TPH capacity'),
('Coal Mill / Pulverizer CM-2B',            'CM-2B',       'Other',          'Unit 2 – Boiler Room',  'active',     420000, 15, 'Bowl mill pulverizer, 80 TPH capacity'),
('Magnetic Separator MS-1',                 'MS-001',      'Other',          'Coal Handling',         'active',      35000, 15, 'Overhead permanent magnet separator'),
('Coal Sampling System CSS-1',              'CSS-001',     'Other',          'Coal Handling',         'active',      85000, 12, 'Automatic coal sampling & preparation system'),

-- ═══════════════════════════════════════════
-- ASH HANDLING
-- ═══════════════════════════════════════════
('Electrostatic Precipitator ESP-1',        'ESP-001',     'Other',          'Unit 1 – Boiler Room',  'active',    1800000, 25, '4-field ESP, 99.9% collection efficiency'),
('Electrostatic Precipitator ESP-2',        'ESP-002',     'Other',          'Unit 2 – Boiler Room',  'active',    1800000, 25, '4-field ESP, 99.9% collection efficiency'),
('Bottom Ash Hopper BAH-1',                'BAH-001',     'Other',          'Ash Handling',          'active',     120000, 20, 'Submerged scraper conveyor type'),
('Bottom Ash Hopper BAH-2',                'BAH-002',     'Other',          'Ash Handling',          'active',     120000, 20, 'Submerged scraper conveyor type'),
('Fly Ash Silo FAS-1',                     'FAS-001',     'Other',          'Ash Handling',          'active',     250000, 25, 'Fly ash storage silo, 5000 MT capacity'),
('Ash Disposal Pipeline ADP-1',            'ADP-001',     'Other',          'Ash Handling',          'active',     160000, 15, 'HDPE-lined ash slurry pipeline to ash pond'),

-- ═══════════════════════════════════════════
-- WATER TREATMENT
-- ═══════════════════════════════════════════
('DM Water Plant',                          'WTP-DM-001',  'Other',          'Water Treatment',       'active',     650000, 20, 'Demineralized water plant, 200 m³/h capacity'),
('RO Water Treatment System',              'WTP-RO-001',  'Other',          'Water Treatment',       'active',     420000, 15, 'Reverse osmosis system, 150 m³/h'),
('Mixed Bed Polisher MBP-1',               'WTP-MBP-001', 'Other',          'Water Treatment',       'active',      95000, 15, 'Condensate polishing mixed bed ion exchanger'),
('Chemical Dosing System – Boiler',         'WTP-CDS-001', 'Other',          'Water Treatment',       'active',      65000, 12, 'Phosphate and hydrazine dosing for boiler water chemistry'),
('Effluent Treatment Plant ETP',            'WTP-ETP-001', 'Other',          'Water Treatment',       'active',     380000, 20, 'Zero liquid discharge effluent treatment'),
('Raw Water Clarifier',                     'WTP-CL-001',  'Other',          'Water Treatment',       'active',     180000, 25, 'Lamella clarifier for raw water treatment'),

-- ═══════════════════════════════════════════
-- FUEL STORAGE
-- ═══════════════════════════════════════════
('Fuel Oil Storage Tank FOT-1',             'FOT-001',     'Other',          'Fuel Storage',          'active',     220000, 30, 'Light diesel oil storage tank, 500 KL'),
('Fuel Oil Storage Tank FOT-2',             'FOT-002',     'Other',          'Fuel Storage',          'active',     220000, 30, 'Heavy fuel oil storage tank, 1000 KL'),
('Fuel Oil Heater FOH-1',                   'FOH-001',     'Other',          'Fuel Storage',          'active',      45000, 15, 'Steam-heated HFO heater for combustion viscosity'),
('Fuel Oil Pump Station FOPS-1',            'FOPS-001',    'Other',          'Fuel Storage',          'active',      85000, 15, 'HFO transfer and atomization pump station'),

-- ═══════════════════════════════════════════
-- MISCELLANEOUS / AUXILIARY
-- ═══════════════════════════════════════════
('Overhead Crane – Turbine Hall (100T)',    'OHC-TH-001',  'Other',          'Unit 1 – Turbine Hall', 'active',     450000, 30, '100-ton EOT crane for turbine maintenance'),
('Overhead Crane – Boiler House (50T)',     'OHC-BH-001',  'Other',          'Unit 1 – Boiler Room',  'active',     280000, 30, '50-ton EOT crane'),
('Compressed Air Receiver Tank',            'CA-TANK-001', 'Other',          'Control Room',          'active',      25000, 25, '10 m³ compressed air receiver at 10 bar'),
('Hydrogen Generation Plant',              'HGP-001',     'Other',          'Control Room',          'active',     180000, 15, 'Electrolyzer for generator hydrogen supply, 99.999% purity'),
('Turbine Turning Gear TG-1',              'TG-001',      'Other',          'Unit 1 – Turbine Hall', 'active',      65000, 20, 'Electric motor-driven turning gear, 3 RPM'),
('Turbine Turning Gear TG-2',              'TG-002',      'Other',          'Unit 2 – Turbine Hall', 'active',      65000, 20, 'Electric motor-driven turning gear, 3 RPM'),
('HP/LP Bypass System Unit 1',             'BYP-001',     'Other',          'Unit 1 – Turbine Hall', 'active',     280000, 20, 'Turbine bypass system for startup and trip conditions'),
('HP/LP Bypass System Unit 2',             'BYP-002',     'Other',          'Unit 2 – Turbine Hall', 'active',     280000, 20, 'Turbine bypass system for startup and trip conditions')

ON CONFLICT (serial_number) DO NOTHING;

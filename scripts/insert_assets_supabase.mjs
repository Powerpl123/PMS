/**
 * Script to parse seed_assets.sql and insert all assets into Supabase.
 * Uses upsert with ON CONFLICT (kks_code) DO NOTHING to avoid duplicates
 * and never deletes existing data.
 *
 * Usage: node scripts/insert_assets_supabase.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Supabase credentials — service_role key bypasses RLS
const SUPABASE_URL = 'https://evaqhozshdnimhejfwzy.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2YXFob3pzaGRuaW1oZWpmd3p5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI0Njg1MywiZXhwIjoyMDg4ODIyODUzfQ.M61no40h5-bZRuHmnkqbsFY5hmqNjMvHAC6ef0OsBVI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Read and parse the SQL file
function parseSqlFile(filePath) {
  const sql = readFileSync(filePath, 'utf-8');
  const assets = [];
  
  // Match all value tuples: ('col1', 'col2', ...) patterns
  const tupleRegex = /\(\s*'([^']*(?:''[^']*)*)'\s*,\s*'([^']*(?:''[^']*)*)'\s*,\s*'([^']*(?:''[^']*)*)'\s*,\s*'([^']*(?:''[^']*)*)'\s*,\s*(NULL|'[^']*(?:''[^']*)*')\s*,\s*(NULL|'[^']*(?:''[^']*)*')\s*\)/g;
  
  let match;
  while ((match = tupleRegex.exec(sql)) !== null) {
    const kks_code = match[1].replace(/''/g, "'");
    const name = match[2].replace(/''/g, "'");
    const location = match[3].replace(/''/g, "'");
    const asset_type = match[4].replace(/''/g, "'");
    const serial_number = match[5] === 'NULL' ? null : match[5].replace(/^'|'$/g, '').replace(/''/g, "'");
    const model_type = match[6] === 'NULL' ? null : match[6].replace(/^'|'$/g, '').replace(/''/g, "'");
    
    assets.push({
      kks_code,
      name,
      location,
      asset_type,
      serial_number,
      model_type,
      status: 'active',
    });
  }
  
  return assets;
}

// Insert assets in batches with upsert
async function insertAssets(assets) {
  const BATCH_SIZE = 100;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  
  console.log(`Total assets parsed from SQL: ${assets.length}`);
  console.log(`Inserting in batches of ${BATCH_SIZE}...\n`);
  
  for (let i = 0; i < assets.length; i += BATCH_SIZE) {
    const batch = assets.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(assets.length / BATCH_SIZE);
    
    try {
      const { data, error } = await supabase
        .from('assets')
        .upsert(batch, { onConflict: 'kks_code', ignoreDuplicates: true })
        .select('id');
      
      if (error) {
        console.error(`  Batch ${batchNum}/${totalBatches} ERROR: ${error.message}`);
        // Try inserting one by one to find the problematic row
        for (const asset of batch) {
          try {
            const { error: singleErr } = await supabase
              .from('assets')
              .upsert(asset, { onConflict: 'kks_code', ignoreDuplicates: true });
            if (singleErr) {
              console.error(`    Failed: ${asset.kks_code} - ${singleErr.message}`);
              errors++;
            } else {
              inserted++;
            }
          } catch (e) {
            console.error(`    Exception: ${asset.kks_code} - ${e.message}`);
            errors++;
          }
        }
      } else {
        inserted += batch.length;
        process.stdout.write(`  Batch ${batchNum}/${totalBatches}: ${batch.length} assets processed (total: ${inserted})\r`);
      }
    } catch (e) {
      console.error(`  Batch ${batchNum} exception: ${e.message}`);
      errors += batch.length;
    }
  }
  
  console.log(`\n\n=== RESULTS ===`);
  console.log(`Total parsed:    ${assets.length}`);
  console.log(`Processed:       ${inserted}`);
  console.log(`Errors:          ${errors}`);
}

// Verify final count
async function verifyCount() {
  const { count, error } = await supabase
    .from('assets')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('Count verification error:', error.message);
  } else {
    console.log(`\nTotal assets in database: ${count}`);
  }
}

// Main
async function main() {
  const sqlPath = resolve(__dirname, 'seed_assets.sql');
  console.log(`Reading SQL file: ${sqlPath}\n`);
  
  const assets = parseSqlFile(sqlPath);
  
  if (assets.length === 0) {
    console.error('No assets parsed from SQL file. Check format.');
    process.exit(1);
  }

  // Show a few samples
  console.log('Sample assets:');
  assets.slice(0, 3).forEach(a => console.log(`  ${a.kks_code}: ${a.name} (${a.asset_type})`));
  console.log('  ...\n');

  await insertAssets(assets);
  await verifyCount();
}

main().catch(console.error);

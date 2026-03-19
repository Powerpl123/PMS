/**
 * Full database setup script:
 * 1. Connects directly to Supabase PostgreSQL
 * 2. Fixes RLS policies so anon key works
 * 3. Inserts all assets from seed_assets.sql
 *
 * Usage: node scripts/setup_db.mjs
 */

import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Credentials ───
const DB_URL = 'postgresql://postgres.evaqhozshdnimhejfwzy:HQPowerPms@123@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
const SUPABASE_URL = 'https://evaqhozshdnimhejfwzy.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2YXFob3pzaGRuaW1oZWpmd3p5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI0Njg1MywiZXhwIjoyMDg4ODIyODUzfQ.M61no40h5-bZRuHmnkqbsFY5hmqNjMvHAC6ef0OsBVI';

// ─── Step 1: Fix RLS via direct PostgreSQL connection ───
async function fixRLS() {
  console.log('=== Step 1: Fixing RLS policies via PostgreSQL ===\n');

  // Try multiple connection strings (region may vary)
  const regions = ['eu-central-1', 'eu-west-1', 'us-east-1', 'ap-southeast-1', 'us-west-1'];
  let client = null;

  for (const region of regions) {
    const connStr = `postgresql://postgres.evaqhozshdnimhejfwzy:HQPowerPms@123@aws-0-${region}.pooler.supabase.com:6543/postgres`;
    try {
      console.log(`  Trying region: ${region}...`);
      client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
      await client.connect();
      console.log(`  Connected via ${region}!\n`);
      break;
    } catch (e) {
      if (client) { try { await client.end(); } catch {} }
      client = null;
    }
  }

  // Also try direct connection
  if (!client) {
    try {
      console.log('  Trying direct connection...');
      const connStr = `postgresql://postgres:HQPowerPms@123@db.evaqhozshdnimhejfwzy.supabase.co:5432/postgres`;
      client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
      await client.connect();
      console.log('  Connected directly!\n');
    } catch (e) {
      if (client) { try { await client.end(); } catch {} }
      client = null;
    }
  }

  if (!client) {
    console.log('  Could not connect to PostgreSQL directly.');
    console.log('  Will try using service_role key instead...\n');
    return false;
  }

  const tables = [
    'assets', 'work_orders', 'inventory_items', 'vendors',
    'maintenance_reports', 'work_requests', 'work_permits',
    'profiles', 'notifications', 'sensor_tags', 'sensor_readings',
    'alarm_rules', 'alarm_events', 'generation_units'
  ];

  for (const table of tables) {
    try {
      await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await client.query(`DROP POLICY IF EXISTS "Authenticated users full access" ON ${table}`);
      await client.query(`DROP POLICY IF EXISTS "Allow all access" ON ${table}`);
      await client.query(`CREATE POLICY "Allow all access" ON ${table} FOR ALL USING (true) WITH CHECK (true)`);
      console.log(`  ✓ ${table} — RLS policy fixed`);
    } catch (e) {
      console.log(`  ✗ ${table} — ${e.message}`);
    }
  }

  await client.end();
  console.log('\n  RLS policies updated successfully.\n');
  return true;
}

// ─── Step 2: Parse SQL and insert assets ───
function parseSqlFile(filePath) {
  const sql = readFileSync(filePath, 'utf-8');
  const assets = [];
  const tupleRegex = /\(\s*'([^']*(?:''[^']*)*)'\s*,\s*'([^']*(?:''[^']*)*)'\s*,\s*'([^']*(?:''[^']*)*)'\s*,\s*'([^']*(?:''[^']*)*)'\s*,\s*(NULL|'[^']*(?:''[^']*)*')\s*,\s*(NULL|'[^']*(?:''[^']*)*')\s*\)/g;

  let match;
  while ((match = tupleRegex.exec(sql)) !== null) {
    assets.push({
      kks_code: match[1].replace(/''/g, "'"),
      name: match[2].replace(/''/g, "'"),
      location: match[3].replace(/''/g, "'"),
      asset_type: match[4].replace(/''/g, "'"),
      serial_number: match[5] === 'NULL' ? null : match[5].replace(/^'|'$/g, '').replace(/''/g, "'"),
      model_type: match[6] === 'NULL' ? null : match[6].replace(/^'|'$/g, '').replace(/''/g, "'"),
      status: 'active',
    });
  }
  return assets;
}

async function insertAssets(assets) {
  console.log('=== Step 2: Inserting assets into Supabase ===\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const BATCH_SIZE = 100;
  let inserted = 0;
  let errors = 0;

  console.log(`  Total assets parsed: ${assets.length}`);
  console.log(`  Inserting in batches of ${BATCH_SIZE}...\n`);

  const totalBatches = Math.ceil(assets.length / BATCH_SIZE);

  for (let i = 0; i < assets.length; i += BATCH_SIZE) {
    const batch = assets.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const { data, error } = await supabase
      .from('assets')
      .upsert(batch, { onConflict: 'kks_code', ignoreDuplicates: true })
      .select('id');

    if (error) {
      console.error(`  Batch ${batchNum}/${totalBatches} ERROR: ${error.message}`);
      // Fallback: insert one by one
      for (const asset of batch) {
        const { error: e2 } = await supabase
          .from('assets')
          .upsert(asset, { onConflict: 'kks_code', ignoreDuplicates: true });
        if (e2) { console.error(`    ✗ ${asset.kks_code}: ${e2.message}`); errors++; }
        else { inserted++; }
      }
    } else {
      inserted += batch.length;
      process.stdout.write(`  Batch ${batchNum}/${totalBatches} done (${inserted} total)\r`);
    }
  }

  console.log(`\n\n  Processed: ${inserted}`);
  console.log(`  Errors:    ${errors}`);

  // Final count
  const { count } = await supabase.from('assets').select('*', { count: 'exact', head: true });
  console.log(`\n  Total assets now in database: ${count}\n`);
}

// ─── Main ───
async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   PMS Database Setup & Asset Seeding     ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Step 1: Fix RLS
  await fixRLS();

  // Step 2: Parse and insert assets
  const sqlPath = resolve(__dirname, 'seed_assets.sql');
  console.log(`  SQL file: ${sqlPath}`);
  const assets = parseSqlFile(sqlPath);
  if (assets.length === 0) {
    console.error('  No assets parsed! Check seed_assets.sql format.');
    process.exit(1);
  }
  console.log(`  Parsed ${assets.length} assets from SQL file.\n`);

  await insertAssets(assets);

  console.log('=== Done! ===\n');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });

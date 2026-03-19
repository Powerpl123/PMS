/**
 * Step 1: Add missing columns to assets table via direct PostgreSQL.
 * Step 2: Insert all seed data via service_role key.
 *
 * Usage: node scripts/fix_and_seed.mjs
 */

import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://evaqhozshdnimhejfwzy.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2YXFob3pzaGRuaW1oZWpmd3p5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI0Njg1MywiZXhwIjoyMDg4ODIyODUzfQ.M61no40h5-bZRuHmnkqbsFY5hmqNjMvHAC6ef0OsBVI';

// ─── Connect to PostgreSQL ───
async function connectPg() {
  const connStrings = [
    'postgresql://postgres.evaqhozshdnimhejfwzy:HQPowerPms%40123@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
    'postgresql://postgres.evaqhozshdnimhejfwzy:HQPowerPms%40123@aws-0-eu-west-1.pooler.supabase.com:6543/postgres',
    'postgresql://postgres.evaqhozshdnimhejfwzy:HQPowerPms%40123@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
    'postgresql://postgres.evaqhozshdnimhejfwzy:HQPowerPms%40123@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
    'postgresql://postgres:HQPowerPms%40123@db.evaqhozshdnimhejfwzy.supabase.co:5432/postgres',
  ];

  for (const connStr of connStrings) {
    const shortName = connStr.match(/@([^:\/]+)/)?.[1] || connStr;
    try {
      process.stdout.write(`  Trying ${shortName}...`);
      const client = new pg.Client({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
      });
      await client.connect();
      console.log(' Connected!');
      return client;
    } catch (e) {
      console.log(` ${e.message.slice(0, 60)}`);
    }
  }
  return null;
}

// ─── Step 1: Fix table schema via SQL ───
async function fixSchema(client) {
  console.log('\n=== Fixing assets table schema ===\n');

  // First check what columns exist
  const { rows: cols } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assets'
    ORDER BY ordinal_position
  `);
  const existing = cols.map(r => r.column_name);
  console.log('  Existing columns:', existing.join(', '));

  // Columns that should exist
  const needed = [
    { name: 'kks_code', sql: `ALTER TABLE assets ADD COLUMN kks_code text UNIQUE` },
    { name: 'name', sql: `ALTER TABLE assets ADD COLUMN name text NOT NULL DEFAULT ''` },
    { name: 'serial_number', sql: `ALTER TABLE assets ADD COLUMN serial_number text` },
    { name: 'category', sql: `ALTER TABLE assets ADD COLUMN category text` },
    { name: 'location', sql: `ALTER TABLE assets ADD COLUMN location text NOT NULL DEFAULT ''` },
    { name: 'asset_type', sql: `ALTER TABLE assets ADD COLUMN asset_type text` },
    { name: 'model_type', sql: `ALTER TABLE assets ADD COLUMN model_type text` },
    { name: 'status', sql: `ALTER TABLE assets ADD COLUMN status text NOT NULL DEFAULT 'active'` },
    { name: 'purchase_date', sql: `ALTER TABLE assets ADD COLUMN purchase_date timestamptz` },
    { name: 'install_date', sql: `ALTER TABLE assets ADD COLUMN install_date timestamptz` },
    { name: 'useful_life_years', sql: `ALTER TABLE assets ADD COLUMN useful_life_years int DEFAULT 0` },
    { name: 'purchase_cost', sql: `ALTER TABLE assets ADD COLUMN purchase_cost numeric DEFAULT 0` },
    { name: 'current_value', sql: `ALTER TABLE assets ADD COLUMN current_value numeric DEFAULT 0` },
    { name: 'notes', sql: `ALTER TABLE assets ADD COLUMN notes text` },
    { name: 'created_at', sql: `ALTER TABLE assets ADD COLUMN created_at timestamptz DEFAULT now()` },
    { name: 'updated_at', sql: `ALTER TABLE assets ADD COLUMN updated_at timestamptz DEFAULT now()` },
  ];

  let added = 0;
  for (const col of needed) {
    if (!existing.includes(col.name)) {
      try {
        await client.query(col.sql);
        console.log(`  + Added column: ${col.name}`);
        added++;
      } catch (e) {
        console.log(`  ! ${col.name}: ${e.message.slice(0, 80)}`);
      }
    }
  }

  if (added === 0) {
    console.log('  All columns already exist.');
  } else {
    console.log(`\n  Added ${added} missing column(s).`);
  }

  // Fix RLS policies
  console.log('\n=== Fixing RLS policies ===\n');
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
      console.log(`  ✓ ${table}`);
    } catch (e) {
      console.log(`  ✗ ${table}: ${e.message.slice(0, 60)}`);
    }
  }

  // Notify PostgREST to reload schema cache
  try {
    await client.query(`NOTIFY pgrst, 'reload schema'`);
    console.log('\n  Schema cache reload notified.');
  } catch (e) {
    console.log('\n  Schema cache notify skipped:', e.message.slice(0, 60));
  }

  // Verify final column list
  const { rows: finalCols } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assets'
    ORDER BY ordinal_position
  `);
  console.log('\n  Final assets columns:', finalCols.map(r => r.column_name).join(', '));
}

// ─── Step 2: Parse SQL ───
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

// ─── Step 3: Insert via service_role ───
async function insertAssets(assets) {
  console.log('\n=== Inserting assets ===\n');

  // Wait a moment for schema cache to refresh
  console.log('  Waiting 3s for schema cache refresh...');
  await new Promise(r => setTimeout(r, 3000));

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const BATCH = 100;
  let ok = 0, fail = 0;
  const total = Math.ceil(assets.length / BATCH);

  for (let i = 0; i < assets.length; i += BATCH) {
    const batch = assets.slice(i, i + BATCH);
    const n = Math.floor(i / BATCH) + 1;

    const { error } = await supabase
      .from('assets')
      .upsert(batch, { onConflict: 'kks_code', ignoreDuplicates: true })
      .select('id');

    if (error) {
      console.error(`\n  Batch ${n}/${total} ERROR: ${error.message}`);
      for (const a of batch) {
        const { error: e2 } = await supabase
          .from('assets')
          .upsert(a, { onConflict: 'kks_code', ignoreDuplicates: true });
        if (e2) { console.error(`    ✗ ${a.kks_code}: ${e2.message}`); fail++; }
        else ok++;
      }
    } else {
      ok += batch.length;
      process.stdout.write(`  Batch ${n}/${total} — ${ok} inserted\r`);
    }
  }

  console.log(`\n\n  Success: ${ok}`);
  console.log(`  Failed:  ${fail}`);

  const { count } = await supabase.from('assets').select('*', { count: 'exact', head: true });
  console.log(`\n  ★ Total assets in database: ${count}\n`);
}

// ─── Main ───
async function main() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  PMS: Fix Schema + Insert Plant Assets    ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  // Connect to PostgreSQL
  console.log('=== Connecting to PostgreSQL ===\n');
  const client = await connectPg();
  if (!client) {
    console.error('Could not connect to PostgreSQL. Aborting.');
    process.exit(1);
  }

  // Fix schema + RLS
  await fixSchema(client);
  await client.end();

  // Parse and insert
  const sqlPath = resolve(__dirname, 'seed_assets.sql');
  const assets = parseSqlFile(sqlPath);
  console.log(`\n  Parsed ${assets.length} assets from seed_assets.sql`);

  await insertAssets(assets);
  console.log('=== All done! ===\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });

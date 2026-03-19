/**
 * Verify and report on Supabase table status.
 * Checks each table exists and is accessible, reports column structure.
 *
 * Usage: node scripts/verify_tables.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://evaqhozshdnimhejfwzy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2YXFob3pzaGRuaW1oZWpmd3p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY4NTMsImV4cCI6MjA4ODgyMjg1M30.7dKnbutm5VU_nkM9EZu0ThDE3ElZjORQoue8T8kHYDA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TABLES = [
  'assets',
  'work_orders',
  'inventory_items',
  'vendors',
  'maintenance_reports',
  'work_requests',
  'work_permits',
  'profiles',
  'notifications',
  'sensor_tags',
  'sensor_readings',
  'alarm_rules',
  'alarm_events',
  'generation_units',
];

async function checkTable(table) {
  try {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      return { table, status: 'ERROR', message: error.message, count: 0 };
    }
    return { table, status: 'OK', message: 'Accessible', count: count ?? 0 };
  } catch (e) {
    return { table, status: 'ERROR', message: e.message, count: 0 };
  }
}

async function main() {
  console.log('=== Supabase Table Verification ===\n');
  console.log(`URL: ${SUPABASE_URL}\n`);

  const results = [];
  for (const table of TABLES) {
    const result = await checkTable(table);
    results.push(result);
    const icon = result.status === 'OK' ? '✓' : '✗';
    const countStr = result.status === 'OK' ? ` (${result.count} rows)` : '';
    console.log(`  ${icon} ${table.padEnd(22)} ${result.status}${countStr}${result.status === 'ERROR' ? ' — ' + result.message : ''}`);
  }

  const ok = results.filter(r => r.status === 'OK').length;
  const fail = results.filter(r => r.status === 'ERROR').length;

  console.log(`\n--- Summary: ${ok} OK, ${fail} missing/error ---`);

  if (fail > 0) {
    console.log('\n⚠ Some tables are missing or inaccessible.');
    console.log('You need to run the schema SQL in the Supabase SQL Editor.');
    console.log('Go to: https://supabase.com/dashboard/project/evaqhozshdnimhejfwzy/sql/new');
    console.log('Then paste the contents of supabase_schema.sql and click "Run".\n');
  } else {
    console.log('\n✓ All tables exist and are accessible. Ready to insert data.');
  }
}

main().catch(console.error);

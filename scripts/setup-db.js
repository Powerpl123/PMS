/**
 * Setup script — creates all PMS tables in Supabase.
 *
 * Usage:
 *   node scripts/setup-db.js YOUR_DATABASE_PASSWORD
 *
 * Find the password in Supabase Dashboard → Settings → Database → Database password
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/setup-db.js <DATABASE_PASSWORD>');
  console.error('Find your password in Supabase Dashboard → Settings → Database');
  process.exit(1);
}

const PROJECT_REF = 'evaqhozshdnimhejfwzy';

// Try multiple common Supabase connection formats
const hosts = [
  `aws-0-eu-central-1.pooler.supabase.com`,
  `aws-0-us-east-1.pooler.supabase.com`,
  `aws-0-eu-west-1.pooler.supabase.com`,
  `aws-0-us-west-1.pooler.supabase.com`,
  `aws-0-ap-southeast-1.pooler.supabase.com`,
];

async function tryConnect(host) {
  const connStr = `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(password)}@${host}:6543/postgres`;
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  await client.connect();
  return client;
}

async function run() {
  let client;
  
  for (const host of hosts) {
    try {
      console.log(`Trying ${host}...`);
      client = await tryConnect(host);
      console.log(`Connected via ${host}!\n`);
      break;
    } catch (err) {
      console.log(`  Failed: ${err.message}`);
    }
  }

  if (!client) {
    console.error('\nCould not connect. Please check your password and try pasting the SQL directly in Supabase SQL Editor.');
    process.exit(1);
  }

  try {

    const schemaPath = path.join(__dirname, '..', 'supabase_schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Running schema migration...');
    await client.query(sql);
    console.log('\nAll tables created successfully!');

    // Verify tables
    const { rows } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('\nTables in your database:');
    rows.forEach((r) => console.log(`  - ${r.table_name}`));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();

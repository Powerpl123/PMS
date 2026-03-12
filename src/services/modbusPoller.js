/**
 * Modbus TCP Poller
 *
 * Polls Modbus TCP registers at a configurable interval and writes
 * sensor readings to Supabase. Useful for devices not on OPC-UA.
 *
 * Env vars:
 *   MODBUS_HOST       — e.g. 192.168.1.50
 *   MODBUS_PORT       — default 502
 *   MODBUS_UNIT_ID    — slave id, default 1
 *   MODBUS_POLL_MS    — polling interval, default 5000
 */

import ModbusRTU from 'modbus-serial';
import { supabase } from '../config/supabase.js';

const HOST = process.env.MODBUS_HOST;
const PORT = parseInt(process.env.MODBUS_PORT || '502', 10);
const UNIT_ID = parseInt(process.env.MODBUS_UNIT_ID || '1', 10);
const POLL_MS = parseInt(process.env.MODBUS_POLL_MS || '5000', 10);

let client = null;
let intervalId = null;
let tagMappings = []; // [{ tagId, register, length, scale, offset }]

/* ── Load Modbus tag mappings from sensor_tags ── */
async function loadMappings() {
  if (!supabase) return [];
  // Convention: sensor_tags with tag_name starting with "MB:" contain register info
  // Format: MB:addr:length:scale:offset  e.g. "MB:100:1:0.1:0"
  const { data, error } = await supabase
    .from('sensor_tags')
    .select('id, tag_name')
    .like('tag_name', 'MB:%')
    .eq('active', true);
  if (error) {
    console.error('[Modbus] Failed to load tags:', error.message);
    return [];
  }
  return (data || []).map(tag => {
    const parts = tag.tag_name.split(':');
    return {
      tagId: tag.id,
      register: parseInt(parts[1] || '0', 10),
      length: parseInt(parts[2] || '1', 10),
      scale: parseFloat(parts[3] || '1'),
      offset: parseFloat(parts[4] || '0'),
    };
  });
}

/* ── Poll all registered tags ── */
async function pollAll() {
  if (!client?.isOpen) return;

  for (const m of tagMappings) {
    try {
      const result = await client.readHoldingRegisters(m.register, m.length);
      const raw = result.data[0] ?? 0;
      const value = +(raw * m.scale + m.offset).toFixed(4);

      const { error } = await supabase
        .from('sensor_readings')
        .insert({ tag_id: m.tagId, value, quality: 'good', timestamp: new Date().toISOString() });
      if (error) console.error(`[Modbus] Write error for tag ${m.tagId}:`, error.message);
    } catch (err) {
      console.error(`[Modbus] Read error register ${m.register}:`, err.message);
    }
  }
}

/* ── Connect and start polling ── */
async function start() {
  if (!HOST) {
    console.warn('[Modbus] MODBUS_HOST not set — poller disabled.');
    return;
  }
  if (!supabase) {
    console.warn('[Modbus] Supabase not configured — poller disabled.');
    return;
  }

  client = new ModbusRTU();
  client.setID(UNIT_ID);

  try {
    console.log(`[Modbus] Connecting to ${HOST}:${PORT} (unit ${UNIT_ID})...`);
    await client.connectTCP(HOST, { port: PORT });
    console.log('[Modbus] Connected.');

    tagMappings = await loadMappings();
    if (tagMappings.length === 0) {
      console.warn('[Modbus] No MB: tags found in sensor_tags. Add tags with format MB:register:length:scale:offset');
      return;
    }
    console.log(`[Modbus] Polling ${tagMappings.length} registers every ${POLL_MS}ms`);

    intervalId = setInterval(pollAll, POLL_MS);
  } catch (err) {
    console.error('[Modbus] Connection failed:', err.message);
  }
}

/* ── Stop polling ── */
async function stop() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
  if (client?.isOpen) { client.close(() => {}); }
  client = null;
}

export const modbusPoller = {
  start,
  stop,
  isConnected: () => !!client?.isOpen,
  getTagCount: () => tagMappings.length,
};

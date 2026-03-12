/**
 * OPC-UA Gateway Service
 *
 * Connects to a Siemens SPPA-T3000 (or any OPC-UA server),
 * subscribes to sensor tags, and pushes readings into Supabase.
 *
 * Env vars:
 *   OPCUA_ENDPOINT_URL    — e.g. opc.tcp://192.168.1.100:4840
 *   OPCUA_POLL_INTERVAL   — ms between subscription publish (default 5000)
 *   SUPABASE_URL          — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service-role key for writing
 */

import {
  OPCUAClient,
  MessageSecurityMode,
  SecurityPolicy,
  AttributeIds,
  TimestampsToReturn,
  ClientSubscription,
  ClientMonitoredItem,
  DataType,
} from 'node-opcua-client';
import { supabase } from '../config/supabase.js';

const ENDPOINT = process.env.OPCUA_ENDPOINT_URL;
const POLL_MS = parseInt(process.env.OPCUA_POLL_INTERVAL || '5000', 10);
const MAX_RECONNECT_DELAY = 60000;

let client = null;
let session = null;
let subscription = null;
let reconnectDelay = 2000;
let tagMap = new Map(); // nodeId → { tagId, tagName }

/* ── Load tag configs from Supabase ── */
async function loadTags() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('sensor_tags')
    .select('id, tag_name, parameter, generation_unit')
    .eq('active', true);
  if (error) {
    console.error('[OPC-UA] Failed to load sensor_tags:', error.message);
    return [];
  }
  return data || [];
}

/* ── Write a sensor reading ── */
async function writeReading(tagId, value, quality = 'good') {
  if (!supabase) return;
  const { error } = await supabase
    .from('sensor_readings')
    .insert({ tag_id: tagId, value, quality, timestamp: new Date().toISOString() });
  if (error) console.error('[OPC-UA] Write error:', error.message);
}

/* ── Connect and subscribe ── */
async function connect() {
  if (!ENDPOINT) {
    console.warn('[OPC-UA] OPCUA_ENDPOINT_URL not set — gateway disabled.');
    return;
  }

  client = OPCUAClient.create({
    applicationName: 'PMS-Gateway',
    connectionStrategy: {
      initialDelay: 1000,
      maxDelay: 10000,
      maxRetry: 5,
    },
    securityMode: MessageSecurityMode.None,
    securityPolicy: SecurityPolicy.None,
    endpointMustExist: false,
  });

  client.on('backoff', (retry, delay) => {
    console.log(`[OPC-UA] Backoff retry #${retry} in ${delay}ms`);
  });

  try {
    console.log(`[OPC-UA] Connecting to ${ENDPOINT}...`);
    await client.connect(ENDPOINT);
    console.log('[OPC-UA] Connected.');

    session = await client.createSession();
    console.log('[OPC-UA] Session created.');

    // Load tags and set up subscription
    const tags = await loadTags();
    if (tags.length === 0) {
      console.warn('[OPC-UA] No active sensor_tags found. Add tags in the Sensor Config page.');
      return;
    }

    subscription = ClientSubscription.create(session, {
      requestedPublishingInterval: POLL_MS,
      requestedMaxKeepAliveCount: 20,
      requestedLifetimeCount: 60,
      maxNotificationsPerPublish: 100,
      publishingEnabled: true,
      priority: 10,
    });

    subscription.on('started', () => {
      console.log(`[OPC-UA] Subscription started (interval ${POLL_MS}ms, ${tags.length} tags)`);
    });

    // Monitor each tag
    for (const tag of tags) {
      const nodeId = tag.tag_name; // tag_name holds the OPC-UA NodeId string
      tagMap.set(nodeId, { tagId: tag.id, tagName: tag.tag_name });

      const item = ClientMonitoredItem.create(
        subscription,
        { nodeId, attributeId: AttributeIds.Value },
        { samplingInterval: POLL_MS, discardOldest: true, queueSize: 10 },
        TimestampsToReturn.Both,
      );

      item.on('changed', async (dataValue) => {
        const val = dataValue.value?.value;
        if (val == null) return;
        const numVal = typeof val === 'number' ? val : parseFloat(val);
        if (isNaN(numVal)) return;

        const quality = dataValue.statusCode?.isGood?.()
          ? 'good'
          : dataValue.statusCode?.isUncertain?.()
            ? 'uncertain'
            : 'bad';

        await writeReading(tag.id, numVal, quality);
      });
    }

    reconnectDelay = 2000; // reset on success
    console.log(`[OPC-UA] Monitoring ${tags.length} tags.`);
  } catch (err) {
    console.error('[OPC-UA] Connection failed:', err.message);
    scheduleReconnect();
  }
}

/* ── Reconnect with exponential backoff ── */
function scheduleReconnect() {
  console.log(`[OPC-UA] Reconnecting in ${reconnectDelay / 1000}s...`);
  setTimeout(async () => {
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    await disconnect();
    await connect();
  }, reconnectDelay);
}

/* ── Graceful disconnect ── */
async function disconnect() {
  try {
    if (subscription) { await subscription.terminate(); subscription = null; }
    if (session) { await session.close(); session = null; }
    if (client) { await client.disconnect(); client = null; }
  } catch { /* ignore cleanup errors */ }
}

/* ── Public API ── */
export const opcuaGateway = {
  start: connect,
  stop: disconnect,
  isConnected: () => !!session,
  getTagCount: () => tagMap.size,
};

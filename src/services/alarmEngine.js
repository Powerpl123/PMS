/**
 * Alarm Engine
 *
 * Subscribes to new sensor_readings via Supabase Realtime,
 * evaluates readings against alarm_rules, and inserts alarm_events
 * when thresholds are breached.
 */

import { supabase } from '../config/supabase.js';

let channel = null;
let rules = [];        // [{ id, tagId, condition, threshold, severity, messageTemplate, autoCreateWo }]
let activeAlarms = {}; // tagId+ruleId → alarm_event id (prevents duplicate triggers)

/* ── Load alarm rules ── */
async function loadRules() {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('alarm_rules')
    .select('id, tag_id, condition, threshold, severity, message_template, auto_create_wo')
    .eq('active', true);
  if (error) {
    console.error('[Alarm] Failed to load rules:', error.message);
    return;
  }
  rules = (data || []).map(r => ({
    id: r.id,
    tagId: r.tag_id,
    condition: r.condition,
    threshold: r.threshold,
    severity: r.severity,
    messageTemplate: r.message_template,
    autoCreateWo: r.auto_create_wo,
  }));
  console.log(`[Alarm] Loaded ${rules.length} active rules.`);
}

/* ── Evaluate a reading against rules ── */
function checkCondition(condition, value, threshold) {
  switch (condition) {
    case '>':  return value > threshold;
    case '<':  return value < threshold;
    case '>=': return value >= threshold;
    case '<=': return value <= threshold;
    case '==': return value === threshold;
    default: return false;
  }
}

async function evaluateReading(reading) {
  const { tag_id: tagId, value, timestamp } = reading;
  const matchingRules = rules.filter(r => r.tagId === tagId);

  for (const rule of matchingRules) {
    const key = `${tagId}:${rule.id}`;
    const breached = checkCondition(rule.condition, value, rule.threshold);

    if (breached && !activeAlarms[key]) {
      // New alarm
      const message = rule.messageTemplate
        ? rule.messageTemplate
            .replace('{value}', value)
            .replace('{threshold}', rule.threshold)
        : `Value ${value} ${rule.condition} ${rule.threshold}`;

      const { data, error } = await supabase
        .from('alarm_events')
        .insert({
          rule_id: rule.id,
          tag_id: tagId,
          value,
          severity: rule.severity,
          message,
          triggered_at: timestamp || new Date().toISOString(),
        })
        .select('id')
        .single();

      if (!error && data) {
        activeAlarms[key] = data.id;
        console.log(`[Alarm] TRIGGERED: ${rule.severity.toUpperCase()} — ${message}`);

        // Auto-create work order for critical alarms
        if (rule.autoCreateWo && rule.severity === 'critical') {
          await createAutoWorkOrder(tagId, message);
        }
      }
    } else if (!breached && activeAlarms[key]) {
      // Resolve alarm
      await supabase
        .from('alarm_events')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', activeAlarms[key]);
      console.log(`[Alarm] RESOLVED: rule ${rule.id} for tag ${tagId}`);
      delete activeAlarms[key];
    }
  }
}

/* ── Auto-create work order ── */
async function createAutoWorkOrder(tagId, message) {
  // Look up the tag to find the asset
  const { data: tag } = await supabase
    .from('sensor_tags')
    .select('asset_id, tag_name, parameter')
    .eq('id', tagId)
    .single();

  if (!tag) return;

  await supabase.from('work_orders').insert({
    title: `[AUTO] Alarm: ${tag.parameter} on ${tag.tag_name}`,
    description: message,
    asset_id: tag.asset_id,
    priority: 'critical',
    status: 'open',
  });
  console.log(`[Alarm] Auto-created work order for ${tag.tag_name}`);
}

/* ── Start listening ── */
async function start() {
  if (!supabase) {
    console.warn('[Alarm] Supabase not configured — engine disabled.');
    return;
  }

  await loadRules();

  // Subscribe to new sensor readings via Supabase Realtime
  channel = supabase
    .channel('alarm-engine')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sensor_readings' },
      (payload) => {
        evaluateReading(payload.new);
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Alarm] Listening for sensor readings via Realtime.');
      }
    });
}

/* ── Reload rules (call when rules change) ── */
async function reloadRules() {
  await loadRules();
}

/* ── Stop ── */
async function stop() {
  if (channel) {
    await supabase.removeChannel(channel);
    channel = null;
  }
}

export const alarmEngine = {
  start,
  stop,
  reloadRules,
  getActiveAlarmCount: () => Object.keys(activeAlarms).length,
};

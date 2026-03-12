/**
 * CSV Sensor Import Endpoint
 *
 * POST /api/sensors/import
 * Accepts CSV file upload with columns: timestamp, tag_name, value [, quality]
 * Bulk inserts into sensor_readings for historical data backfill.
 */

import { Router } from 'express';
import { parse } from 'csv-parse/sync';
import { supabase } from '../config/supabase.js';

const router = Router();

router.post('/import', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const csvText = req.body?.csv;
    if (!csvText || typeof csvText !== 'string') {
      return res.status(400).json({ error: 'Send { csv: "..." } with CSV text in the body' });
    }

    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) {
      return res.status(400).json({ error: 'No records found in CSV' });
    }

    // Validate required columns
    const first = records[0];
    if (!first.timestamp || !first.tag_name || !first.value) {
      return res.status(400).json({
        error: "CSV must have columns: timestamp, tag_name, value (optional: quality)",
      });
    }

    // Resolve tag_name → tag_id
    const uniqueNames = [...new Set(records.map(r => r.tag_name))];
    const { data: tags, error: tagErr } = await supabase
      .from('sensor_tags')
      .select('id, tag_name')
      .in('tag_name', uniqueNames);

    if (tagErr) {
      return res.status(500).json({ error: 'Failed to resolve tag names: ' + tagErr.message });
    }

    const nameToId = Object.fromEntries((tags || []).map(t => [t.tag_name, t.id]));
    const unknownTags = uniqueNames.filter(n => !nameToId[n]);

    // Build insert rows
    const rows = [];
    const skipped = [];
    for (const r of records) {
      const tagId = nameToId[r.tag_name];
      if (!tagId) { skipped.push(r.tag_name); continue; }

      const val = parseFloat(r.value);
      if (isNaN(val)) { skipped.push(`invalid value: ${r.value}`); continue; }

      rows.push({
        tag_id: tagId,
        value: val,
        quality: r.quality || 'good',
        timestamp: r.timestamp,
      });
    }

    if (rows.length === 0) {
      return res.status(400).json({ error: 'No valid rows to insert', unknownTags, skipped: skipped.length });
    }

    // Batch insert (1000 at a time)
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 1000) {
      const batch = rows.slice(i, i + 1000);
      const { error } = await supabase.from('sensor_readings').insert(batch);
      if (error) {
        return res.status(500).json({ error: 'Insert failed: ' + error.message, inserted, remaining: rows.length - inserted });
      }
      inserted += batch.length;
    }

    res.json({
      success: true,
      inserted,
      skipped: skipped.length,
      unknownTags: unknownTags.length > 0 ? unknownTags : undefined,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

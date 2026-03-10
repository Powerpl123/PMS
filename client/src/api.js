import { supabase } from './supabaseClient';

/* ─── Helper: snake_case ↔ camelCase mapping ─── */
const snakeToMap = {
  serial_number: 'serialNumber',
  purchase_date: 'purchaseDate',
  install_date: 'installDate',
  useful_life_years: 'usefulLifeYears',
  purchase_cost: 'purchaseCost',
  current_value: 'currentValue',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  asset_id: 'assetId',
  assigned_to: 'assignedTo',
  due_date: 'dueDate',
  started_at: 'startedAt',
  completed_at: 'completedAt',
  labor_hours: 'laborHours',
  estimated_cost: 'estimatedCost',
  actual_cost: 'actualCost',
  unit_cost: 'unitCost',
  quantity_in_stock: 'quantityInStock',
  reorder_point: 'reorderPoint',
  preferred_vendor_id: 'preferredVendorId',
  contact_name: 'contactName',
  service_agreements: 'serviceAgreements',
  performance_notes: 'performanceNotes',
  report_date: 'reportDate',
  period_start: 'periodStart',
  period_end: 'periodEnd',
  total_work_orders: 'totalWorkOrders',
  completed_work_orders: 'completedWorkOrders',
  total_labor_hours: 'totalLaborHours',
  downtime_hours: 'downtimeHours',
  total_maintenance_cost: 'totalMaintenanceCost',
  compliance_notes: 'complianceNotes',
  generated_by: 'generatedBy',
};

const camelToSnake = Object.fromEntries(
  Object.entries(snakeToMap).map(([s, c]) => [c, s])
);

function toCamel(row) {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[snakeToMap[k] || k] = v;
  }
  return out;
}

function toSnake(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v === undefined) continue;        // skip empty
    out[camelToSnake[k] || k] = v;
  }
  return out;
}

/* ─── Generic CRUD for a table ─── */
function tableApi(table) {
  return {
    async list(limit = 100) {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return { data: data.map(toCamel), total: count ?? data.length };
    },

    async create(body) {
      const { data, error } = await supabase
        .from(table)
        .insert(toSnake(body))
        .select()
        .single();
      if (error) throw new Error(error.message);
      return toCamel(data);
    },

    async update(id, body) {
      const { data, error } = await supabase
        .from(table)
        .update(toSnake(body))
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return toCamel(data);
    },

    async remove(id) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
  };
}

/* ─── Work Orders with asset join ─── */
const workOrdersApi = {
  async list(limit = 100) {
    const { data, error, count } = await supabase
      .from('work_orders')
      .select('*, assets(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return {
      data: data.map((row) => {
        const c = toCamel(row);
        // Flatten the joined asset name into assetId object shape pages expect
        if (row.assets) {
          c.assetId = { _id: row.asset_id, id: row.asset_id, name: row.assets.name };
        }
        delete c.assets;
        return c;
      }),
      total: count ?? data.length,
    };
  },
  create: tableApi('work_orders').create,
  update: tableApi('work_orders').update,
  remove: tableApi('work_orders').remove,
};

/* ─── Exported API object ─── */
export const api = {
  assets: tableApi('assets'),
  workOrders: workOrdersApi,
  inventory: tableApi('inventory_items'),
  vendors: tableApi('vendors'),
  reports: tableApi('maintenance_reports'),
};


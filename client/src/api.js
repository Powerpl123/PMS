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
  requested_by: 'requestedBy',
  assigned_to_name: 'assignedToName',
  assigned_to_email: 'assignedToEmail',
  work_type: 'workType',
  scheduled_date: 'scheduledDate',
  department: 'department',
  work_request_id: 'workRequestId',
  permit_number: 'permitNumber',
  issued_by: 'issuedBy',
  issued_to: 'issuedTo',
  work_description: 'workDescription',
  start_date: 'startDate',
  end_date: 'endDate',
  safety_precautions: 'safetyPrecautions',
  ppe_required: 'ppeRequired',
  approved_by: 'approvedBy',
  full_name: 'fullName',
  user_id: 'userId',
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

/* ─── Work Requests with asset join ─── */
const workRequestsApi = {
  async list(limit = 100) {
    const { data, error, count } = await supabase
      .from('work_requests')
      .select('*, assets(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return {
      data: data.map((row) => {
        const c = toCamel(row);
        if (row.assets) {
          c.assetId = { _id: row.asset_id, id: row.asset_id, name: row.assets.name };
        }
        delete c.assets;
        return c;
      }),
      total: count ?? data.length,
    };
  },
  create: tableApi('work_requests').create,
  update: tableApi('work_requests').update,
  remove: tableApi('work_requests').remove,
};

/* ─── Work Permits with request join ─── */
const workPermitsApi = {
  async list(limit = 100) {
    const { data, error, count } = await supabase
      .from('work_permits')
      .select('*, work_requests(title)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return {
      data: data.map((row) => {
        const c = toCamel(row);
        if (row.work_requests) {
          c.workRequestTitle = row.work_requests.title;
        }
        delete c.work_requests;
        return c;
      }),
      total: count ?? data.length,
    };
  },
  create: tableApi('work_permits').create,
  update: tableApi('work_permits').update,
  remove: tableApi('work_permits').remove,
};

/* ─── Email notification helper ─── */
export async function sendNotificationEmail(to, subject, html) {
  // 1) Try Supabase Edge Function (works when deployed)
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: { to, subject, html },
    });
    if (!error && data?.success) {
      return { success: true, method: 'supabase-edge' };
    }
  } catch {
    // Edge function not deployed – fall through
  }

  // 2) Try EmailJS (works from browser when configured)
  const serviceId  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  if (serviceId && templateId && publicKey) {
    const { default: emailjs } = await import('@emailjs/browser');
    const result = await emailjs.send(serviceId, templateId, {
      to_email: to,
      subject: subject,
      message_html: html,
    }, publicKey);
    return { success: true, method: 'emailjs', status: result.status };
  }

  // 3) No email provider configured
  return { success: false, message: 'No email provider configured' };
}

/* ─── Profiles (users) ─── */
const profilesApi = {
  async list(limit = 200) {
    const { data, error, count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('full_name', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return { data: data.map(toCamel), total: count ?? data.length };
  },
  async createWithAuth(body) {
    // 1. Create Supabase Auth account with email & password
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: { full_name: body.fullName },
      },
    });
    if (authError) throw new Error(authError.message);
    if (!authData?.user?.id) throw new Error('Failed to create auth account');

    // 2. Insert profile linked to the auth user
    const profileBody = {
      id: authData.user.id,
      fullName: body.fullName,
      email: body.email,
      role: body.role,
      department: body.department,
      phone: body.phone,
      active: body.active ?? true,
    };
    const { data, error } = await supabase
      .from('profiles')
      .upsert(toSnake(profileBody))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toCamel(data);
  },
  async create(body) {
    const profileBody = { id: body.id || crypto.randomUUID(), fullName: body.fullName, email: body.email, role: body.role, department: body.department, phone: body.phone, active: body.active ?? true };
    const { data, error } = await supabase
      .from('profiles')
      .insert(toSnake(profileBody))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toCamel(data);
  },
  async upsert(body) {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(toSnake(body))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toCamel(data);
  },
  async update(id, body) {
    const { data, error } = await supabase
      .from('profiles')
      .update(toSnake(body))
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toCamel(data);
  },
  async remove(id) {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
  async getByEmail(email) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toCamel(data) : null;
  },
  async updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  },
};

/* ─── Notifications ─── */
const notificationsApi = {
  async list(userId, limit = 50) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data.map(toCamel);
  },
  async unreadCount(userId) {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw new Error(error.message);
    return count ?? 0;
  },
  async create(body) {
    const { data, error } = await supabase
      .from('notifications')
      .insert(toSnake(body))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return toCamel(data);
  },
  async markRead(id) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },
  async markAllRead(userId) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw new Error(error.message);
  },
};

/* ─── Exported API object ─── */
export const api = {
  assets: tableApi('assets'),
  workOrders: workOrdersApi,
  workRequests: workRequestsApi,
  workPermits: workPermitsApi,
  inventory: tableApi('inventory_items'),
  vendors: tableApi('vendors'),
  reports: tableApi('maintenance_reports'),
  profiles: profilesApi,
  notifications: notificationsApi,
};


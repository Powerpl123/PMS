/**
 * Generate a unique permit number based on timestamp + random suffix.
 */
export function generatePermitNumber() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `WP-${y}${m}${d}-${rand}`;
}

/**
 * Open a printable work permit document in a new window.
 */
export function printWorkPermit(permit, request) {
  const ppeList = (permit.ppeRequired || [])
    .map((item) => `<li>${esc(item)}</li>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Work Permit ${esc(permit.permitNumber)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a1a; }
  .permit { max-width: 800px; margin: 0 auto; border: 2px solid #1e293b; border-radius: 8px; overflow: hidden; }
  .permit-header { background: linear-gradient(135deg, #1e293b, #334155); color: #fff; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; }
  .permit-header h1 { font-size: 22px; font-weight: 700; }
  .permit-header .permit-no { font-size: 14px; background: rgba(255,255,255,.15); padding: 6px 14px; border-radius: 6px; font-weight: 600; }
  .permit-body { padding: 28px 32px; }
  .section { margin-bottom: 22px; }
  .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; }
  .field label { display: block; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 2px; }
  .field value, .field p { font-size: 14px; color: #1e293b; }
  .full { grid-column: 1 / -1; }
  .ppe-list { list-style: none; display: flex; flex-wrap: wrap; gap: 8px; }
  .ppe-list li { background: #fff7ed; color: #ea580c; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; border: 1px solid #fed7aa; }
  .status-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
  .status-issued { background: #dbeafe; color: #2563eb; }
  .status-active { background: #dcfce7; color: #16a34a; }
  .status-closed { background: #f1f5f9; color: #64748b; }
  .status-revoked { background: #fef2f2; color: #dc2626; }
  .permit-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; }
  .sig-block { text-align: center; min-width: 200px; }
  .sig-line { border-top: 1px solid #1e293b; margin-top: 40px; padding-top: 6px; font-size: 12px; color: #64748b; }
  @media print {
    body { padding: 0; }
    .permit { border: 1px solid #000; }
  }
</style>
</head>
<body>
<div class="permit">
  <div class="permit-header">
    <div>
      <h1>⚡ WORK PERMIT</h1>
      <div style="font-size:12px;margin-top:4px;opacity:.8">PowerPlant Maintenance System</div>
    </div>
    <div class="permit-no">${esc(permit.permitNumber)}</div>
  </div>
  <div class="permit-body">
    <div class="section">
      <div class="section-title">General Information</div>
      <div class="grid">
        <div class="field"><label>Permit Number</label><p>${esc(permit.permitNumber)}</p></div>
        <div class="field"><label>Status</label><p><span class="status-badge status-${permit.status || 'issued'}">${esc(permit.status || 'issued')}</span></p></div>
        <div class="field"><label>Issued To</label><p>${esc(permit.issuedTo || '—')}</p></div>
        <div class="field"><label>Issued By</label><p>${esc(permit.issuedBy || '—')}</p></div>
        <div class="field"><label>Start Date</label><p>${permit.startDate ? new Date(permit.startDate).toLocaleDateString() : '—'}</p></div>
        <div class="field"><label>End Date</label><p>${permit.endDate ? new Date(permit.endDate).toLocaleDateString() : '—'}</p></div>
        <div class="field"><label>Approved By</label><p>${esc(permit.approvedBy || '—')}</p></div>
        <div class="field"><label>Location</label><p>${esc(permit.location || request?.location || '—')}</p></div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Work Details</div>
      <div class="grid">
        <div class="field full"><label>Related Work Request</label><p>${esc(request?.title || '—')}</p></div>
        <div class="field full"><label>Work Description</label><p>${esc(permit.workDescription || request?.description || '—')}</p></div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Safety Information</div>
      <div class="grid">
        <div class="field full"><label>Hazards</label><p>${esc(permit.hazards || 'None specified')}</p></div>
        <div class="field full"><label>Safety Precautions</label><p>${esc(permit.safetyPrecautions || 'Standard safety procedures apply')}</p></div>
        <div class="field full"><label>PPE Required</label>${ppeList ? `<ul class="ppe-list">${ppeList}</ul>` : '<p>None specified</p>'}</div>
      </div>
    </div>
  </div>
  <div class="permit-footer">
    <div class="sig-block">
      <div class="sig-line">Issued By (Signature)</div>
    </div>
    <div class="sig-block">
      <div class="sig-line">Approved By (Signature)</div>
    </div>
    <div class="sig-block">
      <div class="sig-line">Permit Holder (Signature)</div>
    </div>
  </div>
</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build the HTML for the assignment notification email.
 */
export function buildAssignmentEmailHtml(request, permitNumber) {
  return `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:linear-gradient(135deg,#1e293b,#334155);padding:24px 28px;color:#fff">
    <h1 style="margin:0;font-size:20px">⚡ New Work Request Assignment</h1>
    <p style="margin:6px 0 0;font-size:13px;opacity:.8">PowerPlant Maintenance System</p>
  </div>
  <div style="padding:24px 28px">
    <p style="font-size:15px;color:#334155;margin-bottom:20px">
      You have been assigned a new work request. Please review the details below:
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:8px 12px;color:#64748b;font-weight:600;width:140px">Title</td><td style="padding:8px 12px;color:#1e293b">${esc(request.title)}</td></tr>
      <tr style="background:#f1f5f9"><td style="padding:8px 12px;color:#64748b;font-weight:600">Work Type</td><td style="padding:8px 12px;color:#1e293b">${esc(request.workType)}</td></tr>
      <tr><td style="padding:8px 12px;color:#64748b;font-weight:600">Priority</td><td style="padding:8px 12px;color:${request.priority === 'critical' ? '#dc2626' : request.priority === 'high' ? '#ea580c' : '#1e293b'};font-weight:600">${esc(request.priority).toUpperCase()}</td></tr>
      <tr style="background:#f1f5f9"><td style="padding:8px 12px;color:#64748b;font-weight:600">Location</td><td style="padding:8px 12px;color:#1e293b">${esc(request.location || '—')}</td></tr>
      <tr><td style="padding:8px 12px;color:#64748b;font-weight:600">Scheduled Date</td><td style="padding:8px 12px;color:#1e293b">${request.scheduledDate ? new Date(request.scheduledDate).toLocaleDateString() : '—'}</td></tr>
      <tr style="background:#f1f5f9"><td style="padding:8px 12px;color:#64748b;font-weight:600">Requested By</td><td style="padding:8px 12px;color:#1e293b">${esc(request.requestedBy || '—')}</td></tr>
      ${permitNumber ? `<tr><td style="padding:8px 12px;color:#64748b;font-weight:600">Work Permit #</td><td style="padding:8px 12px;color:#2563eb;font-weight:600">${esc(permitNumber)}</td></tr>` : ''}
    </table>
    ${request.description ? `<div style="margin-top:16px;padding:14px;background:#fff;border:1px solid #e2e8f0;border-radius:8px"><p style="margin:0 0 4px;font-size:12px;color:#64748b;font-weight:600">DESCRIPTION</p><p style="margin:0;font-size:14px;color:#334155">${esc(request.description)}</p></div>` : ''}
    <p style="margin-top:20px;font-size:13px;color:#64748b">
      Please log in to the PowerPlant Maintenance System to accept and begin work on this request.
    </p>
  </div>
  <div style="background:#f1f5f9;padding:16px 28px;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0">
    This is an automated notification from the PowerPlant Maintenance System.
  </div>
</div>`;
}

/**
 * Build the HTML for work order creation notification email.
 */
export function buildWorkOrderEmailHtml(workOrder, request) {
  return `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:linear-gradient(135deg,#0c4a6e,#0369a1);padding:24px 28px;color:#fff">
    <h1 style="margin:0;font-size:20px">\u{1f527} Work Order Assigned to You</h1>
    <p style="margin:6px 0 0;font-size:13px;opacity:.8">PowerPlant Maintenance System</p>
  </div>
  <div style="padding:24px 28px">
    <p style="font-size:15px;color:#334155;margin-bottom:20px">
      A work order has been created from an approved work request and assigned to you.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:8px 12px;color:#64748b;font-weight:600;width:140px">Work Order</td><td style="padding:8px 12px;color:#1e293b;font-weight:700">${esc(workOrder.title || request.title)}</td></tr>
      <tr style="background:#f1f5f9"><td style="padding:8px 12px;color:#64748b;font-weight:600">Priority</td><td style="padding:8px 12px;color:${request.priority === 'critical' ? '#dc2626' : request.priority === 'high' ? '#ea580c' : '#1e293b'};font-weight:600">${esc(request.priority).toUpperCase()}</td></tr>
      <tr><td style="padding:8px 12px;color:#64748b;font-weight:600">Status</td><td style="padding:8px 12px;color:#2563eb;font-weight:600">OPEN</td></tr>
      <tr style="background:#f1f5f9"><td style="padding:8px 12px;color:#64748b;font-weight:600">Assigned To</td><td style="padding:8px 12px;color:#1e293b">${esc(request.assignedToName || '—')}</td></tr>
      <tr><td style="padding:8px 12px;color:#64748b;font-weight:600">Location</td><td style="padding:8px 12px;color:#1e293b">${esc(request.location || '—')}</td></tr>
      <tr style="background:#f1f5f9"><td style="padding:8px 12px;color:#64748b;font-weight:600">Due Date</td><td style="padding:8px 12px;color:#1e293b">${request.scheduledDate ? new Date(request.scheduledDate).toLocaleDateString() : '—'}</td></tr>
      <tr><td style="padding:8px 12px;color:#64748b;font-weight:600">Requested By</td><td style="padding:8px 12px;color:#1e293b">${esc(request.requestedBy || '—')}</td></tr>
    </table>
    ${request.description ? `<div style="margin-top:16px;padding:14px;background:#fff;border:1px solid #e2e8f0;border-radius:8px"><p style="margin:0 0 4px;font-size:12px;color:#64748b;font-weight:600">DESCRIPTION</p><p style="margin:0;font-size:14px;color:#334155">${esc(request.description)}</p></div>` : ''}
    <div style="margin-top:20px;padding:14px;background:#eff6ff;border-radius:8px;border-left:4px solid #2563eb">
      <p style="margin:0;font-size:14px;color:#1e40af;font-weight:600">Action Required</p>
      <p style="margin:6px 0 0;font-size:13px;color:#334155">
        Please log in to the PowerPlant Maintenance System to review and begin work on this order.
      </p>
    </div>
  </div>
  <div style="background:#f1f5f9;padding:16px 28px;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0">
    This is an automated notification from the PowerPlant Maintenance System.
  </div>
</div>`;
}

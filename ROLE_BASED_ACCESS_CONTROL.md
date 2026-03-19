# Role-Based Access Control (RBAC) - Work Request Approvals

## Overview

The system now implements **role-based access control** to restrict work request approvals to managers and admins only. This ensures proper authorization and audit trails.

---

## Role Hierarchy & Permissions

### 🔓 **Admin**
- ✅ **Approve work requests** → Convert to work orders
- ✅ Full system access
- ✅ Manage users and assign roles
- ✅ View all reports and data
- ✅ Configure system settings

**Use Case**: System administrators, plant managers

---

### ✅ **Manager**
- ✅ **Approve work requests** → Convert to work orders
- ✅ Assign work to technicians
- ✅ View team work orders
- ✅ Generate and export reports
- ✅ Manage department settings

**Use Case**: Department heads, team leads

---

### 👷 **Technician**
- ❌ **Cannot approve work requests**
- ✅ Update assigned work requests
- ✅ View own assigned tasks
- ✅ Upload photos/attachments
- ✅ Record work hours

**Use Case**: Field technicians, maintenance staff

---

### 👁️ **Operator**
- ❌ **Cannot approve work requests**
- ❌ Limited editing capabilities
- ✅ View work orders and dashboards
- ✅ Monitor equipment status
- ✅ Acknowledge alarms

**Use Case**: Control room operators, monitoring staff

---

### 👁️ **Viewer**
- ❌ **Cannot approve work requests**
- ❌ Read-only access
- ✅ View reports and dashboards
- ✅ View historical data
- ✅ Export reports

**Use Case**: Management, compliance review

---

## Work Request Approval Flow

### For Users with Approval Rights (Admin/Manager):

```
Work Request (Pending)
        ↓
[✅ Approve → WO Button Visible]
        ↓
Click Approve
        ↓
Confirmation Dialog
        ↓
✓ Create Work Order
✓ Update Request Status → Approved
✓ Track: Who approved + When
✓ Send notification to assignee
        ↓
Work Order Created (Open)
```

### For Users WITHOUT Approval Rights (Technician/Operator/Viewer):

```
Work Request (Pending)
        ↓
[🔒 Approve → WO Button Locked/Hidden]
        ↓
User sees: "Only managers and admins can approve"
        ↓
Cannot proceed
```

---

## Database Changes

### New Tracking Fields

Added to `work_requests` table:

```sql
approved_by TEXT          -- Name/email of approver
approved_at TIMESTAMP     -- When the request was approved
```

### Migration Required

Run this migration to add approval tracking:

```bash
migrations/add_approval_tracking_to_work_requests.sql
```

---

## Frontend Implementation

### 1. Role Check in Component

```javascript
const { user } = useAuth();  // Get current user with profile

// Check if user can approve
const canApprove = user?.profile?.role && 
  ['manager', 'admin'].includes(user.profile.role.toLowerCase());
```

### 2. Conditional Button Rendering

```javascript
{w.status === 'pending' && canApprove && (
  <button onClick={() => approveToWorkOrder(w)}>
    ✅ Approve → WO
  </button>
)}

{w.status === 'pending' && !canApprove && (
  <span style={{ color: '#999' }}>
    🔒 Approve → WO (Manager/Admin only)
  </span>
)}
```

### 3. Runtime Validation

```javascript
async function approveToWorkOrder(request) {
  // Double-check role (defense in depth)
  if (!['manager', 'admin'].includes(user.profile.role.toLowerCase())) {
    showToast('Only managers and admins can approve', 'error');
    return;
  }
  // ... proceed with approval
}
```

---

## User Management Interface

### New Features in Users Page

1. **Role Permissions Reference Card**
   - Shows what each role can do
   - Highlights approval capabilities
   - Displayed at top of Users page

2. **Approval Rights Column in Table**
   - Shows "✅ Can Approve" for Admin/Manager
   - Shows "❌ No Approval" for other roles
   - Green/gray color coding

3. **Role Selection Help Text**
   - When editing a user, shows permissions for selected role
   - Explains what that role can do
   - Helps admins choose correct role

### Example: Edit User Modal

```
Role: [Manager ▼]

📋 Role Help:
✅ Can approve work requests to create work orders
✅ Can manage team assignments
✅ View team work orders
✅ Generate reports
```

---

## API Integration

### Approval Tracking

When approving a work request:

```javascript
await api.workRequests.update(request.id, {
  status: 'approved',
  approvedBy: user?.user_metadata?.full_name || user?.email,
  approvedAt: new Date().toISOString(),
});
```

### Query Example

Get all work requests approved by a specific manager:

```sql
SELECT * FROM work_requests 
WHERE status = 'approved' 
  AND approved_by = 'John Manager'
ORDER BY approved_at DESC;
```

---

## Security Considerations

### Client-Side Checks ✓
- ✅ Hide approve button if user lacks permission
- ✅ Display helpful error message
- ✅ Prevents accidental clicks

### Server-Side Validation ⚠️
**TODO**: Implement backend role verification in API:
```javascript
// In backend API route
if (!['manager', 'admin'].includes(userRole)) {
  return 403 Forbidden;
}
```

### Audit Trail ✓
- ✅ Records who approved (approvedBy)
- ✅ Records when (approvedAt)
- ✅ Enables compliance auditing

---

## Testing Checklist

### Test 1: Admin User Can Approve
- [ ] Login as Admin user
- [ ] Go to Work Requests
- [ ] Find pending request
- [ ] See "✅ Approve → WO" button
- [ ] Click approve
- [ ] Confirm dialog appears
- [ ] See success message
- [ ] Request marked as "approved"
- [ ] Work order created

### Test 2: Manager User Can Approve
- [ ] Login as Manager user
- [ ] Repeat Test 1 steps
- [ ] Verify same behavior as Admin

### Test 3: Technician Cannot Approve
- [ ] Login as Technician user
- [ ] Go to Work Requests
- [ ] Find pending request
- [ ] See "🔒 Approve → WO" (locked/disabled)
- [ ] Hover shows "Manager/Admin only"
- [ ] Cannot click or interact

### Test 4: Approval Tracking
- [ ] Approve a work request
- [ ] Query database
- [ ] Verify `approved_by` field populated
- [ ] Verify `approved_at` timestamp set

### Test 5: User Management Display
- [ ] Go to User Management page
- [ ] See "Role Permissions Reference" card
- [ ] Check each role description is accurate
- [ ] See "Approval Rights" column in table
- [ ] Admin/Manager show "✅ Can Approve"
- [ ] Others show "❌ No Approval"

---

## Configuration

### Where to Define Roles

Roles are defined in two places:

**1. Frontend** (`Users.jsx`):
```javascript
const roles = ['admin', 'manager', 'technician', 'operator', 'viewer'];
```

**2. Database** (`profiles` table):
```sql
ALTER TABLE profiles 
ADD CONSTRAINT role_check 
CHECK (role IN ('admin', 'manager', 'technician', 'operator', 'viewer'));
```

### To Add a New Role

1. Update `Users.jsx` roles array
2. Add to database CHECK constraint
3. Add to `roleBadge` styling map
4. Add permission help text
5. Update approval check (if approval-related)

---

## Notifications

When a work request is approved:

1. **To Assigned Technician**
   - Title: "Work Order Created"
   - Message: "[Work Order Name] has been created and assigned to you"
   - Link: `/work-orders`

2. **Approval Record**
   - Shows who approved: `approvedBy`
   - Shows when: `approvedAt`
   - Visible in work request details

---

## FAQ

**Q: Can I change a user's role?**
A: Yes, go to User Management → Edit User → Change Role dropdown

**Q: What happens if I need to approve after losing manager role?**
A: Once demoted to technician, you cannot approve. Contact an admin to handle approvals.

**Q: Can I see who approved each work request?**
A: Yes, the `approved_by` field tracks this. Can be added to reports/view.

**Q: What if an admin approves on behalf of someone?**
A: The `approved_by` field shows who actually clicked approve, not who the request was about.

**Q: Can I query approvals by department?**
A: Yes, join work_requests with users table and filter by department.

---

## Future Enhancements

Potential improvements:

- [ ] Approval workflows (2-level approval for critical items)
- [ ] Approval delegation (manager delegates to another manager)
- [ ] Email notifications when request awaiting approval
- [ ] SLA tracking (days pending approval)
- [ ] Approval history/audit log
- [ ] Re-approval when request is modified
- [ ] Role-based report access restrictions
- [ ] Department-level approval routing

---

## Support

For role-related issues:

1. Check user's role: User Management → View user
2. Verify approval rights: Check "Approval Rights" column
3. Test as that role: Login with test user account
4. Check error message: Toast shows if approval failed
5. Review database: Query `approvedBy`, `approvedAt` fields

See **`PHOTO_FEATURE_SUMMARY.md`** for other features.

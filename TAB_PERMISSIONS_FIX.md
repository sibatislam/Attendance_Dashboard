# Tab Permissions Independence Fix

## Problem
When deselecting sub-menu tabs (Function, Company, Location) from the **Dashboard** menu in role management, it was automatically deselecting the same tabs from the **Weekly Dashboard** menu. This happened because both menus shared the same tab permission IDs (`tab_function`, `tab_company`, `tab_location`).

## Solution
Made tab permissions **independent per menu** by using unique permission IDs for each menu's tabs.

---

## Changes Made

### 1. Frontend - User Management Page
**File:** `frontend/src/pages/UserManagementPage.jsx`

**Updated Tab IDs:**
- **Dashboard tabs:**
  - `dashboard_tab_function`
  - `dashboard_tab_company`
  - `dashboard_tab_location`

- **Weekly Dashboard tabs:**
  - `weekly_dashboard_tab_function`
  - `weekly_dashboard_tab_company`
  - `weekly_dashboard_tab_location`
  - `weekly_dashboard_tab_department`

- **Legacy tabs** (kept for backward compatibility):
  - `tab_function`
  - `tab_company`
  - `tab_location`
  - `tab_department`

**Updated ATTENDANCE_MENU_TABLE:**
```javascript
const ATTENDANCE_MENU_TABLE = [
  { type: 'menu', id: 'dashboard', label: 'Dashboard', subMenus: [
    { id: 'dashboard_tab_function', label: 'Function' },
    { id: 'dashboard_tab_company', label: 'Company' },
    { id: 'dashboard_tab_location', label: 'Location' }
  ]},
  { type: 'menu', id: 'weekly_dashboard', label: 'Weekly Dashboard', subMenus: [
    { id: 'weekly_dashboard_tab_function', label: 'Function' },
    { id: 'weekly_dashboard_tab_company', label: 'Company' },
    { id: 'weekly_dashboard_tab_location', label: 'Location' },
    { id: 'weekly_dashboard_tab_department', label: 'Department' }
  ]},
  // ... other menus
]
```

### 2. Backend - Role Permissions
**File:** `backend/app/routers/roles.py`

**Updated ATTENDANCE_ALL_FEATURES:**
```python
ATTENDANCE_ALL_FEATURES = [
    "dashboard", "attendance_recognition", "weekly_dashboard", "user_wise",
    "on_time", "work_hour", "work_hour_lost", "leave_analysis", "od_analysis", "weekly_analysis",
    "upload", "batches", "export",
    # Dashboard-specific tabs
    "dashboard_tab_function", "dashboard_tab_company", "dashboard_tab_location",
    # Weekly Dashboard-specific tabs
    "weekly_dashboard_tab_function", "weekly_dashboard_tab_company", 
    "weekly_dashboard_tab_location", "weekly_dashboard_tab_department",
    # Legacy tabs (for backward compatibility)
    "tab_function", "tab_department", "tab_company", "tab_location",
    "view_function_wise", "view_department_wise", "view_company_wise", "view_location_wise",
]
```

### 3. Backend - Tab Visibility Check
**File:** `backend/app/routers/users.py`

**Updated `get_my_scope()` endpoint:**
```python
# Check for Weekly Dashboard tabs (new unique IDs take precedence, fallback to legacy)
visible_tabs = []
tab_checks = [
    ("weekly_dashboard_tab_function", "tab_function", "function"),
    ("weekly_dashboard_tab_company", "tab_company", "company"),
    ("weekly_dashboard_tab_location", "tab_location", "location"),
    ("weekly_dashboard_tab_department", "tab_department", "department"),
]
for new_id, legacy_id, tab_name in tab_checks:
    if new_id in features or legacy_id in features:
        visible_tabs.append(tab_name)
```

### 4. Frontend - Dashboard Page
**File:** `frontend/src/pages/DashboardPage.jsx`

**Added tab filtering:**
```javascript
function getVisibleTabs() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (user.role === 'admin') return ALL_TABS
    const features = user.permissions?.attendance_dashboard?.features || []
    if (features.length === 0) return ALL_TABS
    // Check for Dashboard-specific tab permissions first, then fallback to legacy
    const visible = ALL_TABS.filter(t => 
      features.includes(`dashboard_tab_${t.key}`) || features.includes(`tab_${t.key}`)
    )
    return visible.length ? visible : ALL_TABS
  } catch (e) {
    return ALL_TABS
  }
}
```

### 5. Frontend - Weekly Dashboard Page
**File:** `frontend/src/pages/WeeklyDashboardPage.jsx`

**Updated tab filtering:**
```javascript
function getVisibleTabs() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (user.role === 'admin') return ALL_TABS
    const features = user.permissions?.attendance_dashboard?.features || []
    if (features.length === 0) return ALL_TABS
    // Check for Weekly Dashboard-specific tab permissions first, then fallback to legacy
    const visible = ALL_TABS.filter(t => 
      features.includes(`weekly_dashboard_tab_${t.key}`) || features.includes(`tab_${t.key}`)
    )
    return visible.length ? visible : ALL_TABS
  } catch (e) {
    return ALL_TABS
  }
}
```

---

## Backward Compatibility
The legacy tab IDs (`tab_function`, `tab_company`, `tab_location`, `tab_department`) are still supported. If a role has these legacy permissions, they will apply to **both** Dashboard and Weekly Dashboard until the role is updated with the new specific tab permissions.

---

## How It Works Now

1. **Dashboard Menu:**
   - Selecting/deselecting `Function`, `Company`, or `Location` tabs in Dashboard affects **only** Dashboard
   - Uses permission IDs: `dashboard_tab_function`, `dashboard_tab_company`, `dashboard_tab_location`

2. **Weekly Dashboard Menu:**
   - Selecting/deselecting `Function`, `Company`, `Location`, or `Department` tabs affects **only** Weekly Dashboard
   - Uses permission IDs: `weekly_dashboard_tab_function`, `weekly_dashboard_tab_company`, `weekly_dashboard_tab_location`, `weekly_dashboard_tab_department`

3. **Each menu is now independent** - changing tab permissions in one menu does not affect the other

---

## Testing

1. **Edit a role** in User Management → Role Management
2. **Uncheck** Function tab under **Dashboard**
3. **Verify** that Function tab under **Weekly Dashboard** remains checked
4. **Save** the role
5. **Login** as a user with that role
6. **Verify** Dashboard does not show Function tab, but Weekly Dashboard does

---

## Migration Note
Existing roles with legacy tab permissions will continue to work. When you edit and save a role, the new specific tab permissions will be stored. For a clean migration, you may want to:

1. Edit each custom role
2. Review tab permissions for Dashboard and Weekly Dashboard separately
3. Save the role (this will store the new specific tab IDs)

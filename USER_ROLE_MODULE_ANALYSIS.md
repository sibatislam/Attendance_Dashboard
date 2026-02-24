# User & Role Management Module – Full-Stack Analysis

This document summarizes the **user and role management** module so you can pick up where you left off (e.g. after losing chat history).

---

## 1. Architecture Overview

| Layer | Location | Purpose |
|-------|----------|---------|
| **Backend** | `backend/app/` | FastAPI, SQLAlchemy, JWT auth |
| **Frontend** | `frontend/src/` | React, Vite, TanStack Query, React Router |
| **User Management UI** | `frontend/src/pages/UserManagementPage.jsx` | Single page with tabs: Users, Role management, Employees (N/N-1/N-2) |
| **API client** | `frontend/src/lib/api.js` | Axios + user/role/employee APIs |

---

## 2. Backend – Models & Auth

### Models (`backend/app/models.py`)

- **`Role`**  
  - Table: `roles`  
  - Fields: `id`, `name` (unique), `permissions` (JSON: `attendance_dashboard`, `teams_dashboard` with `enabled` and `features[]`).

- **`User`**  
  - Table: `users`  
  - Fields: `id`, `email`, `username`, `hashed_password`, `full_name`, **`role`** (string: "admin" or role name from `roles`), `is_active`, **`employee_email`**, **`data_scope_level`** ("N", "N-1", "N-2", or null), `phone`, `department`, `position`, `permissions` (legacy), `last_login`, timestamps.

### Auth (`backend/app/auth.py`)

- JWT Bearer; `get_current_user`, `get_current_admin_user` (admin-only routes).
- Passwords: bcrypt via `get_password_hash` / `verify_password`.

---

## 3. Backend – Routers

### Users (`backend/app/routers/users.py`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/` | List users (admin); each user includes resolved `permissions` from Role. |
| GET | `/users/me/scope` | Current user’s data scope (N / N-1 / N-2 or all). |
| GET | `/users/{id}` | Get one user (admin). |
| POST | `/users/` | Create user (admin); body: email, username, password, role, optional employee_email, data_scope_level. |
| PUT | `/users/{id}` | Update user (admin); supports employee_email, data_scope_level. |
| DELETE | `/users/{id}` | Delete user (admin); cannot delete self or admins. |
| POST | `/users/bulk-delete` | Bulk delete by `user_ids`; skips self and admins. |
| GET | `/users/bulk-upload/template` | Download Excel template. |
| POST | `/users/bulk-upload` | Bulk create from Excel; default password 123456. |

- Create/update **validate role** against `roles` table (via `_ensure_default_roles` and Role lookup).
- **Bulk upload** currently maps Excel “Role” to only `"admin"` or `"user"` (custom roles from `roles` table are not used).

### Roles (`backend/app/routers/roles.py`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/roles/` | List roles (admin); ensures default `admin` and `user` exist. |
| GET | `/roles/{id}` | Get one role. |
| POST | `/roles/` | Create role (name + permissions). |
| PUT | `/roles/{id}` | Update role; cannot rename/delete built-in admin/user. |
| DELETE | `/roles/{id}` | Delete role; blocked if any user has that role. |

- Default permissions: `DEFAULT_ADMIN_PERMISSIONS`, `DEFAULT_USER_PERMISSIONS` (attendance_dashboard, teams_dashboard with features).

### Employee hierarchy (`backend/app/routers/employee_files.py`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/employee/files/hierarchy` | Admin-only; returns list of employees with N / N-1 / N-2 level from latest (or specified) employee file. |

- Used by User Management “Employees (N / N-1 / N-2)” tab to show hierarchy and link users via `employee_email` + `data_scope_level`.

---

## 4. Frontend – Routing & Access

- **Route:** `/admin/users` → `UserManagementPage` wrapped in `AdminRoute` (see `frontend/src/main.jsx`).
- **Entry points:** Module selection page and header “User Management” link (`/admin/users`).

---

## 5. Frontend – UserManagementPage Tabs

1. **Users** – List users, filters (search, role, status), create/edit user modal, bulk upload (Excel), bulk delete.
2. **Role management** – List roles, create/edit role modal (module + feature checkboxes).
3. **Employees (N / N-1 / N-2)** – Table of employee hierarchy from `getEmployeeHierarchy()`; used to link users to employees for data scope.

---

## 6. Issues Found and Fixes Applied

### 6.1 Employee hierarchy not loaded (bug)

- **Problem:** The “Employees” tab uses `employeeHierarchy` (e.g. `employeeHierarchy.length`, `employeeHierarchy.map`) but **no query** fetches it, so `employeeHierarchy` is undefined and the tab can crash.
- **Fix:** Add a `useQuery` for `getEmployeeHierarchy` when the “Employees” tab is active and use the result as `employeeHierarchy` (default `[]`).

### 6.2 Data scope not sent on create/update (bug)

- **Problem:** `handleSubmit` builds `submitData` for create/update but **omits** `employee_email` and `data_scope_level`. Backend supports them; they were never sent.
- **Fix:** Include `employee_email` and `data_scope_level` in `submitData` in `handleSubmit`.

### 6.3 No UI for data scope in user modal (missing feature)

- **Problem:** Form state has `employee_email` and `data_scope_level`, and they are set in `handleEdit`, but the **Create/Edit User modal has no inputs** for them, so admins cannot set or change data scope in the UI.
- **Fix:** Add fields in the user modal: “Employee Email (Official)” and “Data Scope Level” (dropdown: Off, N, N-1, N-2), and wire them to `formData` and `submitData`.

### 6.4 Bulk upload only supports admin/user (limitation)

- **Problem:** In `users.py` bulk_upload, role from Excel is mapped to either `"admin"` or `"user"`. Custom roles from the `roles` table are ignored.
- **Fix (optional):** When parsing the Role column, validate against existing roles (e.g. via `_ensure_default_roles` + Role lookup) and use that role name; otherwise reject or skip the row with a clear error.

---

## 7. API Summary (frontend `api.js`)

- **Users:** `getUsers`, `createUser`, `updateUser`, `deleteUser`, `deleteUsers`, `downloadUserBulkTemplate`, `bulkUploadUsers`.
- **Roles:** `getRoles`, `createRole`, `updateRole`, `deleteRole`.
- **Scope:** `getMyScope()` → GET `/users/me/scope`.
- **Employee hierarchy:** `getEmployeeHierarchy(employeeFileId?)` → GET `/employee/files/hierarchy`.

---

## 8. Permissions Model

- **Role** stores: `attendance_dashboard` and `teams_dashboard`, each with `enabled` and `features[]`.
- **User** has `role` (string). Resolved permissions come from the `roles` table (see `get_permissions_for_role` in `users.py` and `roles.py`).
- Frontend uses these permissions (and `/users/me/scope`) to show/hide modules and menus (e.g. sidebar, module selection).

---

## 9. Files to Touch for User/Role Work

| Area | Files |
|------|--------|
| Backend models | `backend/app/models.py` (User, Role) |
| Backend schemas | `backend/app/schemas.py` (UserCreate, UserUpdate, UserResponse) |
| Backend users API | `backend/app/routers/users.py` |
| Backend roles API | `backend/app/routers/roles.py` |
| Backend employee hierarchy | `backend/app/routers/employee_files.py`, `backend/app/services/employee_hierarchy.py` |
| Backend auth | `backend/app/auth.py` |
| Frontend page | `frontend/src/pages/UserManagementPage.jsx` |
| Frontend API | `frontend/src/lib/api.js` |
| Routing / access | `frontend/src/main.jsx`, `frontend/src/components/AdminRoute.jsx` |

---

This analysis and the code fixes below restore correct behavior for the Employees tab, data scope in create/update, and UI for employee email and data scope level. Bulk upload can be extended later to support custom roles as in section 6.4.

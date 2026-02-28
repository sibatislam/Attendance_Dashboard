# Logic example: How omar.faruk sees only his subordinates’ data

## 1. Who is omar.faruk (in this example)

- **Login:** e.g. `omar.faruk` or `omar.faruk@cg-bd.com`
- **In Employee List (organogram):** e.g. Email (Official) = `omar.faruk@cg-bd.com`, Employee Code = `10048`, Level = N-3, Department = IT
- **Direct reports (from organogram):** 3 people — e.g. Md. Sabbir Hossain (15149), Mohammad Samim Hasan (15237), S. M. Raju (13492)

---

## 2. Step-by-step logic (N-2 / N-3: self + subordinates only)

### Step 1: Find omar.faruk in the organogram

We build **hierarchy_map** from the **Employee List** (latest upload):

- Key = email (lowercase), e.g. `omar.faruk@cg-bd.com`
- Value = row with: `email`, `name`, `employee_code`, `function`, `department`, `level`, `supervisor_name`, `line_manager_employee_id`

We resolve the **current user** with:

1. `hierarchy_map.get(employee_email)`  
2. else `hierarchy_map.get(username)`  
3. else match **username part** (e.g. `omar.faruk`) to `email.split("@")[0]` for any key  
4. else look up by **User.employee_code** in a code→email map from the hierarchy

So for omar.faruk we get **key** = `omar.faruk@cg-bd.com` (his entry in the organogram).

---

### Step 2: Decide scope: N-1 vs N-2 to N-N

- **Level from DB:** `User.data_scope_level` (e.g. `"N-3"`)
- **Level from organogram:** `emp_row["level"]` (e.g. `"N-3"`)

- If level is **N** → no filter (see all).
- If level is **N-1** → we return **only department/function** sets (no employee codes).  
  Then we filter attendance by **department/function** only → **whole department**.
- If level is **N-2, N-3, …** → we use **self + subordinates** (next steps).

For omar.faruk we assume N-3 → **self + subordinates** branch.

---

### Step 3: Build “self + subordinates” from organogram

- **child_map** = who reports to whom:
  - Built from Employee List using **Line Manager Employee ID** or **Supervisor Name**.
  - Example: `child_map["omar.faruk@cg-bd.com"]` = `["sab.hossain@...", "samim.hasan@...", "sm.raju@..."]`

- **get_subordinate_emails(hierarchy_map, child_map, key)**:
  - Starts from `key` (omar.faruk’s email).
  - Adds self, then does BFS over `child_map` and adds all descendants.
  - Result: `allowed_emails_set` = { omar.faruk’s email, 3 report emails }.

- **From that set we collect:**
  - **allowed_codes** = employee codes of everyone in the set (from hierarchy rows).
  - **allowed_emails** = the same emails (normalized).
  - **allowed_departments** / **allowed_functions** = distinct dept/func of that set (for extra safety).

Example for omar.faruk:

- **allowed_emails** = { `omar.faruk@cg-bd.com`, `sab.hossain@...`, `samim.hasan@...`, `sm.raju@...` }
- **allowed_codes** = { `"10048"`, `"15149"`, `"15237"`, `"13492"` }

---

### Step 4: Filter attendance rows by those codes/emails

When the frontend (or any client) calls **GET /files/{file_id}**:

1. We load all **attendance rows** for that file.
2. We call **get_allowed_employee_codes_for_attendance(db, current_user)** and get:
   - `allowed_codes`, `allowed_emails` (and optionally dept/func sets).
3. For each attendance row we:
   - Read **employee identifier** from the row (e.g. **Employee Code** / **Employee ID** / **Emp Code** / **Code** — multiple possible column names).
   - Read **email** from the row if present (e.g. **Email (Official)**, **Email**).
   - **Keep the row only if:**
     - `(row_employee_code normalized and in allowed_codes)` **or**
     - `(row_email normalized and in allowed_emails)`  
   and, when we use dept/func, row’s department/function is in the allowed sets.

So for omar.faruk we **keep only rows** where:

- Employee Code is one of `10048`, `15149`, `15237`, `13492`, **or**
- Email is one of his and his 3 reports’ emails.

All other employees’ rows are **dropped** at the backend.

---

### Step 5: What omar.faruk sees

- **User Analytics (On Time %, Work Hour, etc.):**  
  The table is built from **rows returned by GET /files/{id}**.  
  So he sees **only**:
  - himself (10048),
  - Md. Sabbir Hossain (15149),
  - Mohammad Samim Hasan (15237),
  - S. M. Raju (13492).

- He does **not** see other IT (or any other) employees, because their employee codes/emails are not in the allowed set and their rows are never returned.

---

## 3. Summary table

| Step | What we use | Result for omar.faruk |
|------|-------------|------------------------|
| 1 | Username / email → organogram | key = `omar.faruk@cg-bd.com` |
| 2 | Level N-3 (not N, not N-1) | Use “self + subordinates” |
| 3 | child_map + get_subordinate_emails | 4 emails → 4 employee codes (10048, 15149, 15237, 13492) |
| 4 | Filter each attendance row by code/email | Only rows with those 4 codes/emails kept |
| 5 | Frontend displays returned rows | He sees only himself + 3 subordinates |

---

## 4. Where this lives in code (D:)

- **Resolve user + level + self+subordinates:**  
  `backend/app/services/employee_hierarchy.py`  
  → `get_allowed_employee_codes_for_attendance()`, `_build_child_map()`, `get_subordinate_emails()`
- **Apply filter to file rows:**  
  `backend/app/routers/files.py`  
  → `get_file_detail()`: uses `get_allowed_employee_codes_for_attendance()` and keeps only rows whose employee code/email is in the returned sets.

So for omar.faruk we **always** use the organogram (Employee List) to get his and his reports’ **employee codes**, then we **match those codes (and emails) in the attendance report** and return only those rows — that’s how we show his subordinates’ data and no one else’s.

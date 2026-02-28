"""Build employee hierarchy (N, N-1, N-2) from Supervisor Name and Line Manager Employee ID."""
from typing import Any, Dict, List, Optional
from collections import deque

from sqlalchemy.orm import Session

from ..models import EmployeeUploadedFile, EmployeeUploadedRow


def _norm(s: str) -> str:
    return (s or "").strip().lower()


def _norm_employee_code(s: str) -> str:
    """Normalize employee code / line manager ID so 11410 and 11410.0 (Excel) match."""
    s = (s or "").strip()
    if not s:
        return ""
    s_lower = s.lower()
    # If it looks like a number (possibly with .0), strip trailing .0 for consistent lookup
    if s_lower.replace(".", "").replace(" ", "").isdigit():
        try:
            return str(int(float(s)))
        except (ValueError, TypeError):
            pass
    return s_lower


def _get_cell(data: Dict[str, Any], *keys: str) -> str:
    """Get first non-empty value for any of the given keys. Tries exact match, then case-insensitive + strip match on data keys."""
    # Exact match first
    for k in keys:
        v = data.get(k)
        if v is not None and str(v).strip():
            return str(v).strip()
    # Build normalized data key map: norm(header) -> (original_key, value)
    data_norm: Dict[str, tuple] = {}
    for dk, dv in data.items():
        if dv is None:
            continue
        s = str(dv).strip()
        if not s:
            continue
        n = _norm(dk)
        if n and n not in data_norm:  # first occurrence wins
            data_norm[n] = (dk, s)
    # Match any candidate by normalized name
    for k in keys:
        n = _norm(k)
        if n and n in data_norm:
            return data_norm[n][1]
    return ""


def build_hierarchy_map(
    db: Session,
    employee_file_id: Optional[int] = None,
) -> Dict[str, Dict[str, Any]]:
    """
    Returns dict: email_lower -> { email, name, employee_code, function, department, level }.
    Level is "N", "N-1", "N-2", ... from org tree (roots = no line manager).
    """
    if employee_file_id:
        files = db.query(EmployeeUploadedFile).filter(EmployeeUploadedFile.id == employee_file_id).all()
    else:
        # Use only the single latest file so re-uploads always win (no merge from older files)
        files = (
            db.query(EmployeeUploadedFile)
            .order_by(EmployeeUploadedFile.uploaded_at.desc())
            .limit(1)
            .all()
        )
    if not files:
        return {}

    email_to_row: Dict[str, Dict[str, Any]] = {}
    for f in files:
        rows = db.query(EmployeeUploadedRow.data).filter(EmployeeUploadedRow.file_id == f.id).all()
        for r in rows:
            data = r.data or {}
            email = _get_cell(data, "Email (Official)", "Email (Offical)", "Email")
            if not email:
                continue
            email_lower = email.lower()
            # Function/Department/Company: try many possible column names (order = preference; first non-empty wins)
            # Department: prefer more specific (Sub Department, Team) so "Learning and Culture" shows over "Human Resources & Administration"
            # source_filename so UI can show which uploaded file this row came from (proves we read from employee list)
            email_to_row[email_lower] = {
                "email": email,
                "name": _get_cell(data, "Employee Name", "Name", "Employee name"),
                "employee_code": _get_cell(data, "Employee Code", "Employee ID", "Emp Code", "Code"),
                "function": _get_cell(data, "Function"),
                "department": _get_cell(data, "Department"),
                "company": _get_cell(
                    data,
                    "Company Name", "Company", "Comapny Name", "Legal Entity", "Company Name (Legal)", "Entity",
                ),
                "supervisor_name": _get_cell(data, "Supervisor Name", "Supervisor", "Line Manager Name", "Manager Name"),
                "line_manager_employee_id": _get_cell(
                    data, "Line Manager Employee ID", "Line Manager ID", "Line Manager Code", "Report To ID", "Manager ID"
                ),
                "source_file_id": getattr(f, "id", None),
                "source_filename": getattr(f, "filename", None) or "",
            }

    code_to_email: Dict[str, str] = {}
    for e, v in email_to_row.items():
        if v.get("employee_code"):
            code_to_email[_norm_employee_code(v["employee_code"])] = e
        code_to_email[e] = e

    def parent_email(row: Dict[str, Any]) -> Optional[str]:
        lm_id = (row.get("line_manager_employee_id") or "").strip()
        sup_name = (row.get("supervisor_name") or "").strip()
        if lm_id:
            lm_norm = _norm_employee_code(lm_id)
            if lm_norm and lm_norm in code_to_email:
                return code_to_email[lm_norm]
            if "@" in lm_id and lm_id.lower().strip() in email_to_row:
                return lm_id.lower().strip()
        if sup_name:
            for emp, r2 in email_to_row.items():
                if (r2.get("name") or "").strip().lower() == sup_name.lower():
                    return emp
        return None

    email_to_parent: Dict[str, Optional[str]] = {}
    child_map: Dict[str, List[str]] = {}
    for e, row in email_to_row.items():
        p = parent_email(row)
        email_to_parent[e] = p
        if p and p in email_to_row:
            child_map.setdefault(p, []).append(e)

    roots = [e for e in email_to_row if not email_to_parent.get(e) or email_to_parent[e] not in email_to_row]
    if not roots:
        roots = list(email_to_row.keys())

    def next_level(level: str) -> str:
        if level == "N":
            return "N-1"
        parts = level.split("-")
        if len(parts) >= 2:
            try:
                n = int(parts[1])
                return f"N-{n + 1}"
            except ValueError:
                pass
        return "N-1"

    level_map: Dict[str, str] = {}
    q = deque((r, "N") for r in roots)
    seen = set()
    while q:
        email_key, level = q.popleft()
        if email_key in seen:
            continue
        seen.add(email_key)
        level_map[email_key] = level
        for child in child_map.get(email_key, []):
            q.append((child, next_level(level)))

    for e in email_to_row:
        if e not in level_map:
            level_map[e] = "N-2"

    # Add level to each row; also collect all functions and function->departments for scope
    for e, row in email_to_row.items():
        row["level"] = level_map.get(e)

    return email_to_row


def _build_child_map(hierarchy_map: Dict[str, Dict[str, Any]]) -> Dict[str, List[str]]:
    """Build parent_email -> [child_emails] from hierarchy_map (for subordinate scope)."""
    if not hierarchy_map:
        return {}
    code_to_email: Dict[str, str] = {}
    for e, v in hierarchy_map.items():
        if v.get("employee_code"):
            code_to_email[_norm_employee_code(v["employee_code"])] = e
        code_to_email[e.lower()] = e

    def parent_email(row: Dict[str, Any]) -> Optional[str]:
        lm_id = (row.get("line_manager_employee_id") or "").strip()
        sup_name = (row.get("supervisor_name") or "").strip()
        if lm_id:
            lm_norm = _norm_employee_code(lm_id)
            if lm_norm and lm_norm in code_to_email:
                return code_to_email[lm_norm]
            if "@" in lm_id and lm_id.lower() in hierarchy_map:
                return lm_id.lower()
        if sup_name:
            sup_lower = sup_name.lower()
            for emp, r2 in hierarchy_map.items():
                if _norm(r2.get("name") or "") == sup_lower:
                    return emp
        return None

    child_map: Dict[str, List[str]] = {}
    for e, row in hierarchy_map.items():
        p = parent_email(row)
        if p and p in hierarchy_map:
            child_map.setdefault(p, []).append(e)
    return child_map


def get_emails_and_codes_in_functions(
    hierarchy_map: Dict[str, Dict[str, Any]],
    allowed_functions: List[str],
) -> tuple[set, set]:
    """
    Return (emails_set, codes_set) for all employees whose function is in allowed_functions.
    Used for N-1: see all employees under their function, not just subordinates.
    """
    if not hierarchy_map or not allowed_functions:
        return (set(), set())
    func_set = {f.strip().lower() for f in allowed_functions if (f or "").strip()}
    emails = set()
    codes = set()
    for e, row in hierarchy_map.items():
        f = (row.get("function") or "").strip().lower()
        if f and f in func_set:
            emails.add(e.lower())
            code = (row.get("employee_code") or "").strip()
            if code:
                codes.add(code.lower())
    return (emails, codes)


def get_subordinate_emails(
    hierarchy_map: Dict[str, Dict[str, Any]],
    child_map: Dict[str, List[str]],
    employee_email: str,
) -> set:
    """
    Return set of employee emails this user can see: self + all subordinates (transitive).
    - If level is N (root): return all emails in hierarchy (see everyone).
    - If no subordinates: return only {employee_email}.
    - Otherwise: return {employee_email} union all descendants in the tree.
    """
    if not hierarchy_map or not employee_email:
        return set()
    email_lower = employee_email.strip().lower()
    if email_lower not in hierarchy_map:
        return {email_lower}
    row = hierarchy_map[email_lower]
    level = (row.get("level") or "").strip()
    if level == "N":
        return set(hierarchy_map.keys())
    out = {email_lower}
    q = deque([email_lower])
    while q:
        parent = q.popleft()
        for child in child_map.get(parent, []):
            if child not in out:
                out.add(child)
                q.append(child)
    return out


def get_allowed_employee_codes_for_attendance(
    db: Session, user: Any
) -> tuple[Optional[set], Optional[set], Optional[set], Optional[set]]:
    """
    Return (allowed_codes, allowed_emails, allowed_departments, allowed_functions) for filtering attendance rows.
    If user is admin or level N: returns (None, None, None, None) — no filter.
    If user has explicit allowed_functions (e.g. two functions selected): returns all employees in those functions.
    N-1: returns all employees in user's function (not just subordinates).
    N-2 and below: returns self + subordinates only.
    """
    if getattr(user, "role", None) == "admin":
        return (None, None, None, None)
    level = (getattr(user, "data_scope_level", None) or "").strip()
    if level == "N" or getattr(user, "role", None) == "N":
        return (None, None, None, None)
    hierarchy_map = build_hierarchy_map(db, None)
    if not hierarchy_map:
        return (None, None, None, None)

    # Explicit allowed_functions (user selected multiple functions): use only when NOT N-2/N-3/... so subordinates still work
    is_n2_or_deeper = level.startswith("N-") and level not in ("N", "N-1") if level else False
    af = getattr(user, "allowed_functions", None)
    if isinstance(af, list) and len(af) > 0 and not is_n2_or_deeper:
        _func_names = []
        for f in af:
            if isinstance(f, dict):
                _func_names.append((f.get("name") or f.get("value") or "").strip())
            elif f is not None:
                _func_names.append(str(f).strip())
        _func_names = [x for x in _func_names if x]
        if _func_names:
            allowed_emails_set, allowed_codes_set = get_emails_and_codes_in_functions(hierarchy_map, _func_names)
            if allowed_emails_set or allowed_codes_set:
                return (allowed_codes_set, allowed_emails_set, None, None)
    emp_email = (getattr(user, "employee_email", None) or getattr(user, "email", None) or "").strip().lower()
    emp_username = (getattr(user, "username", None) or "").strip().lower()
    username_part = emp_username.split("@")[0] if "@" in emp_username else emp_username
    key = hierarchy_map.get(emp_email) and emp_email or (hierarchy_map.get(emp_username) and emp_username)
    if not key and username_part:
        for _e in hierarchy_map:
            if (_e.split("@")[0] if "@" in _e else _e) == username_part:
                key = _e
                break
    if not key:
        return (None, None, None, None)

    # N-1: all employees in user's function (subordinates logic not applicable).
    # Return None for depts/funcs so file detail only filters by code/email (avoids excluding rows
    # when attendance file function/department names differ from Employee List).
    if level == "N-1":
        emp = hierarchy_map.get(key)
        func = (emp.get("function") or "").strip() if emp else ""
        if not func:
            return (None, None, None, None)
        allowed_emails_set, allowed_codes_set = get_emails_and_codes_in_functions(hierarchy_map, [func])
        if not allowed_emails_set and not allowed_codes_set:
            return (None, None, None, None)
        return (allowed_codes_set, allowed_emails_set, None, None)

    # N-2, N-3, ...: self + subordinates only
    child_map = _build_child_map(hierarchy_map)
    allowed_emails_set = get_subordinate_emails(hierarchy_map, child_map, key)
    codes = set()
    emails = set()
    departments = set()
    functions = set()
    for e in allowed_emails_set:
        emails.add(e.lower())
        row = hierarchy_map.get(e)
        if not row:
            continue
        if (row.get("employee_code") or "").strip():
            codes.add((row.get("employee_code") or "").strip().lower())
        d = (row.get("department") or "").strip().lower()
        if d:
            departments.add(d)
        f = (row.get("function") or "").strip().lower()
        if f:
            functions.add(f)
    if not (codes or emails):
        return (None, None, None, None)
    return (codes, emails, departments or None, functions or None)


def scope_for_user(
    db: Session,
    employee_email: Optional[str],
    data_scope_level: Optional[str],
    hierarchy_map: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Return { "all": True } for admin / N / no scope; else
    { "allowed_functions": [...], "allowed_departments": [...], "data_scope_level": "N-1" }.
    """
    if not employee_email or not data_scope_level:
        return {"all": True, "allowed_functions": None, "allowed_departments": None, "data_scope_level": None}

    if hierarchy_map is None:
        hierarchy_map = build_hierarchy_map(db, None)

    email_lower = employee_email.strip().lower()
    emp = hierarchy_map.get(email_lower)
    if not emp:
        return {"all": True, "allowed_functions": None, "allowed_departments": None, "data_scope_level": data_scope_level}

    level = (data_scope_level or "").strip()
    if level == "N":
        return {"all": True, "allowed_functions": None, "allowed_departments": None, "data_scope_level": "N"}

    func = (emp.get("function") or "").strip()
    dept = (emp.get("department") or "").strip()

    if level == "N-1":
        # All departments under this function
        depts_under_function = set()
        for row in hierarchy_map.values():
            if (row.get("function") or "").strip() == func and (row.get("department") or "").strip():
                depts_under_function.add((row.get("department") or "").strip())
        return {
            "all": False,
            "allowed_functions": [func] if func else [],
            "allowed_departments": sorted(depts_under_function),
            "data_scope_level": "N-1",
        }

    # N-2 or lower: only their department(s); include function so backend filter matches persisted scope
    return {
        "all": False,
        "allowed_functions": [func] if func else [],
        "allowed_departments": [dept] if dept else [],
        "data_scope_level": level,
    }


def scope_to_persist_for_user(
    hierarchy_map: Dict[str, Dict[str, Any]],
    employee_email: str,
    level: str,
) -> Dict[str, Any]:
    """
    Return { "allowed_companies": [], "allowed_functions": [], "allowed_departments": [] }
    to persist on a User for the given hierarchy level. Used by sync-roles-from-hierarchy.
    - N: return empty lists (user sees all via hierarchy).
    - N-1: user's function, all departments under that function, all companies that have that function.
    - N-2 etc: user's department, empty functions, user's company.
    """
    email_lower = (employee_email or "").strip().lower()
    emp = hierarchy_map.get(email_lower) if email_lower else None
    if not emp:
        return {"allowed_companies": [], "allowed_functions": [], "allowed_departments": []}

    func = (emp.get("function") or "").strip()
    dept = (emp.get("department") or "").strip()
    company = (emp.get("company") or "").strip()
    level = (level or "").strip()

    if level == "N":
        return {"allowed_companies": [], "allowed_functions": [], "allowed_departments": []}

    if level == "N-1":
        depts_under_function = set()
        companies_with_function = set()
        for row in hierarchy_map.values():
            rfunc = (row.get("function") or "").strip()
            if rfunc == func:
                d = (row.get("department") or "").strip()
                if d:
                    depts_under_function.add(d)
                c = (row.get("company") or "").strip()
                if c:
                    companies_with_function.add(c)
        return {
            "allowed_companies": sorted(companies_with_function),
            "allowed_functions": [func] if func else [],
            "allowed_departments": sorted(depts_under_function),
        }

    # N-2, N-3, ...: own department only; set allowed_functions to user's function so Weekly Dashboard Function tab shows only their function
    return {
        "allowed_companies": [company] if company else [],
        "allowed_functions": [func] if func else [],
        "allowed_departments": [dept] if dept else [],
    }


def get_effective_scope(
    db: Session,
    user: Any,
    hierarchy_map: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Return effective data scope for a user (for API filtering).
    - Admin -> all.
    - If user has allowed_functions / allowed_departments / allowed_companies set (non-empty), use those.
    - Else derive from employee + data_scope_level: N -> all; N-1 -> own function + all depts under it; N-2 -> only own department.
    """
    if getattr(user, "role", None) == "admin":
        return {"all": True, "allowed_functions": None, "allowed_departments": None, "allowed_companies": None}
    if getattr(user, "role", None) == "N":
        return {"all": True, "allowed_functions": None, "allowed_departments": None, "allowed_companies": None}
    af = getattr(user, "allowed_functions", None)
    ad = getattr(user, "allowed_departments", None)
    ac = getattr(user, "allowed_companies", None)
    if isinstance(af, list) and len(af) > 0:
        return {"all": False, "allowed_functions": af, "allowed_departments": ad or [], "allowed_companies": ac or []}
    if isinstance(ad, list) and len(ad) > 0:
        return {"all": False, "allowed_functions": af or [], "allowed_departments": ad, "allowed_companies": ac or []}
    if isinstance(ac, list) and len(ac) > 0:
        return {"all": False, "allowed_functions": af or [], "allowed_departments": ad or [], "allowed_companies": ac}
    # Default: derive from employee + data_scope_level (N / N-1 / N-2)
    emp_email = (getattr(user, "employee_email", None) or "").strip() or None
    data_scope_level = (getattr(user, "data_scope_level", None) or "").strip() or None
    if emp_email and data_scope_level:
        scope = scope_for_user(db, emp_email, data_scope_level, hierarchy_map)
        if scope.get("all"):
            return {"all": True, "allowed_functions": None, "allowed_departments": None, "allowed_companies": None}
        # scope_for_user returns allowed_functions, allowed_departments; add allowed_companies from hierarchy
        if hierarchy_map is None:
            hierarchy_map = build_hierarchy_map(db, None)
        emp = hierarchy_map.get(emp_email.lower()) if hierarchy_map else None
        companies = []
        if emp and scope.get("allowed_functions"):
            # For N-1 we have one function; include that function's company
            for row in (hierarchy_map or {}).values():
                if (row.get("function") or "").strip() in (scope.get("allowed_functions") or []):
                    c = (row.get("company") or "").strip()
                    if c and c not in companies:
                        companies.append(c)
        if emp and not companies and (emp.get("company") or "").strip():
            companies = [(emp.get("company") or "").strip()]
        return {
            "all": False,
            "allowed_functions": scope.get("allowed_functions") or [],
            "allowed_departments": scope.get("allowed_departments") or [],
            "allowed_companies": companies,
        }
    # No employee/scope: fallback to single-entity scope from hierarchy if we have employee only
    if hierarchy_map is None:
        hierarchy_map = build_hierarchy_map(db, None)
    emp = hierarchy_map.get(emp_email.lower()) if emp_email else None
    if emp:
        func = (emp.get("function") or "").strip()
        dept = (emp.get("department") or "").strip()
        company = (emp.get("company") or "").strip()
        return {
            "all": False,
            "allowed_functions": [func] if func else [],
            "allowed_departments": [dept] if dept else [],
            "allowed_companies": [company] if company else [],
        }
    return {"all": True, "allowed_functions": None, "allowed_departments": None, "allowed_companies": None}


# Function names to exclude from scope options (e.g. not shown in filters or Cost Settings).
EXCLUDED_FUNCTIONS = {"CG Board", "CG HR"}


def get_scope_options(
    db: Session,
    employee_file_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Return unique companies, functions (with company), and departments (with function, company)
    from employee list. For role data scope with hierarchy: only functions under selected
    company can be selected; only departments under selected function can be selected.
    """
    hierarchy_map = build_hierarchy_map(db, employee_file_id)
    companies: set = set()
    functions_list: List[Dict[str, str]] = []  # { "name": "IT", "company": "CIPLC" }
    departments_list: List[Dict[str, str]] = []  # { "name": "Dev", "function": "IT", "company": "CIPLC" }
    seen_f = set()
    seen_d = set()
    for row in hierarchy_map.values():
        c = (row.get("company") or "").strip()
        f = (row.get("function") or "").strip()
        d = (row.get("department") or "").strip()
        if c:
            companies.add(c)
        if f and c and f not in EXCLUDED_FUNCTIONS:
            key_f = (c, f)
            if key_f not in seen_f:
                seen_f.add(key_f)
                functions_list.append({"name": f, "company": c})
        if d and f and f not in EXCLUDED_FUNCTIONS:
            key_d = (f, d)
            if key_d not in seen_d:
                seen_d.add(key_d)
                departments_list.append({"name": d, "function": f, "company": c or ""})
    functions_list.sort(key=lambda x: (x["company"], x["name"]))
    departments_list.sort(key=lambda x: (x["function"], x["name"]))
    return {
        "companies": sorted(companies),
        "functions": functions_list,
        "departments": departments_list,
    }


def get_scope_options_for_user(
    db: Session,
    user: Any,
) -> Dict[str, Any]:
    """
    Return companies, functions, and departments that the current user is allowed to see
    (for filter dropdowns). Uses get_effective_scope then filters get_scope_options.
    """
    full = get_scope_options(db, None)
    scope = get_effective_scope(db, user)
    if scope.get("all"):
        return full

    def _norm_item(x, key_name="name"):
        if x is None:
            return ""
        if isinstance(x, dict):
            return (x.get(key_name) or x.get("value") or "").strip()
        return str(x).strip()

    ac = set(_norm_item(c) for c in (scope.get("allowed_companies") or []) if _norm_item(c))
    af = set(_norm_item(f) for f in (scope.get("allowed_functions") or []) if _norm_item(f))
    ad = set(_norm_item(d) for d in (scope.get("allowed_departments") or []) if _norm_item(d))
    full_companies = full.get("companies") or []
    full_functions = full.get("functions") or []
    full_departments = full.get("departments") or []

    def _dept_in_scope(opt_name: str, allowed: set) -> bool:
        if not allowed:
            return True
        on = (opt_name or "").strip().lower()
        for a in allowed:
            al = (a or "").strip().lower()
            if on == al or al in on or on in al:
                return True
        return False

    companies = [c for c in full_companies if c in ac] if ac else full_companies
    departments = [
        x for x in full_departments
        if (not ad or _dept_in_scope(x.get("name"), ad))
        and (not af or (x.get("function") or "").strip() in af)
        and (not ac or x.get("company") in ac)
    ]
    if ad and not af:
        af = {(x.get("function") or "").strip() for x in full_departments if _dept_in_scope(x.get("name"), ad)}
    af_lower = {a.lower() for a in af} if af else set()
    functions = [
        x for x in full_functions
        if (not af or (x.get("name") or "").strip().lower() in af_lower) and (not ac or x.get("company") in ac)
    ]
    if ac and not companies and full_departments:
        companies = list({x.get("company") for x in departments if x.get("company") in ac})
    return {
        "companies": companies,
        "functions": functions,
        "departments": departments,
    }

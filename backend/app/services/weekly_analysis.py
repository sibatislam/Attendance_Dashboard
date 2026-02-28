from __future__ import annotations

from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from collections import defaultdict
import re
from datetime import datetime, timedelta

from ..models import UploadedRow


def _get_company_short_name(company_name: str) -> str:
    """Convert company name to short code."""
    company_map = {
        "Confidence Batteries Limited": "CBL",
        "Confidence Infrastructure PLC.": "CIPLC",
        "Confidence Steel Export Limited": "CSEL",
    }
    return company_map.get(company_name, company_name)


def _parse_date(date_str: str) -> datetime | None:
    """
    Parse date string to datetime object. Handles multiple formats including Excel dates.
    Matches the logic used in _extract_month but returns full date.
    """
    if not date_str:
        return None
    s = str(date_str).strip()
    if not s:
        return None
    
    # Handle Excel date serial numbers (e.g., 45321.0)
    try:
        if '.' in s or (s.isdigit() and len(s) > 4):
            excel_serial = float(s)
            # Excel epoch is 1900-01-01, but Excel incorrectly treats 1900 as a leap year
            # So we need to adjust: Excel date 1 = 1899-12-30
            excel_epoch = datetime(1899, 12, 30)
            try:
                return excel_epoch + timedelta(days=int(excel_serial))
            except (ValueError, OverflowError):
                pass
    except (ValueError, TypeError):
        pass
    
    # Try DD-MMM-YYYY or DD-MMM-YY format (e.g., 15-Jan-2025, 15-Jan-25)
    month_map = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
        'jul': 7, 'aug': 8, 'sep': 9, 'sept': 9, 'oct': 10, 'nov': 11, 'dec': 12,
        'january': 1, 'february': 2, 'march': 3, 'april': 4, 'june': 6, 'july': 7,
        'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
    }
    m = re.search(r"(\d{1,2})[-/](\w{3,})[-/](20\d{2}|\d{2})", s, re.I)
    if m:
        try:
            day = int(m.group(1))
            month_name = m.group(2).lower()
            year_str = m.group(3)
            year = int(year_str)
            if len(year_str) == 2:
                year = 2000 + year if year < 100 else 1900 + year
            
            # Try to match month name
            for key, month_num in month_map.items():
                if month_name.startswith(key):
                    if 1 <= day <= 31:
                        return datetime(year, month_num, day)
                    break
        except (ValueError, TypeError):
            pass
    
    # Try YYYY-MM-DD format (e.g., 2025-01-15, 2025-1-5)
    m = re.search(r"(20\d{2})[-/](\d{1,2})[-/](\d{1,2})", s)
    if m:
        try:
            year = int(m.group(1))
            month = int(m.group(2))
            day = int(m.group(3))
            if 1 <= month <= 12 and 1 <= day <= 31:
                return datetime(year, month, day)
        except (ValueError, TypeError):
            pass
    
    # Try DD-MM-YYYY format (e.g., 15-01-2025, 5-1-2025)
    m = re.search(r"(\d{1,2})[-/](\d{1,2})[-/](20\d{2})", s)
    if m:
        try:
            day = int(m.group(1))
            month = int(m.group(2))
            year = int(m.group(3))
            if 1 <= month <= 12 and 1 <= day <= 31:
                return datetime(year, month, day)
        except (ValueError, TypeError):
            pass
    
    # Try DD/MM/YYYY format (e.g., 15/01/2025)
    m = re.search(r"(\d{1,2})/(\d{1,2})/(20\d{2})", s)
    if m:
        try:
            day = int(m.group(1))
            month = int(m.group(2))
            year = int(m.group(3))
            if 1 <= month <= 12 and 1 <= day <= 31:
                return datetime(year, month, day)
        except (ValueError, TypeError):
            pass
    
    # Try parsing with datetime.strptime for common formats
    common_formats = [
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%Y/%m/%d",
        "%d.%m.%Y",
        "%Y.%m.%d",
        "%m/%d/%Y",  # US format
        "%d-%m-%y",  # 2-digit year
        "%d/%m/%y",
        "%d-%b-%Y",  # 15-Jan-2025
        "%d-%B-%Y",  # 15-January-2025
        "%d/%b/%Y",
        "%d/%B/%Y",
    ]
    for fmt in common_formats:
        try:
            parsed = datetime.strptime(s, fmt)
            # If 2-digit year, assume 2000s
            if fmt.endswith("%y") and parsed.year < 2000:
                parsed = parsed.replace(year=parsed.year + 2000)
            return parsed
        except (ValueError, TypeError):
            continue
    
    return None


def _get_week_key(date: datetime) -> tuple:
    """
    Get week key as (year, month, week_in_month).
    Returns tuple: (year, month_number, week_number_in_month)
    Week 1 = days 1-7 of the month, Week 2 = days 8-14, etc.
    """
    year = date.year
    month = date.month
    day = date.day
    # Calculate week number within the month: Week 1 = days 1-7, Week 2 = days 8-14, etc.
    week_in_month = ((day - 1) // 7) + 1
    
    return (year, month, week_in_month)

def _format_week_key(year: int, month: int, week: int) -> str:
    """Format week key as string for storage/comparison: YYYY-MM-WW"""
    return f"{year}-{month:02d}-W{week:02d}"


def _time_to_hours(time_str: str) -> float:
    """Convert time string to hours. Handles HH:MM, HH.MM, and Excel serial (0-1 = fraction of day)."""
    if not time_str:
        return 0.0
    s = str(time_str).strip()
    # Excel serial: time stored as fraction of day (e.g. 0.395833 = 09:30)
    try:
        v = float(s.replace(",", "."))
        if 0 < v <= 1:
            return v * 24.0
    except (ValueError, TypeError):
        pass
    parts = re.split(r'[:.]', s)
    if len(parts) >= 2:
        try:
            h = int(parts[0])
            m = int(parts[1])
            sec = int(parts[2]) if len(parts) > 2 else 0
            return h + m / 60.0 + sec / 3600.0
        except (ValueError, TypeError):
            pass
    return 0.0


def _compute_duration_hours(start_str: str, end_str: str) -> float:
    """Compute duration in hours, handling overnight shifts."""
    start_h = _time_to_hours(start_str)
    end_h = _time_to_hours(end_str)
    if start_h == 0.0 or end_h == 0.0:
        return 0.0
    # Handle overnight shifts (e.g., 22:00 to 06:00)
    if end_h < start_h:
        end_h += 24.0
    return max(0, end_h - start_h)


def compute_weekly_analysis(
    db: Session, group_by: str, breakdown: Optional[str] = None
):
    """
    Compute weekly aggregations for on-time %, work hour completion, and work hour lost.
    Returns (results, company_month_agg):
    - results: list of rows grouped by week and group (function/company/location).
      When group_by is "function" and breakdown is "department", one row per (week, group, department).
    - company_month_agg: when group_by is "function" and breakdown is "department", dict of
      (month_key, company) -> { members, shift_hours, work_hours, lost } for full company view (N-1); else None.
    """
    key_map = {
        "function": "Function Name",
        "company": "Company Name",  # Primary key
        "location": "Job Location",
    }
    
    fallback_map = {
        "function": ["Function", "Function Name", "Department"],
        "company": ["Company Name", "Comapny Name", "Company"],  # Try correct spelling first, then typo
        "location": ["Location", "Job Location", "Work Location"],
    }
    
    group_key = key_map.get(group_by)
    if not group_key:
        raise ValueError(f"Invalid group_by: {group_by}. Must be one of: function, company, location")

    use_dept_breakdown = group_by == "function" and breakdown == "department"

    # Fetch all rows
    rows = db.query(UploadedRow).all()

    # Aggregation structures; key is (week, group) or (week, group, department) when use_dept_breakdown
    members = defaultdict(set)
    present_count = defaultdict(int)  # (week, group) -> count
    late_count = defaultdict(int)  # (week, group) -> count
    on_time_count = defaultdict(int)  # (week, group) -> count
    group_departments = defaultdict(set)  # (week, group) -> set of department names
    
    # Work hour data
    shift_hours_sum = defaultdict(float)  # (week, group) -> total shift hours
    work_hours_sum = defaultdict(float)  # (week, group) -> total work hours
    completed_count = defaultdict(int)  # (week, group) -> count of completed work hours
    total_work_days = defaultdict(int)  # (week, group) -> total work days
    
    # Work hour lost
    lost_hours_sum = defaultdict(float)  # (week, group) -> total lost hours
    
    # Leave analysis data
    leave_members = defaultdict(set)  # (week, group) -> set of member IDs for leave tracking
    sl_count = defaultdict(int)  # (week, group) -> SL (Sick Leave) count
    cl_count = defaultdict(int)  # (week, group) -> CL (Casual Leave) count
    a_count = defaultdict(int)  # (week, group) -> A (Absent) count
    total_leave_days = defaultdict(int)  # (week, group) -> total leave days
    
    for row in rows:
        if not isinstance(row.data, dict):
            continue
        
        data = row.data
        
        # Parse date - try multiple possible column names (case-insensitive search)
        date_str = None
        for key in data.keys():
            key_lower = key.lower().strip()
            if key_lower in ["attendance date", "date", "attendance_date", "attdate"]:
                date_str = str(data.get(key, "")).strip()
                break
        
        if not date_str:
            # Try exact match as fallback
            date_str = (
                data.get("Attendance Date", "") or 
                data.get("attendance date", "") or 
                data.get("Date", "") or
                data.get("date", "") or
                data.get("AttendanceDate", "") or
                data.get("ATTENDANCE DATE", "")
            )
            date_str = str(date_str).strip() if date_str else ""
        
        date = _parse_date(date_str)
        if not date:
            # Skip rows without valid dates
            continue
        
        week_tuple = _get_week_key(date)
        week_key = _format_week_key(week_tuple[0], week_tuple[1], week_tuple[2])
        
        # Get group value and department
        department_name = str(data.get("Department Name", "") or data.get("Department", "")).strip()
        
        # For function-wise, combine Company - Function. Prefer "Function" then fallbacks so attendance files with "Function Name" etc. still show function in charts and match Cost Settings.
        if group_by == "function":
            company_name = str(data.get("Company Name", "") or data.get("Comapny Name", "")).strip()
            function_name = str(
                data.get("Function", "")
                or data.get("Function Name", "")
                or data.get("Section Info", "")
                or data.get("Function Name (Level 1)", "")
                or data.get("Division", "")
                or data.get("Business Function", "")
                or ""
            ).strip()
            # Normalize: remove company suffix e.g. "CIPLC Factory - CIPLC" -> "CIPLC Factory" so it matches Employee List / Cost Settings
            base_function = function_name
            if " - " in function_name:
                parts = function_name.split(" - ")
                if len(parts) >= 2:
                    last_part = parts[-1].strip().upper()
                    company_abbrevs = ["CBL", "CIPLC", "CSEL"]
                    if any(abbrev in last_part for abbrev in company_abbrevs):
                        base_function = " - ".join(parts[:-1]).strip()
            company_short = _get_company_short_name(company_name)
            if company_short and base_function:
                group_val = f"{company_short} - {base_function}"
            elif base_function:
                group_val = base_function
            else:
                group_val = company_short or "Unknown"
        else:
            # For company/location, get the group value
            group_val = ""
            for key in [group_key] + fallback_map.get(group_by, []):
                if key in data:
                    group_val = str(data.get(key, "")).strip()
                    break
            
            if not group_val:
                continue
            
            # Apply company name shortening if grouping by company
            if group_by == "company":
                group_val = _get_company_short_name(group_val)
        
        # Get employee ID
        emp_code = str(data.get("Employee Code", "")).strip()
        emp_name = str(data.get("Name", "")).strip()
        member_id = emp_code or emp_name
        
        if not member_id:
            continue

        if use_dept_breakdown:
            dept_key = department_name or "__no_dept__"
            key = (week_key, group_val, dept_key)
        else:
            key = (week_key, group_val)

        # Track unique members
        members[key].add(member_id)

        # Track department for this group (when not using dept breakdown)
        if not use_dept_breakdown and department_name:
            group_departments[key].add(department_name)
        
        # On-time analysis
        flag = str(data.get("Flag", "")).strip()
        is_late = str(data.get("Is Late", "")).strip().lower() == "yes"
        
        if flag == "P":
            present_count[key] += 1
            if is_late:
                late_count[key] += 1
            else:
                on_time_count[key] += 1
        
        # Work hour analysis
        # Skip weekends and holidays (Flag="W" or "H")
        # Only count P (Present) and OD (On Duty) for work hour lost calculation.
        if flag == "W" or flag == "H":
            # Still track for leave analysis, but skip work hour calculations
            pass
        elif flag == "P" or flag == "OD":
            shift_in = str(data.get("Shift In Time", "")).strip()
            shift_out = str(data.get("Shift Out Time", "")).strip()
            in_time = str(data.get("In Time", "")).strip()
            out_time = str(data.get("Out Time", "")).strip()
            
            shift_hours = _compute_duration_hours(shift_in, shift_out)
            work_hours = _compute_duration_hours(in_time, out_time)
            
            if shift_hours > 0 or work_hours > 0:
                shift_hours_sum[key] += shift_hours
                work_hours_sum[key] += work_hours
                total_work_days[key] += 1
                
                # Check if work hours completed (work hours >= shift hours for P or OD)
                if work_hours >= shift_hours and shift_hours > 0:
                    completed_count[key] += 1
                
                # Lost hours = shift hours minus actual work hours (per row, then summed per week+group).
                # Only P and OD count for work hour lost.
                if shift_hours > 0 and work_hours < shift_hours:
                    lost_hours = shift_hours - work_hours
                    lost_hours_sum[key] += lost_hours
        
        # Leave analysis
        if member_id:
            leave_members[key].add(member_id)
        
        if flag == "SL":
            sl_count[key] += 1
            total_leave_days[key] += 1
        elif flag == "CL":
            cl_count[key] += 1
            total_leave_days[key] += 1
        elif flag == "A":
            a_count[key] += 1
            total_leave_days[key] += 1
    
    # Build results and optionally company-level aggregates per month (for N-1 full company view)
    results = []
    all_keys = set(members.keys())
    all_keys.update(shift_hours_sum.keys())
    company_month_agg = {}  # (month_key, company) -> { members: set, shift_hours, work_hours, lost }

    for key in all_keys:
        if use_dept_breakdown and len(key) == 3:
            week_key_str, group_val, dept_val = key
            department = "" if dept_val == "__no_dept__" else dept_val
        else:
            week_key_str = key[0]
            group_val = key[1]
            departments = sorted(list(group_departments.get(key, set())))
            department = ", ".join(departments) if departments else ""

        # Parse week key: YYYY-MM-WW
        week_parts = week_key_str.split('-')
        if len(week_parts) >= 3:
            year = int(week_parts[0])
            month = int(week_parts[1])
            week = int(week_parts[2].replace('W', ''))
        else:
            year = int(week_parts[0]) if len(week_parts) > 0 else 2025
            month = 1
            week = int(week_parts[1].replace('W', '')) if len(week_parts) > 1 else 1

        # On-time metrics
        present = present_count.get(key, 0)
        late = late_count.get(key, 0)
        on_time = on_time_count.get(key, 0)
        on_time_pct = round((on_time / present * 100.0), 2) if present > 0 else 0.0

        # Work hour completion metrics
        shift_hours = shift_hours_sum.get(key, 0.0)
        work_hours = work_hours_sum.get(key, 0.0)
        completed = completed_count.get(key, 0)
        total_days = total_work_days.get(key, 0)
        completion_pct = round((completed / total_days * 100.0), 2) if total_days > 0 else 0.0

        # Work hour lost metrics
        lost_hours = lost_hours_sum.get(key, 0.0)
        lost_pct = round((lost_hours / shift_hours * 100.0), 2) if shift_hours > 0 else 0.0

        # Company-level aggregation per month (for N-1 full company summary)
        if use_dept_breakdown and group_val:
            month_key = f"{year}-{month:02d}"
            company = (group_val.split(" - ")[0].strip() if " - " in group_val else group_val) or "Unknown"
            ckey = (month_key, company)
            if ckey not in company_month_agg:
                company_month_agg[ckey] = {"members": set(), "shift_hours": 0.0, "work_hours": 0.0, "lost": 0.0}
            company_month_agg[ckey]["members"].update(members.get(key, set()))
            company_month_agg[ckey]["shift_hours"] += shift_hours
            company_month_agg[ckey]["work_hours"] += work_hours
            company_month_agg[ckey]["lost"] += lost_hours

        # Leave analysis metrics
        leave_members_count = len(leave_members.get(key, set()))
        sl = sl_count.get(key, 0)
        cl = cl_count.get(key, 0)
        a = a_count.get(key, 0)
        total_leave = total_leave_days.get(key, 0)
        total_leave_members = leave_members_count

        sl_pct = round((sl / total_leave * 100.0), 2) if total_leave > 0 else 0.0
        cl_pct = round((cl / total_leave * 100.0), 2) if total_leave > 0 else 0.0
        a_pct = round((a / total_leave * 100.0), 2) if total_leave > 0 else 0.0

        month_names = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December']
        month_name = month_names[month] if 1 <= month <= 12 else f"Month{month}"

        results.append({
            "week": week_key_str,  # Keep original format for sorting/filtering
            "year": year,
            "month": month,
            "month_name": month_name,
            "week_in_month": week,
            "group": group_val,
            "department": department,
            "members": len(members.get(key, set())),
            "present": present,
            "late": late,
            "on_time": on_time,
            "on_time_pct": on_time_pct,
            "shift_hours": round(shift_hours, 2),
            "work_hours": round(work_hours, 2),
            "completed": completed,
            "total_days": total_days,
            "completion_pct": completion_pct,
            "lost_hours": round(lost_hours, 2),
            "lost_pct": lost_pct,
            "lost": round(lost_hours, 2),  # Alias for lost_hours for chart compatibility
            # Leave analysis fields
            "leave_members": leave_members_count,
            "sl": sl,
            "cl": cl,
            "a": a,
            "sl_pct": sl_pct,
            "cl_pct": cl_pct,
            "a_pct": a_pct,
        })
    
    # Sort by year, month, week, group, and department (when breakdown)
    results.sort(key=lambda x: (x["year"], x["month"], x["week_in_month"], x["group"], x.get("department", "")))

    if not use_dept_breakdown:
        company_month_agg = None
    return results, company_month_agg

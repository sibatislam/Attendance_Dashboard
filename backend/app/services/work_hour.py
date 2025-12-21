from __future__ import annotations

from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import select
from collections import defaultdict
import re

from ..models import UploadedRow


def _get_company_short_name(company_name: str) -> str:
    """Convert company name to short code."""
    company_map = {
        "Confidence Batteries Limited": "CBL",
        "Confidence Infrastructure PLC.": "CIPLC",
        "Confidence Steel Export Limited": "CSEL",
    }
    return company_map.get(company_name, company_name)


def _extract_month(date_str: str) -> str:
    if not date_str:
        return ""
    s = str(date_str)
    m = re.search(r"(20\d{2})[-/](\d{1,2})", s)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}"
    m = re.search(r"(\d{1,2})[-/](\d{1,2})[-/](20\d{2})", s)
    if m:
        return f"{m.group(3)}-{int(m.group(2)):02d}"
    month_map = {
        'jan':1,'feb':2,'mar':3,'apr':4,'may':5,'jun':6,
        'jul':7,'aug':8,'sep':9,'sept':9,'oct':10,'nov':11,'dec':12,
        'january':1,'february':2,'march':3,'april':4,'june':6,'july':7,'august':8,'september':9,'october':10,'november':11,'december':12,
    }
    lower = s.lower()
    ym = re.search(r"(20\d{2})", lower)
    mm = re.search(r"(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)", lower)
    if ym and mm:
        return f"{ym.group(1)}-{month_map[mm.group(1)]:02d}"
    return s


def _time_to_hours(time_str: str) -> float:
    if not time_str:
        return 0.0
    s = str(time_str).strip()
    parts = re.split(r'[:.]', s)
    if len(parts) >= 2:
        try:
            h = int(parts[0])
            m = int(parts[1])
            sec = int(parts[2]) if len(parts) > 2 else 0
            return h + m / 60.0 + sec / 3600.0
        except:
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


def compute_work_hour_completion(db: Session, group_by: str) -> List[Dict[str, Any]]:
    key_map = {
        "function": "Function Name",
        "company": "Comapny Name",
        "location": "Job Location",
    }
    # Fallback map for common column name variations
    fallback_map = {
        "company": ["Company Name", "Comapny Name", "Company"],
        "location": ["Job Location", "Location", "Work Location"],
    }
    
    group_key = key_map.get(group_by)
    if not group_key:
        raise ValueError("Invalid group_by")

    rows = db.execute(select(UploadedRow.data)).scalars().all()

    members = defaultdict(set)
    present_count = defaultdict(int)
    od_count = defaultdict(int)
    shift_hours_sum = defaultdict(float)
    work_hours_sum = defaultdict(float)
    completed_count = defaultdict(int)
    total_count = defaultdict(int)

    for r in rows:
        if not isinstance(r, dict):
            continue
        month = _extract_month(str(r.get("Attendance Date", "")))
        if not month:  # Skip rows without valid month
            continue
        
        # For function-wise, combine Company - Function
        if group_by == "function":
            # Try both "Company Name" and "Comapny Name"
            company_name = str(r.get("Company Name", "") or r.get("Comapny Name", "")).strip()
            function_name = str(r.get("Function Name", "")).strip()
            company_short = _get_company_short_name(company_name)
            if company_short and function_name:
                group_val = f"{company_short} - {function_name}"
            elif function_name:
                group_val = function_name
            else:
                group_val = company_short or "Unknown"
        else:
            # Try primary key first, then fallback variations
            group_val = str(r.get(group_key, "")).strip()
            if not group_val and group_by in fallback_map:
                for fallback_key in fallback_map[group_by]:
                    if fallback_key != group_key:
                        group_val = str(r.get(fallback_key, "")).strip()
                        if group_val:
                            break
            # Skip rows with empty group values for company/location
            if not group_val or group_val == "":
                continue
        
        emp_code = str(r.get("Employee Code", "")).strip()
        emp_name = str(r.get("Name", "")).strip()
        member_id = emp_code or emp_name

        flag = str(r.get("Flag", "")).strip()
        shift_in = str(r.get("Shift In Time", "")).strip()
        shift_out = str(r.get("Shift Out Time", "")).strip()
        in_time = str(r.get("In Time", "")).strip()
        out_time = str(r.get("Out Time", "")).strip()

        key = (month, group_val)
        if member_id:
            members[key].add(member_id)
        if flag == "P":
            present_count[key] += 1
        if flag == "OD":
            od_count[key] += 1

        shift_hrs = _compute_duration_hours(shift_in, shift_out)
        work_hrs = _compute_duration_hours(in_time, out_time)

        # Only sum if we have valid shift hours
        if shift_hrs > 0:
            shift_hours_sum[key] += shift_hrs
            work_hours_sum[key] += work_hrs
            total_count[key] += 1
            if (flag == "P" or flag == "OD") and work_hrs >= shift_hrs and shift_hrs > 0:
                completed_count[key] += 1

    results = []
    for (month, group_val), member_set in members.items():
        key = (month, group_val)
        present = present_count.get(key, 0)
        od = od_count.get(key, 0)
        shift_total = shift_hours_sum.get(key, 0)
        work_total = work_hours_sum.get(key, 0)
        completed = completed_count.get(key, 0)
        total = total_count.get(key, 0)
        completion_pct = round((completed / (present + od) * 100.0), 2) if (present + od) > 0 else 0.0
        results.append({
            "month": month,
            "group": group_val,
            "members": len(member_set),
            "present": present,
            "od": od,
            "shift_hours": round(shift_total, 2),
            "work_hours": round(work_total, 2),
            "completed": completed,
            "completion_pct": completion_pct,
        })

    results.sort(key=lambda x: (x["month"], x["group"]))
    return results


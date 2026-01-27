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
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
        'jul': 7, 'aug': 8, 'sep': 9, 'sept': 9, 'oct': 10, 'nov': 11, 'dec': 12,
        'january': 1, 'february': 2, 'march': 3, 'april': 4, 'june': 6, 'july': 7,
        'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
    }
    lower = s.lower()
    ym = re.search(r"(20\d{2})", lower)
    mm = re.search(r"(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)", lower)
    if ym and mm:
        return f"{ym.group(1)}-{month_map[mm.group(1)]:02d}"
    return s


def _parse_date(date_str: str) -> tuple:
    """Parse date string to tuple for comparison."""
    if not date_str:
        return (0, 0, 0)
    s = str(date_str).strip()
    # Try various date formats
    m = re.search(r"(\d{1,2})[-/](\w{3,})[-/](20\d{2})", s, re.I)
    if m:
        month_map = {
            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
            'jul': 7, 'aug': 8, 'sep': 9, 'sept': 9, 'oct': 10, 'nov': 11, 'dec': 12,
            'january': 1, 'february': 2, 'march': 3, 'april': 4, 'june': 6, 'july': 7,
            'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
        }
        month = month_map.get(m.group(2).lower()[:3], 0)
        day = int(m.group(1))
        year = int(m.group(3))
        return (year, month, day)
    m = re.search(r"(20\d{2})[-/](\d{1,2})[-/](\d{1,2})", s)
    if m:
        return (int(m.group(1)), int(m.group(2)), int(m.group(3)))
    return (0, 0, 0)


def _is_consecutive_day(date1: tuple, date2: tuple) -> bool:
    """Check if date2 is exactly 1 day after date1."""
    y1, m1, d1 = date1
    y2, m2, d2 = date2
    
    # Simple check for month-end transitions
    if d2 == 1 and d1 in [30, 31]:
        if (m2 == m1 + 1 and y2 == y1) or (m2 == 1 and m1 == 12 and y2 == y1 + 1):
            return True
    return False


def compute_leave_analysis(db: Session, group_by: str) -> List[Dict[str, Any]]:
    """Compute Leave Analysis KPIs based on adjacency rules."""
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

    # Fetch all rows
    rows = db.execute(select(UploadedRow.data)).scalars().all()
    
    # Organize data by employee for adjacency checking
    emp_data = defaultdict(list)
    for r in rows:
        if not isinstance(r, dict):
            continue
        emp_code = str(r.get("Employee Code", "")).strip()
        emp_name = str(r.get("Name", "")).strip()
        member_id = emp_code or emp_name
        if member_id:
            date_str = str(r.get("Attendance Date", ""))
            month = _extract_month(date_str)
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
            
            flag = str(r.get("Flag", "")).strip()
            # Convert date string to comparable format
            date_key = _parse_date(date_str)
            emp_data[(member_id, group_val)].append({
                "month": month,
                "date": date_key,
                "flag": flag
            })
    
    # Sort each employee's data by date
    for key in emp_data:
        emp_data[key].sort(key=lambda x: x["date"])
    
    # Aggregate by month and group
    members = defaultdict(set)
    members_with_w = defaultdict(set)  # Members with W flag
    members_with_h = defaultdict(set)  # Members with H flag
    members_with_sl = defaultdict(set)  # Members with SL flag (for percentage calculation)
    members_with_cl = defaultdict(set)  # Members with CL flag (for percentage calculation)
    members_with_a = defaultdict(set)  # Members with A flag (for percentage calculation)
    members_with_p = defaultdict(set)  # Members with P flag
    members_with_od = defaultdict(set)  # Members with OD flag
    members_with_el = defaultdict(set)  # Members with EL flag
    members_with_whf = defaultdict(set)  # Members with WHF flag
    # Count flag occurrences (not unique members) for workdays
    count_a = defaultdict(int)
    count_cl = defaultdict(int)
    count_el = defaultdict(int)
    count_od = defaultdict(int)
    count_p = defaultdict(int)
    count_sl = defaultdict(int)
    count_whf = defaultdict(int)
    sl_adjacent_w = defaultdict(int)
    cl_adjacent_w = defaultdict(int)
    sl_adjacent_h = defaultdict(int)
    cl_adjacent_h = defaultdict(int)
    
    # Check adjacency for each employee
    # Filter out P and OD flags - only count W, H, SL, CL, blank, etc.
    for (member_id, group_val), records in emp_data.items():
        if len(records) < 2:
            continue  # Need at least 2 records to check adjacency
        
        # Filter out P and OD records for adjacency checking
        filtered_records = [r for r in records if r["flag"] not in ("P", "OD")]
        
        # Add member to all months they have records in
        for record in records:
            key = (record["month"], group_val)
            members[key].add(member_id)
            # Track members with W flag
            if record["flag"] == "W":
                members_with_w[key].add(member_id)
            # Track members with H flag
            if record["flag"] == "H":
                members_with_h[key].add(member_id)
            # Track members with SL flag
            if record["flag"] == "SL":
                members_with_sl[key].add(member_id)
            # Track members with CL flag
            if record["flag"] == "CL":
                members_with_cl[key].add(member_id)
            # Track members with A flag
            if record["flag"] == "A":
                members_with_a[key].add(member_id)
                count_a[key] += 1
            # Track members with P flag
            if record["flag"] == "P":
                members_with_p[key].add(member_id)
                count_p[key] += 1
            # Track members with OD flag
            if record["flag"] == "OD":
                members_with_od[key].add(member_id)
                count_od[key] += 1
            # Track members with EL flag
            if record["flag"] == "EL":
                members_with_el[key].add(member_id)
                count_el[key] += 1
            # Track members with WHF flag
            if record["flag"] == "WHF":
                members_with_whf[key].add(member_id)
                count_whf[key] += 1
            # Track CL occurrences for workdays
            if record["flag"] == "CL":
                count_cl[key] += 1
            # Track SL occurrences for workdays
            if record["flag"] == "SL":
                count_sl[key] += 1
        
        # Check adjacency for each pair of consecutive filtered records
        # Track which CL/SL records have already been counted as adjacent to avoid double counting
        cl_adjacent_counted = set()  # Track (month, group_val, date) tuples for CL already counted
        sl_adjacent_counted = set()  # Track (month, group_val, date) tuples for SL already counted
        
        if len(filtered_records) < 2:
            continue
        
        for i in range(len(filtered_records) - 1):
            curr = filtered_records[i]
            next_rec = filtered_records[i + 1]
            
            # Check if dates are consecutive (difference of 1 day)
            curr_date = curr["date"]
            next_date = next_rec["date"]
            
            # Simple check: if year, month, day difference is exactly 1 day
            if (curr_date[0] == next_date[0] and 
                curr_date[1] == next_date[1] and 
                next_date[2] - curr_date[2] == 1) or \
               (next_date[1] > 0 and curr_date[1] > 0 and 
                _is_consecutive_day(curr_date, next_date)):
                # Use current record's month as key
                key = (curr["month"], group_val)
                
                # Check SL adjacent to W - only count each SL once
                # Use the SL record's month for the key
                if curr["flag"] == "SL" and next_rec["flag"] == "W":
                    sl_key = (curr["month"], group_val, curr_date)
                    if sl_key not in sl_adjacent_counted:
                        sl_adjacent_w[(curr["month"], group_val)] += 1
                        sl_adjacent_counted.add(sl_key)
                elif curr["flag"] == "W" and next_rec["flag"] == "SL":
                    sl_key = (next_rec["month"], group_val, next_date)
                    if sl_key not in sl_adjacent_counted:
                        sl_adjacent_w[(next_rec["month"], group_val)] += 1
                        sl_adjacent_counted.add(sl_key)
                
                # Check CL adjacent to W - only count each CL once
                # Use the CL record's month for the key
                if curr["flag"] == "CL" and next_rec["flag"] == "W":
                    cl_key = (curr["month"], group_val, curr_date)
                    if cl_key not in cl_adjacent_counted:
                        cl_adjacent_w[(curr["month"], group_val)] += 1
                        cl_adjacent_counted.add(cl_key)
                elif curr["flag"] == "W" and next_rec["flag"] == "CL":
                    cl_key = (next_rec["month"], group_val, next_date)
                    if cl_key not in cl_adjacent_counted:
                        cl_adjacent_w[(next_rec["month"], group_val)] += 1
                        cl_adjacent_counted.add(cl_key)
                
                # Check SL adjacent to H - only count each SL once
                # Use the SL record's month for the key
                if curr["flag"] == "SL" and next_rec["flag"] == "H":
                    sl_key = (curr["month"], group_val, curr_date)
                    if sl_key not in sl_adjacent_counted:
                        sl_adjacent_h[(curr["month"], group_val)] += 1
                        sl_adjacent_counted.add(sl_key)
                elif curr["flag"] == "H" and next_rec["flag"] == "SL":
                    sl_key = (next_rec["month"], group_val, next_date)
                    if sl_key not in sl_adjacent_counted:
                        sl_adjacent_h[(next_rec["month"], group_val)] += 1
                        sl_adjacent_counted.add(sl_key)
                
                # Check CL adjacent to H - only count each CL once
                # Use the CL record's month for the key
                if curr["flag"] == "CL" and next_rec["flag"] == "H":
                    cl_key = (curr["month"], group_val, curr_date)
                    if cl_key not in cl_adjacent_counted:
                        cl_adjacent_h[(curr["month"], group_val)] += 1
                        cl_adjacent_counted.add(cl_key)
                elif curr["flag"] == "H" and next_rec["flag"] == "CL":
                    cl_key = (next_rec["month"], group_val, next_date)
                    if cl_key not in cl_adjacent_counted:
                        cl_adjacent_h[(next_rec["month"], group_val)] += 1
                        cl_adjacent_counted.add(cl_key)
    
    # Calculate percentages and build results
    results = []
    for (month, group_val), member_set in members.items():
        key = (month, group_val)
        sl_w = sl_adjacent_w.get(key, 0)
        cl_w = cl_adjacent_w.get(key, 0)
        sl_h = sl_adjacent_h.get(key, 0)
        cl_h = cl_adjacent_h.get(key, 0)
        
        # Calculate percentages
        # SL % = (SL adjacent to W + SL adjacent to H) / Total SL occurrences * 100
        # CL % = CL adjacent to W / Total CL occurrences * 100
        total_members_sl = len(members_with_sl.get(key, set())) if key in members_with_sl else 0
        total_members_cl = len(members_with_cl.get(key, set())) if key in members_with_cl else 0
        total_members_a = len(members_with_a.get(key, set())) if key in members_with_a else 0
        
        # Get total SL and CL occurrences (not unique members)
        total_sl_occurrences = count_sl.get(key, 0)
        total_cl_occurrences = count_cl.get(key, 0)
        
        # Workdays = Flag occurrences (A + CL + EL + OD + P + SL + WHF)
        workdays = count_a.get(key, 0) + count_cl.get(key, 0) + count_el.get(key, 0) + count_od.get(key, 0) + count_p.get(key, 0) + count_sl.get(key, 0) + count_whf.get(key, 0)
        
        sl_pct = round(((sl_w + sl_h) / total_sl_occurrences * 100.0), 2) if total_sl_occurrences > 0 else 0.0
        cl_pct = round((cl_w / total_cl_occurrences * 100.0), 2) if total_cl_occurrences > 0 else 0.0
        a_pct = round((total_members_a / workdays * 100.0), 2) if workdays > 0 else 0.0
        
        results.append({
            "month": month,
            "group": group_val,
            "members": len(member_set),
            "total_sl": total_sl_occurrences,
            "total_cl": total_cl_occurrences,
            "workdays": workdays,
            "total_a": total_members_a,
            "sl_adjacent_w": sl_w,
            "cl_adjacent_w": cl_w,
            "sl_adjacent_h": sl_h,
            "cl_adjacent_h": cl_h,
            "sl_pct": sl_pct,
            "cl_pct": cl_pct,
            "a_pct": a_pct,
        })
    
    results.sort(key=lambda x: (x["month"], x["group"]))
    return results


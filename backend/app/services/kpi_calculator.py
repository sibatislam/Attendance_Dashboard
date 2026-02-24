"""Service to calculate and store KPIs for uploaded files."""
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select
from collections import defaultdict
import re

from ..models import UploadedRow
from ..models_kpi import OnTimeKPI, WorkHourKPI, WorkHourLostKPI, LeaveAnalysisKPI


def _get_company_short_name(company_name: str) -> str:
    """Convert company name to short code."""
    company_map = {
        "Confidence Batteries Limited": "CBL",
        "Confidence Infrastructure PLC.": "CIPLC",
        "Confidence Steel Export Limited": "CSEL",
    }
    return company_map.get(company_name, company_name)


def _extract_month(date_str: str) -> str:
    """Extract month in YYYY-MM format."""
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


def _time_to_hours(time_str: str) -> float:
    """Convert time string to hours."""
    if not time_str or time_str.strip() == "":
        return 0.0
    s = str(time_str).strip()
    m = re.match(r"(\d{1,2}):(\d{2})", s)
    if m:
        return float(m.group(1)) + float(m.group(2)) / 60.0
    return 0.0


def _compute_duration_hours(start_str: str, end_str: str) -> float:
    """Compute duration in hours, handling overnight shifts."""
    start_h = _time_to_hours(start_str)
    end_h = _time_to_hours(end_str)
    if start_h == 0.0 or end_h == 0.0:
        return 0.0
    if end_h < start_h:
        end_h += 24.0
    return max(0, end_h - start_h)


def calculate_kpis_for_file(db: Session, file_id: int):
    """
    Calculate all KPIs for a specific uploaded file and store in database.
    This runs after file upload to pre-calculate all dashboard data.
    """
    # Fetch only rows for this file
    rows = db.execute(
        select(UploadedRow.data).where(UploadedRow.file_id == file_id)
    ).scalars().all()
    
    if not rows:
        return
    
    # Calculate for all three group types
    for group_by in ['function', 'company', 'location']:
        _calculate_on_time_kpi(db, file_id, group_by, rows)
        _calculate_work_hour_kpi(db, file_id, group_by, rows)
        _calculate_work_hour_lost_kpi(db, file_id, group_by, rows)
        _calculate_leave_analysis_kpi(db, file_id, group_by, rows)
    
    db.commit()


def _calculate_on_time_kpi(db: Session, file_id: int, group_by: str, rows: List[Dict]):
    """Calculate and store On Time % KPIs."""
    key_map = {
        "function": "Function Name",
        "company": "Comapny Name",
        "location": "Job Location",
    }
    group_key = key_map.get(group_by)
    
    members = defaultdict(set)
    present_count = defaultdict(int)
    late_count = defaultdict(int)
    
    for r in rows:
        if not isinstance(r, dict):
            continue
        month = _extract_month(str(r.get("Attendance Date", "")))
        
        if group_by == "function":
            company_name = str(r.get("Comapny Name", "")).strip()
            function_name = str(r.get("Function Name", "")).strip()
            company_short = _get_company_short_name(company_name)
            if company_short and function_name:
                group_val = f"{company_short} - {function_name}"
            elif function_name:
                group_val = function_name
            else:
                group_val = company_short or "Unknown"
        else:
            group_val = str(r.get(group_key, ""))
        
        emp_code = str(r.get("Employee Code", "")).strip()
        emp_name = str(r.get("Name", "")).strip()
        member_id = emp_code or emp_name
        flag = str(r.get("Flag", "")).strip()
        is_late = str(r.get("Is Late", "")).strip().lower() == "yes"
        
        key = (month, group_val)
        if member_id:
            members[key].add(member_id)
        if flag == "P":
            present_count[key] += 1
            if is_late:
                late_count[key] += 1
    
    # Store results
    for (month, group_val), member_set in members.items():
        present = present_count.get((month, group_val), 0)
        late = late_count.get((month, group_val), 0)
        on_time = present - late
        on_time_pct = round((on_time / present * 100.0), 2) if present > 0 else 0.0
        
        kpi = OnTimeKPI(
            file_id=file_id,
            month=month,
            group_by=group_by,
            group_value=group_val,
            members=len(member_set),
            present=present,
            late=late,
            on_time=on_time,
            on_time_pct=on_time_pct
        )
        db.add(kpi)


def _calculate_work_hour_kpi(db: Session, file_id: int, group_by: str, rows: List[Dict]):
    """Calculate and store Work Hour Completion KPIs."""
    key_map = {
        "function": "Function Name",
        "company": "Comapny Name",
        "location": "Job Location",
    }
    group_key = key_map.get(group_by)
    
    members = defaultdict(set)
    present_count = defaultdict(int)
    od_count = defaultdict(int)
    shift_hours_sum = defaultdict(float)
    work_hours_sum = defaultdict(float)
    completed_count = defaultdict(int)
    
    for r in rows:
        if not isinstance(r, dict):
            continue
        month = _extract_month(str(r.get("Attendance Date", "")))
        
        if group_by == "function":
            company_name = str(r.get("Comapny Name", "")).strip()
            function_name = str(r.get("Function Name", "")).strip()
            company_short = _get_company_short_name(company_name)
            if company_short and function_name:
                group_val = f"{company_short} - {function_name}"
            elif function_name:
                group_val = function_name
            else:
                group_val = company_short or "Unknown"
        else:
            group_val = str(r.get(group_key, ""))
        
        emp_code = str(r.get("Employee Code", "")).strip()
        emp_name = str(r.get("Name", "")).strip()
        member_id = emp_code or emp_name
        flag = str(r.get("Flag", "")).strip()
        
        # Skip weekends and holidays (Flag="W" or "H") for work hour calculations
        if flag == "W" or flag == "H":
            continue
        
        key = (month, group_val)
        if member_id:
            members[key].add(member_id)
        if flag == "P":
            present_count[key] += 1
        if flag == "OD":
            od_count[key] += 1
        
        shift_hrs = _compute_duration_hours(
            str(r.get("Shift In Time", "")).strip(),
            str(r.get("Shift Out Time", "")).strip()
        )
        work_hrs = _compute_duration_hours(
            str(r.get("In Time", "")).strip(),
            str(r.get("Out Time", "")).strip()
        )
        
        if shift_hrs > 0:
            shift_hours_sum[key] += shift_hrs
            work_hours_sum[key] += work_hrs
            if (flag == "P" or flag == "OD") and work_hrs >= shift_hrs:
                completed_count[key] += 1
    
    # Store results
    for (month, group_val), member_set in members.items():
        present = present_count.get((month, group_val), 0)
        od = od_count.get((month, group_val), 0)
        shift_hrs = shift_hours_sum.get((month, group_val), 0.0)
        work_hrs = work_hours_sum.get((month, group_val), 0.0)
        completed = completed_count.get((month, group_val), 0)
        completion_pct = round((completed / (present + od) * 100.0), 2) if (present + od) > 0 else 0.0
        
        kpi = WorkHourKPI(
            file_id=file_id,
            month=month,
            group_by=group_by,
            group_value=group_val,
            members=len(member_set),
            present=present,
            od=od,
            shift_hours=round(shift_hrs, 2),
            work_hours=round(work_hrs, 2),
            completed=completed,
            completion_pct=completion_pct
        )
        db.add(kpi)


def _calculate_work_hour_lost_kpi(db: Session, file_id: int, group_by: str, rows: List[Dict]):
    """Calculate and store Work Hour Lost KPIs."""
    key_map = {
        "function": "Function Name",
        "company": "Comapny Name",
        "location": "Job Location",
    }
    group_key = key_map.get(group_by)
    
    members = defaultdict(set)
    present_count = defaultdict(int)
    od_count = defaultdict(int)
    shift_hours_sum = defaultdict(float)
    work_hours_sum = defaultdict(float)
    lost_hours_sum = defaultdict(float)
    
    for r in rows:
        if not isinstance(r, dict):
            continue
        month = _extract_month(str(r.get("Attendance Date", "")))
        
        if group_by == "function":
            company_name = str(r.get("Comapny Name", "")).strip()
            function_name = str(r.get("Function Name", "")).strip()
            company_short = _get_company_short_name(company_name)
            if company_short and function_name:
                group_val = f"{company_short} - {function_name}"
            elif function_name:
                group_val = function_name
            else:
                group_val = company_short or "Unknown"
        else:
            group_val = str(r.get(group_key, ""))
        
        emp_code = str(r.get("Employee Code", "")).strip()
        emp_name = str(r.get("Name", "")).strip()
        member_id = emp_code or emp_name
        flag = str(r.get("Flag", "")).strip()
        
        # Skip weekends and holidays (Flag="W" or "H"). Only count P and OD for work hour lost.
        if flag == "W" or flag == "H":
            continue
        if flag != "P" and flag != "OD":
            continue

        key = (month, group_val)
        if member_id:
            members[key].add(member_id)
        if flag == "P":
            present_count[key] += 1
        if flag == "OD":
            od_count[key] += 1

        shift_hrs = _compute_duration_hours(
            str(r.get("Shift In Time", "")).strip(),
            str(r.get("Shift Out Time", "")).strip()
        )
        work_hrs = _compute_duration_hours(
            str(r.get("In Time", "")).strip(),
            str(r.get("Out Time", "")).strip()
        )

        if shift_hrs > 0:
            shift_hrs = round(shift_hrs, 2)
            work_hrs = round(work_hrs, 2)
            shift_hours_sum[key] += shift_hrs
            work_hours_sum[key] += work_hrs

            if work_hrs > 0:
                lost_hrs = max(0.0, shift_hrs - work_hrs)
            else:
                lost_hrs = shift_hrs

            lost_hrs = round(lost_hrs, 2)
            lost_hours_sum[key] += lost_hrs
    
    # Store results
    for (month, group_val), member_set in members.items():
        present = present_count.get((month, group_val), 0)
        od = od_count.get((month, group_val), 0)
        shift_hrs = shift_hours_sum.get((month, group_val), 0.0)
        work_hrs = work_hours_sum.get((month, group_val), 0.0)
        lost_hrs = lost_hours_sum.get((month, group_val), 0.0)
        lost_pct = round((lost_hrs / shift_hrs * 100.0), 2) if shift_hrs > 0 else 0.0
        
        kpi = WorkHourLostKPI(
            file_id=file_id,
            month=month,
            group_by=group_by,
            group_value=group_val,
            members=len(member_set),
            present=present,
            od=od,
            shift_hours=round(shift_hrs, 2),
            work_hours=round(work_hrs, 2),
            lost_hours=round(lost_hrs, 2),
            lost_pct=lost_pct
        )
        db.add(kpi)


def _calculate_leave_analysis_kpi(db: Session, file_id: int, group_by: str, rows: List[Dict]):
    """Calculate and store Leave Analysis KPIs."""
    # This is complex due to adjacency logic - simplified version for now
    # Full implementation would need the complete adjacency checking logic
    key_map = {
        "function": "Function Name",
        "company": "Comapny Name",
        "location": "Job Location",
    }
    group_key = key_map.get(group_by)
    
    members = defaultdict(set)
    count_sl = defaultdict(int)
    count_cl = defaultdict(int)
    count_a = defaultdict(int)
    count_workdays = defaultdict(int)
    
    for r in rows:
        if not isinstance(r, dict):
            continue
        month = _extract_month(str(r.get("Attendance Date", "")))
        
        if group_by == "function":
            company_name = str(r.get("Comapny Name", "")).strip()
            function_name = str(r.get("Function Name", "")).strip()
            company_short = _get_company_short_name(company_name)
            if company_short and function_name:
                group_val = f"{company_short} - {function_name}"
            elif function_name:
                group_val = function_name
            else:
                group_val = company_short or "Unknown"
        else:
            group_val = str(r.get(group_key, ""))
        
        emp_code = str(r.get("Employee Code", "")).strip()
        emp_name = str(r.get("Name", "")).strip()
        member_id = emp_code or emp_name
        flag = str(r.get("Flag", "")).strip()
        
        key = (month, group_val)
        if member_id:
            members[key].add(member_id)
        
        # Count flags for workdays
        if flag in ["A", "CL", "EL", "OD", "P", "SL", "WHF"]:
            count_workdays[key] += 1
        if flag == "SL":
            count_sl[key] += 1
        if flag == "CL":
            count_cl[key] += 1
        if flag == "A":
            count_a[key] += 1
    
    # Store simplified results (adjacency calculation would need full logic)
    for (month, group_val), member_set in members.items():
        kpi = LeaveAnalysisKPI(
            file_id=file_id,
            month=month,
            group_by=group_by,
            group_value=group_val,
            members=len(member_set),
            total_sl=count_sl.get((month, group_val), 0),
            total_cl=count_cl.get((month, group_val), 0),
            workdays=count_workdays.get((month, group_val), 0),
            total_a=count_a.get((month, group_val), 0),
            sl_adjacent_w=0,  # Would need full adjacency logic
            cl_adjacent_w=0,
            sl_adjacent_h=0,
            cl_adjacent_h=0,
            sl_pct=0.0,
            cl_pct=0.0,
            a_pct=round((count_a.get((month, group_val), 0) / count_workdays.get((month, group_val), 1) * 100.0), 2) if count_workdays.get((month, group_val), 0) > 0 else 0.0
        )
        db.add(kpi)


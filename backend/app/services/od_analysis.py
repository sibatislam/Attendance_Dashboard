"""Service for computing OD Analysis KPIs."""
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
    """Extract YYYY-MM format from date string."""
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


def compute_od_analysis(db: Session, group_by: str) -> List[Dict[str, Any]]:
    """Compute OD Analysis KPIs."""
    # Fetch all rows
    rows = db.execute(select(UploadedRow.data)).scalars().all()
    
    if group_by == "function":
        # Function-wise aggregation (with Company Name - Function Name format)
        members = defaultdict(set)
        od_count = defaultdict(int)
        
        for r in rows:
            if not isinstance(r, dict):
                continue
            emp_code = str(r.get("Employee Code", "")).strip()
            emp_name = str(r.get("Name", "")).strip()
            member_id = emp_code or emp_name
            if member_id:
                date_str = str(r.get("Attendance Date", ""))
                month = _extract_month(date_str)
                company_name = str(r.get("Comapny Name", "")).strip()
                function_name = str(r.get("Function Name", "")).strip()
                flag = str(r.get("Flag", "")).strip()
                
                # Create combined group name: Company - Function
                company_short = _get_company_short_name(company_name)
                if company_short and function_name:
                    group_val = f"{company_short} - {function_name}"
                elif function_name:
                    group_val = function_name
                else:
                    group_val = company_short or "Unknown"
                
                key = (month, group_val)
                members[key].add(member_id)
                
                # Count OD flags
                if flag == "OD":
                    od_count[key] += 1
        
        # Build results
        results = []
        for (month, group_val), member_set in members.items():
            key = (month, group_val)
            od = od_count.get(key, 0)
            
            results.append({
                "month": month,
                "group": group_val,
                "members": len(member_set),
                "od": od,
            })
        
        results.sort(key=lambda x: (x["month"], x["group"]))
        return results
    
    elif group_by == "employee":
        # Employee-wise aggregation; include company and department for user-wise filters
        results = []
        for r in rows:
            if not isinstance(r, dict):
                continue
            emp_code = str(r.get("Employee Code", "")).strip()
            emp_name = str(r.get("Name", "")).strip()
            emp_display = f"{emp_name} ({emp_code})" if (emp_code and emp_name) else (emp_code or emp_name)
            if not emp_display:
                continue
            date_str = str(r.get("Attendance Date", ""))
            month = _extract_month(date_str)
            company_name = str(r.get("Company Name", "") or r.get("Comapny Name", "")).strip()
            function_name = str(r.get("Function Name", "")).strip()
            dept_str = str(r.get("Department Name", "") or r.get("Department", "")).strip()
            flag = str(r.get("Flag", "")).strip()
            company_short = _get_company_short_name(company_name)
            if company_short and function_name:
                combined_function = f"{company_short} - {function_name}"
            elif function_name:
                combined_function = function_name
            else:
                combined_function = company_short or "Unknown"
            if flag == "OD":
                results.append({
                    "month": month,
                    "company": company_short or company_name or "Unknown",
                    "function": combined_function,
                    "department": dept_str,
                    "employee_name": emp_display,
                    "od": 1,
                })
        aggregated = defaultdict(int)
        employee_info = {}
        for r in results:
            key = (r["month"], r["function"], r["employee_name"])
            aggregated[key] += r["od"]
            employee_info[key] = {
                "month": r["month"],
                "company": r["company"],
                "function": r["function"],
                "department": r["department"],
                "employee_name": r["employee_name"],
            }
        final_results = []
        for key, od_count in aggregated.items():
            info = employee_info[key]
            final_results.append({
                "month": info["month"],
                "company": info["company"],
                "function": info["function"],
                "department": info["department"],
                "employee_name": info["employee_name"],
                "od": od_count,
            })
        final_results.sort(key=lambda x: (x["month"], x["function"], x["employee_name"]))
        return final_results
    
    else:
        raise ValueError("Invalid group_by")


from __future__ import annotations

from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select
from collections import defaultdict
import re

from ..models import UploadedRow, FunctionKPI, CompanyKPI, LocationKPI


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
    # YYYY-MM or YYYY/MM
    m = re.search(r"(20\d{2})[-/](\d{1,2})", s)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}"
    # DD-MM-YYYY
    m = re.search(r"(\d{1,2})[-/](\d{1,2})[-/](20\d{2})", s)
    if m:
        return f"{m.group(3)}-{int(m.group(2)):02d}"
    # Month name + year
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


def compute_on_time_stats(db: Session, group_by: str) -> List[Dict[str, Any]]:
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

    # month -> group_value -> accumulators
    members: Dict[Tuple[str, str], set] = defaultdict(set)
    present_count: Dict[Tuple[str, str], int] = defaultdict(int)
    late_count: Dict[Tuple[str, str], int] = defaultdict(int)

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
        is_late = str(r.get("Is Late", "")).strip().lower() == "yes"

        key = (month, group_val)
        if member_id:
            members[key].add(member_id)
        if flag == "P":
            present_count[key] += 1
            if is_late:
                late_count[key] += 1

    results: List[Dict[str, Any]] = []
    for (month, group_val), member_set in members.items():
        present = present_count.get((month, group_val), 0)
        late = late_count.get((month, group_val), 0)
        on_time = max(present - late, 0)
        pct = round((on_time / present * 100.0), 2) if present > 0 else 0.0
        results.append(
            {
                "month": month,
                "group": group_val,
                "members": len(member_set),
                "present": present,
                "late": late,
                "on_time": on_time,
                "on_time_pct": pct,
            }
        )

    # sort by month then group
    results.sort(key=lambda x: (x["month"], x["group"]))
    return results


def rebuild_kpi_tables(db: Session) -> None:
    # compute and store for each grouping
    mapping = {
        "function": (FunctionKPI, "Function Name"),
        "company": (CompanyKPI, "Comapny Name"),
        "location": (LocationKPI, "Job Location"),
    }

    rows = db.execute(select(UploadedRow.data)).scalars().all()

    from collections import defaultdict
    import re

    def _extract_month(date_str: str) -> str:
        if not date_str:
            return ""
        m = re.search(r"(20\d{2})[-/](\d{1,2})", date_str)
        if m:
            return f"{m.group(1)}-{int(m.group(2)):02d}"
        m = re.search(r"(\d{1,2})[-/](\d{1,2})[-/](20\d{2})", date_str)
        if m:
            return f"{m.group(3)}-{int(m.group(2)):02d}"
        return str(date_str)

    for key, (Model, field) in mapping.items():
        members = defaultdict(set)
        present_count = defaultdict(int)
        late_count = defaultdict(int)

        for r in rows:
            if not isinstance(r, dict):
                continue
            month = _extract_month(str(r.get("Attendance Date", "")))
            group_val = str(r.get(field, ""))
            emp_code = str(r.get("Employee Code", "")).strip()
            emp_name = str(r.get("Name", "")).strip()
            member_id = emp_code or emp_name

            flag = str(r.get("Flag", "")).strip()
            is_late = str(r.get("Is Late", "")).strip().lower() == "yes"

            k = (month, group_val)
            if member_id:
                members[k].add(member_id)
            if flag == "P":
                present_count[k] += 1
                if is_late:
                    late_count[k] += 1

        # clear existing
        db.query(Model).delete()

        # insert new
        to_add = []
        for (month, group_val), mset in members.items():
            present = present_count.get((month, group_val), 0)
            late = late_count.get((month, group_val), 0)
            on_time = max(present - late, 0)
            pct = f"{(on_time / present * 100.0):.2f}" if present > 0 else "0.00"
            to_add.append(
                Model(
                    month=month,
                    group_value=group_val,
                    members=len(mset),
                    present=present,
                    late=late,
                    on_time=on_time,
                    on_time_pct=pct,
                )
            )
        if to_add:
            db.add_all(to_add)
    db.commit()



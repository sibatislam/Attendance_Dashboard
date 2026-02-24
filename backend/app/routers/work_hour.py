import logging
from typing import List, Literal, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db

logger = logging.getLogger(__name__)
from ..auth import get_current_user
from ..models import User
from ..services.work_hour import compute_work_hour_completion
from ..services.work_hour_lost import compute_work_hour_lost
from ..services.leave_analysis import compute_leave_analysis
from ..services.od_analysis import compute_od_analysis
from ..services.weekly_analysis import compute_weekly_analysis
from ..models_kpi import OnTimeKPI, WorkHourKPI, WorkHourLostKPI, LeaveAnalysisKPI


router = APIRouter()


@router.get("/completion/{group_by}")
@router.get("/completion/{group_by}/")
def work_hour_completion(
    group_by: Literal["function", "company", "location"],
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    # Always use on-the-fly calculation for accurate unique member counting
    # Pre-calculated tables store per-file data, but we need accurate aggregation
    # across all files for the same month/group combination
    try:
        return compute_work_hour_completion(db, group_by)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/lost/{group_by}")
@router.get("/lost/{group_by}/")
def work_hour_lost(
    group_by: Literal["function", "company", "location"],
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    # Always use on-the-fly calculation for accurate unique member counting
    # Pre-calculated tables store per-file data, but we need accurate aggregation
    # across all files for the same month/group combination
    try:
        return compute_work_hour_lost(db, group_by)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/leave/{group_by}")
@router.get("/leave/{group_by}/")
def leave_analysis(
    group_by: Literal["function", "company", "location"],
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    # Always use on-the-fly calculation for accurate unique member counting
    # Pre-calculated tables store per-file data, but we need accurate aggregation
    # across all files for the same month/group combination
    try:
        return compute_leave_analysis(db, group_by)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/od/{group_by}")
@router.get("/od/{group_by}/")
def od_analysis(
    group_by: Literal["function", "employee"],
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    try:
        return compute_od_analysis(db, group_by)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def _norm_set(items: list) -> set:
    """Normalize for comparison: strip and lower."""
    return {str(x).strip().lower() for x in (items or []) if str(x).strip()}


# Company short names used by weekly_analysis (must match weekly_analysis._get_company_short_name)
_COMPANY_TO_SHORT = {
    "confidence batteries limited": "cbl",
    "confidence infrastructure plc.": "ciplc",
    "confidence steel export limited": "csel",
}
_COMPANY_SHORT_NAMES = {"cbl", "ciplc", "csel"}  # known short names in weekly data

# Company abbrevs used in function names (e.g. "Finance & Accounts - CIPLC & CBL")
_COMPANY_ABBREVS = {"cbl", "ciplc", "csel"}


def _allowed_function_match_set(allowed_functions: set) -> set:
    """
    Build set of normalized function strings for matching weekly rows.
    Weekly group is "CIPLC - Finance & Accounts"; user scope may have "Finance & Accounts - CIPLC & CBL".
    Include full lowered name and base (strip trailing " - CIPLC & CBL" style suffix) so both match.
    """
    out = set()
    for af in allowed_functions or []:
        af = (af or "").strip().lower()
        if not af:
            continue
        out.add(af)
        if " - " in af:
            parts = af.split(" - ")
            last = (parts[-1] or "").strip().lower()
            if any(abbrev in last for abbrev in _COMPANY_ABBREVS):
                base = " - ".join(parts[:-1]).strip().lower()
                if base:
                    out.add(base)
    return out


def _normalize_func(s: str) -> str:
    """Normalize function name for comparison: lower, collapse &/and and spaces."""
    if not s:
        return ""
    s = s.strip().lower()
    # Treat "&" and " and " the same so "Finance & Accounts" matches "Finance and Accounts"
    s = s.replace("&", " and ")
    return " ".join(s.split())


def _function_matches_scope(group_for_match: str, group_lower: str, function_match_set: set) -> bool:
    """True if row group matches any allowed function (exact or substring for N-1 name variants)."""
    if not function_match_set:
        return True
    if group_for_match in function_match_set or group_lower in function_match_set:
        return True
    # Lenient: allow if row function contains an allowed function or vice versa (e.g. "Finance" vs "Finance & Accounts")
    for allowed in function_match_set:
        if allowed in group_for_match or group_for_match in allowed:
            return True
    # Normalize "&" vs " and " so hierarchy "Finance and Accounts" matches data "Finance & Accounts"
    g_norm = _normalize_func(group_for_match)
    for allowed in function_match_set:
        a_norm = _normalize_func(allowed)
        if not a_norm:
            continue
        if a_norm in g_norm or g_norm in a_norm:
            return True
    return False


def _filter_weekly_by_scope(
    result: List[Dict[str, Any]],
    group_by: str,
    scope: dict,
) -> List[Dict[str, Any]]:
    """Filter weekly analysis rows by user scope (allowed_functions, allowed_departments, allowed_companies)."""
    if scope.get("all"):
        return result
    allowed_functions = _norm_set(scope.get("allowed_functions") or [])
    allowed_departments = _norm_set(scope.get("allowed_departments") or [])
    allowed_companies_raw = _norm_set(scope.get("allowed_companies") or [])
    # Weekly analysis uses short names (CIPLC, CBL) for company; allow both full name and short
    allowed_companies = set(allowed_companies_raw)
    for c in allowed_companies_raw:
        short = _COMPANY_TO_SHORT.get(c, c)
        allowed_companies.add(short)
    # If scope has no allowed lists, do not filter (avoid excluding all data for misconfigured N-1)
    if not allowed_functions and not allowed_departments and not allowed_companies:
        return result
    # Build function match set so "Finance & Accounts - CIPLC & CBL" matches row group "CIPLC - Finance & Accounts"
    function_match_set = _allowed_function_match_set(allowed_functions) if allowed_functions else set()
    out = []
    for row in result:
        group = (row.get("group") or "").strip()
        group_lower = group.lower()
        department = (row.get("department") or "").strip()
        row_depts = [d.strip() for d in department.split(",") if d.strip()]
        # Function tab: row group is "CIPLC - Finance & Accounts"; scope may have "Finance & Accounts - CIPLC & CBL"
        if group_by == "function":
            prefix = group_lower.split(" - ", 1)[0].strip() if " - " in group_lower else ""
            group_for_match = group_lower
            if " - " in group_lower:
                parts = group_lower.split(" - ", 1)
                if len(parts) == 2:
                    group_for_match = parts[1].strip()
            row_matches_function = _function_matches_scope(group_for_match, group_lower, function_match_set) if function_match_set else True
            if function_match_set and not row_matches_function:
                continue
            # Company filter: exclude when row's company not in scope. If hierarchy company doesn't map to any
            # known short (e.g. "CG-BD"), allowed_companies won't contain "ciplc" – allow rows that match by
            # function so N-1 users still see their function's data.
            if allowed_companies and prefix and prefix not in allowed_companies:
                scope_has_mapped_company = bool(allowed_companies & _COMPANY_SHORT_NAMES)
                if row_matches_function and not scope_has_mapped_company:
                    pass  # allow: hierarchy company didn't map to short name
                else:
                    continue
        if group_by == "company" and allowed_companies and group_lower not in allowed_companies:
            continue
        if group_by == "location":
            pass
        # When user has allowed_departments: exclude rows that have department data but none of it is in scope.
        # Use lenient match (exact or substring) so "Production" in scope matches "Production Dept" in data.
        if allowed_departments and row_depts:
            def _dept_matches(d: str, allowed: set) -> bool:
                d = d.strip().lower()
                if d in allowed:
                    return True
                for a in allowed:
                    if a in d or d in a:
                        return True
                return False
            if not any(_dept_matches(d, allowed_departments) for d in row_depts):
                continue
        out.append(row)
    return out


@router.get("/weekly/{group_by}")
@router.get("/weekly/{group_by}/")
def weekly_analysis(
    group_by: Literal["function", "company", "location"],
    breakdown: str | None = Query(None, description="When 'department', return one row per (week, group, department) with per-department member counts"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Get weekly analysis data (on-time %, work hour completion, work hour lost). Filtered by user scope for non-admin."""
    try:
        result = compute_weekly_analysis(db, group_by, breakdown=breakdown)
        from ..services.employee_hierarchy import get_effective_scope
        scope = get_effective_scope(db, current_user)
        count_before = len(result)
        result = _filter_weekly_by_scope(result, group_by, scope)
        if not result:
            username = getattr(current_user, "username", None) or getattr(current_user, "email", None) or "?"
            if count_before > 0:
                logger.warning(
                    "Weekly dashboard empty for user after scope filter: username=%s, group_by=%s, breakdown=%s, "
                    "scope_all=%s, allowed_functions=%s, allowed_departments=%s, allowed_companies=%s, rows_before_filter=%s",
                    username, group_by, breakdown, scope.get("all"),
                    scope.get("allowed_functions"), scope.get("allowed_departments"), scope.get("allowed_companies"),
                    count_before,
                )
            else:
                logger.info(
                    "Weekly dashboard empty for user (no rows before filter): username=%s, group_by=%s, breakdown=%s",
                    username, group_by, breakdown,
                )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


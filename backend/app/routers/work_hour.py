import logging
from typing import List, Literal, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AppConfig

logger = logging.getLogger(__name__)
from ..auth import get_current_user
from ..models import User

# Config keys for CTC (must match config router)
_CTC_PER_HOUR_KEY = "ctc_per_hour_bdt"
_CTC_PER_HOUR_BY_FUNCTION_PREFIX = "ctc_per_hour_bdt:"
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


def _load_ctc_rates(db: Session) -> tuple[float | None, dict[str, float]]:
    """Load default CTC per hour and CTC by function from AppConfig. Returns (default_ctc, ctc_by_function)."""
    default_ctc = None
    row = db.query(AppConfig).filter(AppConfig.key == _CTC_PER_HOUR_KEY).first()
    if row and row.value not in (None, ""):
        try:
            default_ctc = float(row.value)
        except (TypeError, ValueError):
            pass
    ctc_by_function = {}
    rows = db.query(AppConfig).filter(AppConfig.key.like(f"{_CTC_PER_HOUR_BY_FUNCTION_PREFIX}%")).all()
    for r in rows:
        if not r.value:
            continue
        fn = r.key[len(_CTC_PER_HOUR_BY_FUNCTION_PREFIX) :].strip()
        if fn:
            try:
                ctc_by_function[fn] = float(r.value)
            except (TypeError, ValueError):
                pass
    return default_ctc, ctc_by_function


def _get_rate_for_group(group: str, default_ctc: float | None, ctc_by_function: dict[str, float]) -> float | None:
    """Resolve CTC per hour for a weekly row group (e.g. 'CIPLC - Finance & Accounts'). Matches frontend getRateForGroup."""
    g = (group or "").strip()
    dash_idx = g.find(" - ")
    function_part = g[dash_idx + 3 :].strip() if dash_idx >= 0 else g
    if function_part and function_part in ctc_by_function:
        return ctc_by_function[function_part]
    return default_ctc


def _compute_company_totals_full(
    full_result: List[Dict[str, Any]],
    default_ctc: float | None,
    ctc_by_function: dict[str, float],
) -> Dict[str, Dict[str, float]]:
    """
    From unscoped weekly rows (group_by=function), aggregate cost by (month_key, company).
    Used so N-1 users see full company totals in the Lost Hours Cost company cards.
    """
    # month_key -> company -> total cost (BDT)
    totals: Dict[str, Dict[str, float]] = {}
    for row in full_result:
        group = (row.get("group") or "").strip()
        if not group:
            continue
        dash_idx = group.find(" - ")
        company = (group[:dash_idx].strip() if dash_idx >= 0 else group) or "Unknown"
        lost = float(row.get("lost") or row.get("lost_hours") or 0)
        rate = _get_rate_for_group(group, default_ctc, ctc_by_function)
        if rate is None:
            continue
        cost = round(lost * rate, 2)
        year = row.get("year")
        month = row.get("month")
        if year is None or month is None:
            continue
        month_key = f"{year}-{int(month):02d}"
        if month_key not in totals:
            totals[month_key] = {}
        totals[month_key][company] = round((totals[month_key].get(company, 0) + cost) * 100) / 100
    return totals


@router.get("/weekly/{group_by}")
@router.get("/weekly/{group_by}/")
def weekly_analysis(
    group_by: Literal["function", "company", "location"],
    breakdown: str | None = Query(None, description="When 'department', return one row per (week, group, department) with per-department member counts"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get weekly analysis data (on-time %, work hour completion, work hour lost). Filtered by user scope for non-admin.
    Returns { data: list, company_totals_full?: dict } so N-1 users get full company totals for Lost Hours Cost cards."""
    try:
        from ..services.employee_hierarchy import get_effective_scope

        result_full, company_month_agg = compute_weekly_analysis(db, group_by, breakdown=breakdown)
        scope = get_effective_scope(db, current_user)
        count_before = len(result_full)
        result = _filter_weekly_by_scope(result_full, group_by, scope)

        # Always compute company totals from full data when possible so Lost Hour Cost analysis
        # shows correct company lost hour cost for both admin and N-1 (single source of truth).
        company_totals_full = None
        company_wise_full = None
        if group_by == "function" and breakdown == "department":
            default_ctc, ctc_by_function = _load_ctc_rates(db)
            if default_ctc is not None or ctc_by_function:
                company_totals_full = _compute_company_totals_full(result_full, default_ctc, ctc_by_function)
            if company_month_agg is not None:
                # Full company-wise rows (members, shift, work, lost, cost) so N-1 sees same table as admin
                company_wise_full = []
                for (month_key, company), agg in company_month_agg.items():
                    members = len(agg.get("members") or set())
                    shift_hours = round(agg.get("shift_hours") or 0, 2)
                    work_hours = round(agg.get("work_hours") or 0, 2)
                    lost = round(agg.get("lost") or 0, 2)
                    cost = round((company_totals_full or {}).get(month_key, {}).get(company, 0), 2)
                    year = int(month_key.split("-")[0]) if "-" in month_key else 0
                    month = int(month_key.split("-")[1]) if len(month_key.split("-")) > 1 else 0
                    company_wise_full.append({
                        "month_key": month_key,
                        "year": year,
                        "month": month,
                        "company": company,
                        "members": members,
                        "shift_hours": shift_hours,
                        "work_hours": work_hours,
                        "lost": lost,
                        "cost": cost,
                    })
                company_wise_full.sort(key=lambda x: (x["month_key"], x["company"]))

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

        out = {"data": result}
        if company_totals_full is not None:
            out["company_totals_full"] = company_totals_full
        if company_wise_full is not None:
            out["company_wise_full"] = company_wise_full
        return out
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


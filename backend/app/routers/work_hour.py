from typing import List, Literal, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
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


@router.get("/weekly/{group_by}")
@router.get("/weekly/{group_by}/")
def weekly_analysis(
    group_by: Literal["function", "company", "location"],
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Get weekly analysis data (on-time %, work hour completion, work hour lost)."""
    try:
        result = compute_weekly_analysis(db, group_by)
        # Debug: log if empty
        if not result:
            from ..models import UploadedRow
            sample_rows = db.query(UploadedRow).limit(5).all()
            if sample_rows:
                sample_data = sample_rows[0].data if sample_rows[0].data else {}
                date_keys = [k for k in sample_data.keys() if 'date' in k.lower() or 'Date' in k]
                print(f"[DEBUG] Weekly analysis returned empty. Sample date keys found: {date_keys}")
                print(f"[DEBUG] Sample 'Attendance Date' value: {sample_data.get('Attendance Date', 'NOT FOUND')}")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


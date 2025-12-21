from typing import List, Literal, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..services.work_hour import compute_work_hour_completion
from ..services.work_hour_lost import compute_work_hour_lost
from ..services.leave_analysis import compute_leave_analysis
from ..services.od_analysis import compute_od_analysis
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


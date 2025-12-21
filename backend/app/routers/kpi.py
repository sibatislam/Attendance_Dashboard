from typing import List, Literal, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..services.kpi import compute_on_time_stats, rebuild_kpi_tables
from ..models import FunctionKPI, CompanyKPI, LocationKPI
from ..models_kpi import OnTimeKPI, WorkHourKPI, WorkHourLostKPI, LeaveAnalysisKPI


router = APIRouter()


@router.get("/on_time/{group_by}")
@router.get("/on_time/{group_by}/")
@router.get("/on-time/{group_by}")
@router.get("/on-time/{group_by}/")
def on_time(
    group_by: Literal["function", "company", "location"],
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    # Always use on-the-fly calculation for accurate unique member counting
    # Pre-calculated tables store per-file data, but we need accurate aggregation
    # across all files for the same month/group combination
    return compute_on_time_stats(db, group_by)


@router.post("/rebuild")
def rebuild(db: Session = Depends(get_db)):
    rebuild_kpi_tables(db)
    return {"status": "ok"}


# Simple, on-the-fly computation (no persistence) for immediate results
@router.get("/simple/{group_by}")
@router.get("/simple/{group_by}/")
def on_time_simple(
    group_by: Literal["function", "company", "location"],
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    try:
        return compute_on_time_stats(db, group_by)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))



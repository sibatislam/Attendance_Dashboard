"""Endpoint to rebuild KPIs for all existing files."""
from fastapi import APIRouter, Depends

from ..db import get_db
from ..services.kpi_calculator import run_rebuild_all_kpis
from ..auth import get_current_user

router = APIRouter()


@router.post("/rebuild-all")
def rebuild_all_kpis(
    db=Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Rebuild KPIs for all existing uploaded files.
    Use this to populate pre-calculated tables. Also run automatically after each upload.
    """
    result = run_rebuild_all_kpis(db)
    return {
        "status": "success",
        "total_files": result["total_files"],
        "calculated": result["calculated"],
        "message": f"Successfully calculated KPIs for {result['calculated']} out of {result['total_files']} files",
    }


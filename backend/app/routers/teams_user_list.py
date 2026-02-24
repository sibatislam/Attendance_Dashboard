"""MS Teams User List: upload Excel (Teams + CBL_Teams sheets), store in DB, and return license counts."""
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..db import get_db
from ..models import TeamsLicense, TeamsUserListUpload, User
from ..auth import get_current_user
from ..services.parser import read_teams_user_list_sheets
from .roles import get_permissions_for_role

router = APIRouter()


class UploadResponse(BaseModel):
    total_assigned: int
    by_sheet: dict  # e.g. {"Teams": 100, "CBL_Teams": 53}
    total_teams: int = 0
    free: int = 0
    rows: list = []  # list of dicts: user rows from Teams + CBL_Teams sheets


class LatestResponse(BaseModel):
    total_assigned: int
    by_sheet: dict
    total_teams: int = 0
    free: int = 0
    rows: list = []
    filename: str = ""
    uploaded_at: str = ""


def _check_teams_user_list_access(current_user: User, db: Session):
    if current_user.role == "admin":
        return
    perms = get_permissions_for_role(db, current_user.role or "user")
    teams_perms = perms.get("teams_dashboard", {})
    if not teams_perms.get("enabled", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to Teams dashboard",
        )
    features = teams_perms.get("features") or []
    if "license_entry" not in features and "teams_user_list" not in features:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You need License Entry or MS Teams User list permission",
        )


@router.post("/upload", response_model=UploadResponse)
async def upload_teams_user_list(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload an Excel file containing 'Teams' and 'CBL_Teams' sheets.
    Returns total assigned license count (sum of data rows in both sheets)
    and optionally current total_teams / free from license settings.
    """
    _check_teams_user_list_access(current_user, db)

    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an Excel file (.xlsx or .xls)",
        )

    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    if file.filename.lower().endswith(".xls"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .xlsx is supported for Teams user list (multi-sheet). Use .xlsx.",
        )

    try:
        parsed = read_teams_user_list_sheets(file_bytes)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse file. Ensure it has 'Teams' and/or 'CBL_Teams' sheets: {e}",
        )

    total_assigned = parsed.get("total_assigned", 0)
    by_sheet = parsed.get("by_sheet", {})
    rows = parsed.get("rows", [])

    # Get current license for total_teams and free
    license_row = db.query(TeamsLicense).first()
    total_teams = license_row.total_teams if license_row else 0
    free = max(0, total_teams - total_assigned) if total_teams else 0

    # Persist to database so the list is always available (no dependency on localStorage)
    record = TeamsUserListUpload(
        filename=file.filename or "upload.xlsx",
        total_assigned=total_assigned,
        by_sheet=by_sheet,
        total_teams=total_teams,
        free=free,
        rows=rows,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return UploadResponse(
        total_assigned=total_assigned,
        by_sheet=by_sheet,
        total_teams=total_teams,
        free=free,
        rows=rows,
    )


@router.get("/latest", response_model=LatestResponse)
def get_latest_teams_user_list(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the most recently uploaded Teams User List from the database."""
    _check_teams_user_list_access(current_user, db)

    record = (
        db.query(TeamsUserListUpload)
        .order_by(desc(TeamsUserListUpload.uploaded_at))
        .first()
    )
    if not record:
        return LatestResponse(total_assigned=0, by_sheet={}, total_teams=0, free=0, rows=[], filename="", uploaded_at="")

    uploaded_at_str = record.uploaded_at.isoformat() if record.uploaded_at else ""
    return LatestResponse(
        total_assigned=record.total_assigned,
        by_sheet=record.by_sheet or {},
        total_teams=record.total_teams,
        free=record.free,
        rows=record.rows or [],
        filename=record.filename or "",
        uploaded_at=uploaded_at_str,
    )

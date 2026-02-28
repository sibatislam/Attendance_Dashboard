from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, select, delete

from ..db import get_db
from ..models import UploadedFile, UploadedRow
from ..schemas import UploadedFileListItem, UploadedFileDetail, DeleteRequest, DeleteResponse
from ..auth import get_current_user
from ..services.employee_hierarchy import get_allowed_employee_codes_for_attendance


router = APIRouter()


def _row_employee_code(row: dict) -> str:
    """Normalize employee code from attendance row (multiple possible column names)."""
    for key in ("Employee Code", "Employee ID", "Emp Code", "Code"):
        v = (row.get(key) or "")
        if isinstance(v, (int, float)):
            v = str(int(v)) if v == int(v) else str(v)
        v = str(v).strip().lower()
        if v:
            return v
    return ""


def _row_email(row: dict) -> str:
    """Normalize email from attendance row."""
    for key in ("Email (Official)", "Email (Offical)", "Email", "Official Email"):
        v = (row.get(key) or "")
        v = str(v).strip().lower()
        if v:
            return v
    return ""


def _row_department(row: dict) -> str:
    """Normalize department from attendance row (single value or first of comma-separated)."""
    for key in ("Department Name", "Department", "Departments"):
        v = (row.get(key) or "")
        v = str(v).strip()
        if v:
            return v.split(",")[0].strip().lower()
    return ""


def _row_function(row: dict) -> str:
    """Normalize function from attendance row."""
    for key in ("Function Name", "Function", "Functions"):
        v = (row.get(key) or "")
        v = str(v).strip().lower()
        if v:
            return v
    return ""


@router.get("/", response_model=List[UploadedFileListItem])
def list_files(db: Session = Depends(get_db)):
    stmt = (
        select(
            UploadedFile.id,
            UploadedFile.filename,
            UploadedFile.uploaded_at,
            func.count(UploadedRow.id).label("total_rows"),
        )
        .join(UploadedRow, UploadedFile.id == UploadedRow.file_id, isouter=True)
        .group_by(UploadedFile.id)
        .order_by(UploadedFile.uploaded_at.desc())
    )
    results = db.execute(stmt).all()
    return [
        UploadedFileListItem(
            id=r.id,
            filename=r.filename,
            uploaded_at=r.uploaded_at,
            total_rows=int(r.total_rows or 0),
        )
        for r in results
    ]


@router.get("/{file_id}", response_model=UploadedFileDetail)
def get_file_detail(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    file_rec: UploadedFile | None = db.get(UploadedFile, file_id)
    if not file_rec:
        raise HTTPException(status_code=404, detail="File not found")

    rows = db.execute(select(UploadedRow.data).where(UploadedRow.file_id == file_id)).scalars().all()
    row_list = [r for r in rows]

    # For non-admin: only rows for current user + subordinates, and only their departments/functions (e.g. IT user never sees QA)
    allowed_codes, allowed_emails, allowed_depts, allowed_funcs = get_allowed_employee_codes_for_attendance(
        db, current_user
    )
    if allowed_codes is not None or allowed_emails is not None:
        allowed_codes = allowed_codes or set()
        allowed_emails = allowed_emails or set()
        allowed_depts = allowed_depts or set()
        allowed_funcs = allowed_funcs or set()
        filtered = []
        for r in row_list:
            data = r if isinstance(r, dict) else getattr(r, "data", r)
            if not isinstance(data, dict):
                continue
            code = _row_employee_code(data)
            email = _row_email(data)
            dept = _row_department(data)
            func = _row_function(data)
            if not ((code and code in allowed_codes) or (email and email in allowed_emails)):
                continue
            # Only show rows whose department/function is in the allowed set (e.g. IT user never sees QA)
            if allowed_depts and dept and dept not in allowed_depts:
                continue
            if allowed_funcs and func and func not in allowed_funcs:
                continue
            filtered.append(data)
        row_list = filtered

    return UploadedFileDetail(
        id=file_rec.id,
        filename=file_rec.filename,
        uploaded_at=file_rec.uploaded_at,
        header_order=file_rec.header_order or [],
        rows=row_list,
    )


@router.delete("/", response_model=DeleteResponse)
def delete_files(payload: DeleteRequest, db: Session = Depends(get_db)):
    if not payload.file_ids:
        return DeleteResponse(deleted_count=0)

    # Ensure IDs exist
    existing = db.execute(select(UploadedFile.id).where(UploadedFile.id.in_(payload.file_ids))).scalars().all()
    if not existing:
        return DeleteResponse(deleted_count=0)

    # Deleting via ORM will respect cascade
    for fid in existing:
        obj = db.get(UploadedFile, fid)
        if obj:
            db.delete(obj)
    db.commit()
    return DeleteResponse(deleted_count=len(existing))



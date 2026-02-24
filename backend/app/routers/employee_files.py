"""Employee List file management endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from ..db import get_db
from ..models import EmployeeUploadedFile, EmployeeUploadedRow
from ..schemas import UploadedFileListItem, UploadedFileDetail, DeleteRequest, DeleteResponse
from ..auth import get_current_user, get_current_admin_user
from ..services.employee_hierarchy import build_hierarchy_map, get_scope_options

router = APIRouter()


class EmployeeHierarchyItem(BaseModel):
    email: str
    name: str
    employee_code: Optional[str] = None
    company: Optional[str] = None
    function: Optional[str] = None
    department: Optional[str] = None
    supervisor_name: Optional[str] = None
    line_manager_employee_id: Optional[str] = None
    level: Optional[str] = None  # "N", "N-1", "N-2", ...
    source_filename: Optional[str] = None  # which uploaded Employee List file this row came from


@router.get("/hierarchy", response_model=List[EmployeeHierarchyItem])
def get_employee_hierarchy(
    employee_file_id: Optional[int] = Query(None, description="Use specific file; else latest"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin_user),
):
    """
    Build employee list with N, N-1, N-2 levels from Supervisor Name and Line Manager Employee ID.
    Roots (no line manager / no supervisor) = N; their direct reports = N-1; then N-2, etc.
    """
    hierarchy_map = build_hierarchy_map(db, employee_file_id)
    out: List[EmployeeHierarchyItem] = []
    for email_key, row in sorted(hierarchy_map.items(), key=lambda x: (x[1].get("name") or "").lower()):
        out.append(
            EmployeeHierarchyItem(
                email=row["email"],
                name=row.get("name") or row["email"],
                employee_code=row.get("employee_code") or None,
                company=row.get("company") or None,
                function=row.get("function") or None,
                department=row.get("department") or None,
                supervisor_name=row.get("supervisor_name") or None,
                line_manager_employee_id=row.get("line_manager_employee_id") or None,
                level=row.get("level"),
                source_filename=row.get("source_filename") or None,
            )
        )
    return out


@router.get("/scope-options")
def scope_options(
    employee_file_id: Optional[int] = Query(None, description="Use specific file; else latest"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin_user),
):
    """Return unique functions, departments, and companies from employee list (for user form multi-select)."""
    return get_scope_options(db, employee_file_id)


@router.get("/row-by-email")
def get_employee_row_by_email(
    email: str = Query(..., description="Employee email (e.g. irina.const@cg-bd.com)"),
    employee_file_id: Optional[int] = Query(None, description="Use specific file; else latest file"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin_user),
):
    """
    Return the raw row from the Employee List file for the given email.
    Shows exactly what column names and values were stored from the Excel (Function, Department, Company, etc.).
    """
    from ..services.employee_hierarchy import _get_cell

    if employee_file_id:
        files = db.query(EmployeeUploadedFile).filter(EmployeeUploadedFile.id == employee_file_id).all()
    else:
        files = (
            db.query(EmployeeUploadedFile)
            .order_by(EmployeeUploadedFile.uploaded_at.desc())
            .limit(1)
            .all()
        )
    if not files:
        return {"found": False, "message": "No Employee List file uploaded."}

    f = files[0]
    email_lower = email.strip().lower()
    rows = db.query(EmployeeUploadedRow.data).filter(EmployeeUploadedRow.file_id == f.id).all()
    for r in rows:
        data = r.data or {}
        row_email = _get_cell(data, "Email (Official)", "Email (Offical)", "Email")
        if row_email and row_email.lower() == email_lower:
            return {
                "found": True,
                "source_filename": getattr(f, "filename", None),
                "file_id": f.id,
                "header_order": getattr(f, "header_order", []) or list(data.keys()),
                "row": data,
                "mapped": {
                    "company": _get_cell(data, "Company Name", "Company", "Comapny Name", "Legal Entity", "Company Name (Legal)", "Entity"),
                    "function": _get_cell(
                        data,
                        "Section Info", "Function", "Function Name", "Division", "Business Function", "Business Unit", "Unit",
                        "Sub Function", "Function Name (Level 1)", "Function / Department", "Function (Level 1)",
                    ),
                    "department": _get_cell(
                        data,
                        "Sub Department", "Sub-Department", "Sub Department Name", "Team", "Department",
                        "Department Name", "Dept", "Cost Center", "Cost Center Name", "Division (Level 2)",
                        "Department (Level 2)", "Unit Name", "Sub Unit",
                    ),
                },
            }
    return {
        "found": False,
        "source_filename": getattr(f, "filename", None),
        "file_id": f.id,
        "message": f"No row with email '{email}' in this file.",
    }


@router.get("/", response_model=List[UploadedFileListItem])
def list_employee_files(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List all uploaded Employee List files with row counts."""
    files = (
        db.query(
            EmployeeUploadedFile.id,
            EmployeeUploadedFile.filename,
            EmployeeUploadedFile.uploaded_at,
            func.count(EmployeeUploadedRow.id).label("total_rows")
        )
        .outerjoin(EmployeeUploadedRow, EmployeeUploadedFile.id == EmployeeUploadedRow.file_id)
        .group_by(EmployeeUploadedFile.id)
        .order_by(EmployeeUploadedFile.uploaded_at.desc())
        .all()
    )
    
    return [
        {
            "id": f.id,
            "filename": f.filename,
            "uploaded_at": f.uploaded_at,
            "total_rows": f.total_rows or 0
        }
        for f in files
    ]


@router.get("/{file_id}", response_model=UploadedFileDetail)
def get_employee_file_detail(
    file_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get detailed view of a specific Employee List file."""
    file = db.query(EmployeeUploadedFile).filter(EmployeeUploadedFile.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    rows = db.query(EmployeeUploadedRow.data).filter(EmployeeUploadedRow.file_id == file_id).all()
    
    return {
        "id": file.id,
        "filename": file.filename,
        "uploaded_at": file.uploaded_at,
        "header_order": file.header_order,
        "rows": [r.data for r in rows]
    }


@router.delete("/", response_model=DeleteResponse)
def delete_employee_files(
    request: DeleteRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete one or more Employee List files."""
    deleted_count = 0
    for file_id in request.file_ids:
        file = db.query(EmployeeUploadedFile).filter(EmployeeUploadedFile.id == file_id).first()
        if file:
            db.delete(file)
            deleted_count += 1
    db.commit()
    return {"deleted_count": deleted_count}


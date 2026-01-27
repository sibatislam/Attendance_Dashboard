"""Teams App Usage file management endpoints."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..db import get_db
from ..models import TeamsAppUploadedFile, TeamsAppUploadedRow
from ..schemas import UploadedFileListItem, UploadedFileDetail, DeleteRequest, DeleteResponse
from ..auth import get_current_user

router = APIRouter()


@router.get("/", response_model=List[UploadedFileListItem])
def list_teams_app_files(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List all uploaded Teams App Usage files with row counts."""
    files = (
        db.query(
            TeamsAppUploadedFile.id,
            TeamsAppUploadedFile.filename,
            TeamsAppUploadedFile.uploaded_at,
            TeamsAppUploadedFile.from_month,
            TeamsAppUploadedFile.to_month,
            func.count(TeamsAppUploadedRow.id).label("total_rows")
        )
        .outerjoin(TeamsAppUploadedRow, TeamsAppUploadedFile.id == TeamsAppUploadedRow.file_id)
        .group_by(TeamsAppUploadedFile.id)
        .order_by(TeamsAppUploadedFile.uploaded_at.desc())
        .all()
    )
    
    return [
        {
            "id": f.id,
            "filename": f.filename,
            "uploaded_at": f.uploaded_at,
            "from_month": f.from_month,
            "to_month": f.to_month,
            "total_rows": f.total_rows or 0,
        }
        for f in files
    ]


@router.get("/{file_id}", response_model=UploadedFileDetail)
def get_teams_app_file_detail(
    file_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get detailed view of a specific Teams App Usage file."""
    file = db.query(TeamsAppUploadedFile).filter(TeamsAppUploadedFile.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    rows = db.query(TeamsAppUploadedRow.data).filter(TeamsAppUploadedRow.file_id == file_id).all()
    
    return {
        "id": file.id,
        "filename": file.filename,
        "uploaded_at": file.uploaded_at,
        "header_order": file.header_order,
        "rows": [r.data for r in rows],
    }


@router.delete("/", response_model=DeleteResponse)
def delete_teams_app_files(
    request: DeleteRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete one or more Teams App Usage files."""
    if not request.file_ids:
        return {"deleted_count": 0}
    
    deleted_count = 0
    for file_id in request.file_ids:
        file = db.query(TeamsAppUploadedFile).filter(TeamsAppUploadedFile.id == file_id).first()
        if file:
            db.delete(file)
            deleted_count += 1
    db.commit()
    return {"deleted_count": deleted_count}


@router.post("/delete", response_model=DeleteResponse)
def delete_teams_app_files_post(
    request: DeleteRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete one or more Teams App Usage files (POST method for better compatibility)."""
    if not request.file_ids:
        return {"deleted_count": 0}
    
    deleted_count = 0
    for file_id in request.file_ids:
        file = db.query(TeamsAppUploadedFile).filter(TeamsAppUploadedFile.id == file_id).first()
        if file:
            db.delete(file)
            deleted_count += 1
    db.commit()
    return {"deleted_count": deleted_count}


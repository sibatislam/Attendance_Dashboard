"""Employee List file upload endpoint."""
from typing import List
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import EmployeeUploadedFile, EmployeeUploadedRow
from ..schemas import UploadResponseItem
from ..services.parser import read_file_preserve_text
from ..auth import get_current_user

router = APIRouter()


@router.post("", response_model=List[UploadResponseItem])
async def upload_employee_files(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Upload one or more Employee List files (.xlsx, .xls, .csv) and store in database."""
    results = []
    
    for uploaded_file in files:
        try:
            # Read file content
            file_bytes = await uploaded_file.read()
            
            # Parse the file (data_only=True so we get displayed values, not formulas)
            headers, rows_data = read_file_preserve_text(uploaded_file.filename, file_bytes, data_only=True)
            
            # Create file record
            db_file = EmployeeUploadedFile(
                filename=uploaded_file.filename,
                header_order=headers
            )
            db.add(db_file)
            db.flush()  # Get the file ID
            
            # Create row records
            for row_dict in rows_data:
                db_row = EmployeeUploadedRow(
                    file_id=db_file.id,
                    data=row_dict
                )
                db.add(db_row)
            
            db.commit()
            db.refresh(db_file)
            
            results.append(
                UploadResponseItem(
                    id=db_file.id,
                    filename=db_file.filename,
                    uploaded_at=db_file.uploaded_at,
                    total_rows=len(rows_data)
                )
            )
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to process file {uploaded_file.filename}: {e}")
    
    return results


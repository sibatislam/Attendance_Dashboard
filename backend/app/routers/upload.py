from typing import List
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from ..db import get_db, SessionLocal
from ..models import UploadedFile, UploadedRow
from ..schemas import UploadResponseItem
from ..services.parser import read_file_preserve_text
from ..services.kpi_calculator import run_rebuild_all_kpis


router = APIRouter()


def _background_rebuild_all_kpis() -> None:
    """Run full KPI rebuild in background with its own DB session (for use after upload)."""
    db = SessionLocal()
    try:
        run_rebuild_all_kpis(db)
    finally:
        db.close()


@router.post("", response_model=List[UploadResponseItem])
async def upload_files(
    files: List[UploadFile] = File(...),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    created_items: List[UploadResponseItem] = []

    for uf in files:
        content = await uf.read()
        try:
            header_order, rows = read_file_preserve_text(uf.filename, content)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse {uf.filename}: {e}")

        try:
            file_rec = UploadedFile(filename=uf.filename, header_order=header_order)
            db.add(file_rec)
            db.flush()  # to get file_rec.id

            row_models = [UploadedRow(file_id=file_rec.id, data=row) for row in rows]
            if row_models:
                db.add_all(row_models)
            db.commit()
            db.refresh(file_rec)
            
        except SQLAlchemyError as db_err:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database error for {uf.filename}: {db_err}")
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Unexpected error for {uf.filename}: {e}")

        created_items.append(
            UploadResponseItem(
                id=file_rec.id,
                filename=file_rec.filename,
                uploaded_at=file_rec.uploaded_at,
                total_rows=len(rows),
            )
        )

    # Rebuild all KPIs in background so precomputed tables stay in sync (rebuild always when required)
    if background_tasks and created_items:
        background_tasks.add_task(_background_rebuild_all_kpis)

    return created_items



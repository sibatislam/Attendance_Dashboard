"""CXO user management endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from ..db import get_db
from ..models import CXOUser, EmployeeUploadedFile, EmployeeUploadedRow
from ..auth import get_current_user, get_current_admin_user

router = APIRouter()


class CXOUserCreate(BaseModel):
    email: EmailStr


class CXOUserResponse(BaseModel):
    id: int
    email: str
    created_at: str

    class Config:
        from_attributes = True


class EmployeeWithCXOStatus(BaseModel):
    email: str
    name: Optional[str] = None
    function: Optional[str] = None
    company: Optional[str] = None
    is_cxo: bool


@router.get("/", response_model=List[CXOUserResponse])
def list_cxo_users(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get list of all CXO users."""
    cxo_users = db.query(CXOUser).order_by(CXOUser.email).all()
    return cxo_users


@router.get("/employees", response_model=List[EmployeeWithCXOStatus])
def list_employees_with_cxo_status(
    employee_file_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get list of all employees from employee files with their CXO status."""
    # Get CXO emails
    cxo_users = db.query(CXOUser).all()
    cxo_emails = {cxo.email.lower() for cxo in cxo_users}
    
    # Get employee files
    if employee_file_id:
        employee_files = db.query(EmployeeUploadedFile).filter(EmployeeUploadedFile.id == employee_file_id).all()
    else:
        employee_files = db.query(EmployeeUploadedFile).order_by(EmployeeUploadedFile.uploaded_at.desc()).all()
    
    if not employee_files:
        return []
    
    # Build unique employee list
    employees_map = {}
    
    for emp_file in employee_files:
        emp_rows = db.query(EmployeeUploadedRow).filter(EmployeeUploadedRow.file_id == emp_file.id).all()
        for row in emp_rows:
            data = row.data
            email = data.get('Email (Offical)', '').strip()
            if not email:
                continue
            
            email_lower = email.lower()
            if email_lower not in employees_map:
                employees_map[email_lower] = {
                    'email': email,
                    'name': data.get('Employee Name', '') or data.get('Name', '') or '',
                    'function': data.get('Function', '') or '',
                    'company': data.get('Company', '') or '',
                    'is_cxo': email_lower in cxo_emails
                }
    
    # Convert to list and sort by email
    employees = list(employees_map.values())
    employees.sort(key=lambda x: x['email'].lower())
    
    return employees


class MarkCXORequest(BaseModel):
    email: str


@router.post("/mark", response_model=CXOUserResponse, status_code=status.HTTP_201_CREATED)
def mark_employee_as_cxo(
    request: MarkCXORequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Mark an employee as CXO by email."""
    if not request.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required"
        )
    
    email_lower = request.email.lower().strip()
    
    # Check if already exists
    existing = db.query(CXOUser).filter(CXOUser.email == email_lower).first()
    if existing:
        return existing
    
    # Create new CXO user
    try:
        new_cxo = CXOUser(email=email_lower)
        db.add(new_cxo)
        db.commit()
        db.refresh(new_cxo)
        return new_cxo
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark employee as CXO: {str(e)}"
        )


@router.delete("/unmark/{email:path}", status_code=status.HTTP_204_NO_CONTENT)
def unmark_employee_as_cxo(
    email: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Unmark an employee as CXO by email."""
    email_lower = email.lower().strip()
    
    cxo_user = db.query(CXOUser).filter(CXOUser.email == email_lower).first()
    if not cxo_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CXO user not found"
        )
    
    db.delete(cxo_user)
    db.commit()
    
    return None


@router.post("/", response_model=CXOUserResponse, status_code=status.HTTP_201_CREATED)
def add_cxo_user(
    cxo_data: CXOUserCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Add a new CXO user by email (admin only)."""
    # Check if email already exists
    existing = db.query(CXOUser).filter(CXOUser.email == cxo_data.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CXO user with this email already exists"
        )
    
    # Create new CXO user
    new_cxo = CXOUser(email=cxo_data.email.lower())
    db.add(new_cxo)
    db.commit()
    db.refresh(new_cxo)
    
    return new_cxo


@router.delete("/{cxo_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_cxo_user(
    cxo_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_admin_user)
):
    """Remove a CXO user (admin only)."""
    cxo_user = db.query(CXOUser).filter(CXOUser.id == cxo_id).first()
    if not cxo_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CXO user not found"
        )
    
    db.delete(cxo_user)
    db.commit()
    
    return None

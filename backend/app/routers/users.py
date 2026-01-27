"""User management endpoints (admin only)."""
import io
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from openpyxl import Workbook, load_workbook

from ..db import get_db
from ..models import User, Role
from ..schemas import UserResponse, UserCreate, UserUpdate
from ..auth import get_current_admin_user, get_password_hash
from .roles import get_permissions_for_role, _ensure_default_roles


class BulkDeleteRequest(BaseModel):
    user_ids: List[int]

router = APIRouter()

BULK_DEFAULT_PASSWORD = "123456"
TEMPLATE_HEADERS = [
    "Employee Name",
    "Designation",
    "Function",
    "Email (Official)",
    "Username",
    "Role",
    "Password",
]
EMAIL_COL_VARIANTS = ["Email (Official)", "Email (Offical)"]


@router.get("/")
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """List all users (admin only). Permissions resolved from Role by user.role."""
    users = db.query(User).all()
    out = []
    for u in users:
        role_name = u.role or "user"
        perms = get_permissions_for_role(db, role_name)
        if not isinstance(perms, dict):
            perms = {}
        out.append({
            "id": u.id,
            "email": u.email or "",
            "username": u.username or "",
            "full_name": u.full_name,
            "phone": u.phone,
            "department": u.department,
            "position": u.position,
            "role": role_name,
            "is_active": bool(u.is_active),
            "permissions": perms,
            "last_login": u.last_login.isoformat() if u.last_login else None,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "updated_at": u.updated_at.isoformat() if u.updated_at else None,
        })
    return out


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Create a new user (admin only)."""
    # Check if email exists
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if username exists
    existing_username = db.query(User).filter(User.username == user_data.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Validate role exists
    _ensure_default_roles(db)
    role_name = (user_data.role or "user").strip()
    if not db.query(Role).filter(Role.name == role_name).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{role_name}' not found. Create it in Role Management first."
        )
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name,
        phone=user_data.phone,
        department=user_data.department,
        position=user_data.position,
        hashed_password=hashed_password,
        role=role_name,
        permissions={}
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


def _username_from_email(email: str) -> str:
    """Extract username as part before @ (e.g. user@cg-bd.com -> user)."""
    if not email or "@" not in email:
        return ""
    return email.strip().split("@")[0].strip()


def _find_header_index(headers: List[str], names: List[str]) -> int:
    """Return 0-based column index for first matching header (case-insensitive, stripped)."""
    normalized = [h.strip().lower() if h else "" for h in headers]
    keys = {n.strip().lower() for n in names}
    for i, h in enumerate(normalized):
        if h in keys:
            return i
    return -1


@router.get("/bulk-upload/template")
def download_bulk_upload_template(
    current_user: User = Depends(get_current_admin_user),
):
    """Download Excel template for bulk user upload (admin only)."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Users"
    ws.append(TEMPLATE_HEADERS)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=bulk_users_template.xlsx"},
    )


@router.post("/bulk-upload")
def bulk_upload_users(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
) -> dict:
    """Bulk create users from Excel. Default password: 123456. Columns: Employee Name, Designation, Function, Email (Official)/Email (Offical), Username (optional, derived from email if missing)."""
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be .xlsx",
        )

    content = file.file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")

    try:
        wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        wb.close()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Excel file: {str(e)}",
        )

    if len(rows) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must have a header row and at least one data row",
        )

    headers = [str(c).strip() if c is not None else "" for c in rows[0]]
    idx_name = _find_header_index(headers, ["Employee Name"])
    idx_desig = _find_header_index(headers, ["Designation"])
    idx_func = _find_header_index(headers, ["Function"])
    idx_email = _find_header_index(headers, EMAIL_COL_VARIANTS)
    idx_username = _find_header_index(headers, ["Username"])
    idx_role = _find_header_index(headers, ["Role"])
    idx_password = _find_header_index(headers, ["Password"])

    if idx_email < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing 'Email (Official)' or 'Email (Offical)' column",
        )

    created: List[dict] = []
    skipped: List[dict] = []
    errors: List[dict] = []

    def _cell(row: tuple, i: int) -> str:
        if i < 0 or i >= len(row):
            return ""
        v = row[i]
        return (str(v).strip() if v is not None else "") or ""

    for row_idx, row in enumerate(rows[1:], start=2):
        raw = tuple(row) if isinstance(row, (list, tuple)) else (row,)
        
        email = _cell(raw, idx_email)
        email_raw = email  # Keep original for error messages
        
        # Skip rows where email is empty (likely empty/invalid rows)
        if not email or not email.strip():
            # Only report as error if at least one other field has data (partial row)
            has_other_data = (
                (idx_name >= 0 and _cell(raw, idx_name)) or
                (idx_desig >= 0 and _cell(raw, idx_desig)) or
                (idx_func >= 0 and _cell(raw, idx_func))
            )
            if has_other_data:
                errors.append({"row": row_idx, "reason": "Missing or empty email", "email_value": "(empty)"})
            continue
        
        if "@" not in email:
            errors.append({"row": row_idx, "reason": f"Invalid email format (missing @): {email_raw}", "email_value": email_raw})
            continue

        email = email.strip().lower()
        
        # Validate email format more strictly
        if not email or len(email.split("@")) != 2:
            errors.append({"row": row_idx, "reason": f"Invalid email format: {email_raw}", "email_value": email_raw})
            continue
        
        username = _cell(raw, idx_username) if idx_username >= 0 else ""
        if not username:
            username = _username_from_email(email)
        else:
            username = username.strip()
        if not username:
            errors.append({"row": row_idx, "reason": f"Could not derive username from email: {email_raw}", "email_value": email_raw})
            continue

        full_name = _cell(raw, idx_name) if idx_name >= 0 else ""
        position = _cell(raw, idx_desig) if idx_desig >= 0 else ""
        department = _cell(raw, idx_func) if idx_func >= 0 else ""
        role_raw = _cell(raw, idx_role) if idx_role >= 0 else ""
        role = "admin" if role_raw.strip().lower() == "admin" else "user"
        password_raw = _cell(raw, idx_password) if idx_password >= 0 else ""
        password = password_raw if password_raw else BULK_DEFAULT_PASSWORD
        hashed = get_password_hash(password)

        existing_email = db.query(User).filter(User.email == email).first()
        if existing_email:
            skipped.append({"row": row_idx, "email": email, "reason": "Email already registered"})
            continue
        existing_username = db.query(User).filter(User.username == username).first()
        if existing_username:
            skipped.append({"row": row_idx, "username": username, "reason": "Username already taken"})
            continue

        try:
            u = User(
                email=email,
                username=username,
                full_name=full_name or None,
                phone=None,
                department=department or None,
                position=position or None,
                hashed_password=hashed,
                role=role,
                permissions={},
            )
            db.add(u)
            db.commit()
            db.refresh(u)
            created.append({"row": row_idx, "email": email, "username": username})
        except Exception as e:
            db.rollback()
            errors.append({"row": row_idx, "email": email, "reason": str(e)})

    return {
        "created": len(created),
        "skipped": len(skipped),
        "errors": len(errors),
        "details": {"created": created, "skipped": skipped, "errors": errors},
    }


@router.post("/bulk-delete")
def bulk_delete_users(
    body: BulkDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Delete multiple users (admin only). Skips self, admins, and non-existent IDs."""
    deleted = 0
    skipped = []
    for uid in body.user_ids:
        if uid == current_user.id:
            skipped.append({"id": uid, "reason": "Cannot delete your own account"})
            continue
        user = db.query(User).filter(User.id == uid).first()
        if not user:
            skipped.append({"id": uid, "reason": "User not found"})
            continue
        if user.role == "admin":
            skipped.append({"id": uid, "reason": "Cannot delete admin users"})
            continue
        db.delete(user)
        deleted += 1
    db.commit()
    return {"deleted": deleted, "skipped": skipped}


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Get a specific user (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Update a user (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update fields if provided
    if user_data.email is not None:
        # Check if new email is already taken
        existing = db.query(User).filter(
            User.email == user_data.email,
            User.id != user_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use"
            )
        user.email = user_data.email
    
    if user_data.username is not None:
        # Check if new username is already taken
        existing = db.query(User).filter(
            User.username == user_data.username,
            User.id != user_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already in use"
            )
        user.username = user_data.username
    
    if user_data.full_name is not None:
        user.full_name = user_data.full_name
    
    if user_data.phone is not None:
        user.phone = user_data.phone
    
    if user_data.department is not None:
        user.department = user_data.department
    
    if user_data.position is not None:
        user.position = user_data.position
    
    if user_data.password is not None:
        user.hashed_password = get_password_hash(user_data.password)
    
    if user_data.role is not None and user_data.role.strip():
        _ensure_default_roles(db)
        rn = user_data.role.strip()
        role_exists = db.query(Role).filter(Role.name == rn).first() is not None
        if not role_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role '{rn}' not found. Create it in Role Management first."
            )
        user.role = rn
    
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    
    db.commit()
    db.refresh(user)
    
    return user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Delete a user (admin only)."""
    # Prevent admin from deleting themselves
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent deletion of admin users (protect all admin accounts)
    if user.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete admin users"
        )
    
    db.delete(user)
    db.commit()
    
    return {"message": "User deleted successfully"}


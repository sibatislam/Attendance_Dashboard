"""Role management endpoints (admin only). Roles define modules and menus (features) users can access."""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Role, User
from ..auth import get_current_admin_user

router = APIRouter()

# Default permissions structure matching frontend MODULES + ATTENDANCE/TEAMS_PERMISSIONS
DEFAULT_ADMIN_PERMISSIONS = {
    "attendance_dashboard": {
        "enabled": True,
        "features": ["dashboard", "on_time", "work_hour", "work_hour_lost", "leave_analysis", "upload", "batches", "export"],
    },
    "teams_dashboard": {
        "enabled": True,
        "features": ["user_activity", "upload_activity", "activity_batches", "app_activity", "upload_app", "app_batches", "employee_list", "license_entry", "license_edit", "export"],
    },
}

DEFAULT_USER_PERMISSIONS = {
    "attendance_dashboard": {"enabled": True, "features": ["dashboard"]},
    "teams_dashboard": {"enabled": False, "features": []},
}


class RoleCreate(BaseModel):
    name: str
    permissions: Dict[str, Any]


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    permissions: Optional[Dict[str, Any]] = None


class RoleResponse(BaseModel):
    id: int
    name: str
    permissions: Dict[str, Any]

    class Config:
        from_attributes = True


def _ensure_default_roles(db: Session) -> None:
    """Create default admin and user roles if they don't exist."""
    for name, perms in [("admin", DEFAULT_ADMIN_PERMISSIONS), ("user", DEFAULT_USER_PERMISSIONS)]:
        r = db.query(Role).filter(Role.name == name).first()
        if not r:
            r = Role(name=name, permissions=perms)
            db.add(r)
    db.commit()


def get_permissions_for_role(db: Session, role_name: str) -> Dict[str, Any]:
    """Resolve permissions from Role by name. Ensures default roles exist."""
    _ensure_default_roles(db)
    r = db.query(Role).filter(Role.name == role_name).first()
    if r and r.permissions:
        return r.permissions
    if role_name == "admin":
        return DEFAULT_ADMIN_PERMISSIONS
    return DEFAULT_USER_PERMISSIONS


@router.get("/", response_model=List[RoleResponse])
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """List all roles. Ensures default admin/user roles exist."""
    _ensure_default_roles(db)
    roles = db.query(Role).order_by(Role.name).all()
    return [RoleResponse(id=r.id, name=r.name, permissions=r.permissions or {}) for r in roles]


@router.get("/{role_id}", response_model=RoleResponse)
def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Get a role by ID."""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    return RoleResponse(id=role.id, name=role.name, permissions=role.permissions or {})


@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    body: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Create a new role. Name must be unique."""
    _ensure_default_roles(db)
    existing = db.query(Role).filter(Role.name == body.name.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role with name '{body.name}' already exists",
        )
    role = Role(name=body.name.strip(), permissions=body.permissions)
    db.add(role)
    db.commit()
    db.refresh(role)
    return RoleResponse(id=role.id, name=role.name, permissions=role.permissions or {})


@router.put("/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: int,
    body: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Update a role. Cannot rename admin/user; can update their permissions."""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    if body.name is not None and body.name.strip() != role.name:
        if role.name in ("admin", "user"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot rename built-in role '{role.name}'",
            )
        existing = db.query(Role).filter(Role.name == body.name.strip()).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role with name '{body.name}' already exists",
            )
        role.name = body.name.strip()
    if body.permissions is not None:
        role.permissions = body.permissions
    db.commit()
    db.refresh(role)
    return RoleResponse(id=role.id, name=role.name, permissions=role.permissions or {})


@router.delete("/{role_id}")
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Delete a role. Cannot delete admin or user."""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    if role.name in ("admin", "user"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete built-in role '{role.name}'",
        )
    # Check if any user has this role
    count = db.query(User).filter(User.role == role.name).count()
    if count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete role: {count} user(s) have this role. Reassign them first.",
        )
    db.delete(role)
    db.commit()
    return {"message": "Role deleted successfully"}

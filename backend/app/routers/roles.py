"""Role management endpoints (admin only). Roles define modules and menus (features) users can access."""
import copy
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Role, User
from ..auth import get_current_admin_user

router = APIRouter()

# Full list of attendance features: menus, tabs, and views (function/department/company/location)
ATTENDANCE_ALL_FEATURES = [
    "dashboard", "attendance_recognition", "weekly_dashboard", "user_wise",
    # User Wise sub-menus (independent from standalone menu items)
    "user_wise_on_time", "user_wise_work_hour", "user_wise_work_hour_lost", "user_wise_work_hour_lost_cost", "user_wise_leave_analysis", "user_wise_od_analysis",
    "on_time", "work_hour", "work_hour_lost", "leave_analysis", "od_analysis", "weekly_analysis",
    "upload", "batches", "export",
    # Dashboard-specific tabs
    "dashboard_tab_function", "dashboard_tab_company", "dashboard_tab_location",
    # Weekly Dashboard-specific tabs
    "weekly_dashboard_tab_function", "weekly_dashboard_tab_company", "weekly_dashboard_tab_location", "weekly_dashboard_tab_department",
    # Legacy tabs (for backward compatibility)
    "tab_function", "tab_department", "tab_company", "tab_location",
    "view_function_wise", "view_department_wise", "view_company_wise", "view_location_wise",
]

# Full list of teams features: menus and tabs
TEAMS_ALL_FEATURES = [
    "user_activity", "upload_activity", "activity_batches",
    "app_activity", "upload_app", "app_batches",
    "employee_list", "license_entry", "license_edit", "teams_user_list", "export",
    "tab_user_wise", "tab_function_wise", "tab_company_wise", "tab_cxo",
]

# Default permissions structure matching frontend MODULES + ATTENDANCE/TEAMS_PERMISSIONS
DEFAULT_ADMIN_PERMISSIONS = {
    "attendance_dashboard": {"enabled": True, "features": ATTENDANCE_ALL_FEATURES.copy()},
    "teams_dashboard": {"enabled": True, "features": TEAMS_ALL_FEATURES.copy()},
}

DEFAULT_USER_PERMISSIONS = {
    "attendance_dashboard": {"enabled": True, "features": ["dashboard"]},
    "teams_dashboard": {"enabled": False, "features": []},
}

# N, N-1, N-2 roles: full access to all menus, tabs, and views (like admin)
DEFAULT_N_PERMISSIONS = {
    "attendance_dashboard": {"enabled": True, "features": ATTENDANCE_ALL_FEATURES.copy()},
    "teams_dashboard": {"enabled": True, "features": TEAMS_ALL_FEATURES.copy()},
}

BUILTIN_ROLE_NAMES = ("admin", "user", "N", "N-1", "N-2")


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
    """Create default admin, user, and N / N-1 / N-2 roles if they don't exist."""
    default_roles = [
        ("admin", DEFAULT_ADMIN_PERMISSIONS),
        ("user", DEFAULT_USER_PERMISSIONS),
        ("N", DEFAULT_N_PERMISSIONS),
        ("N-1", DEFAULT_N_PERMISSIONS),
        ("N-2", DEFAULT_N_PERMISSIONS),
    ]
    for name, perms in default_roles:
        r = db.query(Role).filter(Role.name == name).first()
        if not r:
            r = Role(name=name, permissions=copy.deepcopy(perms))
            db.add(r)
    db.commit()


def _is_n_level_role(name: str) -> bool:
    """Check if role name is N, N-1, N-2, N-3, etc."""
    import re
    return name == "N" or bool(re.match(r"^N-\d+$", name))


def get_permissions_for_role(db: Session, role_name: str) -> Dict[str, Any]:
    """Resolve permissions from Role by name. Ensures default roles exist.
    When a role row exists in DB, always use its saved permissions (so edited N/N-1/N-2 tab restrictions apply).
    Only use DEFAULT_* when the role does not exist."""
    _ensure_default_roles(db)
    r = db.query(Role).filter(Role.name == role_name).first()
    if r is not None:
        return r.permissions if r.permissions is not None else {}
    if role_name == "admin":
        return DEFAULT_ADMIN_PERMISSIONS
    if _is_n_level_role(role_name):
        return DEFAULT_N_PERMISSIONS
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
        if role.name in BUILTIN_ROLE_NAMES or _is_n_level_role(role.name):
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
    if role.name in BUILTIN_ROLE_NAMES or _is_n_level_role(role.name):
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

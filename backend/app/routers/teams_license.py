"""Teams License management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import TeamsLicense, User
from ..auth import get_current_user
from .roles import get_permissions_for_role

router = APIRouter()


class LicenseUpdate(BaseModel):
    total_teams: int
    total_assigned: int
    free: int = None  # Optional: auto-calculated if not provided
    per_license_cost: float | None = None  # Cost per license (e.g. per year); null = not set
    ciplc_license: int = 0
    cbl_license: int = 0


class LicenseResponse(BaseModel):
    total_teams: int
    total_assigned: int
    free: int
    per_license_cost: float | None = None
    ciplc_license: int = 0
    cbl_license: int = 0

    class Config:
        from_attributes = True


def _get_or_create_license(db: Session) -> TeamsLicense:
    """Get existing license record or create default one."""
    license = db.query(TeamsLicense).first()
    if not license:
        license = TeamsLicense(total_teams=0, total_assigned=0, free=0, ciplc_license=0, cbl_license=0)
        db.add(license)
        db.commit()
        db.refresh(license)
    return license


@router.get("/", response_model=LicenseResponse)
def get_license(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get Teams license values. Accessible to anyone with teams_dashboard module access."""
    # Check if user has access to teams_dashboard module
    if current_user.role != "admin":
        perms = get_permissions_for_role(db, current_user.role or "user")
        teams_perms = perms.get("teams_dashboard", {})
        
        # Allow access if teams_dashboard module is enabled (license cards are informational)
        if not teams_perms.get("enabled", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to Teams dashboard"
            )
    
    license = _get_or_create_license(db)
    return LicenseResponse(
        total_teams=license.total_teams,
        total_assigned=license.total_assigned,
        free=license.free,
        per_license_cost=getattr(license, 'per_license_cost', None),
        ciplc_license=getattr(license, 'ciplc_license', 0) or 0,
        cbl_license=getattr(license, 'cbl_license', 0) or 0,
    )


@router.put("/", response_model=LicenseResponse)
def update_license(
    body: LicenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update Teams license values. Requires license_edit permission."""
    # Check permission - resolve from role
    if current_user.role != "admin":
        perms = get_permissions_for_role(db, current_user.role or "user")
        teams_perms = perms.get("teams_dashboard", {})
        features = teams_perms.get("features", [])
        
        if "license_edit" not in features:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to edit license values"
            )
    
    license = _get_or_create_license(db)
    
    # Update values
    license.total_teams = body.total_teams
    license.total_assigned = body.total_assigned
    
    # Calculate free if not provided
    if body.free is not None:
        license.free = body.free
    else:
        license.free = max(0, body.total_teams - body.total_assigned)
    
    if hasattr(license, 'per_license_cost'):
        license.per_license_cost = body.per_license_cost if body.per_license_cost is not None else None
    if hasattr(license, 'ciplc_license'):
        license.ciplc_license = body.ciplc_license if body.ciplc_license is not None else 0
    if hasattr(license, 'cbl_license'):
        license.cbl_license = body.cbl_license if body.cbl_license is not None else 0

    license.updated_by = current_user.id
    db.commit()
    db.refresh(license)

    return LicenseResponse(
        total_teams=license.total_teams,
        total_assigned=license.total_assigned,
        free=license.free,
        per_license_cost=getattr(license, 'per_license_cost', None),
        ciplc_license=getattr(license, 'ciplc_license', 0) or 0,
        cbl_license=getattr(license, 'cbl_license', 0) or 0,
    )

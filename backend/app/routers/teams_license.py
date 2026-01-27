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


class LicenseResponse(BaseModel):
    total_teams: int
    total_assigned: int
    free: int

    class Config:
        from_attributes = True


def _get_or_create_license(db: Session) -> TeamsLicense:
    """Get existing license record or create default one."""
    license = db.query(TeamsLicense).first()
    if not license:
        license = TeamsLicense(total_teams=0, total_assigned=0, free=0)
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
        free=license.free
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
    
    license.updated_by = current_user.id
    db.commit()
    db.refresh(license)
    
    return LicenseResponse(
        total_teams=license.total_teams,
        total_assigned=license.total_assigned,
        free=license.free
    )

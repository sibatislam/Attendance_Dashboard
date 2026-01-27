"""Authentication endpoints for login and registration."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..schemas import LoginRequest, LoginResponse, UserCreate, UserResponse
from ..auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
)
from .roles import get_permissions_for_role

router = APIRouter()


def _user_to_response(user: User, db: Session):
    """Build user dict with permissions from Role for API response."""
    perms = get_permissions_for_role(db, user.role or "user")
    if not isinstance(perms, dict):
        perms = {}
    return {
        "id": user.id,
        "email": user.email or "",
        "username": user.username or "",
        "full_name": user.full_name,
        "phone": user.phone,
        "department": user.department,
        "position": user.position,
        "role": user.role or "user",
        "is_active": user.is_active,
        "permissions": perms,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
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
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name,
        hashed_password=hashed_password,
        role="user"  # Default role
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


@router.post("/login", response_model=LoginResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """Login endpoint - returns JWT token."""
    # Find user by username
    user = db.query(User).filter(User.username == credentials.username).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify password
    if not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    # Create access token (sub must be a string)
    access_token = create_access_token(data={"sub": str(user.id)})
    user_resp = _user_to_response(user, db)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_resp
    }


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current authenticated user information. Permissions resolved from Role."""
    u = db.query(User).filter(User.id == current_user.id).first()
    return _user_to_response(u or current_user, db)


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    """Logout endpoint (client should delete token)."""
    return {"message": "Successfully logged out"}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UpdateProfileRequest(BaseModel):
    password: str = None  # Optional: only if changing password
    current_password: str = None  # Required if password is provided
    position: str = None  # Designation
    department: str = None  # Function


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change current user's password."""
    # Verify current password
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Update password
    current_user.hashed_password = get_password_hash(body.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}


@router.put("/profile", response_model=UserResponse)
def update_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update current user's profile (password and/or designation)."""
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # If password is being changed, verify current password
    if body.password:
        if not body.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is required to change password"
            )
        if not verify_password(body.current_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
        user.hashed_password = get_password_hash(body.password)
    
    # Update designation (position)
    if body.position is not None:
        user.position = body.position
    
    # Update function (department)
    if body.department is not None:
        user.department = body.department
    
    db.commit()
    db.refresh(user)
    return _user_to_response(user, db)


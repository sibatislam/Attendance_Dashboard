from datetime import datetime
from typing import List, Any, Dict, Optional
from pydantic import BaseModel, EmailStr


class UploadedFileBase(BaseModel):
    filename: str
    uploaded_at: datetime
    header_order: List[str]

    class Config:
        from_attributes = True


class UploadedFileListItem(BaseModel):
    id: int
    filename: str
    uploaded_at: datetime
    total_rows: int
    from_month: Optional[str] = None
    to_month: Optional[str] = None

    class Config:
        from_attributes = True


class UploadedFileDetail(BaseModel):
    id: int
    filename: str
    uploaded_at: datetime
    header_order: List[str]
    rows: List[Dict[str, Any]]
    from_month: Optional[str] = None
    to_month: Optional[str] = None


class UploadResponseItem(BaseModel):
    id: int
    filename: str
    uploaded_at: datetime
    total_rows: int


class DeleteRequest(BaseModel):
    file_ids: List[int]

class DeleteResponse(BaseModel):
    deleted_count: int


# ===== Authentication Schemas =====

class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None


class UserCreate(UserBase):
    password: str
    role: Optional[str] = "user"
    permissions: Optional[Dict[str, Any]] = None
    employee_email: Optional[str] = None
    data_scope_level: Optional[str] = None
    allowed_functions: Optional[List[str]] = None
    allowed_departments: Optional[List[str]] = None
    allowed_companies: Optional[List[str]] = None


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    permissions: Optional[Dict[str, Any]] = None
    employee_email: Optional[str] = None
    data_scope_level: Optional[str] = None  # "N", "N-1", "N-2", ... or null
    allowed_functions: Optional[List[str]] = None
    allowed_departments: Optional[List[str]] = None
    allowed_companies: Optional[List[str]] = None


class UserResponse(UserBase):
    id: int
    role: str
    is_active: bool
    permissions: Optional[Dict[str, Any]] = None
    employee_email: Optional[str] = None
    data_scope_level: Optional[str] = None
    allowed_functions: Optional[List[str]] = None
    allowed_departments: Optional[List[str]] = None
    allowed_companies: Optional[List[str]] = None
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse



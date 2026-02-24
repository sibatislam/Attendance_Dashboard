from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.dialects.mysql import JSON as MySQLJSON
from sqlalchemy.orm import relationship
from datetime import datetime

from .db import Base


class UploadedFile(Base):
    __tablename__ = "uploaded_file"

    id = Column(Integer, primary_key=True, autoincrement=True)
    filename = Column(String(255), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    header_order = Column(MySQLJSON, nullable=False)

    rows = relationship(
        "UploadedRow",
        back_populates="file",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class UploadedRow(Base):
    __tablename__ = "uploaded_row"

    id = Column(Integer, primary_key=True, autoincrement=True)
    file_id = Column(Integer, ForeignKey("uploaded_file.id", ondelete="CASCADE"), nullable=False)
    data = Column(MySQLJSON, nullable=False)

    file = relationship("UploadedFile", back_populates="rows")


class FunctionKPI(Base):
    __tablename__ = "function_kpi"

    id = Column(Integer, primary_key=True, autoincrement=True)
    month = Column(String(7), nullable=False)  # YYYY-MM
    group_value = Column(String(255), nullable=False)  # Function Name
    members = Column(Integer, nullable=False)
    present = Column(Integer, nullable=False)
    late = Column(Integer, nullable=False)
    on_time = Column(Integer, nullable=False)
    on_time_pct = Column(String(16), nullable=False)  # store as string to avoid float issues
    computed_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class CompanyKPI(Base):
    __tablename__ = "company_kpi"

    id = Column(Integer, primary_key=True, autoincrement=True)
    month = Column(String(7), nullable=False)
    group_value = Column(String(255), nullable=False)  # Company Name
    members = Column(Integer, nullable=False)
    present = Column(Integer, nullable=False)
    late = Column(Integer, nullable=False)
    on_time = Column(Integer, nullable=False)
    on_time_pct = Column(String(16), nullable=False)
    computed_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class LocationKPI(Base):
    __tablename__ = "location_kpi"

    id = Column(Integer, primary_key=True, autoincrement=True)
    month = Column(String(7), nullable=False)
    group_value = Column(String(255), nullable=False)  # Job Location
    members = Column(Integer, nullable=False)
    present = Column(Integer, nullable=False)
    late = Column(Integer, nullable=False)
    on_time = Column(Integer, nullable=False)
    on_time_pct = Column(String(16), nullable=False)
    computed_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Role(Base):
    """Roles define which modules and menus (features) a user can access."""
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    permissions = Column(MySQLJSON, nullable=False, default=dict)  # { attendance_dashboard: {...}, teams_dashboard: {...} }
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(String(50), nullable=False, default="user")  # admin (special) or role name from roles table
    is_active = Column(Boolean, default=True, nullable=False)
    # Data scope: link to employee list by email; level N = all, N-1 = function + depts, N-2 = department only
    employee_email = Column(String(255), nullable=True, index=True)  # match Email (Official) in employee list
    data_scope_level = Column(String(20), nullable=True)  # "N", "N-1", "N-2", ... or null = no scope filter
    # Multi-select: user can see data for these (empty = only own from employee). Admin can add more.
    allowed_functions = Column(MySQLJSON, nullable=True, default=list)   # ["Function A", "Function B"]
    allowed_departments = Column(MySQLJSON, nullable=True, default=list)
    allowed_companies = Column(MySQLJSON, nullable=True, default=list)
    phone = Column(String(20), nullable=True)
    department = Column(String(100), nullable=True)
    position = Column(String(100), nullable=True)
    permissions = Column(MySQLJSON, nullable=True, default=dict)  # Legacy; role-based perms take precedence
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


# ===== MS Teams Models =====

class TeamsUploadedFile(Base):
    __tablename__ = "teams_uploaded_file"

    id = Column(Integer, primary_key=True, autoincrement=True)
    filename = Column(String(255), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    header_order = Column(MySQLJSON, nullable=False)
    from_month = Column(String(7), nullable=True)  # YYYY-MM format
    to_month = Column(String(7), nullable=True)    # YYYY-MM format

    rows = relationship(
        "TeamsUploadedRow",
        back_populates="file",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class TeamsUploadedRow(Base):
    __tablename__ = "teams_uploaded_row"

    id = Column(Integer, primary_key=True, autoincrement=True)
    file_id = Column(Integer, ForeignKey("teams_uploaded_file.id", ondelete="CASCADE"), nullable=False)
    data = Column(MySQLJSON, nullable=False)

    file = relationship("TeamsUploadedFile", back_populates="rows")


# ===== Employee List Models =====

class EmployeeUploadedFile(Base):
    __tablename__ = "employee_uploaded_file"

    id = Column(Integer, primary_key=True, autoincrement=True)
    filename = Column(String(255), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    header_order = Column(MySQLJSON, nullable=False)

    rows = relationship(
        "EmployeeUploadedRow",
        back_populates="file",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class EmployeeUploadedRow(Base):
    __tablename__ = "employee_uploaded_row"

    id = Column(Integer, primary_key=True, autoincrement=True)
    file_id = Column(Integer, ForeignKey("employee_uploaded_file.id", ondelete="CASCADE"), nullable=False)
    data = Column(MySQLJSON, nullable=False)

    file = relationship("EmployeeUploadedFile", back_populates="rows")


# ===== Teams App Usage Models =====

class TeamsAppUploadedFile(Base):
    __tablename__ = "teams_app_uploaded_file"

    id = Column(Integer, primary_key=True, autoincrement=True)
    filename = Column(String(255), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    header_order = Column(MySQLJSON, nullable=False)
    from_month = Column(String(50), nullable=True)
    to_month = Column(String(50), nullable=True)

    rows = relationship(
        "TeamsAppUploadedRow",
        back_populates="file",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class TeamsAppUploadedRow(Base):
    __tablename__ = "teams_app_uploaded_row"

    id = Column(Integer, primary_key=True, autoincrement=True)
    file_id = Column(Integer, ForeignKey("teams_app_uploaded_file.id", ondelete="CASCADE"), nullable=False)
    data = Column(MySQLJSON, nullable=False)

    file = relationship("TeamsAppUploadedFile", back_populates="rows")


# ===== CXO Users Model =====

class CXOUser(Base):
    __tablename__ = "cxo_users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ===== App Config (key-value for CTC per hour, etc.) =====

class AppConfig(Base):
    """Key-value store for app-wide settings (e.g. average CTC per employee per hour in BDT)."""
    __tablename__ = "app_config"

    key = Column(String(255), primary_key=True)  # e.g. "ctc_per_hour_bdt" or "ctc_per_hour_bdt:Function Name"
    value = Column(String(512), nullable=True)


# ===== Teams User List (latest upload snapshot for Teams/CBL_Teams Excel) =====

class TeamsUserListUpload(Base):
    """Stores the latest Teams User List upload (Teams + CBL_Teams sheets) so the list persists in DB."""
    __tablename__ = "teams_user_list_upload"

    id = Column(Integer, primary_key=True, autoincrement=True)
    filename = Column(String(255), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    total_assigned = Column(Integer, nullable=False, default=0)
    by_sheet = Column(MySQLJSON, nullable=True)  # e.g. {"Teams": 100, "CBL_Teams": 53}
    total_teams = Column(Integer, nullable=False, default=0)
    free = Column(Integer, nullable=False, default=0)
    rows = Column(MySQLJSON, nullable=True)  # list of dicts: S.No, Sheet, Name, Email, etc.


# ===== Teams License Settings Model =====

class TeamsLicense(Base):
    """Stores Teams license settings (shared across all users)."""
    __tablename__ = "teams_license"

    id = Column(Integer, primary_key=True, autoincrement=True)
    total_teams = Column(Integer, nullable=False, default=0)
    total_assigned = Column(Integer, nullable=False, default=0)
    free = Column(Integer, nullable=False, default=0)
    per_license_cost = Column(Float, nullable=True)  # Cost per license (e.g. per year); null = not set
    ciplc_license = Column(Integer, nullable=False, default=0)  # CIPLC license count
    cbl_license = Column(Integer, nullable=False, default=0)  # CBL license count
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # Track who last updated

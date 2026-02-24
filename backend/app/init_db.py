"""Initialize database with default admin user and default roles."""

def _ensure_user_columns(engine):
    """Add employee_email and data_scope_level to users table if missing (migration)."""
    from sqlalchemy import text
    with engine.connect() as conn:
        r = conn.execute(text("""
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
        """))
        existing = {row[0] for row in r}
        if "employee_email" not in existing:
            conn.execute(text("ALTER TABLE users ADD COLUMN employee_email VARCHAR(255) NULL"))
            conn.execute(text("CREATE INDEX ix_users_employee_email ON users (employee_email)"))
            conn.commit()
            print("✓ users.employee_email column added")
        if "data_scope_level" not in existing:
            conn.execute(text("ALTER TABLE users ADD COLUMN data_scope_level VARCHAR(20) NULL"))
            conn.commit()
            print("✓ users.data_scope_level column added")
        for col in ("allowed_functions", "allowed_departments", "allowed_companies"):
            if col not in existing:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} JSON NULL"))
                conn.commit()
                print(f"✓ users.{col} column added")


def _ensure_teams_license_columns(engine):
    """Add per_license_cost, ciplc_license, cbl_license to teams_license table if missing."""
    from sqlalchemy import text
    with engine.connect() as conn:
        tables = conn.execute(text("""
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teams_license'
        """))
        if not tables.fetchone():
            return  # Table not created yet (e.g. first run)
        r = conn.execute(text("""
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teams_license'
        """))
        existing = {row[0] for row in r}
        if "per_license_cost" not in existing:
            conn.execute(text("ALTER TABLE teams_license ADD COLUMN per_license_cost DOUBLE NULL"))
            conn.commit()
            print("✓ teams_license.per_license_cost column added")
        if "ciplc_license" not in existing:
            conn.execute(text("ALTER TABLE teams_license ADD COLUMN ciplc_license INT NOT NULL DEFAULT 0"))
            conn.commit()
            print("✓ teams_license.ciplc_license column added")
        if "cbl_license" not in existing:
            conn.execute(text("ALTER TABLE teams_license ADD COLUMN cbl_license INT NOT NULL DEFAULT 0"))
            conn.commit()
            print("✓ teams_license.cbl_license column added")


def init_db():
    """Create tables, default roles, and default admin user if not exists."""
    try:
        from sqlalchemy.orm import Session
        from .db import SessionLocal, engine
        from .models import User, Role
        from .auth import get_password_hash
    except ImportError as e:
        print(f"⚠ Import error in init_db: {e}")
        return

    try:
        _ensure_user_columns(engine)
    except Exception as e:
        print(f"⚠ User columns migration skipped or failed: {e}")

    try:
        _ensure_teams_license_columns(engine)
    except Exception as e:
        print(f"⚠ teams_license columns migration skipped or failed: {e}")

    db: Session = SessionLocal()
    try:
        # Ensure default roles exist (admin, user, N, N-1, N-2)
        from .routers.roles import _ensure_default_roles
        _ensure_default_roles(db)
        print("✓ Default roles (admin, user, N, N-1, N-2) ensured")

        # Create default admin user if not exists
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            admin_user = User(
                email="admin@example.com",
                username="admin",
                full_name="System Administrator",
                hashed_password=get_password_hash("admin123"),
                role="admin",
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            print("✓ Default admin user created (username: admin, password: admin123)")
        else:
            print("✓ Admin user already exists")
    except Exception as e:
        print(f"⚠ Error in init_db: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    init_db()

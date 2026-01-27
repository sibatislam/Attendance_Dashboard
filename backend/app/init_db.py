"""Initialize database with default admin user and default roles."""

def init_db():
    """Create tables, default roles, and default admin user if not exists."""
    try:
        from sqlalchemy.orm import Session
        from .db import SessionLocal
        from .models import User, Role
        from .auth import get_password_hash
    except ImportError as e:
        print(f"⚠ Import error in init_db: {e}")
        return

    db: Session = SessionLocal()
    try:
        # Ensure default roles exist (admin, user)
        _default_admin_perms = {
            "attendance_dashboard": {"enabled": True, "features": ["dashboard", "on_time", "work_hour", "work_hour_lost", "leave_analysis", "upload", "batches", "export"]},
            "teams_dashboard": {"enabled": True, "features": ["user_activity", "upload_activity", "activity_batches", "app_activity", "upload_app", "app_batches", "employee_list", "export"]},
        }
        _default_user_perms = {
            "attendance_dashboard": {"enabled": True, "features": ["dashboard"]},
            "teams_dashboard": {"enabled": False, "features": []},
        }
        for name, perms in [("admin", _default_admin_perms), ("user", _default_user_perms)]:
            r = db.query(Role).filter(Role.name == name).first()
            if not r:
                db.add(Role(name=name, permissions=perms))
        db.commit()
        print("✓ Default roles (admin, user) ensured")

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

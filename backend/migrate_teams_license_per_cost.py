"""Add per_license_cost column to teams_license table if missing."""
from sqlalchemy import create_engine, text
from sqlalchemy.inspection import inspect
import os
from dotenv import load_dotenv

load_dotenv()

DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3310")
DB_NAME = os.getenv("DB_NAME", "attendance_db")

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL)


def migrate():
    inspector = inspect(engine)
    if "teams_license" not in inspector.get_table_names():
        print("✓ Table teams_license does not exist yet (will be created with model)")
        return
    columns = [c["name"] for c in inspector.get_columns("teams_license")]
    if "per_license_cost" in columns:
        print("✓ Column per_license_cost already exists")
        return
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE teams_license ADD COLUMN per_license_cost DOUBLE NULL"))
        conn.commit()
    print("✓ Added per_license_cost column to teams_license")


if __name__ == "__main__":
    migrate()

"""One-time migration: extend app_config.key from VARCHAR(64) to VARCHAR(255) for function-wise CTC keys.
Run from backend directory: python migrate_app_config_key.py
"""
import os
import sys

# Ensure backend is on path so "app" resolves
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from app.db import engine
    from sqlalchemy import text
except ImportError as e:
    print("Run from backend directory. Missing:", e)
    sys.exit(1)

def main():
    with engine.connect() as conn:
        r = conn.execute(text("""
            SELECT CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_config' AND COLUMN_NAME = 'key'
        """))
        row = r.fetchone()
        if not row:
            print("Table app_config or column 'key' not found. Skipping.")
            return
        current_len = row[0]
        if current_len and current_len >= 255:
            print("app_config.key already long enough:", current_len)
            return
        print("Altering app_config.key to VARCHAR(255)...")
        conn.execute(text("ALTER TABLE app_config MODIFY COLUMN `key` VARCHAR(255) NOT NULL"))
        conn.commit()
        print("Done. app_config.key is now VARCHAR(255).")

if __name__ == "__main__":
    main()

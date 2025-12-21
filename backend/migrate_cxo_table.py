"""Migration script to create cxo_users table and seed initial CXO emails"""
import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

# Database connection
connection = pymysql.connect(
    host=os.getenv("DB_HOST", "localhost"),
    user=os.getenv("DB_USER", "root"),
    password=os.getenv("DB_PASSWORD", ""),
    database=os.getenv("DB_NAME", "attendance_db"),
    port=int(os.getenv("DB_PORT", 3310))
)

# Initial CXO emails from the image
INITIAL_CXO_EMAILS = [
    "monsur.alam@cg-bd.com",
    "luxmi.kant@cg-bd.com",
    "jahangir.alam@cg-bd.com",
    "irina.const@cg-bd.com",
    "lipon.hossain@cg-bd.com",
    "adeeb.aziz@cg-bd.com",
    "salman.karim@cg-bd.com",
    "shahid.islam@cg-bd.com",
    "pervin.sultana@cg-bd.com",
    "johurul.islam@cg-bd.com",
    "moshi.rahman@cg-bd.com",
    "rakib.islam@cg-bd.com",
    "dibarul.alam@cg-bd.com",
    "arman.sarker@cg-bd.com",
    "karar.rabib@cg-bd.com",
]

try:
    with connection.cursor() as cursor:
        # Check if table exists
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = %s AND table_name = 'cxo_users'
        """, (os.getenv("DB_NAME", "attendance_db"),))
        
        table_exists = cursor.fetchone()[0] > 0
        
        if not table_exists:
            print("Creating 'cxo_users' table...")
            cursor.execute("""
                CREATE TABLE cxo_users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_email (email)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            print("✓ Created 'cxo_users' table")
        else:
            print("✓ Table 'cxo_users' already exists")
        
        # Insert initial CXO emails (only if they don't exist)
        inserted_count = 0
        for email in INITIAL_CXO_EMAILS:
            try:
                cursor.execute("""
                    INSERT INTO cxo_users (email) 
                    VALUES (%s)
                """, (email.lower(),))
                inserted_count += 1
                print(f"  ✓ Added CXO: {email}")
            except pymysql.IntegrityError:
                # Email already exists, skip
                print(f"  - Skipped (already exists): {email}")
        
        connection.commit()
        print(f"\n✓ Migration completed. Inserted {inserted_count} new CXO users.")
        
except Exception as e:
    print(f"✗ Error during migration: {e}")
    connection.rollback()
finally:
    connection.close()

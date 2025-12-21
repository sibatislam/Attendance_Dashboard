"""Script to rebuild all KPIs for all uploaded files."""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal
from app.models import UploadedFile
from app.services.kpi_calculator import calculate_kpis_for_file
from app.models_kpi import OnTimeKPI, WorkHourKPI, WorkHourLostKPI, LeaveAnalysisKPI

def rebuild_all_kpis():
    """Rebuild KPIs for all uploaded files."""
    db = SessionLocal()
    
    try:
        print("="*80)
        print("Rebuilding All KPIs")
        print("="*80)
        
        # Clear existing KPI data
        print("\n[1/3] Clearing existing KPI data...")
        deleted_ontime = db.query(OnTimeKPI).delete()
        deleted_workhour = db.query(WorkHourKPI).delete()
        deleted_lost = db.query(WorkHourLostKPI).delete()
        deleted_leave = db.query(LeaveAnalysisKPI).delete()
        db.commit()
        print(f"   Deleted: {deleted_ontime} OnTime, {deleted_workhour} WorkHour, "
              f"{deleted_lost} Lost, {deleted_leave} Leave records")
        
        # Get all uploaded files
        print("\n[2/3] Fetching all uploaded files...")
        files = db.query(UploadedFile).order_by(UploadedFile.id).all()
        print(f"   Found {len(files)} files")
        
        # Calculate KPIs for each file
        print("\n[3/3] Calculating KPIs for each file...")
        calculated_count = 0
        for idx, file in enumerate(files, 1):
            try:
                print(f"   [{idx}/{len(files)}] Processing file ID {file.id}: {file.filename}...", end=" ")
                calculate_kpis_for_file(db, file.id)
                calculated_count += 1
                print("[OK]")
            except Exception as e:
                print(f"[ERROR] {e}")
                db.rollback()
                continue
        
        print("\n" + "="*80)
        print(f"[SUCCESS] Successfully calculated KPIs for {calculated_count} out of {len(files)} files")
        print("="*80)
        print("\nAll charts should now show data for all months!")
        print("Refresh your dashboard to see the updated data.")
        
    except Exception as e:
        print(f"\n[ERROR] {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    rebuild_all_kpis()

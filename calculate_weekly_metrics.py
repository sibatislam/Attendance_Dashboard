#!/usr/bin/env python3
"""Calculate weekly metrics for Bidding & Contract, 1st week November 2025"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.database import SessionLocal
from app.models import UploadedRow
from app.services.weekly_analysis import _parse_date, _compute_duration_hours

db = SessionLocal()
try:
    rows = db.query(UploadedRow).all()
    print(f'Total rows in database: {len(rows)}')
    
    # Filter for Bidding & Contract, 1st week of November 2025
    target_records = []
    for row in rows:
        if not isinstance(row.data, dict):
            continue
        data = row.data
        
        # Check function name
        func = str(data.get('Function Name', '')).strip()
        if 'Bidding' not in func and 'Contract' not in func:
            continue
        
        # Check date - November 2025, 1st week (days 1-7)
        date_str = str(data.get('Attendance Date', '')).strip()
        if not date_str:
            continue
        
        parsed_date = _parse_date(date_str)
        if not parsed_date:
            continue
        
        # Check if November 2025
        if parsed_date.year != 2025 or parsed_date.month != 11:
            continue
        
        # Check if 1st week (days 1-7)
        if parsed_date.day < 1 or parsed_date.day > 7:
            continue
        
        # Get shift and work times
        shift_in = str(data.get('Shift In Time', '')).strip()
        shift_out = str(data.get('Shift Out Time', '')).strip()
        in_time = str(data.get('In Time', '')).strip()
        out_time = str(data.get('Out Time', '')).strip()
        flag = str(data.get('Flag', '')).strip()
        emp_code = str(data.get('Employee Code', '')).strip()
        emp_name = str(data.get('Name', '')).strip()
        
        target_records.append({
            'date': date_str,
            'parsed_date': parsed_date,
            'day': parsed_date.day,
            'shift_in': shift_in,
            'shift_out': shift_out,
            'in_time': in_time,
            'out_time': out_time,
            'flag': flag,
            'emp_code': emp_code,
            'emp_name': emp_name,
        })
    
    print(f'\nFound {len(target_records)} records for Bidding & Contract, 1st week November 2025')
    
    if target_records:
        # Sort by day, then by employee
        target_records.sort(key=lambda x: (x['day'], x['emp_code'] or x['emp_name']))
        
        # Calculate metrics
        shift_hours_sum = 0.0
        work_hours_sum = 0.0
        completed_count = 0
        total_work_days = 0
        lost_hours_sum = 0.0
        
        print('\nDay-by-Day Calculation:')
        print('=' * 120)
        current_day = None
        day_shift = 0.0
        day_work = 0.0
        day_completed = 0
        day_lost = 0.0
        
        for r in target_records:
            shift_hours = _compute_duration_hours(r['shift_in'], r['shift_out'])
            work_hours = _compute_duration_hours(r['in_time'], r['out_time'])
            
            if shift_hours > 0 or work_hours > 0:
                shift_hours_sum += shift_hours
                work_hours_sum += work_hours
                total_work_days += 1
                
                # Check if completed
                if (r['flag'] == 'P' or r['flag'] == 'OD') and work_hours >= shift_hours and shift_hours > 0:
                    completed_count += 1
                
                # Calculate lost hours
                if shift_hours > 0 and work_hours < shift_hours:
                    lost_hours = shift_hours - work_hours
                    lost_hours_sum += lost_hours
                    status = f'LOST: {lost_hours:.2f}h'
                else:
                    status = 'COMPLETED'
                
                emp_id = r['emp_code'] or r['emp_name'][:20]
                print(f'Day {r["day"]:2d} | {r["date"][:15]:15s} | Emp: {emp_id:20s} | Shift={shift_hours:5.2f}h | Work={work_hours:5.2f}h | Flag={r["flag"]:3s} | {status}')
        
        print('=' * 120)
        print(f'\nSUMMARY for 1st Week November 2025 - Bidding & Contract:')
        print(f'Total Work Days: {total_work_days}')
        print(f'Shift Hours: {shift_hours_sum:.2f} hours')
        print(f'Work Hours: {work_hours_sum:.2f} hours')
        print(f'Work Hour Completed: {completed_count} days')
        if total_work_days > 0:
            print(f'Completion %: {(completed_count / total_work_days * 100):.2f}%')
        else:
            print(f'Completion %: 0.00%')
        print(f'Lost Hours: {lost_hours_sum:.2f} hours')
        if shift_hours_sum > 0:
            print(f'Lost %: {(lost_hours_sum / shift_hours_sum * 100):.2f}%')
        else:
            print(f'Lost %: 0.00%')
    else:
        print('\nNo records found. Checking what data exists...')
        # Sample some records to see what we have
        sample_count = 0
        for row in rows[:100]:
            if not isinstance(row.data, dict):
                continue
            data = row.data
            func = str(data.get('Function Name', '')).strip()
            date_str = str(data.get('Attendance Date', '')).strip()
            if func and date_str:
                parsed = _parse_date(date_str)
                if parsed:
                    print(f'Sample: Function={func[:40]:40s}, Date={date_str[:20]:20s}, Parsed={parsed.strftime("%Y-%m-%d")}')
                else:
                    print(f'Sample: Function={func[:40]:40s}, Date={date_str[:20]:20s}, Parsed=None')
                sample_count += 1
                if sample_count >= 10:
                    break
finally:
    db.close()

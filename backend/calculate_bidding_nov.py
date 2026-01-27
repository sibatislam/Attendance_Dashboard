#!/usr/bin/env python3
"""Calculate weekly metrics for Bidding & Contract, 1st week November 2025"""
from app.db import SessionLocal
from app.models import UploadedRow
from app.services.weekly_analysis import _parse_date, _compute_duration_hours, _get_company_short_name

db = SessionLocal()
try:
    rows = db.query(UploadedRow).all()
    
    # Filter for Bidding & Contract, 1st week November 2025 (days 1-7)
    target_records = []
    for row in rows:
        if not isinstance(row.data, dict):
            continue
        data = row.data
        
        # Check function (same logic as weekly_analysis.py)
        func = str(data.get('Function Name', '')).strip()
        company = str(data.get('Company Name', '') or data.get('Comapny Name', '')).strip()
        company_short = _get_company_short_name(company)
        if company_short and func:
            group_val = f"{company_short} - {func}"
        elif func:
            group_val = func
        else:
            group_val = company_short or "Unknown"
        
        if 'Bidding' not in group_val and 'Contract' not in group_val:
            continue
        
        # Check date
        date_str = str(data.get('Attendance Date', '')).strip()
        if not date_str:
            continue
        
        parsed_date = _parse_date(date_str)
        if not parsed_date:
            continue
        
        if parsed_date.year != 2025 or parsed_date.month != 11:
            continue
        
        if parsed_date.day < 1 or parsed_date.day > 7:
            continue
        
        shift_in = str(data.get('Shift In Time', '')).strip()
        shift_out = str(data.get('Shift Out Time', '')).strip()
        in_time = str(data.get('In Time', '')).strip()
        out_time = str(data.get('Out Time', '')).strip()
        flag = str(data.get('Flag', '')).strip()
        emp_code = str(data.get('Employee Code', '')).strip()
        emp_name = str(data.get('Name', '')).strip()
        
        target_records.append({
            'day': parsed_date.day,
            'date': date_str,
            'shift_in': shift_in,
            'shift_out': shift_out,
            'in_time': in_time,
            'out_time': out_time,
            'flag': flag,
            'emp': emp_code or emp_name[:20],
        })
    
    print(f'Found {len(target_records)} records for Bidding & Contract, 1st week November 2025\n')
    
    # Calculate using same logic as weekly_analysis.py
    shift_hours_sum = 0.0
    work_hours_sum = 0.0
    completed_count = 0
    total_work_days = 0
    lost_hours_sum = 0.0
    
    target_records.sort(key=lambda x: (x['day'], x['emp']))
    
    print('Day-by-Day Calculation:')
    print('=' * 110)
    for r in target_records:
        # Skip weekends and holidays (Flag="W" or "H")
        if r['flag'] == 'W' or r['flag'] == 'H':
            print(f'Day {r["day"]:2d} | {r["date"][:15]:15s} | Emp: {r["emp"][:20]:20s} | SKIPPED (Weekend/Holiday) | Flag={r["flag"]:3s}')
            continue
        
        shift_hours = _compute_duration_hours(r['shift_in'], r['shift_out'])
        work_hours = _compute_duration_hours(r['in_time'], r['out_time'])
        
        if shift_hours > 0 or work_hours > 0:
            shift_hours_sum += shift_hours
            work_hours_sum += work_hours
            total_work_days += 1
            
            if (r['flag'] == 'P' or r['flag'] == 'OD') and work_hours >= shift_hours and shift_hours > 0:
                completed_count += 1
            
            if shift_hours > 0 and work_hours < shift_hours:
                lost_hours = shift_hours - work_hours
                lost_hours_sum += lost_hours
                status = f'LOST: {lost_hours:.2f}h'
            else:
                status = 'COMPLETED'
            
            print(f'Day {r["day"]:2d} | {r["date"][:15]:15s} | Emp: {r["emp"][:20]:20s} | Shift={shift_hours:5.2f}h | Work={work_hours:5.2f}h | Flag={r["flag"]:3s} | {status}')
    
    print('=' * 110)
    print(f'\nCALCULATED METRICS:')
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
    
    print(f'\nAPI RESULT (for comparison):')
    print(f'Shift Hours: 252.0')
    print(f'Work Hours: 190.23')
    print(f'Work Hour Completed: 14')
    print(f'Completion %: 50.0%')
    print(f'Lost Hours: 77.96')
    print(f'Lost %: 30.94%')
    
finally:
    db.close()

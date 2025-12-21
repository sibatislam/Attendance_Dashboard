"""MS Teams analytics endpoints for dashboard charts."""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import TeamsUploadedFile, TeamsUploadedRow, EmployeeUploadedFile, EmployeeUploadedRow, CXOUser
from ..auth import get_current_user

router = APIRouter()


@router.get("/user-activity")
def get_user_activity(
    file_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get user-wise activity data from uploaded files.
    Returns activity metrics for each user.
    """
    # Get files
    if file_id:
        files = db.query(TeamsUploadedFile).filter(TeamsUploadedFile.id == file_id).all()
    else:
        files = db.query(TeamsUploadedFile).order_by(TeamsUploadedFile.uploaded_at.desc()).all()
    
    if not files:
        return []
    
    result = []
    
    for file in files:
        # Get all rows for this file
        rows = db.query(TeamsUploadedRow).filter(TeamsUploadedRow.file_id == file.id).all()
        
        for row in rows:
            data = row.data
            
            # Extract user email from User Principal Name
            user_email = data.get('User Principal Name', 'Unknown')
            
            # Create user activity record
            user_activity = {
                'file_id': file.id,
                'filename': file.filename,
                'from_month': file.from_month,
                'to_month': file.to_month,
                'month_range': f"{file.from_month} to {file.to_month}" if file.from_month and file.to_month else file.from_month or file.to_month or 'N/A',
                'user': user_email,
                'Team Chat': 0,
                'Private Chat': 0,
                'Calls': 0,
                'Meetings Org': 0,
                'Meetings Att': 0,
                'One-time Org': 0,
                'One-time Att': 0,
                'Recurring Org': 0,
                'Recurring Att': 0,
                'Post Messages': 0,
            }
            
            # Extract metrics (convert to int, default to 0)
            try:
                user_activity['Team Chat'] = int(data.get('Team Chat Message Count', 0) or 0)
            except (ValueError, TypeError):
                pass
            
            try:
                user_activity['Private Chat'] = int(data.get('Private Chat Message Count', 0) or 0)
            except (ValueError, TypeError):
                pass
            
            try:
                user_activity['Calls'] = int(data.get('Call Count', 0) or 0)
            except (ValueError, TypeError):
                pass
            
            try:
                user_activity['Meetings Org'] = int(data.get('Meetings Organized Count', 0) or 0)
            except (ValueError, TypeError):
                pass
            
            try:
                user_activity['Meetings Att'] = int(data.get('Meetings Attended Count', 0) or 0)
            except (ValueError, TypeError):
                pass
            
            try:
                user_activity['One-time Org'] = int(data.get('Scheduled One-time Meetings Organized Count', 0) or 0)
            except (ValueError, TypeError):
                pass
            
            try:
                user_activity['One-time Att'] = int(data.get('Scheduled One-time Meetings Attended Count', 0) or 0)
            except (ValueError, TypeError):
                pass
            
            try:
                user_activity['Recurring Org'] = int(data.get('Scheduled Recurring Meetings Organized Count', 0) or 0)
            except (ValueError, TypeError):
                pass
            
            try:
                user_activity['Recurring Att'] = int(data.get('Scheduled Recurring Meetings Attended Count', 0) or 0)
            except (ValueError, TypeError):
                pass
            
            try:
                user_activity['Post Messages'] = int(data.get('Post Messages', 0) or 0)
            except (ValueError, TypeError):
                pass
            
            result.append(user_activity)
        
        return result


@router.get("/function-activity")
def get_function_activity(
    teams_file_id: Optional[int] = Query(None),
    employee_file_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get Function-wise activity data by matching Teams data with Employee data.
    Matches User Principal Name (Teams) with Email (Official) (Employee).
    """
    # Get Teams files
    if teams_file_id:
        teams_files = db.query(TeamsUploadedFile).filter(TeamsUploadedFile.id == teams_file_id).all()
    else:
        teams_files = db.query(TeamsUploadedFile).order_by(TeamsUploadedFile.uploaded_at.desc()).all()
    
    # Get Employee files
    if employee_file_id:
        employee_files = db.query(EmployeeUploadedFile).filter(EmployeeUploadedFile.id == employee_file_id).all()
    else:
        employee_files = db.query(EmployeeUploadedFile).order_by(EmployeeUploadedFile.uploaded_at.desc()).all()
    
    if not teams_files or not employee_files:
        return []
    
    # Build email to employee data mapping
    email_to_employee = {}
    for emp_file in employee_files:
        emp_rows = db.query(EmployeeUploadedRow).filter(EmployeeUploadedRow.file_id == emp_file.id).all()
        for row in emp_rows:
            data = row.data
            email = data.get('Email (Offical)', '').strip().lower()
            if email:
                email_to_employee[email] = {
                    'function': data.get('Function', 'Unknown'),
                    'company': data.get('Company', 'Unknown')
                }
    
    # Aggregate by Function
    function_data = {}
    
    for teams_file in teams_files:
        teams_rows = db.query(TeamsUploadedRow).filter(TeamsUploadedRow.file_id == teams_file.id).all()
        
        for row in teams_rows:
            data = row.data
            user_email = data.get('User Principal Name', '').strip().lower()
            
            # Match with employee data
            if user_email in email_to_employee:
                function = email_to_employee[user_email]['function']
                
                if function not in function_data:
                    function_data[function] = {
                        'function': function,
                        'Team Chat': 0,
                        'Private Chat': 0,
                        'Calls': 0,
                        'Meetings Org': 0,
                        'Meetings Att': 0,
                        'One-time Org': 0,
                        'One-time Att': 0,
                        'Recurring Org': 0,
                        'Recurring Att': 0,
                        'Post Messages': 0,
                    }
                
                # Aggregate activities
                try:
                    function_data[function]['Team Chat'] += int(data.get('Team Chat Message Count', 0) or 0)
                except (ValueError, TypeError):
                    pass
                
                try:
                    function_data[function]['Private Chat'] += int(data.get('Private Chat Message Count', 0) or 0)
                except (ValueError, TypeError):
                    pass
                
                try:
                    function_data[function]['Calls'] += int(data.get('Call Count', 0) or 0)
                except (ValueError, TypeError):
                    pass
                
                try:
                    function_data[function]['Meetings Org'] += int(data.get('Meetings Organized Count', 0) or 0)
                except (ValueError, TypeError):
                    pass
                
                try:
                    function_data[function]['Meetings Att'] += int(data.get('Meetings Attended Count', 0) or 0)
                except (ValueError, TypeError):
                    pass
                
                try:
                    function_data[function]['One-time Org'] += int(data.get('Scheduled One-time Meetings Organized Count', 0) or 0)
                except (ValueError, TypeError):
                    pass
                
                try:
                    function_data[function]['One-time Att'] += int(data.get('Scheduled One-time Meetings Attended Count', 0) or 0)
                except (ValueError, TypeError):
                    pass
                
                try:
                    function_data[function]['Recurring Org'] += int(data.get('Scheduled Recurring Meetings Organized Count', 0) or 0)
                except (ValueError, TypeError):
                    pass
                
                try:
                    function_data[function]['Recurring Att'] += int(data.get('Scheduled Recurring Meetings Attended Count', 0) or 0)
                except (ValueError, TypeError):
                    pass
                
                try:
                    function_data[function]['Post Messages'] += int(data.get('Post Messages', 0) or 0)
                except (ValueError, TypeError):
                    pass
    
    return list(function_data.values())


@router.get("/company-activity")
def get_company_activity(
    teams_file_id: Optional[int] = Query(None),
    employee_file_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get Company-wise activity data by matching Teams data with Employee data.
    Matches User Principal Name (Teams) with Email (Official) (Employee).
    """
    # Get Teams files
    if teams_file_id:
        teams_files = db.query(TeamsUploadedFile).filter(TeamsUploadedFile.id == teams_file_id).all()
    else:
        teams_files = db.query(TeamsUploadedFile).order_by(TeamsUploadedFile.uploaded_at.desc()).all()
    
    # Get Employee files
    if employee_file_id:
        employee_files = db.query(EmployeeUploadedFile).filter(EmployeeUploadedFile.id == employee_file_id).all()
    else:
        employee_files = db.query(EmployeeUploadedFile).order_by(EmployeeUploadedFile.uploaded_at.desc()).all()
    
    if not teams_files or not employee_files:
        return []
    
    # Build email to employee data mapping
    email_to_employee = {}
    for emp_file in employee_files:
        emp_rows = db.query(EmployeeUploadedRow).filter(EmployeeUploadedRow.file_id == emp_file.id).all()
        for row in emp_rows:
            data = row.data
            email = data.get('Email (Offical)', '').strip().lower()
            if email:
                email_to_employee[email] = {
                    'function': data.get('Function', 'Unknown'),
                    'company': data.get('Company', 'Unknown')
                }
    
    # Aggregate by Company
    company_data = {}
    
    for teams_file in teams_files:
        teams_rows = db.query(TeamsUploadedRow).filter(TeamsUploadedRow.file_id == teams_file.id).all()
        
        for row in teams_rows:
            data = row.data
            user_email = data.get('User Principal Name', '').strip().lower()
            
            # Match with employee data
            if user_email in email_to_employee:
                company = email_to_employee[user_email]['company']
                
                if company not in company_data:
                    company_data[company] = {
                        'company': company,
                        'Team Chat': 0,
                        'Private Chat': 0,
                        'Calls': 0,
                        'Meetings Org': 0,
                        'Meetings Att': 0,
                        'One-time Org': 0,
                        'One-time Att': 0,
                        'Recurring Org': 0,
                        'Recurring Att': 0,
                        'Post Messages': 0,
                    }
                
                # Aggregate activities
                try:
                    company_data[company]['Team Chat'] += int(data.get('Team Chat Message Count', 0) or 0)
                except (ValueError, TypeError):
                    pass
                
                try:
                    company_data[company]['Private Chat'] += int(data.get('Private Chat Message Count', 0) or 0)
                except (ValueError, TypeError):
                    pass
                
                try:
                    company_data[company]['Calls'] += int(data.get('Call Count', 0) or 0)
                except (ValueError, TypeError):
                    pass
                
                try:
                    company_data[company]['Meetings Org'] += int(data.get('Meetings Organized Count', 0) or 0)
                except (ValueError, TypeError):
                    pass
                
                try:
                    company_data[company]['Meetings Att'] += int(data.get('Meetings Attended Count', 0) or 0)
                except (ValueError, TypeError):
                    pass
                
                try:
                    company_data[company]['One-time Org'] += int(data.get('Scheduled One-time Meetings Organized Count', 0) or 0)
                except (ValueError, TypeError):
                    pass
                
                try:
                    company_data[company]['One-time Att'] += int(data.get('Scheduled One-time Meetings Attended Count', 0) or 0)
                except (ValueError, TypeError):
                    pass
                
                try:
                    company_data[company]['Recurring Org'] += int(data.get('Scheduled Recurring Meetings Organized Count', 0) or 0)
                except (ValueError, TypeError):
                    pass
                
                try:
                    company_data[company]['Recurring Att'] += int(data.get('Scheduled Recurring Meetings Attended Count', 0) or 0)
                except (ValueError, TypeError):
                    pass
                
                try:
                    company_data[company]['Post Messages'] += int(data.get('Post Messages', 0) or 0)
                except (ValueError, TypeError):
                    pass
    
    return list(company_data.values())


@router.get("/cxo-activity")
def get_cxo_activity(
    file_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get CXO user activity data from uploaded files.
    Only returns activity for users marked as CXO.
    """
    # Get list of CXO emails
    cxo_users = db.query(CXOUser).all()
    cxo_emails = {cxo.email.lower() for cxo in cxo_users}
    
    if not cxo_emails:
        return []
    
    # Get files
    if file_id:
        files = db.query(TeamsUploadedFile).filter(TeamsUploadedFile.id == file_id).all()
    else:
        files = db.query(TeamsUploadedFile).order_by(TeamsUploadedFile.uploaded_at.desc()).all()
    
    if not files:
        return []
    
    result = []
    
    for file in files:
        # Get all rows for this file
        rows = db.query(TeamsUploadedRow).filter(TeamsUploadedRow.file_id == file.id).all()
        
        for row in rows:
            data = row.data
            
            # Extract user email from User Principal Name
            user_email = data.get('User Principal Name', 'Unknown').strip().lower()
            
            # Only include if user is a CXO
            if user_email not in cxo_emails:
                continue
            
            # Create user activity record
            user_activity = {
                'file_id': file.id,
                'filename': file.filename,
                'from_month': file.from_month,
                'to_month': file.to_month,
                'month_range': f"{file.from_month} to {file.to_month}" if file.from_month and file.to_month else file.from_month or file.to_month or 'N/A',
                'user': user_email,
                'Team Chat': 0,
                'Private Chat': 0,
                'Calls': 0,
                'Meetings Org': 0,
                'Meetings Att': 0,
                'One-time Org': 0,
                'One-time Att': 0,
                'Recurring Org': 0,
                'Recurring Att': 0,
                'Post Messages': 0,
            }
            
            # Extract metrics (convert to int, default to 0)
            try:
                user_activity['Team Chat'] = int(data.get('Team Chat Message Count', 0) or 0)
            except (ValueError, TypeError):
                pass
            
            try:
                user_activity['Private Chat'] = int(data.get('Private Chat Message Count', 0) or 0)
            except (ValueError, TypeError):
                pass
            
            try:
                user_activity['Calls'] = int(data.get('Call Count', 0) or 0)
            except (ValueError, TypeError):
                pass
            
            try:
                user_activity['Meetings Org'] = int(data.get('Meetings Organized Count', 0) or 0)
            except (ValueError, TypeError):
                pass
            
            try:
                user_activity['Meetings Att'] = int(data.get('Meetings Attended Count', 0) or 0)
            except (ValueError, TypeError):
                pass
            
            try:
                user_activity['One-time Org'] = int(data.get('Scheduled One-time Meetings Organized Count', 0) or 0)
            except (ValueError, TypeError):
                pass
            
            try:
                user_activity['One-time Att'] = int(data.get('Scheduled One-time Meetings Attended Count', 0) or 0)
            except (ValueError, TypeError):
                pass
            
            try:
                user_activity['Recurring Org'] = int(data.get('Scheduled Recurring Meetings Organized Count', 0) or 0)
            except (ValueError, TypeError):
                pass
            
            try:
                user_activity['Recurring Att'] = int(data.get('Scheduled Recurring Meetings Attended Count', 0) or 0)
            except (ValueError, TypeError):
                pass
            
            try:
                user_activity['Post Messages'] = int(data.get('Post Messages', 0) or 0)
            except (ValueError, TypeError):
                pass
            
            result.append(user_activity)
        
        return result


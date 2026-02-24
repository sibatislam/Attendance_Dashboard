"""
Script to generate Function-wise summary for all months from Attendance Summary.xlsx
The input file is already aggregated by Month and Function.
"""
import pandas as pd
from datetime import datetime

def process_attendance_summary(input_file, output_file):
    """Process attendance summary and create function-wise summary with all months combined."""
    print(f"Reading {input_file}...")
    
    # Read the Excel file
    try:
        df = pd.read_excel(input_file)
    except Exception as e:
        print(f"Error reading file: {e}")
        return
    
    print(f"Total rows: {len(df)}")
    print(f"Columns: {list(df.columns)}")
    
    # Rename columns for clarity
    df_clean = df.copy()
    df_clean = df_clean.rename(columns={
        'Function': 'Function Name',
        'Members': 'Total Employees',
        'Present': 'Present Count',
        'Late': 'Late Count',
        'On Time': 'On Time Count',
        'On Time %': 'On Time Percentage'
    })
    
    # Group by Function Name and aggregate across all months
    summary = df_clean.groupby('Function Name').agg({
        'Total Employees': 'mean',  # Average employees per month
        'Present Count': 'sum',      # Total present days across all months
        'Late Count': 'sum',         # Total late days across all months
        'On Time Count': 'sum',      # Total on-time days across all months
        'On Time Percentage': 'mean'  # Average on-time percentage
    }).reset_index()
    
    # Round numeric columns
    summary['Total Employees'] = summary['Total Employees'].round(1)
    summary['Present Count'] = summary['Present Count'].round(0).astype(int)
    summary['Late Count'] = summary['Late Count'].round(0).astype(int)
    summary['On Time Count'] = summary['On Time Count'].round(0).astype(int)
    summary['On Time Percentage'] = summary['On Time Percentage'].round(2)
    
    # Calculate additional metrics
    summary['Total Work Days'] = summary['Present Count'] + summary['Late Count']
    summary['On Time Rate %'] = summary['On Time Percentage']
    summary['Late Rate %'] = (summary['Late Count'] / summary['Total Work Days'] * 100).round(2)
    summary['Late Rate %'] = summary['Late Rate %'].fillna(0)
    
    # Reorder columns
    result_df = summary[[
        'Function Name',
        'Total Employees',
        'Total Work Days',
        'Present Count',
        'On Time Count',
        'Late Count',
        'On Time Rate %',
        'Late Rate %'
    ]].copy()
    
    # Sort by Function Name
    result_df = result_df.sort_values('Function Name').reset_index(drop=True)
    
    # Write to Excel
    print(f"\nWriting results to {output_file}...")
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        result_df.to_excel(writer, sheet_name='Function Wise Summary', index=False)
        
        # Auto-adjust column widths
        worksheet = writer.sheets['Function Wise Summary']
        for idx, col in enumerate(result_df.columns):
            # Handle column letters beyond Z (AA, AB, etc.)
            if idx < 26:
                col_letter = chr(65 + idx)
            else:
                col_letter = chr(65 + (idx // 26) - 1) + chr(65 + (idx % 26))
            
            max_length = max(
                result_df[col].astype(str).map(len).max() if len(result_df) > 0 else 0,
                len(str(col))
            )
            worksheet.column_dimensions[col_letter].width = min(max_length + 2, 50)
    
    print(f"\nSummary created successfully!")
    print(f"Total functions: {len(result_df)}")
    print(f"\nOutput saved to: {output_file}")
    print(f"\nSummary includes combined data from all months:")
    print(f"  - Average employees per month")
    print(f"  - Total present days across all months")
    print(f"  - Total on-time days across all months")
    print(f"  - Total late days across all months")
    print(f"  - Average on-time percentage")


if __name__ == "__main__":
    input_file = "Attendance Summary.xlsx"
    output_file = "Function_Wise_Summary_All_Months.xlsx"
    
    process_attendance_summary(input_file, output_file)

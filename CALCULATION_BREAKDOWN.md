# Calculation Breakdown for Dashboard and Weekly Dashboard

## General Rules

### Exclusions:
- **Weekends and Holidays are EXCLUDED** from all work hour calculations
- Records with Flag="W" (Weekend) or Flag="H" (Holiday) are skipped for:
  - Shift Hours
  - Work Hours
  - Work Hour Completed
  - Completion %
  - Lost Hours
  - Lost %

### Time Parsing:
- Times are parsed from formats: `HH:MM:SS`, `HH:MM`, `HH.MM`
- Converted to decimal hours (e.g., "09:30" = 9.5 hours)
- Overnight shifts are handled (e.g., 22:00 to 06:00 = 8 hours)

---

## Dashboard (Monthly Aggregation)

### Data Source:
- All attendance records grouped by **Month** and **Group** (Function/Company/Location)
- Uses services: `work_hour.py`, `work_hour_lost.py`, `kpi_calculator.py`

### 1. Shift Hours
**Formula**: Sum of all shift durations for work days only

**Calculation**:
```python
For each record (excluding Flag="W" or "H"):
    shift_hours = Shift Out Time - Shift In Time
    total_shift_hours += shift_hours
```

**Example**:
- 20 work days × 9 hours = 180 hours
- Excludes weekends/holidays

### 2. Work Hours
**Formula**: Sum of all actual work durations for work days only

**Calculation**:
```python
For each record (excluding Flag="W" or "H"):
    work_hours = Out Time - In Time
    total_work_hours += work_hours
```

**Example**:
- Sum of all (Out Time - In Time) for all work day records

### 3. Work Hour Completed
**Formula**: Count of days where work hours met or exceeded shift hours

**Calculation**:
```python
For each record (excluding Flag="W" or "H"):
    if (Flag == "P" or Flag == "OD") AND work_hours >= shift_hours AND shift_hours > 0:
        completed_count += 1
```

**Example**:
- If 14 out of 20 work days had work_hours >= shift_hours → 14 days completed

### 4. Completion %
**Formula**: `(Work Hour Completed / Total Work Days) × 100`

**Calculation**:
```python
completion_pct = (completed_count / total_work_days) × 100
```

**Example**:
- 14 completed days / 20 total work days = 70.0%

### 5. Lost Hours
**Formula**: Sum of hours lost when work hours < shift hours

**Calculation**:
```python
For each record (excluding Flag="W" or "H"):
    if shift_hours > 0 AND work_hours < shift_hours:
        lost_hours = shift_hours - work_hours
        total_lost_hours += lost_hours
```

**Example**:
- Day 2: 9.00h - 6.91h = 2.09h lost
- Day 3: 9.00h - 7.77h = 1.23h lost
- Day 5: (2.18 + 0.07 + 0.13)h = 2.38h lost
- Day 6: 9.00h - 8.74h = 0.26h lost
- Total: 5.96 hours lost

### 6. Lost %
**Formula**: `(Lost Hours / Shift Hours) × 100`

**Calculation**:
```python
lost_pct = (total_lost_hours / total_shift_hours) × 100
```

**Example**:
- 5.96 lost hours / 180.00 shift hours = 3.31%

---

## Weekly Dashboard (Weekly Aggregation)

### Data Source:
- All attendance records grouped by **Week** (within month) and **Group** (Function/Company/Location)
- Uses service: `weekly_analysis.py`
- Week calculation: Week 1 = days 1-7, Week 2 = days 8-14, Week 3 = days 15-21, Week 4 = days 22-28, Week 5 = days 29-31

### 1. Shift Hours
**Formula**: Sum of all shift durations for work days in the week only

**Calculation**:
```python
For each record in the week (excluding Flag="W" or "H"):
    shift_hours = Shift Out Time - Shift In Time
    shift_hours_sum[week_key] += shift_hours
```

**Example** (1st week November 2025 - Bidding & Contract):
- 20 work days × 9 hours = 180 hours
- Excludes: Day 1 (4 employees with W flag) and Day 7 (4 employees with W flag)

### 2. Work Hours
**Formula**: Sum of all actual work durations for work days in the week only

**Calculation**:
```python
For each record in the week (excluding Flag="W" or "H"):
    work_hours = Out Time - In Time
    work_hours_sum[week_key] += work_hours
```

**Example**:
- Sum of all (Out Time - In Time) for work day records in the week = 190.23 hours

### 3. Work Hour Completed
**Formula**: Count of days in the week where work hours met or exceeded shift hours

**Calculation**:
```python
For each record in the week (excluding Flag="W" or "H"):
    if (Flag == "P" or Flag == "OD") AND work_hours >= shift_hours AND shift_hours > 0:
        completed_count[week_key] += 1
```

**Example**:
- 14 days out of 20 work days had work_hours >= 9.0 hours

### 4. Completion %
**Formula**: `(Work Hour Completed / Total Work Days in Week) × 100`

**Calculation**:
```python
completion_pct = (completed_count / total_work_days) × 100
```

**Example**:
- 14 completed days / 20 total work days = 70.0%

### 5. Lost Hours
**Formula**: Sum of hours lost in the week when work hours < shift hours

**Calculation**:
```python
For each record in the week with Flag="P" or Flag="OD" only (exclude W, H, EL, A, L, etc.):
    if shift_hours > 0 AND work_hours < shift_hours:
        lost_hours = shift_hours - work_hours
        lost_hours_sum[week_key] += lost_hours
```

**Example** (1st week November 2025):
- Day 2: 2.09h lost (1 employee)
- Day 3: 1.23h lost (1 employee)
- Day 5: 2.38h lost (3 employees: 2.18 + 0.07 + 0.13)
- Day 6: 0.26h lost (1 employee)
- Total: 5.96 hours lost

### 6. Lost %
**Formula**: `(Lost Hours / Shift Hours) × 100`

**Calculation**:
```python
lost_pct = (lost_hours_sum / shift_hours_sum) × 100
```

**Example**:
- 5.96 lost hours / 180.00 shift hours = 3.31%

---

## Key Differences

### Dashboard (Monthly):
- Groups data by **Month** (e.g., "2025-11")
- Aggregates all days in the month
- Shows monthly trends

### Weekly Dashboard:
- Groups data by **Week within Month** (e.g., "2025-11-W01" = 1st week of November)
- Aggregates days 1-7, 8-14, 15-21, 22-28, 29-31 separately
- Shows weekly trends within each month

### Common Rules:
- Both exclude weekends/holidays (Flag="W" or "H")
- Both only count P (Present) and OD (On Duty) for work hour lost
- Both use same time calculation logic
- Both use same completion criteria (work_hours >= shift_hours for P/OD flags)
- Both calculate lost hours the same way

---

## Example Calculation: 1st Week November 2025 - Bidding & Contract

### Input Data:
- **Total Records**: 28 (4 employees × 7 days)
- **Weekend Days**: Day 1 (4 employees, Flag="W"), Day 7 (4 employees, Flag="W")
- **Work Days**: Days 2-6 (20 records)

### Calculations:

1. **Shift Hours**: 180.00 hours
   - 20 work days × 9 hours = 180 hours
   - Excludes 8 weekend records

2. **Work Hours**: 190.23 hours
   - Sum of all work durations from 20 work day records

3. **Work Hour Completed**: 14 days
   - Days where work_hours >= 9.0 hours
   - Day 2: 3 employees, Day 3: 3 employees, Day 4: 4 employees, Day 5: 1 employee, Day 6: 3 employees

4. **Completion %**: 70.00%
   - (14 / 20) × 100 = 70%

5. **Lost Hours**: 5.96 hours
   - Day 2: 2.09h, Day 3: 1.23h, Day 5: 2.38h, Day 6: 0.26h

6. **Lost %**: 3.31%
   - (5.96 / 180.00) × 100 = 3.31%

---

## Notes

- **Weekends/Holidays**: Always excluded from work hour metrics
- **Time Format**: Supports HH:MM:SS, HH:MM, HH.MM
- **Overnight Shifts**: Automatically handled (e.g., 22:00 to 06:00)
- **Flag Requirements**: Only P (Present) and OD (On Duty) flags count for completion
- **Empty Times**: Records with no shift/work times are excluded from calculations

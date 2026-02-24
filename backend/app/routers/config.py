"""App config API (e.g. average CTC per employee per hour for cost calculations)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..db import get_db
from ..auth import get_current_user
from ..models import User, AppConfig
from ..services.employee_hierarchy import get_scope_options

router = APIRouter()

CTC_PER_HOUR_KEY = "ctc_per_hour_bdt"
CTC_PER_HOUR_BY_FUNCTION_PREFIX = "ctc_per_hour_bdt:"


class CTCPerHourResponse(BaseModel):
    ctc_per_hour_bdt: float | None


class CTCPerHourUpdate(BaseModel):
    value: float


class CTCByFunctionResponse(BaseModel):
    functions: list[str]
    ctc_by_function: dict[str, float]


class CTCByFunctionUpdate(BaseModel):
    ctc_by_function: dict[str, float]


def _config_key_for_function(fn: str) -> str:
    """Key = prefix + function name; max 255 chars total."""
    prefix_len = len(CTC_PER_HOUR_BY_FUNCTION_PREFIX)
    safe = (fn or "").strip()[: 255 - prefix_len]
    return f"{CTC_PER_HOUR_BY_FUNCTION_PREFIX}{safe}"


@router.get("/ctc-per-hour", response_model=CTCPerHourResponse)
def get_ctc_per_hour(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get average CTC per employee per hour (BDT). Used as fallback when function-wise rate is missing."""
    row = db.query(AppConfig).filter(AppConfig.key == CTC_PER_HOUR_KEY).first()
    if not row or row.value is None or row.value == "":
        return CTCPerHourResponse(ctc_per_hour_bdt=None)
    try:
        return CTCPerHourResponse(ctc_per_hour_bdt=float(row.value))
    except (TypeError, ValueError):
        return CTCPerHourResponse(ctc_per_hour_bdt=None)


@router.put("/ctc-per-hour", response_model=CTCPerHourResponse)
def set_ctc_per_hour(
    body: CTCPerHourUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Set average CTC per employee per hour (BDT). Fallback when no function-wise rate."""
    if body.value < 0:
        raise HTTPException(status_code=400, detail="CTC per hour must be non-negative")
    row = db.query(AppConfig).filter(AppConfig.key == CTC_PER_HOUR_KEY).first()
    if row:
        row.value = str(body.value)
    else:
        db.add(AppConfig(key=CTC_PER_HOUR_KEY, value=str(body.value)))
    db.commit()
    return CTCPerHourResponse(ctc_per_hour_bdt=body.value)


@router.get("/ctc-per-hour-by-function", response_model=CTCByFunctionResponse)
def get_ctc_per_hour_by_function(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get list of functions (from employee list) and function-wise average CTC per employee per hour (BDT)."""
    scope = get_scope_options(db, None)
    full_functions = scope.get("functions") or []
    # Unique function names (ignore company for the list)
    names = sorted({(f.get("name") or f) if isinstance(f, dict) else str(f) for f in full_functions if f})
    # Load saved rates: keys ctc_per_hour_bdt:FunctionName
    rows = db.query(AppConfig).filter(AppConfig.key.like(f"{CTC_PER_HOUR_BY_FUNCTION_PREFIX}%")).all()
    ctc_by_function = {}
    for row in rows:
        if not row.value:
            continue
        fn = row.key[len(CTC_PER_HOUR_BY_FUNCTION_PREFIX) :].strip()
        if not fn:
            continue
        try:
            ctc_by_function[fn] = float(row.value)
        except (TypeError, ValueError):
            pass
    return CTCByFunctionResponse(functions=names, ctc_by_function=ctc_by_function)


@router.put("/ctc-per-hour-by-function", response_model=CTCByFunctionResponse)
def set_ctc_per_hour_by_function(
    body: CTCByFunctionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save function-wise average CTC per employee per hour (BDT)."""
    if body.ctc_by_function is None:
        body.ctc_by_function = {}
    for fn, val in (body.ctc_by_function or {}).items():
        if val is not None and (not isinstance(val, (int, float)) or val < 0):
            raise HTTPException(status_code=400, detail=f"CTC per hour for '{fn}' must be non-negative")
    # Remove old per-function keys
    db.query(AppConfig).filter(AppConfig.key.like(f"{CTC_PER_HOUR_BY_FUNCTION_PREFIX}%")).delete(synchronize_session=False)
    # Insert new values
    for fn, val in (body.ctc_by_function or {}).items():
        if fn is None or (isinstance(fn, str) and not fn.strip()):
            continue
        name = fn.strip() if isinstance(fn, str) else str(fn)
        if val is None:
            continue
        try:
            v = float(val)
            if v < 0:
                continue
        except (TypeError, ValueError):
            continue
        key = _config_key_for_function(name)
        db.add(AppConfig(key=key, value=str(v)))
    db.commit()
    scope = get_scope_options(db, None)
    full_functions = scope.get("functions") or []
    names = sorted({(f.get("name") or f) if isinstance(f, dict) else str(f) for f in full_functions if f})
    rows = db.query(AppConfig).filter(AppConfig.key.like(f"{CTC_PER_HOUR_BY_FUNCTION_PREFIX}%")).all()
    ctc_by_function = {}
    for row in rows:
        if not row.value:
            continue
        fn = row.key[len(CTC_PER_HOUR_BY_FUNCTION_PREFIX) :].strip()
        if fn:
            try:
                ctc_by_function[fn] = float(row.value)
            except (TypeError, ValueError):
                pass
    return CTCByFunctionResponse(functions=names, ctc_by_function=ctc_by_function)

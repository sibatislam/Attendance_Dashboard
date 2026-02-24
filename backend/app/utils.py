"""Shared utilities."""
from datetime import datetime, timezone


def datetime_to_iso_utc(dt):
    """
    Serialize a datetime to ISO 8601 string with UTC timezone.
    Naive datetimes (e.g. from MySQL DATETIME) are assumed to be UTC so that
    clients (e.g. JavaScript) parse them correctly and display in local time.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()

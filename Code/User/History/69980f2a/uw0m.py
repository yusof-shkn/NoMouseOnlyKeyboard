"""Date convenience helpers."""

from datetime import date, timedelta


def days_ago(n: int) -> str:
    return (date.today() - timedelta(days=n)).isoformat()


def days_ahead(n: int) -> str:
    return (date.today() + timedelta(days=n)).isoformat()

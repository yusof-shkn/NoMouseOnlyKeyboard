"""
Supabase client singleton and generic DB helpers.
Import helpers from here — never create the client directly in seeders.
"""

from __future__ import annotations

from typing import Any, cast

from postgrest.types import CountMethod  # type: ignore[import-untyped]
from supabase import Client, create_client

from config import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL

_client: Client | None = None

Row = dict[str, Any]


def get_client() -> Client:
    """Return a cached service-role Supabase client."""
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _client


# ── Generic helpers ───────────────────────────────────────────────────────────


def db_insert(table: str, data: Row | list[Row]) -> list[Row]:
    """Insert row(s). Returns inserted rows or []."""
    try:
        result = get_client().table(table).insert(data).execute()  # type: ignore[arg-type]
        return cast(list[Row], result.data or [])
    except Exception as exc:
        from src.utils.logger import log_warn

        log_warn(f"insert {table}: {exc}")
        return []


def db_upsert(
    table: str,
    data: Row | list[Row],
    on_conflict: str = "id",
) -> list[Row]:
    """Upsert row(s). Returns upserted rows or []."""
    try:
        result = (
            get_client()
            .table(table)
            .upsert(data, on_conflict=on_conflict)  # type: ignore[arg-type]
            .execute()
        )
        return cast(list[Row], result.data or [])
    except Exception as exc:
        from src.utils.logger import log_warn

        log_warn(f"upsert {table}: {exc}")
        return []


def db_fetch(
    table: str,
    company_id: int,
    filters: dict[str, Any] | None = None,
) -> list[Row]:
    """Fetch all rows for a given company, with optional extra filters."""
    try:
        q = get_client().table(table).select("*").eq("company_id", company_id)
        for col, val in (filters or {}).items():
            q = q.eq(col, val)
        return cast(list[Row], q.execute().data or [])
    except Exception as exc:
        from src.utils.logger import log_warn

        log_warn(f"fetch {table}: {exc}")
        return []


def db_count(table: str, company_id: int) -> int:
    """Exact row count for a company-scoped table."""
    try:
        r = (
            get_client()
            .table(table)
            .select("*", count=CountMethod.exact)
            .eq("company_id", company_id)
            .execute()
        )
        return r.count or 0
    except Exception:
        return 0

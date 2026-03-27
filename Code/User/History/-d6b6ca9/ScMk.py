"""
Copy master data from the template company (id=1) to a target company.

Replaces the missing copy_template_data_to_new_company() PostgreSQL RPC.
Copies: roles, role_permissions, chart_of_accounts,
        income_categories, expense_categories, categories, units.

All operations are idempotent (upsert on natural key or company_id+name).
"""

from __future__ import annotations

from typing import Any, cast

from postgrest.types import CountMethod  # type: ignore[import-untyped]

from config import TEMPLATE_COMPANY_ID
from src.utils import db_upsert, get_client, log_ok, log_section, log_step, log_warn

Row = dict[str, Any]


def _rows(raw: Any) -> list[Row]:
    """Safely cast Supabase response data to list[Row]."""
    return cast(list[Row], raw or [])


def _strip_id(row: Row, company_id: int) -> Row:
    """Return row without 'id', with company_id overridden."""
    return {k: v for k, v in row.items() if k != "id"} | {"company_id": company_id}


def copy_template_data(target_company_id: int) -> bool:
    """
    Copy all template master data to target_company_id.
    Returns True on full success, False if any section failed.
    """
    client = get_client()
    src = TEMPLATE_COMPANY_ID
    dst = target_company_id
    ok = True

    log_section(f"Copying template data  ->  company {dst}")

    # ── 1. Roles ──────────────────────────────────────────────────────────────
    log_step(1, 7, "Roles")
    try:
        src_roles = _rows(
            client.table("roles").select("*").eq("company_id", src).execute().data
        )
        if src_roles:
            new_roles = [_strip_id(row, dst) for row in src_roles]
            db_upsert("roles", new_roles, on_conflict="company_id,role_name")
            log_ok(f"  {len(new_roles)} roles copied.")
        else:
            log_warn("  No template roles found.")
    except Exception as e:
        log_warn(f"  Roles copy failed: {e}")
        ok = False

    # ── 2. Permissions (global – no company_id) ───────────────────────────────
    log_step(2, 7, "Permissions  (global - already shared)")
    try:
        count = (
            client.table("permissions")
            .select("*", count=CountMethod.exact)
            .execute()
            .count
            or 0
        )
        log_ok(f"  {count} permissions already available globally.")
    except Exception as e:
        log_warn(f"  Permissions check failed: {e}")

    # ── 3. Role permissions ───────────────────────────────────────────────────
    log_step(3, 7, "Role permissions")
    try:
        src_roles_data = _rows(
            client.table("roles")
            .select("id,role_name")
            .eq("company_id", src)
            .execute()
            .data
        )
        dst_roles_data = _rows(
            client.table("roles")
            .select("id,role_name")
            .eq("company_id", dst)
            .execute()
            .data
        )

        # Build name <-> id maps with explicit str/int casts
        src_name_to_id: dict[str, int] = {
            str(row["role_name"]): int(row["id"]) for row in src_roles_data
        }
        dst_name_to_id: dict[str, int] = {
            str(row["role_name"]): int(row["id"]) for row in dst_roles_data
        }
        src_id_to_name: dict[int, str] = {v: k for k, v in src_name_to_id.items()}

        all_rp = _rows(
            client.table("role_permissions")
            .select("role_id,permission_id")
            .in_("role_id", list(src_name_to_id.values()))
            .execute()
            .data
        )

        mappings: list[Row] = []
        for rp in all_rp:
            src_rid = int(rp["role_id"])
            role_name = src_id_to_name.get(src_rid)
            if role_name and role_name in dst_name_to_id:
                mappings.append(
                    {
                        "role_id": dst_name_to_id[role_name],
                        "permission_id": int(rp["permission_id"]),
                    }
                )

        for i in range(0, len(mappings), 200):
            db_upsert(
                "role_permissions",
                mappings[i : i + 200],
                on_conflict="role_id,permission_id",
            )
        log_ok(f"  {len(mappings)} role-permission mappings copied.")
    except Exception as e:
        log_warn(f"  Role permissions copy failed: {e}")
        ok = False

    # ── 4. Chart of accounts ──────────────────────────────────────────────────
    log_step(4, 7, "Chart of accounts")
    try:
        src_coa = _rows(
            client.table("chart_of_accounts")
            .select("*")
            .eq("company_id", src)
            .execute()
            .data
        )
        if src_coa:
            new_coa = [_strip_id(row, dst) for row in src_coa]
            db_upsert(
                "chart_of_accounts", new_coa, on_conflict="company_id,account_code"
            )
            log_ok(f"  {len(new_coa)} accounts copied.")
        else:
            log_warn("  No template COA found.")
    except Exception as e:
        log_warn(f"  COA copy failed: {e}")
        ok = False

    # ── 5. Income categories ──────────────────────────────────────────────────
    log_step(5, 7, "Income categories")
    try:
        src_ic = _rows(
            client.table("income_categories")
            .select("*")
            .eq("company_id", src)
            .execute()
            .data
        )
        if src_ic:
            new_ic = [_strip_id(row, dst) for row in src_ic]
            db_upsert(
                "income_categories", new_ic, on_conflict="company_id,category_code"
            )
            log_ok(f"  {len(new_ic)} income categories copied.")
    except Exception as e:
        log_warn(f"  Income categories copy failed: {e}")
        ok = False

    # ── 6. Expense categories ─────────────────────────────────────────────────
    log_step(6, 7, "Expense categories")
    try:
        src_ec = _rows(
            client.table("expense_categories")
            .select("*")
            .eq("company_id", src)
            .execute()
            .data
        )
        if src_ec:
            new_ec = [_strip_id(row, dst) for row in src_ec]
            db_upsert(
                "expense_categories", new_ec, on_conflict="company_id,category_code"
            )
            log_ok(f"  {len(new_ec)} expense categories copied.")
    except Exception as e:
        log_warn(f"  Expense categories copy failed: {e}")
        ok = False

    # ── 7. Product categories & units ─────────────────────────────────────────
    log_step(7, 7, "Product categories & units")
    try:
        src_cats = _rows(
            client.table("categories").select("*").eq("company_id", src).execute().data
        )
        if src_cats:
            new_cats = [_strip_id(row, dst) for row in src_cats]
            db_upsert("categories", new_cats, on_conflict="company_id,category_name")
            log_ok(f"  {len(new_cats)} categories copied.")

        src_units = _rows(
            client.table("units").select("*").eq("company_id", src).execute().data
        )
        if src_units:
            base = [u for u in src_units if not u.get("base_unit_id")]
            derived = [u for u in src_units if u.get("base_unit_id")]

            # Insert base units first, capture their new IDs
            new_base = [_strip_id(u, dst) for u in base]
            if new_base:
                inserted_base = _rows(
                    client.table("units")
                    .upsert(new_base, on_conflict="company_id,short_code")
                    .execute()
                    .data
                )
                # Build old_id -> new_id map using short_code as the bridge
                old_short_to_new_id: dict[str, int] = {
                    str(r["short_code"]): int(r["id"]) for r in inserted_base
                }
                src_id_to_short: dict[int, str] = {
                    int(u["id"]): str(u["short_code"]) for u in base
                }
                src_id_to_new_id: dict[int, int] = {
                    old_id: old_short_to_new_id[short]
                    for old_id, short in src_id_to_short.items()
                    if short in old_short_to_new_id
                }
            else:
                src_id_to_new_id = {}

            # Insert derived units with remapped base_unit_id
            new_derived: list[Row] = []
            for u in derived:
                new_u = _strip_id(u, dst)
                old_base_id = int(u.get("base_unit_id") or 0)
                new_u["base_unit_id"] = src_id_to_new_id.get(old_base_id, old_base_id)
                new_derived.append(new_u)
            if new_derived:
                db_upsert("units", new_derived, on_conflict="company_id,short_code")

            log_ok(f"  {len(src_units)} units copied.")
    except Exception as e:
        log_warn(f"  Categories/units copy failed: {e}")
        ok = False

    return ok

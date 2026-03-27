"""
Copy master data from the template company (id=1) to a target company.

Replaces the missing copy_template_data_to_new_company() PostgreSQL RPC.
Copies: roles, permissions, role_permissions, chart_of_accounts,
        income_categories, expense_categories, categories, units.

All operations are idempotent (upsert on natural key or company_id+name).
"""
from __future__ import annotations

from config import TEMPLATE_COMPANY_ID
from src.utils import get_client, db_upsert, log_ok, log_warn, log_section, log_step


def copy_template_data(target_company_id: int) -> bool:
    """
    Copy all template master data to *target_company_id*.
    Returns True on full success, False if any section failed.
    """
    client = get_client()
    src = TEMPLATE_COMPANY_ID
    dst = target_company_id
    ok  = True

    log_section(f"Copying template data  →  company {dst}")

    # ── Roles ─────────────────────────────────────────────────────────────────
    log_step(1, 7, "Roles")
    try:
        src_roles = client.table("roles").select("*").eq("company_id", src).execute().data or []
        if src_roles:
            new_roles = [
                {**{k: v for k, v in r.items() if k != "id"}, "company_id": dst}
                for r in src_roles
            ]
            db_upsert("roles", new_roles, on_conflict="company_id,role_name")
            log_ok(f"  {len(new_roles)} roles copied.")
        else:
            log_warn("  No template roles found.")
    except Exception as e:
        log_warn(f"  Roles copy failed: {e}")
        ok = False

    # ── Permissions (global – no company_id) ─────────────────────────────────
    log_step(2, 7, "Permissions  (global – already shared)")
    try:
        count = client.table("permissions").select("id", count="exact").execute().count or 0
        log_ok(f"  {count} permissions already available globally.")
    except Exception as e:
        log_warn(f"  Permissions check failed: {e}")

    # ── Role permissions ──────────────────────────────────────────────────────
    log_step(3, 7, "Role permissions")
    try:
        # Fetch new role IDs we just created (matched by role_name)
        src_roles  = client.table("roles").select("id,role_name").eq("company_id", src).execute().data or []
        dst_roles  = client.table("roles").select("id,role_name").eq("company_id", dst).execute().data or []

        src_name_to_id = {r["role_name"]: r["id"] for r in src_roles}
        dst_name_to_id = {r["role_name"]: r["id"] for r in dst_roles}

        all_rp = client.table("role_permissions").select("role_id,permission_id").in_(
            "role_id", list(src_name_to_id.values())
        ).execute().data or []

        mappings = []
        for rp in all_rp:
            src_role_name = next((n for n, rid in src_name_to_id.items() if rid == rp["role_id"]), None)
            if src_role_name and src_role_name in dst_name_to_id:
                mappings.append({
                    "role_id":       dst_name_to_id[src_role_name],
                    "permission_id": rp["permission_id"],
                })

        for i in range(0, len(mappings), 200):
            db_upsert("role_permissions", mappings[i:i + 200], on_conflict="role_id,permission_id")
        log_ok(f"  {len(mappings)} role-permission mappings copied.")
    except Exception as e:
        log_warn(f"  Role permissions copy failed: {e}")
        ok = False

    # ── Chart of accounts ─────────────────────────────────────────────────────
    log_step(4, 7, "Chart of accounts")
    try:
        src_coa = client.table("chart_of_accounts").select("*").eq("company_id", src).execute().data or []
        if src_coa:
            new_coa = [
                {**{k: v for k, v in r.items() if k != "id"}, "company_id": dst}
                for r in src_coa
            ]
            db_upsert("chart_of_accounts", new_coa, on_conflict="company_id,account_code")
            log_ok(f"  {len(new_coa)} accounts copied.")
        else:
            log_warn("  No template COA found.")
    except Exception as e:
        log_warn(f"  COA copy failed: {e}")
        ok = False

    # ── Income categories ─────────────────────────────────────────────────────
    log_step(5, 7, "Income categories")
    try:
        src_ic = client.table("income_categories").select("*").eq("company_id", src).execute().data or []
        if src_ic:
            new_ic = [
                {**{k: v for k, v in r.items() if k != "id"}, "company_id": dst}
                for r in src_ic
            ]
            db_upsert("income_categories", new_ic, on_conflict="company_id,category_name")
            log_ok(f"  {len(new_ic)} income categories copied.")
    except Exception as e:
        log_warn(f"  Income categories copy failed: {e}")
        ok = False

    # ── Expense categories ────────────────────────────────────────────────────
    log_step(6, 7, "Expense categories")
    try:
        src_ec = client.table("expense_categories").select("*").eq("company_id", src).execute().data or []
        if src_ec:
            new_ec = [
                {**{k: v for k, v in r.items() if k != "id"}, "company_id": dst}
                for r in src_ec
            ]
            db_upsert("expense_categories", new_ec, on_conflict="company_id,category_name")
            log_ok(f"  {len(new_ec)} expense categories copied.")
    except Exception as e:
        log_warn(f"  Expense categories copy failed: {e}")
        ok = False

    # ── Product categories ────────────────────────────────────────────────────
    log_step(7, 7, "Product categories & units")
    try:
        src_cats = client.table("categories").select("*").eq("company_id", src).execute().data or []
        if src_cats:
            new_cats = [
                {**{k: v for k, v in r.items() if k != "id"}, "company_id": dst}
                for r in src_cats
            ]
            db_upsert("categories", new_cats, on_conflict="company_id,category_code")
            log_ok(f"  {len(new_cats)} categories copied.")

        src_units = client.table("units").select("*").eq("company_id", src).execute().data or []
        if src_units:
            # Insert base units first (no base_unit_id), then derived
            base    = [u for u in src_units if not u.get("base_unit_id")]
            derived = [u for u in src_units if u.get("base_unit_id")]
            for unit_list in (base, derived):
                new_units = [
                    {**{k: v for k, v in u.items() if k != "id"}, "company_id": dst}
                    for u in unit_list
                ]
                if new_units:
                    db_upsert("units", new_units, on_conflict="company_id,short_code")
            log_ok(f"  {len(src_units)} units copied.")
    except Exception as e:
        log_warn(f"  Categories/units copy failed: {e}")
        ok = False

    return ok
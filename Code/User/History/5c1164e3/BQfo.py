"""
Seed runner – dispatches CLI flags to individual demo seeders.
Handles state carry-over between steps (stores → inventory → sales, etc.)
"""

from __future__ import annotations

import argparse
from typing import Any

from config import DEFAULT_COMPANY_ID
from src.seed.copy_template import copy_template_data
from src.seed.ai_profiles import get_company_profile
from src.seed.demo import (
    clear_seed_data,
    fetch_nda_products,
    seed_accounting,
    seed_company,
    seed_customers,
    seed_inventory,
    seed_purchases,
    seed_sales,
    seed_stores,
    seed_suppliers,
)
from src.utils import db_fetch, get_client, log_ok, log_section

# ─────────────────────────────────────────────────────────────────────────────
# Flag → tables mapping (FK-safe reverse-dependency order within each group)
# Only the tables that each flag actually seeds are listed here.
# --all combines all of them in the correct delete order.
#
# GLOBAL tables are intentionally absent from every list below.
# They live at company_id=1 and are shared by every company directly.
# Global tables: units, roles, role_permissions, categories,
#                chart_of_accounts, income_categories, expense_categories
#
# KEY FK RULES reflected in every order below:
#   product_batches.purchase_order_id → purchase_orders   (fk_batches_po)
#   ∴ product_batches MUST be deleted BEFORE purchase_orders
#
#   sale_items.batch_id         → product_batches
#   sales_return_items.batch_id → product_batches
#   stock_adjustments.batch_id  → product_batches
#   ∴ all three MUST be deleted BEFORE product_batches
# ─────────────────────────────────────────────────────────────────────────────
_FLAG_TABLES: dict[str, list[str]] = {
    "accounting": [
        "income",
        "expenses",
    ],
    "sales": [
        "sale_items",  # → sales, product_batches
        "sale_payments",  # → sales
        "sales_return_items",  # → sales_returns, product_batches
        "sales_returns",  # → sales
        "sales",
    ],
    "purchases": [
        "purchase_return_items",  # → purchase_returns, product_batches
        "purchase_order_items",  # → purchase_orders
        "purchase_invoices",  # → purchase_orders
        "supplier_ratings",  # → suppliers, purchase_orders
        "purchase_returns",  # → purchase_orders
        # product_batches has FK to purchase_orders — must clear before POs
        "stock_transfer_items",  # → product_batches
        "stock_adjustments",  # → product_batches
        "sale_items",  # → product_batches (may already be gone)
        "sales_return_items",  # → product_batches (may already be gone)
        "product_batches",  # → purchase_orders  ← BEFORE purchase_orders
        "purchase_orders",
    ],
    "inventory": [
        # Everything that points to product_batches must go first
        "stock_transfer_items",  # → product_batches
        "stock_adjustments",  # → product_batches
        "sale_items",  # → product_batches
        "sales_return_items",  # → product_batches
        "purchase_return_items",  # → product_batches
        "product_batches",
    ],
    "products": [
        # NDA products are read-only (company_id=1), nothing to clear
    ],
    "customers": [
        "customer_insurance",  # → customers
        "credit_payments",  # → credit_transactions
        "payment_schedules",  # → credit_transactions
        "credit_transactions",  # → customers
        "customers",
    ],
    "suppliers": [
        "supplier_ratings",  # → suppliers
        "suppliers",
    ],
    "stores": [
        # profiles.default_store_id → stores  (handled specially in _delete_table)
        "stores",
        "areas",
    ],
    # --copy-template is now a no-op; nothing to clear
    "copy_template": [],
    "company": [
        "company_settings",
    ],
}

# Strict global delete order (most-dependent first) used when --all is active.
# Global tables (units, roles, categories, COA, income/expense_categories)
# are intentionally excluded — they must never be cleared per company.
#
# Full FK dependency order:
#   1. Leaf tables with no company_id (deleted via parent IDs)
#   2. income / expenses (trigger-protected)
#   3. Mid-level operational tables
#   4. product_batches  ← MUST come before purchase_orders (fk_batches_po)
#   5. purchase_orders
#   6. credit_transactions, journal_entries
#   7. Master / structural tables
_ALL_DELETE_ORDER: list[str] = [
    # ── Leaf tables (no company_id — handled via parent IDs in _delete_table) ─
    "sale_items",  # → sales, product_batches
    "sale_payments",  # → sales
    "sales_return_items",  # → sales_returns, product_batches
    "purchase_order_items",  # → purchase_orders
    "purchase_return_items",  # → purchase_returns, product_batches
    "purchase_invoices",  # → purchase_orders
    "supplier_ratings",  # → suppliers, purchase_orders
    "customer_insurance",  # → customers
    "quotation_items",  # → quotations
    "stock_transfer_items",  # → product_batches, stock_transfers
    "stock_adjustments",  # → product_batches
    "journal_entry_lines",  # → journal_entries
    "cash_flow_transactions",  # → journal_entries
    "credit_payments",  # → credit_transactions
    "payment_schedules",  # → credit_transactions
    "payment_transactions",  # → stores, suppliers (has company_id)
    # ── income / expenses (trigger-protected) ─────────────────────────────────
    "income",
    "expenses",
    # ── Mid-level operational ─────────────────────────────────────────────────
    "sales_returns",
    "purchase_returns",
    "quotations",
    "prescriptions",
    "sales",
    "stock_transfers",
    # ── product_batches BEFORE purchase_orders ────────────────────────────────
    "product_batches",  # fk_batches_po → purchase_orders
    # ── purchase_orders (now safe — no batches reference them) ────────────────
    "purchase_orders",
    # ── credit / accounting ───────────────────────────────────────────────────
    "credit_transactions",
    "journal_entries",  # self-ref reversed_entry_id — nulled first
    # ── Master / structural ───────────────────────────────────────────────────
    "customers",
    "suppliers",
    "stores",  # profiles.default_store_id nulled first
    "areas",
    "company_settings",
]


def _resolve_tables_to_clear(args: argparse.Namespace) -> list[str]:
    """
    Return the ordered list of tables to delete based on which flags are active.
    --all → full ordered list.  Individual flags → only their own tables,
    de-duplicated and kept in _ALL_DELETE_ORDER sequence.
    """
    seed_all: bool = getattr(args, "all", False)
    if seed_all:
        return list(_ALL_DELETE_ORDER)

    # Collect tables for every active flag
    wanted: set[str] = set()
    for flag, tables in _FLAG_TABLES.items():
        if getattr(args, flag, False):
            wanted.update(tables)

    # Return them in the safe global delete order (preserves FK safety)
    return [t for t in _ALL_DELETE_ORDER if t in wanted]


# ── Tables that have NO company_id column ─────────────────────────────────────
# Must be deleted via their parent table's IDs.
_INDIRECT: dict[str, tuple[str, str]] = {
    "sale_items": ("sales", "sale_id"),
    "sale_payments": ("sales", "sale_id"),
    "sales_return_items": ("sales_returns", "sales_return_id"),
    "purchase_order_items": ("purchase_orders", "purchase_order_id"),
    "purchase_return_items": ("purchase_returns", "purchase_return_id"),
    "purchase_invoices": ("purchase_orders", "purchase_order_id"),
    "supplier_ratings": ("suppliers", "supplier_id"),
    "customer_insurance": ("customers", "customer_id"),
    "quotation_items": ("quotations", "quotation_id"),
    "stock_transfer_items": ("stock_transfers", "stock_transfer_id"),
    "stock_adjustments": ("product_batches", "batch_id"),
    "journal_entry_lines": ("journal_entries", "journal_entry_id"),
    "cash_flow_transactions": ("journal_entries", "journal_entry_id"),
    "credit_payments": ("credit_transactions", "credit_transaction_id"),
    "payment_schedules": ("credit_transactions", "credit_transaction_id"),
}

# Tables with DELETE triggers that block is_system=True rows
_TRIGGER_PROTECTED: set[str] = {"income", "expenses"}

# Tables needing special pre-delete handling
_SELF_REF: dict[str, str] = {
    # table → column to null before delete (self-referential FK)
    "journal_entries": "reversed_entry_id",
}
_NULL_PROFILES_BEFORE: set[str] = {"stores"}


def _delete_table(client: Any, table: str, company_id: int) -> None:
    """Delete rows for a single table, handling all edge cases."""

    # ── Self-referential FK: null the column first ────────────────────────────
    if table in _SELF_REF:
        col = _SELF_REF[table]
        try:
            client.table(table).update({col: None}).eq(
                "company_id", company_id
            ).execute()
        except Exception:
            pass  # best-effort; deletion will surface errors if it fails

    # ── Null profiles FK before deleting stores ───────────────────────────────
    if table in _NULL_PROFILES_BEFORE:
        try:
            store_ids = [
                int(r["id"])
                for r in (
                    client.table("stores")
                    .select("id")
                    .eq("company_id", company_id)
                    .execute()
                    .data
                    or []
                )
            ]
            if store_ids:
                client.table("profiles").update({"default_store_id": None}).in_(
                    "default_store_id", store_ids
                ).execute()
        except Exception:
            pass

    # ── Tables with no company_id: delete via parent IDs ─────────────────────
    if table in _INDIRECT:
        parent_tbl, child_fk = _INDIRECT[table]
        parent_ids = [
            int(r["id"])
            for r in (
                client.table(parent_tbl)
                .select("id")
                .eq("company_id", company_id)
                .execute()
                .data
                or []
            )
        ]
        if parent_ids:
            # Chunk to avoid oversized IN lists
            chunk = 100
            for i in range(0, len(parent_ids), chunk):
                client.table(table).delete().in_(
                    child_fk, parent_ids[i : i + chunk]
                ).execute()
        return

    # ── Trigger-protected tables: only delete non-system rows ─────────────────
    if table in _TRIGGER_PROTECTED:
        client.table(table).delete().eq("company_id", company_id).eq(
            "is_system", False
        ).execute()
        return

    # ── Default: simple company_id delete ─────────────────────────────────────
    client.table(table).delete().eq("company_id", company_id).execute()


def prompt_format_company(company_id: int, tables: list[str]) -> bool:
    """
    Ask the user whether to wipe ONLY the tables about to be seeded.
    If 'no' → skip deletion entirely; seeding will upsert and skip existing rows.
    Returns True if user confirmed and deletion ran, False if skipped.
    """
    if not tables:
        return False

    print()
    print("=" * 62)
    print(f"  ⚠   FORMAT COMPANY {company_id} BEFORE SEEDING?")
    print("=" * 62)
    print(f"  The following tables will be cleared for company_id={company_id}:")
    for t in tables:
        print(f"    • {t}")
    print()
    print("  Say NO to skip deletion — existing rows will be skipped (upsert).")
    answer = input("  Would you like to format this data? [yes/NO]: ").strip().lower()

    if answer not in ("yes", "y"):
        print("  → Skipping format. Existing rows will be skipped on conflict.")
        print()
        return False

    print("\n  🗑  Deleting only seeded tables …")
    client = get_client()
    for table in tables:
        try:
            _delete_table(client, table, company_id)
            print(f"    ✔  Cleared {table}")
        except Exception as exc:  # noqa: BLE001
            print(f"    ⚠  Could not clear {table}: {exc}")
    print("  ✔  Format complete.\n")
    return True


def run_seed(args: argparse.Namespace) -> None:
    # Resolve company ID: CLI flag > .env COMPANY_ID
    company_id: int = getattr(args, "company_id", None) or DEFAULT_COMPANY_ID
    seed_all: bool = getattr(args, "all", False)

    print(f"\n🎯  Target company_id = {company_id}")

    # --clear: full destructive wipe (existing behaviour, unchanged)
    if getattr(args, "clear", False):
        clear_seed_data(company_id)
        return

    # ── Format prompt ─────────────────────────────────────────────────────────
    tables_to_clear = _resolve_tables_to_clear(args)
    prompt_format_company(company_id, tables_to_clear)

    # ── AI Profile — loaded ONCE, shared by all seeders ───────────────────────
    use_ai: bool = getattr(args, "ai_profiles", True)  # on by default
    log_section("Company Profile")
    profile = get_company_profile(company_id, use_ai=use_ai)
    log_ok(f"Profile: {profile.get('company_name')}  ({profile.get('city')})")

    # State carried between steps
    store_rows: list = []
    product_rows: list = []
    supplier_rows: list = []
    customer_rows: list = []
    batch_rows: list = []
    po_ids_by_store: dict = {}  # {store_id: first_received_po_id} — wired into inventory

    # ── 1. Company + settings ─────────────────────────────────────────────────
    if seed_all or getattr(args, "company", False):
        seed_company(company_id, profile=profile)

    # ── 2. Copy template master data (no-op — data is global at company_id=1) ─
    if seed_all or getattr(args, "copy_template", False):
        copy_template_data(company_id)

    # ── 3. Areas + stores ─────────────────────────────────────────────────────
    if seed_all or getattr(args, "stores", False):
        _, store_rows = seed_stores(company_id, profile=profile)
    else:
        store_rows = db_fetch("stores", company_id)

    # ── 4. Suppliers ──────────────────────────────────────────────────────────
    if seed_all or getattr(args, "suppliers", False):
        supplier_rows = seed_suppliers(company_id, profile=profile)
    else:
        supplier_rows = db_fetch("suppliers", company_id)

    # ── 5. Customers ──────────────────────────────────────────────────────────
    if seed_all or getattr(args, "customers", False):
        customer_rows = seed_customers(company_id, profile=profile)
    else:
        customer_rows = db_fetch("customers", company_id)

    # ── 6. NDA products (read-only) ───────────────────────────────────────────
    if seed_all or getattr(args, "products", False):
        product_rows = fetch_nda_products()
    else:
        product_rows = db_fetch("products", company_id)
        if not product_rows:
            product_rows = fetch_nda_products()

    # ── 7. Purchases ──────────────────────────────────────────────────────────
    # Runs BEFORE inventory so that product_batches.purchase_order_id can be linked.
    if seed_all or getattr(args, "purchases", False):
        store_rows = store_rows or db_fetch("stores", company_id)
        product_rows = product_rows or fetch_nda_products()
        supplier_rows = supplier_rows or db_fetch("suppliers", company_id)
        po_ids_by_store = seed_purchases(
            company_id, product_rows, store_rows, supplier_rows, profile=profile
        )

    # ── 8. Inventory batches ──────────────────────────────────────────────────
    if seed_all or getattr(args, "inventory", False):
        store_rows = store_rows or db_fetch("stores", company_id)
        product_rows = product_rows or fetch_nda_products()
        supplier_rows = supplier_rows or db_fetch("suppliers", company_id)
        batch_rows = seed_inventory(
            company_id,
            product_rows,
            store_rows,
            supplier_rows,
            profile=profile,
            po_ids_by_store=po_ids_by_store or None,
        )
    else:
        batch_rows = db_fetch("product_batches", company_id)

    # ── 9. Sales ──────────────────────────────────────────────────────────────
    if seed_all or getattr(args, "sales", False):
        store_rows = store_rows or db_fetch("stores", company_id)
        product_rows = product_rows or fetch_nda_products()
        customer_rows = customer_rows or db_fetch("customers", company_id)
        batch_rows = batch_rows or db_fetch("product_batches", company_id)
        seed_sales(
            company_id,
            product_rows,
            store_rows,
            customer_rows,
            batch_rows,
            profile=profile,
        )

    # ── 10. Accounting ────────────────────────────────────────────────────────
    if seed_all or getattr(args, "accounting", False):
        store_rows = store_rows or db_fetch("stores", company_id)
        seed_accounting(company_id, store_rows, profile=profile)

    # ── Summary ───────────────────────────────────────────────────────────────
    log_section("Seed Complete")
    log_ok(f"Company ID  : {company_id}")
    log_ok("Areas       : 3")
    log_ok("Stores      : 6  (2 per area)")
    log_ok(f"Products    : {len(product_rows)}")
    log_ok(f"Batches     : {len(batch_rows)}")

"""
Seed runner – dispatches CLI flags to individual demo seeders.
Handles state carry-over between steps (stores → inventory → sales, etc.)
"""

from __future__ import annotations

import argparse

from config import DEFAULT_COMPANY_ID
from src.seed.copy_template import copy_template_data
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
from src.seed.format_company import format_company
from src.utils import db_fetch, get_client, log_ok, log_section

# ─────────────────────────────────────────────────────────────────────────────
# Flag → tables mapping (FK-safe reverse-dependency order within each group)
# Only the tables that each flag actually seeds are listed here.
# --all combines all of them in the correct delete order.
# ─────────────────────────────────────────────────────────────────────────────
_FLAG_TABLES: dict[str, list[str]] = {
    "accounting": [
        "income",
        "expenses",
    ],
    "sales": [
        "sale_items",
        "sales_return_items",
        "sales_returns",
        "sales",
    ],
    "purchases": [
        "purchase_return_items",
        "purchase_returns",
        "purchase_order_items",
        "purchase_orders",
    ],
    "inventory": [
        "product_batches",
    ],
    "products": [
        # NDA products are read-only (company_id=1), nothing to clear
    ],
    "customers": [
        "credit_payments",
        "credit_transactions",
        "customer_insurance",
        "customers",
    ],
    "suppliers": [
        "supplier_ratings",
        "suppliers",
    ],
    "stores": [
        "stores",
        "areas",
    ],
    "copy_template": [
        "role_permissions",
        "roles",
        "chart_of_accounts",
        "income_categories",
        "expense_categories",
        "categories",
        "units",
    ],
    "company": [
        "company_settings",
    ],
}

# Strict global delete order (most-dependent first) used when --all is active
_ALL_DELETE_ORDER: list[str] = [
    "sale_items",
    "sale_payments",
    "sales_return_items",
    "sales_returns",
    "sales",
    "purchase_return_items",
    "purchase_returns",
    "purchase_order_items",
    "purchase_orders",
    "product_batches",
    "credit_payments",
    "credit_transactions",
    "customer_insurance",
    "customers",
    "supplier_ratings",
    "suppliers",
    "income",
    "expenses",
    "income_categories",
    "expense_categories",
    "chart_of_accounts",
    "categories",
    "units",
    "role_permissions",
    "roles",
    "stores",
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

    # Return them in the safe global delete order
    return [t for t in _ALL_DELETE_ORDER if t in wanted]


def prompt_format_company(company_id: int, tables: list[str]) -> bool:
    """
    Ask the user whether to wipe the specific tables before re-seeding.

    Only the tables that the current flags will seed are shown and deleted —
    nothing more. Returns True if user confirmed and deletion ran, False if skipped.
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
    answer = input("  Would you like to format this data? [yes/NO]: ").strip().lower()

    if answer not in ("yes", "y"):
        print("  → Skipping format. Seeding on top of existing data (idempotent).")
        print()
        return False

    print("\n  🗑  Deleting …")
    client = get_client()
    format_company(client, company_id)
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
    # Shown BEFORE any seeding. Only lists tables relevant to the active flags.
    tables_to_clear = _resolve_tables_to_clear(args)
    prompt_format_company(company_id, tables_to_clear)

    # State carried between steps
    store_rows: list = []
    product_rows: list = []
    supplier_rows: list = []
    customer_rows: list = []
    batch_rows: list = []

    # ── 1. Company + settings ─────────────────────────────────────────────────
    if seed_all or getattr(args, "company", False):
        seed_company(company_id)

    # ── 2. Copy template master data ──────────────────────────────────────────
    if seed_all or getattr(args, "copy_template", False):
        copy_template_data(company_id)

    # ── 3. Areas + stores ─────────────────────────────────────────────────────
    if seed_all or getattr(args, "stores", False):
        _, store_rows = seed_stores(company_id)
    else:
        store_rows = db_fetch("stores", company_id)

    # ── 4. Suppliers ──────────────────────────────────────────────────────────
    if seed_all or getattr(args, "suppliers", False):
        supplier_rows = seed_suppliers(company_id)
    else:
        supplier_rows = db_fetch("suppliers", company_id)

    # ── 5. Customers ──────────────────────────────────────────────────────────
    if seed_all or getattr(args, "customers", False):
        customer_rows = seed_customers(company_id)
    else:
        customer_rows = db_fetch("customers", company_id)

    # ── 6. NDA products (read-only) ───────────────────────────────────────────
    if seed_all or getattr(args, "products", False):
        product_rows = fetch_nda_products()
    else:
        # Prefer company-specific products; fall back to NDA global catalogue
        product_rows = db_fetch("products", company_id)
        if not product_rows:
            product_rows = fetch_nda_products()

    # ── 7. Inventory batches ──────────────────────────────────────────────────
    if seed_all or getattr(args, "inventory", False):
        store_rows = store_rows or db_fetch("stores", company_id)
        product_rows = product_rows or fetch_nda_products()
        supplier_rows = supplier_rows or db_fetch("suppliers", company_id)
        batch_rows = seed_inventory(company_id, product_rows, store_rows, supplier_rows)
    else:
        batch_rows = db_fetch("product_batches", company_id)

    # ── 8. Purchases ──────────────────────────────────────────────────────────
    if seed_all or getattr(args, "purchases", False):
        store_rows = store_rows or db_fetch("stores", company_id)
        product_rows = product_rows or fetch_nda_products()
        supplier_rows = supplier_rows or db_fetch("suppliers", company_id)
        seed_purchases(company_id, product_rows, store_rows, supplier_rows)

    # ── 9. Sales ──────────────────────────────────────────────────────────────
    if seed_all or getattr(args, "sales", False):
        store_rows = store_rows or db_fetch("stores", company_id)
        product_rows = product_rows or fetch_nda_products()
        customer_rows = customer_rows or db_fetch("customers", company_id)
        batch_rows = batch_rows or db_fetch("product_batches", company_id)
        seed_sales(company_id, product_rows, store_rows, customer_rows, batch_rows)

    # ── 10. Accounting ────────────────────────────────────────────────────────
    if seed_all or getattr(args, "accounting", False):
        store_rows = store_rows or db_fetch("stores", company_id)
        seed_accounting(company_id, store_rows)

    # ── Summary ───────────────────────────────────────────────────────────────
    log_section("Seed Complete")
    log_ok(f"Company ID  : {company_id}")
    log_ok("Areas       : 3")
    log_ok("Stores      : 6  (2 per area)")
    log_ok(f"Products    : {len(product_rows)}")
    log_ok(f"Batches     : {len(batch_rows)}")

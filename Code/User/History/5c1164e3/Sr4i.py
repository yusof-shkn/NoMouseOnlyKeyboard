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
from src.utils import db_fetch, log_ok, log_section


def run_seed(args: argparse.Namespace) -> None:
    # Resolve company ID: CLI flag > .env COMPANY_ID
    company_id: int = getattr(args, "company_id", None) or DEFAULT_COMPANY_ID
    seed_all = getattr(args, "all", False)

    print(f"\n🎯  Target company_id = {company_id}")

    if getattr(args, "clear", False):
        clear_seed_data(company_id)
        return

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

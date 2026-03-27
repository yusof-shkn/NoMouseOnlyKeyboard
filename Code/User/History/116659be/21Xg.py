"""
format_company.py  –  Wipe all per-company seed data in strict FK-safe order.

FK dependency graph (child → parent) for every table we touch:
  stock_transfer_items  → product_batches, stock_transfers
  stock_adjustments     → product_batches
  sale_items            → sales, product_batches
  sales_return_items    → sales_returns, product_batches
  purchase_return_items → purchase_returns, product_batches
  purchase_order_items  → purchase_orders
  purchase_invoices     → purchase_orders, suppliers, stores
  supplier_ratings      → suppliers, purchase_orders
  customer_insurance    → customers
  quotation_items       → quotations
  sale_payments         → sales
  credit_payments       → credit_transactions
  payment_schedules     → credit_transactions
  payment_transactions  → stores, suppliers, journal_entries
  journal_entry_lines   → journal_entries
  cash_flow_transactions→ journal_entries
  sales_returns         → sales
  quotations            → customers, stores
  sales                 → customers, stores, credit_transactions
  prescriptions         → customers
  purchase_returns      → purchase_orders, suppliers, stores
  stock_transfers       → stores
  product_batches       → purchase_orders (fk_batches_po), suppliers, stores
  purchase_orders       → suppliers, stores, credit_transactions
  credit_transactions   → customers, stores
  journal_entries       → (self: reversed_entry_id)
  customers             → stores (default_store_id via profiles only)
  suppliers             → (none)
  stores                → areas
  areas                 → (none)

GLOBAL tables — NEVER touched here (shared across all companies at company_id=1):
  units, roles, role_permissions, permissions,
  categories, chart_of_accounts, income_categories, expense_categories
"""

from __future__ import annotations

from typing import Any, cast

Row = dict[str, Any]


def _rows(raw: Any) -> list[Row]:
    return cast(list[Row], raw or [])


def _ids(client: Any, table: str, company_id: int) -> list[int]:
    """Fetch all IDs for a company-scoped table."""
    rows = _rows(
        client.table(table).select("id").eq("company_id", company_id).execute().data
    )
    return [int(r["id"]) for r in rows]


def _delete_via_parent(
    client: Any,
    child_table: str,
    child_fk: str,
    parent_ids: list[int],
) -> None:
    """Delete child rows using a list of parent IDs (for tables with no company_id)."""
    if not parent_ids:
        return
    # Supabase REST can't do big IN lists in one shot reliably; chunk at 100
    chunk = 100
    for i in range(0, len(parent_ids), chunk):
        client.table(child_table).delete().in_(
            child_fk, parent_ids[i : i + chunk]
        ).execute()


def format_company(client: Any, company_id: int) -> None:
    """
    Delete all seed data for a company in strict FK-safe order.
    Never touches global tables (company_id=1 master data).
    """
    c = company_id

    def ok(msg: str) -> None:
        print(f"    ✔  {msg}")

    def warn(msg: str) -> None:
        print(f"    ⚠  {msg}")

    def simple(table: str) -> None:
        """Delete all non-system rows for a table that has company_id."""
        try:
            client.table(table).delete().eq("company_id", c).execute()
            ok(f"Cleared {table}")
        except Exception as exc:
            warn(f"Could not clear {table}: {exc}")

    def system_protected(table: str) -> None:
        """Delete only is_system=False rows (tables with DELETE trigger guard)."""
        try:
            client.table(table).delete().eq("company_id", c).eq(
                "is_system", False
            ).execute()
            ok(f"Cleared {table} (non-system rows)")
        except Exception as exc:
            warn(f"Could not clear {table}: {exc}")

    def via_parent(child_table: str, child_fk: str, parent_ids: list[int]) -> None:
        try:
            _delete_via_parent(client, child_table, child_fk, parent_ids)
            ok(f"Cleared {child_table}")
        except Exception as exc:
            warn(f"Could not clear {child_table}: {exc}")

    # ── Collect parent IDs once (used by multiple child tables) ──────────────
    sale_ids = _ids(client, "sales", c)
    purchase_order_ids = _ids(client, "purchase_orders", c)
    purchase_return_ids = _ids(client, "purchase_returns", c)
    sales_return_ids = _ids(client, "sales_returns", c)
    supplier_ids = _ids(client, "suppliers", c)
    customer_ids = _ids(client, "customers", c)
    batch_ids = _ids(client, "product_batches", c)
    stock_transfer_ids = _ids(client, "stock_transfers", c)
    quotation_ids = _ids(client, "quotations", c)
    journal_entry_ids = _ids(client, "journal_entries", c)
    credit_transaction_ids = _ids(client, "credit_transactions", c)

    print(f"\n  🗑  Clearing company_id={c} in FK-safe order …\n")

    # ── STEP 1: Deepest leaf tables (no other table points to them) ───────────
    print("  [1/7] Leaf-level children …")

    # stock_transfer_items → product_batches + stock_transfers
    via_parent("stock_transfer_items", "stock_transfer_id", stock_transfer_ids)

    # stock_adjustments → product_batches
    via_parent("stock_adjustments", "batch_id", batch_ids)

    # sale_items → sales + product_batches
    via_parent("sale_items", "sale_id", sale_ids)

    # sales_return_items → sales_returns + product_batches
    via_parent("sales_return_items", "sales_return_id", sales_return_ids)

    # purchase_order_items → purchase_orders
    via_parent("purchase_order_items", "purchase_order_id", purchase_order_ids)

    # purchase_return_items → purchase_returns + product_batches
    via_parent("purchase_return_items", "purchase_return_id", purchase_return_ids)

    # supplier_ratings → suppliers + purchase_orders
    via_parent("supplier_ratings", "supplier_id", supplier_ids)

    # customer_insurance → customers
    via_parent("customer_insurance", "customer_id", customer_ids)

    # quotation_items → quotations
    via_parent("quotation_items", "quotation_id", quotation_ids)

    # purchase_invoices → purchase_orders + suppliers + stores
    via_parent("purchase_invoices", "purchase_order_id", purchase_order_ids)

    # sale_payments → sales
    via_parent("sale_payments", "sale_id", sale_ids)

    # credit_payments → credit_transactions
    via_parent("credit_payments", "credit_transaction_id", credit_transaction_ids)

    # payment_schedules → credit_transactions
    via_parent("payment_schedules", "credit_transaction_id", credit_transaction_ids)

    # journal_entry_lines → journal_entries
    via_parent("journal_entry_lines", "journal_entry_id", journal_entry_ids)

    # cash_flow_transactions → journal_entries
    via_parent("cash_flow_transactions", "journal_entry_id", journal_entry_ids)

    # payment_transactions → stores + suppliers + journal_entries (has company_id)
    simple("payment_transactions")

    # ── STEP 2: income / expenses (trigger-protected) ─────────────────────────
    print("  [2/7] income / expenses …")
    system_protected("income")
    system_protected("expenses")

    # ── STEP 3: Tables that depend on sales/purchases but not batches ─────────
    print("  [3/7] Sales, returns, quotations, prescriptions …")
    simple("sales_returns")
    simple("quotations")
    simple("prescriptions")
    simple("sales")

    # ── STEP 4: purchase_returns (depends on purchase_orders) ─────────────────
    print("  [4/7] Purchase returns …")
    simple("purchase_returns")

    # ── STEP 5: product_batches BEFORE purchase_orders ────────────────────────
    # fk_batches_po: product_batches.purchase_order_id → purchase_orders.id
    # This is the FK that was causing the original error.
    # product_batches MUST be deleted before purchase_orders.
    print("  [5/7] product_batches (must precede purchase_orders) …")
    simple("product_batches")

    # ── STEP 6: purchase_orders (now safe — no batches reference them) ────────
    print("  [6/7] purchase_orders, credit_transactions, journal_entries …")
    simple("purchase_orders")
    simple("credit_transactions")

    # journal_entries has a self-referential FK (reversed_entry_id).
    # Null it out first so we can delete all rows without ordering issues.
    try:
        client.table("journal_entries").update({"reversed_entry_id": None}).eq(
            "company_id", c
        ).execute()
        simple("journal_entries")
    except Exception as exc:
        warn(f"Could not clear journal_entries: {exc}")

    # ── STEP 7: Master / structural tables ────────────────────────────────────
    print("  [7/7] Customers, suppliers, stores, areas, settings …")

    # Null profiles.default_store_id before deleting stores
    try:
        store_ids = _ids(client, "stores", c)
        if store_ids:
            client.table("profiles").update({"default_store_id": None}).in_(
                "default_store_id", store_ids
            ).execute()
        ok("Nulled profiles.default_store_id")
    except Exception as exc:
        warn(f"Could not null profiles.default_store_id: {exc}")

    simple("customers")
    simple("suppliers")
    simple("stores")
    simple("areas")
    simple("company_settings")

    print(f"\n  ✔  Format complete for company_id={c}.\n")

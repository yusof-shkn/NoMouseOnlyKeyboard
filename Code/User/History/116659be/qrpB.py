"""
format_company.py  –  Drop-in replacement for the "FORMAT COMPANY" clear step.

Fixes all the errors seen in the seed output log:

1. sale_items, sales_return_items, purchase_return_items, purchase_order_items,
   customer_insurance, supplier_ratings, role_permissions
   → these have NO company_id column; deleted via their parent table's IDs.

2. income / expenses
   → DELETE trigger (fn_prevent_delete_system_expense/income) references OLD.reference_number
     which doesn't exist on non-system rows.  The trigger only fires when is_system=TRUE,
     so we filter with   .eq("is_system", False)   to skip those rows safely.

3. income_categories / expense_categories
   → FK violation because income/expenses hadn't been cleared yet.
     Fixed by clearing income/expenses FIRST, then categories.

Usage in runner.py:
    from format_company import format_company
    format_company(supabase_client, company_id=4)
"""

from __future__ import annotations

from typing import Any

Row = dict[str, Any]


def _rows(raw: Any) -> list[Row]:
    from typing import cast

    return cast(list[Row], raw or [])


def format_company(client: Any, company_id: int) -> None:
    """Clear all seed data for a company, handling all FK and trigger edge-cases."""
    c = company_id

    def _ok(msg: str) -> None:
        print(f"    ✔  {msg}")

    def _warn(msg: str) -> None:
        print(f"    ⚠  {msg}")

    # ── Step 1: Child tables with NO company_id ───────────────────────────────
    # Must be deleted FIRST via their parent's IDs to avoid FK violations later.
    indirect = [
        # (child_table,            parent_table,     child_fk,            parent_fk)
        ("sale_items", "sales", "sale_id", "company_id"),
        ("sales_return_items", "sales_returns", "sales_return_id", "company_id"),
        ("purchase_order_items", "purchase_orders", "purchase_order_id", "company_id"),
        (
            "purchase_return_items",
            "purchase_returns",
            "purchase_return_id",
            "company_id",
        ),
        ("supplier_ratings", "suppliers", "supplier_id", "company_id"),
        ("customer_insurance", "customers", "customer_id", "company_id"),
        ("role_permissions", "roles", "role_id", "company_id"),
    ]

    print("  [1/5] Child tables (no company_id) — deleted via parent IDs …")
    for child_tbl, parent_tbl, child_fk, parent_col in indirect:
        try:
            parent_ids = [
                int(r["id"])
                for r in _rows(
                    client.table(parent_tbl)
                    .select("id")
                    .eq(parent_col, c)
                    .execute()
                    .data
                )
            ]
            if parent_ids:
                client.table(child_tbl).delete().in_(child_fk, parent_ids).execute()
            _ok(f"Cleared {child_tbl}")
        except Exception as exc:
            _warn(f"Could not clear {child_tbl}: {exc}")

    # ── Step 2: income / expenses (non-system rows only) ─────────────────────
    # The DELETE trigger raises an exception for is_system=TRUE rows (it references
    # OLD.reference_number which doesn't exist on non-system rows, but the trigger
    # body only executes that path when is_system=TRUE).  Filter to is_system=FALSE.
    print("  [2/5] income / expenses (is_system=False only) …")
    for tbl in ("income", "expenses"):
        try:
            client.table(tbl).delete().eq("company_id", c).eq(
                "is_system", False
            ).execute()
            _ok(f"Cleared {tbl}")
        except Exception as exc:
            _warn(f"Could not clear {tbl}: {exc}")

    # ── Step 3: Categories (now safe, because income/expenses are gone) ───────
    print("  [3/5] income_categories / expense_categories …")
    for tbl in ("income_categories", "expense_categories"):
        try:
            client.table(tbl).delete().eq("company_id", c).execute()
            _ok(f"Cleared {tbl}")
        except Exception as exc:
            _warn(f"Could not clear {tbl}: {exc}")

    # ── Step 4: Remaining tables WITH company_id (order matters for FKs) ─────
    print("  [4/5] Main tables …")
    ordered = [
        "sale_payments",
        "credit_payments",
        "credit_transactions",
        "sales_returns",
        "sales",
        "purchase_returns",
        "purchase_orders",
        "product_batches",
        "customers",
        "suppliers",
        "chart_of_accounts",
        "categories",
        "units",
        "roles",
        "stores",
        "areas",
        "company_settings",
    ]
    for tbl in ordered:
        try:
            client.table(tbl).delete().eq("company_id", c).execute()
            _ok(f"Cleared {tbl}")
        except Exception as exc:
            _warn(f"Could not clear {tbl}: {exc}")

    # ── Step 5: Company row itself ────────────────────────────────────────────
    print("  [5/5] Company row …")
    try:
        client.table("companies").delete().eq("id", c).execute()
        _ok(f"Cleared companies (id={c})")
    except Exception as exc:
        _warn(f"Could not clear companies: {exc}")

    print(f"  ✔  Format complete for company_id={c}.\n")

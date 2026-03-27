"""
Template company seeders (company_id = 1).

FIXES:
1. Roles, chart_of_accounts, income_categories, expense_categories now upsert
   on (company_id, name) instead of bare `id` — avoids PK collision with other companies.
2. Products seeded directly for the target company (no NDA copy dependency).
3. Inventory batches, purchase orders, sales, expenses all seeded with real FKs
   resolved at runtime (no hardcoded IDs).
4. is_restricted = True/False mixed into products, batches, sales, purchase_returns,
   sales_returns, income, expenses so the applyRestrictedFilter logic can be tested.

BUG FIXES (vs previous version):
- expenses: removed non-existent columns `discount_percentage` and `discount_amount`
- income: removed non-existent columns `discount_percentage` and `discount_amount`
- sales: fixed invalid payment_status value "partial" → "partially_paid"
- seed_units: removed dead `strip_id = None` intermediate assignment

All 10+ sections are independent idempotent functions.
FK-safe insertion order is enforced by SEED_PIPELINE at the bottom.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta
from typing import Any, Callable, cast

from config import CATEGORY_MAPPINGS
from config import TEMPLATE_COMPANY_ID as CID
from src.utils import db_upsert, get_client, log_ok, log_warn

_TS = "2025-12-28T17:09:28.337072+00:00"
_TS2 = "2025-12-29T21:41:36.863275+00:00"


# ─────────────────────────────────────────────────────────────────────────────
# helpers
# ─────────────────────────────────────────────────────────────────────────────


def _today(offset_days: int = 0) -> str:
    return (datetime.utcnow() + timedelta(days=offset_days)).strftime("%Y-%m-%d")


def _now() -> str:
    return datetime.utcnow().isoformat() + "+00:00"


# ─────────────────────────────────────────────────────────────────────────────
# 1. Company
# ─────────────────────────────────────────────────────────────────────────────
def seed_company(company_id: int) -> None:
    db_upsert(
        "companies",
        {
            "id": company_id,
            "company_name": f"HealthPlus Pharmacy {company_id}",
            "company_code": f"HP{company_id:03d}",
            "email": f"admin{company_id}@healthplus.local",
            "phone": None,
            "address": None,
            "is_active": True,
            "created_at": _TS,
            "updated_at": _TS,
        },
        on_conflict="id",
    )
    log_ok(f"Company {company_id} ensured.")


# ─────────────────────────────────────────────────────────────────────────────
# 2. Company settings
# ─────────────────────────────────────────────────────────────────────────────
def seed_company_settings(company_id: int) -> None:
    db_upsert(
        "company_settings",
        {
            "company_id": company_id,
            "near_expiry_warning_days": 30,
            "near_expiry_critical_days": 7,
            "auto_expire_batches": True,
            "low_stock_multiplier": 1.5,
            "allow_negative_stock": False,
            "stock_valuation_method": "FIFO",
            "default_currency": "UGX",
            "enable_batch_tracking": True,
            "enable_serial_numbers": False,
            "tax_rate": 0,
            "require_purchase_approval": False,
            "enable_backorders": True,
            "auto_fulfill_backorders": False,
            "backorder_notification_enabled": True,
            "allow_backorder_negative_stock": False,
            "backorder_priority_days": 7,
            "notify_on_backorder": True,
            "credit_settings": {
                "late_fee": 0,
                "interest_rate": 0,
                "grace_period_days": 7,
                "notify_payment_due": True,
                "default_credit_days": 30,
                "notify_credit_limit": True,
                "auto_suspend_overdue": False,
                "reminder_days_before": 3,
                "credit_check_required": False,
                "suspension_grace_days": 30,
                "min_payment_percentage": 0,
                "notify_payment_overdue": True,
                "require_credit_approval": False,
                "enable_credit_management": True,
                "large_transaction_threshold": 0,
                "require_transaction_approval": False,
            },
            "default_discount_percentage": 0.00,
            "max_discount_percentage": 20.00,
            "require_discount_approval": True,
            "allow_negative_sales": False,
            "auto_generate_sale_numbers": True,
            "sale_number_prefix": "SAL",
            "default_credit_days": 30,
            "allow_sales_returns": True,
            "sales_return_days_limit": 30,
            "require_return_approval": True,
            "return_approval_threshold": 5000.00,
            "allow_purchase_returns": True,
            "purchase_return_days_limit": 14,
            "auto_restock_on_return": True,
            "enable_low_stock_notifications": True,
            "enable_expiry_notifications": True,
            "enable_payment_notifications": True,
            "enable_order_notifications": True,
            "enable_auto_reorder": False,
            "allow_inter_store_transfers": True,
            "require_transfer_approval": False,
            "base_currency": "UGX",
            "receipt_header_text": "Thank you for your business!",
            "receipt_footer_text": "All sales are final unless otherwise stated.",
            "show_company_logo_on_receipt": True,
            "receipt_paper_size": "A4",
            "invoice_prefix": "INV",
            "po_prefix": "PO",
            "auto_increment_documents": True,
            "document_number_padding": 6,
            "block_expired_sales": True,
            "allow_near_expiry_discount": True,
            "near_expiry_discount_percentage": 10.00,
            "supplier_code_prefix": "SUP",
            "auto_generate_supplier_codes": True,
            "supplier_code_counter": 1,
            "quotation_prefix": "QT-",
            "default_quotation_validity_days": 30,
            "require_quotation_approval": False,
            "auto_generate_quotation_numbers": True,
            "expense_category_prefix": "EXP",
            "auto_increment_expense_categories": True,
            "expense_category_number_padding": 4,
            "require_purchase_return_approval": False,
            "created_at": _TS,
            "updated_at": _TS,
        },
        on_conflict="company_id",
    )
    log_ok("Company settings ensured.")


# ─────────────────────────────────────────────────────────────────────────────
# 3. Roles
# FIX: upsert on (company_id, role_name) — not bare id — so we don't stomp
#      on another company's roles that happen to share the same serial id.
# ─────────────────────────────────────────────────────────────────────────────
_ROLES = [
    ("Company Admin", "Full access to all company data and all pages", 90, "company"),
    (
        "Area Admin",
        "All pages except: Areas Management, Company Settings, Users, Roles. Scope: assigned area",
        70,
        "area",
    ),
    (
        "Store Admin",
        "All pages except: Stores, Areas, Company Settings, Users, Roles. Scope: assigned store",
        60,
        "store",
    ),
    (
        "Sales Manager",
        "Access to Sales module and Items Master. Scope: assigned store only",
        50,
        "store",
    ),
    (
        "Inventory Manager",
        "Access to Inventory, Purchasing, Items Master. Scope: assigned store only",
        40,
        "store",
    ),
    ("Cashier", "POS and POS History only. Scope: assigned store only", 30, "store"),
    (
        "Accounting Manager",
        "Accounting/Finance module only. Scope: company-wide",
        80,
        "company",
    ),
]


def seed_roles(company_id: int) -> None:
    client = get_client()
    for name, desc, pri, level in _ROLES:
        existing = (
            client.table("roles")
            .select("id")
            .eq("company_id", company_id)
            .eq("role_name", name)
            .execute()
            .data
        )
        row = {
            "company_id": company_id,
            "role_name": name,
            "description": desc,
            "is_custom": False,
            "is_system": True,
            "priority": pri,
            "access_level": level,
            "created_at": _TS2,
            "updated_at": _TS2,
        }
        if existing:
            client.table("roles").update(row).eq("id", existing[0]["id"]).execute()
        else:
            client.table("roles").insert(row).execute()
    log_ok(f"Roles ensured ({len(_ROLES)}) for company {company_id}.")


# ─────────────────────────────────────────────────────────────────────────────
# 4. Permissions (307 total — global, no company_id)
# ─────────────────────────────────────────────────────────────────────────────
_CORE_PERMS = [
    (1, "products_create", "Create new products", "inventory", "products", "create"),
    (2, "products_read", "View products", "inventory", "products", "read"),
    (
        3,
        "products_update",
        "Update existing products",
        "inventory",
        "products",
        "update",
    ),
    (4, "products_delete", "Delete products", "inventory", "products", "delete"),
    (5, "stock_view", "View stock levels", "inventory", "stock", "read"),
    (6, "stock_adjust", "Adjust stock quantities", "inventory", "stock", "update"),
    (7, "sales_create", "Create new sales", "sales", "sales", "create"),
    (8, "sales_read", "View sales records", "sales", "sales", "read"),
    (9, "sales_cancel", "Cancel sales transactions", "sales", "sales", "delete"),
    (10, "sales_refund", "Process sales refunds", "sales", "refunds", "create"),
    (
        11,
        "purchases_create",
        "Create purchase orders",
        "purchasing",
        "purchase_orders",
        "create",
    ),
    (
        12,
        "purchases_read",
        "View purchase orders",
        "purchasing",
        "purchase_orders",
        "read",
    ),
    (
        13,
        "purchases_approve",
        "Approve purchase orders",
        "purchasing",
        "purchase_orders",
        "approve",
    ),
    (
        14,
        "purchases_receive",
        "Receive purchase orders",
        "purchasing",
        "purchase_orders",
        "receive",
    ),
    (15, "customers_create", "Create new customers", "crm", "customers", "create"),
    (16, "customers_read", "View customer records", "crm", "customers", "read"),
    (
        17,
        "customers_update",
        "Update customer information",
        "crm",
        "customers",
        "update",
    ),
    (18, "reports_sales", "View sales reports", "reports", "reports", "read"),
    (19, "reports_inventory", "View inventory reports", "reports", "reports", "read"),
    (20, "reports_financial", "View financial reports", "reports", "reports", "read"),
    (21, "users_manage", "Manage system users", "admin", "users", "manage"),
    (22, "roles_manage", "Manage user roles", "admin", "roles", "manage"),
    (23, "settings_manage", "Manage system settings", "admin", "settings", "manage"),
    (
        24,
        "chart_of_accounts_read",
        "View chart of accounts",
        "Finance",
        "chart_of_accounts",
        "read",
    ),
    (
        25,
        "chart_of_accounts_create",
        "Create accounts",
        "Finance",
        "chart_of_accounts",
        "create",
    ),
    (
        26,
        "chart_of_accounts_update",
        "Update accounts",
        "Finance",
        "chart_of_accounts",
        "update",
    ),
    (
        27,
        "chart_of_accounts_delete",
        "Delete accounts",
        "Finance",
        "chart_of_accounts",
        "delete",
    ),
    (
        28,
        "chart_of_accounts_manage",
        "Full account management",
        "Finance",
        "chart_of_accounts",
        "manage",
    ),
    (
        29,
        "chart_of_accounts_export",
        "Export chart of accounts",
        "Finance",
        "chart_of_accounts",
        "export",
    ),
    (
        30,
        "chart_of_accounts_view_balances",
        "View account balances",
        "Finance",
        "chart_of_accounts",
        "view_balances",
    ),
    (
        31,
        "journal_entries_read",
        "View journal entries",
        "Finance",
        "journal_entries",
        "read",
    ),
    (
        32,
        "journal_entries_create",
        "Create journal entries",
        "Finance",
        "journal_entries",
        "create",
    ),
    (
        33,
        "journal_entries_update",
        "Update journal entries",
        "Finance",
        "journal_entries",
        "update",
    ),
    (
        34,
        "journal_entries_delete",
        "Delete journal entries",
        "Finance",
        "journal_entries",
        "delete",
    ),
    (
        35,
        "journal_entries_post",
        "Post journal entries",
        "Finance",
        "journal_entries",
        "post",
    ),
    (
        36,
        "journal_entries_reverse",
        "Reverse journal entries",
        "Finance",
        "journal_entries",
        "reverse",
    ),
    (
        37,
        "journal_entries_approve",
        "Approve journal entries",
        "Finance",
        "journal_entries",
        "approve",
    ),
    (
        38,
        "journal_entries_export",
        "Export journal entries",
        "Finance",
        "journal_entries",
        "export",
    ),
    (39, "expenses_read", "View expenses", "Finance", "expenses", "read"),
    (40, "expenses_create", "Create expenses", "Finance", "expenses", "create"),
    (41, "expenses_update", "Update expenses", "Finance", "expenses", "update"),
    (42, "expenses_delete", "Delete expenses", "Finance", "expenses", "delete"),
    (43, "expenses_approve", "Approve expenses", "Finance", "expenses", "approve"),
    (44, "expenses_export", "Export expenses", "Finance", "expenses", "export"),
    (45, "expenses_view_all", "View all expenses", "Finance", "expenses", "view_all"),
    (46, "expenses_view_own", "View own expenses", "Finance", "expenses", "view_own"),
    (47, "expenses_manage", "Full expense management", "Finance", "expenses", "manage"),
    (
        48,
        "expense_categories_read",
        "View expense categories",
        "Finance",
        "expense_categories",
        "read",
    ),
    (
        49,
        "expense_categories_create",
        "Create expense categories",
        "Finance",
        "expense_categories",
        "create",
    ),
    (
        50,
        "expense_categories_update",
        "Update expense categories",
        "Finance",
        "expense_categories",
        "update",
    ),
    (
        51,
        "expense_categories_delete",
        "Delete expense categories",
        "Finance",
        "expense_categories",
        "delete",
    ),
    (
        52,
        "expense_categories_manage",
        "Full expense category management",
        "Finance",
        "expense_categories",
        "manage",
    ),
    (53, "income_read", "View income", "Finance", "income", "read"),
    (54, "income_create", "Create income entries", "Finance", "income", "create"),
    (55, "income_update", "Update income entries", "Finance", "income", "update"),
    (56, "income_delete", "Delete income entries", "Finance", "income", "delete"),
    (57, "income_approve", "Approve income entries", "Finance", "income", "approve"),
    (58, "income_export", "Export income data", "Finance", "income", "export"),
    (59, "income_view_all", "View all income", "Finance", "income", "view_all"),
    (60, "income_view_own", "View own income", "Finance", "income", "view_own"),
    (61, "income_manage", "Full income management", "Finance", "income", "manage"),
    (
        62,
        "income_categories_read",
        "View income categories",
        "Finance",
        "income_categories",
        "read",
    ),
    (
        63,
        "income_categories_create",
        "Create income categories",
        "Finance",
        "income_categories",
        "create",
    ),
    (
        64,
        "income_categories_update",
        "Update income categories",
        "Finance",
        "income_categories",
        "update",
    ),
    (
        65,
        "income_categories_delete",
        "Delete income categories",
        "Finance",
        "income_categories",
        "delete",
    ),
    (
        66,
        "income_categories_manage",
        "Full income category management",
        "Finance",
        "income_categories",
        "manage",
    ),
    (67, "budgets_read", "View budgets", "Finance", "budgets", "read"),
    (68, "budgets_create", "Create budgets", "Finance", "budgets", "create"),
    (69, "budgets_update", "Update budgets", "Finance", "budgets", "update"),
    (70, "budgets_delete", "Delete budgets", "Finance", "budgets", "delete"),
    (71, "budgets_approve", "Approve budgets", "Finance", "budgets", "approve"),
    (72, "budgets_manage", "Full budget management", "Finance", "budgets", "manage"),
    (73, "budgets_export", "Export budget data", "Finance", "budgets", "export"),
    (
        74,
        "budgets_view_variance",
        "View budget variance",
        "Finance",
        "budgets",
        "view_variance",
    ),
    (
        75,
        "fiscal_periods_read",
        "View fiscal periods",
        "Finance",
        "fiscal_periods",
        "read",
    ),
    (
        76,
        "fiscal_periods_create",
        "Create fiscal periods",
        "Finance",
        "fiscal_periods",
        "create",
    ),
    (
        77,
        "fiscal_periods_update",
        "Update fiscal periods",
        "Finance",
        "fiscal_periods",
        "update",
    ),
    (
        78,
        "fiscal_periods_close",
        "Close fiscal periods",
        "Finance",
        "fiscal_periods",
        "close",
    ),
    (
        79,
        "fiscal_periods_reopen",
        "Reopen fiscal periods",
        "Finance",
        "fiscal_periods",
        "reopen",
    ),
    (
        80,
        "fiscal_periods_manage",
        "Full fiscal period management",
        "Finance",
        "fiscal_periods",
        "manage",
    ),
    (
        81,
        "account_balances_read",
        "View account balances",
        "Finance",
        "account_balances",
        "read",
    ),
    (
        82,
        "account_balances_recalculate",
        "Recalculate balances",
        "Finance",
        "account_balances",
        "recalculate",
    ),
    (
        83,
        "account_balances_export",
        "Export balance data",
        "Finance",
        "account_balances",
        "export",
    ),
    (
        84,
        "financial_reports_balance_sheet",
        "View balance sheet",
        "Finance",
        "financial_reports",
        "balance_sheet",
    ),
    (
        85,
        "financial_reports_income_statement",
        "View income statement",
        "Finance",
        "financial_reports",
        "income_statement",
    ),
    (
        86,
        "financial_reports_cash_flow",
        "View cash flow report",
        "Finance",
        "financial_reports",
        "cash_flow",
    ),
    (
        87,
        "financial_reports_trial_balance",
        "View trial balance",
        "Finance",
        "financial_reports",
        "trial_balance",
    ),
    (
        88,
        "financial_reports_profit_loss",
        "View profit & loss",
        "Finance",
        "financial_reports",
        "profit_loss",
    ),
    (
        89,
        "financial_reports_general_ledger",
        "View general ledger",
        "Finance",
        "financial_reports",
        "general_ledger",
    ),
    (
        90,
        "financial_reports_export",
        "Export financial reports",
        "Finance",
        "financial_reports",
        "export",
    ),
    (
        91,
        "financial_reports_view_all",
        "View all financial reports",
        "Finance",
        "financial_reports",
        "view_all",
    ),
    (92, "cash_flow_read", "View cash flow", "Finance", "cash_flow", "read"),
    (93, "cash_flow_export", "Export cash flow data", "Finance", "cash_flow", "export"),
    (
        94,
        "cash_flow_manage",
        "Full cash flow management",
        "Finance",
        "cash_flow",
        "manage",
    ),
    (95, "tax_codes_read", "View tax codes", "Finance", "tax_codes", "read"),
    (96, "tax_codes_create", "Create tax codes", "Finance", "tax_codes", "create"),
    (97, "tax_codes_update", "Update tax codes", "Finance", "tax_codes", "update"),
    (98, "tax_codes_delete", "Delete tax codes", "Finance", "tax_codes", "delete"),
    (
        99,
        "tax_codes_manage",
        "Full tax code management",
        "Finance",
        "tax_codes",
        "manage",
    ),
    (
        100,
        "payment_transactions_read",
        "View payment transactions",
        "Finance",
        "payment_transactions",
        "read",
    ),
]

_EXTRA_MODULES = [
    (
        "inventory",
        "batches",
        ["read", "create", "update", "delete", "manage", "export"],
    ),
    ("inventory", "stock_transfers", ["read", "create", "approve", "manage"]),
    (
        "inventory",
        "stock_adjustments",
        ["read", "create", "approve", "manage", "export"],
    ),
    ("inventory", "categories", ["read", "create", "update", "delete", "manage"]),
    ("inventory", "units", ["read", "create", "update", "delete", "manage"]),
    ("sales", "pos", ["access", "read", "create", "void", "manage"]),
    (
        "sales",
        "quotations",
        ["read", "create", "update", "delete", "approve", "convert", "manage"],
    ),
    ("sales", "discounts", ["read", "apply", "approve", "manage"]),
    ("sales", "returns", ["read", "create", "approve", "manage"]),
    (
        "purchasing",
        "suppliers",
        ["read", "create", "update", "delete", "manage", "export"],
    ),
    ("purchasing", "purchase_returns", ["read", "create", "approve", "manage"]),
    (
        "purchasing",
        "purchase_invoices",
        ["read", "create", "update", "delete", "manage"],
    ),
    (
        "crm",
        "customers",
        ["delete", "manage", "export", "view_credit", "manage_credit"],
    ),
    (
        "crm",
        "prescriptions",
        ["read", "create", "update", "delete", "verify", "manage"],
    ),
    ("crm", "insurance", ["read", "create", "update", "delete", "manage"]),
    ("reports", "purchase_reports", ["read", "export"]),
    ("reports", "customer_reports", ["read", "export"]),
    ("reports", "supplier_reports", ["read", "export"]),
    ("reports", "stock_reports", ["read", "export"]),
    ("reports", "expiry_reports", ["read", "export"]),
    ("reports", "profit_reports", ["read", "export"]),
    ("admin", "areas", ["read", "create", "update", "delete", "manage"]),
    ("admin", "stores", ["read", "create", "update", "delete", "manage"]),
    ("admin", "companies", ["read", "update", "manage"]),
    ("admin", "audit_logs", ["read", "export", "manage"]),
    ("admin", "notifications", ["read", "manage", "dismiss"]),
    (
        "Finance",
        "payment_transactions",
        ["create", "update", "delete", "approve", "manage", "export"],
    ),
    ("Finance", "budgets", ["view_all", "view_store"]),
    ("Finance", "tax_codes", ["export", "view_all"]),
]


def _build_all_permissions() -> list[dict]:
    rows = [
        {
            "id": pid,
            "permission_name": name,
            "description": desc,
            "module": mod,
            "resource": res,
            "action": act,
            "created_at": _TS,
            "updated_at": _TS,
        }
        for pid, name, desc, mod, res, act in _CORE_PERMS
    ]
    next_id = 101
    for module, resource, actions in _EXTRA_MODULES:
        for action in actions:
            if next_id > 307:
                break
            rows.append(
                {
                    "id": next_id,
                    "permission_name": f"{resource}_{action}",
                    "description": f"{action.replace('_', ' ').capitalize()} {resource.replace('_', ' ')}",
                    "module": module,
                    "resource": resource,
                    "action": action,
                    "created_at": _TS,
                    "updated_at": _TS,
                }
            )
            next_id += 1

    while next_id <= 307:
        rows.append(
            {
                "id": next_id,
                "permission_name": f"permission_{next_id}",
                "description": f"System permission {next_id}",
                "module": "system",
                "resource": "system",
                "action": "access",
                "created_at": _TS,
                "updated_at": _TS,
            }
        )
        next_id += 1

    return rows


def seed_permissions() -> None:
    all_perms = _build_all_permissions()
    for i in range(0, len(all_perms), 100):
        db_upsert("permissions", all_perms[i : i + 100], on_conflict="id")
    log_ok(f"Permissions ensured ({len(all_perms)}).")


def seed_role_permissions(company_id: int) -> None:
    client = get_client()
    all_perms: list[dict[str, Any]] = cast(
        list[dict[str, Any]],
        client.table("permissions").select("id,permission_name,module").execute().data
        or [],
    )

    company_roles = (
        client.table("roles")
        .select("id,role_name")
        .eq("company_id", company_id)
        .execute()
        .data
        or []
    )
    role_id_map = {r["role_name"]: r["id"] for r in company_roles}

    admin_only = {"users_manage", "roles_manage", "settings_manage"}
    report_perms = {"reports_sales", "reports_inventory", "reports_financial"}
    cashier_perms = {
        "sales_create",
        "sales_read",
        "sales_cancel",
        "customers_read",
        "customers_create",
        "products_read",
        "stock_view",
    }
    sales_extra = {"products_read", "stock_view", "purchases_read"} | report_perms

    role_predicates = [
        ("Company Admin", lambda p: True),
        ("Area Admin", lambda p: True),
        ("Store Admin", lambda p: p["permission_name"] not in admin_only),
        (
            "Accounting Manager",
            lambda p: p["module"] == "Finance" or p["permission_name"] in report_perms,
        ),
        (
            "Sales Manager",
            lambda p: (
                p["module"] in ("sales", "crm") or p["permission_name"] in sales_extra
            ),
        ),
        (
            "Inventory Manager",
            lambda p: (
                p["module"] in ("inventory", "purchasing")
                or p["permission_name"]
                in {
                    "products_create",
                    "products_read",
                    "products_update",
                    "products_delete",
                    "customers_read",
                    "reports_inventory",
                    "reports_sales",
                }
            ),
        ),
        ("Cashier", lambda p: p["permission_name"] in cashier_perms),
    ]

    mappings: list[dict] = []
    seen: set[tuple] = set()
    for role_name, pred in role_predicates:
        role_id = role_id_map.get(role_name)
        if not role_id:
            log_warn(
                f"Role '{role_name}' not found for company {company_id}, skipping."
            )
            continue
        for p in all_perms:
            if pred(p):
                key = (role_id, int(p["id"]))
                if key not in seen:
                    seen.add(key)
                    mappings.append({"role_id": role_id, "permission_id": int(p["id"])})

    for i in range(0, len(mappings), 200):
        db_upsert(
            "role_permissions",
            mappings[i : i + 200],
            on_conflict="role_id,permission_id",
        )
    log_ok(
        f"Role-permissions ensured ({len(mappings)} mappings) for company {company_id}."
    )


# ─────────────────────────────────────────────────────────────────────────────
# 5. Categories
# FIX: upsert on (company_id, category_name) not bare id
# ─────────────────────────────────────────────────────────────────────────────
def seed_categories(company_id: int) -> None:
    _TS_CAT = "2026-01-01T12:50:53.616822+00:00"
    client = get_client()
    for i, (name, info) in enumerate(CATEGORY_MAPPINGS.items()):
        existing = (
            client.table("categories")
            .select("id")
            .eq("company_id", company_id)
            .eq("category_name", name)
            .execute()
            .data
        )
        row = {
            "company_id": company_id,
            "category_name": name,
            "category_code": info["code"],
            "description": info["description"],
            "is_active": True,
            "icon_name": info["icon"],
            "color_code": info["color"],
            "sort_order": i + 1,
            "created_at": _TS_CAT,
            "updated_at": _TS_CAT,
        }
        if existing:
            client.table("categories").update(row).eq("id", existing[0]["id"]).execute()
        else:
            client.table("categories").insert(row).execute()
    log_ok(f"Categories ensured ({len(CATEGORY_MAPPINGS)}) for company {company_id}.")


# ─────────────────────────────────────────────────────────────────────────────
# 6. Units
# FIX: upsert on (company_id, short_code) not bare id
# FIX: removed dead `strip_id = None` intermediate assignment
# ─────────────────────────────────────────────────────────────────────────────
def seed_units(company_id: int) -> None:
    _TS_U = "2025-12-28T15:57:35.281704+00:00"
    client = get_client()
    base_units = [
        {
            "name": "Tablet",
            "short_code": "TAB",
            "type": "base",
            "base_unit_id": None,
            "conversion_factor": 1,
        },
        {
            "name": "Capsule",
            "short_code": "CAP",
            "type": "base",
            "base_unit_id": None,
            "conversion_factor": 1,
        },
        {
            "name": "Bottle",
            "short_code": "BTL",
            "type": "base",
            "base_unit_id": None,
            "conversion_factor": 1,
        },
        {
            "name": "Vial",
            "short_code": "VIAL",
            "type": "base",
            "base_unit_id": None,
            "conversion_factor": 1,
        },
        {
            "name": "Tube",
            "short_code": "TUBE",
            "type": "base",
            "base_unit_id": None,
            "conversion_factor": 1,
        },
        {
            "name": "Milliliter",
            "short_code": "ML",
            "type": "base",
            "base_unit_id": None,
            "conversion_factor": 1,
        },
        {
            "name": "Milligram",
            "short_code": "MG",
            "type": "base",
            "base_unit_id": None,
            "conversion_factor": 1,
        },
    ]

    unit_id_map: dict[str, int] = {}
    for u in base_units:
        existing = (
            client.table("units")
            .select("id")
            .eq("company_id", company_id)
            .eq("short_code", u["short_code"])
            .execute()
            .data
        )
        if existing:
            unit_id_map[u["short_code"]] = existing[0]["id"]
        else:
            row = {
                **u,
                "company_id": company_id,
                "is_active": True,
                "created_at": _TS_U,
                "updated_at": _TS_U,
            }
            result = client.table("units").insert(row).select("id").execute()
            unit_id_map[u["short_code"]] = result.data[0]["id"]

    derived_units = [
        {
            "name": "Strip",
            "short_code": "STRIP",
            "type": "derived",
            "base_short_code": "TAB",
            "conversion_factor": 10,
        },
        {
            "name": "Sachet",
            "short_code": "SACH",
            "type": "derived",
            "base_short_code": "ML",
            "conversion_factor": 5,
        },
    ]
    for u in derived_units:
        base_id = unit_id_map.get(u["base_short_code"])
        existing = (
            client.table("units")
            .select("id")
            .eq("company_id", company_id)
            .eq("short_code", u["short_code"])
            .execute()
            .data
        )
        row = {
            "name": u["name"],
            "short_code": u["short_code"],
            "type": u["type"],
            "base_unit_id": base_id,
            "conversion_factor": u["conversion_factor"],
            "company_id": company_id,
            "is_active": True,
            "created_at": _TS_U,
            "updated_at": _TS_U,
        }
        if existing:
            client.table("units").update(row).eq("id", existing[0]["id"]).execute()
            unit_id_map[u["short_code"]] = existing[0]["id"]
        else:
            result = client.table("units").insert(row).select("id").execute()
            unit_id_map[u["short_code"]] = result.data[0]["id"]

    # Box = 10 strips — resolved after STRIP is in the map
    strip_id = unit_id_map.get("STRIP")
    existing = (
        client.table("units")
        .select("id")
        .eq("company_id", company_id)
        .eq("short_code", "BOX")
        .execute()
        .data
    )
    box_row = {
        "name": "Box",
        "short_code": "BOX",
        "type": "derived",
        "base_unit_id": strip_id,
        "conversion_factor": 10,
        "company_id": company_id,
        "is_active": True,
        "created_at": _TS_U,
        "updated_at": _TS_U,
    }
    if existing:
        client.table("units").update(box_row).eq("id", existing[0]["id"]).execute()
    else:
        client.table("units").insert(box_row).execute()

    log_ok(f"Units ensured for company {company_id}.")


# ─────────────────────────────────────────────────────────────────────────────
# 7. Chart of accounts
# FIX: upsert on (company_id, account_code) not bare id
# ─────────────────────────────────────────────────────────────────────────────
_COA = [
    ("1000", "Current Assets", "asset", "current_asset"),
    ("1100", "Cash on Hand", "asset", "current_asset"),
    ("1110", "Petty Cash", "asset", "current_asset"),
    ("1120", "Bank Account", "asset", "current_asset"),
    ("1130", "Mobile Money", "asset", "current_asset"),
    ("1200", "Accounts Receivable", "asset", "current_asset"),
    ("1210", "Tax Recoverable (VAT Input)", "asset", "current_asset"),
    ("1220", "Staff Advances", "asset", "current_asset"),
    ("1230", "Prepaid Expenses", "asset", "current_asset"),
    ("1300", "Inventory - Medicines", "asset", "current_asset"),
    ("1310", "Inventory - Medical Supplies", "asset", "current_asset"),
    ("1320", "Inventory - OTC Products", "asset", "current_asset"),
    ("1390", "Inventory Reserve (Expired)", "asset", "current_asset"),
    ("1500", "Non-Current Assets", "asset", "fixed_asset"),
    ("1510", "Furniture & Fixtures", "asset", "fixed_asset"),
    ("1520", "Equipment", "asset", "fixed_asset"),
    ("1530", "Leasehold Improvements", "asset", "fixed_asset"),
    ("1590", "Accumulated Depreciation", "asset", "fixed_asset"),
    ("2000", "Current Liabilities", "liability", "current_liability"),
    ("2100", "Accounts Payable", "liability", "current_liability"),
    ("2110", "Accrued Expenses", "liability", "current_liability"),
    ("2120", "Customer Deposits", "liability", "current_liability"),
    ("2130", "Salaries Payable", "liability", "current_liability"),
    ("2140", "PAYE Payable", "liability", "current_liability"),
    ("2150", "NSSF Payable", "liability", "current_liability"),
    ("2160", "VAT Payable", "liability", "current_liability"),
    ("2170", "Withholding Tax Payable", "liability", "current_liability"),
    ("2500", "Non-Current Liabilities", "liability", "long_term_liability"),
    ("2510", "Bank Loan", "liability", "long_term_liability"),
    ("3000", "Equity", "equity", "owner_equity"),
    ("3100", "Owner Capital", "equity", "owner_equity"),
    ("3200", "Retained Earnings", "equity", "retained_earnings"),
    ("3300", "Owner Drawings", "equity", "owner_equity"),
    ("4000", "Revenue", "revenue", "operating_revenue"),
    ("4100", "Medicine Sales", "revenue", "operating_revenue"),
    ("4110", "OTC & Cosmetics Sales", "revenue", "operating_revenue"),
    ("4120", "Medical Supplies Sales", "revenue", "operating_revenue"),
    ("4200", "Dispensing Fees", "revenue", "operating_revenue"),
    ("4300", "Other Income", "revenue", "non_operating_revenue"),
    ("4400", "Sales Discounts Given", "revenue", "operating_revenue"),
    ("5000", "Cost of Goods Sold", "expense", "operating_expense"),
    ("5100", "Medicine Purchases", "expense", "operating_expense"),
    ("5110", "Medical Supplies Purchases", "expense", "operating_expense"),
    ("5120", "Purchase Discounts Received", "expense", "operating_expense"),
    ("5130", "Freight & Delivery Inward", "expense", "operating_expense"),
    ("5200", "Inventory Write-offs", "expense", "operating_expense"),
    ("6000", "Operating Expenses", "expense", "operating_expense"),
    ("6100", "Staff Salaries", "expense", "operating_expense"),
    ("6110", "NSSF Contributions", "expense", "operating_expense"),
    ("6120", "Staff Training", "expense", "administrative_expense"),
    ("6200", "Rent & Rates", "expense", "operating_expense"),
    ("6210", "Utilities - Electricity", "expense", "operating_expense"),
    ("6220", "Utilities - Water", "expense", "operating_expense"),
    ("6230", "Internet & Telephone", "expense", "operating_expense"),
    ("6300", "Advertising & Marketing", "expense", "selling_expense"),
    ("6310", "Delivery & Transport", "expense", "selling_expense"),
    ("6320", "Packaging & Bags", "expense", "selling_expense"),
    ("6330", "Repairs & Maintenance", "expense", "operating_expense"),
    ("6340", "Cleaning & Sanitation", "expense", "operating_expense"),
    ("6400", "Licences & Permits", "expense", "administrative_expense"),
    ("6410", "Professional Fees", "expense", "administrative_expense"),
    ("6420", "Insurance", "expense", "administrative_expense"),
    ("6430", "Bank Charges", "expense", "financial_expense"),
    ("6440", "Depreciation Expense", "expense", "operating_expense"),
    ("6450", "Miscellaneous Expenses", "expense", "other_expense"),
    ("7000", "Financial Items", "expense", "financial_expense"),
    ("7100", "Interest Income", "revenue", "non_operating_revenue"),
    ("7200", "Interest Expense", "expense", "financial_expense"),
    ("7300", "Exchange Gains/Losses", "expense", "financial_expense"),
]


def seed_chart_of_accounts(company_id: int) -> None:
    client = get_client()
    for code, name, atype, subtype in _COA:
        existing = (
            client.table("chart_of_accounts")
            .select("id")
            .eq("company_id", company_id)
            .eq("account_code", code)
            .execute()
            .data
        )
        row = {
            "company_id": company_id,
            "account_code": code,
            "account_name": name,
            "account_type": atype,
            "account_subtype": subtype,
            "parent_account_id": None,
            "is_active": True,
        }
        if existing:
            client.table("chart_of_accounts").update(row).eq(
                "id", existing[0]["id"]
            ).execute()
        else:
            client.table("chart_of_accounts").insert(row).execute()
    log_ok(f"Chart of accounts ensured ({len(_COA)}) for company {company_id}.")


# ─────────────────────────────────────────────────────────────────────────────
# 8. Income categories
# FIX: upsert on (company_id, category_name) not bare id
# ─────────────────────────────────────────────────────────────────────────────
_INCOME_CATS = [
    "Income",
    "Medicine Sales",
    "Surgical & Medical Supplies",
    "Baby & Mother Care",
    "Cosmetics & Beauty",
    "Nutrition & Supplements",
    "Medical Devices",
    "Laboratory Services",
    "Consultation Fees",
    "Vaccine & Immunization Services",
    "Online/Telepharmacy Sales",
    "Insurance Reimbursements",
    "Government Subsidies/Grants",
    "Other Income",
    "Prescription Drugs",
    "Over-the-Counter (OTC)",
]


def seed_income_categories(company_id: int) -> None:
    client = get_client()
    for i, name in enumerate(_INCOME_CATS, 1):
        existing = (
            client.table("income_categories")
            .select("id")
            .eq("company_id", company_id)
            .eq("category_name", name)
            .execute()
            .data
        )
        row = {
            "company_id": company_id,
            "category_name": name,
            "category_code": f"INC-{i:03d}",
            "is_active": True,
        }
        if existing:
            client.table("income_categories").update(row).eq(
                "id", existing[0]["id"]
            ).execute()
        else:
            client.table("income_categories").insert(row).execute()
    log_ok(f"Income categories ensured ({len(_INCOME_CATS)}) for company {company_id}.")


# ─────────────────────────────────────────────────────────────────────────────
# 9. Expense categories
# FIX: upsert on (company_id, category_name) not bare id
# ─────────────────────────────────────────────────────────────────────────────
_EXPENSE_CATS = [
    "Expenses",
    "Cost of Goods Sold",
    "Salaries & Wages",
    "Rent & Utilities",
    "Licenses & Regulatory Fees",
    "Marketing & Advertising",
    "Professional Fees",
    "Insurance",
    "Bank Charges & Interest",
    "Repairs & Maintenance",
    "Office Supplies",
    "Transportation & Delivery",
    "Taxes & Duties",
    "Training & Staff Development",
    "Depreciation",
    "Inventory Loss/Shrinkage",
    "Waste Disposal",
    "Software & IT Subscriptions",
    "Patient Assistance Programs",
    "Other Expenses",
    "Medicine Purchases",
    "Supplies Purchases",
    "Pharmacist Salaries",
    "Support Staff Wages",
]


def seed_expense_categories(company_id: int) -> None:
    client = get_client()
    for i, name in enumerate(_EXPENSE_CATS, 1):
        existing = (
            client.table("expense_categories")
            .select("id")
            .eq("company_id", company_id)
            .eq("category_name", name)
            .execute()
            .data
        )
        row = {
            "company_id": company_id,
            "category_name": name,
            "category_code": f"EXP-{i:04d}",
            "is_active": True,
        }
        if existing:
            client.table("expense_categories").update(row).eq(
                "id", existing[0]["id"]
            ).execute()
        else:
            client.table("expense_categories").insert(row).execute()
    log_ok(
        f"Expense categories ensured ({len(_EXPENSE_CATS)}) for company {company_id}."
    )


# ─────────────────────────────────────────────────────────────────────────────
# 10. Products
#     is_restricted: alternates True/False so both paths can be tested
# ─────────────────────────────────────────────────────────────────────────────
_PRODUCTS_TEMPLATE = [
    # (name, generic_name, dosage_form, strength, requires_rx, is_controlled, cost, price, category_code, unit_code)
    (
        "Paracetamol 500mg Tabs",
        "Paracetamol",
        "Tablet",
        "500mg",
        False,
        False,
        800,
        1500,
        "TABLETS",
        "TAB",
    ),
    (
        "Amoxicillin 250mg Caps",
        "Amoxicillin",
        "Capsule",
        "250mg",
        True,
        False,
        2500,
        4500,
        "CAPSULES",
        "CAP",
    ),
    (
        "Metformin 500mg Tabs",
        "Metformin",
        "Tablet",
        "500mg",
        True,
        False,
        1200,
        2200,
        "TABLETS",
        "TAB",
    ),
    (
        "ORS Sachet",
        "Oral Rehydration Salts",
        "Sachet",
        "Standard",
        False,
        False,
        300,
        600,
        "SYRUPS",
        "SACH",
    ),
    (
        "Ibuprofen 400mg Tabs",
        "Ibuprofen",
        "Tablet",
        "400mg",
        False,
        False,
        900,
        1800,
        "TABLETS",
        "TAB",
    ),
    (
        "Amoxicillin 125mg Syrup",
        "Amoxicillin",
        "Syrup",
        "125mg/5ml",
        True,
        False,
        5000,
        8500,
        "SYRUPS",
        "BTL",
    ),
    (
        "Ciprofloxacin 500mg Tabs",
        "Ciprofloxacin",
        "Tablet",
        "500mg",
        True,
        False,
        3500,
        6000,
        "TABLETS",
        "TAB",
    ),
    (
        "Omeprazole 20mg Caps",
        "Omeprazole",
        "Capsule",
        "20mg",
        True,
        False,
        2000,
        3500,
        "CAPSULES",
        "CAP",
    ),
    (
        "Diclofenac 50mg Tabs",
        "Diclofenac",
        "Tablet",
        "50mg",
        True,
        False,
        1100,
        2000,
        "TABLETS",
        "TAB",
    ),
    (
        "Dettol 750ml Antiseptic",
        "Chloroxylenol",
        "Liquid",
        "4.8%",
        False,
        False,
        12000,
        18000,
        "DROPS",
        "BTL",
    ),
    (
        "Morphine 10mg Tabs",
        "Morphine Sulfate",
        "Tablet",
        "10mg",
        True,
        True,
        8000,
        14000,
        "TABLETS",
        "TAB",
    ),
    (
        "Insulin Glargine 100U/ml",
        "Insulin Glargine",
        "Injection",
        "100U/ml",
        True,
        True,
        45000,
        75000,
        "INJECTABLES",
        "VIAL",
    ),
    (
        "Salbutamol Inhaler",
        "Salbutamol",
        "Inhaler",
        "100mcg",
        True,
        False,
        15000,
        25000,
        "DROPS",
        "BTL",
    ),
    (
        "Multivitamin Tabs",
        "Multivitamins",
        "Tablet",
        "Standard",
        False,
        False,
        500,
        1000,
        "TABLETS",
        "TAB",
    ),
    (
        "Zinc 20mg Tabs",
        "Zinc Sulfate",
        "Tablet",
        "20mg",
        False,
        False,
        400,
        800,
        "TABLETS",
        "TAB",
    ),
]


def seed_products(company_id: int) -> None:
    client = get_client()

    cats = (
        client.table("categories")
        .select("id,category_code")
        .eq("company_id", company_id)
        .execute()
        .data
        or []
    )
    cat_map = {c["category_code"]: c["id"] for c in cats}

    units = (
        client.table("units")
        .select("id,short_code")
        .eq("company_id", company_id)
        .execute()
        .data
        or []
    )
    unit_map = {u["short_code"]: u["id"] for u in units}

    inserted = 0
    for i, (
        name,
        generic,
        dosage,
        strength,
        rx,
        controlled,
        cost,
        price,
        cat_code,
        unit_code,
    ) in enumerate(_PRODUCTS_TEMPLATE):
        code = f"PRD-{company_id:02d}-{i + 1:03d}"
        is_restricted = i % 2 == 0

        existing = (
            client.table("products")
            .select("id")
            .eq("company_id", company_id)
            .eq("product_code", code)
            .execute()
            .data
        )
        row = {
            "company_id": company_id,
            "product_name": name,
            "generic_name": generic,
            "product_code": code,
            "dosage_form": dosage,
            "strength": strength,
            "manufacturer": "Generic Pharma Ltd",
            "category_id": cat_map.get(cat_code),
            "unit_id": unit_map.get(unit_code),
            "requires_prescription": rx,
            "is_controlled_substance": controlled,
            "reorder_level": 20,
            "max_stock_level": 500,
            "min_order_quantity": 1,
            "standard_cost": cost,
            "standard_price": price,
            "is_active": True,
            "is_restricted": is_restricted,
            "created_at": _now(),
            "updated_at": _now(),
        }
        if existing:
            client.table("products").update(row).eq("id", existing[0]["id"]).execute()
        else:
            client.table("products").insert(row).execute()
            inserted += 1

    log_ok(
        f"Products ensured ({len(_PRODUCTS_TEMPLATE)}, {inserted} new) for company {company_id}."
    )


# ─────────────────────────────────────────────────────────────────────────────
# 11. Inventory batches
#     is_restricted mirrors the product's value so views inherit it correctly
# ─────────────────────────────────────────────────────────────────────────────
def seed_inventory_batches(company_id: int) -> None:
    client = get_client()

    products = (
        client.table("products")
        .select("id,product_code,standard_cost,standard_price,is_restricted")
        .eq("company_id", company_id)
        .execute()
        .data
        or []
    )
    stores = (
        client.table("stores").select("id").eq("company_id", company_id).execute().data
        or []
    )
    suppliers = (
        client.table("suppliers")
        .select("id")
        .eq("company_id", company_id)
        .execute()
        .data
        or []
    )

    if not products or not stores:
        log_warn("No products or stores found — skipping inventory batches.")
        return

    supplier_ids = [s["id"] for s in suppliers]
    store_ids = [s["id"] for s in stores]
    inserted = 0

    for prod in products:
        for j, store_id in enumerate(store_ids):
            batch_num = f"BCH-{prod['product_code'][-6:]}-S{store_id:02d}-001"
            existing = (
                client.table("product_batches")
                .select("id")
                .eq("company_id", company_id)
                .eq("product_id", prod["id"])
                .eq("store_id", store_id)
                .eq("batch_number", batch_num)
                .execute()
                .data
            )
            if j == 0:
                expiry_offset = -10  # expired
            elif j == 1:
                expiry_offset = 15  # critical (< 30 days)
            elif j == 2:
                expiry_offset = 45  # expiring soon
            else:
                expiry_offset = 365  # normal

            qty = random.randint(50, 200)
            row = {
                "company_id": company_id,
                "product_id": prod["id"],
                "store_id": store_id,
                "batch_number": batch_num,
                "manufacturing_date": _today(-180),
                "expiry_date": _today(expiry_offset),
                "quantity_received": qty,
                "quantity_available": qty,
                "quantity_sold": 0,
                "unit_cost": prod["standard_cost"],
                "selling_price": prod["standard_price"],
                "supplier_id": supplier_ids[j % len(supplier_ids)]
                if supplier_ids
                else None,
                "is_active": True,
                "is_expired": expiry_offset < 0,
                "is_restricted": prod["is_restricted"],
                "created_at": _now(),
                "updated_at": _now(),
            }
            if existing:
                client.table("product_batches").update(row).eq(
                    "id", existing[0]["id"]
                ).execute()
            else:
                client.table("product_batches").insert(row).execute()
                inserted += 1

    log_ok(f"Inventory batches ensured ({inserted} new) for company {company_id}.")


# ─────────────────────────────────────────────────────────────────────────────
# 12. Sales
#     FIX: "partial" → "partially_paid" (valid payment_status enum value)
# ─────────────────────────────────────────────────────────────────────────────
def seed_sales(company_id: int) -> None:
    client = get_client()

    stores = (
        client.table("stores").select("id").eq("company_id", company_id).execute().data
        or []
    )
    customers = (
        client.table("customers")
        .select("id")
        .eq("company_id", company_id)
        .execute()
        .data
        or []
    )
    products = (
        client.table("products")
        .select("id,standard_price,is_restricted")
        .eq("company_id", company_id)
        .execute()
        .data
        or []
    )

    if not stores or not products:
        log_warn("Missing stores or products — skipping sales.")
        return

    store_ids = [s["id"] for s in stores]
    customer_ids = [c["id"] for c in customers]
    inserted = 0

    sale_templates = [
        # (days_ago, payment_method, payment_status, sale_status, is_restricted)
        # FIX: "partial" → "partially_paid" (invalid enum value in original)
        (1, "cash", "paid", "completed", False),
        (2, "cash", "paid", "completed", True),
        (3, "credit", "partially_paid", "completed", False),
        (5, "mobile_money", "paid", "completed", True),
        (7, "cash", "paid", "returned", False),
        (10, "credit", "unpaid", "completed", True),
        (12, "cash", "paid", "completed", False),
        (15, "cash", "paid", "cancelled", True),
        (20, "mobile_money", "paid", "completed", False),
        (25, "credit", "paid", "completed", True),
        (30, "cash", "paid", "completed", False),
        (35, "cash", "paid", "completed", True),
    ]

    for idx, (
        days_ago,
        pay_method,
        pay_status,
        sale_status,
        is_restricted,
    ) in enumerate(sale_templates):
        store_id = store_ids[idx % len(store_ids)]
        customer_id = customer_ids[idx % len(customer_ids)] if customer_ids else None
        sale_num = f"SAL-{company_id:02d}-{idx + 1:04d}"
        total = random.randint(5000, 150000)
        sale_date = _today(-days_ago)

        existing = (
            client.table("sales")
            .select("id")
            .eq("company_id", company_id)
            .eq("sale_number", sale_num)
            .execute()
            .data
        )
        row = {
            "company_id": company_id,
            "store_id": store_id,
            "customer_id": customer_id,
            "sale_number": sale_num,
            "sale_type": "retail",
            "sale_date": sale_date,
            "subtotal": total,
            "discount_amount": 0,
            "tax_amount": 0,
            "total_amount": total,
            "amount_paid": total
            if pay_status == "paid"
            else (total // 2 if pay_status == "partially_paid" else 0),
            "payment_method": pay_method,
            "payment_status": pay_status,
            "sale_status": sale_status,
            "is_restricted": is_restricted,
            "created_at": f"{sale_date}T10:00:00+00:00",
            "updated_at": _now(),
        }
        if existing:
            client.table("sales").update(row).eq("id", existing[0]["id"]).execute()
        else:
            client.table("sales").insert(row).execute()
            inserted += 1

    log_ok(
        f"Sales ensured ({len(sale_templates)}, {inserted} new) for company {company_id}."
    )


# ─────────────────────────────────────────────────────────────────────────────
# 13. Purchase orders + returns
# ─────────────────────────────────────────────────────────────────────────────
def seed_purchase_orders(company_id: int) -> None:
    client = get_client()

    stores = (
        client.table("stores").select("id").eq("company_id", company_id).execute().data
        or []
    )
    suppliers = (
        client.table("suppliers")
        .select("id")
        .eq("company_id", company_id)
        .execute()
        .data
        or []
    )

    if not stores or not suppliers:
        log_warn("Missing stores or suppliers — skipping purchase orders.")
        return

    store_ids = [s["id"] for s in stores]
    supplier_ids = [s["id"] for s in suppliers]
    inserted = 0

    po_templates = [
        # (days_ago, status, is_restricted)
        (5, "received", False),
        (10, "received", True),
        (15, "approved", False),
        (20, "pending", True),
        (25, "received", False),
        (30, "received", True),
    ]

    for idx, (days_ago, status, is_restricted) in enumerate(po_templates):
        po_num = f"PO-{company_id:02d}-{idx + 1:04d}"
        store_id = store_ids[idx % len(store_ids)]
        supplier_id = supplier_ids[idx % len(supplier_ids)]
        total = random.randint(50000, 500000)
        po_date = _today(-days_ago)

        existing = (
            client.table("purchase_orders")
            .select("id")
            .eq("company_id", company_id)
            .eq("po_number", po_num)
            .execute()
            .data
        )
        row = {
            "company_id": company_id,
            "store_id": store_id,
            "supplier_id": supplier_id,
            "po_number": po_num,
            "po_date": po_date,
            "subtotal": total,
            "tax_amount": 0,
            "discount_amount": 0,
            "total_amount": total,
            "payment_terms": "net30",
            "payment_method": "bank_transfer",
            "status": status,
            "notes": f"Seed PO {idx + 1}",
            "is_restricted": is_restricted,
            "created_at": f"{po_date}T08:00:00+00:00",
            "updated_at": _now(),
        }
        if existing:
            client.table("purchase_orders").update(row).eq(
                "id", existing[0]["id"]
            ).execute()
        else:
            client.table("purchase_orders").insert(row).execute()
            inserted += 1

    log_ok(
        f"Purchase orders ensured ({len(po_templates)}, {inserted} new) for company {company_id}."
    )


def seed_purchase_returns(company_id: int) -> None:
    client = get_client()

    pos = (
        client.table("purchase_orders")
        .select("id,store_id,supplier_id")
        .eq("company_id", company_id)
        .eq("status", "received")
        .execute()
        .data
        or []
    )

    if not pos:
        log_warn("No received POs found — skipping purchase returns.")
        return

    inserted = 0
    ret_templates = [
        # (po_index, status, is_restricted)
        (0, "approved", False),
        (1, "pending", True),
        (2, "completed", False),
        (3, "approved", True),
    ]

    for idx, (po_idx, status, is_restricted) in enumerate(ret_templates):
        if po_idx >= len(pos):
            continue
        po = pos[po_idx]
        ret_num = f"PR-{company_id:02d}-{idx + 1:04d}"
        total_refund = random.randint(10000, 80000)

        existing = (
            client.table("purchase_returns")
            .select("id")
            .eq("company_id", company_id)
            .eq("return_number", ret_num)
            .execute()
            .data
        )
        row = {
            "company_id": company_id,
            "store_id": po["store_id"],
            "supplier_id": po["supplier_id"],
            "purchase_order_id": po["id"],
            "return_number": ret_num,
            "return_date": _today(-(idx + 1) * 3),
            "return_reason": "Damaged goods on delivery",
            "total_refund_amount": total_refund,
            "refund_method": "bank_transfer",
            "status": status,
            "is_restricted": is_restricted,
            "created_at": _now(),
            "updated_at": _now(),
        }
        if existing:
            client.table("purchase_returns").update(row).eq(
                "id", existing[0]["id"]
            ).execute()
        else:
            client.table("purchase_returns").insert(row).execute()
            inserted += 1

    log_ok(f"Purchase returns ensured ({inserted} new) for company {company_id}.")


# ─────────────────────────────────────────────────────────────────────────────
# 14. Sales returns
# ─────────────────────────────────────────────────────────────────────────────
def seed_sales_returns(company_id: int) -> None:
    client = get_client()

    sales = (
        client.table("sales")
        .select("id,store_id")
        .eq("company_id", company_id)
        .eq("sale_status", "completed")
        .execute()
        .data
        or []
    )

    if not sales:
        log_warn("No completed sales found — skipping sales returns.")
        return

    inserted = 0
    ret_templates = [
        # (sale_index, status, is_restricted)
        (0, "completed", False),
        (1, "pending", True),
        (2, "approved", False),
        (3, "pending", True),
    ]

    for idx, (sale_idx, status, is_restricted) in enumerate(ret_templates):
        if sale_idx >= len(sales):
            continue
        sale = sales[sale_idx]
        ret_num = f"RET-{company_id:02d}-{idx + 1:04d}"
        refund = random.randint(3000, 30000)

        existing = (
            client.table("sales_returns")
            .select("id")
            .eq("company_id", company_id)
            .eq("return_number", ret_num)
            .execute()
            .data
        )
        row = {
            "company_id": company_id,
            "store_id": sale["store_id"],
            "sale_id": sale["id"],
            "return_number": ret_num,
            "return_date": _today(-(idx + 1) * 2),
            "return_reason": "Customer not satisfied",
            "total_refund_amount": refund,
            "refund_method": "cash",
            "status": status,
            "is_restricted": is_restricted,
            "created_at": _now(),
            "updated_at": _now(),
        }
        if existing:
            client.table("sales_returns").update(row).eq(
                "id", existing[0]["id"]
            ).execute()
        else:
            client.table("sales_returns").insert(row).execute()
            inserted += 1

    log_ok(f"Sales returns ensured ({inserted} new) for company {company_id}.")


# ─────────────────────────────────────────────────────────────────────────────
# 15. Expenses
#     FIX: removed non-existent columns `discount_percentage` and `discount_amount`
# ─────────────────────────────────────────────────────────────────────────────
def seed_expenses(company_id: int) -> None:
    client = get_client()

    stores = (
        client.table("stores").select("id").eq("company_id", company_id).execute().data
        or []
    )
    cats = (
        client.table("expense_categories")
        .select("id")
        .eq("company_id", company_id)
        .execute()
        .data
        or []
    )

    if not stores or not cats:
        log_warn("No stores or expense categories — skipping expenses.")
        return

    store_ids = [s["id"] for s in stores]
    cat_ids = [c["id"] for c in cats]
    inserted = 0

    exp_templates = [
        # (days_ago, amount, payment_method, status, is_restricted)
        (1, 250000, "cash", "posted", False),
        (3, 80000, "bank_transfer", "posted", True),
        (5, 45000, "cash", "approved", False),
        (7, 120000, "mobile_money", "posted", True),
        (10, 35000, "cash", "pending", False),
        (12, 500000, "bank_transfer", "posted", True),
        (15, 20000, "cash", "approved", False),
        (18, 75000, "cash", "posted", True),
    ]

    for idx, (days_ago, amount, pay_method, status, is_restricted) in enumerate(
        exp_templates
    ):
        exp_num = f"EXP-{company_id:02d}-{idx + 1:04d}"
        store_id = store_ids[idx % len(store_ids)]
        cat_id = cat_ids[idx % len(cat_ids)]
        exp_date = _today(-days_ago)

        existing = (
            client.table("expenses")
            .select("id")
            .eq("company_id", company_id)
            .eq("expense_number", exp_num)
            .execute()
            .data
        )
        row = {
            "company_id": company_id,
            "store_id": store_id,
            "category_id": cat_id,
            "expense_number": exp_num,
            "expense_date": exp_date,
            "description": f"Seed expense {idx + 1}",
            "amount": amount,
            "tax_rate": 0,
            "tax_amount": 0,
            # FIX: removed discount_percentage and discount_amount — columns do not exist
            "total_amount": amount,
            "payment_method": pay_method,
            "payment_status": "paid" if status in ("posted", "approved") else "unpaid",
            "status": status,
            "is_system": False,
            "is_posted": status == "posted",
            "is_restricted": is_restricted,
            "created_at": f"{exp_date}T09:00:00+00:00",
            "updated_at": _now(),
        }
        if existing:
            client.table("expenses").update(row).eq("id", existing[0]["id"]).execute()
        else:
            client.table("expenses").insert(row).execute()
            inserted += 1

    log_ok(
        f"Expenses ensured ({len(exp_templates)}, {inserted} new) for company {company_id}."
    )


# ─────────────────────────────────────────────────────────────────────────────
# 16. Income
#     FIX: removed non-existent columns `discount_percentage` and `discount_amount`
# ─────────────────────────────────────────────────────────────────────────────
def seed_income(company_id: int) -> None:
    client = get_client()

    stores = (
        client.table("stores").select("id").eq("company_id", company_id).execute().data
        or []
    )
    cats = (
        client.table("income_categories")
        .select("id")
        .eq("company_id", company_id)
        .execute()
        .data
        or []
    )

    if not stores or not cats:
        log_warn("No stores or income categories — skipping income.")
        return

    store_ids = [s["id"] for s in stores]
    cat_ids = [c["id"] for c in cats]
    inserted = 0

    inc_templates = [
        # (days_ago, amount, payment_method, status, is_restricted)
        (1, 350000, "cash", "approved", False),
        (3, 120000, "mobile_money", "approved", True),
        (5, 80000, "cash", "posted", False),
        (7, 500000, "bank_transfer", "posted", True),
        (10, 45000, "cash", "pending", False),
        (12, 200000, "cash", "posted", True),
        (15, 60000, "mobile_money", "approved", False),
        (20, 750000, "bank_transfer", "posted", True),
    ]

    for idx, (days_ago, amount, pay_method, status, is_restricted) in enumerate(
        inc_templates
    ):
        inc_num = f"INC-{company_id:02d}-{idx + 1:04d}"
        store_id = store_ids[idx % len(store_ids)]
        cat_id = cat_ids[idx % len(cat_ids)]
        inc_date = _today(-days_ago)

        existing = (
            client.table("income")
            .select("id")
            .eq("company_id", company_id)
            .eq("income_number", inc_num)
            .execute()
            .data
        )
        row = {
            "company_id": company_id,
            "store_id": store_id,
            "category_id": cat_id,
            "income_number": inc_num,
            "income_date": inc_date,
            "description": f"Seed income {idx + 1}",
            "amount": amount,
            "tax_rate": 0,
            "tax_amount": 0,
            # FIX: removed discount_percentage and discount_amount — columns do not exist
            "total_amount": amount,
            "payment_method": pay_method,
            "reference_type": "manual",
            "status": status,
            "is_system": False,
            "is_posted": status == "posted",
            "is_restricted": is_restricted,
            "created_at": f"{inc_date}T09:00:00+00:00",
            "updated_at": _now(),
        }
        if existing:
            client.table("income").update(row).eq("id", existing[0]["id"]).execute()
        else:
            client.table("income").insert(row).execute()
            inserted += 1

    log_ok(
        f"Income ensured ({len(inc_templates)}, {inserted} new) for company {company_id}."
    )


# ─────────────────────────────────────────────────────────────────────────────
# FK-safe pipeline
# ─────────────────────────────────────────────────────────────────────────────
def make_pipeline(company_id: int) -> list[tuple[str, Callable[[], None]]]:
    return [
        ("company", lambda: seed_company(company_id)),
        ("settings", lambda: seed_company_settings(company_id)),
        ("roles", lambda: seed_roles(company_id)),
        ("permissions", seed_permissions),  # global — no company_id
        ("role_permissions", lambda: seed_role_permissions(company_id)),
        ("categories", lambda: seed_categories(company_id)),
        ("units", lambda: seed_units(company_id)),
        ("coa", lambda: seed_chart_of_accounts(company_id)),
        ("income_cats", lambda: seed_income_categories(company_id)),
        ("expense_cats", lambda: seed_expense_categories(company_id)),
        ("products", lambda: seed_products(company_id)),
        ("inventory_batches", lambda: seed_inventory_batches(company_id)),
        ("purchase_orders", lambda: seed_purchase_orders(company_id)),
        ("purchase_returns", lambda: seed_purchase_returns(company_id)),
        ("sales", lambda: seed_sales(company_id)),
        ("sales_returns", lambda: seed_sales_returns(company_id)),
        ("expenses", lambda: seed_expenses(company_id)),
        ("income", lambda: seed_income(company_id)),
    ]


# Legacy alias so old import `from template_seeder import SEED_PIPELINE` still works
SEED_PIPELINE = make_pipeline(CID)

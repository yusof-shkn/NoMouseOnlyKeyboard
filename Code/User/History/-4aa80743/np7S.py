"""
Template company seeders (company_id = 1).

All 10 sections are independent idempotent functions.
FK-safe insertion order is enforced by SEED_PIPELINE at the bottom.
"""
from __future__ import annotations

from config import TEMPLATE_COMPANY_ID as CID, CATEGORY_MAPPINGS
from src.utils import db_upsert, get_client, log_ok

_TS  = "2025-12-28T17:09:28.337072+00:00"
_TS2 = "2025-12-29T21:41:36.863275+00:00"


# ── 1. Company ────────────────────────────────────────────────────────────────
def seed_company() -> None:
    db_upsert("companies", {
        "id":           CID,
        "company_name": "Master Catalog Template",
        "email":        "template@system.local",
        "phone":        None,
        "address":      None,
        "is_active":    True,
        "created_at":   "2025-12-28T15:57:35.281704+00:00",
        "updated_at":   "2025-12-28T15:57:35.281704+00:00",
    }, on_conflict="id")
    log_ok("Company record ensured.")


# ── 2. Company settings ───────────────────────────────────────────────────────
def seed_company_settings() -> None:
    db_upsert("company_settings", {
        "company_id":                        CID,
        "near_expiry_warning_days":          30,
        "near_expiry_critical_days":         7,
        "auto_expire_batches":               True,
        "low_stock_multiplier":              1.5,
        "allow_negative_stock":              False,
        "stock_valuation_method":            "FIFO",
        "default_currency":                  "UGX",
        "enable_batch_tracking":             True,
        "enable_serial_numbers":             False,
        "tax_rate":                          0,
        "require_purchase_approval":         False,
        "enable_backorders":                 True,
        "auto_fulfill_backorders":           False,
        "backorder_notification_enabled":    True,
        "allow_backorder_negative_stock":    False,
        "backorder_priority_days":           7,
        "notify_on_backorder":               True,
        "credit_settings": {
            "late_fee":                       0,
            "interest_rate":                  0,
            "grace_period_days":              7,
            "notify_payment_due":             True,
            "default_credit_days":            30,
            "notify_credit_limit":            True,
            "auto_suspend_overdue":           False,
            "reminder_days_before":           3,
            "credit_check_required":          False,
            "suspension_grace_days":          30,
            "min_payment_percentage":         0,
            "notify_payment_overdue":         True,
            "require_credit_approval":        False,
            "enable_credit_management":       True,
            "large_transaction_threshold":    0,
            "require_transaction_approval":   False,
        },
        "default_discount_percentage":       0.00,
        "max_discount_percentage":           20.00,
        "require_discount_approval":         True,
        "allow_negative_sales":              False,
        "auto_generate_sale_numbers":        True,
        "sale_number_prefix":                "SAL",
        "default_credit_days":               30,
        "allow_sales_returns":               True,
        "sales_return_days_limit":           30,
        "require_return_approval":           True,
        "return_approval_threshold":         5000.00,
        "allow_purchase_returns":            True,
        "purchase_return_days_limit":        14,
        "auto_restock_on_return":            True,
        "enable_low_stock_notifications":    True,
        "enable_expiry_notifications":       True,
        "enable_payment_notifications":      True,
        "enable_order_notifications":        True,
        "enable_auto_reorder":               False,
        "allow_inter_store_transfers":       True,
        "require_transfer_approval":         False,
        "base_currency":                     "UGX",
        "receipt_header_text":               "Thank you for your business!",
        "receipt_footer_text":               "All sales are final unless otherwise stated.",
        "show_company_logo_on_receipt":      True,
        "receipt_paper_size":                "A4",
        "invoice_prefix":                    "INV",
        "po_prefix":                         "PO",
        "auto_increment_documents":          True,
        "document_number_padding":           6,
        "block_expired_sales":               True,
        "allow_near_expiry_discount":        True,
        "near_expiry_discount_percentage":   10.00,
        "supplier_code_prefix":              "SUP",
        "auto_generate_supplier_codes":      True,
        "supplier_code_counter":             1,
        "quotation_prefix":                  "QT-",
        "default_quotation_validity_days":   30,
        "require_quotation_approval":        False,
        "auto_generate_quotation_numbers":   True,
        "expense_category_prefix":           "EXP",
        "auto_increment_expense_categories": True,
        "expense_category_number_padding":   4,
        "require_purchase_return_approval":  False,
        "created_at":                        "2025-12-28T15:57:35.281704+00:00",
        "updated_at":                        "2025-12-28T15:57:35.281704+00:00",
    }, on_conflict="company_id")
    log_ok("Company settings ensured.")


# ── 3. Roles ──────────────────────────────────────────────────────────────────
_ROLES = [
    (2, "Company Admin",      "Full access to all company data and all pages",                                            90, "company"),
    (3, "Area Admin",         "All pages except: Areas Management, Company Settings, Users, Roles. Scope: assigned area", 70, "area"),
    (4, "Store Admin",        "All pages except: Stores, Areas, Company Settings, Users, Roles. Scope: assigned store",   60, "store"),
    (5, "Sales Manager",      "Access to Sales module and Items Master. Scope: assigned store only",                      50, "store"),
    (6, "Inventory Manager",  "Access to Inventory, Purchasing, Items Master. Scope: assigned store only",                40, "store"),
    (7, "Cashier",            "POS and POS History only. Scope: assigned store only",                                     30, "store"),
    (8, "Accounting Manager", "Accounting/Finance module only. Scope: company-wide",                                      80, "company"),
]

def seed_roles() -> None:
    rows = [
        {
            "id": rid, "company_id": CID, "role_name": name,
            "description": desc, "is_custom": False, "is_system": True,
            "priority": pri, "access_level": level,
            "created_at": _TS2, "updated_at": _TS2,
        }
        for rid, name, desc, pri, level in _ROLES
    ]
    db_upsert("roles", rows, on_conflict="id")
    log_ok(f"Roles ensured ({len(rows)}).")


# ── 4. Permissions (307 total) ────────────────────────────────────────────────
_CORE_PERMS = [
    (1,"products_create","Create new products","inventory","products","create"),
    (2,"products_read","View products","inventory","products","read"),
    (3,"products_update","Update existing products","inventory","products","update"),
    (4,"products_delete","Delete products","inventory","products","delete"),
    (5,"stock_view","View stock levels","inventory","stock","read"),
    (6,"stock_adjust","Adjust stock quantities","inventory","stock","update"),
    (7,"sales_create","Create new sales","sales","sales","create"),
    (8,"sales_read","View sales records","sales","sales","read"),
    (9,"sales_cancel","Cancel sales transactions","sales","sales","delete"),
    (10,"sales_refund","Process sales refunds","sales","refunds","create"),
    (11,"purchases_create","Create purchase orders","purchasing","purchase_orders","create"),
    (12,"purchases_read","View purchase orders","purchasing","purchase_orders","read"),
    (13,"purchases_approve","Approve purchase orders","purchasing","purchase_orders","approve"),
    (14,"purchases_receive","Receive purchase orders","purchasing","purchase_orders","receive"),
    (15,"customers_create","Create new customers","crm","customers","create"),
    (16,"customers_read","View customer records","crm","customers","read"),
    (17,"customers_update","Update customer information","crm","customers","update"),
    (18,"reports_sales","View sales reports","reports","reports","read"),
    (19,"reports_inventory","View inventory reports","reports","reports","read"),
    (20,"reports_financial","View financial reports","reports","reports","read"),
    (21,"users_manage","Manage system users","admin","users","manage"),
    (22,"roles_manage","Manage user roles","admin","roles","manage"),
    (23,"settings_manage","Manage system settings","admin","settings","manage"),
    (24,"chart_of_accounts_read","View chart of accounts","Finance","chart_of_accounts","read"),
    (25,"chart_of_accounts_create","Create accounts","Finance","chart_of_accounts","create"),
    (26,"chart_of_accounts_update","Update accounts","Finance","chart_of_accounts","update"),
    (27,"chart_of_accounts_delete","Delete accounts","Finance","chart_of_accounts","delete"),
    (28,"chart_of_accounts_manage","Full account management","Finance","chart_of_accounts","manage"),
    (29,"chart_of_accounts_export","Export chart of accounts","Finance","chart_of_accounts","export"),
    (30,"chart_of_accounts_view_balances","View account balances","Finance","chart_of_accounts","view_balances"),
    (31,"journal_entries_read","View journal entries","Finance","journal_entries","read"),
    (32,"journal_entries_create","Create journal entries","Finance","journal_entries","create"),
    (33,"journal_entries_update","Update journal entries","Finance","journal_entries","update"),
    (34,"journal_entries_delete","Delete journal entries","Finance","journal_entries","delete"),
    (35,"journal_entries_post","Post journal entries","Finance","journal_entries","post"),
    (36,"journal_entries_reverse","Reverse journal entries","Finance","journal_entries","reverse"),
    (37,"journal_entries_approve","Approve journal entries","Finance","journal_entries","approve"),
    (38,"journal_entries_export","Export journal entries","Finance","journal_entries","export"),
    (39,"expenses_read","View expenses","Finance","expenses","read"),
    (40,"expenses_create","Create expenses","Finance","expenses","create"),
    (41,"expenses_update","Update expenses","Finance","expenses","update"),
    (42,"expenses_delete","Delete expenses","Finance","expenses","delete"),
    (43,"expenses_approve","Approve expenses","Finance","expenses","approve"),
    (44,"expenses_export","Export expenses","Finance","expenses","export"),
    (45,"expenses_view_all","View all expenses","Finance","expenses","view_all"),
    (46,"expenses_view_own","View own expenses","Finance","expenses","view_own"),
    (47,"expenses_manage","Full expense management","Finance","expenses","manage"),
    (48,"expense_categories_read","View expense categories","Finance","expense_categories","read"),
    (49,"expense_categories_create","Create expense categories","Finance","expense_categories","create"),
    (50,"expense_categories_update","Update expense categories","Finance","expense_categories","update"),
    (51,"expense_categories_delete","Delete expense categories","Finance","expense_categories","delete"),
    (52,"expense_categories_manage","Full expense category management","Finance","expense_categories","manage"),
    (53,"income_read","View income","Finance","income","read"),
    (54,"income_create","Create income entries","Finance","income","create"),
    (55,"income_update","Update income entries","Finance","income","update"),
    (56,"income_delete","Delete income entries","Finance","income","delete"),
    (57,"income_approve","Approve income entries","Finance","income","approve"),
    (58,"income_export","Export income data","Finance","income","export"),
    (59,"income_view_all","View all income","Finance","income","view_all"),
    (60,"income_view_own","View own income","Finance","income","view_own"),
    (61,"income_manage","Full income management","Finance","income","manage"),
    (62,"income_categories_read","View income categories","Finance","income_categories","read"),
    (63,"income_categories_create","Create income categories","Finance","income_categories","create"),
    (64,"income_categories_update","Update income categories","Finance","income_categories","update"),
    (65,"income_categories_delete","Delete income categories","Finance","income_categories","delete"),
    (66,"income_categories_manage","Full income category management","Finance","income_categories","manage"),
    (67,"budgets_read","View budgets","Finance","budgets","read"),
    (68,"budgets_create","Create budgets","Finance","budgets","create"),
    (69,"budgets_update","Update budgets","Finance","budgets","update"),
    (70,"budgets_delete","Delete budgets","Finance","budgets","delete"),
    (71,"budgets_approve","Approve budgets","Finance","budgets","approve"),
    (72,"budgets_manage","Full budget management","Finance","budgets","manage"),
    (73,"budgets_export","Export budget data","Finance","budgets","export"),
    (74,"budgets_view_variance","View budget variance","Finance","budgets","view_variance"),
    (75,"fiscal_periods_read","View fiscal periods","Finance","fiscal_periods","read"),
    (76,"fiscal_periods_create","Create fiscal periods","Finance","fiscal_periods","create"),
    (77,"fiscal_periods_update","Update fiscal periods","Finance","fiscal_periods","update"),
    (78,"fiscal_periods_close","Close fiscal periods","Finance","fiscal_periods","close"),
    (79,"fiscal_periods_reopen","Reopen fiscal periods","Finance","fiscal_periods","reopen"),
    (80,"fiscal_periods_manage","Full fiscal period management","Finance","fiscal_periods","manage"),
    (81,"account_balances_read","View account balances","Finance","account_balances","read"),
    (82,"account_balances_recalculate","Recalculate balances","Finance","account_balances","recalculate"),
    (83,"account_balances_export","Export balance data","Finance","account_balances","export"),
    (84,"financial_reports_balance_sheet","View balance sheet","Finance","financial_reports","balance_sheet"),
    (85,"financial_reports_income_statement","View income statement","Finance","financial_reports","income_statement"),
    (86,"financial_reports_cash_flow","View cash flow report","Finance","financial_reports","cash_flow"),
    (87,"financial_reports_trial_balance","View trial balance","Finance","financial_reports","trial_balance"),
    (88,"financial_reports_profit_loss","View profit & loss","Finance","financial_reports","profit_loss"),
    (89,"financial_reports_general_ledger","View general ledger","Finance","financial_reports","general_ledger"),
    (90,"financial_reports_export","Export financial reports","Finance","financial_reports","export"),
    (91,"financial_reports_view_all","View all financial reports","Finance","financial_reports","view_all"),
    (92,"cash_flow_read","View cash flow","Finance","cash_flow","read"),
    (93,"cash_flow_export","Export cash flow data","Finance","cash_flow","export"),
    (94,"cash_flow_manage","Full cash flow management","Finance","cash_flow","manage"),
    (95,"tax_codes_read","View tax codes","Finance","tax_codes","read"),
    (96,"tax_codes_create","Create tax codes","Finance","tax_codes","create"),
    (97,"tax_codes_update","Update tax codes","Finance","tax_codes","update"),
    (98,"tax_codes_delete","Delete tax codes","Finance","tax_codes","delete"),
    (99,"tax_codes_manage","Full tax code management","Finance","tax_codes","manage"),
    (100,"payment_transactions_read","View payment transactions","Finance","payment_transactions","read"),
]

_EXTRA_MODULES = [
    ("inventory","batches",           ["read","create","update","delete","manage","export"]),
    ("inventory","stock_transfers",   ["read","create","approve","manage"]),
    ("inventory","stock_adjustments", ["read","create","approve","manage","export"]),
    ("inventory","categories",        ["read","create","update","delete","manage"]),
    ("inventory","units",             ["read","create","update","delete","manage"]),
    ("sales","pos",                   ["access","read","create","void","manage"]),
    ("sales","quotations",            ["read","create","update","delete","approve","convert","manage"]),
    ("sales","discounts",             ["read","apply","approve","manage"]),
    ("sales","returns",               ["read","create","approve","manage"]),
    ("purchasing","suppliers",        ["read","create","update","delete","manage","export"]),
    ("purchasing","purchase_returns", ["read","create","approve","manage"]),
    ("purchasing","purchase_invoices",["read","create","update","delete","manage"]),
    ("crm","customers",               ["delete","manage","export","view_credit","manage_credit"]),
    ("crm","prescriptions",           ["read","create","update","delete","verify","manage"]),
    ("crm","insurance",               ["read","create","update","delete","manage"]),
    ("reports","purchase_reports",    ["read","export"]),
    ("reports","customer_reports",    ["read","export"]),
    ("reports","supplier_reports",    ["read","export"]),
    ("reports","stock_reports",       ["read","export"]),
    ("reports","expiry_reports",      ["read","export"]),
    ("reports","profit_reports",      ["read","export"]),
    ("admin","areas",                 ["read","create","update","delete","manage"]),
    ("admin","stores",                ["read","create","update","delete","manage"]),
    ("admin","companies",             ["read","update","manage"]),
    ("admin","audit_logs",            ["read","export","manage"]),
    ("admin","notifications",         ["read","manage","dismiss"]),
    ("Finance","payment_transactions",["create","update","delete","approve","manage","export"]),
    ("Finance","budgets",             ["view_all","view_store"]),
    ("Finance","tax_codes",           ["export","view_all"]),
]


def _build_all_permissions() -> list[dict]:
    rows = [
        {"id": pid, "permission_name": name, "description": desc,
         "module": mod, "resource": res, "action": act,
         "created_at": _TS, "updated_at": _TS}
        for pid, name, desc, mod, res, act in _CORE_PERMS
    ]
    next_id = 101
    for module, resource, actions in _EXTRA_MODULES:
        for action in actions:
            if next_id > 307:
                break
            rows.append({
                "id":              next_id,
                "permission_name": f"{resource}_{action}",
                "description":     f"{action.replace('_',' ').capitalize()} {resource.replace('_',' ')}",
                "module":          module,
                "resource":        resource,
                "action":          action,
                "created_at":      _TS,
                "updated_at":      _TS,
            })
            next_id += 1

    # Fill any remaining IDs to reach 307
    while next_id <= 307:
        rows.append({
            "id": next_id, "permission_name": f"permission_{next_id}",
            "description": f"System permission {next_id}",
            "module": "system", "resource": "system", "action": "access",
            "created_at": _TS, "updated_at": _TS,
        })
        next_id += 1

    return rows


def seed_permissions() -> None:
    all_perms = _build_all_permissions()
    for i in range(0, len(all_perms), 100):
        db_upsert("permissions", all_perms[i:i + 100], on_conflict="id")
    log_ok(f"Permissions ensured ({len(all_perms)}).")


def seed_role_permissions() -> None:
    client = get_client()
    all_perms = client.table("permissions").select("id,permission_name,module").execute().data or []

    admin_only    = {"users_manage", "roles_manage", "settings_manage"}
    report_perms  = {"reports_sales", "reports_inventory", "reports_financial"}
    cashier_perms = {
        "sales_create", "sales_read", "sales_cancel",
        "customers_read", "customers_create", "products_read", "stock_view",
    }
    sales_extra = {"products_read", "stock_view", "purchases_read"} | report_perms

    role_predicates = [
        (2, lambda p: True),
        (3, lambda p: True),
        (4, lambda p: p["permission_name"] not in admin_only),
        (8, lambda p: p["module"] == "Finance" or p["permission_name"] in report_perms),
        (5, lambda p: p["module"] in ("sales", "crm") or p["permission_name"] in sales_extra),
        (6, lambda p: p["module"] in ("inventory", "purchasing")
               or p["permission_name"] in {
                   "products_create", "products_read", "products_update", "products_delete",
                   "customers_read", "reports_inventory", "reports_sales",
               }),
        (7, lambda p: p["permission_name"] in cashier_perms),
    ]

    mappings: list[dict] = []
    seen: set[tuple] = set()
    for role_id, pred in role_predicates:
        for p in all_perms:
            if pred(p):
                key = (role_id, p["id"])
                if key not in seen:
                    seen.add(key)
                    mappings.append({"role_id": role_id, "permission_id": p["id"]})

    for i in range(0, len(mappings), 200):
        db_upsert("role_permissions", mappings[i:i + 200], on_conflict="role_id,permission_id")
    log_ok(f"Role-permissions ensured ({len(mappings)} mappings).")


# ── 5. Categories ─────────────────────────────────────────────────────────────
def seed_categories() -> None:
    _TS_CAT = "2026-01-01T12:50:53.616822+00:00"
    rows = [
        {
            "id":            81 + i,
            "company_id":    CID,
            "category_name": name,
            "category_code": info["code"],
            "description":   info["description"],
            "is_active":     True,
            "icon_name":     info["icon"],
            "color_code":    info["color"],
            "sort_order":    i + 1,
            "created_at":    _TS_CAT,
            "updated_at":    _TS_CAT,
        }
        for i, (name, info) in enumerate(CATEGORY_MAPPINGS.items())
    ]
    db_upsert("categories", rows, on_conflict="id")
    log_ok(f"Categories ensured ({len(rows)}).")


# ── 6. Units ──────────────────────────────────────────────────────────────────
def seed_units() -> None:
    _TS_U = "2025-12-28T15:57:35.281704+00:00"
    base = [
        {"id": 1, "name": "Tablet",     "short_code": "TAB",  "type": "base", "base_unit_id": None, "conversion_factor": 1},
        {"id": 2, "name": "Capsule",    "short_code": "CAP",  "type": "base", "base_unit_id": None, "conversion_factor": 1},
        {"id": 3, "name": "Bottle",     "short_code": "BTL",  "type": "base", "base_unit_id": None, "conversion_factor": 1},
        {"id": 4, "name": "Vial",       "short_code": "VIAL", "type": "base", "base_unit_id": None, "conversion_factor": 1},
        {"id": 5, "name": "Tube",       "short_code": "TUBE", "type": "base", "base_unit_id": None, "conversion_factor": 1},
        {"id": 6, "name": "Milliliter", "short_code": "ML",   "type": "base", "base_unit_id": None, "conversion_factor": 1},
        {"id": 7, "name": "Milligram",  "short_code": "MG",   "type": "base", "base_unit_id": None, "conversion_factor": 1},
    ]
    derived = [
        {"id": 8,  "name": "Strip",  "short_code": "STRIP", "type": "derived", "base_unit_id": 1, "conversion_factor": 10},
        {"id": 9,  "name": "Box",    "short_code": "BOX",   "type": "derived", "base_unit_id": 8, "conversion_factor": 10},
        {"id": 10, "name": "Sachet", "short_code": "SACH",  "type": "derived", "base_unit_id": 6, "conversion_factor": 5},
    ]
    # Base units first (FK constraint: derived references base)
    for unit_list in (base, derived):
        db_upsert("units", [
            {**u, "company_id": CID, "is_active": True, "created_at": _TS_U, "updated_at": _TS_U}
            for u in unit_list
        ], on_conflict="id")
    log_ok(f"Units ensured ({len(base)} base + {len(derived)} derived).")


# ── 7. Chart of accounts (69 accounts) ───────────────────────────────────────
_COA = [
    (1,"1000","Current Assets","asset","current_asset"),
    (2,"1100","Cash on Hand","asset","current_asset"),
    (3,"1110","Petty Cash","asset","current_asset"),
    (4,"1120","Bank Account","asset","current_asset"),
    (5,"1130","Mobile Money","asset","current_asset"),
    (6,"1200","Accounts Receivable","asset","current_asset"),
    (7,"1210","Tax Recoverable (VAT Input)","asset","current_asset"),
    (8,"1220","Staff Advances","asset","current_asset"),
    (9,"1230","Prepaid Expenses","asset","current_asset"),
    (10,"1300","Inventory - Medicines","asset","current_asset"),
    (11,"1310","Inventory - Medical Supplies","asset","current_asset"),
    (12,"1320","Inventory - OTC Products","asset","current_asset"),
    (13,"1390","Inventory Reserve (Expired)","asset","current_asset"),
    (14,"1500","Non-Current Assets","asset","fixed_asset"),
    (15,"1510","Furniture & Fixtures","asset","fixed_asset"),
    (16,"1520","Equipment","asset","fixed_asset"),
    (17,"1530","Leasehold Improvements","asset","fixed_asset"),
    (18,"1590","Accumulated Depreciation","asset","fixed_asset"),
    (19,"2000","Current Liabilities","liability","current_liability"),
    (20,"2100","Accounts Payable","liability","current_liability"),
    (21,"2110","Accrued Expenses","liability","current_liability"),
    (22,"2120","Customer Deposits","liability","current_liability"),
    (23,"2130","Salaries Payable","liability","current_liability"),
    (24,"2140","PAYE Payable","liability","current_liability"),
    (25,"2150","NSSF Payable","liability","current_liability"),
    (26,"2160","VAT Payable","liability","current_liability"),
    (27,"2170","Withholding Tax Payable","liability","current_liability"),
    (28,"2500","Non-Current Liabilities","liability","long_term_liability"),
    (29,"2510","Bank Loan","liability","long_term_liability"),
    (30,"3000","Equity","equity","owner_equity"),
    (31,"3100","Owner Capital","equity","owner_equity"),
    (32,"3200","Retained Earnings","equity","retained_earnings"),
    (33,"3300","Owner Drawings","equity","owner_equity"),
    (34,"4000","Revenue","revenue","operating_revenue"),
    (35,"4100","Medicine Sales","revenue","operating_revenue"),
    (36,"4110","OTC & Cosmetics Sales","revenue","operating_revenue"),
    (37,"4120","Medical Supplies Sales","revenue","operating_revenue"),
    (38,"4200","Dispensing Fees","revenue","operating_revenue"),
    (39,"4300","Other Income","revenue","non_operating_revenue"),
    (40,"4400","Sales Discounts Given","revenue","operating_revenue"),
    (41,"5000","Cost of Goods Sold","expense","operating_expense"),
    (42,"5100","Medicine Purchases","expense","operating_expense"),
    (43,"5110","Medical Supplies Purchases","expense","operating_expense"),
    (44,"5120","Purchase Discounts Received","expense","operating_expense"),
    (45,"5130","Freight & Delivery Inward","expense","operating_expense"),
    (46,"5200","Inventory Write-offs","expense","operating_expense"),
    (47,"6000","Operating Expenses","expense","operating_expense"),
    (48,"6100","Staff Salaries","expense","operating_expense"),
    (49,"6110","NSSF Contributions","expense","operating_expense"),
    (50,"6120","Staff Training","expense","administrative_expense"),
    (51,"6200","Rent & Rates","expense","operating_expense"),
    (52,"6210","Utilities - Electricity","expense","operating_expense"),
    (53,"6220","Utilities - Water","expense","operating_expense"),
    (54,"6230","Internet & Telephone","expense","operating_expense"),
    (55,"6300","Advertising & Marketing","expense","selling_expense"),
    (56,"6310","Delivery & Transport","expense","selling_expense"),
    (57,"6320","Packaging & Bags","expense","selling_expense"),
    (58,"6330","Repairs & Maintenance","expense","operating_expense"),
    (59,"6340","Cleaning & Sanitation","expense","operating_expense"),
    (60,"6400","Licences & Permits","expense","administrative_expense"),
    (61,"6410","Professional Fees","expense","administrative_expense"),
    (62,"6420","Insurance","expense","administrative_expense"),
    (63,"6430","Bank Charges","expense","financial_expense"),
    (64,"6440","Depreciation Expense","expense","operating_expense"),
    (65,"6450","Miscellaneous Expenses","expense","other_expense"),
    (66,"7000","Financial Items","expense","financial_expense"),
    (67,"7100","Interest Income","revenue","non_operating_revenue"),
    (68,"7200","Interest Expense","expense","financial_expense"),
    (69,"7300","Exchange Gains/Losses","expense","financial_expense"),
]

def seed_chart_of_accounts() -> None:
    rows = [
        {"id": aid, "company_id": CID, "account_code": code, "account_name": name,
         "account_type": atype, "account_subtype": subtype,
         "parent_account_id": None, "is_active": True}
        for aid, code, name, atype, subtype in _COA
    ]
    db_upsert("chart_of_accounts", rows, on_conflict="id")
    log_ok(f"Chart of accounts ensured ({len(rows)}).")


# ── 8. Income categories ──────────────────────────────────────────────────────
_INCOME_CATS = [
    (1,"Income"),(2,"Medicine Sales"),(3,"Surgical & Medical Supplies"),
    (4,"Baby & Mother Care"),(5,"Cosmetics & Beauty"),(6,"Nutrition & Supplements"),
    (7,"Medical Devices"),(8,"Laboratory Services"),(9,"Consultation Fees"),
    (10,"Vaccine & Immunization Services"),(11,"Online/Telepharmacy Sales"),
    (12,"Insurance Reimbursements"),(13,"Government Subsidies/Grants"),
    (14,"Other Income"),(15,"Prescription Drugs"),(16,"Over-the-Counter (OTC)"),
]

def seed_income_categories() -> None:
    rows = [{"id": cid, "company_id": CID, "category_name": name, "is_active": True}
            for cid, name in _INCOME_CATS]
    db_upsert("income_categories", rows, on_conflict="id")
    log_ok(f"Income categories ensured ({len(rows)}).")


# ── 9. Expense categories ─────────────────────────────────────────────────────
_EXPENSE_CATS = [
    (1,"Expenses"),(2,"Cost of Goods Sold"),(3,"Salaries & Wages"),
    (4,"Rent & Utilities"),(5,"Licenses & Regulatory Fees"),
    (6,"Marketing & Advertising"),(7,"Professional Fees"),(8,"Insurance"),
    (9,"Bank Charges & Interest"),(10,"Repairs & Maintenance"),
    (11,"Office Supplies"),(12,"Transportation & Delivery"),(13,"Taxes & Duties"),
    (14,"Training & Staff Development"),(15,"Depreciation"),
    (16,"Inventory Loss/Shrinkage"),(17,"Waste Disposal"),
    (18,"Software & IT Subscriptions"),(19,"Patient Assistance Programs"),
    (20,"Other Expenses"),(21,"Medicine Purchases"),(22,"Supplies Purchases"),
    (23,"Pharmacist Salaries"),(24,"Support Staff Wages"),
]

def seed_expense_categories() -> None:
    rows = [{"id": cid, "company_id": CID, "category_name": name, "is_active": True}
            for cid, name in _EXPENSE_CATS]
    db_upsert("expense_categories", rows, on_conflict="id")
    log_ok(f"Expense categories ensured ({len(rows)}).")


# ── FK-safe pipeline ──────────────────────────────────────────────────────────
SEED_PIPELINE: list[tuple[str, callable]] = [
    ("company",          seed_company),
    ("settings",         seed_company_settings),
    ("roles",            seed_roles),
    ("permissions",      seed_permissions),
    ("role_permissions", seed_role_permissions),
    ("categories",       seed_categories),
    ("units",            seed_units),
    ("coa",              seed_chart_of_accounts),
    ("income_cats",      seed_income_categories),
    ("expense_cats",     seed_expense_categories),
]
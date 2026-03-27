"""
copy_template.py — No-op stub.

Previously copied roles, permissions, categories, units, chart_of_accounts,
income_categories and expense_categories from company_id=1 to a target company.

This is no longer needed. All of those tables are GLOBAL — they live at
company_id=1 and are shared by every company directly.  The frontend queries
them by company_id=1, not by the target company's ID.

  Global tables (never copied, never cleared per company):
    units              — is_global=True at company_id=1
    roles              — is_system=True at company_id=1
    permissions        — no company_id (fully global)
    role_permissions   — references global role IDs at company_id=1
    categories         — company_id=1 is the master
    chart_of_accounts  — company_id=1 is the master
    income_categories  — company_id=1 is the master
    expense_categories — company_id=1 is the master

To restore any of the above after a database flush, run:
    python main.py template seed

The --copy-template CLI flag is kept so existing scripts don't break,
but it is now a silent no-op.
"""

from __future__ import annotations

from src.utils import log_ok, log_section


def copy_template_data(target_company_id: int) -> bool:
    """
    No-op. All master data is global at company_id=1.
    Returns True so callers treat it as success.
    """
    log_section(f"Copy template  ->  company {target_company_id}")
    log_ok(
        "Skipped — all master data is global (company_id=1). "
        "No per-company copies needed. "
        "To restore template data run: python main.py template seed"
    )
    return True

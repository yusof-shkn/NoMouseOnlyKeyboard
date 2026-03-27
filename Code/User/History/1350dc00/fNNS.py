"""
Health check for the template company (company_id = 1).
Queries every section and compares to expected counts.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field

from config import TEMPLATE_COMPANY_ID, TEMPLATE_EXPECTED
from src.utils import get_client, log_section, log_row, log_ok, log_error, log_warn, log_info


@dataclass
class SectionHealth:
    name:     str
    actual:   int
    expected: int

    @property
    def is_healthy(self) -> bool:
        return self.actual >= self.expected

    @property
    def missing_count(self) -> int:
        return max(0, self.expected - self.actual)


@dataclass
class HealthReport:
    sections:   list[SectionHealth] = field(default_factory=list)
    elapsed_ms: float = 0.0

    @property
    def is_healthy(self) -> bool:
        return all(s.is_healthy for s in self.sections)

    @property
    def missing_sections(self) -> list[SectionHealth]:
        return [s for s in self.sections if not s.is_healthy]


def run_health_check(verbose: bool = True) -> HealthReport:
    """Query template company, build HealthReport, optionally print it."""
    client = get_client()
    cid    = TEMPLATE_COMPANY_ID
    t0     = time.monotonic()

    def _count(table: str) -> int:
        r = client.table(table).select("id", count="exact").eq("company_id", cid).execute()
        return r.count or 0

    company_count  = (
        client.table("companies").select("id", count="exact").eq("id", cid).execute().count or 0
    )
    settings_count = _count("company_settings")
    roles_count    = _count("roles")
    perms_count    = (
        client.table("permissions").select("id", count="exact").execute().count or 0
    )

    role_ids = [
        r["id"]
        for r in (client.table("roles").select("id").eq("company_id", cid).execute().data or [])
    ]
    rp_count = (
        client.table("role_permissions")
        .select("id", count="exact")
        .in_("role_id", role_ids)
        .execute()
        .count or 0
    ) if role_ids else 0

    sections = [
        SectionHealth("company",          company_count,       TEMPLATE_EXPECTED["company"]),
        SectionHealth("settings",         settings_count,      TEMPLATE_EXPECTED["settings"]),
        SectionHealth("roles",            roles_count,         TEMPLATE_EXPECTED["roles"]),
        SectionHealth("permissions",      perms_count,         TEMPLATE_EXPECTED["permissions"]),
        SectionHealth("role_permissions", rp_count,            TEMPLATE_EXPECTED["role_permissions"]),
        SectionHealth("categories",       _count("categories"),TEMPLATE_EXPECTED["categories"]),
        SectionHealth("units",            _count("units"),     TEMPLATE_EXPECTED["units"]),
        SectionHealth("coa",              _count("chart_of_accounts"), TEMPLATE_EXPECTED["coa"]),
        SectionHealth("income_cats",      _count("income_categories"), TEMPLATE_EXPECTED["income_cats"]),
        SectionHealth("expense_cats",     _count("expense_categories"), TEMPLATE_EXPECTED["expense_cats"]),
    ]

    report = HealthReport(
        sections=sections,
        elapsed_ms=(time.monotonic() - t0) * 1000,
    )

    if verbose:
        _print_report(report)

    return report


def _print_report(report: HealthReport) -> None:
    labels = {
        "company":          "Company record",
        "settings":         "Company settings",
        "roles":            "Roles",
        "permissions":      "Permissions",
        "role_permissions": "Role-permission mappings",
        "categories":       "Product categories",
        "units":            "Units of measure",
        "coa":              "Chart of accounts",
        "income_cats":      "Income categories",
        "expense_cats":     "Expense categories",
    }
    log_section("Template Company Health Check  (company_id = 1)")
    log_info(f"Queried in {report.elapsed_ms:.0f} ms\n")
    for s in report.sections:
        log_row(labels.get(s.name, s.name), s.actual, s.expected)
    print()
    if report.is_healthy:
        log_ok("All checks passed – template company is HEALTHY ✔")
    else:
        log_error(f"{len(report.missing_sections)} section(s) incomplete")
        for s in report.missing_sections:
            log_warn(f"  {s.name}: {s.actual}/{s.expected} (missing {s.missing_count})")
        log_info("Run:  python main.py template seed  — to restore.")
#!/usr/bin/env python3
"""
PharmaSOS Template Company Seeder
==================================
CLI entry point.

Usage:
    python main.py health          — Check template company data integrity
    python main.py seed            — Seed ALL sections (idempotent upserts)
    python main.py seed --missing  — Only seed sections that are incomplete
    python main.py reset           — Drop and re-seed everything (destructive!)
"""

import sys
import time
import argparse

from src.utils import log_section, log_ok, log_warn, log_error, log_info
from src.health import run_health_check
from src.seeders import (
    seed_company,
    seed_company_settings,
    seed_roles,
    seed_permissions,
    seed_role_permissions,
    seed_categories,
    seed_units,
    seed_chart_of_accounts,
    seed_income_categories,
    seed_expense_categories,
)

# ── Ordered seeder pipeline ───────────────────────────────────────────────────
# Order matters because of FK dependencies.
SEEDER_PIPELINE: list[tuple[str, callable]] = [
    ("company", seed_company),
    ("settings", seed_company_settings),
    ("roles", seed_roles),
    ("permissions", seed_permissions),
    ("role_permissions", seed_role_permissions),
    ("categories", seed_categories),
    ("units", seed_units),
    ("coa", seed_chart_of_accounts),
    ("income_cats", seed_income_categories),
    ("expense_cats", seed_expense_categories),
]


def cmd_health(_args: argparse.Namespace) -> int:
    """Run the health check and return exit code (0 = healthy, 1 = unhealthy)."""
    report = run_health_check(verbose=True)
    return 0 if report.is_healthy else 1


def cmd_seed(args: argparse.Namespace) -> int:
    """Seed all sections, or only missing ones if --missing flag is set."""
    start = time.monotonic()

    if args.missing:
        # First run health check silently to discover what's missing
        report = run_health_check(verbose=False)
        missing_names = {s.name for s in report.missing_sections}

        if not missing_names:
            log_section("PharmaSOS – Seed (missing only)")
            log_ok("Nothing to seed – all sections are already healthy!")
            return 0

        log_section(f"PharmaSOS – Seed (restoring {len(missing_names)} section(s))")
        log_warn(f"Missing: {', '.join(sorted(missing_names))}\n")

        pipeline = [(name, fn) for name, fn in SEEDER_PIPELINE if name in missing_names]
    else:
        log_section("PharmaSOS – Full Seed (all sections, idempotent)")
        pipeline = SEEDER_PIPELINE

    errors: list[str] = []
    for name, fn in pipeline:
        try:
            fn()
        except Exception as exc:
            log_error(f"  FAILED [{name}]: {exc}")
            errors.append(name)

    elapsed = time.monotonic() - start
    print()
    if errors:
        log_error(f"Seed completed with errors in {elapsed:.1f}s: {errors}")
        return 1

    log_ok(f"Seed completed successfully in {elapsed:.1f}s.")

    # Final health verification
    print()
    run_health_check(verbose=True)
    return 0


def cmd_reset(_args: argparse.Namespace) -> int:
    """
    Destructive reset: removes all template company data then re-seeds.
    Prompts for confirmation.
    """
    print(
        "\n⚠️  WARNING: This will DELETE all template company (ID=1) data and re-seed.\n"
    )
    confirm = input("Type 'YES' to confirm: ").strip()
    if confirm != "YES":
        log_warn("Reset aborted.")
        return 0

    from src.utils import get_client

    client = get_client()

    log_section("PharmaSOS – Reset")

    # Delete in reverse FK dependency order
    steps = [
        (
            "role_permissions",
            lambda: (
                client.table("role_permissions")
                .delete()
                .in_("role_id", [2, 3, 4, 5, 6, 7, 8])
                .execute()
            ),
        ),
        (
            "permissions",
            lambda: client.table("permissions").delete().gt("id", 0).execute(),
        ),
        ("roles", lambda: client.table("roles").delete().eq("company_id", 1).execute()),
        (
            "categories",
            lambda: client.table("categories").delete().eq("company_id", 1).execute(),
        ),
        (
            "units (derived)",
            lambda: (
                client.table("units")
                .delete()
                .eq("type", "derived")
                .eq("company_id", 1)
                .execute()
            ),
        ),
        (
            "units (base)",
            lambda: (
                client.table("units")
                .delete()
                .eq("type", "base")
                .eq("company_id", 1)
                .execute()
            ),
        ),
        (
            "chart_of_accounts",
            lambda: (
                client.table("chart_of_accounts").delete().eq("company_id", 1).execute()
            ),
        ),
        (
            "income_categories",
            lambda: (
                client.table("income_categories").delete().eq("company_id", 1).execute()
            ),
        ),
        (
            "expense_categories",
            lambda: (
                client.table("expense_categories")
                .delete()
                .eq("company_id", 1)
                .execute()
            ),
        ),
        (
            "company_settings",
            lambda: (
                client.table("company_settings").delete().eq("company_id", 1).execute()
            ),
        ),
        ("company", lambda: client.table("companies").delete().eq("id", 1).execute()),
    ]

    for name, fn in steps:
        try:
            fn()
            log_ok(f"Deleted {name}")
        except Exception as exc:
            log_warn(f"  Could not delete {name}: {exc}")

    print()
    log_info("Deletion complete. Running full seed now...\n")

    # Re-use full seed
    class _FakeArgs:
        missing = False

    return cmd_seed(_FakeArgs())


# ── Argument parser ───────────────────────────────────────────────────────────
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="pharmasos-seeder",
        description="PharmaSOS Template Company Seeder",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # health
    sub.add_parser("health", help="Check template company data integrity")

    # seed
    seed_p = sub.add_parser("seed", help="Seed template company data (idempotent)")
    seed_p.add_argument(
        "--missing",
        action="store_true",
        help="Only seed sections that are incomplete",
    )

    # reset
    sub.add_parser("reset", help="Delete and fully re-seed template data (destructive)")

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    handlers = {
        "health": cmd_health,
        "seed": cmd_seed,
        "reset": cmd_reset,
    }

    exit_code = handlers[args.command](args)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()

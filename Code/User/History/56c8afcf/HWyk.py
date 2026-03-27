#!/usr/bin/env python3
"""
PharmaSOS CLI

Usage:
  # NDA scraper
  python main.py scrape

  # Demo data seeder
  python main.py seed --company-id 5 --all
  python main.py seed --company-id 5 --company
  python main.py seed --company-id 5 --copy-template
  python main.py seed --company-id 5 --stores
  python main.py seed --company-id 5 --suppliers
  python main.py seed --company-id 5 --customers
  python main.py seed --company-id 5 --products
  python main.py seed --company-id 5 --inventory
  python main.py seed --company-id 5 --purchases
  python main.py seed --company-id 5 --sales
  python main.py seed --company-id 5 --accounting
  python main.py seed --company-id 5 --clear






  # Template company management
  python main.py template health        # Health check (exit 0 = healthy, 1 = broken)
  python main.py template seed          # Full idempotent seed/repair
  python main.py template seed --missing  # Only seed incomplete sections
"""

import argparse
import sys


def _seed_parser(sub):
    p = sub.add_parser("seed", help="Seed a company with demo data")
    p.add_argument(
        "--company-id",
        type=int,
        default=None,
        help="Target company ID (overrides COMPANY_ID in .env)",
    )
    p.add_argument("--all", action="store_true", help="Seed everything")
    p.add_argument("--company", action="store_true", help="Seed company + settings")
    p.add_argument(
        "--copy-template", action="store_true", help="Copy template master data"
    )
    p.add_argument("--stores", action="store_true", help="Seed 3 areas × 2 stores")
    p.add_argument("--suppliers", action="store_true", help="Seed suppliers")
    p.add_argument("--customers", action="store_true", help="Seed customers")
    p.add_argument(
        "--products", action="store_true", help="Load NDA products (no insert)"
    )
    p.add_argument("--inventory", action="store_true", help="Seed inventory batches")
    p.add_argument("--purchases", action="store_true", help="Seed purchase orders")
    p.add_argument("--sales", action="store_true", help="Seed sales")
    p.add_argument("--accounting", action="store_true", help="Seed expenses")
    p.add_argument(
        "--clear", action="store_true", help="⚠️  Clear all data (destructive)"
    )
    return p


def main():
    parser = argparse.ArgumentParser(
        prog="pharmasos",
        description="PharmaSOS CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    sub = parser.add_subparsers(dest="command")

    # ── scrape ────────────────────────────────────────────────────────────────
    sub.add_parser("scrape", help="Scrape NDA Uganda medicines into DB")

    # ── seed ──────────────────────────────────────────────────────────────────
    seed_p = _seed_parser(sub)

    # ── template ──────────────────────────────────────────────────────────────
    tmpl_p = sub.add_parser("template", help="Manage template company (id=1)")
    tmpl_sub = tmpl_p.add_subparsers(dest="template_cmd")

    tmpl_sub.add_parser("health", help="Run health check (exit 0 = healthy)")

    tmpl_seed_p = tmpl_sub.add_parser("seed", help="Seed / repair template company")
    tmpl_seed_p.add_argument(
        "--missing", action="store_true", help="Only seed sections that are incomplete"
    )

    # ── dispatch ──────────────────────────────────────────────────────────────
    args = parser.parse_args()

    if args.command == "scrape":
        from src.scraper import scrape_main

        sys.exit(scrape_main())

    elif args.command == "seed":
        active_flags = {
            k: v for k, v in vars(args).items() if k not in ("command", "company_id")
        }
        if not any(active_flags.values()):
            seed_p.print_help()
            sys.exit(0)
        from src.seed import run_seed

        run_seed(args)

    elif args.command == "template":
        if not args.template_cmd:
            tmpl_p.print_help()
            sys.exit(0)

        if args.template_cmd == "health":
            from src.template import run_health_check

            report = run_health_check()
            sys.exit(0 if report.is_healthy else 1)

        elif args.template_cmd == "seed":
            from src.template import SEED_PIPELINE, run_health_check
            from src.utils import log_ok, log_section, log_step

            if args.missing:
                report = run_health_check(verbose=True)
                if report.is_healthy:
                    log_ok("Template is already healthy – nothing to seed.")
                    sys.exit(0)
                missing_names = {s.name for s in report.missing_sections}
                pipeline = [
                    (name, fn) for name, fn in SEED_PIPELINE if name in missing_names
                ]
                log_section(f"Seeding {len(pipeline)} missing section(s)")
            else:
                pipeline = SEED_PIPELINE
                log_section("Full template seed")

            for i, (name, fn) in enumerate(pipeline, 1):
                log_step(i, len(pipeline), name)
                fn()

            log_ok("Template seed complete.")

    else:
        parser.print_help()
        sys.exit(0)


if __name__ == "__main__":
    main()

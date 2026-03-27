#!/usr/bin/env python3
"""
PharmaSOS Main CLI Entry Point

Usage:
  python main.py scrape                               # Scrape NDA medicines
  python main.py seed --company-id 5 --all           # Full seed for company 5
  python main.py seed --company-id 5 --company       # Company + settings only
  python main.py seed --company-id 5 --copy-template # Copy roles/COA/categories from template
  python main.py seed --company-id 5 --stores        # 3 areas × 2 stores
  python main.py seed --company-id 5 --suppliers     # Suppliers
  python main.py seed --company-id 5 --customers     # Customers
  python main.py seed --company-id 5 --products      # Products
  python main.py seed --company-id 5 --inventory     # Batches per store
  python main.py seed --company-id 5 --purchases     # Purchase orders per store
  python main.py seed --company-id 5 --sales         # Sales per store
  python main.py seed --company-id 5 --accounting    # Expenses
  python main.py seed --company-id 5 --clear         # ⚠️  Clear all (destructive)
"""

import argparse
import sys


def main():
    parser = argparse.ArgumentParser(
        description="PharmaSOS CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # ── scrape ──────────────────────────────────────────────────
    subparsers.add_parser(
        "scrape", help="Scrape NDA Uganda medicines and insert into DB"
    )

    # ── seed ────────────────────────────────────────────────────
    seed_parser = subparsers.add_parser("seed", help="Seed the database with demo data")

    seed_parser.add_argument(
        "--company-id",
        type=int,
        default=None,
        help="Target company ID (overrides COMPANY_ID in .env)",
    )
    seed_parser.add_argument("--all", action="store_true", help="Seed everything")
    seed_parser.add_argument(
        "--company", action="store_true", help="Seed company + settings"
    )
    seed_parser.add_argument(
        "--copy-template",
        action="store_true",
        help="Copy template master data (roles, COA, categories)",
    )
    seed_parser.add_argument(
        "--stores", action="store_true", help="Seed 3 areas × 2 stores"
    )
    seed_parser.add_argument("--suppliers", action="store_true", help="Seed suppliers")
    seed_parser.add_argument("--customers", action="store_true", help="Seed customers")
    seed_parser.add_argument("--products", action="store_true", help="Seed products")
    seed_parser.add_argument(
        "--inventory", action="store_true", help="Seed product batches (stock)"
    )
    seed_parser.add_argument(
        "--purchases", action="store_true", help="Seed purchase orders per store"
    )
    seed_parser.add_argument(
        "--sales", action="store_true", help="Seed sales per store"
    )
    seed_parser.add_argument("--accounting", action="store_true", help="Seed expenses")
    seed_parser.add_argument(
        "--clear", action="store_true", help="⚠️  Clear all seeded data (destructive!)"
    )

    args = parser.parse_args()

    if args.command == "scrape":
        from nda_scraper import main as scrape_main

        sys.exit(scrape_main())

    elif args.command == "seed":
        # Check at least one flag (other than --company-id) was passed
        flag_values = {
            k: v for k, v in vars(args).items() if k not in ("command", "company_id")
        }
        if not any(flag_values.values()):
            seed_parser.print_help()
            sys.exit(0)

        from seeder import run_seed

        run_seed(args)

    else:
        parser.print_help()
        sys.exit(0)


if __name__ == "__main__":
    main()

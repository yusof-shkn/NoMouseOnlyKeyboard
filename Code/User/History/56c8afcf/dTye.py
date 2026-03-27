#!/usr/bin/env python3
"""
PharmaSOS Main CLI Entry Point
Combines NDA scraper commands and database seed commands.

Usage:
  python main.py scrape                  # Scrape NDA medicines and insert to DB
  python main.py seed --all              # Seed all demo data
  python main.py seed --company          # Seed company & settings only
  python main.py seed --stores           # Seed areas & stores
  python main.py seed --users            # Seed roles & permissions
  python main.py seed --products         # Seed categories, units & products
  python main.py seed --suppliers        # Seed suppliers
  python main.py seed --customers        # Seed customers
  python main.py seed --inventory        # Seed product batches (stock)
  python main.py seed --sales            # Seed sales transactions
  python main.py seed --purchases        # Seed purchase orders
  python main.py seed --accounting       # Seed chart of accounts, expenses & income
  python main.py seed --clear            # ⚠️  Clear all seeded data (destructive!)
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

    # ── scrape command ──────────────────────────────────────────
    subparsers.add_parser(
        "scrape", help="Scrape NDA Uganda medicines and insert into database"
    )

    # ── seed command ────────────────────────────────────────────
    seed_parser = subparsers.add_parser("seed", help="Seed the database with demo data")
    seed_parser.add_argument("--all", action="store_true", help="Seed all data")
    seed_parser.add_argument(
        "--company", action="store_true", help="Seed company & settings"
    )
    seed_parser.add_argument(
        "--stores", action="store_true", help="Seed areas & stores"
    )
    seed_parser.add_argument(
        "--users", action="store_true", help="Seed roles & permissions"
    )
    seed_parser.add_argument(
        "--products", action="store_true", help="Seed categories, units & products"
    )
    seed_parser.add_argument("--suppliers", action="store_true", help="Seed suppliers")
    seed_parser.add_argument("--customers", action="store_true", help="Seed customers")
    seed_parser.add_argument(
        "--inventory", action="store_true", help="Seed product batches (stock)"
    )
    seed_parser.add_argument(
        "--sales", action="store_true", help="Seed sales transactions"
    )
    seed_parser.add_argument(
        "--purchases", action="store_true", help="Seed purchase orders"
    )
    seed_parser.add_argument(
        "--accounting",
        action="store_true",
        help="Seed chart of accounts, expenses & income",
    )
    seed_parser.add_argument(
        "--clear", action="store_true", help="⚠️  Clear all seeded data (destructive!)"
    )

    args = parser.parse_args()

    if args.command == "scrape":
        # Import and run the NDA scraper
        from nda_scraper import (
            main as scrape_main,
        )  # rename your existing script to nda_scraper.py

        sys.exit(scrape_main())

    elif args.command == "seed":
        if not any(vars(args).values()):
            seed_parser.print_help()
            sys.exit(0)
        from seed import run_seed

        run_seed(args)

    else:
        parser.print_help()
        sys.exit(0)


if __name__ == "__main__":
    main()

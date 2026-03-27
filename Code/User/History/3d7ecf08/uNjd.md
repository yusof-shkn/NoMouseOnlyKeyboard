# PharmaSOS CLI

Python toolset for seeding, scraping, and managing the PharmaSOS database.

---

## Setup

```bash
cp .env.example .env
# fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

uv venv && source .venv/bin/activate
uv pip install -e .
```

---

## Commands

### Template company (id = 1)

```bash
# Health check — exits 0 if healthy, 1 if broken
python main.py template health

# Full idempotent seed/repair
python main.py template seed

# Only seed sections that are incomplete
python main.py template seed --missing
```

### Demo data seeder

```bash
# Full seed for company 5 (all steps in order)
python main.py seed --company-id 5 --all

# Individual steps (can be combined)
python main.py seed --company-id 5 --company          # Company record + settings
python main.py seed --company-id 5 --copy-template    # Roles, COA, categories from template
python main.py seed --company-id 5 --stores           # 3 areas × 2 stores
python main.py seed --company-id 5 --suppliers        # 4 suppliers
python main.py seed --company-id 5 --customers        # 6 customers
python main.py seed --company-id 5 --products         # Load NDA products (read-only)
python main.py seed --company-id 5 --inventory        # Batches per store
python main.py seed --company-id 5 --purchases        # 3 POs per store
python main.py seed --company-id 5 --sales            # ~43 sales per store
python main.py seed --company-id 5 --accounting       # Expenses

# ⚠️  Destructive – clears all data for the company
python main.py seed --company-id 5 --clear
```

### NDA scraper

```bash
python main.py scrape
```

Scrapes the NDA Uganda Drug Register, creates a JSON backup, previews data,
then inserts all approved medicines into the products table under `COMPANY_ID`.

---

## Project structure

```
pharmasos/
├── main.py                   # Unified CLI entry point
├── config/__init__.py        # All env vars and shared constants
├── src/
│   ├── utils/
│   │   ├── db.py             # Supabase client + db_insert / db_upsert / db_fetch
│   │   ├── logger.py         # Coloured console output
│   │   └── dates.py          # days_ago / days_ahead helpers
│   ├── template/
│   │   ├── health.py         # Template company health checker
│   │   └── seeders.py        # All 10 template sections (FK-ordered pipeline)
│   ├── seeder/
│   │   ├── demo.py           # Demo data seeders (company, stores, products, …)
│   │   ├── copy_template.py  # Python-native template copy (no RPC needed)
│   │   └── runner.py         # Orchestrates CLI flags → seeder functions
│   └── scraper/
│       └── nda.py            # NDA Uganda Drug Register scraper
├── pyproject.toml
├── .env.example
└── README.md
```

---

## Bug fixes vs original seeder.py

| Location | Bug | Fix |
|---|---|---|
| `customers` table | Used `customer_name`, `gender`, `date_of_birth` (columns don't exist) | Replaced with `first_name` + `last_name`; removed missing columns |
| `product_batches` table | Used `cost_price` (column doesn't exist) | Changed to `unit_cost` |
| `expenses` table | Used `expense_category_id` | Changed to `category_id` |
| `expenses` table | Used `frequency` | Changed to `recurrence_frequency` |
| `fetch_company()` helper | Broken implementation using `table.__class__` | Replaced with `db_fetch()` |
| `copy_from_template()` | Called missing PostgreSQL RPC | Replaced with `copy_template.py` (pure Python) |
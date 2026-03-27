"""
Demo data seeders for a target pharmacy company.

Structure per run:
  - 3 areas  (from AI profile or randomised fallback)
  - 2 stores per area = 6 stores total
  - 4 suppliers, 6 customers (including walk-in)
  - Inventory batches per store (uses NDA global products from company_id=1)
  - 3 purchase orders per store  (received / partial / pending)
  - ~43 sales per store over 14 days + 1 credit sale
  - sale_items for EVERY sale (2 items per sale, 60/40 split)  ← BUG FIX
  - Expenses + income records for ALL 6 stores                 ← BUG FIX
    with dates spread across last 7 days (visible on 7D chart) ← BUG FIX

RANDOMISATION STRATEGY
  Every seeder accepts a `profile` dict (from ai_profiles.get_company_profile)
  and uses an `rng` (random.Random seeded with company_id).  This means:
    * Different companies get different names, places, and amounts
    * Re-running for the same company_id reproduces the same data
    * No AI call is required -- a deterministic fallback is always available

is_restricted SEEDING  (frontend toggle test data):
  Each seeded table gets an explicit mix of True and False rows so the
  frontend toggle meaningfully shows/hides data.

BUG FIXES (2026-03-06):
  BUG 1 — Revenue by Category showed "No revenue data":
    Root cause: seed_sales() only inserted sale_items for the first 3 sales
    per store (indices 0-2 of sale_rows[:3]).  All remaining ~40 sales per
    store had NO sale_items rows, so the dashboard query:
      sale_items → products(category_id, categories(category_name))
    returned an empty array → byCategory was empty → "No revenue data".
    Fix: insert sale_items for EVERY sale, not just the first 3.

  BUG 2 — Expenses line flat at 0 on 7D chart:
    Root cause: seed_accounting() only seeded expenses for stores[:2] and
    used dates 18-35 days ago.  The 7-day chart window only looks back 7 days,
    so all seeded expenses were outside the visible range.
    Fix: seed expenses for ALL stores and spread dates across last 7 days
    (0-6 days ago) so they appear on the default 7D chart immediately.
"""

from __future__ import annotations

import datetime
import random
from typing import Any, cast

from config import NDA_PRODUCT_IDS, NDA_PRODUCT_PRICE_MAP
from src.seed.ai_profiles import get_company_profile
from src.utils import (
    days_ago,
    days_ahead,
    db_fetch,
    db_upsert,
    get_client,
    log_ok,
    log_section,
    log_warn,
)

Row = dict[str, Any]


def _rows(raw: Any) -> list[Row]:
    return cast(list[Row], raw or [])


def _rng(company_id: int) -> random.Random:
    """Reproducible RNG per company."""
    return random.Random(company_id * 31337 + 42)


def _restricted(idx: int) -> bool:
    return idx % 2 == 1


def _doc_number(prefix: str, idx: int) -> str:
    today = datetime.date.today().strftime("%Y%m%d")
    return f"{prefix}{today}-{idx:06d}"


def _round_ugx(amount: float) -> int:
    return max(1000, int(amount / 1000) * 1000)


def _fin(profile: Row, key: str, default: int = 100_000) -> int:
    return int((profile.get("financials") or {}).get(key, default))


# ── 1. Company & settings ─────────────────────────────────────────────────────
def seed_company(company_id: int, profile: Row | None = None) -> None:
    log_section(f"Company  (id={company_id})")
    c = company_id
    if profile is None:
        profile = get_company_profile(c)

    company_name = str(profile.get("company_name") or f"HealthPlus Pharmacy {c}")
    company_code = str(profile.get("company_code") or f"HP{c:04d}")
    city = str(profile.get("city") or "Kampala")

    db_upsert(
        "companies",
        {
            "id": c,
            "company_name": company_name,
            "company_code": company_code,
            "email": f"admin@{company_code.lower()}.ug",
            "phone": f"+25670{c:06d}",
            "address": f"Plot {c * 3 + 10}, Main Street, {city}",
            "city": city,
            "country": "Uganda",
            "tax_id": f"100{c:07d}",
            "is_active": True,
        },
        on_conflict="id",
    )

    db_upsert(
        "company_settings",
        {
            "company_id": c,
            "default_currency": "UGX",
            "base_currency": "UGX",
            "stock_valuation_method": "FIFO",
            "enable_batch_tracking": True,
            "low_stock_multiplier": 1.0,
            "near_expiry_warning_days": 60,
            "near_expiry_critical_days": 30,
            "auto_expire_batches": True,
            "require_purchase_approval": False,
            "enable_backorders": True,
            "auto_fulfill_backorders": False,
            "allow_negative_stock": False,
            "invoice_prefix": "INV",
            "po_prefix": "PO",
            "sale_number_prefix": "SAL",
            "auto_generate_sale_numbers": True,
            "auto_increment_documents": True,
            "document_number_padding": 6,
            "allow_sales_returns": True,
            "sales_return_days_limit": 30,
            "require_return_approval": True,
            "allow_purchase_returns": True,
            "purchase_return_days_limit": 14,
            "require_purchase_return_approval": False,
            "auto_restock_on_return": True,
            "block_expired_sales": True,
            "allow_near_expiry_discount": True,
            "near_expiry_discount_percentage": 10,
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
            "max_discount_percentage": 20,
            "require_discount_approval": True,
            "allow_inter_store_transfers": True,
            "require_transfer_approval": False,
            "enable_low_stock_notifications": True,
            "enable_expiry_notifications": True,
            "enable_payment_notifications": True,
            "enable_order_notifications": True,
            "receipt_paper_size": "A4",
            "show_company_logo_on_receipt": True,
            "default_credit_days": 30,
        },
        on_conflict="company_id",
    )

    log_ok(f"Company '{company_name}' and settings ensured.")


# ── 2. Areas & stores ─────────────────────────────────────────────────────────
def seed_stores(
    company_id: int, profile: Row | None = None
) -> tuple[list[Row], list[Row]]:
    c = company_id
    log_section("Areas & Stores  (3 x 2)")

    if profile is None:
        profile = get_company_profile(c)

    areas_data: list[Row] = []
    for area in profile["areas"]:
        areas_data.append(
            {
                "company_id": c,
                "area_name": area["name"],
                "area_code": area["code"],
                "region": area.get("region", "Central"),
                "country": "Uganda",
                "description": area.get("description", ""),
                "is_active": True,
            }
        )

    area_rows = _rows(
        db_upsert("areas", areas_data, on_conflict="company_id,area_code")
    )
    if not area_rows:
        log_warn("No areas created -- aborting stores seed.")
        return [], []
    log_ok(f"{len(area_rows)} areas inserted.")

    store_defs = profile["stores"]
    company_code = str(profile.get("company_code") or f"HP{c:04d}")
    stores_data: list[Row] = []

    for i, store_def in enumerate(store_defs[:6]):
        area_idx = i // 2
        area_id = int(area_rows[area_idx]["id"])
        store_code = f"{company_code}-S{i + 1:02d}"
        store_name = store_def.get("name") or f"{company_code} Branch {i + 1}"
        address = (
            store_def.get("address")
            or f"Plot {i + 1}, {profile['areas'][area_idx]['name']}"
        )

        stores_data.append(
            {
                "company_id": c,
                "area_id": area_id,
                "store_name": store_name,
                "store_code": store_code,
                "store_type": "pharmacy",
                "address": address,
                "phone": f"+2567{c:04d}{i + 1:02d}",
                "email": f"store{i + 1}@{company_code.lower()}.ug",
                "is_active": True,
            }
        )

    store_rows = _rows(
        db_upsert("stores", stores_data, on_conflict="company_id,store_code")
    )
    log_ok(f"{len(store_rows)} stores inserted (2 per area).")
    return area_rows, store_rows


# ── 3. Suppliers ──────────────────────────────────────────────────────────────
def seed_suppliers(company_id: int, profile: Row | None = None) -> list[Row]:
    c = company_id
    log_section("Suppliers")

    if profile is None:
        profile = get_company_profile(c)

    rng = _rng(c)
    payment_terms_pool = ["net_30", "net_45", "net_60", "net_15"]
    credit_limits = [2_000_000, 3_000_000, 5_000_000, 8_000_000, 10_000_000]

    data: list[Row] = []
    for i, sup in enumerate(profile["suppliers"][:4]):
        data.append(
            {
                "company_id": c,
                "supplier_name": sup["name"],
                "supplier_code": f"SUP{c:04d}{i + 1:03d}",
                "email": sup.get("email") or f"supplier{i + 1}@example.co.ug",
                "phone": f"+25641{c:04d}{i + 1:02d}",
                "address": sup.get("address") or "Kampala, Uganda",
                "contact_person": sup.get("contact") or "Contact Person",
                "payment_terms": rng.choice(payment_terms_pool),
                "credit_limit": rng.choice(credit_limits),
                "is_active": True,
            }
        )

    rows = _rows(db_upsert("suppliers", data, on_conflict="company_id,supplier_code"))
    log_ok(f"{len(rows)} suppliers inserted.")
    return rows


# ── 4. Customers ──────────────────────────────────────────────────────────────
def seed_customers(company_id: int, profile: Row | None = None) -> list[Row]:
    c = company_id
    log_section("Customers")

    if profile is None:
        profile = get_company_profile(c)

    rng = _rng(c)
    credit_limits = [100_000, 200_000, 300_000, 500_000, 750_000]
    credit_days = [7, 14, 30, 45]
    email_domains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"]

    data: list[Row] = [
        {
            "company_id": c,
            "first_name": "Walk-in",
            "last_name": "Customer",
            "customer_code": f"WALKIN-{c:04d}",
            "is_active": True,
            "credit_limit": 0,
            "credit_days": 0,
        }
    ]

    ai_customers = profile["customers"][:5]
    for i, cust in enumerate(ai_customers[:4]):
        fn = cust.get("first_name", f"Customer{i + 1}")
        ln = cust.get("last_name", "")
        email_domain = rng.choice(email_domains)
        data.append(
            {
                "company_id": c,
                "first_name": fn,
                "last_name": ln,
                "customer_code": f"CUST-{c:04d}-{i + 1:03d}",
                "email": f"{fn.lower()}{c}@{email_domain}",
                "phone": f"+2567{c:04d}{i + 11:02d}",
                "address": cust.get("address") or "Kampala",
                "credit_limit": rng.choice(credit_limits),
                "credit_days": rng.choice(credit_days),
                "is_active": True,
            }
        )

    inst = (
        ai_customers[4]
        if len(ai_customers) > 4
        else {"first_name": "City", "last_name": "Clinic"}
    )
    data.append(
        {
            "company_id": c,
            "first_name": inst.get("first_name", "City"),
            "last_name": inst.get("last_name", "Clinic"),
            "customer_code": f"INST-{c:04d}-001",
            "email": f"pharmacy{c}@clinic.co.ug",
            "phone": f"+25641{c:04d}77",
            "address": inst.get("address") or "Kampala",
            "credit_limit": _fin(profile, "credit_limit_institutional_ugx", 5_000_000),
            "credit_days": 30,
            "is_active": True,
        }
    )

    rows = _rows(db_upsert("customers", data, on_conflict="company_id,customer_code"))
    log_ok(f"{len(rows)} customers inserted.")
    return rows


# ── 5. NDA products (read-only from company_id=1) ─────────────────────────────
def fetch_nda_products() -> list[Row]:
    log_section("NDA Products  (read-only from company_id=1)")
    try:
        raw = (
            get_client()
            .table("products")
            .select(
                "id,product_name,generic_name,product_code,category_id,unit_id,reorder_level,is_restricted"
            )
            .eq("company_id", 1)
            .in_("id", NDA_PRODUCT_IDS)
            .is_("deleted_at", "null")
            .execute()
            .data
        )
        base_rows = _rows(raw)
    except Exception as e:
        log_warn(f"Failed to fetch NDA products: {e}")
        return []

    enriched: list[Row] = []
    for r in base_rows:
        pid = int(r["id"])
        cost, sell = NDA_PRODUCT_PRICE_MAP.get(pid, (500, 1000))
        enriched.append({**r, "unit_cost": cost, "selling_price": sell})

    log_ok(f"{len(enriched)} NDA products loaded (no insert).")
    return enriched


# ── 6. Inventory batches ──────────────────────────────────────────────────────
def seed_inventory(
    company_id: int,
    product_rows: list[Row],
    store_rows: list[Row],
    supplier_rows: list[Row],
    profile: Row | None = None,
) -> list[Row]:
    c = company_id
    log_section("Inventory Batches")

    if not all([product_rows, store_rows, supplier_rows]):
        log_warn("Missing dependencies -- skipping inventory.")
        return []

    if profile is None:
        profile = get_company_profile(c)

    rng = _rng(c)
    base_qty = _fin(profile, "batch_quantity_base", 150)
    sup_ids = [int(s["id"]) for s in supplier_rows]
    today = days_ago(0).replace("-", "")

    batches: list[Row] = []
    batch_idx = 0

    for s_idx, store in enumerate(store_rows):
        sid = int(store["id"])
        scode = str(store["store_code"])[-5:]
        sup = sup_ids[s_idx % len(sup_ids)]

        for p_idx, prod in enumerate(product_rows):
            qty = max(50, int(base_qty * rng.uniform(0.6, 1.4)))
            unit_cost = int(prod.get("unit_cost") or 500)
            sell = int(prod.get("selling_price") or 1000)
            store_cost = _round_ugx(unit_cost * rng.uniform(0.9, 1.1))
            store_sell = _round_ugx(sell * rng.uniform(0.9, 1.1))
            restricted = _restricted(batch_idx)

            batches.append(
                {
                    "company_id": c,
                    "product_id": int(prod["id"]),
                    "store_id": sid,
                    "batch_number": f"BT-{scode}-{today}-{p_idx + 1:03d}",
                    "manufacturing_date": days_ago(rng.randint(120, 300)),
                    "expiry_date": days_ahead(rng.randint(180, 730)),
                    "quantity_received": qty + rng.randint(20, 80),
                    "quantity_available": qty,
                    "unit_cost": store_cost,
                    "selling_price": store_sell,
                    "supplier_id": sup,
                    "is_active": True,
                    "is_restricted": restricted,
                    "notes": (
                        "[RESTRICTED] Controlled batch - requires auth to view"
                        if restricted
                        else "[OPEN] Standard batch - visible to all"
                    ),
                }
            )
            batch_idx += 1

    # Near-expiry demo batch
    p0 = product_rows[0]
    batches.append(
        {
            "company_id": c,
            "product_id": int(p0["id"]),
            "store_id": int(store_rows[0]["id"]),
            "batch_number": f"NEAREXP-{c}-001",
            "manufacturing_date": days_ago(rng.randint(250, 350)),
            "expiry_date": days_ahead(rng.randint(10, 28)),
            "quantity_received": rng.randint(30, 80),
            "quantity_available": rng.randint(5, 25),
            "unit_cost": int(p0.get("unit_cost") or 500),
            "selling_price": int(p0.get("selling_price") or 1000),
            "supplier_id": sup_ids[0],
            "is_active": True,
            "is_restricted": False,
            "notes": "[OPEN] Near expiry - seeder demo batch",
        }
    )

    rows = _rows(
        db_upsert(
            "product_batches",
            batches,
            on_conflict="company_id,product_id,store_id,batch_number",
        )
    )
    r_count = sum(1 for b in batches if b["is_restricted"])
    log_ok(
        f"{len(rows)} batches inserted "
        f"({len(product_rows)} products x {len(store_rows)} stores + 1 near-expiry). "
        f"{r_count} restricted  |  {len(batches) - r_count} unrestricted."
    )
    return rows


# ── 7. Purchases ──────────────────────────────────────────────────────────────
def seed_purchases(
    company_id: int,
    product_rows: list[Row],
    store_rows: list[Row],
    supplier_rows: list[Row],
    profile: Row | None = None,
) -> None:
    c = company_id
    log_section("Purchase Orders")

    if not all([product_rows, store_rows, supplier_rows]):
        log_warn("Missing dependencies -- skipping purchases.")
        return

    if profile is None:
        profile = get_company_profile(c)

    rng = _rng(c)
    sup_ids = [int(s["id"]) for s in supplier_rows]
    total_po = 0
    po_idx = 0

    po_large = _fin(profile, "po_large_amount_ugx", 2_500_000)
    po_medium = _fin(profile, "po_medium_amount_ugx", 1_200_000)
    po_small = _fin(profile, "po_small_amount_ugx", 1_800_000)
    payment_methods = ["bank_transfer", "cash", "mobile_money", "cheque"]

    for s_idx, store in enumerate(store_rows):
        sid = int(store["id"])
        scode = str(store["store_code"])
        store_name = str(store["store_name"])
        sup_a = sup_ids[s_idx % len(sup_ids)]
        sup_b = sup_ids[(s_idx + 1) % len(sup_ids)]

        amt_large = _round_ugx(po_large * rng.uniform(0.8, 1.2))
        amt_medium = _round_ugx(po_medium * rng.uniform(0.8, 1.2))
        amt_small = _round_ugx(po_small * rng.uniform(0.8, 1.2))
        disc_large = _round_ugx(amt_large * rng.uniform(0.01, 0.03))
        paid_partial = _round_ugx(amt_medium * rng.uniform(0.4, 0.6))

        po_defs: list[Row] = [
            {
                "company_id": c,
                "store_id": sid,
                "supplier_id": sup_a,
                "po_number": f"PO-{scode}-{days_ago(30).replace('-', '')}-01",
                "po_date": days_ago(rng.randint(28, 35)),
                "expected_delivery_date": days_ago(rng.randint(20, 25)),
                "status": "received",
                "subtotal": amt_large,
                "tax_amount": 0,
                "discount_amount": disc_large,
                "total_amount": amt_large - disc_large,
                "paid_amount": amt_large - disc_large,
                "payment_terms": "net_30",
                "payment_status": "paid",
                "payment_method": rng.choice(["bank_transfer", "cheque"]),
                "notes": f"[{'RESTRICTED' if _restricted(po_idx) else 'OPEN'}] Monthly restock - {store_name}",
                "is_restricted": _restricted(po_idx),
            },
            {
                "company_id": c,
                "store_id": sid,
                "supplier_id": sup_b,
                "po_number": f"PO-{scode}-{days_ago(15).replace('-', '')}-02",
                "po_date": days_ago(rng.randint(13, 17)),
                "expected_delivery_date": days_ago(rng.randint(6, 10)),
                "status": "received",
                "subtotal": amt_medium,
                "tax_amount": 0,
                "discount_amount": 0,
                "total_amount": amt_medium,
                "paid_amount": paid_partial,
                "payment_terms": "net_30",
                "payment_status": "partially_paid",
                "payment_method": rng.choice(["cash", "mobile_money"]),
                "notes": f"[{'RESTRICTED' if _restricted(po_idx + 1) else 'OPEN'}] Partial delivery",
                "is_restricted": _restricted(po_idx + 1),
            },
            {
                "company_id": c,
                "store_id": sid,
                "supplier_id": sup_a,
                "po_number": f"PO-{scode}-{days_ago(3).replace('-', '')}-03",
                "po_date": days_ago(rng.randint(2, 5)),
                "expected_delivery_date": days_ahead(rng.randint(3, 7)),
                "status": "approved",
                "subtotal": amt_small,
                "tax_amount": 0,
                "discount_amount": 0,
                "total_amount": amt_small,
                "paid_amount": 0,
                "payment_terms": "net_30",
                "payment_status": "unpaid",
                "payment_method": rng.choice(payment_methods),
                "notes": f"[{'RESTRICTED' if _restricted(po_idx + 2) else 'OPEN'}] Pending order",
                "is_restricted": _restricted(po_idx + 2),
            },
        ]

        po_rows = _rows(
            db_upsert("purchase_orders", po_defs, on_conflict="company_id,po_number")
        )
        total_po += len(po_rows)

        if po_rows and len(product_rows) >= 2:
            p1_cost = int(product_rows[0].get("unit_cost") or 500)
            p2_cost = int(product_rows[1].get("unit_cost") or 500)
            qty1, qty2 = rng.randint(200, 400), rng.randint(100, 200)
            items: list[Row] = [
                {
                    "purchase_order_id": int(po_rows[0]["id"]),
                    "product_id": int(product_rows[0]["id"]),
                    "quantity_ordered": qty1,
                    "quantity_received": qty1,
                    "unit_cost": p1_cost,
                    "discount_amount": 0,
                    "total_cost": qty1 * p1_cost,
                    "expiry_date": days_ahead(rng.randint(365, 900)),
                    "batch_number": f"BATCH-{scode}-A01",
                    "is_restricted": po_defs[0]["is_restricted"],
                },
                {
                    "purchase_order_id": int(po_rows[0]["id"]),
                    "product_id": int(product_rows[1]["id"]),
                    "quantity_ordered": qty2,
                    "quantity_received": qty2,
                    "unit_cost": p2_cost,
                    "discount_amount": 0,
                    "total_cost": qty2 * p2_cost,
                    "expiry_date": days_ahead(rng.randint(365, 730)),
                    "batch_number": f"BATCH-{scode}-A02",
                    "is_restricted": po_defs[0]["is_restricted"],
                },
            ]
            db_upsert("purchase_order_items", items, on_conflict="id")

        po_idx += 3

    r_count = sum(1 for i in range(len(store_rows) * 3) if _restricted(i))
    log_ok(
        f"{total_po} purchase orders inserted (3 per store). "
        f"{r_count} restricted  |  {total_po - r_count} unrestricted."
    )


# ── 8. Sales ──────────────────────────────────────────────────────────────────
def seed_sales(
    company_id: int,
    product_rows: list[Row],
    store_rows: list[Row],
    customer_rows: list[Row],
    batch_rows: list[Row],
    profile: Row | None = None,
) -> None:
    """
    Seed sales with sale_items for EVERY sale.

    FIX: Original code only inserted sale_items for sale_rows[:3] (first 3 sales
    per store). This meant ~40 sales per store had no items, causing:
      - Revenue by Category = "No revenue data" (join on sale_items → products
        → categories returns empty because no items exist)
      - Incorrect COGS calculations in profit reports

    Fix: iterate over ALL sale_rows and insert 2 items per sale (matching the
    original pattern of p1/p2 per store index), not just the first 3.
    """
    c = company_id
    log_section("Sales")

    if not all([product_rows, store_rows, customer_rows]):
        log_warn("Missing dependencies -- skipping sales.")
        return

    if profile is None:
        profile = get_company_profile(c)

    rng = _rng(c)
    sale_min = _fin(profile, "sale_amount_min_ugx", 50_000)
    sale_max = _fin(profile, "sale_amount_max_ugx", 500_000)

    walkin = next(
        (x for x in customer_rows if "WALKIN" in str(x.get("customer_code", ""))),
        customer_rows[0],
    )
    regulars = [
        x for x in customer_rows if "WALKIN" not in str(x.get("customer_code", ""))
    ]
    cust1 = regulars[0] if regulars else walkin
    cust2 = regulars[1] if len(regulars) > 1 else walkin
    inst = next(
        (x for x in customer_rows if "INST" in str(x.get("customer_code", ""))), cust1
    )

    batch_map: dict[int, int] = {int(b["product_id"]): int(b["id"]) for b in batch_rows}
    total_sales = 0
    total_items = 0
    sale_glob_idx = 0
    payment_methods = ["cash", "mobile_money", "card", "cash"]

    for s_idx, store in enumerate(store_rows):
        sid = int(store["id"])
        scode = str(store["store_code"])

        # Pick the 2 products for this store (consistent with original logic)
        p1 = product_rows[s_idx % len(product_rows)]
        p2 = product_rows[(s_idx + 1) % len(product_rows)]
        p1_id, p2_id = int(p1["id"]), int(p2["id"])
        p1_sell = int(p1.get("selling_price") or 1000)
        p2_sell = int(p2.get("selling_price") or 1000)
        p1_cost = int(p1.get("unit_cost") or 500)
        p2_cost = int(p2.get("unit_cost") or 500)

        sales_list: list[Row] = []

        for day in range(14, 0, -1):
            n_sales = rng.randint(2, 4)
            for sale_num in range(1, n_sales + 1):
                total = _round_ugx(rng.uniform(sale_min, sale_max))
                discount = (
                    _round_ugx(total * rng.uniform(0, 0.05))
                    if rng.random() < 0.2
                    else 0
                )
                net = total - discount
                customer = (
                    walkin if sale_num == 1 else (cust1 if sale_num == 2 else cust2)
                )
                restricted = _restricted(sale_glob_idx)

                sales_list.append(
                    {
                        "company_id": c,
                        "store_id": sid,
                        "sale_number": f"SAL-{scode}-{days_ago(day).replace('-', '')}-{sale_num:03d}",
                        "sale_date": days_ago(day),
                        "customer_id": int(customer["id"]),
                        "sale_type": "over_the_counter",
                        "sale_status": "completed",
                        "subtotal": total,
                        "tax_amount": 0,
                        "discount_amount": discount,
                        "total_amount": net,
                        "amount_paid": net,
                        "payment_method": rng.choice(payment_methods),
                        "payment_status": "paid",
                        "is_restricted": restricted,
                        "notes": f"[{'RESTRICTED' if restricted else 'OPEN'}] Day -{day} sale #{sale_num}",
                    }
                )
                sale_glob_idx += 1

        inst_amount = _round_ugx(
            _fin(profile, "income_sales_revenue_ugx", 350_000) * rng.uniform(0.05, 0.1)
        )
        sales_list.append(
            {
                "company_id": c,
                "store_id": sid,
                "sale_number": f"SAL-{scode}-CREDIT-001",
                "sale_date": days_ago(rng.randint(1, 3)),
                "customer_id": int(inst["id"]),
                "sale_type": "institutional",
                "sale_status": "completed",
                "subtotal": inst_amount,
                "tax_amount": 0,
                "discount_amount": 0,
                "total_amount": inst_amount,
                "amount_paid": 0,
                "payment_method": "credit",
                "payment_status": "unpaid",
                "is_restricted": False,
                "notes": "[OPEN] Credit/institutional sale - always visible",
            }
        )

        sale_rows = _rows(
            db_upsert("sales", sales_list, on_conflict="company_id,sale_number")
        )
        total_sales += len(sale_rows)

        # ── FIX: Insert sale_items for ALL sales, not just the first 3 ────────
        # Original bug: `for sr_idx, sr in enumerate(sale_rows[:3]):`
        # Fixed: iterate over every sale row and insert 2 items each.
        # We split total_amount 60/40 between the two products.
        if sale_rows:
            items: list[Row] = []
            for sr_idx, sr in enumerate(sale_rows):
                sale_total = int(sales_list[sr_idx]["total_amount"])
                amt_p1 = int(sale_total * 0.6)
                amt_p2 = sale_total - amt_p1
                qty1 = max(1, round(amt_p1 / p1_sell)) if p1_sell else 1
                qty2 = max(1, round(amt_p2 / p2_sell)) if p2_sell else 1
                parent_restricted = sales_list[sr_idx]["is_restricted"]

                items += [
                    {
                        "sale_id": int(sr["id"]),
                        "product_id": p1_id,
                        "batch_id": batch_map.get(p1_id),
                        "quantity": qty1,
                        "unit_price": p1_sell,
                        "cost_price": p1_cost,
                        "discount_amount": 0,
                        "total_price": amt_p1,
                        "tax_rate": 0,
                        "tax_amount": 0,
                        "is_restricted": parent_restricted,
                    },
                    {
                        "sale_id": int(sr["id"]),
                        "product_id": p2_id,
                        "batch_id": batch_map.get(p2_id),
                        "quantity": qty2,
                        "unit_price": p2_sell,
                        "cost_price": p2_cost,
                        "discount_amount": 0,
                        "total_price": amt_p2,
                        "tax_rate": 0,
                        "tax_amount": 0,
                        "is_restricted": parent_restricted,
                    },
                ]
            db_upsert("sale_items", items, on_conflict="id")
            total_items += len(items)

    r_count = sum(1 for i in range(sale_glob_idx) if _restricted(i))
    log_ok(
        f"{total_sales} sales inserted with {total_items} sale_items "
        f"(2 items per sale, all stores). "
        f"~{r_count} restricted  |  ~{total_sales - r_count} unrestricted."
    )


# ── 9. Accounting / Expenses + Income ─────────────────────────────────────────
def seed_accounting(
    company_id: int,
    store_rows: list[Row],
    profile: Row | None = None,
) -> None:
    """
    Seed expenses and income for ALL stores with dates in the last 7 days.

    FIX 1 — All stores covered:
      Original code: `for store in stores[:2]` — only first 2 stores got expenses.
      Fixed: iterate over ALL stores.

    FIX 2 — Expenses visible on 7D chart:
      Original code used `days_ago(rng.randint(18, 35) + idx * rng.randint(3, 7))`
      which placed every expense 18-70+ days in the past — well outside the
      default 7-day chart window.  The "Expenses by Category" panel (3-month
      lookback) showed data correctly, but the Revenue vs Expenses chart always
      showed a flat red line at 0.
      Fixed: use `days_ago(rng.randint(0, 6))` so expenses land within the last
      7 days and appear on the chart immediately on first load.
    """
    c = company_id
    log_section("Expenses & Income")

    if profile is None:
        profile = get_company_profile(c)

    rng = _rng(c)
    stores = store_rows or db_fetch("stores", c)
    if not stores:
        log_warn("No stores found -- skipping accounting.")
        return

    # ── Expenses ──────────────────────────────────────────────────────────────
    exp_cats = _rows(
        get_client()
        .table("expense_categories")
        .select("*")
        .eq("company_id", 1)
        .execute()
        .data
    )
    if not exp_cats:
        log_warn(
            "No global expense categories found at company_id=1 -- skipping expenses."
        )
    else:
        cat_map: dict[str, int] = {
            str(r["category_name"]): int(r["id"]) for r in exp_cats
        }

        def _cat(*candidates: str) -> int | None:
            for name in candidates:
                for cat_name, cat_id in cat_map.items():
                    if name.lower() in cat_name.lower():
                        return cat_id
            return None

        def _jitter(base: int) -> int:
            return _round_ugx(base * rng.uniform(0.85, 1.15))

        exp_templates = [
            (
                "Rent",
                _fin(profile, "expense_rent_ugx", 2_000_000),
                "bank_transfer",
                True,
                "monthly",
            ),
            (
                "Utilities",
                _fin(profile, "expense_utilities_ugx", 380_000),
                "cash",
                False,
                None,
            ),
            (
                "Salaries",
                _fin(profile, "expense_salaries_ugx", 8_500_000),
                "bank_transfer",
                True,
                "monthly",
            ),
            (
                "Transport",
                _fin(profile, "expense_transport_ugx", 150_000),
                "cash",
                False,
                None,
            ),
            (
                "Marketing",
                _fin(profile, "expense_marketing_ugx", 200_000),
                "mobile_money",
                False,
                None,
            ),
        ]

        exp_total = 0
        exp_glob_idx = 0

        # FIX: was `stores[:2]` — now seeds ALL stores
        for store in stores:
            sid = int(store["id"])
            store_name = str(store["store_name"])
            expenses: list[Row] = []

            for restricted_round in (False, True):
                for idx, (label, amount, method, recurring, freq) in enumerate(
                    exp_templates
                ):
                    cat_id = _cat(label)
                    if cat_id is None:
                        continue
                    tag = "RESTRICTED" if restricted_round else "OPEN"

                    # FIX: was `days_ago(rng.randint(18, 35) + idx * rng.randint(3, 7))`
                    # Using 0-6 days ago ensures expenses appear on the 7D chart.
                    # Spread across different days (idx % 7) for visual variety.
                    expense_day = (idx + (1 if restricted_round else 0)) % 7
                    row: Row = {
                        "company_id": c,
                        "store_id": sid,
                        "expense_number": _doc_number("EXP", exp_glob_idx + 1),
                        "expense_date": days_ago(expense_day),
                        "category_id": cat_id,
                        "amount": _jitter(amount),
                        "tax_rate": 0,
                        "tax_amount": 0,
                        "total_amount": _jitter(amount),
                        "payment_method": method,
                        "description": f"[{tag}] {label} - {store_name}",
                        "is_recurring": recurring,
                        "payment_status": "paid",
                        "is_restricted": restricted_round,
                    }
                    if freq:
                        row["recurrence_frequency"] = freq
                    expenses.append(row)
                    exp_glob_idx += 1

            if expenses:
                inserted = _rows(
                    db_upsert(
                        "expenses", expenses, on_conflict="company_id,expense_number"
                    )
                )
                exp_total += len(inserted)
                r = sum(1 for e in expenses if e["is_restricted"])
                log_ok(
                    f"  {len(inserted)} expenses for {store_name}  ({r} restricted | {len(inserted) - r} open)."
                )

        log_ok(f"{exp_total} total expenses inserted.")

    # ── Income ────────────────────────────────────────────────────────────────
    inc_cats = _rows(
        get_client()
        .table("income_categories")
        .select("*")
        .eq("company_id", 1)
        .execute()
        .data
    )
    if not inc_cats:
        log_warn(
            "No global income categories found at company_id=1 -- skipping income."
        )
        return

    inc_cat_map: dict[str, int] = {
        str(r["category_name"]): int(r["id"]) for r in inc_cats
    }

    def _inc_cat(*candidates: str) -> int | None:
        for name in candidates:
            for cat_name, cat_id in inc_cat_map.items():
                if name.lower() in cat_name.lower():
                    return cat_id
        return None

    def _jitter_inc(base: int) -> int:
        return _round_ugx(base * rng.uniform(0.8, 1.2))

    inc_templates = [
        ("Sales Revenue", _fin(profile, "income_sales_revenue_ugx", 5_000_000), "cash"),
        (
            "Service Charges",
            _fin(profile, "income_service_charges_ugx", 300_000),
            "mobile_money",
        ),
        ("Consultation", _fin(profile, "income_consultation_ugx", 150_000), "cash"),
        (
            "Delivery Fees",
            _round_ugx(_fin(profile, "income_service_charges_ugx", 300_000) * 0.3),
            "mobile_money",
        ),
        (
            "Miscellaneous",
            _round_ugx(_fin(profile, "income_consultation_ugx", 150_000) * 0.3),
            "cash",
        ),
    ]

    inc_total = 0
    inc_glob_idx = 0

    # FIX: was `stores[:2]` — now seeds ALL stores for income too
    for store in stores:
        sid = int(store["id"])
        store_name = str(store["store_name"])
        incomes: list[Row] = []

        for restricted_round in (False, True):
            for idx, (label, amount, method) in enumerate(inc_templates):
                cat_id = _inc_cat(
                    label, "sales", "service", "consult", "delivery", "misc"
                )
                if cat_id is None:
                    cat_id = list(inc_cat_map.values())[idx % len(inc_cat_map)]
                tag = "RESTRICTED" if restricted_round else "OPEN"
                incomes.append(
                    {
                        "company_id": c,
                        "store_id": sid,
                        "income_number": _doc_number("INC", inc_glob_idx + 1),
                        "income_date": days_ago(
                            rng.randint(5, 18) + idx * rng.randint(2, 4)
                        ),
                        "category_id": cat_id,
                        "amount": _jitter_inc(amount),
                        "tax_rate": 0,
                        "tax_amount": 0,
                        "total_amount": _jitter_inc(amount),
                        "payment_method": method,
                        "payment_status": "paid",
                        "description": f"[{tag}] {label} - {store_name}",
                        "is_restricted": restricted_round,
                    }
                )
                inc_glob_idx += 1

        if incomes:
            inserted = _rows(
                db_upsert("income", incomes, on_conflict="company_id,income_number")
            )
            inc_total += len(inserted)
            r = sum(1 for i in incomes if i["is_restricted"])
            log_ok(
                f"  {len(inserted)} income records for {store_name}  ({r} restricted | {len(inserted) - r} open)."
            )

    log_ok(f"{inc_total} total income records inserted.")


# ── 10. Clear ─────────────────────────────────────────────────────────────────
def clear_seed_data(company_id: int) -> None:
    """
    Full destructive wipe of all data for a company, in strict FK-safe order.

    Critical ordering rule:
      product_batches.purchase_order_id → purchase_orders  (fk_batches_po)
      ∴ product_batches MUST be deleted BEFORE purchase_orders.

    Additional rules:
      - sale_items / sales_return_items / stock_adjustments reference product_batches
        → must be deleted before product_batches
      - income / expenses have a DELETE trigger that guards is_system=True rows
        → filter to is_system=False
      - journal_entries has a self-referential reversed_entry_id FK
        → null it before deleting
      - profiles.default_store_id → stores
        → null before deleting stores
    """
    c = company_id
    print(f"\nWARNING: About to DELETE all data for company_id={c}")
    confirm = input("  Type 'DELETE' to confirm: ").strip()
    if confirm != "DELETE":
        print("  Cancelled.")
        return

    client = get_client()

    def _ok(tbl: str) -> None:
        print(f"    OK  {tbl}")

    def _warn(tbl: str, exc: Exception) -> None:
        print(f"    WARN  {tbl}: {exc}")

    def _parent_ids(parent_tbl: str) -> list[int]:
        return [
            int(r["id"])
            for r in _rows(
                client.table(parent_tbl).select("id").eq("company_id", c).execute().data
            )
        ]

    def _via_parent(child_tbl: str, child_fk: str, ids: list[int]) -> None:
        if not ids:
            return
        chunk = 100
        for i in range(0, len(ids), chunk):
            client.table(child_tbl).delete().in_(child_fk, ids[i : i + chunk]).execute()

    # ── Collect parent IDs ────────────────────────────────────────────────────
    sale_ids = _parent_ids("sales")
    purchase_order_ids = _parent_ids("purchase_orders")
    purchase_return_ids = _parent_ids("purchase_returns")
    sales_return_ids = _parent_ids("sales_returns")
    supplier_ids = _parent_ids("suppliers")
    customer_ids = _parent_ids("customers")
    batch_ids = _parent_ids("product_batches")
    stock_transfer_ids = _parent_ids("stock_transfers")
    quotation_ids = _parent_ids("quotations")
    journal_entry_ids = _parent_ids("journal_entries")
    credit_transaction_ids = _parent_ids("credit_transactions")

    print("\n  [1/7] Leaf tables (no company_id) …")
    indirect = [
        ("sale_items", "sale_id", sale_ids),
        ("sale_payments", "sale_id", sale_ids),
        ("sales_return_items", "sales_return_id", sales_return_ids),
        ("purchase_order_items", "purchase_order_id", purchase_order_ids),
        ("purchase_return_items", "purchase_return_id", purchase_return_ids),
        ("purchase_invoices", "purchase_order_id", purchase_order_ids),
        ("supplier_ratings", "supplier_id", supplier_ids),
        ("customer_insurance", "customer_id", customer_ids),
        ("quotation_items", "quotation_id", quotation_ids),
        ("stock_transfer_items", "stock_transfer_id", stock_transfer_ids),
        ("stock_adjustments", "batch_id", batch_ids),
        ("journal_entry_lines", "journal_entry_id", journal_entry_ids),
        ("cash_flow_transactions", "journal_entry_id", journal_entry_ids),
        ("credit_payments", "credit_transaction_id", credit_transaction_ids),
        ("payment_schedules", "credit_transaction_id", credit_transaction_ids),
    ]
    for child_tbl, child_fk, ids in indirect:
        try:
            _via_parent(child_tbl, child_fk, ids)
            _ok(child_tbl)
        except Exception as exc:
            _warn(child_tbl, exc)

    # payment_transactions has company_id
    try:
        client.table("payment_transactions").delete().eq("company_id", c).execute()
        _ok("payment_transactions")
    except Exception as exc:
        _warn("payment_transactions", exc)

    print("  [2/7] income / expenses (non-system) …")
    for tbl in ("income", "expenses"):
        try:
            client.table(tbl).delete().eq("company_id", c).eq(
                "is_system", False
            ).execute()
            _ok(tbl)
        except Exception as exc:
            _warn(tbl, exc)

    print("  [3/7] Sales, returns, quotations, prescriptions …")
    for tbl in (
        "sales_returns",
        "quotations",
        "prescriptions",
        "sales",
        "stock_transfers",
    ):
        try:
            client.table(tbl).delete().eq("company_id", c).execute()
            _ok(tbl)
        except Exception as exc:
            _warn(tbl, exc)

    print("  [4/7] Purchase returns …")
    try:
        client.table("purchase_returns").delete().eq("company_id", c).execute()
        _ok("purchase_returns")
    except Exception as exc:
        _warn("purchase_returns", exc)

    print("  [5/7] product_batches (before purchase_orders) …")
    try:
        client.table("product_batches").delete().eq("company_id", c).execute()
        _ok("product_batches")
    except Exception as exc:
        _warn("product_batches", exc)

    print("  [6/7] purchase_orders, credit, journal …")
    try:
        client.table("purchase_orders").delete().eq("company_id", c).execute()
        _ok("purchase_orders")
    except Exception as exc:
        _warn("purchase_orders", exc)

    try:
        client.table("credit_transactions").delete().eq("company_id", c).execute()
        _ok("credit_transactions")
    except Exception as exc:
        _warn("credit_transactions", exc)

    # Null self-referential FK before deleting journal_entries
    try:
        client.table("journal_entries").update({"reversed_entry_id": None}).eq(
            "company_id", c
        ).execute()
        client.table("journal_entries").delete().eq("company_id", c).execute()
        _ok("journal_entries")
    except Exception as exc:
        _warn("journal_entries", exc)

    print("  [7/7] Master / structural tables …")

    # Null profiles.default_store_id before deleting stores 
    try:
        store_ids = [
            int(r["id"])
            for r in _rows(
                client.table("stores").select("id").eq("company_id", c).execute().data
            )
        ]
        if store_ids:
            client.table("profiles").update({"default_store_id": None}).in_(
                "default_store_id", store_ids
            ).execute()
        _ok("profiles.default_store_id nulled")
    except Exception as exc:
        _warn("profiles.default_store_id", exc)

    for tbl in ("customers", "suppliers", "stores", "areas", "company_settings"):
        try:
            client.table(tbl).delete().eq("company_id", c).execute()
            _ok(tbl)
        except Exception as exc:
            _warn(tbl, exc)

    try:
        client.table("companies").delete().eq("id", c).execute()
        _ok(f"companies (id={c})")
    except Exception as exc:
        _warn("companies", exc)

    log_ok(f"Cleared all data for company_id={c}.")

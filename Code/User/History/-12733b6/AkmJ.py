#!/usr/bin/env python3
"""
PharmaSOS Database Seeder
Seeds a target company with realistic demo data.

Structure seeded:
  - 3 areas  (Kampala City, Wakiso District, Entebbe)
  - 2 stores per area = 6 stores total
  - Purchases & sales created per-store
  - Master data (products, suppliers, customers, accounting) shared across company
  - copy_template_data_to_new_company() is called first to bootstrap
    roles / permissions / COA / categories from the TEMPLATE company (id=1)

Usage (standalone):
  python seeder.py --all              # Full seed for COMPANY_ID in .env
  python seeder.py --company-id 5 --all
  python seeder.py --company-id 5 --stores
  python seeder.py --company-id 5 --sales
  python seeder.py --company-id 5 --clear
"""

import argparse
import os
import sys
from datetime import date, datetime, timedelta
from typing import Optional

from dotenv import load_dotenv
from supabase import Client, create_client

# ─────────────────────────────────────────────
# Environment & Connection
# ─────────────────────────────────────────────
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌  Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env")
    sys.exit(1)

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅  Connected to Supabase")
except Exception as e:
    print(f"❌  Connection failed: {e}")
    sys.exit(1)

# ─────────────────────────────────────────────
# Globals (set per run)
# ─────────────────────────────────────────────
COMPANY_ID: int = int(os.getenv("COMPANY_ID", "2"))


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
def insert(table: str, data: dict | list) -> list:
    try:
        result = supabase.table(table).insert(data).execute()
        return result.data or []
    except Exception as e:
        print(f"  ⚠️   insert {table}: {e}")
        return []


def upsert(table: str, data: dict | list, on_conflict: str = "id") -> list:
    try:
        result = supabase.table(table).upsert(data, on_conflict=on_conflict).execute()
        return result.data or []
    except Exception as e:
        print(f"  ⚠️   upsert {table}: {e}")
        return []


def fetch_company(filters: dict = None) -> list:
    """Fetch rows scoped to COMPANY_ID."""
    try:
        q = supabase.table.__class__  # just to show intent
        q = (
            supabase.table(filters.pop("_table"))
            .select("*")
            .eq("company_id", COMPANY_ID)
        )
        for k, v in (filters or {}).items():
            q = q.eq(k, v)
        return q.execute().data or []
    except Exception as e:
        print(f"  ⚠️   fetch: {e}")
        return []


def fetch(table: str, filters: dict = None) -> list:
    try:
        q = supabase.table(table).select("*").eq("company_id", COMPANY_ID)
        for k, v in (filters or {}).items():
            q = q.eq(k, v)
        return q.execute().data or []
    except Exception as e:
        print(f"  ⚠️   fetch {table}: {e}")
        return []


def days_ago(n: int) -> str:
    return (date.today() - timedelta(days=n)).isoformat()


def days_ahead(n: int) -> str:
    return (date.today() + timedelta(days=n)).isoformat()


def now_minus(days: int = 0) -> str:
    return (datetime.utcnow() - timedelta(days=days)).isoformat()


# ─────────────────────────────────────────────
# 0. COPY FROM TEMPLATE  (calls the DB function)
# ─────────────────────────────────────────────
def copy_from_template():
    """
    Calls the PostgreSQL function copy_template_data_to_new_company(company_id).
    This copies: roles, permissions, role_permissions, chart_of_accounts,
    income_categories, expense_categories, categories, units from company_id=1.
    """
    print(f"\n🔁  Copying template data → company {COMPANY_ID}...")
    try:
        result = supabase.rpc(
            "copy_template_data_to_new_company", {"p_company_id": COMPANY_ID}
        ).execute()
        print("  ✅  Template copy complete")
        return True
    except Exception as e:
        print(f"  ⚠️   Template copy failed (may already exist): {e}")
        return False


# ─────────────────────────────────────────────
# 1. COMPANY & SETTINGS
# ─────────────────────────────────────────────
def seed_company(name: str = None):
    print(f"\n🏢  Seeding company {COMPANY_ID}...")

    company_name = name or f"HealthPlus Pharmacy {COMPANY_ID}"
    slug = company_name.upper().replace(" ", "")[:8]

    company = {
        "id": COMPANY_ID,
        "company_name": company_name,
        "company_code": f"HP{COMPANY_ID:04d}",
        "email": f"admin@healthplus{COMPANY_ID}.ug",
        "phone": f"+25670000{COMPANY_ID:04d}",
        "address": "Plot 14, Kampala Road, Kampala, Uganda",
        "city": "Kampala",
        "country": "Uganda",
        "tax_id": f"100{COMPANY_ID:07d}",
        "is_active": True,
    }
    rows = upsert("companies", company)
    print(f"  ✅  Company: {rows[0]['company_name'] if rows else 'exists'}")

    settings = {
        "company_id": COMPANY_ID,
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
    }
    upsert("company_settings", settings, on_conflict="company_id")
    print("  ✅  Company settings seeded")


# ─────────────────────────────────────────────
# 2. AREAS & STORES  (3 areas × 2 stores)
# ─────────────────────────────────────────────
def seed_stores() -> tuple[list, list]:
    print("\n🏪  Seeding 3 areas × 2 stores...")

    areas_data = [
        {
            "company_id": COMPANY_ID,
            "area_name": "Kampala City",
            "area_code": f"KLA-{COMPANY_ID}",
            "region": "Central",
            "country": "Uganda",
            "description": "Kampala central business district stores",
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "area_name": "Wakiso District",
            "area_code": f"WAK-{COMPANY_ID}",
            "region": "Central",
            "country": "Uganda",
            "description": "Greater Kampala suburban stores",
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "area_name": "Entebbe",
            "area_code": f"ENT-{COMPANY_ID}",
            "region": "Central",
            "country": "Uganda",
            "description": "Entebbe peninsula stores",
            "is_active": True,
        },
    ]
    area_rows = insert("areas", areas_data)
    print(f"  ✅  {len(area_rows)} areas inserted")

    if not area_rows:
        print("  ❌  No areas created — aborting stores seed")
        return [], []

    # 2 stores per area
    stores_data = []
    store_definitions = [
        # Area 0 — Kampala City
        {
            "area_idx": 0,
            "store_name": f"HP Main Branch",
            "store_code": f"HP{COMPANY_ID}-KLA-01",
            "store_type": "pharmacy",
            "address": "Plot 14, Kampala Road, Kampala",
            "phone": f"+25670{COMPANY_ID:04d}01",
            "email": f"main{COMPANY_ID}@healthplus.ug",
        },
        {
            "area_idx": 0,
            "store_name": f"HP Wandegeya Branch",
            "store_code": f"HP{COMPANY_ID}-KLA-02",
            "store_type": "pharmacy",
            "address": "Wandegeya, Kampala",
            "phone": f"+25670{COMPANY_ID:04d}02",
            "email": f"wandegeya{COMPANY_ID}@healthplus.ug",
        },
        # Area 1 — Wakiso
        {
            "area_idx": 1,
            "store_name": f"HP Ntinda Branch",
            "store_code": f"HP{COMPANY_ID}-WAK-01",
            "store_type": "pharmacy",
            "address": "Ntinda Shopping Centre, Wakiso",
            "phone": f"+25670{COMPANY_ID:04d}03",
            "email": f"ntinda{COMPANY_ID}@healthplus.ug",
        },
        {
            "area_idx": 1,
            "store_name": f"HP Nansana Branch",
            "store_code": f"HP{COMPANY_ID}-WAK-02",
            "store_type": "pharmacy",
            "address": "Nansana Town, Wakiso",
            "phone": f"+25670{COMPANY_ID:04d}04",
            "email": f"nansana{COMPANY_ID}@healthplus.ug",
        },
        # Area 2 — Entebbe
        {
            "area_idx": 2,
            "store_name": f"HP Entebbe Branch",
            "store_code": f"HP{COMPANY_ID}-ENT-01",
            "store_type": "pharmacy",
            "address": "Entebbe Road, Entebbe",
            "phone": f"+25670{COMPANY_ID:04d}05",
            "email": f"entebbe{COMPANY_ID}@healthplus.ug",
        },
        {
            "area_idx": 2,
            "store_name": f"HP Katabi Branch",
            "store_code": f"HP{COMPANY_ID}-ENT-02",
            "store_type": "pharmacy",
            "address": "Katabi Town Council, Entebbe",
            "phone": f"+25670{COMPANY_ID:04d}06",
            "email": f"katabi{COMPANY_ID}@healthplus.ug",
        },
    ]

    for sd in store_definitions:
        stores_data.append(
            {
                "company_id": COMPANY_ID,
                "area_id": area_rows[sd["area_idx"]]["id"],
                "store_name": sd["store_name"],
                "store_code": sd["store_code"],
                "store_type": sd["store_type"],
                "address": sd["address"],
                "phone": sd["phone"],
                "email": sd["email"],
                "is_active": True,
            }
        )

    store_rows = insert("stores", stores_data)
    print(f"  ✅  {len(store_rows)} stores inserted (2 per area)")
    return area_rows, store_rows


# ─────────────────────────────────────────────
# 3. SUPPLIERS
# ─────────────────────────────────────────────
def seed_suppliers() -> list:
    print("\n🚚  Seeding suppliers...")
    c = COMPANY_ID
    data = [
        {
            "company_id": c,
            "supplier_name": "Cipla Quality Chemical Uganda",
            "supplier_code": f"SUP{c:04d}001",
            "email": "orders@cipla.co.ug",
            "phone": "+256414123456",
            "address": "Plot 23, Industrial Area, Kampala",
            "contact_person": "John Mwesigwa",
            "payment_terms": "net_30",
            "credit_limit": 5000000,
            "is_active": True,
        },
        {
            "company_id": c,
            "supplier_name": "National Medical Stores (NMS)",
            "supplier_code": f"SUP{c:04d}002",
            "email": "procurement@nms.go.ug",
            "phone": "+256414340808",
            "address": "Port Bell Road, Kampala",
            "contact_person": "Grace Nakato",
            "payment_terms": "net_30",
            "credit_limit": 10000000,
            "is_active": True,
        },
        {
            "company_id": c,
            "supplier_name": "Strides Pharma Uganda",
            "supplier_code": f"SUP{c:04d}003",
            "email": "uganda@strides.com",
            "phone": "+256414555123",
            "address": "8th Street, Industrial Area, Kampala",
            "contact_person": "Peter Ssemanda",
            "payment_terms": "net_45",
            "credit_limit": 3000000,
            "is_active": True,
        },
        {
            "company_id": c,
            "supplier_name": "Medipharm Uganda Ltd",
            "supplier_code": f"SUP{c:04d}004",
            "email": "sales@medipharm.co.ug",
            "phone": "+256754321987",
            "address": "Plot 5, Spring Road, Bugolobi",
            "contact_person": "Sarah Akello",
            "payment_terms": "net_30",
            "credit_limit": 2000000,
            "is_active": True,
        },
    ]
    rows = insert("suppliers", data)
    print(f"  ✅  {len(rows)} suppliers inserted")
    return rows


# ─────────────────────────────────────────────
# 4. CUSTOMERS
# ─────────────────────────────────────────────
def seed_customers() -> list:
    print("\n👥  Seeding customers...")
    c = COMPANY_ID
    data = [
        {
            "company_id": c,
            "customer_name": "Walk-in Customer",
            "customer_code": f"WALKIN-{c:04d}",
            "is_active": True,
            "credit_limit": 0,
            "credit_days": 0,
        },
        {
            "company_id": c,
            "customer_name": "Nakato Mary",
            "customer_code": f"CUST-{c:04d}-001",
            "email": f"mary{c}@gmail.com",
            "phone": f"+25670{c:04d}11",
            "gender": "female",
            "date_of_birth": "1985-03-15",
            "address": "Ntinda, Kampala",
            "credit_limit": 500000,
            "credit_days": 30,
            "is_active": True,
        },
        {
            "company_id": c,
            "customer_name": "Ssemanda Joseph",
            "customer_code": f"CUST-{c:04d}-002",
            "email": f"joseph{c}@yahoo.com",
            "phone": f"+25670{c:04d}12",
            "gender": "male",
            "date_of_birth": "1978-07-22",
            "address": "Kiira, Wakiso",
            "credit_limit": 300000,
            "credit_days": 30,
            "is_active": True,
        },
        {
            "company_id": c,
            "customer_name": "Akello Grace",
            "customer_code": f"CUST-{c:04d}-003",
            "email": f"grace{c}@gmail.com",
            "phone": f"+25670{c:04d}13",
            "gender": "female",
            "date_of_birth": "1992-01-10",
            "address": "Kawempe, Kampala",
            "credit_limit": 200000,
            "credit_days": 14,
            "is_active": True,
        },
        {
            "company_id": c,
            "customer_name": "Bbosa Clinic & Hospital",
            "customer_code": f"INST-{c:04d}-001",
            "email": f"pharmacy{c}@bbosa.co.ug",
            "phone": f"+25641{c:04d}77",
            "address": "Bukoto, Kampala",
            "credit_limit": 5000000,
            "credit_days": 30,
            "is_active": True,
        },
        {
            "company_id": c,
            "customer_name": "Mugisha Robert",
            "customer_code": f"CUST-{c:04d}-004",
            "email": f"mugisha{c}@gmail.com",
            "phone": f"+25670{c:04d}14",
            "gender": "male",
            "date_of_birth": "1955-09-05",
            "address": "Makindye, Kampala",
            "credit_limit": 500000,
            "credit_days": 30,
            "is_active": True,
        },
    ]
    rows = insert("customers", data)
    print(f"  ✅  {len(rows)} customers inserted")
    return rows


# ─────────────────────────────────────────────
# 5. PRODUCTS  (uses categories/units from template copy)
# ─────────────────────────────────────────────
def seed_products() -> list:
    print("\n💊  Seeding products...")

    # Fetch categories and units seeded by template copy
    cat_rows = (
        supabase.table("categories")
        .select("*")
        .eq("company_id", COMPANY_ID)
        .is_("deleted_at", "null")
        .execute()
        .data
        or []
    )
    unit_rows = (
        supabase.table("units")
        .select("*")
        .eq("company_id", COMPANY_ID)
        .is_("deleted_at", "null")
        .execute()
        .data
        or []
    )

    if not cat_rows or not unit_rows:
        print("  ⚠️   No categories/units found — did you run copy_from_template()?")
        return []

    cat_map = {r["category_name"]: r["id"] for r in cat_rows}
    unit_map = {r["unit_name"]: r["id"] for r in unit_rows}

    # Safe lookups
    def cat(name):
        return cat_map.get(name) or cat_rows[0]["id"]

    def unit(name):
        return unit_map.get(name) or unit_rows[0]["id"]

    c = COMPANY_ID
    data = [
        {
            "company_id": c,
            "product_name": "Paracetamol 500mg Tabs",
            "generic_name": "Paracetamol",
            "sku": f"PCM-500-{c}",
            "category_id": cat("Tablets"),
            "unit_id": unit("Tablet"),
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": False,
            "reorder_level": 200,
            "cost_price": 50,
            "selling_price": 100,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": c,
            "product_name": "Amoxicillin 500mg Caps",
            "generic_name": "Amoxicillin",
            "sku": f"AMX-500-{c}",
            "category_id": cat("Antibiotics"),
            "unit_id": unit("Capsule"),
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": True,
            "reorder_level": 100,
            "cost_price": 150,
            "selling_price": 300,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": c,
            "product_name": "Coartem 80/480mg Tabs",
            "generic_name": "Artemether/Lumefantrine",
            "sku": f"COA-480-{c}",
            "category_id": cat("Antimalaria"),
            "unit_id": unit("Tablet"),
            "manufacturer": "Novartis",
            "requires_prescription": True,
            "reorder_level": 50,
            "cost_price": 8000,
            "selling_price": 12000,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": c,
            "product_name": "Metformin 500mg Tabs",
            "generic_name": "Metformin HCl",
            "sku": f"MET-500-{c}",
            "category_id": cat("Tablets"),
            "unit_id": unit("Tablet"),
            "manufacturer": "Strides Shasun",
            "requires_prescription": True,
            "reorder_level": 150,
            "cost_price": 80,
            "selling_price": 150,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": c,
            "product_name": "Ibuprofen 400mg Tabs",
            "generic_name": "Ibuprofen",
            "sku": f"IBU-400-{c}",
            "category_id": cat("Tablets"),
            "unit_id": unit("Tablet"),
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": False,
            "reorder_level": 150,
            "cost_price": 60,
            "selling_price": 120,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": c,
            "product_name": "Ciprofloxacin 500mg Tabs",
            "generic_name": "Ciprofloxacin HCl",
            "sku": f"CIP-500-{c}",
            "category_id": cat("Antibiotics"),
            "unit_id": unit("Tablet"),
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": True,
            "reorder_level": 100,
            "cost_price": 200,
            "selling_price": 400,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": c,
            "product_name": "Omeprazole 20mg Caps",
            "generic_name": "Omeprazole",
            "sku": f"OMP-20-{c}",
            "category_id": cat("Capsules"),
            "unit_id": unit("Capsule"),
            "manufacturer": "Strides Shasun",
            "requires_prescription": False,
            "reorder_level": 100,
            "cost_price": 120,
            "selling_price": 250,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": c,
            "product_name": "Paracetamol Syrup 120mg/5ml",
            "generic_name": "Paracetamol",
            "sku": f"PCM-SYR-{c}",
            "category_id": cat("Syrups & Suspensions"),
            "unit_id": unit("Bottle"),
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": False,
            "reorder_level": 50,
            "cost_price": 3000,
            "selling_price": 5000,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": c,
            "product_name": "ORS Sachet",
            "generic_name": "Oral Rehydration Salts",
            "sku": f"ORS-{c}",
            "category_id": cat("Syrups & Suspensions"),
            "unit_id": unit("Piece"),
            "manufacturer": "NMS Uganda",
            "requires_prescription": False,
            "reorder_level": 100,
            "cost_price": 500,
            "selling_price": 1000,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": c,
            "product_name": "Vitamin C 500mg Tabs",
            "generic_name": "Ascorbic Acid",
            "sku": f"VTC-500-{c}",
            "category_id": cat("Vitamins & Supplements"),
            "unit_id": unit("Tablet"),
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": False,
            "reorder_level": 200,
            "cost_price": 30,
            "selling_price": 60,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": c,
            "product_name": "Surgical Gloves (Pair) Size M",
            "generic_name": "Latex Gloves",
            "sku": f"GLV-SUR-{c}",
            "category_id": cat("Medical Supplies"),
            "unit_id": unit("Piece"),
            "manufacturer": "Medline",
            "requires_prescription": False,
            "reorder_level": 100,
            "cost_price": 1000,
            "selling_price": 2000,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": c,
            "product_name": "Cotrimoxazole 480mg Tabs",
            "generic_name": "Sulfamethoxazole/Trimethoprim",
            "sku": f"CTX-480-{c}",
            "category_id": cat("Antibiotics"),
            "unit_id": unit("Tablet"),
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": True,
            "reorder_level": 100,
            "cost_price": 80,
            "selling_price": 150,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": c,
            "product_name": "Betamethasone Cream 0.1%",
            "generic_name": "Betamethasone Valerate",
            "sku": f"BET-CRM-{c}",
            "category_id": cat("Creams & Ointments"),
            "unit_id": unit("Tube"),
            "manufacturer": "GSK",
            "requires_prescription": True,
            "reorder_level": 30,
            "cost_price": 4000,
            "selling_price": 7000,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": c,
            "product_name": "Metronidazole 400mg Tabs",
            "generic_name": "Metronidazole",
            "sku": f"MTZ-400-{c}",
            "category_id": cat("Antibiotics"),
            "unit_id": unit("Tablet"),
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": True,
            "reorder_level": 100,
            "cost_price": 70,
            "selling_price": 150,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": c,
            "product_name": "Insulin Glargine 100IU/ml",
            "generic_name": "Insulin Glargine",
            "sku": f"INS-GLA-{c}",
            "category_id": cat("Injectables"),
            "unit_id": unit("Vial"),
            "manufacturer": "Sanofi",
            "requires_prescription": True,
            "reorder_level": 20,
            "cost_price": 45000,
            "selling_price": 70000,
            "tax_rate": 0,
            "is_active": True,
        },
    ]

    rows = insert("products", data)
    print(f"  ✅  {len(rows)} products inserted")
    return rows


# ─────────────────────────────────────────────
# 6. INVENTORY  (batches per store)
# ─────────────────────────────────────────────
def seed_inventory(product_rows: list, store_rows: list, supplier_rows: list) -> list:
    print(f"\n📦  Seeding inventory for {len(store_rows)} stores...")

    if not all([product_rows, store_rows, supplier_rows]):
        print("  ⚠️   Missing dependencies — skipping inventory")
        return []

    sup_id = supplier_rows[0]["id"]
    sup2_id = supplier_rows[1]["id"] if len(supplier_rows) > 1 else sup_id
    today_str = date.today().strftime("%Y%m%d")

    batches = []
    for store_idx, store in enumerate(store_rows):
        store_id = store["id"]
        store_code = store["store_code"].replace("-", "")[-4:]
        sup = sup_id if store_idx % 2 == 0 else sup2_id

        for prod_idx, prod in enumerate(product_rows):
            qty_base = 150 + store_idx * 20 + prod_idx * 5
            batches.append(
                {
                    "company_id": COMPANY_ID,
                    "product_id": prod["id"],
                    "store_id": store_id,
                    "batch_number": f"BT-{store_code}-{today_str}-{prod_idx + 1:03d}",
                    "manufacturing_date": days_ago(180 + store_idx * 10),
                    "expiry_date": days_ahead(365 + prod_idx * 15),
                    "quantity_received": qty_base + 50,
                    "quantity_available": qty_base,
                    "cost_price": prod.get("cost_price", 500),
                    "selling_price": prod.get("selling_price", 1000),
                    "supplier_id": sup,
                    "is_active": True,
                }
            )

    # Near-expiry demo batch on first store
    if product_rows and store_rows:
        batches.append(
            {
                "company_id": COMPANY_ID,
                "product_id": product_rows[0]["id"],
                "store_id": store_rows[0]["id"],
                "batch_number": f"NEAREXP-{COMPANY_ID}-001",
                "manufacturing_date": days_ago(300),
                "expiry_date": days_ahead(25),
                "quantity_received": 50,
                "quantity_available": 20,
                "cost_price": product_rows[0].get("cost_price", 500),
                "selling_price": product_rows[0].get("selling_price", 1000),
                "supplier_id": sup_id,
                "is_active": True,
                "notes": "Near expiry — seeder demo batch",
            }
        )

    rows = insert("product_batches", batches)
    print(
        f"  ✅  {len(rows)} batches inserted ({len(product_rows)} products × {len(store_rows)} stores)"
    )
    return rows


# ─────────────────────────────────────────────
# 7. PURCHASES  (per store)
# ─────────────────────────────────────────────
def seed_purchases(product_rows: list, store_rows: list, supplier_rows: list):
    print(f"\n🛒  Seeding purchases for {len(store_rows)} stores...")

    if not all([product_rows, store_rows, supplier_rows]):
        print("  ⚠️   Missing dependencies — skipping purchases")
        return

    sup_ids = [s["id"] for s in supplier_rows]
    all_po_rows = []

    for store_idx, store in enumerate(store_rows):
        store_id = store["id"]
        store_code = store["store_code"]
        sup_id = sup_ids[store_idx % len(sup_ids)]
        sup2_id = sup_ids[(store_idx + 1) % len(sup_ids)]

        pos = [
            {
                "company_id": COMPANY_ID,
                "store_id": store_id,
                "supplier_id": sup_id,
                "po_number": f"PO-{store_code}-{days_ago(30).replace('-', '')}-01",
                "po_date": days_ago(30),
                "expected_delivery_date": days_ago(23),
                "status": "received",
                "subtotal": 2500000,
                "tax_amount": 0,
                "discount_amount": 50000,
                "total_amount": 2450000,
                "paid_amount": 2450000,
                "payment_terms": "net_30",
                "payment_status": "paid",
                "payment_method": "bank_transfer",
                "notes": f"Monthly restock — {store['store_name']}",
            },
            {
                "company_id": COMPANY_ID,
                "store_id": store_id,
                "supplier_id": sup2_id,
                "po_number": f"PO-{store_code}-{days_ago(15).replace('-', '')}-02",
                "po_date": days_ago(15),
                "expected_delivery_date": days_ago(8),
                "status": "received",
                "subtotal": 1200000,
                "tax_amount": 0,
                "discount_amount": 0,
                "total_amount": 1200000,
                "paid_amount": 600000,
                "payment_terms": "net_30",
                "payment_status": "partially_paid",
                "payment_method": "cash",
            },
            {
                "company_id": COMPANY_ID,
                "store_id": store_id,
                "supplier_id": sup_id,
                "po_number": f"PO-{store_code}-{days_ago(3).replace('-', '')}-03",
                "po_date": days_ago(3),
                "expected_delivery_date": days_ahead(4),
                "status": "approved",
                "subtotal": 1800000,
                "tax_amount": 0,
                "discount_amount": 0,
                "total_amount": 1800000,
                "paid_amount": 0,
                "payment_terms": "net_30",
                "payment_status": "unpaid",
                "payment_method": "bank_transfer",
            },
        ]
        po_rows = insert("purchase_orders", pos)
        all_po_rows.extend(po_rows)

        # Add line items to first PO of each store
        if po_rows and len(product_rows) >= 2:
            items = [
                {
                    "purchase_order_id": po_rows[0]["id"],
                    "product_id": product_rows[0]["id"],
                    "quantity_ordered": 300,
                    "quantity_received": 300,
                    "unit_cost": product_rows[0].get("cost_price", 500),
                    "discount_amount": 0,
                    "total_cost": 300 * product_rows[0].get("cost_price", 500),
                    "expiry_date": days_ahead(730),
                    "batch_number": f"CIPLA-{store_code}-A01",
                },
                {
                    "purchase_order_id": po_rows[0]["id"],
                    "product_id": product_rows[1]["id"],
                    "quantity_ordered": 150,
                    "quantity_received": 150,
                    "unit_cost": product_rows[1].get("cost_price", 500),
                    "discount_amount": 0,
                    "total_cost": 150 * product_rows[1].get("cost_price", 500),
                    "expiry_date": days_ahead(540),
                    "batch_number": f"CIPLA-{store_code}-A02",
                },
            ]
            insert("purchase_order_items", items)

    print(f"  ✅  {len(all_po_rows)} purchase orders inserted (3 per store)")


# ─────────────────────────────────────────────
# 8. SALES  (per store)
# ─────────────────────────────────────────────
def seed_sales(
    product_rows: list, store_rows: list, customer_rows: list, batch_rows: list
):
    print(f"\n💰  Seeding sales for {len(store_rows)} stores...")

    if not all([product_rows, store_rows, customer_rows]):
        print("  ⚠️   Missing dependencies — skipping sales")
        return

    walkin = next(
        (c for c in customer_rows if "WALKIN" in c.get("customer_code", "")),
        customer_rows[0],
    )
    regular_customers = [
        c for c in customer_rows if "WALKIN" not in c.get("customer_code", "")
    ]
    cust1 = regular_customers[0] if regular_customers else walkin
    cust2 = regular_customers[1] if len(regular_customers) > 1 else walkin
    inst = next(
        (c for c in customer_rows if "INST" in c.get("customer_code", "")), cust1
    )

    # batch lookup: product_id -> batch_id
    batch_map = {}
    for b in batch_rows or []:
        pid = b["product_id"]
        if pid not in batch_map:
            batch_map[pid] = b["id"]

    all_sale_rows = []

    for store_idx, store in enumerate(store_rows):
        store_id = store["id"]
        store_code = store["store_code"]

        sales_list = []

        # 14 days × 3 sales per day per store
        for day in range(14, 0, -1):
            for sale_num in range(1, 4):
                total = (100 + day * 30 + sale_num * 50 + store_idx * 20) * 100
                customer = (
                    walkin if sale_num == 1 else (cust1 if sale_num == 2 else cust2)
                )
                sales_list.append(
                    {
                        "company_id": COMPANY_ID,
                        "store_id": store_id,
                        "sale_number": f"SAL-{store_code}-{days_ago(day).replace('-', '')}-{sale_num:03d}",
                        "sale_date": days_ago(day),
                        "customer_id": customer["id"],
                        "sale_type": "over_the_counter",
                        "sale_status": "completed",
                        "subtotal": total,
                        "tax_amount": 0,
                        "discount_amount": 0,
                        "total_amount": total,
                        "amount_paid": total,
                        "payment_method": "cash" if sale_num != 3 else "mobile_money",
                        "payment_status": "paid",
                    }
                )

        # 1 credit / institutional sale per store
        sales_list.append(
            {
                "company_id": COMPANY_ID,
                "store_id": store_id,
                "sale_number": f"SAL-{store_code}-CREDIT-001",
                "sale_date": days_ago(2),
                "customer_id": inst["id"],
                "sale_type": "institutional",
                "sale_status": "completed",
                "subtotal": 350000,
                "tax_amount": 0,
                "discount_amount": 0,
                "total_amount": 350000,
                "amount_paid": 0,
                "payment_method": "credit",
                "payment_status": "unpaid",
            }
        )

        sale_rows = insert("sales", sales_list)
        all_sale_rows.extend(sale_rows)

        # Add line items to first 3 sales of each store
        if sale_rows and len(product_rows) >= 2:
            items = []
            for sr in sale_rows[:3]:
                p1 = product_rows[store_idx % len(product_rows)]
                p2 = product_rows[(store_idx + 1) % len(product_rows)]
                items += [
                    {
                        "sale_id": sr["id"],
                        "product_id": p1["id"],
                        "batch_id": batch_map.get(p1["id"]),
                        "quantity": 2,
                        "unit_price": p1.get("selling_price", 1000),
                        "cost_price": p1.get("cost_price", 500),
                        "discount_amount": 0,
                        "total_price": 2 * p1.get("selling_price", 1000),
                        "tax_rate": 0,
                        "tax_amount": 0,
                    },
                    {
                        "sale_id": sr["id"],
                        "product_id": p2["id"],
                        "batch_id": batch_map.get(p2["id"]),
                        "quantity": 1,
                        "unit_price": p2.get("selling_price", 1000),
                        "cost_price": p2.get("cost_price", 500),
                        "discount_amount": 0,
                        "total_price": p2.get("selling_price", 1000),
                        "tax_rate": 0,
                        "tax_amount": 0,
                    },
                ]
            insert("sale_items", items)

    print(
        f"  ✅  {len(all_sale_rows)} sales inserted (~{14 * 3 + 1} per store × {len(store_rows)} stores)"
    )


# ─────────────────────────────────────────────
# 9. ACCOUNTING  (uses COA from template copy)
# ─────────────────────────────────────────────
def seed_accounting(store_rows: list):
    print("\n📒  Seeding expenses & income records...")

    # Fetch COA and expense_categories copied from template
    coa = (
        supabase.table("chart_of_accounts")
        .select("*")
        .eq("company_id", COMPANY_ID)
        .execute()
        .data
        or []
    )
    exp_cats = (
        supabase.table("expense_categories")
        .select("*")
        .eq("company_id", COMPANY_ID)
        .execute()
        .data
        or []
    )

    if not exp_cats:
        print("  ⚠️   No expense categories — skipping accounting")
        return

    exp_cat_map = {r["category_name"]: r["id"] for r in exp_cats}
    stores = store_rows or fetch("stores")

    if not stores:
        print("  ⚠️   No stores — skipping accounting")
        return

    # Seed expenses for first 2 stores (HQ stores)
    for store in stores[:2]:
        store_id = store["id"]
        store_name = store["store_name"]

        expense_templates = [
            (
                "Rent",
                2000000,
                "bank_transfer",
                f"Monthly rent — {store_name}",
                True,
                "monthly",
            ),
            (
                "Utilities",
                380000,
                "cash",
                f"Electricity & water — {store_name}",
                False,
                None,
            ),
            (
                "Salaries",
                8500000,
                "bank_transfer",
                f"Staff salaries — {store_name}",
                True,
                "monthly",
            ),
            (
                "Transport",
                150000,
                "cash",
                f"Stock delivery — {store_name}",
                False,
                None,
            ),
            (
                "Marketing",
                200000,
                "mobile_money",
                f"Social media ads — {store_name}",
                False,
                None,
            ),
        ]

        expenses = []
        for idx, (cat_name, amount, method, desc, recurring, freq) in enumerate(
            expense_templates
        ):
            cat_id = exp_cat_map.get(cat_name)
            if not cat_id:
                continue
            expenses.append(
                {
                    "company_id": COMPANY_ID,
                    "store_id": store_id,
                    "expense_date": days_ago(30 + idx * 5),
                    "expense_category_id": cat_id,
                    "amount": amount,
                    "tax_rate": 0,
                    "tax_amount": 0,
                    "total_amount": amount,
                    "payment_method": method,
                    "description": desc,
                    "is_recurring": recurring,
                    **({"frequency": freq} if freq else {}),
                }
            )

        if expenses:
            rows = insert("expenses", expenses)
            print(f"  ✅  {len(rows)} expenses for {store_name}")


# ─────────────────────────────────────────────
# 10. CLEAR SEEDED DATA
# ─────────────────────────────────────────────
def clear_seed_data():
    print(f"\n⚠️   Clearing all data for company_id={COMPANY_ID}...")
    confirm = input("   Type 'DELETE' to confirm: ").strip()
    if confirm != "DELETE":
        print("  ❌  Cancelled.")
        return

    tables = [
        "sale_items",
        "sale_payments",
        "sales_return_items",
        "sales_returns",
        "sales",
        "purchase_return_items",
        "purchase_returns",
        "purchase_order_items",
        "purchase_invoices",
        "purchase_orders",
        "product_batches",
        "stock_adjustments",
        "credit_payments",
        "credit_transactions",
        "customer_insurance",
        "customers",
        "supplier_ratings",
        "suppliers",
        "notifications",
        "journal_entry_lines",
        "journal_entries",
        "income",
        "expenses",
        "income_categories",
        "expense_categories",
        "account_balances",
        "chart_of_accounts",
        "fiscal_periods",
        "tax_codes",
        "quotation_items",
        "quotations",
        "payment_transactions",
        "products",
        "categories",
        "units",
        "role_permissions",
        "user_invitations",
        "profiles",
        "roles",
        "permissions",
        "stores",
        "areas",
        "setup_progress",
        "company_settings",
    ]

    for table in tables:
        try:
            supabase.table(table).delete().eq("company_id", COMPANY_ID).execute()
            print(f"  🗑️   {table}")
        except Exception as e:
            print(f"  ⚠️   {table}: {e}")

    # Companies table last (no company_id column on itself)
    try:
        supabase.table("companies").delete().eq("id", COMPANY_ID).execute()
        print(f"  🗑️   companies (id={COMPANY_ID})")
    except Exception as e:
        print(f"  ⚠️   companies: {e}")

    print(f"\n✅  Cleared company_id={COMPANY_ID}")


# ─────────────────────────────────────────────
# MAIN RUNNER
# ─────────────────────────────────────────────
def run_seed(args):
    global COMPANY_ID

    # Allow --company-id CLI override
    if hasattr(args, "company_id") and args.company_id:
        COMPANY_ID = args.company_id
        print(f"🎯  Target company_id = {COMPANY_ID}")

    seed_all = getattr(args, "all", False)

    if getattr(args, "clear", False):
        clear_seed_data()
        return

    store_rows, product_rows, supplier_rows, customer_rows, batch_rows = (
        [],
        [],
        [],
        [],
        [],
    )

    # Step 1: Company + settings
    if seed_all or getattr(args, "company", False):
        seed_company()

    # Step 2: Copy roles/permissions/COA/categories from template
    if seed_all or getattr(args, "copy_template", False):
        copy_from_template()

    # Step 3: Areas + stores (3 areas × 2 stores)
    if seed_all or getattr(args, "stores", False):
        _, store_rows = seed_stores()
    else:
        store_rows = fetch("stores")

    # Step 4: Suppliers
    if seed_all or getattr(args, "suppliers", False):
        supplier_rows = seed_suppliers()
    else:
        supplier_rows = fetch("suppliers")

    # Step 5: Customers
    if seed_all or getattr(args, "customers", False):
        customer_rows = seed_customers()
    else:
        customer_rows = fetch("customers")

    # Step 6: Products (depends on categories/units from template copy)
    if seed_all or getattr(args, "products", False):
        product_rows = seed_products()
    else:
        product_rows = fetch("products")

    # Step 7: Inventory (batches per store)
    if seed_all or getattr(args, "inventory", False):
        if not store_rows:
            store_rows = fetch("stores")
        if not product_rows:
            product_rows = fetch("products")
        if not supplier_rows:
            supplier_rows = fetch("suppliers")
        batch_rows = seed_inventory(product_rows, store_rows, supplier_rows)
    else:
        batch_rows = fetch("product_batches")

    # Step 8: Purchases (per store)
    if seed_all or getattr(args, "purchases", False):
        if not store_rows:
            store_rows = fetch("stores")
        if not product_rows:
            product_rows = fetch("products")
        if not supplier_rows:
            supplier_rows = fetch("suppliers")
        seed_purchases(product_rows, store_rows, supplier_rows)

    # Step 9: Sales (per store)
    if seed_all or getattr(args, "sales", False):
        if not store_rows:
            store_rows = fetch("stores")
        if not product_rows:
            product_rows = fetch("products")
        if not customer_rows:
            customer_rows = fetch("customers")
        if not batch_rows:
            batch_rows = fetch("product_batches")
        seed_sales(product_rows, store_rows, customer_rows, batch_rows)

    # Step 10: Accounting
    if seed_all or getattr(args, "accounting", False):
        if not store_rows:
            store_rows = fetch("stores")
        seed_accounting(store_rows)

    print("\n" + "=" * 55)
    print("🎉  Seed complete!")
    print(f"    Company ID : {COMPANY_ID}")
    print(f"    Areas      : 3")
    print(f"    Stores     : 6  (2 per area)")
    print(f"    Products   : {len(product_rows)}")
    print(f"    Batches    : {len(batch_rows)}")
    print("=" * 55)


def main():
    parser = argparse.ArgumentParser(
        description="PharmaSOS Database Seeder",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--company-id",
        type=int,
        default=None,
        help="Target company ID (overrides COMPANY_ID in .env)",
    )
    parser.add_argument("--all", action="store_true", help="Seed everything")
    parser.add_argument(
        "--company", action="store_true", help="Seed company + settings"
    )
    parser.add_argument(
        "--copy-template", action="store_true", help="Copy template master data"
    )
    parser.add_argument("--stores", action="store_true", help="Seed 3 areas × 2 stores")
    parser.add_argument("--suppliers", action="store_true", help="Seed suppliers")
    parser.add_argument("--customers", action="store_true", help="Seed customers")
    parser.add_argument("--products", action="store_true", help="Seed products")
    parser.add_argument("--inventory", action="store_true", help="Seed batches (stock)")
    parser.add_argument(
        "--purchases", action="store_true", help="Seed purchase orders per store"
    )
    parser.add_argument("--sales", action="store_true", help="Seed sales per store")
    parser.add_argument("--accounting", action="store_true", help="Seed expenses")
    parser.add_argument(
        "--clear", action="store_true", help="⚠️  Clear all data (destructive)"
    )

    args = parser.parse_args()

    if not any(v for k, v in vars(args).items() if k != "company_id"):
        parser.print_help()
        sys.exit(0)

    run_seed(args)


if __name__ == "__main__":
    main()

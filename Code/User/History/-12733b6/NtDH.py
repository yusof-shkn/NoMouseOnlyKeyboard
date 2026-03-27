#!/usr/bin/env python3
"""
PharmaSOS Database Seeder
Seeds the database with realistic demo data for testing and development.

Usage (standalone):
  python seed.py --all              # Seed everything
  python seed.py --company          # Seed company + settings
  python seed.py --stores           # Seed stores + areas
  python seed.py --users            # Seed users/profiles
  python seed.py --products         # Seed categories, units, products
  python seed.py --suppliers        # Seed suppliers
  python seed.py --customers        # Seed customers
  python seed.py --inventory        # Seed product batches (stock)
  python seed.py --sales            # Seed sales transactions
  python seed.py --purchases        # Seed purchase orders
  python seed.py --accounting       # Seed chart of accounts, expenses, income
  python seed.py --clear            # Clear all seeded data (use with caution!)
"""

import argparse
import os
import sys
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from dotenv import load_dotenv
from supabase import Client, create_client

# ─────────────────────────────────────────────
# Environment Setup
# ─────────────────────────────────────────────
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
COMPANY_ID = int(os.getenv("COMPANY_ID", "1"))

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Missing Supabase credentials in .env file")
    sys.exit(1)

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Connected to Supabase")
except Exception as e:
    print(f"❌ Failed to connect to Supabase: {e}")
    sys.exit(1)

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────


def insert(table: str, data: dict | list) -> list:
    """Insert data and return created records."""
    try:
        result = supabase.table(table).insert(data).execute()
        return result.data or []
    except Exception as e:
        print(f"  ⚠️  Insert into {table} failed: {e}")
        return []


def upsert(table: str, data: dict | list, on_conflict: str = "id") -> list:
    """Upsert data (insert or update on conflict)."""
    try:
        result = supabase.table(table).upsert(data, on_conflict=on_conflict).execute()
        return result.data or []
    except Exception as e:
        print(f"  ⚠️  Upsert into {table} failed: {e}")
        return []


def fetch(table: str, filters: dict = None) -> list:
    """Fetch records with optional filters."""
    try:
        q = supabase.table(table).select("*").eq("company_id", COMPANY_ID)
        if filters:
            for key, val in filters.items():
                q = q.eq(key, val)
        return q.execute().data or []
    except Exception as e:
        print(f"  ⚠️  Fetch from {table} failed: {e}")
        return []


def days_ago(n: int) -> str:
    return (date.today() - timedelta(days=n)).isoformat()


def days_ahead(n: int) -> str:
    return (date.today() + timedelta(days=n)).isoformat()


def now_minus(days: int = 0) -> str:
    dt = datetime.utcnow() - timedelta(days=days)
    return dt.isoformat()


# ─────────────────────────────────────────────
# 1. COMPANY & SETTINGS
# ─────────────────────────────────────────────


def seed_company():
    print("\n🏢 Seeding company & settings...")

    company = {
        "id": COMPANY_ID,
        "company_name": "HealthPlus Pharmacy Ltd",
        "email": "admin@healthpluspharmacy.ug",
        "phone": "+256700000001",
        "address": "Plot 14, Kampala Road, Kampala, Uganda",
        "tax_id": "1001234567",
        "registration_number": "REG-2023-001",
        "is_active": True,
    }
    rows = upsert("companies", company)
    print(f"  ✅ Company: {rows[0]['company_name'] if rows else 'already exists'}")

    settings = {
        "company_id": COMPANY_ID,
        "currency": "UGX",
        "date_format": "DD/MM/YYYY",
        "time_zone": "Africa/Kampala",
        "financial_year_start": 1,
        "enable_multi_currency": False,
        "enable_barcode_scanning": True,
        "low_stock_threshold": 10,
        "expiry_alert_days": 90,
        "enable_batch_tracking": True,
        "enable_credit_sales": True,
        "max_credit_days": 30,
        "default_payment_terms": "net_30",
        "invoice_prefix": "INV",
        "po_prefix": "PO",
        "receipt_prefix": "RCP",
    }
    upsert("company_settings", settings, on_conflict="company_id")
    print("  ✅ Company settings seeded")


# ─────────────────────────────────────────────
# 2. AREAS & STORES
# ─────────────────────────────────────────────


def seed_stores():
    print("\n🏪 Seeding areas & stores...")

    # Areas
    areas_data = [
        {
            "company_id": COMPANY_ID,
            "area_name": "Central Uganda",
            "area_code": "CENTRAL",
            "region": "Central",
            "country": "Uganda",
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "area_name": "Kampala City",
            "area_code": "KLA",
            "region": "Central",
            "country": "Uganda",
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "area_name": "Wakiso District",
            "area_code": "WAKS",
            "region": "Central",
            "country": "Uganda",
            "is_active": True,
        },
    ]
    area_rows = insert("areas", areas_data)
    area_ids = {r["area_code"]: r["id"] for r in area_rows}
    print(f"  ✅ Inserted {len(area_rows)} areas")

    kla_area = area_ids.get("KLA", area_rows[0]["id"] if area_rows else None)
    wak_area = area_ids.get("WAKS", kla_area)

    # Stores
    stores_data = [
        {
            "company_id": COMPANY_ID,
            "store_name": "HealthPlus Main Branch",
            "store_code": "MAIN-001",
            "store_type": "pharmacy",
            "address": "Plot 14, Kampala Road, Kampala",
            "phone": "+256700000001",
            "email": "main@healthpluspharmacy.ug",
            "area_id": kla_area,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "store_name": "HealthPlus Ntinda Branch",
            "store_code": "NTD-002",
            "store_type": "pharmacy",
            "address": "Ntinda Shopping Centre, Kampala",
            "phone": "+256700000002",
            "email": "ntinda@healthpluspharmacy.ug",
            "area_id": kla_area,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "store_name": "HealthPlus Wakiso Branch",
            "store_code": "WAK-003",
            "store_type": "pharmacy",
            "address": "Wakiso Town, Wakiso District",
            "phone": "+256700000003",
            "email": "wakiso@healthpluspharmacy.ug",
            "area_id": wak_area,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "store_name": "Central Warehouse",
            "store_code": "WH-001",
            "store_type": "warehouse",
            "address": "Industrial Area, Kampala",
            "phone": "+256700000004",
            "email": "warehouse@healthpluspharmacy.ug",
            "area_id": kla_area,
            "is_active": True,
        },
    ]
    store_rows = insert("stores", stores_data)
    print(f"  ✅ Inserted {len(store_rows)} stores")
    return store_rows


# ─────────────────────────────────────────────
# 3. ROLES & PERMISSIONS
# ─────────────────────────────────────────────


def seed_roles():
    print("\n🔐 Seeding roles & permissions...")

    roles_data = [
        {
            "company_id": COMPANY_ID,
            "role_name": "Company Admin",
            "description": "Full access to all company data",
            "is_system_role": True,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "role_name": "Pharmacist",
            "description": "Manages prescriptions, sales and inventory",
            "is_system_role": False,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "role_name": "Cashier",
            "description": "Processes sales and payments",
            "is_system_role": False,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "role_name": "Inventory Manager",
            "description": "Manages stock, purchases and adjustments",
            "is_system_role": False,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "role_name": "Accountant",
            "description": "Manages financial records and reports",
            "is_system_role": False,
            "is_active": True,
        },
    ]
    role_rows = insert("roles", roles_data)
    print(f"  ✅ Inserted {len(role_rows)} roles")

    permissions_data = [
        {
            "permission_name": "can_create_sale",
            "description": "Create new sales",
            "category": "sales",
        },
        {
            "permission_name": "can_view_sales",
            "description": "View sales records",
            "category": "sales",
        },
        {
            "permission_name": "can_cancel_sale",
            "description": "Cancel a sale",
            "category": "sales",
        },
        {
            "permission_name": "can_approve_po",
            "description": "Approve purchase orders",
            "category": "procurement",
        },
        {
            "permission_name": "can_create_po",
            "description": "Create purchase orders",
            "category": "procurement",
        },
        {
            "permission_name": "can_receive_stock",
            "description": "Mark PO as received",
            "category": "procurement",
        },
        {
            "permission_name": "can_view_reports",
            "description": "View financial reports",
            "category": "reports",
        },
        {
            "permission_name": "can_manage_users",
            "description": "Create/edit users",
            "category": "admin",
        },
        {
            "permission_name": "can_manage_products",
            "description": "Create/edit products",
            "category": "products",
        },
        {
            "permission_name": "can_adjust_stock",
            "description": "Make stock adjustments",
            "category": "inventory",
        },
        {
            "permission_name": "can_manage_customers",
            "description": "Create/edit customers",
            "category": "customers",
        },
        {
            "permission_name": "can_manage_suppliers",
            "description": "Create/edit suppliers",
            "category": "procurement",
        },
        {
            "permission_name": "can_view_accounting",
            "description": "View accounting records",
            "category": "accounting",
        },
        {
            "permission_name": "can_post_journal",
            "description": "Post journal entries",
            "category": "accounting",
        },
    ]
    perm_rows = insert("permissions", permissions_data)
    print(f"  ✅ Inserted {len(perm_rows)} permissions")

    return role_rows, perm_rows


# ─────────────────────────────────────────────
# 4. CATEGORIES & UNITS
# ─────────────────────────────────────────────


def seed_categories():
    print("\n🏷️  Seeding product categories...")

    categories_data = [
        {
            "company_id": COMPANY_ID,
            "category_name": "Tablets",
            "description": "Solid oral dosage forms in tablet shape",
            "is_active": True,
            "display_order": 1,
        },
        {
            "company_id": COMPANY_ID,
            "category_name": "Capsules",
            "description": "Solid dosage forms in gelatin capsule shells",
            "is_active": True,
            "display_order": 2,
        },
        {
            "company_id": COMPANY_ID,
            "category_name": "Syrups & Suspensions",
            "description": "Liquid oral preparations",
            "is_active": True,
            "display_order": 3,
        },
        {
            "company_id": COMPANY_ID,
            "category_name": "Injectables",
            "description": "Sterile preparations for parenteral use",
            "is_active": True,
            "display_order": 4,
        },
        {
            "company_id": COMPANY_ID,
            "category_name": "Creams & Ointments",
            "description": "Topical semi-solid preparations",
            "is_active": True,
            "display_order": 5,
        },
        {
            "company_id": COMPANY_ID,
            "category_name": "Drops",
            "description": "Eye, ear and nasal drops",
            "is_active": True,
            "display_order": 6,
        },
        {
            "company_id": COMPANY_ID,
            "category_name": "Antibiotics",
            "description": "Antimicrobial agents",
            "is_active": True,
            "display_order": 7,
        },
        {
            "company_id": COMPANY_ID,
            "category_name": "Antimalaria",
            "description": "Antimalarial drugs",
            "is_active": True,
            "display_order": 8,
        },
        {
            "company_id": COMPANY_ID,
            "category_name": "Vitamins & Supplements",
            "description": "Nutritional supplements",
            "is_active": True,
            "display_order": 9,
        },
        {
            "company_id": COMPANY_ID,
            "category_name": "Medical Supplies",
            "description": "Surgical and medical consumables",
            "is_active": True,
            "display_order": 10,
        },
    ]
    rows = insert("categories", categories_data)
    print(f"  ✅ Inserted {len(rows)} categories")
    return rows


def seed_units():
    print("\n📏 Seeding units of measurement...")

    units_data = [
        {
            "company_id": COMPANY_ID,
            "unit_name": "Tablet",
            "abbreviation": "tab",
            "is_base_unit": True,
            "conversion_factor": 1.0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "unit_name": "Capsule",
            "abbreviation": "cap",
            "is_base_unit": True,
            "conversion_factor": 1.0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "unit_name": "Milliliter",
            "abbreviation": "ml",
            "is_base_unit": True,
            "conversion_factor": 1.0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "unit_name": "Liter",
            "abbreviation": "L",
            "is_base_unit": False,
            "conversion_factor": 1000.0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "unit_name": "Strip (10 tabs)",
            "abbreviation": "strip",
            "is_base_unit": False,
            "conversion_factor": 10.0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "unit_name": "Box (100 tabs)",
            "abbreviation": "box",
            "is_base_unit": False,
            "conversion_factor": 100.0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "unit_name": "Bottle",
            "abbreviation": "btl",
            "is_base_unit": True,
            "conversion_factor": 1.0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "unit_name": "Vial",
            "abbreviation": "vial",
            "is_base_unit": True,
            "conversion_factor": 1.0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "unit_name": "Tube",
            "abbreviation": "tube",
            "is_base_unit": True,
            "conversion_factor": 1.0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "unit_name": "Piece",
            "abbreviation": "pcs",
            "is_base_unit": True,
            "conversion_factor": 1.0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "unit_name": "Gram",
            "abbreviation": "g",
            "is_base_unit": True,
            "conversion_factor": 1.0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "unit_name": "Kilogram",
            "abbreviation": "kg",
            "is_base_unit": False,
            "conversion_factor": 1000.0,
            "is_active": True,
        },
    ]
    rows = insert("units", units_data)
    print(f"  ✅ Inserted {len(rows)} units")
    return rows


# ─────────────────────────────────────────────
# 5. PRODUCTS
# ─────────────────────────────────────────────


def seed_products(category_rows: list, unit_rows: list):
    print("\n💊 Seeding products...")

    cat_map = {r["category_name"]: r["id"] for r in category_rows}
    unit_map = {r["unit_name"]: r["id"] for r in unit_rows}

    tab_cat = cat_map.get("Tablets")
    cap_cat = cat_map.get("Capsules")
    syr_cat = cat_map.get("Syrups & Suspensions")
    inj_cat = cat_map.get("Injectables")
    cre_cat = cat_map.get("Creams & Ointments")
    drp_cat = cat_map.get("Drops")
    abx_cat = cat_map.get("Antibiotics")
    mal_cat = cat_map.get("Antimalaria")
    vit_cat = cat_map.get("Vitamins & Supplements")
    sup_cat = cat_map.get("Medical Supplies")

    tab_u = unit_map.get("Tablet")
    cap_u = unit_map.get("Capsule")
    btl_u = unit_map.get("Bottle")
    vial_u = unit_map.get("Vial")
    tube_u = unit_map.get("Tube")
    pcs_u = unit_map.get("Piece")

    products_data = [
        # Tablets
        {
            "company_id": COMPANY_ID,
            "product_name": "Paracetamol 500mg Tabs",
            "generic_name": "Paracetamol",
            "sku": "PCM-500-TAB",
            "category_id": tab_cat,
            "unit_id": tab_u,
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": False,
            "reorder_level": 200,
            "cost_price": 50,
            "selling_price": 100,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "product_name": "Amoxicillin 500mg Caps",
            "generic_name": "Amoxicillin",
            "sku": "AMX-500-CAP",
            "category_id": abx_cat,
            "unit_id": cap_u,
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": True,
            "reorder_level": 100,
            "cost_price": 150,
            "selling_price": 300,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "product_name": "Coartem 80/480mg Tabs",
            "generic_name": "Artemether/Lumefantrine",
            "sku": "COA-480-TAB",
            "category_id": mal_cat,
            "unit_id": tab_u,
            "manufacturer": "Novartis",
            "requires_prescription": True,
            "reorder_level": 50,
            "cost_price": 8000,
            "selling_price": 12000,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "product_name": "Metformin 500mg Tabs",
            "generic_name": "Metformin HCl",
            "sku": "MET-500-TAB",
            "category_id": tab_cat,
            "unit_id": tab_u,
            "manufacturer": "Strides Shasun",
            "requires_prescription": True,
            "reorder_level": 150,
            "cost_price": 80,
            "selling_price": 150,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "product_name": "Amlodipine 5mg Tabs",
            "generic_name": "Amlodipine Besylate",
            "sku": "AML-5-TAB",
            "category_id": tab_cat,
            "unit_id": tab_u,
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": True,
            "reorder_level": 100,
            "cost_price": 100,
            "selling_price": 200,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "product_name": "Ibuprofen 400mg Tabs",
            "generic_name": "Ibuprofen",
            "sku": "IBU-400-TAB",
            "category_id": tab_cat,
            "unit_id": tab_u,
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": False,
            "reorder_level": 150,
            "cost_price": 60,
            "selling_price": 120,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "product_name": "Ciprofloxacin 500mg Tabs",
            "generic_name": "Ciprofloxacin HCl",
            "sku": "CIP-500-TAB",
            "category_id": abx_cat,
            "unit_id": tab_u,
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": True,
            "reorder_level": 100,
            "cost_price": 200,
            "selling_price": 400,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "product_name": "Omeprazole 20mg Caps",
            "generic_name": "Omeprazole",
            "sku": "OMP-20-CAP",
            "category_id": cap_cat,
            "unit_id": cap_u,
            "manufacturer": "Strides Shasun",
            "requires_prescription": False,
            "reorder_level": 100,
            "cost_price": 120,
            "selling_price": 250,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "product_name": "Metronidazole 400mg Tabs",
            "generic_name": "Metronidazole",
            "sku": "MTZ-400-TAB",
            "category_id": abx_cat,
            "unit_id": tab_u,
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": True,
            "reorder_level": 100,
            "cost_price": 70,
            "selling_price": 150,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "product_name": "Atorvastatin 10mg Tabs",
            "generic_name": "Atorvastatin Calcium",
            "sku": "ATV-10-TAB",
            "category_id": tab_cat,
            "unit_id": tab_u,
            "manufacturer": "Strides Shasun",
            "requires_prescription": True,
            "reorder_level": 80,
            "cost_price": 150,
            "selling_price": 300,
            "tax_rate": 0,
            "is_active": True,
        },
        # Syrups
        {
            "company_id": COMPANY_ID,
            "product_name": "Paracetamol Syrup 120mg/5ml",
            "generic_name": "Paracetamol",
            "sku": "PCM-SYR-60",
            "category_id": syr_cat,
            "unit_id": btl_u,
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": False,
            "reorder_level": 50,
            "cost_price": 3000,
            "selling_price": 5000,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "product_name": "Amoxicillin Suspension 125mg/5ml",
            "generic_name": "Amoxicillin",
            "sku": "AMX-SUS-100",
            "category_id": syr_cat,
            "unit_id": btl_u,
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": True,
            "reorder_level": 30,
            "cost_price": 5000,
            "selling_price": 9000,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "product_name": "ORS Sachet (Oral Rehydration)",
            "generic_name": "Oral Rehydration Salts",
            "sku": "ORS-SAC-01",
            "category_id": syr_cat,
            "unit_id": pcs_u,
            "manufacturer": "NMS Uganda",
            "requires_prescription": False,
            "reorder_level": 100,
            "cost_price": 500,
            "selling_price": 1000,
            "tax_rate": 0,
            "is_active": True,
        },
        # Injectables
        {
            "company_id": COMPANY_ID,
            "product_name": "Quinine Dihydrochloride 600mg/2ml Inj",
            "generic_name": "Quinine Dihydrochloride",
            "sku": "QUI-INJ-2ML",
            "category_id": inj_cat,
            "unit_id": vial_u,
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": True,
            "reorder_level": 30,
            "cost_price": 5000,
            "selling_price": 9000,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "product_name": "Insulin Glargine 100IU/ml (Lantus)",
            "generic_name": "Insulin Glargine",
            "sku": "INS-GLA-3ML",
            "category_id": inj_cat,
            "unit_id": vial_u,
            "manufacturer": "Sanofi",
            "requires_prescription": True,
            "reorder_level": 20,
            "cost_price": 45000,
            "selling_price": 70000,
            "tax_rate": 0,
            "is_active": True,
        },
        # Creams
        {
            "company_id": COMPANY_ID,
            "product_name": "Betamethasone Cream 0.1%",
            "generic_name": "Betamethasone Valerate",
            "sku": "BET-CRM-15G",
            "category_id": cre_cat,
            "unit_id": tube_u,
            "manufacturer": "GSK",
            "requires_prescription": True,
            "reorder_level": 30,
            "cost_price": 4000,
            "selling_price": 7000,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "product_name": "Clotrimazole Cream 1%",
            "generic_name": "Clotrimazole",
            "sku": "CLO-CRM-20G",
            "category_id": cre_cat,
            "unit_id": tube_u,
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": False,
            "reorder_level": 40,
            "cost_price": 3500,
            "selling_price": 6000,
            "tax_rate": 0,
            "is_active": True,
        },
        # Drops
        {
            "company_id": COMPANY_ID,
            "product_name": "Ciprofloxacin Eye Drops 0.3%",
            "generic_name": "Ciprofloxacin",
            "sku": "CIP-EYE-5ML",
            "category_id": drp_cat,
            "unit_id": btl_u,
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": True,
            "reorder_level": 30,
            "cost_price": 5500,
            "selling_price": 9000,
            "tax_rate": 0,
            "is_active": True,
        },
        # Vitamins
        {
            "company_id": COMPANY_ID,
            "product_name": "Vitamin C 500mg Tabs",
            "generic_name": "Ascorbic Acid",
            "sku": "VTC-500-TAB",
            "category_id": vit_cat,
            "unit_id": tab_u,
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": False,
            "reorder_level": 200,
            "cost_price": 30,
            "selling_price": 60,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "product_name": "Multivitamin Syrup 200ml",
            "generic_name": "Multivitamins",
            "sku": "MVT-SYR-200",
            "category_id": vit_cat,
            "unit_id": btl_u,
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": False,
            "reorder_level": 50,
            "cost_price": 8000,
            "selling_price": 14000,
            "tax_rate": 0,
            "is_active": True,
        },
        # Medical Supplies
        {
            "company_id": COMPANY_ID,
            "product_name": "Surgical Gloves (Pair) Size M",
            "generic_name": "Latex Gloves",
            "sku": "GLV-SUR-M",
            "category_id": sup_cat,
            "unit_id": pcs_u,
            "manufacturer": "Medline",
            "requires_prescription": False,
            "reorder_level": 100,
            "cost_price": 1000,
            "selling_price": 2000,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "product_name": "Disposable Syringes 5ml",
            "generic_id": "Syringe 5ml",
            "generic_name": "Disposable Syringe",
            "sku": "SYR-DSP-5ML",
            "category_id": sup_cat,
            "unit_id": pcs_u,
            "manufacturer": "BD Medical",
            "requires_prescription": False,
            "reorder_level": 200,
            "cost_price": 500,
            "selling_price": 1000,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "product_name": "Blood Glucose Test Strips (50s)",
            "generic_name": "Glucose Test Strips",
            "sku": "GTS-50-PKT",
            "category_id": sup_cat,
            "unit_id": pcs_u,
            "manufacturer": "OneTouch",
            "requires_prescription": False,
            "reorder_level": 30,
            "cost_price": 25000,
            "selling_price": 40000,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "product_name": "Cotrimoxazole 480mg Tabs",
            "generic_name": "Sulfamethoxazole/Trimethoprim",
            "sku": "CTX-480-TAB",
            "category_id": abx_cat,
            "unit_id": tab_u,
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": True,
            "reorder_level": 100,
            "cost_price": 80,
            "selling_price": 150,
            "tax_rate": 0,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "product_name": "Doxycycline 100mg Caps",
            "generic_name": "Doxycycline Hyclate",
            "sku": "DOX-100-CAP",
            "category_id": abx_cat,
            "unit_id": cap_u,
            "manufacturer": "Cipla Quality Chemical",
            "requires_prescription": True,
            "reorder_level": 80,
            "cost_price": 120,
            "selling_price": 250,
            "tax_rate": 0,
            "is_active": True,
        },
    ]
    rows = insert("products", products_data)
    print(f"  ✅ Inserted {len(rows)} products")
    return rows


# ─────────────────────────────────────────────
# 6. SUPPLIERS
# ─────────────────────────────────────────────


def seed_suppliers():
    print("\n🚚 Seeding suppliers...")

    suppliers_data = [
        {
            "company_id": COMPANY_ID,
            "supplier_name": "Cipla Quality Chemical Uganda",
            "supplier_code": "CIPLA-001",
            "email": "orders@cipla.co.ug",
            "phone": "+256414123456",
            "address": "Plot 23, Industrial Area, Kampala",
            "contact_person": "John Mwesigwa",
            "payment_terms": "net_30",
            "credit_limit": 5000000,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "supplier_name": "National Medical Stores (NMS)",
            "supplier_code": "NMS-001",
            "email": "procurement@nms.go.ug",
            "phone": "+256414340808",
            "address": "Port Bell Road, Kampala",
            "contact_person": "Grace Nakato",
            "payment_terms": "net_30",
            "credit_limit": 10000000,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "supplier_name": "Strides Shasun Ltd",
            "supplier_code": "STR-001",
            "email": "uganda@strides.com",
            "phone": "+256414555123",
            "address": "8th Street, Industrial Area, Kampala",
            "contact_person": "Peter Ssemanda",
            "payment_terms": "net_45",
            "credit_limit": 3000000,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "supplier_name": "Medipharm Uganda Ltd",
            "supplier_code": "MED-001",
            "email": "sales@medipharm.co.ug",
            "phone": "+256754321987",
            "address": "Plot 5, Spring Road, Bugolobi, Kampala",
            "contact_person": "Sarah Akello",
            "payment_terms": "net_30",
            "credit_limit": 2000000,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "supplier_name": "Bio-Medical International",
            "supplier_code": "BMI-001",
            "email": "info@biomedical.co.ug",
            "phone": "+256772456789",
            "address": "Jinja Road, Kampala",
            "contact_person": "Robert Ouma",
            "payment_terms": "immediate",
            "credit_limit": 1000000,
            "is_active": True,
        },
    ]
    rows = insert("suppliers", suppliers_data)
    print(f"  ✅ Inserted {len(rows)} suppliers")
    return rows


# ─────────────────────────────────────────────
# 7. CUSTOMERS
# ─────────────────────────────────────────────


def seed_customers():
    print("\n👥 Seeding customers...")

    customers_data = [
        {
            "company_id": COMPANY_ID,
            "customer_name": "Walk-in Customer",
            "customer_code": "WALKIN-000",
            "email": None,
            "phone": None,
            "is_active": True,
            "credit_limit": 0,
            "credit_days": 0,
        },
        {
            "company_id": COMPANY_ID,
            "customer_name": "Nakato Mary",
            "customer_code": "CUST-001",
            "email": "mary.nakato@gmail.com",
            "phone": "+256700111001",
            "gender": "female",
            "date_of_birth": "1985-03-15",
            "address": "Ntinda, Kampala",
            "credit_limit": 500000,
            "credit_days": 30,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "customer_name": "Ssemanda Joseph",
            "customer_code": "CUST-002",
            "email": "j.ssemanda@yahoo.com",
            "phone": "+256700111002",
            "gender": "male",
            "date_of_birth": "1978-07-22",
            "address": "Kiira, Wakiso",
            "credit_limit": 300000,
            "credit_days": 30,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "customer_name": "Akello Grace",
            "customer_code": "CUST-003",
            "email": "grace.akello@gmail.com",
            "phone": "+256700111003",
            "gender": "female",
            "date_of_birth": "1992-01-10",
            "address": "Gulu Road, Kawempe",
            "credit_limit": 200000,
            "credit_days": 14,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "customer_name": "Opio David",
            "customer_code": "CUST-004",
            "email": "david.opio@gmail.com",
            "phone": "+256700111004",
            "gender": "male",
            "date_of_birth": "1965-11-30",
            "address": "Luzira, Kampala",
            "credit_limit": 1000000,
            "credit_days": 30,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "customer_name": "Namukasa Fatuma",
            "customer_code": "CUST-005",
            "email": None,
            "phone": "+256700111005",
            "gender": "female",
            "date_of_birth": "1990-05-20",
            "address": "Kabalagala, Kampala",
            "credit_limit": 150000,
            "credit_days": 14,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "customer_name": "Bbosa Clinic & Hospital",
            "customer_code": "INST-001",
            "email": "procurement@bbosaclinic.co.ug",
            "phone": "+256414777888",
            "address": "Bukoto, Kampala",
            "credit_limit": 5000000,
            "credit_days": 30,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "customer_name": "Kawempe General Hospital",
            "customer_code": "INST-002",
            "email": "pharmacy@kgh.go.ug",
            "phone": "+256414222333",
            "address": "Kawempe, Kampala",
            "credit_limit": 10000000,
            "credit_days": 30,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "customer_name": "Mugisha Robert",
            "customer_code": "CUST-006",
            "email": "r.mugisha@gmail.com",
            "phone": "+256700111006",
            "gender": "male",
            "date_of_birth": "1955-09-05",
            "address": "Makindye, Kampala",
            "credit_limit": 500000,
            "credit_days": 30,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "customer_name": "Asiimwe Christine",
            "customer_code": "CUST-007",
            "email": "c.asiimwe@gmail.com",
            "phone": "+256700111007",
            "gender": "female",
            "date_of_birth": "1987-04-18",
            "address": "Entebbe Road, Kampala",
            "credit_limit": 0,
            "credit_days": 0,
            "is_active": True,
        },
    ]
    rows = insert("customers", customers_data)
    print(f"  ✅ Inserted {len(rows)} customers")
    return rows


# ─────────────────────────────────────────────
# 8. PRODUCT BATCHES (INVENTORY)
# ─────────────────────────────────────────────


def seed_inventory(product_rows: list, store_rows: list, supplier_rows: list):
    print("\n📦 Seeding product batches (inventory)...")

    if not product_rows or not store_rows or not supplier_rows:
        print("  ⚠️  Missing products, stores or suppliers — skipping inventory")
        return []

    main_store = store_rows[0]["id"]
    ntinda_store = store_rows[1]["id"] if len(store_rows) > 1 else main_store
    supplier_id = supplier_rows[0]["id"]
    supplier2_id = supplier_rows[1]["id"] if len(supplier_rows) > 1 else supplier_id

    batches = []
    for idx, prod in enumerate(product_rows):
        pid = prod["id"]
        cost = prod.get("cost_price", 500)
        sell = prod.get("selling_price", 1000)
        # Main store batch
        batches.append(
            {
                "company_id": COMPANY_ID,
                "product_id": pid,
                "store_id": main_store,
                "batch_number": f"BT-{days_ago(0).replace('-', '')}-{idx + 1:03d}",
                "manufacturing_date": days_ago(180),
                "expiry_date": days_ahead(365 + idx * 15),  # varied expiry
                "quantity_received": 200 + idx * 10,
                "quantity_available": 150 + idx * 8,
                "cost_price": cost,
                "selling_price": sell,
                "supplier_id": supplier_id,
                "is_active": True,
            }
        )
        # Ntinda store batch
        if idx < 15:
            batches.append(
                {
                    "company_id": COMPANY_ID,
                    "product_id": pid,
                    "store_id": ntinda_store,
                    "batch_number": f"NT-{days_ago(0).replace('-', '')}-{idx + 1:03d}",
                    "manufacturing_date": days_ago(120),
                    "expiry_date": days_ahead(300 + idx * 10),
                    "quantity_received": 100 + idx * 5,
                    "quantity_available": 80 + idx * 4,
                    "cost_price": cost,
                    "selling_price": sell,
                    "supplier_id": supplier2_id,
                    "is_active": True,
                }
            )

    # Near-expiry batch for expiry alert demo
    if product_rows:
        batches.append(
            {
                "company_id": COMPANY_ID,
                "product_id": product_rows[0]["id"],
                "store_id": main_store,
                "batch_number": "NEAREXP-001",
                "manufacturing_date": days_ago(300),
                "expiry_date": days_ahead(30),  # expires in 30 days
                "quantity_received": 50,
                "quantity_available": 20,
                "cost_price": product_rows[0].get("cost_price", 500),
                "selling_price": product_rows[0].get("selling_price", 1000),
                "supplier_id": supplier_id,
                "is_active": True,
                "notes": "Near expiry — created by seeder for testing",
            }
        )

    rows = insert("product_batches", batches)
    print(f"  ✅ Inserted {len(rows)} product batches")
    return rows


# ─────────────────────────────────────────────
# 9. PURCHASE ORDERS
# ─────────────────────────────────────────────


def seed_purchases(product_rows: list, store_rows: list, supplier_rows: list):
    print("\n🛒 Seeding purchase orders...")

    if not all([product_rows, store_rows, supplier_rows]):
        print("  ⚠️  Skipping — missing dependencies")
        return

    store_id = store_rows[0]["id"]
    sup_id = supplier_rows[0]["id"]
    sup2_id = supplier_rows[1]["id"] if len(supplier_rows) > 1 else sup_id

    pos = [
        {
            "company_id": COMPANY_ID,
            "store_id": store_id,
            "po_number": "PO-2025-001",
            "supplier_id": sup_id,
            "order_date": days_ago(30),
            "expected_delivery_date": days_ago(23),
            "status": "received",
            "subtotal": 2500000,
            "tax_amount": 0,
            "discount_amount": 50000,
            "shipping_cost": 30000,
            "total_amount": 2480000,
            "payment_terms": "net_30",
            "payment_status": "paid",
            "amount_paid": 2480000,
            "amount_due": 0,
            "notes": "Monthly restocking order",
        },
        {
            "company_id": COMPANY_ID,
            "store_id": store_id,
            "po_number": "PO-2025-002",
            "supplier_id": sup2_id,
            "order_date": days_ago(15),
            "expected_delivery_date": days_ago(8),
            "status": "received",
            "subtotal": 1800000,
            "tax_amount": 0,
            "discount_amount": 0,
            "shipping_cost": 20000,
            "total_amount": 1820000,
            "payment_terms": "net_30",
            "payment_status": "partially_paid",
            "amount_paid": 1000000,
            "amount_due": 820000,
        },
        {
            "company_id": COMPANY_ID,
            "store_id": store_id,
            "po_number": "PO-2025-003",
            "supplier_id": sup_id,
            "order_date": days_ago(5),
            "expected_delivery_date": days_ahead(2),
            "status": "approved",
            "subtotal": 3200000,
            "tax_amount": 0,
            "discount_amount": 0,
            "shipping_cost": 50000,
            "total_amount": 3250000,
            "payment_terms": "net_30",
            "payment_status": "unpaid",
            "amount_paid": 0,
            "amount_due": 3250000,
        },
        {
            "company_id": COMPANY_ID,
            "store_id": store_id,
            "po_number": "PO-2025-004",
            "supplier_id": sup2_id,
            "order_date": days_ago(1),
            "expected_delivery_date": days_ahead(7),
            "status": "pending",
            "subtotal": 900000,
            "tax_amount": 0,
            "discount_amount": 0,
            "shipping_cost": 15000,
            "total_amount": 915000,
            "payment_terms": "net_30",
            "payment_status": "unpaid",
            "amount_paid": 0,
            "amount_due": 915000,
        },
    ]
    po_rows = insert("purchase_orders", pos)
    print(f"  ✅ Inserted {len(po_rows)} purchase orders")

    # PO items for first PO
    if po_rows and product_rows:
        items = [
            {
                "company_id": COMPANY_ID,
                "purchase_order_id": po_rows[0]["id"],
                "product_id": product_rows[0]["id"],
                "quantity_ordered": 500,
                "quantity_received": 500,
                "quantity_pending": 0,
                "unit_price": 50,
                "discount_percentage": 0,
                "discount_amount": 0,
                "tax_rate": 0,
                "tax_amount": 0,
                "line_total": 25000,
                "batch_number": "CIPLA-2025-A01",
                "expiry_date": days_ahead(730),
            },
            {
                "company_id": COMPANY_ID,
                "purchase_order_id": po_rows[0]["id"],
                "product_id": product_rows[1]["id"],
                "quantity_ordered": 200,
                "quantity_received": 200,
                "quantity_pending": 0,
                "unit_price": 150,
                "discount_percentage": 0,
                "discount_amount": 0,
                "tax_rate": 0,
                "tax_amount": 0,
                "line_total": 30000,
                "batch_number": "CIPLA-2025-A02",
                "expiry_date": days_ahead(540),
            },
        ]
        item_rows = insert("purchase_order_items", items)
        print(f"  ✅ Inserted {len(item_rows)} PO line items")


# ─────────────────────────────────────────────
# 10. SALES
# ─────────────────────────────────────────────


def seed_sales(
    product_rows: list, store_rows: list, customer_rows: list, batch_rows: list
):
    print("\n💰 Seeding sales transactions...")

    if not all([product_rows, store_rows, customer_rows]):
        print("  ⚠️  Skipping — missing dependencies")
        return

    store_id = store_rows[0]["id"]
    walkin = next(
        (c for c in customer_rows if c.get("customer_code") == "WALKIN-000"),
        customer_rows[0],
    )
    cust1 = customer_rows[1] if len(customer_rows) > 1 else walkin
    cust2 = customer_rows[2] if len(customer_rows) > 2 else walkin

    # Build a simple batch lookup: product_id -> batch_id
    batch_map = {}
    for b in batch_rows or []:
        if b["product_id"] not in batch_map:
            batch_map[b["product_id"]] = b["id"]

    def batch_id(prod):
        return batch_map.get(prod["id"])

    # Create sales records for the past 14 days
    sales_list = []
    for day in range(14, 0, -1):
        for sale_num in range(1, 4):
            total = (200 + day * 50 + sale_num * 100) * 100
            sales_list.append(
                {
                    "company_id": COMPANY_ID,
                    "store_id": store_id,
                    "sale_number": f"S-{days_ago(day).replace('-', '')}-{sale_num:03d}",
                    "sale_date": now_minus(day),
                    "customer_id": walkin["id"] if sale_num == 1 else cust1["id"],
                    "sale_type": "over_the_counter",
                    "sale_status": "completed",
                    "subtotal": total,
                    "tax_amount": 0,
                    "discount_amount": 0,
                    "total_amount": total,
                    "payment_method": "cash" if sale_num != 3 else "mobile_money",
                    "payment_status": "paid",
                    "amount_paid": total,
                    "amount_due": 0,
                }
            )

    # A few credit sales
    sales_list.append(
        {
            "company_id": COMPANY_ID,
            "store_id": store_id,
            "sale_number": "S-CREDIT-001",
            "sale_date": now_minus(3),
            "customer_id": cust2["id"],
            "sale_type": "institutional",
            "sale_status": "completed",
            "subtotal": 500000,
            "tax_amount": 0,
            "discount_amount": 0,
            "total_amount": 500000,
            "payment_method": "credit",
            "payment_status": "unpaid",
            "amount_paid": 0,
            "amount_due": 500000,
        }
    )

    sale_rows = insert("sales", sales_list)
    print(f"  ✅ Inserted {len(sale_rows)} sales")

    # Add items to first 5 sales
    if sale_rows and product_rows:
        items = []
        for sr in sale_rows[:5]:
            prod = product_rows[0]
            items.append(
                {
                    "company_id": COMPANY_ID,
                    "sale_id": sr["id"],
                    "product_id": prod["id"],
                    "batch_id": batch_id(prod),
                    "quantity": 2,
                    "unit_price": prod.get("selling_price", 1000),
                    "discount_percentage": 0,
                    "discount_amount": 0,
                    "tax_rate": 0,
                    "tax_amount": 0,
                    "line_total": 2 * prod.get("selling_price", 1000),
                }
            )
            if len(product_rows) > 1:
                prod2 = product_rows[1]
                items.append(
                    {
                        "company_id": COMPANY_ID,
                        "sale_id": sr["id"],
                        "product_id": prod2["id"],
                        "batch_id": batch_id(prod2),
                        "quantity": 1,
                        "unit_price": prod2.get("selling_price", 1000),
                        "discount_percentage": 0,
                        "discount_amount": 0,
                        "tax_rate": 0,
                        "tax_amount": 0,
                        "line_total": prod2.get("selling_price", 1000),
                    }
                )
        item_rows = insert("sale_items", items)
        print(f"  ✅ Inserted {len(item_rows)} sale line items")

    return sale_rows


# ─────────────────────────────────────────────
# 11. ACCOUNTING
# ─────────────────────────────────────────────


def seed_accounting():
    print("\n📒 Seeding accounting data...")

    # Chart of accounts
    accounts = [
        # Assets
        {
            "company_id": COMPANY_ID,
            "account_code": "1000",
            "account_name": "Cash on Hand",
            "account_type": "asset",
            "account_subtype": "current_asset",
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "account_code": "1010",
            "account_name": "Bank Account - Stanbic",
            "account_type": "asset",
            "account_subtype": "current_asset",
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "account_code": "1200",
            "account_name": "Accounts Receivable",
            "account_type": "asset",
            "account_subtype": "current_asset",
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "account_code": "1300",
            "account_name": "Inventory / Stock",
            "account_type": "asset",
            "account_subtype": "current_asset",
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "account_code": "1500",
            "account_name": "Prepaid Expenses",
            "account_type": "asset",
            "account_subtype": "current_asset",
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "account_code": "1600",
            "account_name": "Equipment & Fixtures",
            "account_type": "asset",
            "account_subtype": "fixed_asset",
            "is_active": True,
        },
        # Liabilities
        {
            "company_id": COMPANY_ID,
            "account_code": "2000",
            "account_name": "Accounts Payable",
            "account_type": "liability",
            "account_subtype": "current_liability",
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "account_code": "2100",
            "account_name": "Accrued Expenses",
            "account_type": "liability",
            "account_subtype": "current_liability",
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "account_code": "2200",
            "account_name": "VAT Payable",
            "account_type": "liability",
            "account_subtype": "current_liability",
            "is_active": True,
        },
        # Equity
        {
            "company_id": COMPANY_ID,
            "account_code": "3000",
            "account_name": "Owner's Equity",
            "account_type": "equity",
            "account_subtype": "owner_equity",
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "account_code": "3100",
            "account_name": "Retained Earnings",
            "account_type": "equity",
            "account_subtype": "retained_earnings",
            "is_active": True,
        },
        # Revenue
        {
            "company_id": COMPANY_ID,
            "account_code": "4000",
            "account_name": "Sales Revenue",
            "account_type": "revenue",
            "account_subtype": "operating_revenue",
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "account_code": "4100",
            "account_name": "Other Income",
            "account_type": "revenue",
            "account_subtype": "non_operating_revenue",
            "is_active": True,
        },
        # COGS
        {
            "company_id": COMPANY_ID,
            "account_code": "5000",
            "account_name": "Cost of Goods Sold",
            "account_type": "cost_of_goods_sold",
            "account_subtype": "current_asset",
            "is_active": True,
        },
        # Expenses
        {
            "company_id": COMPANY_ID,
            "account_code": "6000",
            "account_name": "Rent Expense",
            "account_type": "expense",
            "account_subtype": "operating_expense",
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "account_code": "6010",
            "account_name": "Utilities (Electricity, Water)",
            "account_type": "expense",
            "account_subtype": "operating_expense",
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "account_code": "6020",
            "account_name": "Staff Salaries",
            "account_type": "expense",
            "account_subtype": "administrative_expense",
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "account_code": "6030",
            "account_name": "Marketing & Advertising",
            "account_type": "expense",
            "account_subtype": "selling_expense",
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "account_code": "6040",
            "account_name": "Transport & Delivery",
            "account_type": "expense",
            "account_subtype": "operating_expense",
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "account_code": "6050",
            "account_name": "Bank Charges",
            "account_type": "expense",
            "account_subtype": "financial_expense",
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "account_code": "6060",
            "account_name": "Miscellaneous Expenses",
            "account_type": "expense",
            "account_subtype": "other_expense",
            "is_active": True,
        },
    ]
    acc_rows = insert("chart_of_accounts", accounts)
    print(f"  ✅ Inserted {len(acc_rows)} accounts")

    acc_map = {r["account_code"]: r["id"] for r in acc_rows}

    # Expense categories
    exp_cats = [
        {
            "company_id": COMPANY_ID,
            "category_name": "Rent",
            "description": "Shop/office rent",
            "account_id": acc_map.get("6000"),
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "category_name": "Utilities",
            "description": "Electricity, water, internet",
            "account_id": acc_map.get("6010"),
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "category_name": "Salaries",
            "description": "Staff wages and salaries",
            "account_id": acc_map.get("6020"),
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "category_name": "Marketing",
            "description": "Advertising and promotions",
            "account_id": acc_map.get("6030"),
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "category_name": "Transport",
            "description": "Deliveries and logistics",
            "account_id": acc_map.get("6040"),
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "category_name": "Bank Charges",
            "description": "Bank service fees",
            "account_id": acc_map.get("6050"),
            "is_active": True,
        },
    ]
    exp_cat_rows = insert("expense_categories", exp_cats)
    print(f"  ✅ Inserted {len(exp_cat_rows)} expense categories")

    exp_cat_map = {r["category_name"]: r["id"] for r in exp_cat_rows}

    # Income categories
    inc_cats = [
        {
            "company_id": COMPANY_ID,
            "category_name": "Pharmacy Sales",
            "description": "Revenue from medicine sales",
            "account_id": acc_map.get("4000"),
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "category_name": "Consultation Fees",
            "description": "Revenue from consultations",
            "account_id": acc_map.get("4000"),
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "category_name": "Sundry Income",
            "description": "Miscellaneous income",
            "account_id": acc_map.get("4100"),
            "is_active": True,
        },
    ]
    inc_cat_rows = insert("income_categories", inc_cats)
    print(f"  ✅ Inserted {len(inc_cat_rows)} income categories")

    # Expenses (past 3 months)
    stores = fetch("stores")
    store_id = stores[0]["id"] if stores else None

    if store_id and exp_cat_rows:
        expenses = [
            {
                "company_id": COMPANY_ID,
                "store_id": store_id,
                "expense_date": days_ago(60),
                "expense_category_id": exp_cat_map.get("Rent"),
                "amount": 2000000,
                "tax_rate": 0,
                "tax_amount": 0,
                "total_amount": 2000000,
                "payment_method": "bank_transfer",
                "description": "Monthly rent — Jan 2025",
                "is_recurring": True,
                "frequency": "monthly",
            },
            {
                "company_id": COMPANY_ID,
                "store_id": store_id,
                "expense_date": days_ago(30),
                "expense_category_id": exp_cat_map.get("Rent"),
                "amount": 2000000,
                "tax_rate": 0,
                "tax_amount": 0,
                "total_amount": 2000000,
                "payment_method": "bank_transfer",
                "description": "Monthly rent — Feb 2025",
                "is_recurring": True,
                "frequency": "monthly",
            },
            {
                "company_id": COMPANY_ID,
                "store_id": store_id,
                "expense_date": days_ago(55),
                "expense_category_id": exp_cat_map.get("Salaries"),
                "amount": 8500000,
                "tax_rate": 0,
                "tax_amount": 0,
                "total_amount": 8500000,
                "payment_method": "bank_transfer",
                "description": "Staff salaries — Jan 2025",
                "is_recurring": True,
                "frequency": "monthly",
            },
            {
                "company_id": COMPANY_ID,
                "store_id": store_id,
                "expense_date": days_ago(25),
                "expense_category_id": exp_cat_map.get("Salaries"),
                "amount": 8500000,
                "tax_rate": 0,
                "tax_amount": 0,
                "total_amount": 8500000,
                "payment_method": "bank_transfer",
                "description": "Staff salaries — Feb 2025",
                "is_recurring": True,
                "frequency": "monthly",
            },
            {
                "company_id": COMPANY_ID,
                "store_id": store_id,
                "expense_date": days_ago(50),
                "expense_category_id": exp_cat_map.get("Utilities"),
                "amount": 350000,
                "tax_rate": 0,
                "tax_amount": 0,
                "total_amount": 350000,
                "payment_method": "cash",
                "description": "Electricity & water — Jan 2025",
            },
            {
                "company_id": COMPANY_ID,
                "store_id": store_id,
                "expense_date": days_ago(20),
                "expense_category_id": exp_cat_map.get("Utilities"),
                "amount": 380000,
                "tax_rate": 0,
                "tax_amount": 0,
                "total_amount": 380000,
                "payment_method": "cash",
                "description": "Electricity & water — Feb 2025",
            },
            {
                "company_id": COMPANY_ID,
                "store_id": store_id,
                "expense_date": days_ago(45),
                "expense_category_id": exp_cat_map.get("Transport"),
                "amount": 150000,
                "tax_rate": 0,
                "tax_amount": 0,
                "total_amount": 150000,
                "payment_method": "cash",
                "description": "Stock delivery from NMS",
            },
            {
                "company_id": COMPANY_ID,
                "store_id": store_id,
                "expense_date": days_ago(10),
                "expense_category_id": exp_cat_map.get("Marketing"),
                "amount": 200000,
                "tax_rate": 0,
                "tax_amount": 0,
                "total_amount": 200000,
                "payment_method": "mobile_money",
                "description": "Social media ads",
            },
        ]
        exp_rows = insert("expenses", expenses)
        print(f"  ✅ Inserted {len(exp_rows)} expense records")


# ─────────────────────────────────────────────
# 12. TAX CODES
# ─────────────────────────────────────────────


def seed_tax_codes():
    print("\n🧾 Seeding tax codes...")

    taxes = [
        {
            "company_id": COMPANY_ID,
            "tax_name": "Exempt (0%)",
            "tax_rate": 0,
            "description": "Essential medicines — VAT exempt",
            "is_default": True,
            "is_active": True,
        },
        {
            "company_id": COMPANY_ID,
            "tax_name": "Standard VAT (18%)",
            "tax_rate": 18,
            "description": "Standard Uganda VAT rate",
            "is_default": False,
            "is_active": True,
        },
    ]
    rows = insert("tax_codes", taxes)
    print(f"  ✅ Inserted {len(rows)} tax codes")


# ─────────────────────────────────────────────
# 13. CLEAR SEEDED DATA
# ─────────────────────────────────────────────


def clear_seed_data():
    """Remove all seeded data for this company. USE WITH CAUTION."""
    print(f"\n⚠️  Clearing all data for company_id={COMPANY_ID}...")
    confirm = input("   Type 'DELETE' to confirm: ").strip()
    if confirm != "DELETE":
        print("  ❌ Cancelled.")
        return

    tables_in_order = [
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
        "budget_lines",
        "budgets",
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
        "cash_flow_transactions",
        "backorder_fulfillments",
        "backorders",
        "quotation_items",
        "quotations",
        "payment_transactions",
        "payment_schedules",
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

    for table in tables_in_order:
        try:
            supabase.table(table).delete().eq("company_id", COMPANY_ID).execute()
            print(f"  🗑️  Cleared: {table}")
        except Exception as e:
            print(f"  ⚠️  Could not clear {table}: {e}")

    print(f"\n✅ All seeded data for company_id={COMPANY_ID} has been removed.")


# ─────────────────────────────────────────────
# MAIN ENTRY POINT
# ─────────────────────────────────────────────


def run_seed(args):
    seed_all = args.all

    if args.clear:
        clear_seed_data()
        return

    store_rows, product_rows, supplier_rows, customer_rows, batch_rows = (
        [],
        [],
        [],
        [],
        [],
    )

    if seed_all or args.company:
        seed_company()

    if seed_all or args.stores:
        store_rows = seed_stores()
    else:
        store_rows = fetch("stores")

    if seed_all or args.products:
        cat_rows = seed_categories()
        unit_rows = seed_units()
        seed_tax_codes()
        product_rows = seed_products(cat_rows, unit_rows)
    else:
        product_rows = fetch("products")

    if seed_all or args.suppliers:
        supplier_rows = seed_suppliers()
    else:
        supplier_rows = fetch("suppliers")

    if seed_all or args.customers:
        customer_rows = seed_customers()
    else:
        customer_rows = fetch("customers")

    if seed_all or args.inventory:
        if not store_rows:
            store_rows = fetch("stores")
        if not product_rows:
            product_rows = fetch("products")
        if not supplier_rows:
            supplier_rows = fetch("suppliers")
        batch_rows = seed_inventory(product_rows, store_rows, supplier_rows)
    else:
        batch_rows = fetch("product_batches")

    if seed_all or args.purchases:
        if not store_rows:
            store_rows = fetch("stores")
        if not product_rows:
            product_rows = fetch("products")
        if not supplier_rows:
            supplier_rows = fetch("suppliers")
        seed_purchases(product_rows, store_rows, supplier_rows)

    if seed_all or args.sales:
        if not store_rows:
            store_rows = fetch("stores")
        if not product_rows:
            product_rows = fetch("products")
        if not customer_rows:
            customer_rows = fetch("customers")
        if not batch_rows:
            batch_rows = fetch("product_batches")
        seed_sales(product_rows, store_rows, customer_rows, batch_rows)

    if seed_all or args.accounting:
        seed_accounting()

    if seed_all or args.users:
        seed_roles()

    print("\n" + "=" * 50)
    print("🎉  Seed completed successfully!")
    print(f"    Company ID: {COMPANY_ID}")
    print("=" * 50)


def main():
    parser = argparse.ArgumentParser(
        description="PharmaSOS Database Seeder",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--all", action="store_true", help="Seed all data")
    parser.add_argument(
        "--company", action="store_true", help="Seed company & settings"
    )
    parser.add_argument("--stores", action="store_true", help="Seed areas & stores")
    parser.add_argument("--users", action="store_true", help="Seed roles & permissions")
    parser.add_argument(
        "--products", action="store_true", help="Seed categories, units & products"
    )
    parser.add_argument("--suppliers", action="store_true", help="Seed suppliers")
    parser.add_argument("--customers", action="store_true", help="Seed customers")
    parser.add_argument(
        "--inventory", action="store_true", help="Seed product batches (stock)"
    )
    parser.add_argument("--sales", action="store_true", help="Seed sales transactions")
    parser.add_argument("--purchases", action="store_true", help="Seed purchase orders")
    parser.add_argument(
        "--accounting",
        action="store_true",
        help="Seed chart of accounts, expenses, income",
    )
    parser.add_argument(
        "--clear", action="store_true", help="⚠️  Clear all seeded data (destructive!)"
    )

    args = parser.parse_args()

    if not any(vars(args).values()):
        parser.print_help()
        sys.exit(0)

    run_seed(args)


if __name__ == "__main__":
    main()

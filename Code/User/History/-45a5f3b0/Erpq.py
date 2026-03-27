"""
Demo data seeders for a target pharmacy company.

Structure per run:
  - 3 areas  (Kampala City, Wakiso District, Entebbe)
  - 2 stores per area = 6 stores total
  - 4 suppliers, 6 customers (including walk-in)
  - Inventory batches per store (uses NDA global products from company_id=1)
  - 3 purchase orders per store  (received / partial / pending)
  - ~43 sales per store over 14 days + 1 credit sale
  - Expenses + income records for first 2 stores

is_restricted SEEDING  (frontend toggle test data):
  Each seeded table gets an explicit mix of True and False rows so the
  frontend toggle meaningfully shows/hides data. Roughly 50/50 split with
  clear notes in the description/notes fields so you can tell which is which.
  Affected: sales, sale_items, purchase_orders, purchase_order_items,
            expenses, income, product_batches.

FIX LOG:
  - expenses/income: added expense_number / income_number (format YYYYMMDD-NNNNNN)
  - expenses/income: must delete with is_system=false filter (trigger blocks system records)
  - sale_items, sales_return_items, purchase_return_items, purchase_order_items,
    customer_insurance, supplier_ratings, role_permissions: no company_id column,
    cleared via JOIN-delete through parent tables (handled in seed_runner.py)
"""

from __future__ import annotations

import datetime
from typing import Any, cast

from config import NDA_PRODUCT_IDS, NDA_PRODUCT_PRICE_MAP
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
    """Safely cast Supabase response data to list[Row]."""
    return cast(list[Row], raw or [])


def _restricted(idx: int) -> bool:
    """Alternate True/False so every other record is restricted."""
    return idx % 2 == 1


def _doc_number(prefix: str, idx: int) -> str:
    """Generate a document number like EXP20260228-000001."""
    today = datetime.date.today().strftime("%Y%m%d")
    return f"{prefix}{today}-{idx:06d}"


# ── 1. Company & settings ─────────────────────────────────────────────────────
def seed_company(company_id: int, name: str | None = None) -> None:
    log_section(f"Company  (id={company_id})")
    c = company_id
    company_name = name or f"HealthPlus Pharmacy {c}"

    db_upsert(
        "companies",
        {
            "id": c,
            "company_name": company_name,
            "company_code": f"HP{c:04d}",
            "email": f"admin@healthplus{c}.ug",
            "phone": f"+25670000{c:04d}",
            "address": "Plot 14, Kampala Road, Kampala, Uganda",
            "city": "Kampala",
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
def seed_stores(company_id: int) -> tuple[list[Row], list[Row]]:
    c = company_id
    log_section("Areas & Stores  (3 x 2)")

    areas_data: list[Row] = [
        {
            "company_id": c,
            "area_name": "Kampala City",
            "area_code": f"KLA-{c}",
            "region": "Central",
            "country": "Uganda",
            "description": "Kampala CBD stores",
            "is_active": True,
        },
        {
            "company_id": c,
            "area_name": "Wakiso District",
            "area_code": f"WAK-{c}",
            "region": "Central",
            "country": "Uganda",
            "description": "Greater Kampala suburban stores",
            "is_active": True,
        },
        {
            "company_id": c,
            "area_name": "Entebbe",
            "area_code": f"ENT-{c}",
            "region": "Central",
            "country": "Uganda",
            "description": "Entebbe peninsula stores",
            "is_active": True,
        },
    ]
    area_rows = _rows(
        db_upsert("areas", areas_data, on_conflict="company_id,area_code")
    )
    if not area_rows:
        log_warn("No areas created -- aborting stores seed.")
        return [], []
    log_ok(f"{len(area_rows)} areas inserted.")

    store_defs: list[tuple[int, str, str, str, str, str]] = [
        (
            0,
            "HP Main Branch",
            f"HP{c}-KLA-01",
            "Plot 14, Kampala Road, Kampala",
            f"+25670{c:04d}01",
            f"main{c}@healthplus.ug",
        ),
        (
            0,
            "HP Wandegeya Branch",
            f"HP{c}-KLA-02",
            "Wandegeya, Kampala",
            f"+25670{c:04d}02",
            f"wandegeya{c}@healthplus.ug",
        ),
        (
            1,
            "HP Ntinda Branch",
            f"HP{c}-WAK-01",
            "Ntinda Shopping Centre, Wakiso",
            f"+25670{c:04d}03",
            f"ntinda{c}@healthplus.ug",
        ),
        (
            1,
            "HP Nansana Branch",
            f"HP{c}-WAK-02",
            "Nansana Town, Wakiso",
            f"+25670{c:04d}04",
            f"nansana{c}@healthplus.ug",
        ),
        (
            2,
            "HP Entebbe Branch",
            f"HP{c}-ENT-01",
            "Entebbe Road, Entebbe",
            f"+25670{c:04d}05",
            f"entebbe{c}@healthplus.ug",
        ),
        (
            2,
            "HP Katabi Branch",
            f"HP{c}-ENT-02",
            "Katabi Town Council, Entebbe",
            f"+25670{c:04d}06",
            f"katabi{c}@healthplus.ug",
        ),
    ]

    stores_data: list[Row] = []
    for area_idx, store_name, store_code, address, phone, email in store_defs:
        area_id = int(area_rows[area_idx]["id"])
        stores_data.append(
            {
                "company_id": c,
                "area_id": area_id,
                "store_name": store_name,
                "store_code": store_code,
                "store_type": "pharmacy",
                "address": address,
                "phone": phone,
                "email": email,
                "is_active": True,
            }
        )

    store_rows = _rows(
        db_upsert("stores", stores_data, on_conflict="company_id,store_code")
    )
    log_ok(f"{len(store_rows)} stores inserted (2 per area).")
    return area_rows, store_rows


# ── 3. Suppliers ──────────────────────────────────────────────────────────────
def seed_suppliers(company_id: int) -> list[Row]:
    c = company_id
    log_section("Suppliers")
    data: list[Row] = [
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
            "address": "8th Street, Industrial Area",
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
    rows = _rows(db_upsert("suppliers", data, on_conflict="company_id,supplier_code"))
    log_ok(f"{len(rows)} suppliers inserted.")
    return rows


# ── 4. Customers ──────────────────────────────────────────────────────────────
def seed_customers(company_id: int) -> list[Row]:
    c = company_id
    log_section("Customers")
    data: list[Row] = [
        {
            "company_id": c,
            "first_name": "Walk-in",
            "last_name": "Customer",
            "customer_code": f"WALKIN-{c:04d}",
            "is_active": True,
            "credit_limit": 0,
            "credit_days": 0,
        },
        {
            "company_id": c,
            "first_name": "Nakato",
            "last_name": "Mary",
            "customer_code": f"CUST-{c:04d}-001",
            "email": f"mary{c}@gmail.com",
            "phone": f"+25670{c:04d}11",
            "address": "Ntinda, Kampala",
            "credit_limit": 500000,
            "credit_days": 30,
            "is_active": True,
        },
        {
            "company_id": c,
            "first_name": "Ssemanda",
            "last_name": "Joseph",
            "customer_code": f"CUST-{c:04d}-002",
            "email": f"joseph{c}@yahoo.com",
            "phone": f"+25670{c:04d}12",
            "address": "Kiira, Wakiso",
            "credit_limit": 300000,
            "credit_days": 30,
            "is_active": True,
        },
        {
            "company_id": c,
            "first_name": "Akello",
            "last_name": "Grace",
            "customer_code": f"CUST-{c:04d}-003",
            "email": f"grace{c}@gmail.com",
            "phone": f"+25670{c:04d}13",
            "address": "Kawempe, Kampala",
            "credit_limit": 200000,
            "credit_days": 14,
            "is_active": True,
        },
        {
            "company_id": c,
            "first_name": "Bbosa",
            "last_name": "Clinic",
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
            "first_name": "Mugisha",
            "last_name": "Robert",
            "customer_code": f"CUST-{c:04d}-004",
            "email": f"mugisha{c}@gmail.com",
            "phone": f"+25670{c:04d}14",
            "address": "Makindye, Kampala",
            "credit_limit": 500000,
            "credit_days": 30,
            "is_active": True,
        },
    ]
    rows = _rows(db_upsert("customers", data, on_conflict="company_id,customer_code"))
    log_ok(f"{len(rows)} customers inserted.")
    return rows


# ── 5. NDA products (read-only from company_id=1) ─────────────────────────────
def fetch_nda_products() -> list[Row]:
    """Fetch curated NDA product catalogue (company_id=1). No INSERT."""
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
) -> list[Row]:
    c = company_id
    log_section("Inventory Batches")

    if not all([product_rows, store_rows, supplier_rows]):
        log_warn("Missing dependencies -- skipping inventory.")
        return []

    sup_id = int(supplier_rows[0]["id"])
    sup2_id = int(supplier_rows[1]["id"]) if len(supplier_rows) > 1 else sup_id
    today = days_ago(0).replace("-", "")

    batches: list[Row] = []
    batch_idx = 0

    for s_idx, store in enumerate(store_rows):
        sid = int(store["id"])
        scode = str(store["store_code"])[-4:]
        sup = sup_id if s_idx % 2 == 0 else sup2_id

        for p_idx, prod in enumerate(product_rows):
            qty = 150 + s_idx * 20 + p_idx * 5
            unit_cost = int(prod.get("unit_cost") or 500)
            sell = int(prod.get("selling_price") or 1000)
            restricted = _restricted(batch_idx)
            batches.append(
                {
                    "company_id": c,
                    "product_id": int(prod["id"]),
                    "store_id": sid,
                    "batch_number": f"BT-{scode}-{today}-{p_idx + 1:03d}",
                    "manufacturing_date": days_ago(180 + s_idx * 10),
                    "expiry_date": days_ahead(365 + p_idx * 15),
                    "quantity_received": qty + 50,
                    "quantity_available": qty,
                    "unit_cost": unit_cost,
                    "selling_price": sell,
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

    # Near-expiry demo batch — always unrestricted so it always shows
    p0 = product_rows[0]
    batches.append(
        {
            "company_id": c,
            "product_id": int(p0["id"]),
            "store_id": int(store_rows[0]["id"]),
            "batch_number": f"NEAREXP-{c}-001",
            "manufacturing_date": days_ago(300),
            "expiry_date": days_ahead(25),
            "quantity_received": 50,
            "quantity_available": 20,
            "unit_cost": int(p0.get("unit_cost") or 500),
            "selling_price": int(p0.get("selling_price") or 1000),
            "supplier_id": sup_id,
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
    ur_count = len(batches) - r_count
    log_ok(
        f"{len(rows)} batches inserted "
        f"({len(product_rows)} products x {len(store_rows)} stores + 1 near-expiry). "
        f"{r_count} restricted  |  {ur_count} unrestricted."
    )
    return rows


# ── 7. Purchases ──────────────────────────────────────────────────────────────
def seed_purchases(
    company_id: int,
    product_rows: list[Row],
    store_rows: list[Row],
    supplier_rows: list[Row],
) -> None:
    c = company_id
    log_section("Purchase Orders")

    if not all([product_rows, store_rows, supplier_rows]):
        log_warn("Missing dependencies -- skipping purchases.")
        return

    sup_ids = [int(s["id"]) for s in supplier_rows]
    total_po = 0
    po_idx = 0  # global counter for is_restricted alternation
    item_idx = 0

    for s_idx, store in enumerate(store_rows):
        sid = int(store["id"])
        scode = str(store["store_code"])
        sup_a = sup_ids[s_idx % len(sup_ids)]
        sup_b = sup_ids[(s_idx + 1) % len(sup_ids)]

        # 3 POs per store — one received+paid, one received+partial, one pending
        po_defs: list[Row] = [
            {
                "company_id": c,
                "store_id": sid,
                "supplier_id": sup_a,
                "po_number": f"PO-{scode}-{days_ago(30).replace('-', '')}-01",
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
                "notes": f"[{'RESTRICTED' if _restricted(po_idx) else 'OPEN'}] Monthly restock - {store['store_name']}",
                "is_restricted": _restricted(po_idx),
            },
            {
                "company_id": c,
                "store_id": sid,
                "supplier_id": sup_b,
                "po_number": f"PO-{scode}-{days_ago(15).replace('-', '')}-02",
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
                "notes": f"[{'RESTRICTED' if _restricted(po_idx + 1) else 'OPEN'}] Partial delivery",
                "is_restricted": _restricted(po_idx + 1),
            },
            {
                "company_id": c,
                "store_id": sid,
                "supplier_id": sup_a,
                "po_number": f"PO-{scode}-{days_ago(3).replace('-', '')}-03",
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
            # Items inherit is_restricted from their parent PO
            items: list[Row] = [
                {
                    "purchase_order_id": int(po_rows[0]["id"]),
                    "product_id": int(product_rows[0]["id"]),
                    "quantity_ordered": 300,
                    "quantity_received": 300,
                    "unit_cost": p1_cost,
                    "discount_amount": 0,
                    "total_cost": 300 * p1_cost,
                    "expiry_date": days_ahead(730),
                    "batch_number": f"CIPLA-{scode}-A01",
                    "is_restricted": po_defs[0]["is_restricted"],
                },
                {
                    "purchase_order_id": int(po_rows[0]["id"]),
                    "product_id": int(product_rows[1]["id"]),
                    "quantity_ordered": 150,
                    "quantity_received": 150,
                    "unit_cost": p2_cost,
                    "discount_amount": 0,
                    "total_cost": 150 * p2_cost,
                    "expiry_date": days_ahead(540),
                    "batch_number": f"CIPLA-{scode}-A02",
                    "is_restricted": po_defs[0]["is_restricted"],
                },
            ]
            db_upsert("purchase_order_items", items, on_conflict="id")
            item_idx += 2

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
) -> None:
    c = company_id
    log_section("Sales")

    if not all([product_rows, store_rows, customer_rows]):
        log_warn("Missing dependencies -- skipping sales.")
        return

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
    sale_glob_idx = 0

    for s_idx, store in enumerate(store_rows):
        sid = int(store["id"])
        scode = str(store["store_code"])
        sales_list: list[Row] = []

        for day in range(14, 0, -1):
            for sale_num in range(1, 4):
                total = (100 + day * 30 + sale_num * 50 + s_idx * 20) * 100
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
                        "discount_amount": 0,
                        "total_amount": total,
                        "amount_paid": total,
                        "payment_method": "cash" if sale_num != 3 else "mobile_money",
                        "payment_status": "paid",
                        "is_restricted": restricted,
                        "notes": f"[{'RESTRICTED' if restricted else 'OPEN'}] Day -{day} sale #{sale_num}",
                    }
                )
                sale_glob_idx += 1

        # Institutional/credit sale — always unrestricted so it's always visible
        sales_list.append(
            {
                "company_id": c,
                "store_id": sid,
                "sale_number": f"SAL-{scode}-CREDIT-001",
                "sale_date": days_ago(2),
                "customer_id": int(inst["id"]),
                "sale_type": "institutional",
                "sale_status": "completed",
                "subtotal": 350000,
                "tax_amount": 0,
                "discount_amount": 0,
                "total_amount": 350000,
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

        # Seed sale_items for first 3 sales of each store
        if sale_rows and len(product_rows) >= 2:
            items: list[Row] = []
            for sr_idx, sr in enumerate(sale_rows[:3]):
                p1 = product_rows[s_idx % len(product_rows)]
                p2 = product_rows[(s_idx + 1) % len(product_rows)]
                p1_id = int(p1["id"])
                p2_id = int(p2["id"])
                p1_sell = int(p1.get("selling_price") or 1000)
                p2_sell = int(p2.get("selling_price") or 1000)
                p1_cost = int(p1.get("unit_cost") or 500)
                p2_cost = int(p2.get("unit_cost") or 500)
                sale_id = int(sr["id"])
                # sale_items inherit is_restricted from parent sale
                parent_restricted = sales_list[sr_idx]["is_restricted"]
                items += [
                    {
                        "sale_id": sale_id,
                        "product_id": p1_id,
                        "batch_id": batch_map.get(p1_id),
                        "quantity": 2,
                        "unit_price": p1_sell,
                        "cost_price": p1_cost,
                        "discount_amount": 0,
                        "total_price": 2 * p1_sell,
                        "tax_rate": 0,
                        "tax_amount": 0,
                        "is_restricted": parent_restricted,
                    },
                    {
                        "sale_id": sale_id,
                        "product_id": p2_id,
                        "batch_id": batch_map.get(p2_id),
                        "quantity": 1,
                        "unit_price": p2_sell,
                        "cost_price": p2_cost,
                        "discount_amount": 0,
                        "total_price": p2_sell,
                        "tax_rate": 0,
                        "tax_amount": 0,
                        "is_restricted": parent_restricted,
                    },
                ]
            db_upsert("sale_items", items, on_conflict="id")

    r_count = sum(1 for i in range(sale_glob_idx) if _restricted(i))
    log_ok(
        f"{total_sales} sales inserted (~{14 * 3 + 1} per store x {len(store_rows)} stores). "
        f"~{r_count} restricted  |  ~{total_sales - r_count} unrestricted."
    )


# ── 9. Accounting / Expenses + Income ─────────────────────────────────────────
def seed_accounting(company_id: int, store_rows: list[Row]) -> None:
    c = company_id
    log_section("Expenses & Income")

    stores = store_rows or db_fetch("stores", c)
    if not stores:
        log_warn("No stores found -- skipping accounting.")
        return

    # ── Expenses ──────────────────────────────────────────────────────────────
    exp_cats = _rows(
        get_client()
        .table("expense_categories")
        .select("*")
        .eq("company_id", c)
        .execute()
        .data
    )
    if not exp_cats:
        log_warn(
            "No expense categories -- skipping expenses. Run --copy-template first."
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

        # Two sets: one clearly restricted, one clearly not
        # Each store gets 5 unrestricted + 5 restricted = 10 expenses
        exp_templates: list[tuple[str, int, str, bool, str | None]] = [
            ("Rent", 2000000, "bank_transfer", True, "monthly"),
            ("Utilities", 380000, "cash", False, None),
            ("Salaries", 8500000, "bank_transfer", True, "monthly"),
            ("Transport", 150000, "cash", False, None),
            ("Marketing", 200000, "mobile_money", False, None),
        ]

        exp_total = 0
        exp_glob_idx = 0

        for store in stores[:2]:
            sid = int(store["id"])
            store_name = str(store["store_name"])
            expenses: list[Row] = []

            # Round 1 — is_restricted=False (visible)
            for idx, (label, amount, method, recurring, freq) in enumerate(
                exp_templates
            ):
                cat_id = _cat(label)
                if cat_id is None:
                    log_warn(f"  Category not found for '{label}' -- skipping.")
                    continue
                row: Row = {
                    "company_id": c,
                    "store_id": sid,
                    "expense_number": _doc_number("EXP", exp_glob_idx + 1),
                    "expense_date": days_ago(30 + idx * 5),
                    "category_id": cat_id,
                    "amount": amount,
                    "tax_rate": 0,
                    "tax_amount": 0,
                    "total_amount": amount,
                    "payment_method": method,
                    "description": f"[OPEN] {label} - {store_name}",
                    "is_recurring": recurring,
                    "payment_status": "paid",
                    "is_restricted": False,
                }
                if freq:
                    row["recurrence_frequency"] = freq
                expenses.append(row)
                exp_glob_idx += 1

            # Round 2 — is_restricted=True (hidden when toggle off)
            for idx, (label, amount, method, recurring, freq) in enumerate(
                exp_templates
            ):
                cat_id = _cat(label)
                if cat_id is None:
                    continue
                row = {
                    "company_id": c,
                    "store_id": sid,
                    "expense_number": _doc_number("EXP", exp_glob_idx + 1),
                    "expense_date": days_ago(25 + idx * 5),
                    "category_id": cat_id,
                    "amount": int(amount * 1.1),  # slightly different amount
                    "tax_rate": 0,
                    "tax_amount": 0,
                    "total_amount": int(amount * 1.1),
                    "payment_method": method,
                    "description": f"[RESTRICTED] {label} - {store_name}",
                    "is_recurring": recurring,
                    "payment_status": "paid",
                    "is_restricted": True,
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
        .eq("company_id", c)
        .execute()
        .data
    )
    if not inc_cats:
        log_warn("No income categories -- skipping income. Run --copy-template first.")
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

    inc_templates: list[tuple[str, int, str]] = [
        ("Sales Revenue", 5000000, "cash"),
        ("Service Charges", 300000, "mobile_money"),
        ("Consultation", 150000, "cash"),
        ("Delivery Fees", 80000, "mobile_money"),
        ("Miscellaneous", 50000, "cash"),
    ]

    inc_total = 0
    inc_glob_idx = 0

    for store in stores[:2]:
        sid = int(store["id"])
        store_name = str(store["store_name"])
        incomes: list[Row] = []

        # Round 1 — is_restricted=False (visible)
        for idx, (label, amount, method) in enumerate(inc_templates):
            cat_id = _inc_cat(label, "sales", "service", "consult", "delivery", "misc")
            if cat_id is None:
                # fall back to first available category
                cat_id = list(inc_cat_map.values())[idx % len(inc_cat_map)]
            incomes.append(
                {
                    "company_id": c,
                    "store_id": sid,
                    "income_number": _doc_number("INC", inc_glob_idx + 1),
                    "income_date": days_ago(14 + idx * 3),
                    "category_id": cat_id,
                    "amount": amount,
                    "tax_rate": 0,
                    "tax_amount": 0,
                    "total_amount": amount,
                    "payment_method": method,
                    "payment_status": "paid",
                    "description": f"[OPEN] {label} - {store_name}",
                    "is_restricted": False,
                }
            )
            inc_glob_idx += 1

        # Round 2 — is_restricted=True
        for idx, (label, amount, method) in enumerate(inc_templates):
            cat_id = _inc_cat(label, "sales", "service", "consult", "delivery", "misc")
            if cat_id is None:
                cat_id = list(inc_cat_map.values())[idx % len(inc_cat_map)]
            incomes.append(
                {
                    "company_id": c,
                    "store_id": sid,
                    "income_number": _doc_number("INC", inc_glob_idx + 1),
                    "income_date": days_ago(10 + idx * 3),
                    "category_id": cat_id,
                    "amount": int(amount * 1.15),
                    "tax_rate": 0,
                    "tax_amount": 0,
                    "total_amount": int(amount * 1.15),
                    "payment_method": method,
                    "payment_status": "paid",
                    "description": f"[RESTRICTED] {label} - {store_name}",
                    "is_restricted": True,
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
    c = company_id
    print(f"\nWARNING: About to DELETE all data for company_id={c}")
    confirm = input("  Type 'DELETE' to confirm: ").strip()
    if confirm != "DELETE":
        print("  Cancelled.")
        return

    client = get_client()

    # Tables that DO have company_id — delete directly
    direct_tables = [
        "sale_payments",
        "sales_returns",  # children (sales_return_items) cascade or deleted below
        "sales",  # sale_items will be deleted via JOIN below
        "purchase_returns",
        "purchase_orders",  # purchase_order_items deleted via JOIN below
        "product_batches",
        "credit_payments",
        "credit_transactions",
        "customers",
        "suppliers",
        "income",
        "expenses",
        "income_categories",
        "expense_categories",
        "chart_of_accounts",
        "categories",
        "units",
        "roles",  # role_permissions deleted via JOIN below
        "stores",
        "areas",
        "company_settings",
    ]

    # Tables WITHOUT company_id — must delete via parent IDs
    # These are handled first to avoid FK violations
    indirect_deletes = [
        # (child_table, parent_table, child_fk, parent_company_col)
        ("sale_items", "sales", "sale_id", "company_id"),
        ("sales_return_items", "sales_returns", "sales_return_id", "company_id"),
        ("purchase_order_items", "purchase_orders", "purchase_order_id", "company_id"),
        (
            "purchase_return_items",
            "purchase_returns",
            "purchase_return_id",
            "company_id",
        ),
        ("supplier_ratings", "suppliers", "supplier_id", "company_id"),
        ("customer_insurance", "customers", "customer_id", "company_id"),
        ("role_permissions", "roles", "role_id", "company_id"),
    ]

    print("\n  🗑  Deleting child tables (no company_id) via parent IDs…")
    for child_tbl, parent_tbl, child_fk, parent_col in indirect_deletes:
        try:
            # Fetch parent IDs for this company
            parent_rows = _rows(
                client.table(parent_tbl).select("id").eq(parent_col, c).execute().data
            )
            parent_ids = [int(r["id"]) for r in parent_rows]
            if parent_ids:
                client.table(child_tbl).delete().in_(child_fk, parent_ids).execute()
            print(f"    ✔  Cleared {child_tbl} (via {parent_tbl})")
        except Exception as exc:
            print(f"    ⚠  Could not clear {child_tbl}: {exc}")

    # income/expenses: only delete non-system rows (trigger blocks system records)
    print("\n  🗑  Deleting income/expenses (non-system only)…")
    for tbl in ("income", "expenses"):
        try:
            client.table(tbl).delete().eq("company_id", c).eq(
                "is_system", False
            ).execute()
            print(f"    ✔  Cleared {tbl} (is_system=False)")
        except Exception as exc:
            print(f"    ⚠  Could not clear {tbl}: {exc}")

    # income_categories / expense_categories — now safe (income/expenses cleared first)
    for tbl in ("income_categories", "expense_categories"):
        try:
            client.table(tbl).delete().eq("company_id", c).execute()
            print(f"    ✔  Cleared {tbl}")
        except Exception as exc:
            print(f"    ⚠  Could not clear {tbl}: {exc}")

    # Remaining direct tables
    print("\n  🗑  Deleting direct tables…")
    skip_already_done = {
        "income",
        "expenses",
        "income_categories",
        "expense_categories",
    }
    for table in direct_tables:
        if table in skip_already_done:
            continue
        try:
            client.table(table).delete().eq("company_id", c).execute()
            print(f"    ✔  Cleared {table}")
        except Exception as exc:
            print(f"    ⚠  Could not clear {table}: {exc}")

    try:
        client.table("companies").delete().eq("id", c).execute()
        print(f"    ✔  Cleared companies (id={c})")
    except Exception as exc:
        print(f"    ⚠  Could not clear companies: {exc}")

    log_ok(f"Cleared all data for company_id={c}.")

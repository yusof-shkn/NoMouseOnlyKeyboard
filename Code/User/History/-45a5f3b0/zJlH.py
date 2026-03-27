"""
Demo data seeders for a target pharmacy company.

Structure per run:
  • 3 areas  (Kampala City, Wakiso District, Entebbe)
  • 2 stores per area = 6 stores total
  • 4 suppliers, 6 customers (including walk-in)
  • Inventory batches per store (uses NDA global products from company_id=1)
  • 3 purchase orders per store  (received / partial / pending)
  • ~43 sales per store over 14 days + 1 credit sale
  • Expenses for first 2 stores

COLUMN FIX LOG (bugs found in original seeder.py):
  - customers: no gender/date_of_birth columns → removed
  - customers: no customer_name column → split into first_name + last_name
  - product_batches: cost_price → unit_cost
  - expenses: expense_category_id → category_id
  - expenses: frequency → recurrence_frequency
  - fetch_company(): was broken (used table.__class__) → replaced with db_fetch()
"""
from __future__ import annotations

from config import NDA_PRODUCT_IDS, NDA_PRODUCT_PRICE_MAP
from src.utils import (
    get_client, db_insert, db_fetch,
    log_ok, log_warn, log_section, log_step,
    days_ago, days_ahead,
)


# ── 1. Company & settings ─────────────────────────────────────────────────────
def seed_company(company_id: int, name: str | None = None) -> None:
    log_section(f"Company  (id={company_id})")
    c = company_id
    company_name = name or f"HealthPlus Pharmacy {c}"

    from src.utils import db_upsert
    db_upsert("companies", {
        "id":           c,
        "company_name": company_name,
        "company_code": f"HP{c:04d}",
        "email":        f"admin@healthplus{c}.ug",
        "phone":        f"+25670000{c:04d}",
        "address":      "Plot 14, Kampala Road, Kampala, Uganda",
        "city":         "Kampala",
        "country":      "Uganda",
        "tax_id":       f"100{c:07d}",
        "is_active":    True,
    }, on_conflict="id")

    from src.utils import db_upsert
    db_upsert("company_settings", {
        "company_id":                        c,
        "default_currency":                  "UGX",
        "base_currency":                     "UGX",
        "stock_valuation_method":            "FIFO",
        "enable_batch_tracking":             True,
        "low_stock_multiplier":              1.0,
        "near_expiry_warning_days":          60,
        "near_expiry_critical_days":         30,
        "auto_expire_batches":               True,
        "require_purchase_approval":         False,
        "enable_backorders":                 True,
        "auto_fulfill_backorders":           False,
        "allow_negative_stock":              False,
        "invoice_prefix":                    "INV",
        "po_prefix":                         "PO",
        "sale_number_prefix":                "SAL",
        "auto_generate_sale_numbers":        True,
        "auto_increment_documents":          True,
        "document_number_padding":           6,
        "allow_sales_returns":               True,
        "sales_return_days_limit":           30,
        "require_return_approval":           True,
        "allow_purchase_returns":            True,
        "purchase_return_days_limit":        14,
        "require_purchase_return_approval":  False,
        "auto_restock_on_return":            True,
        "block_expired_sales":               True,
        "allow_near_expiry_discount":        True,
        "near_expiry_discount_percentage":   10,
        "supplier_code_prefix":              "SUP",
        "auto_generate_supplier_codes":      True,
        "supplier_code_counter":             1,
        "quotation_prefix":                  "QT-",
        "default_quotation_validity_days":   30,
        "require_quotation_approval":        False,
        "auto_generate_quotation_numbers":   True,
        "expense_category_prefix":           "EXP",
        "auto_increment_expense_categories": True,
        "expense_category_number_padding":   4,
        "max_discount_percentage":           20,
        "require_discount_approval":         True,
        "allow_inter_store_transfers":       True,
        "require_transfer_approval":         False,
        "enable_low_stock_notifications":    True,
        "enable_expiry_notifications":       True,
        "enable_payment_notifications":      True,
        "enable_order_notifications":        True,
        "receipt_paper_size":                "A4",
        "show_company_logo_on_receipt":      True,
        "default_credit_days":               30,
    }, on_conflict="company_id")
    log_ok(f"Company '{company_name}' and settings ensured.")


# ── 2. Areas & stores ─────────────────────────────────────────────────────────
def seed_stores(company_id: int) -> tuple[list, list]:
    c = company_id
    log_section("Areas & Stores  (3 × 2)")

    areas_data = [
        {"company_id": c, "area_name": "Kampala City",    "area_code": f"KLA-{c}", "region": "Central", "country": "Uganda", "description": "Kampala CBD stores",                "is_active": True},
        {"company_id": c, "area_name": "Wakiso District", "area_code": f"WAK-{c}", "region": "Central", "country": "Uganda", "description": "Greater Kampala suburban stores", "is_active": True},
        {"company_id": c, "area_name": "Entebbe",         "area_code": f"ENT-{c}", "region": "Central", "country": "Uganda", "description": "Entebbe peninsula stores",         "is_active": True},
    ]
    area_rows = db_insert("areas", areas_data)
    if not area_rows:
        log_warn("No areas created — aborting stores seed.")
        return [], []
    log_ok(f"{len(area_rows)} areas inserted.")

    store_defs = [
        (0, f"HP Main Branch",       f"HP{c}-KLA-01", "Plot 14, Kampala Road, Kampala",    f"+25670{c:04d}01", f"main{c}@healthplus.ug"),
        (0, f"HP Wandegeya Branch",  f"HP{c}-KLA-02", "Wandegeya, Kampala",                f"+25670{c:04d}02", f"wandegeya{c}@healthplus.ug"),
        (1, f"HP Ntinda Branch",     f"HP{c}-WAK-01", "Ntinda Shopping Centre, Wakiso",    f"+25670{c:04d}03", f"ntinda{c}@healthplus.ug"),
        (1, f"HP Nansana Branch",    f"HP{c}-WAK-02", "Nansana Town, Wakiso",              f"+25670{c:04d}04", f"nansana{c}@healthplus.ug"),
        (2, f"HP Entebbe Branch",    f"HP{c}-ENT-01", "Entebbe Road, Entebbe",             f"+25670{c:04d}05", f"entebbe{c}@healthplus.ug"),
        (2, f"HP Katabi Branch",     f"HP{c}-ENT-02", "Katabi Town Council, Entebbe",      f"+25670{c:04d}06", f"katabi{c}@healthplus.ug"),
    ]
    stores_data = [
        {
            "company_id": c,
            "area_id":    area_rows[area_idx]["id"],
            "store_name": store_name,
            "store_code": store_code,
            "store_type": "pharmacy",
            "address":    address,
            "phone":      phone,
            "email":      email,
            "is_active":  True,
        }
        for area_idx, store_name, store_code, address, phone, email in store_defs
    ]
    store_rows = db_insert("stores", stores_data)
    log_ok(f"{len(store_rows)} stores inserted (2 per area).")
    return area_rows, store_rows


# ── 3. Suppliers ──────────────────────────────────────────────────────────────
def seed_suppliers(company_id: int) -> list:
    c = company_id
    log_section("Suppliers")
    data = [
        {"company_id": c, "supplier_name": "Cipla Quality Chemical Uganda", "supplier_code": f"SUP{c:04d}001", "email": "orders@cipla.co.ug",        "phone": "+256414123456", "address": "Plot 23, Industrial Area, Kampala", "contact_person": "John Mwesigwa",   "payment_terms": "net_30", "credit_limit": 5000000,  "is_active": True},
        {"company_id": c, "supplier_name": "National Medical Stores (NMS)", "supplier_code": f"SUP{c:04d}002", "email": "procurement@nms.go.ug",      "phone": "+256414340808", "address": "Port Bell Road, Kampala",          "contact_person": "Grace Nakato",    "payment_terms": "net_30", "credit_limit": 10000000, "is_active": True},
        {"company_id": c, "supplier_name": "Strides Pharma Uganda",         "supplier_code": f"SUP{c:04d}003", "email": "uganda@strides.com",         "phone": "+256414555123", "address": "8th Street, Industrial Area",      "contact_person": "Peter Ssemanda",  "payment_terms": "net_45", "credit_limit": 3000000,  "is_active": True},
        {"company_id": c, "supplier_name": "Medipharm Uganda Ltd",          "supplier_code": f"SUP{c:04d}004", "email": "sales@medipharm.co.ug",      "phone": "+256754321987", "address": "Plot 5, Spring Road, Bugolobi",   "contact_person": "Sarah Akello",    "payment_terms": "net_30", "credit_limit": 2000000,  "is_active": True},
    ]
    rows = db_insert("suppliers", data)
    log_ok(f"{len(rows)} suppliers inserted.")
    return rows


# ── 4. Customers ──────────────────────────────────────────────────────────────
# FIX: customers table has first_name + last_name (no customer_name, no gender, no date_of_birth)
def seed_customers(company_id: int) -> list:
    c = company_id
    log_section("Customers")
    data = [
        {"company_id": c, "first_name": "Walk-in",  "last_name": "Customer",   "customer_code": f"WALKIN-{c:04d}",    "is_active": True, "credit_limit": 0,       "credit_days": 0},
        {"company_id": c, "first_name": "Nakato",   "last_name": "Mary",       "customer_code": f"CUST-{c:04d}-001",  "email": f"mary{c}@gmail.com",    "phone": f"+25670{c:04d}11", "address": "Ntinda, Kampala",    "credit_limit": 500000, "credit_days": 30, "is_active": True},
        {"company_id": c, "first_name": "Ssemanda", "last_name": "Joseph",     "customer_code": f"CUST-{c:04d}-002",  "email": f"joseph{c}@yahoo.com",  "phone": f"+25670{c:04d}12", "address": "Kiira, Wakiso",      "credit_limit": 300000, "credit_days": 30, "is_active": True},
        {"company_id": c, "first_name": "Akello",   "last_name": "Grace",      "customer_code": f"CUST-{c:04d}-003",  "email": f"grace{c}@gmail.com",   "phone": f"+25670{c:04d}13", "address": "Kawempe, Kampala",   "credit_limit": 200000, "credit_days": 14, "is_active": True},
        {"company_id": c, "first_name": "Bbosa",    "last_name": "Clinic",     "customer_code": f"INST-{c:04d}-001",  "email": f"pharmacy{c}@bbosa.co.ug","phone": f"+25641{c:04d}77","address": "Bukoto, Kampala",   "credit_limit": 5000000,"credit_days": 30, "is_active": True},
        {"company_id": c, "first_name": "Mugisha",  "last_name": "Robert",     "customer_code": f"CUST-{c:04d}-004",  "email": f"mugisha{c}@gmail.com", "phone": f"+25670{c:04d}14", "address": "Makindye, Kampala",  "credit_limit": 500000, "credit_days": 30, "is_active": True},
    ]
    rows = db_insert("customers", data)
    log_ok(f"{len(rows)} customers inserted.")
    return rows


# ── 5. NDA products (read-only from company_id=1) ────────────────────────────
def fetch_nda_products() -> list:
    """
    Fetch the curated NDA global product catalogue (company_id=1).
    No INSERT – these products already exist globally.
    Augments each product dict with unit_cost / selling_price for batch seeding.
    """
    log_section("NDA Products  (read-only from company_id=1)")
    try:
        rows = (
            get_client()
            .table("products")
            .select("id,product_name,generic_name,product_code,category_id,unit_id,reorder_level")
            .eq("company_id", 1)
            .in_("id", NDA_PRODUCT_IDS)
            .is_("deleted_at", "null")
            .execute()
            .data or []
        )
    except Exception as e:
        log_warn(f"Failed to fetch NDA products: {e}")
        return []

    enriched = [
        {**r, "unit_cost": NDA_PRODUCT_PRICE_MAP.get(r["id"], (500, 1000))[0],
              "selling_price": NDA_PRODUCT_PRICE_MAP.get(r["id"], (500, 1000))[1]}
        for r in rows
    ]
    log_ok(f"{len(enriched)} NDA products loaded (no insert).")
    return enriched


# ── 6. Inventory batches ──────────────────────────────────────────────────────
# FIX: product_batches uses unit_cost (not cost_price)
def seed_inventory(
    company_id: int,
    product_rows: list,
    store_rows: list,
    supplier_rows: list,
) -> list:
    c = company_id
    log_section("Inventory Batches")

    if not all([product_rows, store_rows, supplier_rows]):
        log_warn("Missing dependencies – skipping inventory.")
        return []

    sup_id  = supplier_rows[0]["id"]
    sup2_id = supplier_rows[1]["id"] if len(supplier_rows) > 1 else sup_id
    today   = days_ago(0).replace("-", "")

    batches = []
    for s_idx, store in enumerate(store_rows):
        sid   = store["id"]
        scode = store["store_code"].replace("-", "")[-4:]
        sup   = sup_id if s_idx % 2 == 0 else sup2_id

        for p_idx, prod in enumerate(product_rows):
            qty = 150 + s_idx * 20 + p_idx * 5
            batches.append({
                "company_id":        c,
                "product_id":        prod["id"],
                "store_id":          sid,
                "batch_number":      f"BT-{scode}-{today}-{p_idx + 1:03d}",
                "manufacturing_date": days_ago(180 + s_idx * 10),
                "expiry_date":       days_ahead(365 + p_idx * 15),
                "quantity_received": qty + 50,
                "quantity_available": qty,
                "unit_cost":         prod.get("unit_cost", 500),       # ← fixed
                "selling_price":     prod.get("selling_price", 1000),
                "supplier_id":       sup,
                "is_active":         True,
            })

    # Near-expiry demo batch
    batches.append({
        "company_id":        c,
        "product_id":        product_rows[0]["id"],
        "store_id":          store_rows[0]["id"],
        "batch_number":      f"NEAREXP-{c}-001",
        "manufacturing_date": days_ago(300),
        "expiry_date":       days_ahead(25),
        "quantity_received": 50,
        "quantity_available": 20,
        "unit_cost":         product_rows[0].get("unit_cost", 500),    # ← fixed
        "selling_price":     product_rows[0].get("selling_price", 1000),
        "supplier_id":       sup_id,
        "is_active":         True,
        "notes":             "Near expiry – seeder demo batch",
    })

    rows = db_insert("product_batches", batches)
    log_ok(f"{len(rows)} batches inserted ({len(product_rows)} products × {len(store_rows)} stores + 1 near-expiry).")
    return rows


# ── 7. Purchases ──────────────────────────────────────────────────────────────
def seed_purchases(
    company_id: int,
    product_rows: list,
    store_rows: list,
    supplier_rows: list,
) -> None:
    c = company_id
    log_section("Purchase Orders")

    if not all([product_rows, store_rows, supplier_rows]):
        log_warn("Missing dependencies – skipping purchases.")
        return

    sup_ids = [s["id"] for s in supplier_rows]
    total_po = 0

    for s_idx, store in enumerate(store_rows):
        sid    = store["id"]
        scode  = store["store_code"]
        sup_a  = sup_ids[s_idx % len(sup_ids)]
        sup_b  = sup_ids[(s_idx + 1) % len(sup_ids)]

        po_data = [
            {
                "company_id": c, "store_id": sid, "supplier_id": sup_a,
                "po_number":  f"PO-{scode}-{days_ago(30).replace('-','')}-01",
                "po_date": days_ago(30), "expected_delivery_date": days_ago(23),
                "status": "received", "subtotal": 2500000, "tax_amount": 0,
                "discount_amount": 50000, "total_amount": 2450000,
                "paid_amount": 2450000, "payment_terms": "net_30",
                "payment_status": "paid", "payment_method": "bank_transfer",
                "notes": f"Monthly restock – {store['store_name']}",
            },
            {
                "company_id": c, "store_id": sid, "supplier_id": sup_b,
                "po_number":  f"PO-{scode}-{days_ago(15).replace('-','')}-02",
                "po_date": days_ago(15), "expected_delivery_date": days_ago(8),
                "status": "received", "subtotal": 1200000, "tax_amount": 0,
                "discount_amount": 0, "total_amount": 1200000,
                "paid_amount": 600000, "payment_terms": "net_30",
                "payment_status": "partially_paid", "payment_method": "cash",
            },
            {
                "company_id": c, "store_id": sid, "supplier_id": sup_a,
                "po_number":  f"PO-{scode}-{days_ago(3).replace('-','')}-03",
                "po_date": days_ago(3), "expected_delivery_date": days_ahead(4),
                "status": "approved", "subtotal": 1800000, "tax_amount": 0,
                "discount_amount": 0, "total_amount": 1800000,
                "paid_amount": 0, "payment_terms": "net_30",
                "payment_status": "unpaid", "payment_method": "bank_transfer",
            },
        ]
        po_rows = db_insert("purchase_orders", po_data)
        total_po += len(po_rows)

        # Line items on first PO of each store
        if po_rows and len(product_rows) >= 2:
            items = [
                {
                    "purchase_order_id": po_rows[0]["id"],
                    "product_id":        product_rows[0]["id"],
                    "quantity_ordered":  300,
                    "quantity_received": 300,
                    "unit_cost":         product_rows[0].get("unit_cost", 500),
                    "discount_amount":   0,
                    "total_cost":        300 * product_rows[0].get("unit_cost", 500),
                    "expiry_date":       days_ahead(730),
                    "batch_number":      f"CIPLA-{scode}-A01",
                },
                {
                    "purchase_order_id": po_rows[0]["id"],
                    "product_id":        product_rows[1]["id"],
                    "quantity_ordered":  150,
                    "quantity_received": 150,
                    "unit_cost":         product_rows[1].get("unit_cost", 500),
                    "discount_amount":   0,
                    "total_cost":        150 * product_rows[1].get("unit_cost", 500),
                    "expiry_date":       days_ahead(540),
                    "batch_number":      f"CIPLA-{scode}-A02",
                },
            ]
            db_insert("purchase_order_items", items)

    log_ok(f"{total_po} purchase orders inserted (3 per store).")


# ── 8. Sales ──────────────────────────────────────────────────────────────────
def seed_sales(
    company_id: int,
    product_rows: list,
    store_rows: list,
    customer_rows: list,
    batch_rows: list,
) -> None:
    c = company_id
    log_section("Sales")

    if not all([product_rows, store_rows, customer_rows]):
        log_warn("Missing dependencies – skipping sales.")
        return

    walkin   = next((x for x in customer_rows if "WALKIN" in x.get("customer_code", "")), customer_rows[0])
    regulars = [x for x in customer_rows if "WALKIN" not in x.get("customer_code", "")]
    cust1    = regulars[0] if regulars else walkin
    cust2    = regulars[1] if len(regulars) > 1 else walkin
    inst     = next((x for x in customer_rows if "INST" in x.get("customer_code", "")), cust1)

    batch_map = {b["product_id"]: b["id"] for b in (batch_rows or [])}
    total_sales = 0

    for s_idx, store in enumerate(store_rows):
        sid   = store["id"]
        scode = store["store_code"]
        sales_list = []

        # 14 days × 3 sales per day
        for day in range(14, 0, -1):
            for sale_num in range(1, 4):
                total = (100 + day * 30 + sale_num * 50 + s_idx * 20) * 100
                customer = walkin if sale_num == 1 else (cust1 if sale_num == 2 else cust2)
                sales_list.append({
                    "company_id":     c,
                    "store_id":       sid,
                    "sale_number":    f"SAL-{scode}-{days_ago(day).replace('-','')}-{sale_num:03d}",
                    "sale_date":      days_ago(day),
                    "customer_id":    customer["id"],
                    "sale_type":      "over_the_counter",
                    "sale_status":    "completed",
                    "subtotal":       total,
                    "tax_amount":     0,
                    "discount_amount":0,
                    "total_amount":   total,
                    "amount_paid":    total,
                    "payment_method": "cash" if sale_num != 3 else "mobile_money",
                    "payment_status": "paid",
                })

        # 1 credit/institutional sale
        sales_list.append({
            "company_id":     c,
            "store_id":       sid,
            "sale_number":    f"SAL-{scode}-CREDIT-001",
            "sale_date":      days_ago(2),
            "customer_id":    inst["id"],
            "sale_type":      "institutional",
            "sale_status":    "completed",
            "subtotal":       350000,
            "tax_amount":     0,
            "discount_amount":0,
            "total_amount":   350000,
            "amount_paid":    0,
            "payment_method": "credit",
            "payment_status": "unpaid",
        })

        sale_rows = db_insert("sales", sales_list)
        total_sales += len(sale_rows)

        # Line items for first 3 sales
        if sale_rows and len(product_rows) >= 2:
            items = []
            for sr in sale_rows[:3]:
                p1 = product_rows[s_idx % len(product_rows)]
                p2 = product_rows[(s_idx + 1) % len(product_rows)]
                items += [
                    {
                        "sale_id":        sr["id"],
                        "product_id":     p1["id"],
                        "batch_id":       batch_map.get(p1["id"]),
                        "quantity":       2,
                        "unit_price":     p1.get("selling_price", 1000),
                        "cost_price":     p1.get("unit_cost", 500),
                        "discount_amount":0,
                        "total_price":    2 * p1.get("selling_price", 1000),
                        "tax_rate":       0,
                        "tax_amount":     0,
                    },
                    {
                        "sale_id":        sr["id"],
                        "product_id":     p2["id"],
                        "batch_id":       batch_map.get(p2["id"]),
                        "quantity":       1,
                        "unit_price":     p2.get("selling_price", 1000),
                        "cost_price":     p2.get("unit_cost", 500),
                        "discount_amount":0,
                        "total_price":    p2.get("selling_price", 1000),
                        "tax_rate":       0,
                        "tax_amount":     0,
                    },
                ]
            db_insert("sale_items", items)

    log_ok(f"{total_sales} sales inserted (~{14 * 3 + 1} per store × {len(store_rows)} stores).")


# ── 9. Accounting ─────────────────────────────────────────────────────────────
# FIX: expenses table uses category_id (not expense_category_id)
#      and recurrence_frequency (not frequency)
def seed_accounting(company_id: int, store_rows: list) -> None:
    c = company_id
    log_section("Expenses")

    exp_cats = (
        get_client()
        .table("expense_categories")
        .select("*")
        .eq("company_id", c)
        .execute()
        .data or []
    )

    if not exp_cats:
        log_warn("No expense categories found – skipping accounting. Run --copy-template first.")
        return

    stores = store_rows or db_fetch("stores", c)
    if not stores:
        log_warn("No stores found – skipping accounting.")
        return

    # Build keyword → category_id map
    cat_map = {r["category_name"]: r["id"] for r in exp_cats}

    def _cat(*candidates: str) -> int | None:
        for name in candidates:
            for cat_name, cat_id in cat_map.items():
                if name.lower() in cat_name.lower():
                    return cat_id
        return None

    templates = [
        ("Rent",       2000000, "bank_transfer", True,  "monthly"),
        ("Utilities",   380000, "cash",           False, None),
        ("Salaries",  8500000, "bank_transfer",  True,  "monthly"),
        ("Transport",   150000, "cash",           False, None),
        ("Marketing",   200000, "mobile_money",   False, None),
    ]

    total = 0
    for store in stores[:2]:
        sid        = store["id"]
        store_name = store["store_name"]
        expenses   = []

        for idx, (label, amount, method, recurring, freq) in enumerate(templates):
            cat_id = _cat(label)
            if not cat_id:
                log_warn(f"  Category not found for '{label}' – skipping.")
                continue

            row = {
                "company_id":     c,
                "store_id":       sid,
                "expense_date":   days_ago(30 + idx * 5),
                "category_id":    cat_id,          # ← fixed (was expense_category_id)
                "amount":         amount,
                "tax_rate":       0,
                "tax_amount":     0,
                "total_amount":   amount,
                "payment_method": method,
                "description":    f"{label} – {store_name}",
                "is_recurring":   recurring,
                "payment_status": "paid",
            }
            if freq:
                row["recurrence_frequency"] = freq  # ← fixed (was frequency)

            expenses.append(row)

        if expenses:
            rows = db_insert("expenses", expenses)
            total += len(rows)
            log_ok(f"  {len(rows)} expenses for {store_name}.")

    log_ok(f"{total} total expense records inserted.")


# ── 10. Clear ─────────────────────────────────────────────────────────────────
def clear_seed_data(company_id: int) -> None:
    from src.utils import get_client
    c = company_id
    print(f"\n⚠️   About to DELETE all data for company_id={c}")
    confirm = input("  Type 'DELETE' to confirm: ").strip()
    if confirm != "DELETE":
        print("  Cancelled.")
        return

    client = get_client()
    tables = [
        "sale_items", "sale_payments", "sales_return_items", "sales_returns", "sales",
        "purchase_return_items", "purchase_returns", "purchase_order_items",
        "purchase_invoices", "purchase_orders",
        "product_batches", "stock_adjustments",
        "credit_payments", "credit_transactions",
        "customer_insurance", "customers",
        "supplier_ratings", "suppliers",
        "notifications",
        "journal_entry_lines", "journal_entries",
        "income", "expenses",
        "income_categories", "expense_categories",
        "account_balances", "chart_of_accounts",
        "fiscal_periods", "tax_codes",
        "quotation_items", "quotations",
        "payment_transactions",
        "products", "categories", "units",
        "role_permissions",
        "user_invitations", "profiles",
        "roles",
        "stores", "areas",
        "setup_progress", "company_settings",
    ]
    for table in tables:
        try:
            client.table(table).delete().eq("company_id", c).execute()
            print(f"  🗑  {table}")
        except Exception as e:
            print(f"  ⚠  {table}: {e}")

    try:
        client.table("companies").delete().eq("id", c).execute()
        print(f"  🗑  companies (id={c})")
    except Exception as e:
        print(f"  ⚠  companies: {e}")

    log_ok(f"Cleared all data for company_id={c}.")
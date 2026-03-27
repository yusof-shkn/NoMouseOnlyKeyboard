"""
PharmaSOS – Central configuration.
All env vars and shared constants live here. Import from this module everywhere.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ── Supabase ──────────────────────────────────────────────────────────────────
SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY: str = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

# ── Company IDs ───────────────────────────────────────────────────────────────
TEMPLATE_COMPANY_ID: int = 1
DEFAULT_COMPANY_ID: int = int(os.getenv("COMPANY_ID", "2"))

# ── Template health expectations ──────────────────────────────────────────────
TEMPLATE_EXPECTED: dict[str, int] = {
    "company":          1,
    "settings":         1,
    "roles":            7,
    "permissions":      307,
    "role_permissions": 1077,
    "categories":       8,
    "units":            10,
    "coa":              69,
    "income_cats":      16,
    "expense_cats":     24,
}

# ── Category definitions (shared by scraper & template seeder) ────────────────
CATEGORY_MAPPINGS: dict[str, dict] = {
    "CAPSULES": {
        "keywords":    ["capsule", "caps"],
        "code":        "CAP",
        "description": "Solid dosage forms enclosed in gelatin or cellulose shells",
        "icon":        "capsule",
        "color":       "#FF6B6B",
    },
    "TABLETS": {
        "keywords":    ["tablet", "tabs", "caplet"],
        "code":        "TAB",
        "description": "Solid dosage forms compressed into disc or oval shapes",
        "icon":        "tablet",
        "color":       "#4ECDC4",
    },
    "SYRUPS": {
        "keywords":    ["syrup", "suspension", "solution", "liquid", "elixir", "linctus"],
        "code":        "SYR",
        "description": "Liquid oral preparations including syrups, suspensions, and solutions",
        "icon":        "liquid",
        "color":       "#95E1D3",
    },
    "DROPS": {
        "keywords":    ["drop", "nasal", "ear", "eye", "ophthalmic", "otic"],
        "code":        "DRP",
        "description": "Liquid preparations administered by drops (oral, eye, ear, nasal)",
        "icon":        "droplet",
        "color":       "#38A3A5",
    },
    "INJECTABLES": {
        "keywords":    ["injection", "ampoule", "vial", "parenteral", "infusion", "iv"],
        "code":        "INJ",
        "description": "Sterile preparations for parenteral administration",
        "icon":        "syringe",
        "color":       "#22577A",
    },
    "CREAMS": {
        "keywords":    ["cream", "ointment", "gel", "lotion", "topical", "spray", "paste"],
        "code":        "CRM",
        "description": "Semi-solid preparations for external application",
        "icon":        "cream",
        "color":       "#FFA07A",
    },
    "PESSARIES": {
        "keywords":    ["pessary", "suppository", "vaginal", "rectal", "ovule"],
        "code":        "PES",
        "description": "Solid dosage forms for vaginal or rectal administration",
        "icon":        "medical",
        "color":       "#C77DFF",
    },
    "SUNDRIES": {
        "keywords":    ["device", "implant", "patch", "inhaler", "powder", "granule"],
        "code":        "SUN",
        "description": "Medical devices and other pharmaceutical preparations",
        "icon":        "package",
        "color":       "#9D4EDD",
    },
}

# ── NDA scraper ───────────────────────────────────────────────────────────────
NDA_BASE_URL: str = "https://www.nda.or.ug/drug-register/"

# ── Curated NDA product IDs with (cost_price, selling_price) estimates ────────
NDA_PRODUCT_PRICE_MAP: dict[int, tuple[int, int]] = {
    1414: (50,   100),   # AGOMOL CAPLETS – PARACETAMOL
    3047: (150,  300),   # DURAMOX 125 – AMOXICILLIN
    1835: (60,   120),   # GOFEN 200 – IBUPROFEN
    1629: (200,  400),   # CIPROCIN – CIPROFLOXACIN
    1678: (120,  250),   # OMMED-20 – OMEPRAZOLE
    1563: (70,   150),   # METROLEB – METRONIDAZOLE
    1500: (120,  250),   # AB-DOX-100 – DOXYCYCLINE
    1409: (5000, 9000),  # QUININE SULPHATE
    1482: (8000, 12000), # KOMEFAN 140 – ARTEMETHER+LUMEFANTRINE
    1599: (80,   150),   # DIABETMIN RETARD – METFORMIN HCL
    3488: (30,   60),    # VITAMIN C – ASCORBIC ACID
    1691: (100,  200),   # CORVADIL 5 – AMLODIPINE
    1424: (150,  300),   # LIPITOR – ATORVASTATIN
}

NDA_PRODUCT_IDS: list[int] = list(NDA_PRODUCT_PRICE_MAP.keys())
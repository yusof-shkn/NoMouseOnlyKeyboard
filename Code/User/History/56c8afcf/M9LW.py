#!/usr/bin/env python3
"""
NDA Uganda Medicines Scraper - Production Version with Category Mapping
Scrapes medicine data from NDA Uganda and inserts into Supabase with proper categories

Author: Your Name
Date: 2025
"""

import json
import os
import sys
import time
from datetime import datetime
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import Client, create_client

# Load environment variables
load_dotenv()

# Configuration from .env
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# Prioritize service role key, fallback to anon key
SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
COMPANY_ID = int(os.getenv("COMPANY_ID", "1"))

# Validate environment variables
if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Missing Supabase credentials in .env file")
    print("Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

# Warn if using anon key
if not SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY:
    print("\n⚠️  WARNING: Using SUPABASE_ANON_KEY")
    print("   This may fail due to Row Level Security (RLS) policies.")
    print("   For best results, use SUPABASE_SERVICE_ROLE_KEY instead.")
    print(
        "   Get it from: Supabase Dashboard > Project Settings > API > service_role key"
    )
    print("\n   Press Enter to continue or Ctrl+C to exit...")
    input()

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Connected to Supabase")
except Exception as e:
    print(f"❌ Failed to connect to Supabase: {e}")
    sys.exit(1)


# Category Mapping Configuration
CATEGORY_MAPPINGS = {
    "CAPSULES": {
        "keywords": ["capsule", "caps"],
        "code": "CAP",
        "description": "Solid dosage forms enclosed in gelatin or cellulose shells",
    },
    "TABLETS": {
        "keywords": ["tablet", "tabs", "caplet"],
        "code": "TAB",
        "description": "Solid dosage forms compressed into disc or oval shapes",
    },
    "SYRUPS": {
        "keywords": ["syrup", "suspension", "solution", "liquid", "elixir", "linctus"],
        "code": "SYR",
        "description": "Liquid oral preparations including syrups, suspensions, and solutions",
    },
    "DROPS": {
        "keywords": ["drop", "nasal", "ear", "eye", "ophthalmic", "otic"],
        "code": "DRP",
        "description": "Liquid preparations administered by drops (oral, eye, ear, nasal)",
    },
    "INJECTABLES": {
        "keywords": ["injection", "ampoule", "vial", "parenteral", "infusion", "iv"],
        "code": "INJ",
        "description": "Sterile preparations for parenteral administration",
    },
    "CREAMS": {
        "keywords": ["cream", "ointment", "gel", "lotion", "topical", "spray", "paste"],
        "code": "CRM",
        "description": "Semi-solid preparations for external application",
    },
    "PESSARIES": {
        "keywords": ["pessary", "suppository", "vaginal", "rectal", "ovule"],
        "code": "PES",
        "description": "Solid dosage forms for vaginal or rectal administration",
    },
    "SUNDRIES": {
        "keywords": ["device", "implant", "patch", "inhaler", "powder", "granule"],
        "code": "SUN",
        "description": "Medical devices and other pharmaceutical preparations",
    },
}


class CategoryManager:
    """Manages category operations in database"""

    def __init__(self, company_id: int):
        self.company_id = company_id
        self.category_cache = {}

    def initialize_categories(self) -> bool:
        """Create default categories if they don't exist"""
        try:
            print("\n🏷️  Initializing categories...")

            for cat_name, cat_info in CATEGORY_MAPPINGS.items():
                # Check if category exists
                result = (
                    supabase.table("categories")
                    .select("id")
                    .eq("company_id", self.company_id)
                    .eq("category_code", cat_info["code"])
                    .execute()
                )

                if not result.data:
                    # Create category
                    category_data = {
                        "company_id": self.company_id,
                        "category_name": cat_name,
                        "category_code": cat_info["code"],
                        "description": cat_info["description"],
                        "level": 1,
                        "is_active": True,
                        "sort_order": list(CATEGORY_MAPPINGS.keys()).index(cat_name)
                        + 1,
                    }

                    insert_result = (
                        supabase.table("categories").insert(category_data).execute()
                    )

                    if insert_result.data:
                        self.category_cache[cat_name] = insert_result.data[0]["id"]
                        print(f"   ✓ Created category: {cat_name}")
                    else:
                        print(f"   ⚠️  Failed to create category: {cat_name}")
                else:
                    self.category_cache[cat_name] = result.data[0]["id"]
                    print(f"   ✓ Found existing category: {cat_name}")

            print(f"✅ Initialized {len(self.category_cache)} categories")
            return True

        except Exception as e:
            print(f"❌ Error initializing categories: {e}")
            return False

    def get_category_for_dosage_form(self, dosage_form: str) -> Optional[int]:
        """Determine category ID based on dosage form"""
        if not dosage_form:
            return self.category_cache.get("SUNDRIES")

        dosage_form_lower = dosage_form.lower()

        # Check each category's keywords
        for cat_name, cat_info in CATEGORY_MAPPINGS.items():
            for keyword in cat_info["keywords"]:
                if keyword in dosage_form_lower:
                    return self.category_cache.get(cat_name)

        # Default to SUNDRIES if no match
        return self.category_cache.get("SUNDRIES")


class NDAScraper:
    """Scraper for NDA Uganda Drug Register"""

    def __init__(self):
        self.base_url = "https://www.nda.or.ug/drug-register/"
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            }
        )

    def fetch_page(self, url: str) -> Optional[str]:
        """Fetch page content with retry logic"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                print(
                    f"📡 Fetching NDA website (attempt {attempt + 1}/{max_retries})..."
                )
                response = self.session.get(url, timeout=30)
                response.raise_for_status()
                print("✅ Successfully fetched page")
                return response.text
            except requests.RequestException as e:
                print(f"⚠️  Attempt {attempt + 1} failed: {e}")
                if attempt == max_retries - 1:
                    print("❌ Failed to fetch page after all retries")
                    return None
                time.sleep(2**attempt)
        return None

    def parse_human_medicines(self, soup: BeautifulSoup) -> List[Dict]:
        """Parse human medicines table"""
        medicines = []

        print("\n🔍 Parsing human medicines...")

        human_tab = soup.find("div", {"id": "1539148991734-31a96a97-315e"})
        if not human_tab:
            print("⚠️  Human medicines tab not found")
            return medicines

        table = human_tab.find("table")
        if not table:
            print("⚠️  Human medicines table not found")
            return medicines

        tbody = table.find("tbody")
        if not tbody:
            print("⚠️  Table body not found")
            return medicines

        rows = tbody.find_all("tr")
        print(f"📊 Found {len(rows)} rows in human medicines table")

        for idx, row in enumerate(rows, 1):
            cells = row.find_all("td")
            if len(cells) < 11:
                continue

            try:
                medicine = {
                    "nda_registration_number": cells[1].get_text(strip=True),
                    "license_holder": cells[2].get_text(strip=True),
                    "local_technical_representative": cells[3].get_text(strip=True),
                    "product_name": cells[4].get_text(strip=True),
                    "generic_name": cells[5].get_text(strip=True),
                    "strength": cells[6].get_text(strip=True),
                    "manufacturing_site": cells[7].get_text(strip=True),
                    "country_of_manufacture": cells[8].get_text(strip=True) or "Uganda",
                    "dosage_form": cells[9].get_text(strip=True),
                    "pack_size": cells[10].get_text(strip=True),
                    "registration_date": cells[11].get_text(strip=True)
                    if len(cells) > 11
                    else "",
                    "drug_type": "human",
                }

                if medicine["product_name"] and medicine["nda_registration_number"]:
                    medicines.append(medicine)
                    if idx % 100 == 0:
                        print(f"  ✓ Parsed {idx} rows...")

            except Exception as e:
                print(f"⚠️  Error parsing row {idx}: {e}")
                continue

        print(f"✅ Successfully parsed {len(medicines)} human medicines")
        return medicines

    def parse_herbal_medicines(
        self, soup: BeautifulSoup, drug_type: str = "herbalHuman"
    ) -> List[Dict]:
        """Parse herbal medicines table"""
        medicines = []

        print(f"\n🔍 Parsing {drug_type} medicines...")

        tab_ids = {
            "herbalHuman": "1539148778865-e150cba2-d14d",
            "herbalVet": "1539148778905-ff522642-6acd",
        }

        tab_id = tab_ids.get(drug_type)
        if not tab_id:
            print(f"⚠️  Unknown drug type: {drug_type}")
            return medicines

        tab = soup.find("div", {"id": tab_id})
        if not tab:
            print(f"⚠️  {drug_type} tab not found")
            return medicines

        table = tab.find("table")
        if not table:
            print(f"⚠️  {drug_type} table not found")
            return medicines

        tbody = table.find("tbody")
        if not tbody:
            print("⚠️  Table body not found")
            return medicines

        rows = tbody.find_all("tr")
        print(f"📊 Found {len(rows)} rows in {drug_type} table")

        for idx, row in enumerate(rows, 1):
            cells = row.find_all("td")
            if len(cells) < 8:
                continue

            try:
                if drug_type == "herbalHuman":
                    medicine = {
                        "nda_registration_number": cells[1].get_text(strip=True),
                        "license_holder": cells[2].get_text(strip=True),
                        "local_technical_representative": cells[3].get_text(strip=True),
                        "product_name": cells[4].get_text(strip=True),
                        "manufacturing_site": cells[5].get_text(strip=True),
                        "country_of_manufacture": cells[6].get_text(strip=True)
                        or "Uganda",
                        "dosage_form": cells[7].get_text(strip=True),
                        "pack_size": cells[8].get_text(strip=True),
                        "registration_date": cells[9].get_text(strip=True)
                        if len(cells) > 9
                        else "",
                    }
                else:
                    medicine = {
                        "nda_registration_number": cells[0].get_text(strip=True),
                        "license_holder": cells[1].get_text(strip=True),
                        "local_technical_representative": cells[2].get_text(strip=True),
                        "product_name": cells[3].get_text(strip=True),
                        "manufacturing_site": cells[4].get_text(strip=True),
                        "country_of_manufacture": cells[5].get_text(strip=True)
                        or "Uganda",
                        "dosage_form": cells[6].get_text(strip=True),
                        "pack_size": cells[7].get_text(strip=True),
                        "registration_date": cells[8].get_text(strip=True)
                        if len(cells) > 8
                        else "",
                    }

                medicine.update(
                    {
                        "drug_type": drug_type,
                        "generic_name": "",
                        "strength": "",
                    }
                )

                if medicine["product_name"] and medicine["nda_registration_number"]:
                    medicines.append(medicine)
                    if idx % 50 == 0:
                        print(f"  ✓ Parsed {idx} rows...")

            except Exception as e:
                print(f"⚠️  Error parsing row {idx}: {e}")
                continue

        print(f"✅ Successfully parsed {len(medicines)} {drug_type} medicines")
        return medicines

    def scrape_all_medicines(self) -> List[Dict]:
        """Scrape all medicine categories"""
        print("\n" + "=" * 60)
        print("🚀 Starting NDA Uganda Medicines Scraper")
        print("=" * 60)
        print(f"📅 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"🌐 Target: {self.base_url}")

        html = self.fetch_page(self.base_url)
        if not html:
            print("❌ Failed to fetch page content")
            return []

        soup = BeautifulSoup(html, "html.parser")
        all_medicines = []

        human_medicines = self.parse_human_medicines(soup)
        all_medicines.extend(human_medicines)

        herbal_human = self.parse_herbal_medicines(soup, "herbalHuman")
        all_medicines.extend(herbal_human)

        herbal_vet = self.parse_herbal_medicines(soup, "herbalVet")
        all_medicines.extend(herbal_vet)

        print("\n" + "=" * 60)
        print(f"✅ Total medicines scraped: {len(all_medicines)}")
        print("=" * 60)

        return all_medicines


class DatabaseHandler:
    """Handle database operations for medicines"""

    def __init__(self, company_id: int):
        self.company_id = company_id
        self.category_manager = CategoryManager(company_id)
        self.stats = {
            "total": 0,
            "success": 0,
            "duplicate": 0,
            "failed": 0,
            "errors": [],
            "categories": {},
        }

    def map_to_product_schema(self, medicine: Dict, category_id: Optional[int]) -> Dict:
        """Map NDA data to products table schema"""

        product_code = f"NDA-{medicine['nda_registration_number']}"

        description_parts = []
        if medicine.get("drug_type"):
            description_parts.append(
                f"{medicine['drug_type'].replace('_', ' ').title()} medicine"
            )
        if medicine.get("license_holder"):
            description_parts.append(f"Manufactured by {medicine['license_holder']}")
        if medicine.get("country_of_manufacture"):
            description_parts.append(f"Country: {medicine['country_of_manufacture']}")

        description = ". ".join(filter(None, description_parts))

        return {
            "company_id": self.company_id,
            "product_name": medicine["product_name"][:255],
            "generic_name": medicine.get("generic_name")[:255]
            if medicine.get("generic_name")
            else None,
            "product_code": product_code[:100],
            "nda_registration_number": medicine["nda_registration_number"][:100],
            "category_id": category_id,
            "dosage_form": medicine.get("dosage_form")[:100]
            if medicine.get("dosage_form")
            else None,
            "strength": medicine.get("strength")[:100]
            if medicine.get("strength")
            else None,
            "manufacturer": medicine.get("license_holder")[:255]
            if medicine.get("license_holder")
            else None,
            "country_of_manufacture": medicine.get("country_of_manufacture")[:100]
            or "Uganda",
            "description": description if description else None,
            "is_active": True,
            "reorder_level": 10,
            "min_order_quantity": 1,
        }

    def check_duplicate(self, nda_reg_number: str) -> bool:
        """Check if product already exists in database"""
        try:
            result = (
                supabase.table("products")
                .select("id")
                .eq("nda_registration_number", nda_reg_number)
                .eq("company_id", self.company_id)
                .execute()
            )

            return len(result.data) > 0
        except Exception as e:
            print(f"⚠️  Error checking duplicate: {e}")
            return False

    def insert_medicine(self, medicine: Dict) -> bool:
        """Insert a single medicine into database"""
        try:
            if self.check_duplicate(medicine["nda_registration_number"]):
                self.stats["duplicate"] += 1
                return False

            # Get category for this medicine
            category_id = self.category_manager.get_category_for_dosage_form(
                medicine.get("dosage_form")
            )

            # Track category usage
            if category_id:
                for cat_name, cat_id in self.category_manager.category_cache.items():
                    if cat_id == category_id:
                        self.stats["categories"][cat_name] = (
                            self.stats["categories"].get(cat_name, 0) + 1
                        )
                        break

            product_data = self.map_to_product_schema(medicine, category_id)

            result = supabase.table("products").insert(product_data).execute()

            if result.data:
                self.stats["success"] += 1
                return True
            else:
                self.stats["failed"] += 1
                self.stats["errors"].append(
                    {
                        "product": medicine["product_name"],
                        "error": "No data returned from insert",
                    }
                )
                return False

        except Exception as e:
            self.stats["failed"] += 1
            error_msg = str(e)
            self.stats["errors"].append(
                {
                    "product": medicine["product_name"],
                    "nda_number": medicine["nda_registration_number"],
                    "error": error_msg,
                }
            )
            print(f"❌ Error inserting {medicine['product_name']}: {error_msg}")
            return False

    def batch_insert_medicines(self, medicines: List[Dict]) -> Dict:
        """Insert medicines in batches with progress tracking"""
        self.stats["total"] = len(medicines)

        print("\n" + "=" * 60)
        print(f"💾 Inserting {len(medicines)} medicines into database")
        print(f"🏢 Company ID: {self.company_id}")
        print("=" * 60)

        batch_size = 50
        for i in range(0, len(medicines), batch_size):
            batch = medicines[i : i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(medicines) + batch_size - 1) // batch_size

            print(
                f"\n📦 Processing batch {batch_num}/{total_batches} ({len(batch)} medicines)..."
            )

            for medicine in batch:
                self.insert_medicine(medicine)

            progress = ((i + len(batch)) / len(medicines)) * 100
            print(
                f"✓ Progress: {progress:.1f}% | Success: {self.stats['success']} | Duplicates: {self.stats['duplicate']} | Failed: {self.stats['failed']}"
            )

            if i + batch_size < len(medicines):
                time.sleep(0.5)

        return self.stats

    def print_summary(self):
        """Print insertion summary"""
        print("\n" + "=" * 60)
        print("📊 INSERTION SUMMARY")
        print("=" * 60)
        print(f"Total medicines found:     {self.stats['total']:>6}")
        print(f"Successfully inserted:     {self.stats['success']:>6} ✅")
        print(f"Duplicates (skipped):      {self.stats['duplicate']:>6} ⏭️")
        print(f"Failed:                    {self.stats['failed']:>6} ❌")
        print("=" * 60)

        # Print category distribution
        if self.stats["categories"]:
            print("\n📂 CATEGORY DISTRIBUTION")
            print("=" * 60)
            for cat_name, count in sorted(
                self.stats["categories"].items(), key=lambda x: x[1], reverse=True
            ):
                print(f"{cat_name:.<30} {count:>6} products")
            print("=" * 60)

        if self.stats["failed"] > 0 and self.stats["errors"]:
            print("\n⚠️  ERRORS ENCOUNTERED:")
            for idx, error in enumerate(self.stats["errors"][:10], 1):
                print(f"\n{idx}. Product: {error['product']}")
                if "nda_number" in error:
                    print(f"   NDA Number: {error['nda_number']}")
                print(f"   Error: {error['error']}")

            if len(self.stats["errors"]) > 10:
                print(f"\n... and {len(self.stats['errors']) - 10} more errors")

        success_rate = (
            (self.stats["success"] / self.stats["total"] * 100)
            if self.stats["total"] > 0
            else 0
        )
        print(f"\n✨ Success Rate: {success_rate:.1f}%")


def save_backup(medicines: List[Dict], filename: Optional[str] = None):
    """Save medicines data to JSON backup file"""
    if not filename:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"nda_medicines_backup_{timestamp}.json"

    try:
        backup_data = {
            "metadata": {
                "scrape_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "total_medicines": len(medicines),
                "categories": {},
                "source": "NDA Uganda Drug Register",
                "url": "https://www.nda.or.ug/drug-register/",
            },
            "medicines": medicines,
        }

        for med in medicines:
            drug_type = med.get("drug_type", "unknown")
            backup_data["metadata"]["categories"][drug_type] = (
                backup_data["metadata"]["categories"].get(drug_type, 0) + 1
            )

        with open(filename, "w", encoding="utf-8") as f:
            json.dump(backup_data, f, indent=2, ensure_ascii=False)

        file_size = os.path.getsize(filename)
        size_mb = file_size / (1024 * 1024)

        print("\n✅ Backup saved successfully!")
        print(f"   📁 File: {filename}")
        print(f"   📊 Size: {size_mb:.2f} MB")
        print(f"   💾 Total records: {len(medicines)}")

        return filename
    except Exception as e:
        print(f"\n⚠️  Failed to save backup: {e}")
        return None


def preview_medicines(medicines: List[Dict], num_samples: int = 10):
    """Display preview of scraped medicines"""
    print("\n" + "=" * 80)
    print("📋 PREVIEW OF SCRAPED MEDICINES")
    print("=" * 80)

    drug_types = {}
    for med in medicines:
        drug_type = med.get("drug_type", "unknown")
        drug_types[drug_type] = drug_types.get(drug_type, 0) + 1

    print("\n📊 Summary by Category:")
    for drug_type, count in sorted(drug_types.items()):
        print(f"   • {drug_type.replace('_', ' ').title()}: {count} medicines")

    print(f"\n📈 Total: {len(medicines)} medicines")
    print(f"\n🔍 Sample Medicines (first {min(num_samples, len(medicines))}):")
    print("-" * 80)

    for i, med in enumerate(medicines[:num_samples], 1):
        print(f"\n{i}. {med['product_name']}")
        if med.get("generic_name"):
            print(f"   Generic: {med['generic_name']}")
        print(f"   NDA Number: {med['nda_registration_number']}")
        print(f"   Manufacturer: {med.get('license_holder', 'N/A')}")
        print(f"   Country: {med.get('country_of_manufacture', 'N/A')}")
        if med.get("dosage_form"):
            print(f"   Dosage: {med['dosage_form']}")
        if med.get("strength"):
            print(f"   Strength: {med['strength']}")

    if len(medicines) > num_samples:
        print(f"\n... and {len(medicines) - num_samples} more medicines")

    print("-" * 80)


def get_user_confirmation() -> bool:
    """Get user confirmation before proceeding"""
    print("\n" + "=" * 80)
    print("⚠️  CONFIRMATION REQUIRED")
    print("=" * 80)
    print("\nA JSON backup file has been created with all the scraped data.")
    print("You can review it before proceeding with database insertion.")
    print("\nOptions:")
    print("  [Y] Yes - Proceed with insertion into database")
    print("  [N] No  - Exit without inserting (keep JSON backup)")
    print("  [V] View - Show more sample medicines")

    while True:
        response = input("\nYour choice (Y/N/V): ").strip().upper()

        if response == "Y":
            return True
        elif response == "N":
            print("\n✋ Insertion cancelled by user.")
            print("📁 Your data is saved in the JSON backup file.")
            return False
        elif response == "V":
            return None
        else:
            print("❌ Invalid choice. Please enter Y, N, or V")


def main():
    """Main execution function"""
    start_time = time.time()

    try:
        # Step 1: Scrape NDA website
        print("\n" + "=" * 80)
        print("🌐 STEP 1: SCRAPING NDA WEBSITE")
        print("=" * 80)

        scraper = NDAScraper()
        medicines = scraper.scrape_all_medicines()

        if not medicines:
            print("\n❌ No medicines found. Exiting...")
            return 1

        # Step 2: Save backup
        print("\n" + "=" * 80)
        print("💾 STEP 2: CREATING BACKUP")
        print("=" * 80)

        backup_file = save_backup(medicines)

        if not backup_file:
            print("⚠️  Warning: Failed to create backup file")
            print("Do you want to continue without backup? (y/N): ", end="")
            if input().strip().lower() != "y":
                print("\n✋ Exiting without insertion")
                return 1

        # Step 3: Preview data
        print("\n" + "=" * 80)
        print("👀 STEP 3: DATA PREVIEW")
        print("=" * 80)

        sample_count = 10
        while True:
            preview_medicines(medicines, num_samples=sample_count)

            print(f"\n📄 Full data saved in: {backup_file}")
            print("💡 You can open this JSON file to review all medicines")

            confirmation = get_user_confirmation()

            if confirmation is True:
                break
            elif confirmation is False:
                return 0
            else:
                sample_count = min(sample_count + 10, len(medicines))
                print(f"\n📋 Showing {sample_count} samples...")
                continue

        # Step 4: Initialize categories
        print("\n" + "=" * 80)
        print("🏷️  STEP 4: INITIALIZING CATEGORIES")
        print("=" * 80)

        db_handler = DatabaseHandler(COMPANY_ID)
        if not db_handler.category_manager.initialize_categories():
            print("❌ Failed to initialize categories")
            return 1

        # Step 5: Insert into database
        print("\n" + "=" * 80)
        print("💾 STEP 5: INSERTING INTO DATABASE")
        print("=" * 80)
        print("\n🚀 Starting insertion process...")

        stats = db_handler.batch_insert_medicines(medicines)

        # Step 6: Print summary
        db_handler.print_summary()

        elapsed_time = time.time() - start_time
        print(f"\n⏱️  Total execution time: {elapsed_time:.2f} seconds")
        print(f"📅 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        if backup_file:
            print(f"📁 Backup file: {backup_file}")

        print("\n✅ Script completed successfully!")
        print("\n💡 Next steps:")
        print("   1. Verify data in Supabase dashboard")
        print("   2. Set prices for imported medicines")
        print("   3. Assign units to products")

        return 0

    except KeyboardInterrupt:
        print("\n\n⚠️  Script interrupted by user")
        return 130

    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())

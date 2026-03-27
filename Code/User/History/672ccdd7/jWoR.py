"""
NDA Uganda Drug Register scraper.

Scrapes human, herbal-human, and herbal-vet medicines and inserts them into
the products table for the configured COMPANY_ID.

Uses the shared CATEGORY_MAPPINGS from config and the Supabase client from
src.utils — no duplicated credentials or constants.
"""
from __future__ import annotations

import json
import time
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from config import NDA_BASE_URL, CATEGORY_MAPPINGS, DEFAULT_COMPANY_ID
from src.utils import get_client, log_ok, log_warn, log_error, log_info, log_section


# ── Category manager ──────────────────────────────────────────────────────────

class CategoryManager:
    """Resolves dosage form strings to DB category IDs. Creates missing categories."""

    def __init__(self, company_id: int) -> None:
        self.company_id = company_id
        self._cache: dict[str, int] = {}

    def initialize(self) -> bool:
        """Ensure all 8 categories exist in DB; populate cache."""
        log_section("Initialising categories")
        client = get_client()
        try:
            for cat_name, info in CATEGORY_MAPPINGS.items():
                result = (
                    client.table("categories")
                    .select("id")
                    .eq("company_id", self.company_id)
                    .eq("category_code", info["code"])
                    .execute()
                )
                if result.data:
                    self._cache[cat_name] = result.data[0]["id"]
                    log_info(f"  Found: {cat_name}")
                else:
                    row = {
                        "company_id":    self.company_id,
                        "category_name": cat_name,
                        "category_code": info["code"],
                        "description":   info["description"],
                        "is_active":     True,
                        "sort_order":    list(CATEGORY_MAPPINGS).index(cat_name) + 1,
                    }
                    inserted = client.table("categories").insert(row).execute()
                    if inserted.data:
                        self._cache[cat_name] = inserted.data[0]["id"]
                        log_ok(f"  Created: {cat_name}")
                    else:
                        log_warn(f"  Could not create: {cat_name}")
            log_ok(f"Categories ready ({len(self._cache)}).")
            return True
        except Exception as e:
            log_error(f"Category init failed: {e}")
            return False

    def category_for(self, dosage_form: str | None) -> int | None:
        """Map a dosage form string to a category ID, defaulting to SUNDRIES."""
        if dosage_form:
            dl = dosage_form.lower()
            for cat_name, info in CATEGORY_MAPPINGS.items():
                if any(kw in dl for kw in info["keywords"]):
                    return self._cache.get(cat_name)
        return self._cache.get("SUNDRIES")


# ── HTTP scraper ──────────────────────────────────────────────────────────────

class NDAScraper:
    """Fetches and parses the NDA Uganda drug register."""

    _HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update(self._HEADERS)

    def _fetch(self, url: str) -> str | None:
        for attempt in range(1, 4):
            try:
                log_info(f"Fetching NDA website (attempt {attempt}/3)…")
                r = self.session.get(url, timeout=30)
                r.raise_for_status()
                log_ok("Page fetched.")
                return r.text
            except requests.RequestException as e:
                log_warn(f"  Attempt {attempt} failed: {e}")
                if attempt < 3:
                    time.sleep(2 ** attempt)
        log_error("Could not fetch page after 3 attempts.")
        return None

    def _parse_human(self, soup: BeautifulSoup) -> list[dict]:
        medicines: list[dict] = []
        tab = soup.find("div", {"id": "1539148991734-31a96a97-315e"})
        if not tab:
            log_warn("Human medicines tab not found.")
            return medicines
        tbody = tab.find("tbody")
        if not tbody:
            return medicines
        for idx, row in enumerate(tbody.find_all("tr"), 1):
            cells = row.find_all("td")
            if len(cells) < 11:
                continue
            try:
                med = {
                    "nda_registration_number":       cells[1].get_text(strip=True),
                    "license_holder":                cells[2].get_text(strip=True),
                    "local_technical_representative":cells[3].get_text(strip=True),
                    "product_name":                  cells[4].get_text(strip=True),
                    "generic_name":                  cells[5].get_text(strip=True),
                    "strength":                      cells[6].get_text(strip=True),
                    "manufacturing_site":             cells[7].get_text(strip=True),
                    "country_of_manufacture":         cells[8].get_text(strip=True) or "Uganda",
                    "dosage_form":                   cells[9].get_text(strip=True),
                    "pack_size":                     cells[10].get_text(strip=True),
                    "registration_date":             cells[11].get_text(strip=True) if len(cells) > 11 else "",
                    "drug_type":                     "human",
                }
                if med["product_name"] and med["nda_registration_number"]:
                    medicines.append(med)
                    if idx % 100 == 0:
                        log_info(f"  Parsed {idx} human rows…")
            except Exception as e:
                log_warn(f"  Row {idx}: {e}")
        log_ok(f"Human medicines: {len(medicines)}")
        return medicines

    def _parse_herbal(self, soup: BeautifulSoup, drug_type: str) -> list[dict]:
        tab_ids = {
            "herbalHuman": "1539148778865-e150cba2-d14d",
            "herbalVet":   "1539148778905-ff522642-6acd",
        }
        tab = soup.find("div", {"id": tab_ids.get(drug_type, "")})
        if not tab:
            log_warn(f"{drug_type} tab not found.")
            return []
        tbody = tab.find("tbody")
        if not tbody:
            return []
        medicines: list[dict] = []
        for idx, row in enumerate(tbody.find_all("tr"), 1):
            cells = row.find_all("td")
            if len(cells) < 8:
                continue
            try:
                if drug_type == "herbalHuman":
                    med = {
                        "nda_registration_number":        cells[1].get_text(strip=True),
                        "license_holder":                 cells[2].get_text(strip=True),
                        "local_technical_representative": cells[3].get_text(strip=True),
                        "product_name":                   cells[4].get_text(strip=True),
                        "manufacturing_site":              cells[5].get_text(strip=True),
                        "country_of_manufacture":          cells[6].get_text(strip=True) or "Uganda",
                        "dosage_form":                    cells[7].get_text(strip=True),
                        "pack_size":                      cells[8].get_text(strip=True) if len(cells) > 8 else "",
                        "registration_date":              cells[9].get_text(strip=True) if len(cells) > 9 else "",
                    }
                else:
                    med = {
                        "nda_registration_number":        cells[0].get_text(strip=True),
                        "license_holder":                 cells[1].get_text(strip=True),
                        "local_technical_representative": cells[2].get_text(strip=True),
                        "product_name":                   cells[3].get_text(strip=True),
                        "manufacturing_site":              cells[4].get_text(strip=True),
                        "country_of_manufacture":          cells[5].get_text(strip=True) or "Uganda",
                        "dosage_form":                    cells[6].get_text(strip=True),
                        "pack_size":                      cells[7].get_text(strip=True),
                        "registration_date":              cells[8].get_text(strip=True) if len(cells) > 8 else "",
                    }
                med.update({"drug_type": drug_type, "generic_name": "", "strength": ""})
                if med["product_name"] and med["nda_registration_number"]:
                    medicines.append(med)
            except Exception as e:
                log_warn(f"  Row {idx}: {e}")
        log_ok(f"{drug_type}: {len(medicines)}")
        return medicines

    def scrape(self) -> list[dict]:
        log_section("NDA Uganda Medicines Scraper")
        log_info(f"Target: {NDA_BASE_URL}")
        html = self._fetch(NDA_BASE_URL)
        if not html:
            return []
        soup = BeautifulSoup(html, "html.parser")
        all_meds = (
            self._parse_human(soup)
            + self._parse_herbal(soup, "herbalHuman")
            + self._parse_herbal(soup, "herbalVet")
        )
        log_ok(f"Total scraped: {len(all_meds)}")
        return all_meds


# ── Database handler ──────────────────────────────────────────────────────────

class DatabaseHandler:
    """Inserts scraped medicines into the products table."""

    def __init__(self, company_id: int) -> None:
        self.company_id = company_id
        self.cat_mgr    = CategoryManager(company_id)
        self.stats = {"total": 0, "success": 0, "duplicate": 0, "failed": 0, "errors": [], "categories": {}}

    @staticmethod
    def _map(medicine: dict, category_id: int | None, company_id: int) -> dict:
        parts = filter(None, [
            medicine.get("drug_type", "").replace("_", " ").title() + " medicine" if medicine.get("drug_type") else None,
            f"Manufactured by {medicine['license_holder']}" if medicine.get("license_holder") else None,
            f"Country: {medicine.get('country_of_manufacture','')}" if medicine.get("country_of_manufacture") else None,
        ])
        return {
            "company_id":               company_id,
            "product_name":             medicine["product_name"][:255],
            "generic_name":             medicine.get("generic_name", "")[:255] or None,
            "product_code":             f"NDA-{medicine['nda_registration_number']}"[:100],
            "nda_registration_number":  medicine["nda_registration_number"][:100],
            "category_id":              category_id,
            "dosage_form":              (medicine.get("dosage_form") or "")[:100] or None,
            "strength":                 (medicine.get("strength") or "")[:100] or None,
            "manufacturer":             (medicine.get("license_holder") or "")[:255] or None,
            "country_of_manufacture":   (medicine.get("country_of_manufacture") or "Uganda")[:100],
            "description":              ". ".join(parts) or None,
            "is_active":                True,
            "reorder_level":            10,
            "min_order_quantity":       1,
        }

    def _is_duplicate(self, nda_num: str) -> bool:
        try:
            r = (
                get_client()
                .table("products")
                .select("id")
                .eq("nda_registration_number", nda_num)
                .eq("company_id", self.company_id)
                .execute()
            )
            return bool(r.data)
        except Exception:
            return False

    def _insert_one(self, med: dict) -> bool:
        if self._is_duplicate(med["nda_registration_number"]):
            self.stats["duplicate"] += 1
            return False
        cat_id = self.cat_mgr.category_for(med.get("dosage_form"))
        if cat_id:
            for name, cid in self.cat_mgr._cache.items():
                if cid == cat_id:
                    self.stats["categories"][name] = self.stats["categories"].get(name, 0) + 1
                    break
        try:
            result = get_client().table("products").insert(self._map(med, cat_id, self.company_id)).execute()
            if result.data:
                self.stats["success"] += 1
                return True
        except Exception as e:
            self.stats["errors"].append({"product": med["product_name"], "error": str(e)})
        self.stats["failed"] += 1
        return False

    def batch_insert(self, medicines: list[dict]) -> dict:
        self.stats["total"] = len(medicines)
        log_section(f"Inserting {len(medicines)} medicines  (company_id={self.company_id})")
        for i in range(0, len(medicines), 50):
            batch = medicines[i:i + 50]
            bnum  = i // 50 + 1
            total_batches = (len(medicines) + 49) // 50
            log_info(f"Batch {bnum}/{total_batches} ({len(batch)} items)…")
            for med in batch:
                self._insert_one(med)
            pct = min(100, (i + len(batch)) / len(medicines) * 100)
            log_info(f"  {pct:.0f}%  ✔{self.stats['success']}  dup={self.stats['duplicate']}  ✘{self.stats['failed']}")
            if i + 50 < len(medicines):
                time.sleep(0.4)
        return self.stats

    def print_summary(self) -> None:
        s = self.stats
        log_section("Insertion Summary")
        log_info(f"Total medicines found : {s['total']}")
        log_ok  (f"Inserted             : {s['success']}")
        log_info(f"Duplicates skipped   : {s['duplicate']}")
        log_warn(f"Failed               : {s['failed']}") if s["failed"] else None
        if s["categories"]:
            print()
            log_info("Category distribution:")
            for cat, cnt in sorted(s["categories"].items(), key=lambda x: -x[1]):
                log_info(f"  {cat:<20} {cnt}")
        if s["errors"]:
            print()
            log_warn(f"First {min(5, len(s['errors']))} errors:")
            for e in s["errors"][:5]:
                log_warn(f"  {e['product']}: {e['error']}")


# ── Backup helpers ────────────────────────────────────────────────────────────

def save_backup(medicines: list[dict], filename: str | None = None) -> str | None:
    if not filename:
        filename = f"nda_medicines_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    try:
        payload = {
            "metadata": {
                "scrape_date":      datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "total_medicines":  len(medicines),
                "source":           "NDA Uganda Drug Register",
                "url":              NDA_BASE_URL,
                "categories":       {},
            },
            "medicines": medicines,
        }
        for med in medicines:
            dt = med.get("drug_type", "unknown")
            payload["metadata"]["categories"][dt] = payload["metadata"]["categories"].get(dt, 0) + 1

        with open(filename, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)

        size_mb = __import__("os").path.getsize(filename) / 1_048_576
        log_ok(f"Backup saved: {filename}  ({size_mb:.2f} MB, {len(medicines)} records)")
        return filename
    except Exception as e:
        log_warn(f"Failed to save backup: {e}")
        return None


def preview_medicines(medicines: list[dict], n: int = 10) -> None:
    log_section(f"Preview – first {min(n, len(medicines))} medicines")
    types: dict[str, int] = {}
    for m in medicines:
        t = m.get("drug_type", "unknown")
        types[t] = types.get(t, 0) + 1
    for t, cnt in sorted(types.items()):
        log_info(f"  {t.replace('_',' ').title()}: {cnt}")
    print()
    for i, med in enumerate(medicines[:n], 1):
        print(f"  {i}. {med['product_name']}")
        if med.get("generic_name"):
            print(f"     Generic: {med['generic_name']}")
        print(f"     NDA: {med['nda_registration_number']}  |  {med.get('dosage_form','')}")


# ── Main entry point ──────────────────────────────────────────────────────────

def main(company_id: int | None = None) -> int:
    c_id = company_id or DEFAULT_COMPANY_ID
    t0   = time.time()

    # Step 1: Scrape
    scraper   = NDAScraper()
    medicines = scraper.scrape()
    if not medicines:
        log_error("No medicines scraped.")
        return 1

    # Step 2: Backup
    backup_file = save_backup(medicines)
    if not backup_file:
        log_warn("Backup failed.")
        yn = input("Continue without backup? [y/N]: ").strip().lower()
        if yn != "y":
            return 1

    # Step 3: Preview + confirm
    sample = 10
    while True:
        preview_medicines(medicines, sample)
        print(f"\n  Full data: {backup_file}")
        print("  [Y] Insert into DB   [N] Exit   [V] More samples")
        ans = input("  Choice: ").strip().upper()
        if ans == "Y":
            break
        if ans == "N":
            log_info("Exiting without insert.")
            return 0
        sample = min(sample + 10, len(medicines))

    # Step 4: Categories
    handler = DatabaseHandler(c_id)
    if not handler.cat_mgr.initialize():
        log_error("Category init failed.")
        return 1

    # Step 5: Insert
    handler.batch_insert(medicines)

    # Step 6: Summary
    handler.print_summary()
    log_info(f"Total time: {time.time() - t0:.1f}s")
    return 0
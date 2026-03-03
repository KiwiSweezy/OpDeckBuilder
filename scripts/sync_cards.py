"""
Reads all JSON files in raw_data/ and merges them into a single
normalized cards.json for the app to consume.

Skips duplicate card IDs (first occurrence wins).
Handles both the old raw_data format and the new scraper format.

Usage:
    python scripts/sync_cards.py           # merge all raw_data into cards.json
    python scripts/sync_cards.py --fresh   # rebuild from scratch (ignores existing cards.json)
"""

import json
import sys
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "src" / "data"
OUTPUT_FILE = OUTPUT_DIR / "cards.json"
RAW_DATA_DIR = Path(__file__).resolve().parent.parent / "raw_data"


def normalize_card(card: dict) -> dict:
    """Convert a raw card entry into the normalized format used by the app."""
    return {
        "id": card["id"],
        "name": card["name"],
        "cost": int(card["cost"]) if card.get("cost") and str(card["cost"]) != "-" else 0,
        "type": card["type"].lower(),
        "rarity": card["rarity"].lower(),
        "color": card["color"].lower(),
        "trigger": card.get("trigger", "") != "",
        "images": card["images"],
        "attribute": card["attribute"].get("name", "") if isinstance(card.get("attribute"), dict) else str(card.get("attribute", "")),
        "power": int(card["power"]) if card.get("power") and str(card["power"]) != "-" else 0,
        "counter": int(card["counter"]) if card.get("counter") and str(card["counter"]) != "-" else 0,
        "family": card.get("family", ""),
    }


def main():
    fresh = "--fresh" in sys.argv

    # Load existing master list (unless --fresh)
    if not fresh and OUTPUT_FILE.exists() and OUTPUT_FILE.stat().st_size > 0:
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            master_list = json.load(f)
        print(f"Loaded {len(master_list)} existing cards from cards.json")
    else:
        master_list = []
        print("Starting fresh (empty master list)")

    # Track existing IDs for dedup
    existing_ids = {card["id"] for card in master_list}

    # Process all JSON files in raw_data/
    raw_files = sorted(RAW_DATA_DIR.glob("*.json"))
    print(f"Found {len(raw_files)} raw data files\n")

    added_total = 0
    skipped_total = 0

    for raw_file in raw_files:
        with open(raw_file, "r", encoding="utf-8") as f:
            card_list = json.load(f)

        added = 0
        skipped = 0

        for card in card_list:
            normalized = normalize_card(card)
            if normalized["id"] in existing_ids:
                skipped += 1
            else:
                master_list.append(normalized)
                existing_ids.add(normalized["id"])
                added += 1

        print(f"  {raw_file.name}: +{added} added, {skipped} dupes skipped")
        added_total += added
        skipped_total += skipped

    # Write output
    OUTPUT_DIR.mkdir(exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(master_list, f, indent=4, ensure_ascii=False)

    print(f"\nDone! {added_total} new cards added, {skipped_total} dupes skipped.")
    print(f"Total cards in cards.json: {len(master_list)}")


if __name__ == "__main__":
    main()

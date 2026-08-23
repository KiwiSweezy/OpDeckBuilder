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
import re
import sys
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "src" / "data"
OUTPUT_FILE = OUTPUT_DIR / "cards.json"
RAW_DATA_DIR = Path(__file__).resolve().parent.parent / "raw_data"


def parse_set_code(card: dict) -> str:
    """Work out which PRODUCT a card was printed in, e.g. "ST31", "OP17", "PRB02".

    Can't just read the ID prefix: reprint-heavy products (the ST31-ST36 starter
    decks, PRB boosters) reprint older cards under their ORIGINAL ID with an
    _r1/_p2 suffix, so ST31's Nami is "OP01-016_p9". Bandai puts the real product
    in the set name, bracketed - "STARTER DECK -RED Monkey.D.Luffy- [ST-31]".

    Products spanning two codes ("[OP15-EB04]") list both; we pick whichever
    matches the card's own ID prefix. Falls back to the ID prefix when the set
    name has no bracketed code at all (most promos).
    """
    raw = card.get("set")
    set_name = raw.get("name", "") if isinstance(raw, dict) else str(raw or "")
    prefix = card["id"].split("-")[0].upper()

    bracket = re.search(r"\[([^\]]+)\]", set_name)
    if not bracket:
        return prefix
    codes = [c.replace("-", "") for c in
             re.findall(r"[A-Z]+-?\d+", bracket.group(1).replace(" ", "").upper())]
    if not codes:
        return prefix
    return prefix if prefix in codes else codes[0]


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
        "ability": card.get("ability", ""),
        "set": parse_set_code(card),
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

    # Track existing cards for dedup (and for backfilling fields added later)
    existing_by_id = {card["id"]: card for card in master_list}
    existing_ids = set(existing_by_id)

    # Process all JSON files in raw_data/
    raw_files = sorted(RAW_DATA_DIR.glob("*.json"))
    print(f"Found {len(raw_files)} raw data files\n")

    added_total = 0
    skipped_total = 0
    backfilled = 0

    for raw_file in raw_files:
        with open(raw_file, "r", encoding="utf-8") as f:
            card_list = json.load(f)

        added = 0
        skipped = 0

        for card in card_list:
            normalized = normalize_card(card)
            if normalized["id"] in existing_ids:
                # Already present, but may predate a field added since — backfill it
                # rather than skipping outright, so a plain re-sync stays complete
                # without needing --fresh (which would reshuffle the card order).
                current = existing_by_id[normalized["id"]]
                for field in ("set",):
                    if not current.get(field):
                        current[field] = normalized[field]
                        backfilled += 1
                skipped += 1
            else:
                master_list.append(normalized)
                existing_by_id[normalized["id"]] = normalized
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
    if backfilled:
        print(f"Backfilled {backfilled} missing fields on existing cards.")
    print(f"Total cards in cards.json: {len(master_list)}")


if __name__ == "__main__":
    main()

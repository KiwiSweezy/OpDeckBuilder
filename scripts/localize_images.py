"""
Rewrites image URLs in src/data/cards.json to point to local WebP files.

Before running this, run download_images.py to download and convert the images.

Usage:
    python scripts/localize_images.py                      # use /images/cards/ prefix
    python scripts/localize_images.py --base-url https://cdn.example.com/cards  # use CDN
"""

import json
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
CARDS_JSON = ROOT / "src" / "data" / "cards.json"
IMAGES_DIR = ROOT / "public" / "images" / "cards"
DEFAULT_BASE = "/images/cards"


def main():
    # Parse optional --base-url argument
    base_url = DEFAULT_BASE
    if "--base-url" in sys.argv:
        idx = sys.argv.index("--base-url")
        if idx + 1 < len(sys.argv):
            base_url = sys.argv[idx + 1].rstrip("/")

    with open(CARDS_JSON, "r", encoding="utf-8") as f:
        cards = json.load(f)

    updated = 0
    missing = 0

    for card in cards:
        url = card["images"]["small"]
        if not url or not url.startswith("http"):
            continue

        # Derive the local filename stem from the URL
        raw_filename = urlparse(url).path.split("/")[-1]
        stem = raw_filename.rsplit(".", 1)[0]
        local_webp = IMAGES_DIR / f"{stem}.webp"

        if not local_webp.exists():
            missing += 1
            print(f"  WARNING: Missing local image for {card['id']}: {stem}.webp")
            continue

        local_path = f"{base_url}/{stem}.webp"
        card["images"]["small"] = local_path
        card["images"]["large"] = local_path
        updated += 1

    with open(CARDS_JSON, "w", encoding="utf-8") as f:
        json.dump(cards, f, indent=4, ensure_ascii=False)

    print(f"Updated {updated} cards. Missing images: {missing}")
    if missing > 0:
        print("Run download_images.py first to download missing images.")


if __name__ == "__main__":
    main()

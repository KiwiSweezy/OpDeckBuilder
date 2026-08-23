"""
Rewrites image URLs in src/data/cards.json to point to local WebP files.

Two tiers, because the card pool renders 150px tiles but the proxy printer and
the big preview need full resolution:
    images.small -> /images/thumbs/  (300w, ~25KB)  built by make_thumbs.py
    images.large -> /images/cards/   (600w, ~124KB) built by download_images.py

Run download_images.py and then make_thumbs.py before this.

Usage:
    python scripts/localize_images.py                      # use local /images/ paths
    python scripts/localize_images.py --base-url https://cdn.example.com  # use a CDN
"""

import json
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
CARDS_JSON = ROOT / "src" / "data" / "cards.json"
IMAGES_DIR = ROOT / "public" / "images" / "cards"
THUMBS_DIR = ROOT / "public" / "images" / "thumbs"
DEFAULT_BASE = "/images"


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
    missing_full = 0
    missing_thumb = 0

    for card in cards:
        # The stem is always the card id, but derive it from whichever URL is
        # currently set so this stays re-runnable against remote or local paths.
        url = card["images"]["large"] or card["images"]["small"]
        if not url:
            continue
        stem = urlparse(url).path.split("/")[-1].rsplit(".", 1)[0]

        if not (IMAGES_DIR / f"{stem}.webp").exists():
            missing_full += 1
            print(f"  WARNING: missing full image for {card['id']}: {stem}.webp")
            continue

        card["images"]["large"] = f"{base_url}/cards/{stem}.webp"
        # Fall back to the full image when a thumbnail hasn't been built yet,
        # so a partial thumbs/ directory degrades instead of breaking the grid.
        if (THUMBS_DIR / f"{stem}.webp").exists():
            card["images"]["small"] = f"{base_url}/thumbs/{stem}.webp"
        else:
            missing_thumb += 1
            card["images"]["small"] = f"{base_url}/cards/{stem}.webp"
        updated += 1

    with open(CARDS_JSON, "w", encoding="utf-8") as f:
        json.dump(cards, f, indent=4, ensure_ascii=False)

    print(f"Updated {updated} cards.")
    if missing_full:
        print(f"Missing full images: {missing_full} — run download_images.py")
    if missing_thumb:
        print(f"Missing thumbnails: {missing_thumb} — run make_thumbs.py")


if __name__ == "__main__":
    main()

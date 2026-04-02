"""
Downloads all card images from Bandai's servers and converts them to WebP.

Reads src/data/cards.json, downloads each unique image, converts to WebP,
and saves to public/images/cards/.

Usage:
    python scripts/download_images.py              # download all missing images
    python scripts/download_images.py --force      # re-download everything
"""

import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CARDS_JSON = ROOT / "src" / "data" / "cards.json"
OUTPUT_DIR = ROOT / "public" / "images" / "cards"

WEBP_QUALITY = 75
MAX_WIDTH = 200
MAX_WORKERS = 8
REQUEST_TIMEOUT = 15

# Bandai sometimes blocks without a browser-like User-Agent
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    )
}


def get_unique_images(cards: list[dict]) -> dict[str, str]:
    """Return {filename_stem: url} for every unique image in cards.json."""
    images = {}
    for card in cards:
        url = card["images"]["small"]
        if not url or not url.startswith("http"):
            continue
        # Extract filename without extension or query params
        # e.g. "OP01-001.png?240831" -> "OP01-001"
        raw_filename = urlparse(url).path.split("/")[-1]
        stem = raw_filename.rsplit(".", 1)[0]
        images[stem] = url
    return images


def download_and_convert(stem: str, url: str, force: bool = False) -> str:
    """Download a single image and convert to WebP. Returns status message."""
    out_path = OUTPUT_DIR / f"{stem}.webp"

    if out_path.exists() and not force:
        return f"SKIP {stem} (already exists)"

    try:
        resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()

        img = Image.open(BytesIO(resp.content))
        img = img.convert("RGBA") if img.mode == "RGBA" else img.convert("RGB")

        # Resize to MAX_WIDTH while preserving aspect ratio
        if img.width > MAX_WIDTH:
            ratio = MAX_WIDTH / img.width
            new_height = int(img.height * ratio)
            img = img.resize((MAX_WIDTH, new_height), Image.LANCZOS)

        img.save(out_path, "WEBP", quality=WEBP_QUALITY)

        return f"OK   {stem}"
    except Exception as e:
        return f"FAIL {stem}: {e}"


def main():
    force = "--force" in sys.argv

    # Load cards
    with open(CARDS_JSON, "r", encoding="utf-8") as f:
        cards = json.load(f)

    images = get_unique_images(cards)
    print(f"Found {len(images)} unique images in cards.json")

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Download with thread pool
    completed = 0
    failed = 0
    skipped = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {
            pool.submit(download_and_convert, stem, url, force): stem
            for stem, url in images.items()
        }

        for future in as_completed(futures):
            result = future.result()
            if result.startswith("OK"):
                completed += 1
            elif result.startswith("SKIP"):
                skipped += 1
            else:
                failed += 1
                print(f"  {result}")

            total_done = completed + failed + skipped
            if total_done % 100 == 0 or total_done == len(images):
                print(f"  Progress: {total_done}/{len(images)} "
                      f"(downloaded: {completed}, skipped: {skipped}, failed: {failed})")

    print(f"\nDone! Downloaded: {completed}, Skipped: {skipped}, Failed: {failed}")

    if failed > 0:
        print("Re-run the script to retry failed downloads.")


if __name__ == "__main__":
    main()

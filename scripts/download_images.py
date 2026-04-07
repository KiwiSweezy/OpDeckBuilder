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

# LimitlessTCG hosts OPTCG card images on a Digital Ocean Spaces CDN.
# URL format: https://.../one-piece/{SET}/{CARD-ID}_EN.webp
# where SET is the set code (OP15, EB04, ST26, PRB02, etc.)
LIMITLESS_BASE = "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/one-piece"
BANDAI_IMAGE_BASE = "https://en.onepiece-cardgame.com/images/cardlist/card/"

WEBP_QUALITY = 85
MAX_WIDTH = 600
MAX_WORKERS = 8
REQUEST_TIMEOUT = 15

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    )
}


def get_unique_images(cards: list[dict]) -> dict[str, str]:
    """Return {filename_stem: limitless_url} for every unique card.

    The set code is parsed from the card ID (everything before the first dash).
    e.g. "OP15-003_p1" -> set "OP15", URL ".../one-piece/OP15/OP15-003_p1_EN.webp"
    """
    images = {}
    for card in cards:
        url = card["images"]["small"]
        if not url:
            continue
        # Filename stem from current URL (works for both remote + localized)
        raw_filename = urlparse(url).path.split("/")[-1]
        stem = raw_filename.rsplit(".", 1)[0]
        # Set code = everything before the first dash in the card ID
        if "-" not in stem:
            continue
        set_code = stem.split("-", 1)[0]
        images[stem] = f"{LIMITLESS_BASE}/{set_code}/{stem}_EN.webp"
    return images


def _fetch_and_save(url: str, out_path: Path) -> None:
    """Download a single image, resize, and save as WebP. Raises on failure."""
    resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()

    img = Image.open(BytesIO(resp.content))
    img = img.convert("RGBA") if img.mode == "RGBA" else img.convert("RGB")

    if img.width > MAX_WIDTH:
        ratio = MAX_WIDTH / img.width
        new_height = int(img.height * ratio)
        img = img.resize((MAX_WIDTH, new_height), Image.LANCZOS)

    img.save(out_path, "WEBP", quality=WEBP_QUALITY)


def download_and_convert(stem: str, url: str, force: bool = False) -> str:
    """Download an image with limitless → Bandai fallback for missing prints."""
    out_path = OUTPUT_DIR / f"{stem}.webp"

    if out_path.exists() and not force:
        return f"SKIP {stem} (already exists)"

    # Try limitless first
    try:
        _fetch_and_save(url, out_path)
        return f"OK   {stem}"
    except Exception as limitless_err:
        # Fall back to Bandai for cards limitless doesn't host (e.g. _r1/_r2 reprints)
        bandai_url = f"{BANDAI_IMAGE_BASE}{stem}.png"
        try:
            _fetch_and_save(bandai_url, out_path)
            return f"OK   {stem} (bandai fallback)"
        except Exception as bandai_err:
            return f"FAIL {stem}: limitless={limitless_err} bandai={bandai_err}"


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

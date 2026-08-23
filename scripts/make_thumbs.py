"""
Generates the grid/thumbnail tier of card images.

The card pool renders tiles at 150 CSS px but ships the full 600x838 print
image (~124KB) for every one of them — a 4x linear downscale, and ~5.7MB of
image bytes for a single 50-card filter batch. This produces a 300w tier
(exactly 150px at 2x DPR) at ~26KB, cutting that batch to ~1.3MB.

Full-size images stay in public/images/cards/ — the proxy printer and the
large card preview still need them.

Usage:
    python scripts/make_thumbs.py              # generate missing thumbnails
    python scripts/make_thumbs.py --force      # rebuild everything
"""

import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "public" / "images" / "cards"
OUT_DIR = ROOT / "public" / "images" / "thumbs"

# 150 CSS px tile at 2x DPR. Quality 72 / method 6 was verified visually
# indistinguishable from the source at display size.
THUMB_WIDTH = 300
QUALITY = 72
METHOD = 6


def make_one(args: tuple[str, bool]) -> tuple[str, str, int]:
    """Resize a single card image. Returns (stem, status, bytes_written)."""
    name, force = args
    src = SRC_DIR / name
    out = OUT_DIR / name

    if out.exists() and not force:
        return (name, "skip", out.stat().st_size)
    try:
        with Image.open(src) as im:
            im = im.convert("RGB")
            height = round(im.height * THUMB_WIDTH / im.width)
            im.resize((THUMB_WIDTH, height), Image.LANCZOS).save(
                out, "WEBP", quality=QUALITY, method=METHOD
            )
        return (name, "ok", out.stat().st_size)
    except Exception as exc:  # noqa: BLE001 - reported, not raised, so one bad file can't abort the run
        return (name, f"FAIL {exc}", 0)


def main() -> None:
    force = "--force" in sys.argv
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    names = sorted(p.name for p in SRC_DIR.glob("*.webp"))
    if not names:
        print(f"No source images in {SRC_DIR}")
        return
    print(f"{len(names)} source images -> {THUMB_WIDTH}w q{QUALITY} thumbnails")

    done = skipped = failed = 0
    written = 0
    with ProcessPoolExecutor() as pool:
        futures = [pool.submit(make_one, (n, force)) for n in names]
        for i, fut in enumerate(as_completed(futures), 1):
            name, status, size = fut.result()
            if status == "ok":
                done += 1
                written += size
            elif status == "skip":
                skipped += 1
            else:
                failed += 1
                print(f"  {name}: {status}")
            if i % 500 == 0 or i == len(names):
                print(f"  {i}/{len(names)} (built {done}, skipped {skipped}, failed {failed})")

    total = sum(p.stat().st_size for p in OUT_DIR.glob("*.webp"))
    src_total = sum(p.stat().st_size for p in SRC_DIR.glob("*.webp"))
    print(f"\nBuilt {done}, skipped {skipped}, failed {failed}")
    print(f"thumbs: {total / 1048576:.0f} MB   full: {src_total / 1048576:.0f} MB")
    if total:
        print(f"average thumbnail: {total / max(len(list(OUT_DIR.glob('*.webp'))), 1) / 1024:.1f} KB "
              f"({(1 - total / src_total) * 100:.0f}% smaller than full size)")
    print("\nNow run localize_images.py to point cards.json at the new tier.")


if __name__ == "__main__":
    main()

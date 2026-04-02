"""
Scrapes card data from the official Bandai One Piece TCG card list.
https://en.onepiece-cardgame.com/cardlist/

Outputs one JSON file per set into raw_data/, matching the format
that sync_cards.py expects. Then run sync_cards.py to merge into cards.json.

Usage:
    python scripts/scrape_bandai.py              # scrape ALL sets
    python scripts/scrape_bandai.py OP13 OP14    # scrape specific sets
"""

import json
import re
import sys
import time
from pathlib import Path
import requests
from bs4 import BeautifulSoup

BASE_URL = "https://en.onepiece-cardgame.com/cardlist/"
IMAGE_BASE = "https://en.onepiece-cardgame.com/images/cardlist/card/"

# Series ID mapping: key = short name, value = Bandai series query param
SERIES_IDS = {
    # Booster packs
    "OP01": "569101", "OP02": "569102", "OP03": "569103", "OP04": "569104",
    "OP05": "569105", "OP06": "569106", "OP07": "569107", "OP08": "569108",
    "OP09": "569109", "OP10": "569110", "OP11": "569111", "OP12": "569112",
    "OP13": "569113", "OP14-EB04": "569114", "OP15": "569115",
    # Extra boosters
    "EB01": "569201", "EB02": "569202", "EB03": "569203",
    # Premium boosters
    "PRB01": "569301", "PRB02": "569302",
    # Starter decks
    "ST01": "569001", "ST02": "569002", "ST03": "569003", "ST04": "569004",
    "ST05": "569005", "ST06": "569006", "ST07": "569007", "ST08": "569008",
    "ST09": "569009", "ST10": "569010", "ST11": "569011", "ST12": "569012",
    "ST13": "569013", "ST14": "569014", "ST15": "569015", "ST16": "569016",
    "ST17": "569017", "ST18": "569018", "ST19": "569019", "ST20": "569020",
    "ST21": "569021", "ST22": "569022", "ST23": "569023", "ST24": "569024",
    "ST25": "569025", "ST26": "569026", "ST27": "569027", "ST28": "569028",
    "ST29": "569029",
    # Promo & other
    "PROMO": "569901", "OTHER": "569801",
}

RAW_DATA_DIR = Path(__file__).resolve().parent.parent / "raw_data"


def extract_text(element, selector: str) -> str:
    """Extract text from a child element, stripping the h3 label."""
    el = element.select_one(selector)
    if not el:
        return ""
    # Remove the h3 header tag to get just the value
    h3 = el.find("h3")
    if h3:
        h3.decompose()
    return el.get_text(strip=True)


def parse_attribute(element) -> dict:
    """Parse the attribute div into {name, image}."""
    attr_div = element.select_one("div.attribute")
    if not attr_div:
        return {"name": "", "image": ""}
    img = attr_div.find("img")
    img_url = ""
    if img and img.get("src"):
        img_url = "https://en.onepiece-cardgame.com" + img["src"].split("?")[0]
    name_el = attr_div.find("i")
    name = name_el.get_text(strip=True) if name_el else ""
    return {"name": name, "image": img_url}


def parse_card(dl_element) -> dict:
    """Parse a single <dl class='modalCol'> block into our card format."""
    card_id = dl_element.get("id", "")

    # Info row: spans contain [id, rarity, type]
    info_spans = dl_element.select("div.infoCol span")
    raw_id = info_spans[0].get_text(strip=True) if len(info_spans) > 0 else card_id
    rarity = info_spans[1].get_text(strip=True) if len(info_spans) > 1 else ""
    card_type = info_spans[2].get_text(strip=True) if len(info_spans) > 2 else ""

    name = ""
    name_el = dl_element.select_one("div.cardName")
    if name_el:
        name = name_el.get_text(strip=True)

    # Image URL from data-src
    img_el = dl_element.select_one("dd img.lazy")
    img_path = ""
    if img_el and img_el.get("data-src"):
        # data-src is like "../images/cardlist/card/OP13-001.png?260130"
        raw_src = img_el["data-src"]
        filename = raw_src.split("/")[-1].split("?")[0]
        img_path = IMAGE_BASE + filename

    # Card stats
    cost_text = extract_text(dl_element, "div.cost")
    power_text = extract_text(dl_element, "div.power")
    counter_text = extract_text(dl_element, "div.counter")
    color = extract_text(dl_element, "div.color")
    family = extract_text(dl_element, "div.feature")
    attribute = parse_attribute(dl_element)

    # Trigger text
    trigger_div = dl_element.select_one("div.trigger")
    trigger_text = ""
    if trigger_div:
        h3 = trigger_div.find("h3")
        if h3:
            h3.decompose()
        trigger_text = trigger_div.get_text(strip=True)

    # Effect text
    effect_div = dl_element.select_one("div.text")
    effect_text = ""
    if effect_div:
        h3 = effect_div.find("h3")
        if h3:
            h3.decompose()
        effect_text = effect_div.get_text(strip=True)

    # Set info
    set_info = extract_text(dl_element, "div.getInfo")

    return {
        "id": card_id,
        "code": raw_id,
        "rarity": rarity,
        "type": card_type,
        "name": name,
        "images": {
            "small": img_path,
            "large": img_path,
        },
        "cost": cost_text if cost_text and cost_text != "-" else "0",
        "attribute": attribute,
        "power": power_text if power_text and power_text != "-" else "0",
        "counter": counter_text if counter_text else "-",
        "color": color,
        "family": family,
        "ability": effect_text,
        "trigger": trigger_text,
        "set": {"name": set_info},
    }


def scrape_set(set_name: str, series_id: str) -> list[dict]:
    """Fetch and parse all cards for a given set."""
    url = f"{BASE_URL}?series={series_id}"
    print(f"  Fetching {url} ...")
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    cards = []

    for dl in soup.select("dl.modalCol"):
        card = parse_card(dl)
        if card["id"]:
            cards.append(card)

    return cards


def main():
    RAW_DATA_DIR.mkdir(exist_ok=True)

    # Determine which sets to scrape
    if len(sys.argv) > 1:
        targets = {}
        for arg in sys.argv[1:]:
            key = arg.upper()
            if key in SERIES_IDS:
                targets[key] = SERIES_IDS[key]
            else:
                print(f"Unknown set '{arg}'. Available: {', '.join(SERIES_IDS.keys())}")
                sys.exit(1)
    else:
        targets = SERIES_IDS

    total_cards = 0
    for set_name, series_id in targets.items():
        print(f"\n[{set_name}] Scraping...")
        cards = scrape_set(set_name, series_id)
        print(f"  Found {len(cards)} cards")
        total_cards += len(cards)

        # Write to raw_data
        filename = set_name.lower().replace("-", "_") + ".json"
        out_path = RAW_DATA_DIR / filename
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(cards, f, indent=2, ensure_ascii=False)
        print(f"  Saved to {out_path}")

        # Be polite to the server
        time.sleep(1)

    print(f"\nDone! Scraped {total_cards} cards across {len(targets)} sets.")
    print("Now run sync_cards.py to merge into cards.json.")


if __name__ == "__main__":
    main()

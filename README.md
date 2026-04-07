# OP Deck Builder

A modern, fast, dark-themed deck builder for the **One Piece Trading Card Game**, built because the official sim's UX wasn't cutting it.

🌐 **Live site:** [opdeckbuilder.dev](https://opdeckbuilder.dev)

---

## Features

### Deck building
- **All 4,000+ cards** across every set (OP01 → OP15, EB01–EB04, ST01–ST29, PRB01–PRB02, plus promos)
- **Smart filters** — color, type, rarity, counter value, cost, plus keyword filters for Rush, Blocker, Searcher, Banish, On KO, and the genuinely useful **Removal / Anti-Removal** filters
- **Live search** by card name, ID, family, or ability text
- **OPTCG rule enforcement** — 1 leader, max 4 copies per card, color-matching to leader, 51-card cap
- **Stacked card display** in the deck view — duplicates fan out so you can see counts at a glance
- **Sorted intelligently** — leader → characters → events → stages, then by primary/secondary color and cost

### Saving, loading, and sharing
- **Local deck saving** with named profiles (stored in your browser's `localStorage` — no account needed)
- **Auto-loads** your most recent deck on startup
- **Import / Export** in standard sim format (`4xOP15-108\n2xST29-009...`)
- **Share Deck** generates a styled deck-list image (PNG) of your build with stats — copy to clipboard or download
- **Resizable layout** — drag the sidebar and bottom row to fit your screen

### Proxy printing
- **Dedicated Proxy Builder** page — search or load a saved deck, manage quantities
- **Print-ready output** at exact TCG card size (63 × 88 mm), 9 cards per Letter sheet
- Modeled after how [LimitlessTCG](https://onepiece.limitlesstcg.com/tools/proxies) handles their proxy tool — flows naturally with browser pagination

### Visual polish
- Dark theme with custom branding
- Floating thin scrollbars
- Hover-to-preview large card display in the sidebar
- Cost curve, type breakdown, and counter stats panel
- Built-in product tour for first-time users

---

## Tech stack

- **[Vue 3](https://vuejs.org/)** with Composition API + TypeScript
- **[Vite](https://vitejs.dev/)** for dev server and bundling
- **[Pinia](https://pinia.vuejs.org/)** for state management
- **[D3](https://d3js.org/)** for the cost curve chart
- **[html-to-image](https://github.com/bubkoo/html-to-image)** for the share modal PNG export
- Card images sourced from [LimitlessTCG](https://onepiece.limitlesstcg.com/) (with [Bandai](https://en.onepiece-cardgame.com/cardlist/) as a fallback for missing reprint variants), pre-downloaded into `public/images/cards/` so the site has zero external image dependencies at runtime

---

## Local development

You'll need **Node.js 18+** and **npm**.

```bash
# Clone and install
git clone https://github.com/KiwiSweezy/OpDeckBuilder.git
cd OpDeckBuilder
npm install

# Run the dev server
npm run dev
# → http://localhost:5173/

# Production build
npm run build
npm run preview
```

### Updating card data (Python scripts)

The `scripts/` folder contains Python utilities for keeping the card database current. You'll need **Python 3.10+** and these packages:

```bash
pip install requests beautifulsoup4 Pillow
```

Pipeline:

| Script | Purpose |
|---|---|
| `scrape_bandai.py` | Scrapes the official Bandai card list and writes one JSON file per set into `raw_data/` |
| `sync_cards.py` | Merges every file in `raw_data/` into the master `src/data/cards.json`, dedupes by ID |
| `download_images.py` | Downloads card images (LimitlessTCG → Bandai fallback), resizes to 600px, converts to WebP, saves to `public/images/cards/` |
| `localize_images.py` | Rewrites the image URLs in `cards.json` to point at the local WebP files |

**To add a new set when Bandai releases one:**

```bash
# 1. Add the new set's series ID to SERIES_IDS in scrape_bandai.py, then:
python scripts/scrape_bandai.py OP16
python scripts/sync_cards.py
python scripts/download_images.py
python scripts/localize_images.py
```

---

## Project structure

```
OpDeckBuilder/
├── public/
│   ├── images/cards/        # 4341 WebP card images (committed to repo)
│   └── logo.png, favicon, fonts
├── raw_data/                # Per-set scraped JSON (one file per booster/starter)
├── scripts/                 # Python data pipeline (scrape, sync, download, localize)
├── src/
│   ├── App.vue              # Main grid layout + view switcher
│   ├── components/
│   │   ├── CardGrid.vue         # Lazy-loaded card pool
│   │   ├── DeckDisplay.vue      # Stacked deck view
│   │   ├── DeckSidebar.vue      # Save/load/import/export
│   │   ├── DeckShareModal.vue   # PNG export modal
│   │   ├── DeckStats.vue        # Cost curve + breakdowns
│   │   ├── ColorFilter.vue      # All filter buttons
│   │   ├── SearchBar.vue
│   │   ├── ProxyPage.vue        # Proxy builder + print view
│   │   └── AppTour.vue          # First-run onboarding
│   ├── stores/cardStore.ts  # Pinia store: filters, deck, saves
│   ├── data/cards.json      # Master normalized card database
│   └── types/Card.ts        # TypeScript card schema
└── vite.config.ts
```

---

## Data persistence

Deck saves live in **your browser's `localStorage`**, not on a server. This means:

- ✅ Your decks survive browser restarts
- ❌ They don't sync across devices or browsers
- ❌ Clearing browser data wipes them
- ❌ Incognito windows start fresh every time

Two storage keys are used:
- `op-saved-decks` — `{ deckName: [cardId, ...] }` map of every saved deck
- `op-last-deck` — the name of the last-opened deck, used for auto-loading on startup

If you want cross-device sync that's a backend feature for a future version.

---

## Credits & attribution

- **Card images and game data** © Bandai Co., Ltd. / Eiichiro Oda / Shueisha — used here for non-commercial fan/playtest purposes
- **Card images** mirrored via [LimitlessTCG's CDN](https://onepiece.limitlesstcg.com/) with thanks
- **Proxy print layout** inspired by LimitlessTCG's excellent proxy printer tool
- **One Piece** © Eiichiro Oda / Shueisha / Toei Animation

This project is not affiliated with or endorsed by Bandai or any official entity. It exists purely as a playtesting / deckbuilding tool for the community.

---

## License

This is a personal project — feel free to fork and learn from it. If you publish a derivative, please don't sell it. The card art belongs to Bandai.

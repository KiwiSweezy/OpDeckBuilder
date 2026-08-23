<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useCardStore } from '../stores/cardStore'
import type { Card } from '../types/Card'

const emit = defineEmits<{ (e: 'back'): void }>()
const cardStore = useCardStore()

/** Local proxy list — not bound to deck rules. Map of cardId → { card, quantity } */
const proxyList = ref<Map<string, { card: Card; qty: number }>>(new Map())

type PaperSize = 'a4' | 'letter' | '4x6'

const searchQuery = ref('')
const showDeckDropdown = ref(false)
const showHelp = ref(true)
const paperSize = ref<PaperSize>('a4')
const showGuides = ref(true)     // hairline cut guides on the shared card edges
const showSidebar = ref(false)   // mobile-only: toggle the slide-in sidebar drawer

/** Grid shape per sheet. A4/Letter both take a 3×3 block of 63×88mm cards
 *  (189×264mm); a 6in×4in photo sheet takes 2 side by side. */
const gridCols = computed(() => paperSize.value === '4x6' ? 2 : 3)
const cardsPerPage = computed(() => paperSize.value === '4x6' ? 2 : 9)

/** Total proxy count */
const totalProxies = computed(() => {
  let total = 0
  for (const entry of proxyList.value.values()) total += entry.qty
  return total
})

/** Cards for display, sorted by type then color then cost */
const proxyEntries = computed(() => {
  const colorOrder = ['red', 'blue', 'green', 'purple', 'black', 'yellow']
  const typeOrder: Record<string, number> = { leader: 0, character: 1, event: 2, stage: 3 }
  return Array.from(proxyList.value.values()).sort((a, b) => {
    const aT = typeOrder[a.card.type] ?? 9
    const bT = typeOrder[b.card.type] ?? 9
    if (aT !== bT) return aT - bT
    const aC = colorOrder.indexOf(a.card.color.split('/')[0] ?? '')
    const bC = colorOrder.indexOf(b.card.color.split('/')[0] ?? '')
    if (aC !== bC) return aC - bC
    return a.card.cost - b.card.cost
  })
})

/** Flatten the proxy list into one entry per physical card to print */
const printCards = computed(() => {
  const out: Card[] = []
  for (const entry of proxyEntries.value) {
    for (let i = 0; i < entry.qty; i++) out.push(entry.card)
  }
  return out
})

/** Deterministic pagination: chunk into explicit per-sheet arrays so that
 *  "N per page" is a fact of the markup, not an accident of how a line box
 *  happened to overflow. The page counter below reads straight off this. */
const printPages = computed(() => {
  const per = cardsPerPage.value
  const pages: Card[][] = []
  for (let i = 0; i < printCards.value.length; i += per) {
    pages.push(printCards.value.slice(i, i + per))
  }
  return pages
})

/** Search results — multi-token search across name + id + family.
 *  Each whitespace-separated token must match somewhere on the card,
 *  so "luffy op15", "op15 luffy", and "monkey luffy" all work. */
const searchResults = computed(() => {
  const tokens = searchQuery.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []
  return cardStore.allCards
    .filter(c => {
      const haystack = `${c.name} ${c.id} ${c.family}`.toLowerCase()
      return tokens.every(t => haystack.includes(t))
    })
    .slice(0, 30)
})

function addCard(card: Card) {
  const existing = proxyList.value.get(card.id)
  if (existing) {
    existing.qty++
  } else {
    proxyList.value.set(card.id, { card, qty: 1 })
  }
  // trigger reactivity for Map
  proxyList.value = new Map(proxyList.value)
}

function removeCard(cardId: string) {
  const existing = proxyList.value.get(cardId)
  if (!existing) return
  existing.qty--
  if (existing.qty <= 0) proxyList.value.delete(cardId)
  proxyList.value = new Map(proxyList.value)
}

function removeAll(cardId: string) {
  proxyList.value.delete(cardId)
  proxyList.value = new Map(proxyList.value)
}

function clearAll() {
  proxyList.value = new Map()
}

function loadFromDeck(name: string) {
  const decks = JSON.parse(localStorage.getItem('op-saved-decks') || '{}') as Record<string, string[]>
  const ids = decks[name]
  if (!ids) return
  const newList = new Map<string, { card: Card; qty: number }>()
  for (const id of ids) {
    const card = cardStore.allCards.find(c => c.id === id)
    if (!card) continue
    const existing = newList.get(id)
    if (existing) existing.qty++
    else newList.set(id, { card, qty: 1 })
  }
  proxyList.value = newList
  showDeckDropdown.value = false
}

/** Inject a dynamic @page rule into <head> based on the selected paper size.
 *  CSS @page can't read CSS variables, so we rewrite the rule on change.
 *
 *  Margins are the *page* margin only — they never sit between cards. They are
 *  the smallest values that still clear a typical printer's non-printable edge
 *  while leaving room for a full 189×264mm block of nine true-size cards:
 *    A4     210 × 297mm → content 194 × 277mm  (33mm of vertical slack)
 *    Letter 215.9 × 279.4mm → content 191.9 × 267.4mm (only 15.4mm of slack,
 *           hence the tighter 6mm vertical margin)
 *    6×4in  152.4 × 101.6mm → content 146.4 × 95.6mm for a 126×88mm pair */
function applyPaperSize(size: PaperSize) {
  let style = document.getElementById('proxy-page-size') as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = 'proxy-page-size'
    document.head.appendChild(style)
  }
  if (size === '4x6') {
    // 4×6 in landscape (6in × 4in) so 2 cards fit side by side
    style.textContent = '@page { size: 6in 4in; margin: 3mm; }'
  } else if (size === 'letter') {
    style.textContent = '@page { size: letter; margin: 6mm 12mm; }'
  } else {
    style.textContent = '@page { size: A4; margin: 10mm 8mm; }'
  }
}

watch(paperSize, applyPaperSize, { immediate: false })
onMounted(() => applyPaperSize(paperSize.value))
onUnmounted(() => {
  document.getElementById('proxy-page-size')?.remove()
})

function handlePrint() {
  window.print()
}
</script>

<template>
  <div class="proxy-page">
    <!-- Mobile-only backdrop when drawer is open -->
    <div v-if="showSidebar" class="sidebar-backdrop" @click="showSidebar = false"></div>

    <!-- LEFT SIDEBAR (becomes a slide-in drawer on mobile) -->
    <aside class="proxy-sidebar" :class="{ 'is-open': showSidebar }">
      <div class="sidebar-header">
        <button class="back-btn" @click="emit('back')">← Back</button>
        <h2 class="sidebar-title">Proxy Builder</h2>
      </div>

      <!-- Search bar -->
      <div class="search-section">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search cards to add..."
          class="proxy-search"
        />
        <div v-if="searchResults.length > 0" class="search-results">
          <div
            v-for="card in searchResults"
            :key="card.id"
            class="result-item"
            @click="addCard(card)"
          >
            <img :src="card.images.small" :alt="card.name" class="result-thumb" />
            <div class="result-info">
              <div class="result-name">{{ card.name }}</div>
              <div class="result-id">{{ card.id }}</div>
            </div>
            <span class="result-add">+</span>
          </div>
        </div>
      </div>

      <!-- Deck profile selector -->
      <div class="deck-section">
        <div class="section-label">Load From Deck</div>
        <button class="deck-toggle" @click="showDeckDropdown = !showDeckDropdown">
          {{ showDeckDropdown ? '▴' : '▾' }} Saved Decks ({{ cardStore.savedDecks.length }})
        </button>
        <div v-if="showDeckDropdown" class="deck-dropdown">
          <div
            v-for="deck in cardStore.savedDecks"
            :key="deck.name"
            class="deck-item"
            @click="loadFromDeck(deck.name)"
          >
            <img v-if="deck.leaderImage" :src="deck.leaderImage" class="deck-thumb" />
            <div v-else class="deck-thumb-placeholder" />
            <span class="deck-name">{{ deck.name }}</span>
          </div>
          <div v-if="cardStore.savedDecks.length === 0" class="deck-empty">
            No saved decks
          </div>
        </div>
      </div>

      <!-- Card list -->
      <div class="list-section">
        <div class="list-header">
          <span class="section-label">Proxy List ({{ totalProxies }})</span>
          <button v-if="totalProxies > 0" class="clear-btn" @click="clearAll">Clear</button>
        </div>
        <div class="card-bars">
          <div
            v-for="entry in proxyEntries"
            :key="entry.card.id"
            class="card-bar"
          >
            <img :src="entry.card.images.small" :alt="entry.card.name" class="bar-thumb" />
            <div class="bar-info">
              <div class="bar-name">{{ entry.card.name }}</div>
              <div class="bar-id">{{ entry.card.id }}</div>
            </div>
            <div class="bar-qty">
              <button class="qty-btn" @click="removeCard(entry.card.id)">−</button>
              <span class="qty-num">{{ entry.qty }}</span>
              <button class="qty-btn" @click="addCard(entry.card)">+</button>
            </div>
            <button class="bar-remove" @click="removeAll(entry.card.id)" title="Remove all">×</button>
          </div>
          <div v-if="proxyEntries.length === 0" class="empty-list">
            Search above or load a deck to start
          </div>
        </div>
      </div>

      <!-- Help / how-it-works panel -->
      <div class="help-section">
        <button class="help-toggle" @click="showHelp = !showHelp">
          <span>{{ showHelp ? '▾' : '▸' }} How does this work?</span>
        </button>
        <div v-if="showHelp" class="help-content">
          <div class="help-block">
            <strong>1. Build your list</strong>
            <p>Search for cards above or load one of your saved decks to import every card at once. Use the <span class="kbd">+</span> / <span class="kbd">−</span> buttons to adjust quantities.</p>
          </div>
          <div class="help-block">
            <strong>2. Preview your sheets</strong>
            <p>Cards are laid out 9 per page on A4 or Letter sheets (2 per page on 4&times;6 photo paper). The preview shows each sheet exactly as it will print, at true size.</p>
          </div>
          <div class="help-block">
            <strong>3. Print at real size</strong>
            <p>Click <span class="kbd">Print</span> to open your browser's print dialog. Cards print at official TCG size (63&times;88mm) with <strong>no gap between them</strong>, so one straight cut splits two cards. For best results:</p>
            <ul>
              <li>Set your printer to <strong>100% scale</strong> (no "fit to page")</li>
              <li>Disable headers and footers</li>
              <li>Disable "fit to printable area" / margins in the print dialog</li>
              <li>Use thicker paper or cardstock</li>
            </ul>
          </div>
          <div class="help-block tip">
            <strong>Tip:</strong> Cut out each proxy and sleeve it over a real card to give it weight. Perfect for playtesting decks before buying singles.
          </div>
        </div>
      </div>
    </aside>

    <!-- MAIN AREA: card grid (screen) / inline-block flow (print) -->
    <main class="proxy-main">
      <div class="proxy-toolbar dont-print">
        <button class="mobile-menu-toggle" @click="showSidebar = true" aria-label="Open proxy menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <span class="proxy-count">{{ totalProxies }} proxies · {{ printPages.length }} page(s)</span>
        <div class="toolbar-right">
          <label class="guide-toggle" title="Print a hairline on every cut line">
            <input type="checkbox" v-model="showGuides" />
            <span>Cut guides</span>
          </label>
          <label class="paper-select">
            <span>Paper</span>
            <select v-model="paperSize">
              <option value="a4">A4 (9 per page)</option>
              <option value="letter">Letter (9 per page)</option>
              <option value="4x6">4×6 Photo (2 per page)</option>
            </select>
          </label>
          <button class="print-btn" :disabled="totalProxies === 0" @click="handlePrint">
            Print
          </button>
        </div>
      </div>
      <div class="proxies-wrap" :class="[`paper-${paperSize}`, { 'show-guides': showGuides }]">
        <div v-if="totalProxies === 0" class="empty-state dont-print">
          <div class="empty-state-text">Your proxy cards will appear here</div>
        </div>
        <!-- One .proxy-sheet per physical sheet of paper. Screen and print use
             the exact same geometry — the only difference is that on screen a
             sheet is a shadowed white page, and in print it is the page. -->
        <div
          v-for="(page, pageIdx) in printPages"
          :key="pageIdx"
          class="proxy-sheet"
        >
          <div class="proxy-grid" :style="{ '--cols': gridCols }">
            <div
              v-for="(card, idx) in page"
              :key="idx"
              class="proxy-card"
            >
              <img :src="card.images.large" :alt="card.name"
                   width="600" height="838" decoding="async" fetchpriority="low" />
            </div>
          </div>
          <div class="sheet-label dont-print">
            Page {{ pageIdx + 1 }} of {{ printPages.length }}
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.proxy-page {
  display: grid;
  grid-template-columns: 420px 1fr;
  height: 100vh;
  background: var(--bg-primary);
  position: relative;
}

.mobile-menu-toggle {
  display: none;  /* hidden on desktop */
  width: 36px;
  height: 36px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.sidebar-backdrop {
  display: none;  /* hidden on desktop */
}

/* ===== SIDEBAR ===== */
.proxy-sidebar {
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 12px;
}

.back-btn {
  padding: 6px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 5px;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.8rem;
}

.back-btn:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.sidebar-title {
  color: var(--text-primary);
  font-size: 1rem;
  margin: 0;
}

/* Search section */
.search-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.proxy-search {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 5px;
  color: var(--text-primary);
  font-size: 0.85rem;
  outline: none;
}

.proxy-search:focus {
  border-color: var(--accent);
}

.search-results {
  margin-top: 8px;
  max-height: 220px;
  overflow-y: auto;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 5px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
}

.result-item:last-child {
  border-bottom: none;
}

.result-item:hover {
  background: var(--bg-secondary);
}

.result-thumb {
  width: 28px;
  height: 40px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
}

.result-info {
  flex: 1;
  min-width: 0;
}

.result-name {
  color: var(--text-primary);
  font-size: 0.78rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-id {
  color: var(--text-secondary);
  font-size: 0.65rem;
  font-family: monospace;
}

.result-add {
  color: var(--accent);
  font-size: 1.1rem;
  font-weight: bold;
  padding: 0 4px;
}

/* Deck section */
.deck-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.section-label {
  display: block;
  color: var(--text-secondary);
  font-size: 0.65rem;
  text-transform: uppercase;
  font-weight: bold;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}

.deck-toggle {
  width: 100%;
  padding: 7px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 5px;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.78rem;
  text-align: left;
}

.deck-toggle:hover {
  color: var(--text-primary);
}

.deck-dropdown {
  margin-top: 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 5px;
  max-height: 180px;
  overflow-y: auto;
}

.deck-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
}

.deck-item:last-child {
  border-bottom: none;
}

.deck-item:hover {
  background: var(--bg-secondary);
}

.deck-thumb {
  width: 28px;
  height: 40px;
  object-fit: cover;
  border-radius: 3px;
}

.deck-thumb-placeholder {
  width: 28px;
  height: 40px;
  background: var(--bg-secondary);
  border-radius: 3px;
}

.deck-name {
  color: var(--text-primary);
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.deck-empty {
  padding: 12px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.75rem;
}

/* Card list */
.list-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
  overflow: hidden;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.clear-btn {
  padding: 3px 8px;
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.7rem;
}

.clear-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.card-bars {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.empty-list {
  text-align: center;
  padding: 30px 12px;
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-style: italic;
}

.card-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.bar-thumb {
  width: 28px;
  height: 40px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
}

.bar-info {
  flex: 1;
  min-width: 0;
}

.bar-name {
  color: var(--text-primary);
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-id {
  color: var(--text-secondary);
  font-size: 0.62rem;
  font-family: monospace;
}

.bar-qty {
  display: flex;
  align-items: center;
  gap: 2px;
}

.qty-btn {
  width: 18px;
  height: 18px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
}

.qty-btn:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.qty-num {
  color: var(--text-primary);
  font-size: 0.78rem;
  font-weight: bold;
  min-width: 16px;
  text-align: center;
}

.bar-remove {
  width: 18px;
  height: 18px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
  line-height: 1;
}

.bar-remove:hover {
  color: var(--accent);
}

/* Help / how-it-works */
.help-section {
  border-top: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.help-toggle {
  width: 100%;
  padding: 10px 16px;
  background: none;
  border: none;
  text-align: left;
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.help-toggle:hover {
  color: var(--text-primary);
}

.help-content {
  padding: 4px 16px 16px;
  max-height: 320px;
  overflow-y: auto;
}

.help-block {
  margin-bottom: 12px;
  font-size: 0.78rem;
  color: var(--text-secondary);
  line-height: 1.45;
}

.help-block:last-child {
  margin-bottom: 0;
}

/* Direct children only — the step headings. A <strong> nested inside a <p> or
   an <li> is emphasis mid-sentence and must stay inline. */
.help-block > strong {
  color: var(--text-primary);
  font-size: 0.8rem;
  display: block;
  margin-bottom: 3px;
}

.help-block p strong,
.help-block li strong {
  color: var(--text-primary);
  font-weight: 600;
}

.help-block p {
  margin: 0 0 4px 0;
}

.help-block ul {
  margin: 4px 0 0 0;
  padding-left: 18px;
}

.help-block li {
  margin-bottom: 2px;
}

.help-block.tip {
  padding: 8px 10px;
  background: rgba(198, 40, 40, 0.08);
  border-left: 3px solid var(--accent);
  border-radius: 3px;
}

.help-block.tip strong {
  color: var(--accent);
  display: inline;
  margin-right: 4px;
}

.kbd {
  display: inline-block;
  padding: 1px 6px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.72rem;
  color: var(--text-primary);
}

/* ===== MAIN AREA ===== */
.proxy-main {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.proxy-toolbar {
  padding: 12px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.proxy-count {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.paper-select {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
}

.paper-select select {
  padding: 6px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 5px;
  color: var(--text-primary);
  font-size: 0.8rem;
  cursor: pointer;
  outline: none;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
}

.paper-select select:hover {
  border-color: var(--accent);
}

.guide-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-secondary);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}

.guide-toggle input {
  accent-color: var(--accent);
  cursor: pointer;
  margin: 0;
}

.print-btn {
  padding: 8px 18px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.print-btn:hover {
  filter: brightness(1.15);
}

.print-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ===== SHEET GEOMETRY =====
   Screen and print share ONE model, driven by --u ("one paper millimetre").
   In print --u is a real millimetre, so a card is literally 63mm × 88mm. On
   screen --u shrinks on narrow viewports, which scales the whole sheet — page,
   margins and cards together — so the preview stays a faithful miniature of
   the printed result instead of a differently-shaped grid. */
.proxies-wrap {
  --u: 1mm;
  --card-w: calc(63 * var(--u));
  --card-h: calc(88 * var(--u));
  --sheet-w: calc(210 * var(--u));    /* A4 */
  --sheet-h: calc(297 * var(--u));
  --sheet-pad-x: calc(8 * var(--u));  /* must match the @page margin */
  --sheet-pad-y: calc(10 * var(--u));
  flex: 1;
  overflow: auto;
  padding: var(--space-8) var(--space-6);
  display: block;
}

.proxies-wrap.paper-letter {
  --sheet-w: calc(215.9 * var(--u));
  --sheet-h: calc(279.4 * var(--u));
  --sheet-pad-x: calc(12 * var(--u));
  --sheet-pad-y: calc(6 * var(--u));
}

.proxies-wrap.paper-4x6 {
  --sheet-w: calc(152.4 * var(--u));
  --sheet-h: calc(101.6 * var(--u));
  --sheet-pad-x: calc(3 * var(--u));
  --sheet-pad-y: calc(3 * var(--u));
}

.empty-state {
  width: 100%;
  max-width: 700px;
  min-height: 400px;
  margin: 0 auto;
  background: var(--bg-secondary);
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-state-text {
  color: var(--text-secondary);
  font-size: 0.95rem;
}

/* One physical sheet of paper. */
.proxy-sheet {
  position: relative;
  box-sizing: border-box;
  width: var(--sheet-w);
  min-height: var(--sheet-h);
  margin: 0 auto var(--space-9);
  padding: var(--sheet-pad-y) var(--sheet-pad-x);
  background: #fff;
  box-shadow: var(--shadow-lg, 0 4px 24px rgba(0, 0, 0, 0.5));
}

.proxy-sheet:last-child {
  margin-bottom: 0;
}

.sheet-label {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(-1 * var(--space-7));
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--text-2xs, 0.65rem);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* The card block itself: fixed-width columns, ZERO gap, so every adjacent
   pair shares one cut line. Fixed columns (not 1fr) also mean a partial last
   row keeps the same column origins as the full rows above it — a straight
   guillotine cut down the sheet never slices through a card. */
.proxy-grid {
  display: grid;
  grid-template-columns: repeat(var(--cols, 3), var(--card-w));
  grid-auto-rows: var(--card-h);
  gap: 0;
  width: max-content;
  margin: 0 auto;
}

.proxy-card {
  position: relative;
  width: var(--card-w);
  height: var(--card-h);
  overflow: hidden;
}

.proxy-card img {
  display: block;
  width: 100%;
  height: 100%;
  /* Sources are 600×838 = exactly 63/88, so `cover` fills the slot without
     cropping. Without this the default `fill` stretches every card. */
  object-fit: cover;
}

/* Hairline cut guides.
   Must be an overlay pseudo-element, not an inset box-shadow on .proxy-card:
   box-shadow paints below the element's content, and the card <img> is opaque
   and fills the box, so it occluded the guide completely. ::after paints above
   the image, and being absolutely positioned it still adds zero layout. */
.proxies-wrap.show-guides .proxy-card::after {
  content: '';
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 0 0.1mm rgba(0, 0, 0, 0.45);
  pointer-events: none;
}

/* ===== PRINT STYLES =====
   The sheet wrappers above already decide what lands on which page, so print
   only has to strip the screen chrome and let each sheet break after itself.
   Nothing here introduces spacing between cards. */
@media print {
  .dont-print,
  .proxy-sidebar,
  .sidebar-backdrop,
  .proxy-toolbar,
  .empty-state,
  .sheet-label { display: none !important; }

  .proxy-page {
    display: block;
    height: auto;
    background: #fff;
  }

  .proxy-main,
  .proxies-wrap {
    overflow: visible;
    margin: 0;
    padding: 0;
    display: block;
    background: #fff;
  }

  /* One real millimetre per unit, whatever the screen breakpoints said. */
  .proxies-wrap {
    --u: 1mm;
  }

  /* The page box (via @page) already supplies the paper margin, so the sheet
     is just a full-bleed container that ends in a page break. */
  .proxy-sheet {
    width: auto;
    min-height: 0;
    margin: 0;
    padding: 0;
    background: #fff;
    box-shadow: none;
    break-after: page;
    break-inside: avoid;
  }

  .proxy-sheet:last-child {
    break-after: auto;  /* no trailing blank page */
  }
}

/* ===== SCREEN-ONLY SHEET SCALING =====
   `screen and` is load-bearing: an unqualified max-width query also matches
   while printing (a Letter page area is only ~763px wide), which is how the
   mobile padding below used to leak into every printed sheet. */
@media screen and (max-width: 1180px) {
  .proxies-wrap { --u: 0.78mm; }
}

@media screen and (max-width: 900px) {
  .proxies-wrap { --u: 0.62mm; }
}

/* ===== MOBILE STYLES ===== */
@media screen and (max-width: 767px) {
  .proxy-page {
    grid-template-columns: 1fr;  /* sidebar overlays content instead of taking a column */
  }

  .proxy-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 86%;
    max-width: 380px;
    z-index: 1300;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.5);
  }

  .proxy-sidebar.is-open {
    transform: translateX(0);
  }

  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 1299;
  }

  .mobile-menu-toggle {
    display: flex;
  }

  .proxy-toolbar {
    gap: 8px;
    flex-wrap: wrap;
  }

  .proxies-wrap {
    --u: 0.44mm;
    padding: var(--space-5);
  }

  .guide-toggle span {
    display: none;  /* keep the checkbox, drop the label on narrow toolbars */
  }
}
</style>

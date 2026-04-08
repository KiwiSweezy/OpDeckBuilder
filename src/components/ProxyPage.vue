<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useCardStore } from '../stores/cardStore'
import type { Card } from '../types/Card'

const emit = defineEmits<{ (e: 'back'): void }>()
const cardStore = useCardStore()

/** Local proxy list — not bound to deck rules. Map of cardId → { card, quantity } */
const proxyList = ref<Map<string, { card: Card; qty: number }>>(new Map())

const searchQuery = ref('')
const showDeckDropdown = ref(false)
const showHelp = ref(true)
const paperSize = ref<'letter' | '4x6'>('letter')

/** Cards per sheet depends on paper size */
const cardsPerPage = computed(() => paperSize.value === 'letter' ? 9 : 2)

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
 *  CSS @page can't read CSS variables, so we rewrite the rule on change. */
function applyPaperSize(size: 'letter' | '4x6') {
  let style = document.getElementById('proxy-page-size') as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = 'proxy-page-size'
    document.head.appendChild(style)
  }
  if (size === '4x6') {
    // 4×6 in landscape (6in × 4in) so 2 cards fit side by side
    style.textContent = '@page { size: 6in 4in; margin: 0.2cm; }'
  } else {
    style.textContent = '@page { size: letter; margin: 0.7cm; }'
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
    <!-- LEFT SIDEBAR -->
    <aside class="proxy-sidebar">
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
            <p>Cards are laid out 9 per page on Letter-sized sheets in the main area. Each physical proxy gets its own slot.</p>
          </div>
          <div class="help-block">
            <strong>3. Print at real size</strong>
            <p>Click <span class="kbd">Print</span> to open your browser's print dialog. Cards print at official TCG size (63&times;88mm). For best results:</p>
            <ul>
              <li>Set your printer to <strong>100% scale</strong> (no "fit to page")</li>
              <li>Disable headers and footers</li>
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
        <span class="proxy-count">{{ totalProxies }} proxies · ~{{ Math.max(1, Math.ceil(totalProxies / cardsPerPage)) }} page(s)</span>
        <div class="toolbar-right">
          <label class="paper-select">
            <span>Paper</span>
            <select v-model="paperSize">
              <option value="letter">Letter (9 per page)</option>
              <option value="4x6">4×6 Photo (2 per page)</option>
            </select>
          </label>
          <button class="print-btn" :disabled="totalProxies === 0" @click="handlePrint">
            Print
          </button>
        </div>
      </div>
      <div class="proxies-wrap">
        <div v-if="totalProxies === 0" class="empty-state">
          <div class="empty-state-text">Your proxy cards will appear here</div>
        </div>
        <div v-else class="proxies" :class="`paper-${paperSize}`">
          <div
            v-for="(card, idx) in printCards"
            :key="idx"
            class="proxies-card"
          >
            <img :src="card.images.large" :alt="card.name" />
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

.help-block strong {
  color: var(--text-primary);
  font-size: 0.8rem;
  display: block;
  margin-bottom: 3px;
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

.proxies-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 30px;
  display: flex;
  justify-content: center;
}

.empty-state {
  width: 100%;
  max-width: 700px;
  min-height: 400px;
  background: var(--bg-secondary);
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-state-text {
  color: var(--text-secondary);
  font-size: 0.95rem;
}

/* On-screen: simple 3-column grid that flows naturally */
.proxies {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  max-width: 720px;
  width: 100%;
  background: white;
  padding: 16px;
  border-radius: 4px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
  align-self: flex-start;
}

.proxies-card img {
  display: block;
  width: 100%;
  height: auto;
}

/* ===== PRINT STYLES =====
   Modeled after limitlesstcg's approach:
   - Switch from grid to inline-block flow
   - Use real-world cm units so cards print at exact TCG size
   - Browser handles wrapping and pagination naturally via break-inside
*/
@media print {
  body { display: block; min-height: auto; }
  .dont-print, .proxy-sidebar, .proxy-toolbar { display: none !important; }

  .proxy-page {
    display: block;
    height: auto;
    background: white;
  }
  .proxy-main,
  .proxies-wrap {
    overflow: visible;
    padding: 0;
    display: block;
    background: white;
  }
  .proxies {
    display: block;
    line-height: 0;
    font-size: 0;
    margin: 0;
    padding: 0;
    background: white;
    box-shadow: none;
    border-radius: 0;
    max-width: none;
    width: auto;
    text-align: center;  /* center the inline-block cards on the page */
  }
  .proxies-card {
    display: inline-block;
    break-inside: avoid;
    margin: 0.08cm;  /* small breathing room — keeps 9 cards per page */
  }
  .proxies-card img {
    /* Real TCG card size: 63mm × 88mm (limitless uses 6.02 × 8.52cm) */
    width: 6.02cm;
    height: 8.52cm;
    display: block;
  }

  /* 4×6 photo paper: 2 cards side-by-side, then page break.
     Page is set to 6in × 4in landscape via dynamic @page rule. */
  .proxies.paper-4x6 .proxies-card {
    margin: 0.1cm;
  }
}
</style>

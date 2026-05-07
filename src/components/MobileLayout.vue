<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCardStore } from '../stores/cardStore'
import CardGrid from './CardGrid.vue'
import SearchBar from './SearchBar.vue'
import ColorFilter from './ColorFilter.vue'
import DeckStats from './DeckStats.vue'
import MobileDeckList from './MobileDeckList.vue'
import MobileMenu from './MobileMenu.vue'
import BottomSheet from './BottomSheet.vue'
import { copyToClipboard } from '../utils/clipboard'
import { useCardPrice } from '../composables/useCardPrice'
import { formatPrice, getUsdToCadRate } from '../utils/pricing'

const copiedId = ref('')
function copyCardId(id: string) {
  if (copyToClipboard(id)) {
    copiedId.value = id
    setTimeout(() => {
      if (copiedId.value === id) copiedId.value = ''
    }, 1500)
  }
}

const emit = defineEmits<{
  (e: 'navigate', view: 'proxy'): void
  (e: 'share'): void
}>()

const cardStore = useCardStore()
type Tab = 'deck' | 'cards' | 'stats'
const activeTab = ref<Tab>('cards')

const showMenu = ref(false)
const showFilters = ref(false)

// Card preview opens automatically when a card is selected on mobile
const showPreview = computed({
  get: () => cardStore.selectedCard !== null,
  set: (v) => { if (!v) cardStore.selectedCard = null },
})

const cardKeywords = computed(() => {
  const card = cardStore.selectedCard
  if (!card) return []
  const ability = card.ability.toLowerCase()
  const keywords: string[] = []
  if (ability.includes('blocker')) keywords.push('Blocker')
  if (ability.includes('rush')) keywords.push('Rush')
  if (ability.includes('banish')) keywords.push('Banish')
  if (ability.includes('double attack')) keywords.push('Double Attack')
  if (ability.includes('on k.o.')) keywords.push('On KO')
  if (/look at.*from the top of your deck/i.test(card.ability)) keywords.push('Searcher')
  return keywords
})

/** How many copies of the previewed card are currently in the deck */
const previewedCount = computed(() => {
  const card = cardStore.selectedCard
  if (!card) return 0
  return cardStore.deck.filter(c => c.id === card.id).length
})

/* Market price for the previewed card, only relevant once at least one
   copy is in the deck. Mirrors the desktop market-pill colour (#4dd0b2). */
const previewedCardId = computed(() => cardStore.selectedCard?.id ?? null)
const { price: previewPrice } = useCardPrice(previewedCardId)
const cadRate = ref(1.40)
getUsdToCadRate().then(r => { cadRate.value = r })

const previewPriceLine = computed(() => {
  if (previewedCount.value === 0) return null
  const usd = previewPrice.value
  if (typeof usd !== 'number') return null
  const unit = formatPrice(usd, cardStore.currency, cadRate.value)
  const total = formatPrice(usd * previewedCount.value, cardStore.currency, cadRate.value)
  return previewedCount.value === 1
    ? unit
    : `${unit} × ${previewedCount.value} = ${total}`
})



</script>

<template>
  <div class="mobile-layout">
    <!-- TOP BAR -->
    <header class="mobile-topbar">
      <button class="topbar-btn" @click="showMenu = true" aria-label="Menu">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      <div class="topbar-title">
        <span class="deck-name">{{ cardStore.deckName || 'Untitled Deck' }}</span>
        <span class="deck-count">{{ cardStore.deckSize }} / 51</span>
      </div>

      <button class="topbar-btn" @click="emit('share')" aria-label="Share">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="18" cy="5" r="3"/>
          <circle cx="6" cy="12" r="3"/>
          <circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
      </button>
    </header>

    <!-- ACTIVE FILTERS BAR (only when chips exist) -->
    <div v-if="cardStore.searchChips.length > 0" class="active-filters-mobile">
      <div
        v-for="chip in cardStore.searchChips"
        :key="chip"
        class="m-chip"
      >
        <span>{{ chip }}</span>
        <button @click="cardStore.removeSearchChip(chip)">×</button>
      </div>
      <button v-if="cardStore.searchChips.length > 1" class="m-chip-clear" @click="cardStore.clearSearchChips">clear</button>
    </div>

    <!-- TAB CONTENT -->
    <main class="mobile-content">
      <!-- DECK TAB -->
      <div v-show="activeTab === 'deck'" class="tab-pane">
        <MobileDeckList />
      </div>

      <!-- CARDS TAB -->
      <div v-show="activeTab === 'cards'" class="tab-pane cards-pane">
        <div class="cards-header">
          <SearchBar />
          <button class="filter-btn" @click="showFilters = true" aria-label="Filters">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="4" y1="6" x2="14" y2="6"/>
              <circle cx="17" cy="6" r="2.2"/>
              <line x1="20" y1="12" x2="10" y2="12"/>
              <circle cx="7" cy="12" r="2.2"/>
              <line x1="4" y1="18" x2="14" y2="18"/>
              <circle cx="17" cy="18" r="2.2"/>
            </svg>
            <span v-if="cardStore.hasActiveFilters" class="filter-dot"></span>
          </button>
        </div>
        <div class="cards-pool">
          <CardGrid />
        </div>
      </div>

      <!-- STATS TAB -->
      <div v-show="activeTab === 'stats'" class="tab-pane">
        <div class="stats-pane">
          <DeckStats />
        </div>
      </div>
    </main>

    <!-- BOTTOM TAB BAR -->
    <nav class="mobile-tabbar">
      <button
        :class="['tab-btn', { active: activeTab === 'deck' }]"
        @click="activeTab = 'deck'"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="13" height="18" rx="2"/>
          <rect x="8" y="6" width="13" height="18" rx="2" fill="var(--bg-secondary)"/>
        </svg>
        <span>Deck</span>
        <span v-if="cardStore.deckSize > 0" class="tab-badge">{{ cardStore.deckSize }}</span>
      </button>

      <button
        :class="['tab-btn', { active: activeTab === 'cards' }]"
        @click="activeTab = 'cards'"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="7"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span>Cards</span>
      </button>

      <button
        :class="['tab-btn', { active: activeTab === 'stats' }]"
        @click="activeTab = 'stats'"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="6" y1="20" x2="6" y2="11"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="18" y1="20" x2="18" y2="14"/>
        </svg>
        <span>Stats</span>
      </button>
    </nav>

    <!-- SIDE DRAWER MENU -->
    <MobileMenu
      :open="showMenu"
      @close="showMenu = false"
      @navigate="emit('navigate', $event)"
      @share="emit('share')"
    />

    <!-- FILTERS BOTTOM SHEET -->
    <BottomSheet :open="showFilters" title="Filters" @close="showFilters = false">
      <ColorFilter />
    </BottomSheet>

    <!-- CARD PREVIEW BOTTOM SHEET -->
    <BottomSheet :open="showPreview" @close="showPreview = false">
      <div v-if="cardStore.selectedCard" class="preview">
        <img
          :src="cardStore.selectedCard.images.large"
          :alt="cardStore.selectedCard.name"
          class="preview-img"
        />
        <h2 class="preview-name">{{ cardStore.selectedCard.name }}</h2>
        <p class="preview-meta">
          <button
            class="copy-id"
            @click="copyCardId(cardStore.selectedCard.id)"
          >
            {{ copiedId === cardStore.selectedCard.id ? 'Copied!' : cardStore.selectedCard.id }}
          </button>
          · Cost {{ cardStore.selectedCard.cost }} ·
          Power {{ cardStore.selectedCard.power }} · {{ cardStore.selectedCard.attribute }}
        </p>
        <p class="preview-meta">
          {{ cardStore.selectedCard.rarity.toUpperCase() }}<span v-if="cardStore.selectedCard.counter"> · Counter {{ cardStore.selectedCard.counter }}</span>
        </p>
        <p class="preview-family">{{ cardStore.selectedCard.family }}</p>
        <div v-if="cardKeywords.length" class="preview-keywords">
          <span v-for="kw in cardKeywords" :key="kw" class="kw-badge">{{ kw }}</span>
        </div>
        <p
          v-if="cardStore.selectedCard.ability && cardStore.selectedCard.ability !== '-'"
          class="preview-ability"
        >{{ cardStore.selectedCard.ability.replace(/<br>/g, '\n') }}</p>
        <button
          v-if="previewPriceLine"
          class="preview-price-pill"
          @click="cardStore.toggleCurrency"
          :title="`Tap to switch to ${cardStore.currency === 'USD' ? 'CAD' : 'USD'}`"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1v22M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6"/>
          </svg>
          <span>{{ previewPriceLine }}</span>
        </button>
        <div class="preview-qty">
          <button
            class="qty-btn"
            :disabled="previewedCount === 0"
            @click="cardStore.removeFromDeck(cardStore.selectedCard.id)"
            aria-label="Remove one"
          >−</button>
          <div class="qty-display">
            <span class="qty-num">{{ previewedCount }}</span>
            <span class="qty-label">in deck</span>
          </div>
          <button
            class="qty-btn add"
            @click="cardStore.addToDeck(cardStore.selectedCard)"
            aria-label="Add one"
          >+</button>
        </div>
        <button
          v-if="previewedCount > 0"
          class="remove-all-btn"
          @click="cardStore.removeAllFromDeck(cardStore.selectedCard.id)"
        >
          Remove all from deck
        </button>
      </div>
    </BottomSheet>
  </div>
</template>

<style scoped>
.mobile-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;  /* dynamic viewport — adapts to iOS URL bar */
  background: var(--bg-primary);
  overflow: hidden;
}

/* TOP BAR — extra top padding for iPhone notch / status bar */
.mobile-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  padding-top: calc(8px + env(safe-area-inset-top));
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.topbar-btn {
  width: 40px;
  height: 40px;
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.topbar-btn:active { color: var(--accent); }

.topbar-title {
  flex: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.deck-name {
  color: var(--text-primary);
  font-size: 0.95rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
  margin: 0 auto;
}

.deck-count {
  color: var(--text-secondary);
  font-size: 0.7rem;
}

/* ACTIVE FILTERS */
.active-filters-mobile {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 8px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.m-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px 2px 8px;
  background: var(--accent);
  color: white;
  border-radius: 10px;
  font-size: 0.72rem;
  font-weight: 500;
}

.m-chip button {
  width: 18px;
  height: 18px;
  background: rgba(0, 0, 0, 0.25);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 0.85rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.m-chip-clear {
  padding: 2px 8px;
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-secondary);
  font-size: 0.7rem;
  cursor: pointer;
}

/* TAB CONTENT */
.mobile-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.tab-pane {
  position: absolute;
  inset: 0;
  overflow-y: auto;
}

.cards-pane {
  display: flex;
  flex-direction: column;
}

.cards-header {
  display: flex;
  align-items: stretch;
  gap: 6px;
  padding: 8px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 5;
}

.cards-header .search-bar {
  flex: 1;
  margin-bottom: 0;
}

.filter-btn {
  position: relative;
  width: 42px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
}

.filter-btn:active { background: var(--bg-secondary); }

.filter-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  background: var(--accent);
  border-radius: 50%;
}

.cards-pool {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.stats-pane {
  padding: 16px;
}

/* BOTTOM TAB BAR */
.mobile-tabbar {
  display: flex;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
  /* Add iOS safe-area padding */
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-btn {
  flex: 1;
  position: relative;
  background: none;
  border: none;
  padding: 8px 4px 6px;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 0.7rem;
  font-weight: 500;
  transition: color 0.15s ease;
}

.tab-btn.active {
  color: var(--accent);
}

.tab-btn:active {
  background: var(--bg-tertiary);
}

.tab-badge {
  position: absolute;
  top: 4px;
  right: 50%;
  transform: translateX(16px);
  background: var(--accent);
  color: white;
  font-size: 0.6rem;
  font-weight: bold;
  padding: 1px 5px;
  border-radius: 8px;
  min-width: 16px;
  text-align: center;
}

/* PREVIEW SHEET */
.preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
}

.preview-img {
  width: 70%;
  max-width: 280px;
  border-radius: 8px;
  margin-bottom: 8px;
}

.preview-name {
  color: var(--text-primary);
  font-size: 1.1rem;
  margin: 0;
}

.preview-meta {
  color: var(--text-secondary);
  font-size: 0.82rem;
  margin: 2px 0;
}

.preview-family {
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-style: italic;
  margin: 4px 0;
}

.preview-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
  margin: 4px 0;
}

.kw-badge {
  background: var(--accent);
  color: white;
  font-size: 0.65rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  text-transform: uppercase;
}

.preview-ability {
  color: var(--text-secondary);
  font-size: 0.88rem;
  line-height: 1.4;
  white-space: pre-line;
  text-align: left;
  margin-top: 8px;
  width: 100%;
}

.copy-id {
  display: inline-block;
  padding: 1px 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: inherit;
  font-family: monospace;
  font-size: 0.78rem;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;  /* no iOS long-press context menu */
}

.copy-id:active {
  border-color: var(--accent);
  color: var(--accent);
}

.preview-price-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 5px 12px;
  background: rgba(15, 15, 15, 0.85);
  border: 1px solid rgba(77, 208, 178, 0.35);
  border-radius: 14px;
  color: #4dd0b2;
  font-size: 0.78rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  align-self: center;
}

.preview-price-pill:active {
  background: rgba(0, 0, 0, 0.95);
}

.preview-price-pill svg {
  display: block;
}

.preview-qty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  width: 100%;
  margin-top: 14px;
  padding: 10px 14px;
  background: var(--bg-tertiary);
  border-radius: 10px;
}

.qty-btn {
  width: 48px;
  height: 48px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 50%;
  color: var(--text-primary);
  font-size: 1.5rem;
  font-weight: bold;
  line-height: 1;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s ease;
  flex-shrink: 0;
}

.qty-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.qty-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.qty-btn.add {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.qty-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 70px;
  line-height: 1.1;
}

.qty-num {
  color: var(--text-primary);
  font-size: 1.6rem;
  font-weight: bold;
}

.qty-label {
  color: var(--text-secondary);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.remove-all-btn {
  width: 100%;
  margin-top: 10px;
  padding: 10px;
  background: none;
  border: 1px solid var(--accent);
  border-radius: 8px;
  color: var(--accent);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
}

.remove-all-btn:active {
  background: var(--accent);
  color: white;
}
</style>

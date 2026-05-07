<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCardStore } from './stores/cardStore'
import CardGrid from './components/CardGrid.vue'
import SearchBar from './components/SearchBar.vue'
import ColorFilter from './components/ColorFilter.vue'
import DeckDisplay from './components/DeckDisplay.vue'
import DeckSidebar from './components/DeckSidebar.vue'
import DeckStats from './components/DeckStats.vue'
import DeckShareModal from './components/DeckShareModal.vue'
import ProxyPage from './components/ProxyPage.vue'
import AppTour from './components/AppTour.vue'
import MobileLayout from './components/MobileLayout.vue'
import { useBreakpoint } from './composables/useBreakpoint'
import { tcgplayerUrl } from './utils/pricing'
import { copyToClipboard } from './utils/clipboard'

const copiedId = ref('')
function copyCardId(id: string) {
  if (copyToClipboard(id)) {
    copiedId.value = id
    setTimeout(() => {
      if (copiedId.value === id) copiedId.value = ''
    }, 1500)
  }
}

const { isMobile } = useBreakpoint()


const cardStore = useCardStore()
cardStore.initStore()

const tourRef = ref<InstanceType<typeof AppTour> | null>(null)
function startTour() {
  tourRef.value?.start()
}

const showShareModal = ref(false)
function openShare() {
  if (cardStore.deckSize === 0) return
  showShareModal.value = true
}

const currentView = ref<'builder' | 'proxy'>('builder')

/* Resizable sidebar */
const SIDEBAR_MAX = 500
const SIDEBAR_MIN = 280
const sidebarWidth = ref(SIDEBAR_MAX)
const isResizing = ref(false)

function onResizeStart(e: MouseEvent) {
  e.preventDefault()
  isResizing.value = true
  const onMove = (ev: MouseEvent) => {
    const w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, ev.clientX))
    sidebarWidth.value = w
  }
  const onUp = () => {
    isResizing.value = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

/* Resizable bottom row (filters + card pool) */
const BOTTOM_MIN = 200       // smallest the bottom row can shrink to
const BOTTOM_MAX_RATIO = 0.7 // bottom row can take at most 70% of viewport
const bottomHeight = ref(0)  // 0 = use default 2fr; set on first drag
const isResizingRow = ref(false)

function onRowResizeStart(e: MouseEvent) {
  e.preventDefault()
  isResizingRow.value = true
  const onMove = (ev: MouseEvent) => {
    const vh = window.innerHeight
    const fromBottom = vh - ev.clientY
    const max = vh * BOTTOM_MAX_RATIO
    bottomHeight.value = Math.min(max, Math.max(BOTTOM_MIN, fromBottom))
  }
  const onUp = () => {
    isResizingRow.value = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

const gridStyle = computed(() => ({
  gridTemplateColumns: `${sidebarWidth.value}px 400px 1fr`,
  gridTemplateRows: bottomHeight.value > 0
    ? `1fr ${bottomHeight.value}px`
    : '3fr 2fr',
}))

/** Detect keywords present in the selected card's ability text */
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
</script>

<template>
  <ProxyPage v-if="currentView === 'proxy'" @back="currentView = 'builder'" />
  <MobileLayout
    v-else-if="isMobile"
    @navigate="currentView = $event"
    @share="openShare"
  />
  <div v-else class="app-layout" :class="{ 'is-resizing': isResizing, 'is-resizing-row': isResizingRow }" :style="gridStyle">
    <!-- LEFT: sidebar with controls + card preview -->
    <div class="sidebar">
      <div class="resize-handle" @mousedown="onResizeStart"></div>
      <div class="sidebar-controls">
        <DeckSidebar />
        <button class="tour-trigger" @click="startTour" title="Start tour">?</button>
      </div>
      <div class="sidebar-preview" data-tour="sidebar-preview">
        <div v-if="cardStore.selectedCard" class="preview-content">
          <img
            :src="cardStore.selectedCard.images.large"
            :alt="cardStore.selectedCard.name"
            class="preview-image"
          />
          <h2 class="preview-name">{{ cardStore.selectedCard.name }}</h2>
          <p class="preview-details">
            <button
              class="copy-id"
              :title="`Copy ${cardStore.selectedCard.id} to clipboard`"
              @click="copyCardId(cardStore.selectedCard.id)"
            >
              {{ copiedId === cardStore.selectedCard.id ? 'Copied!' : cardStore.selectedCard.id }}
            </button>
            ·
            Cost {{ cardStore.selectedCard.cost }} ·
            Power {{ cardStore.selectedCard.power }} ·
            {{ cardStore.selectedCard.attribute }}
          </p>
          <p class="preview-details">
            {{ cardStore.selectedCard.rarity.toUpperCase() }}<span v-if="cardStore.selectedCard.counter"> · Counter {{ cardStore.selectedCard.counter }}</span>
          </p>
          <p class="preview-family">{{ cardStore.selectedCard.family }}</p>
          <div v-if="cardKeywords.length" class="preview-keywords">
            <span v-for="kw in cardKeywords" :key="kw" class="keyword-badge">{{ kw }}</span>
          </div>
          <p v-if="cardStore.selectedCard.ability && cardStore.selectedCard.ability !== '-'" class="preview-ability">
            {{ cardStore.selectedCard.ability.replace(/<br>/g, '\n') }}
          </p>
          <a
            class="tcgplayer-link"
            :href="tcgplayerUrl(cardStore.selectedCard.id)"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on TCGplayer
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        </div>
        <p v-else class="preview-placeholder">Hover a card to preview</p>
        <DeckStats />
      </div>
    </div>

    <!-- RIGHT-TOP: deck display area (cards in deck) -->
    <div class="deck-area" data-tour="deck-area">
      <DeckDisplay />
      <button
        class="share-fab"
        :class="{ disabled: cardStore.deckSize === 0 }"
        @click="openShare"
        title="Share Deck"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="18" cy="5" r="3"></circle>
          <circle cx="6" cy="12" r="3"></circle>
          <circle cx="18" cy="19" r="3"></circle>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
        </svg>
        <span>Share</span>
      </button>
      <button
        class="share-fab proxy-fab"
        @click="currentView = 'proxy'"
        title="Proxy this deck list"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
        <span>Proxy</span>
      </button>
      <div class="row-resize-handle" @mousedown="onRowResizeStart"></div>
    </div>

    <!-- RIGHT-BOTTOM-LEFT: search + filters -->
    <div class="filters" data-tour="filters">
      <SearchBar />
      <ColorFilter />
    </div>

    <!-- RIGHT-BOTTOM-RIGHT: card search results -->
    <div class="card-pool" data-tour="card-pool">
      <CardGrid />
    </div>
    <AppTour ref="tourRef" />
  </div>
  <!-- Share modal: outside the layout so both mobile + desktop can open it -->
  <DeckShareModal :open="showShareModal" @close="showShareModal = false" />
</template>

<style scoped>
/*
  2-row, 3-column grid:
  Left sidebar spans both rows (controls + preview stacked).
  Row 1: deck area (spans 2 cols)
  Row 2: filters | card pool

  grid-template-areas:
  "sidebar deck    deck"
  "sidebar filters cards"
*/
.app-layout {
  display: grid;
  /* grid-template-columns set dynamically via :style */
  grid-template-rows: 3fr 2fr;
  grid-template-areas:
    "sidebar deck    deck"
    "sidebar filters cards";
  height: 100vh;
}

.app-layout.is-resizing {
  user-select: none;
  cursor: col-resize;
}

.app-layout.is-resizing-row {
  user-select: none;
  cursor: row-resize;
}

/* LEFT: full-height sidebar */
.sidebar {
  grid-area: sidebar;
  background-color: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  position: relative;
}

.resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 5px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
  background: transparent;
  transition: background 0.15s ease;
}

.resize-handle:hover,
.app-layout.is-resizing .resize-handle {
  background: var(--accent);
}

/* Controls sit at top, only as tall as their content */
.sidebar-controls {
  position: relative;
  padding: 16px 16px 31px;
  border-bottom: 1px solid var(--border-color);
}

/* Preview fills the remaining space */
.sidebar-preview {
  flex: 1;
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* RIGHT-TOP: deck display — spans 2 columns */
.deck-area {
  grid-area: deck;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 12px;
  overflow-y: auto;
  position: relative;
}

.share-fab {
  position: absolute;
  top: 14px;
  right: 18px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  background: rgba(15, 15, 15, 0.85);
  color: var(--text-primary);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow:
    0 4px 14px rgba(0, 0, 0, 0.6),
    0 2px 4px rgba(0, 0, 0, 0.4);
  transition: all 0.18s ease;
}

.share-fab:hover {
  background: rgba(0, 0, 0, 0.95);
  border-color: var(--accent);
  color: white;
  transform: translateY(-1px);
  box-shadow:
    0 6px 18px rgba(0, 0, 0, 0.7),
    0 0 0 1px var(--accent);
}

.share-fab.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.share-fab svg {
  display: block;
}

/* Proxy button sits directly below the Share button */
.proxy-fab {
  top: 56px;
}

.row-resize-handle {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 5px;
  cursor: row-resize;
  z-index: 10;
  background: transparent;
  transition: background 0.15s ease;
}

.row-resize-handle:hover,
.app-layout.is-resizing-row .row-resize-handle {
  background: var(--accent);
}

/* RIGHT-BOTTOM-LEFT: search + filters */
.filters {
  grid-area: filters;
  background-color: var(--bg-primary);
  border-right: 1px solid var(--border-color);
  padding: 10px 12px;
  overflow-y: auto;
}

/* RIGHT-BOTTOM-RIGHT: card pool */
.card-pool {
  grid-area: cards;
  background-color: var(--bg-primary);
  padding: 16px;
  overflow-y: auto;
}

/* Preview styles */
.preview-placeholder {
  color: var(--text-secondary);
  font-size: 0.9rem;
  text-align: center;
  margin-top: 20px;
}

.preview-image {
  width: 100%;
  border-radius: 8px;
}

.preview-name {
  color: var(--text-primary);
  font-size: 1.1rem;
  margin-top: 12px;
}

.preview-details {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin-top: 6px;
}

.preview-family {
  color: var(--text-secondary);
  font-size: 0.8rem;
  margin-top: 4px;
  font-style: italic;
}

.preview-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.keyword-badge {
  padding: 2px 8px;
  background-color: var(--accent);
  color: white;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 10px;
  text-transform: uppercase;
}

.tour-trigger {
  position: absolute;
  bottom: 4px;
  right: 8px;
  width: 24px;
  height: 24px;
  padding: 0;
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.tour-trigger:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.preview-ability {
  color: var(--text-secondary);
  font-size: 0.95rem;
  margin-top: 8px;
  line-height: 1.4;
  white-space: pre-line;
}

.copy-id {
  display: inline-block;
  padding: 1px 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: inherit;
  font-family: monospace;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.copy-id:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.tcgplayer-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 7px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.85rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.15s ease;
}

.tcgplayer-link:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>

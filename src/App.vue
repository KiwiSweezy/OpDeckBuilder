<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCardStore } from './stores/cardStore'
import CardGrid from './components/CardGrid.vue'
import SearchBar from './components/SearchBar.vue'
import ColorFilter from './components/ColorFilter.vue'
import DeckDisplay from './components/DeckDisplay.vue'
import DeckSidebar from './components/DeckSidebar.vue'
import DeckStats from './components/DeckStats.vue'
import AppTour from './components/AppTour.vue'

const cardStore = useCardStore()
cardStore.initStore()

const tourRef = ref<InstanceType<typeof AppTour> | null>(null)
function startTour() {
  tourRef.value?.start()
}

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

const gridStyle = computed(() => ({
  gridTemplateColumns: `${sidebarWidth.value}px 400px 1fr`,
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
  <div class="app-layout" :class="{ 'is-resizing': isResizing }" :style="gridStyle">
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
            {{ cardStore.selectedCard.id }} ·
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
        </div>
        <p v-else class="preview-placeholder">Hover a card to preview</p>
        <DeckStats />
      </div>
    </div>

    <!-- RIGHT-TOP: deck display area (cards in deck) -->
    <div class="deck-area" data-tour="deck-area">
      <DeckDisplay />
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
}

/* RIGHT-BOTTOM-LEFT: search + filters */
.filters {
  grid-area: filters;
  background-color: var(--bg-primary);
  border-right: 1px solid var(--border-color);
  padding: 12px;
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
</style>

<script setup lang="ts">
import { useCardStore } from './stores/cardStore'
import CardGrid from './components/CardGrid.vue'
import SearchBar from './components/SearchBar.vue'
import ColorFilter from './components/ColorFilter.vue'
import DeckDisplay from './components/DeckDisplay.vue'
import DeckSidebar from './components/DeckSidebar.vue'

const cardStore = useCardStore()
</script>

<template>
  <div class="app-layout">
    <!-- LEFT: sidebar with controls + card preview -->
    <div class="sidebar">
      <div class="sidebar-controls">
        <DeckSidebar />
      </div>
      <div class="sidebar-preview">
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
            {{ cardStore.selectedCard.attribute }}
          </p>
          <p class="preview-family">{{ cardStore.selectedCard.family }}</p>
        </div>
        <p v-else class="preview-placeholder">Hover a card to preview</p>
      </div>
    </div>

    <!-- RIGHT-TOP: deck display area (cards in deck) -->
    <div class="deck-area">
      <DeckDisplay />
    </div>

    <!-- RIGHT-BOTTOM-LEFT: search + filters -->
    <div class="filters">
      <SearchBar />
      <ColorFilter />
    </div>

    <!-- RIGHT-BOTTOM-RIGHT: card search results -->
    <div class="card-pool">
      <CardGrid />
    </div>
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
  grid-template-columns: 500px 400px 1fr;
  grid-template-rows: 3fr 2fr;
  grid-template-areas:
    "sidebar deck    deck"
    "sidebar filters cards";
  height: 100vh;
}

/* LEFT: full-height sidebar */
.sidebar {
  grid-area: sidebar;
  background-color: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

/* Controls sit at top, only as tall as their content */
.sidebar-controls {
  padding: 16px;
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
</style>

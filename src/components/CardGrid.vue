<script setup lang="ts">
// This component's job: pull cards from the store and lay them out in a grid.
// It doesn't know HOW to render a single card — it delegates that to CardThumbnail.
// This separation keeps each component focused on one responsibility.

import { useCardStore } from '../stores/cardStore'
import CardThumbnail from './CardThumbnail.vue'

const cardStore = useCardStore()
</script>

<template>
  <div v-if="!cardStore.hasActiveFilters" class="no-filters">
    Select a color or type a search to browse cards
  </div>
  <div v-else class="card-grid">
    <CardThumbnail
      v-for="card in cardStore.filteredCards"
      :key="card.id"
      :card="card"
      @select="cardStore.addToDeck"
      @preview="cardStore.selectCard"
    />
  </div>
</template>

<style scoped>
/*
  CSS Grid with auto-fill creates as many columns as will fit.
  minmax(120px, 1fr) means:
    - Each column is AT LEAST 120px wide
    - If there's extra space, columns stretch equally (1fr)
  This makes the grid fully responsive with zero media queries.
*/
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
}

.no-filters {
  color: var(--text-secondary);
  font-size: 0.9rem;
  text-align: center;
  padding: 40px 20px;
}
</style>

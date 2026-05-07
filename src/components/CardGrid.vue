<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useCardStore } from '../stores/cardStore'
import CardThumbnail from './CardThumbnail.vue'

const cardStore = useCardStore()

const BATCH_SIZE = 50
const visibleCount = ref(BATCH_SIZE)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

// Cards to actually render (capped by visibleCount)
const visibleCards = computed(() =>
  cardStore.filteredCards.slice(0, visibleCount.value)
)

const hasMore = computed(() =>
  visibleCount.value < cardStore.filteredCards.length
)

// Reset visible count when filters change
watch(() => cardStore.filteredCards, () => {
  visibleCount.value = BATCH_SIZE
})

function loadMore() {
  visibleCount.value = Math.min(
    visibleCount.value + BATCH_SIZE,
    cardStore.filteredCards.length
  )
}

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && hasMore.value) {
        loadMore()
      }
    },
    { rootMargin: '200px' }
  )
  if (sentinel.value) observer.observe(sentinel.value)
})

watch(sentinel, (el) => {
  if (observer && el) observer.observe(el)
})

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>

<template>
  <div v-if="!cardStore.hasActiveFilters" class="no-filters">
    Select a color or type a search to browse cards
  </div>
  <div v-else>
    <div class="card-grid">
      <CardThumbnail
        v-for="card in visibleCards"
        :key="card.id"
        :card="card"
        @select="cardStore.addToDeck"
        @preview="cardStore.selectCard"
      />
    </div>
    <div v-if="hasMore" ref="sentinel" class="load-sentinel">
      <span class="loading-text">Loading more cards...</span>
    </div>
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
/* Catalog-grid pattern (used by Amazon/Etsy/Shopify): fixed-width tracks
   that wrap. `auto-fill` with a fixed track size means every card is the
   same size regardless of count — 1 card, 3 cards, or 300 cards all render
   at the same width and pack left-to-right. The number of columns adapts
   to the viewport automatically; no media queries needed for desktop. */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 150px);
  gap: 10px;
  justify-content: start;
}

/* Phones are narrow enough that fixed-width cards waste too much space,
   so here we let columns stretch (1fr) to use the full row width. The
   per-tile max-width keeps an individual card from growing huge on a
   wider phone/tablet. */
@media (max-width: 480px) {
  .card-grid {
    grid-template-columns: repeat(auto-fit, minmax(115px, 1fr));
    gap: 6px;
  }
  .card-grid > * {
    max-width: 170px;
    width: 100%;
    justify-self: center;
  }
}

.no-filters {
  color: var(--text-secondary);
  font-size: 0.9rem;
  text-align: center;
  padding: 40px 20px;
}

.load-sentinel {
  text-align: center;
  padding: 20px;
}

.loading-text {
  color: var(--text-secondary);
  font-size: 0.8rem;
}
</style>

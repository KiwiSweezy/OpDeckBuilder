<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCardStore } from '../stores/cardStore'
import { getCardPriceUSD, getUsdToCadRate, formatPrice } from '../utils/pricing'

const cardStore = useCardStore()

/* Per-card price overlay support.
   Single batch watcher fetches every visible card's price when the deck
   changes; the cache in pricing.ts means repeat lookups are free. */
const cardPrices = ref<Record<string, number | null>>({})
const cadRate = ref(1.40)
getUsdToCadRate().then(r => { cadRate.value = r })

watch(() => cardStore.deck.map(c => c.id).join('|'), async (joined) => {
  if (!joined) { cardPrices.value = {}; return }
  const ids = Array.from(new Set(joined.split('|')))
  const results = await Promise.all(
    ids.map(id => getCardPriceUSD(id).then(p => [id, p] as const).catch(() => [id, null] as const))
  )
  const next: Record<string, number | null> = {}
  for (const [id, p] of results) next[id] = p
  cardPrices.value = next
}, { immediate: true })

function priceForCard(cardId: string): string | null {
  const p = cardPrices.value[cardId]
  if (typeof p !== 'number') return null
  return formatPrice(p, cardStore.currency, cadRate.value)
}

const colorOrder = ['red', 'blue', 'green', 'purple', 'black', 'yellow']
const typeOrder: Record<string, number> = { leader: 0, character: 1, event: 2, stage: 3 }

// Group deck cards by exact ID, sorted by type → primary color → secondary color → cost asc
const groupedDeck = computed(() => {
  const groups = new Map<string, { card: typeof cardStore.deck[0], count: number }>()
  for (const card of cardStore.deck) {
    const existing = groups.get(card.id)
    if (existing) {
      existing.count++
    } else {
      groups.set(card.id, { card, count: 1 })
    }
  }
  return Array.from(groups.values()).sort((a, b) => {
    // 1. Type: leader → character → event → stage
    const aType = typeOrder[a.card.type] ?? 9
    const bType = typeOrder[b.card.type] ?? 9
    if (aType !== bType) return aType - bType
    // 2. Primary color
    const aParts = a.card.color.split('/')
    const bParts = b.card.color.split('/')
    const aPrimary = colorOrder.indexOf(aParts[0] ?? '')
    const bPrimary = colorOrder.indexOf(bParts[0] ?? '')
    if (aPrimary !== bPrimary) return aPrimary - bPrimary
    // 3. Secondary color (-1 for mono-color sorts first)
    const aSecondary = aParts[1] ? colorOrder.indexOf(aParts[1]) : -1
    const bSecondary = bParts[1] ? colorOrder.indexOf(bParts[1]) : -1
    if (aSecondary !== bSecondary) return aSecondary - bSecondary
    // 4. Cost lowest to highest
    return a.card.cost - b.card.cost
  })
})

const leader = computed(() => {
  return cardStore.deck.find(c => c.type === 'leader') ?? null
})

const nonLeaderGroups = computed(() => {
  return groupedDeck.value.filter(entry => entry.card.type !== 'leader')
})
</script>

<template>
  <div class="deck-display">
    <div class="deck-display-header">
      <span class="deck-count">{{ cardStore.deckSize }} / 51</span>
      <div v-if="cardStore.searchChips.length > 0" class="active-filters">
        <span class="filters-label">Active filters:</span>
        <div
          v-for="chip in cardStore.searchChips"
          :key="chip"
          class="filter-chip"
        >
          <span class="chip-text">{{ chip }}</span>
          <button
            type="button"
            class="chip-x"
            @click="cardStore.removeSearchChip(chip)"
            :aria-label="`Remove ${chip}`"
          >×</button>
        </div>
        <button
          v-if="cardStore.searchChips.length > 1"
          type="button"
          class="clear-chips"
          @click="cardStore.clearSearchChips"
        >clear all</button>
      </div>
    </div>

    <div v-if="cardStore.deckSize === 0" class="deck-empty">
      Click cards below to build your deck
    </div>

    <div v-else class="deck-cards">
      <!-- Leader shown separately -->
      <div
        v-if="leader"
        class="card-stack leader-card"
        @mouseenter="cardStore.selectCard(leader)"
        @contextmenu.prevent="$event.shiftKey ? cardStore.removeAllFromDeck(leader.id) : cardStore.removeFromDeck(leader.id)"
      >
        <div class="stack-wrapper">
          <img :src="leader.images.small" :alt="leader.name" class="stack-img" />
        </div>
        <button
          class="remove-btn"
          title="Remove leader (shift+click to clear)"
          @click.stop="$event.shiftKey ? cardStore.removeAllFromDeck(leader.id) : cardStore.removeFromDeck(leader.id)"
        >×</button>
        <span v-if="priceForCard(leader.id)" class="price-badge">{{ priceForCard(leader.id) }}</span>
        <span class="card-label">Leader</span>
      </div>

      <!-- Non-leader cards: stacked copies -->
      <div
        v-for="entry in nonLeaderGroups"
        :key="entry.card.id"
        class="card-stack"
        :style="{ width: `${195 + (entry.count - 1) * 15}px` }"
        @click="cardStore.addToDeck(entry.card)"
        @mouseenter="cardStore.selectCard(entry.card)"
        @contextmenu.prevent="$event.shiftKey ? cardStore.removeAllFromDeck(entry.card.id) : cardStore.removeFromDeck(entry.card.id)"
      >
        <button
          class="remove-btn"
          title="Remove one (shift+click to remove all)"
          @click.stop="$event.shiftKey ? cardStore.removeAllFromDeck(entry.card.id) : cardStore.removeFromDeck(entry.card.id)"
        >×</button>
        <!--
          Each copy is rendered as a stacked image.
          CSS offsets them so they overlap like a fan.
        -->
        <div
          class="stack-wrapper"
          :style="{
            height: `calc(100% + ${(entry.count - 1) * 18}px)`,
            width: `calc(100% + ${(entry.count - 1) * 15}px)`
          }"
        >
          <img
            v-for="i in entry.count"
            :key="i"
            :src="entry.card.images.small"
            :alt="entry.card.name"
            class="stack-img"
            :style="{ top: `${(i - 1) * 18}px`, left: `${(i - 1) * 15}px` }"
          />
        </div>
        <span class="card-count-badge">x{{ entry.count }}</span>
        <span
          v-if="priceForCard(entry.card.id)"
          class="price-badge"
          :style="{ bottom: `${4 - (entry.count - 1) * 18}px` }"
        >{{ priceForCard(entry.card.id) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.deck-display {
  min-height: 80px;
}

.deck-display-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 8px;
}

.deck-count {
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: bold;
}

.active-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding-left: 12px;
  border-left: 1px solid var(--border-color);
}

.filters-label {
  color: var(--text-secondary);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 600;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px 2px 9px;
  background-color: var(--accent);
  color: white;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.filter-chip .chip-text {
  text-transform: capitalize;
}

.filter-chip .chip-x {
  width: 16px;
  height: 16px;
  padding: 0;
  background: rgba(0, 0, 0, 0.25);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 0.85rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
}

.filter-chip .chip-x:hover {
  background: rgba(0, 0, 0, 0.5);
}

.clear-chips {
  padding: 2px 8px;
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-secondary);
  font-size: 0.7rem;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.clear-chips:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.deck-empty {
  color: var(--text-secondary);
  font-size: 0.85rem;
  text-align: center;
  padding: 20px;
}

.deck-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 60px 14px;  /* extra row gap leaves room for the price tag below each card */
  align-items: flex-start;
}

/* Each card group is a stack container */
.card-stack {
  position: relative;
  width: 195px;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.card-stack:hover {
  transform: scale(1.05);
}

/* The wrapper holds all stacked copies with relative positioning */
.stack-wrapper {
  position: relative;
  width: 100%;
}

.stack-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 195px;
  display: block;
  border-radius: 4px;
  box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.5);
}

/* First image in a stack needs to be relative to establish flow */
.stack-img:first-child {
  position: relative;
}

.leader-card {
  border: 2px solid var(--accent);
  border-radius: 6px;
  padding: 4px;
  box-sizing: border-box;
}

.leader-card .stack-img {
  width: 100%;
}

.card-label {
  position: absolute;
  bottom: 2px;
  left: 2px;
  right: 2px;
  background: rgba(0, 0, 0, 0.7);
  color: var(--accent);
  font-size: 0.6rem;
  text-align: center;
  padding: 2px;
  font-weight: bold;
  text-transform: uppercase;
  border-radius: 2px;
}

.card-count-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(0, 0, 0, 0.85);
  color: white;
  font-size: 0.7rem;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 3px;
  z-index: 10;
}

/* Per-card market price tag — bottom-right of the front card, sits over
   the copyright/footer area so it doesn't cover any meaningful art or
   ability text. */
.price-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.85);
  color: #4dd0b2;
  font-size: 0.7rem;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
  padding: 1px 6px;
  border-radius: 8px;
  border: 1px solid rgba(77, 208, 178, 0.35);
  z-index: 10;
  pointer-events: none;
  white-space: nowrap;
  line-height: 1.3;
}


/* Remove button — sits in top-left corner of each stack.
   Visible on hover for mouse/trackpad users, always visible on touch. */
.remove-btn {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 22px;
  height: 22px;
  padding: 0;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 50%;
  color: white;
  font-size: 1rem;
  font-weight: bold;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 11;
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease, transform 0.1s ease;
}

.card-stack:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  background: var(--accent);
  transform: scale(1.1);
}

/* Touch devices: no hover, so always show the remove button */
@media (hover: none) {
  .remove-btn {
    opacity: 1;
  }
}
</style>

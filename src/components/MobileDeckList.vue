<script setup lang="ts">
import { computed } from 'vue'
import { useCardStore } from '../stores/cardStore'

const cardStore = useCardStore()

const colorOrder = ['red', 'blue', 'green', 'purple', 'black', 'yellow']
const typeOrder: Record<string, number> = { leader: 0, character: 1, event: 2, stage: 3 }

/** Same grouping/sorting logic as desktop DeckDisplay */
const groupedDeck = computed(() => {
  const groups = new Map<string, { card: typeof cardStore.deck[0], count: number }>()
  for (const card of cardStore.deck) {
    const existing = groups.get(card.id)
    if (existing) existing.count++
    else groups.set(card.id, { card, count: 1 })
  }
  return Array.from(groups.values()).sort((a, b) => {
    const aT = typeOrder[a.card.type] ?? 9
    const bT = typeOrder[b.card.type] ?? 9
    if (aT !== bT) return aT - bT
    const aParts = a.card.color.split('/')
    const bParts = b.card.color.split('/')
    const aP = colorOrder.indexOf(aParts[0] ?? '')
    const bP = colorOrder.indexOf(bParts[0] ?? '')
    if (aP !== bP) return aP - bP
    return a.card.cost - b.card.cost
  })
})

const leader = computed(() => cardStore.deck.find(c => c.type === 'leader') ?? null)
const nonLeaderGroups = computed(() => groupedDeck.value.filter(g => g.card.type !== 'leader'))

function tapCard(card: typeof cardStore.deck[0]) {
  cardStore.selectCard(card)
}
</script>

<template>
  <div class="mobile-deck">
    <div v-if="cardStore.deckSize === 0" class="deck-empty">
      <p>Your deck is empty</p>
      <p class="hint">Switch to the Cards tab to start adding cards</p>
    </div>

    <div v-else class="deck-cards-grid">
      <!-- Leader -->
      <div
        v-if="leader"
        class="deck-card leader-card"
        @click="tapCard(leader)"
      >
        <img :src="leader.images.small" :alt="leader.name" />
        <span class="leader-badge">L</span>
      </div>

      <!-- Non-leader cards: clean thumbnail + count badge.
           Tap opens the preview sheet with full info + qty controls. -->
      <div
        v-for="entry in nonLeaderGroups"
        :key="entry.card.id"
        class="deck-card"
        @click="tapCard(entry.card)"
      >
        <img :src="entry.card.images.small" :alt="entry.card.name" />
        <span v-if="entry.count > 1" class="count-badge">×{{ entry.count }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mobile-deck {
  width: 100%;
  padding: 8px;
}

.deck-empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

.deck-empty p { margin: 4px 0; }
.deck-empty .hint { font-size: 0.85rem; font-style: italic; }

/* Fixed 4 cards per row regardless of device width — keeps cards readable
   on small phones (iPhone 12) and uses larger sizes on big phones (S20 Ultra). */
.deck-cards-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.deck-card {
  position: relative;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.deck-card:active { transform: scale(0.95); }

.deck-card img {
  width: 100%;
  display: block;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.leader-card img {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.leader-badge {
  position: absolute;
  top: 3px;
  left: 3px;
  background: var(--accent);
  color: white;
  font-size: 0.6rem;
  font-weight: bold;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.count-badge {
  position: absolute;
  top: 3px;
  right: 3px;
  background: rgba(0, 0, 0, 0.88);
  color: white;
  font-size: 0.7rem;
  font-weight: bold;
  padding: 2px 5px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  pointer-events: none;
}
</style>

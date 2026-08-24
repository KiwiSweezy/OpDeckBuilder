<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useCardStore } from '../stores/cardStore'
import { getCardPriceUSD, getUsdToCadRate, getUsdToGbpRate, formatPrice } from '../utils/pricing'

const cardStore = useCardStore()

/* Per-card price overlay support.
   Single batch watcher fetches every visible card's price when the deck
   changes; the cache in pricing.ts means repeat lookups are free. */
const cardPrices = ref<Record<string, number | null>>({})
const fxRates = ref({ CAD: 1.40, GBP: 0.79 })
getUsdToCadRate().then(r => { fxRates.value = { ...fxRates.value, CAD: r } })
getUsdToGbpRate().then(r => { fxRates.value = { ...fxRates.value, GBP: r } })

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
  return formatPrice(p, cardStore.currency, fxRates.value)
}

/* Deck card sizing.
   The base card width follows the pane instead of being a constant: handing the
   deck the large pane is pointless if the cards stay rail-sized and leave most
   of it empty. We aim for roughly six columns and clamp to a sane card size, so
   a 420px rail keeps ~108px cards while a 1180px pane grows them to ~180px.
   The user's zoom (0.6-1.4) still multiplies on top, and the stack offsets
   scale with the card so the fanned-stack visual holds throughout. */
const MIN_CARD_W = 108
const MAX_CARD_W = 190
const TARGET_COLUMNS = 6
const COLUMN_GAP = 10

const rootEl = ref<HTMLElement | null>(null)
const paneWidth = ref(0)

let paneObserver: ResizeObserver | null = null
onMounted(() => {
  if (!rootEl.value) return
  paneWidth.value = rootEl.value.clientWidth
  paneObserver = new ResizeObserver(() => {
    if (rootEl.value) paneWidth.value = rootEl.value.clientWidth
  })
  paneObserver.observe(rootEl.value)
})
onBeforeUnmount(() => { paneObserver?.disconnect(); paneObserver = null })

const baseCardW = computed(() => {
  const w = paneWidth.value
  if (!w) return MIN_CARD_W
  const fit = Math.floor(w / TARGET_COLUMNS) - COLUMN_GAP
  return Math.max(MIN_CARD_W, Math.min(MAX_CARD_W, fit))
})

/* Offsets stay proportional to the card so the fan reads the same at any size. */
const cardW = computed(() => Math.round(baseCardW.value * cardStore.deckCardScale))
const offsetScale = computed(() => (cardW.value / MIN_CARD_W))
const hOffset = computed(() => +(5 * offsetScale.value).toFixed(2))
const vOffset = computed(() => +(8 * offsetScale.value).toFixed(2))

/* CSS custom properties consumed by the scoped stylesheet — bound to one
   element so a single style mutation re-flows every card in the deck. */
const deckSizeStyle = computed(() => ({
  '--deck-card-w': `${cardW.value}px`,
  '--deck-h-offset': `${hOffset.value}px`,
  '--deck-v-offset': `${vOffset.value}px`,
}))

function bumpScale(delta: number) {
  cardStore.setDeckCardScale(cardStore.deckCardScale + delta)
}

const colorOrder = ['red', 'blue', 'green', 'purple', 'black', 'yellow']
const typeOrder: Record<string, number> = { leader: 0, character: 1, event: 2, stage: 3 }

// Group deck cards by exact ID, sorted by type → primary color → secondary color → cost asc
const groupedDeck = computed(() => {
  // `deck` is the user's own prints and stays the identity used by every action;
  // `displayDeck` is the same list with Bling substitutions applied. They are
  // index-aligned, so pair them and render the display print while acting on the
  // real one — that keeps add/remove, the 4-copy limit and saving bling-proof.
  const deck = cardStore.deck
  const display = cardStore.displayDeck
  const groups = new Map<string, { card: typeof cardStore.deck[0], display: typeof cardStore.deck[0], count: number }>()
  for (let i = 0; i < deck.length; i++) {
    const card = deck[i]!
    const existing = groups.get(card.id)
    if (existing) {
      existing.count++
    } else {
      groups.set(card.id, { card, display: display[i] ?? card, count: 1 })
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

/** The leader's display print (Bling-substituted), falling back to the real one. */
const leaderDisplay = computed(() => {
  const i = cardStore.deck.findIndex(c => c.type === 'leader')
  if (i === -1) return null
  return cardStore.displayDeck[i] ?? cardStore.deck[i] ?? null
})

const nonLeaderGroups = computed(() => {
  return groupedDeck.value.filter(entry => entry.card.type !== 'leader')
})
</script>

<template>
  <div ref="rootEl" class="deck-display" :style="deckSizeStyle">
    <div class="deck-display-header">
      <span class="deck-title">Deck</span>

      <!-- Card size chips: shrink / grow every card in the deck preview together.
           Sits right next to the deck count so it can't collide with the
           floating Share/Proxy/Market pills in the top-right of .deck-area. -->
      <div class="size-chips" title="Resize deck cards">
        <button
          type="button"
          class="size-chip"
          :disabled="cardStore.deckCardScale <= 0.6"
          @click="bumpScale(-0.1)"
          aria-label="Shrink cards"
        >−</button>
        <span class="size-chip-value">{{ Math.round(cardStore.deckCardScale * 100) }}%</span>
        <button
          type="button"
          class="size-chip"
          :disabled="cardStore.deckCardScale >= 1.4"
          @click="bumpScale(0.1)"
          aria-label="Grow cards"
        >+</button>
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
        @mouseenter="cardStore.selectCard(leaderDisplay ?? leader)"
        @contextmenu.prevent="$event.shiftKey ? cardStore.removeAllFromDeck(leader.id) : cardStore.removeFromDeck(leader.id)"
      >
        <div class="stack-wrapper">
          <img :src="(leaderDisplay ?? leader).images.small" :alt="leader.name" class="stack-img"
            width="600" height="838" decoding="async" />
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
        :style="{ width: `calc(var(--deck-card-w) + ${entry.count - 1} * var(--deck-h-offset))` }"
        @click="cardStore.addToDeck(entry.card)"
        @mouseenter="cardStore.selectCard(entry.display)"
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
            height: `calc(100% + ${entry.count - 1} * var(--deck-v-offset))`,
            width: `calc(100% + ${entry.count - 1} * var(--deck-h-offset))`
          }"
        >
          <img
            v-for="i in entry.count"
            :key="i"
            :src="entry.display.images.small"
            :alt="entry.card.name"
            class="stack-img"
            :style="{
              top: `calc(${i - 1} * var(--deck-v-offset))`,
              left: `calc(${i - 1} * var(--deck-h-offset))`
            }"
          />
        </div>
        <span class="card-count-badge">x{{ entry.count }}</span>
        <span
          v-if="priceForCard(entry.card.id)"
          class="price-badge"
          :style="{ bottom: `calc(4px - ${entry.count - 1} * var(--deck-v-offset))` }"
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

/* Card size chips — sit inline next to the deck count, well clear of the
   floating Share / Proxy / Market pills anchored to the top-right corner. */
.size-chips {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 14px;
}

.size-chip {
  width: 22px;
  height: 22px;
  padding: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 50%;
  color: var(--text-primary);
  font-size: 0.95rem;
  font-weight: bold;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;
}

.size-chip:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.size-chip:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.size-chip-value {
  color: var(--text-secondary);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  min-width: 30px;
  text-align: center;
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
  /* Row gap scales with card size so spacing reads consistently across the
     0.6→1.4 zoom range. Column gap stays small/constant. */
  gap: calc(var(--deck-card-w, 108px) * 0.34) 10px;
  align-items: flex-start;
}

/* Each card group is a stack container */
.card-stack {
  position: relative;
  width: var(--deck-card-w, 108px);
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
  width: var(--deck-card-w, 108px);
  /* Required: the width/height attributes on these <img> tags reserve space
     before decode, but without this the height attribute wins as the used
     height and the card stretches. */
  height: auto;
  aspect-ratio: var(--card-aspect);
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
  height: auto;
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

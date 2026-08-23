<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '../types/Card'
import { useCardStore } from '../stores/cardStore'

/*
  `isMobile` arrives as a prop from CardGrid, which owns the single
  useBreakpoint() subscription for the whole pool. Calling the composable here
  registered an onMounted + onUnmounted pair for every tile on screen.
*/
const props = withDefaults(
  defineProps<{ card: Card; isMobile?: boolean }>(),
  { isMobile: false }
)

const emit = defineEmits<{
  select: [card: Card]
  preview: [card: Card]
}>()

const cardStore = useCardStore()

/** How many copies of this card are in the current deck (O(1) lookup) */
const countInDeck = computed(() => cardStore.deckCounts[props.card.id] ?? 0)

/** Primary color for the border accent (first half of "red/blue" → "red") */
const primaryColor = computed(() => props.card.color.split('/')[0] ?? '')

function handleAdd(e: Event) {
  e.stopPropagation()
  cardStore.addToDeck(props.card)
}

function handleRemove(e: Event) {
  e.stopPropagation()
  cardStore.removeFromDeck(props.card.id)
}
</script>

<template>
  <!-- Mobile: Exburst-style tile with name, colored border, integrated qty controls -->
  <div
    v-if="isMobile"
    :class="['card-tile', `border-${primaryColor}`]"
    @click="emit('preview', card)"
  >
    <div class="tile-img-wrap">
      <!--
        width/height + aspect-ratio reserve the tile's box before the bytes
        arrive, so the grid never collapses to 0px and then jump-reflows.
      -->
      <img
        :src="card.images.small"
        :alt="card.name"
        width="600"
        height="838"
        loading="lazy"
        decoding="async"
      />
      <span class="cost-badge">{{ card.cost }}</span>
    </div>
    <div class="tile-name">{{ card.name }}</div>
    <div class="tile-controls">
      <button
        class="ctrl-btn minus"
        :disabled="countInDeck === 0"
        @click="handleRemove"
        aria-label="Remove one"
      >−</button>
      <span class="ctrl-count">{{ countInDeck }}</span>
      <button
        class="ctrl-btn plus"
        @click="handleAdd"
        aria-label="Add one"
      >+</button>
    </div>
  </div>

  <!-- Desktop: simple image-only thumbnail -->
  <div
    v-else
    class="card-thumbnail"
    @click="emit('select', card)"
    @mouseenter="emit('preview', card)"
  >
    <img
      :src="card.images.small"
      :alt="card.name"
      width="600"
      height="838"
      loading="lazy"
      decoding="async"
    />
  </div>
</template>

<style scoped>
/* ===== DESKTOP THUMBNAIL ===== */
/*
  aspect-ratio gives the tile its full height on the very first layout pass,
  before the image has loaded. Without it the grid item had no intrinsic
  height, every row collapsed to 0px and then reflowed as artwork decoded.
*/
.card-thumbnail {
  aspect-ratio: var(--card-aspect);
  border-radius: var(--radius-card);
  overflow: hidden;
  cursor: pointer;
  background: var(--surface-raised);
  transition: transform var(--dur-fast) var(--ease-out);
}

.card-thumbnail:hover {
  transform: scale(1.05);
}

.card-thumbnail img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

/* ===== MOBILE TILE ===== */
.card-tile {
  background: var(--surface-raised-2);
  border: 2px solid var(--border-default);
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: transform var(--dur-instant) var(--ease-out);
}

.card-tile:active {
  transform: scale(0.97);
}

.tile-img-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: var(--card-aspect);
  background: var(--surface-sunken);
}

.tile-img-wrap img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.cost-badge {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  background: rgba(0, 0, 0, 0.85);
  color: var(--text-strong);
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-strong);
}

.tile-name {
  padding: var(--space-2) var(--space-3) var(--space-1);
  color: var(--text-default);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: var(--leading-tight);
}

.tile-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-2) var(--space-3);
  gap: var(--space-1);
}

.ctrl-btn {
  width: 26px;
  height: 26px;
  background: var(--surface-raised);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-pill);
  color: var(--text-default);
  font-size: var(--text-md);
  font-weight: var(--weight-bold);
  line-height: 1;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ctrl-btn:active:not(:disabled) {
  transform: scale(0.9);
}

.ctrl-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.ctrl-btn.plus {
  background: var(--positive);
  color: var(--text-inverse);
  border-color: var(--positive);
}

.ctrl-btn.minus:not(:disabled) {
  background: var(--danger);
  color: var(--text-inverse);
  border-color: var(--danger);
}

.ctrl-count {
  color: var(--text-strong);
  font-size: var(--text-base);
  font-weight: var(--weight-bold);
  min-width: 20px;
  text-align: center;
}

/* Color-coded borders to match card color (Exburst pattern) */
.border-red    { border-color: var(--op-red); }
.border-blue   { border-color: var(--op-blue); }
.border-green  { border-color: var(--op-green); }
.border-purple { border-color: var(--op-purple); }
.border-black  { border-color: var(--op-black); }
.border-yellow { border-color: var(--op-yellow); }
</style>

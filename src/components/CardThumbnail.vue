<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '../types/Card'
import { useCardStore } from '../stores/cardStore'
import { useBreakpoint } from '../composables/useBreakpoint'

const props = defineProps<{ card: Card }>()
const emit = defineEmits<{
  select: [card: Card]
  preview: [card: Card]
}>()

const cardStore = useCardStore()
const { isMobile } = useBreakpoint()

/** How many copies of this card are in the current deck */
const countInDeck = computed(() =>
  cardStore.deck.filter(c => c.id === props.card.id).length
)

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
      <img :src="card.images.small" :alt="card.name" loading="lazy" />
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

  <!-- Desktop: simple image-only thumbnail (unchanged) -->
  <div
    v-else
    class="card-thumbnail"
    @click="emit('select', card)"
    @mouseenter="emit('preview', card)"
  >
    <img :src="card.images.small" :alt="card.name" loading="lazy" />
  </div>
</template>

<style scoped>
/* ===== DESKTOP THUMBNAIL ===== */
.card-thumbnail {
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.15s ease;
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
  background: var(--bg-tertiary);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: transform 0.1s ease;
}

.card-tile:active {
  transform: scale(0.97);
}

.tile-img-wrap {
  position: relative;
  width: 100%;
}

.tile-img-wrap img {
  width: 100%;
  display: block;
}

.cost-badge {
  position: absolute;
  top: 4px;
  left: 4px;
  background: rgba(0, 0, 0, 0.85);
  color: white;
  font-size: 0.72rem;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.25);
}

.tile-name {
  padding: 4px 6px 2px;
  color: var(--text-primary);
  font-size: 0.72rem;
  font-weight: 500;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.tile-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 6px;
  gap: 2px;
}

.ctrl-btn {
  width: 26px;
  height: 26px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 50%;
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: bold;
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
  background: #2e7d32;
  color: white;
  border-color: #2e7d32;
}

.ctrl-btn.minus:not(:disabled) {
  background: #c62828;
  color: white;
  border-color: #c62828;
}

.ctrl-count {
  color: var(--text-primary);
  font-size: 0.95rem;
  font-weight: bold;
  min-width: 20px;
  text-align: center;
}

/* Color-coded borders to match card color (Exburst pattern) */
.border-red    { border-color: #c62828; }
.border-blue   { border-color: #1565c0; }
.border-green  { border-color: #2e7d32; }
.border-purple { border-color: #6a1b9a; }
.border-black  { border-color: #555; }
.border-yellow { border-color: #f9a825; }
</style>

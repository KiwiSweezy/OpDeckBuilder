<script setup lang="ts">
import { useCardStore } from '../stores/cardStore'

const cardStore = useCardStore()

function handleEnter() {
  cardStore.commitSearchChip()
}

function handleBackspace(e: KeyboardEvent) {
  // If input is empty and user hits backspace, drop the last chip
  if (cardStore.searchQuery === '' && cardStore.searchChips.length > 0) {
    e.preventDefault()
    cardStore.searchChips.pop()
  }
}
</script>

<template>
  <div class="search-bar">
    <div class="search-wrap">
      <input
        v-model="cardStore.searchQuery"
        type="text"
        :placeholder="cardStore.searchChips.length > 0 ? 'Add another filter...' : 'Search by name, ID, family, or ability...'"
        class="search-input"
        @keydown.enter.prevent="handleEnter"
        @keydown.delete="handleBackspace"
      />

      <button
        type="button"
        class="search-add"
        :disabled="!cardStore.searchQuery.trim()"
        @click="handleEnter"
        title="Add as filter (Enter or +)"
      >+</button>
    </div>
  </div>
</template>

<style scoped>
.search-bar {
  margin-bottom: 6px;
}

.search-wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 4px 4px 4px 8px;
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  transition: border-color 0.15s ease;
}

.search-wrap:focus-within {
  border-color: var(--accent);
}

.search-input {
  flex: 1;
  min-width: 120px;
  padding: 4px 6px;
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.search-add {
  width: 26px;
  height: 26px;
  padding: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 1.1rem;
  font-weight: bold;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.search-add:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.search-add:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>

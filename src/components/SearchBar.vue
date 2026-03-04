<script setup lang="ts">
import { useCardStore } from '../stores/cardStore'

const cardStore = useCardStore()
</script>

<template>
  <div class="search-bar">
    <input
      v-model="cardStore.searchQuery"
      type="text"
      placeholder="Search by name, ID, family, or ability..."
      class="search-input"
    />
  </div>
</template>

<style scoped>
.search-bar {
  margin-bottom: 12px;
}

.search-input {
  width: 100%;
  padding: 10px 14px;
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.search-input:focus {
  border-color: var(--accent);
}
</style>
